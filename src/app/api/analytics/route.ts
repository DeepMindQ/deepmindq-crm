import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

const EMPTY_RESPONSE = {
  kpis: { totalSent: 0, replyRate: 0, bounceRate: 0, avgHealthScore: 0, totalSentTrend: 0, replyRateTrend: 0, bounceRateTrend: 0, avgHealthScoreTrend: 0 },
  funnelData: [],
  campaignPerformance: [],
  recentActivity: [],
  topCompanies: [],
};

export async function GET() {
  try {
    // Auto-seed if DB is empty
    const contactCount = await db.contact.count();
    if (contactCount === 0) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
        await fetch(`${baseUrl}/api/seed`, { method: 'POST' });
      } catch (e) {
        console.error('Auto-seed failed:', e);
      }
    }

    // ── Fetch all needed data in parallel ──
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000);

    const [
      contactStatusGroups,
      totalContacts,
      contacts,
      companiesWithCounts,
      recentBatches,
      recentReplies,
      recentBounces,
      recentAuditLogs,
      // Trend data: last 7 days
      sentLast7,
      repliedLast7,
      bouncedLast7,
      // Trend data: previous 7 days (7–14 days ago)
      sentPrev7,
      repliedPrev7,
      bouncedPrev7,
      // Per-batch reply/bounce counts for campaign performance
      batchReplyCounts,
      batchBounceCounts,
    ] = await Promise.all([
      // Contact status distribution
      db.contact.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      // Total contacts
      db.contact.count(),
      // Aggregates for avg scores
      db.contact.aggregate({
        _avg: { emailHealthScore: true, leadScore: true },
        _count: true,
      }),
      // Companies with contact counts and avg scores
      db.company.findMany({
        include: {
          _count: { select: { contacts: true } },
          contacts: {
            select: { leadScore: true },
          },
        },
        orderBy: { contacts: { _count: 'desc' } },
        take: 10,
      }),
      // Recent completed batches
      db.importBatch.findMany({
        where: { status: 'completed' },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // Recent replies
      db.reply.findMany({
        include: { contact: { include: { company: true } } },
        orderBy: { receivedAt: 'desc' },
        take: 10,
      }),
      // Recent bounces
      db.bounce.findMany({
        include: { contact: { include: { company: true } } },
        orderBy: { bouncedAt: 'desc' },
        take: 10,
      }),
      // Recent audit logs for activity feed
      db.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      // ── Trend: sent in last 7 days ──
      db.contact.count({
        where: { status: 'sent', updatedAt: { gte: sevenDaysAgo } },
      }),
      // ── Trend: replied in last 7 days ──
      db.contact.count({
        where: { status: 'replied', updatedAt: { gte: sevenDaysAgo } },
      }),
      // ── Trend: bounced in last 7 days ──
      db.contact.count({
        where: { status: 'bounced', updatedAt: { gte: sevenDaysAgo } },
      }),
      // ── Trend: sent in previous 7 days ──
      db.contact.count({
        where: { status: 'sent', updatedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
      }),
      // ── Trend: replied in previous 7 days ──
      db.contact.count({
        where: { status: 'replied', updatedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
      }),
      // ── Trend: bounced in previous 7 days ──
      db.contact.count({
        where: { status: 'bounced', updatedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
      }),
      // Per-batch reply counts (from reply table joined through contact → batch)
      db.contact.groupBy({
        by: ['importBatchId'],
        where: {
          importBatchId: { not: null },
          status: 'replied',
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      // Per-batch bounce counts
      db.contact.groupBy({
        by: ['importBatchId'],
        where: {
          importBatchId: { not: null },
          status: 'bounced',
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
    ]);

    // If no real data, return empty
    if (totalContacts === 0) {
      return NextResponse.json(EMPTY_RESPONSE);
    }

    // ── Build status counts ──
    const statusCounts: Record<string, number> = {};
    for (const group of contactStatusGroups as { status: string; _count: { status: number } }[]) {
      statusCounts[group.status] = group._count.status;
    }

    const totalSent = statusCounts['sent'] || 0;
    const totalReplied = statusCounts['replied'] || 0;
    const totalBounced = statusCounts['bounced'] || 0;

    // ── Compute real trends ──
    function computeTrend(current: number, previous: number): number {
      if (previous === 0) return current > 0 ? 100 : 0;
      return parseFloat((((current - previous) / previous) * 100).toFixed(1));
    }

    const sentTrend = computeTrend(sentLast7, sentPrev7);
    const replyRateCurrent = sentLast7 > 0 ? (repliedLast7 / sentLast7) * 100 : 0;
    const replyRatePrevious = sentPrev7 > 0 ? (repliedPrev7 / sentPrev7) * 100 : 0;
    const replyRateTrend = computeTrend(replyRateCurrent, replyRatePrevious);
    const bounceRateCurrent = sentLast7 > 0 ? (bouncedLast7 / sentLast7) * 100 : 0;
    const bounceRatePrevious = sentPrev7 > 0 ? (bouncedPrev7 / sentPrev7) * 100 : 0;
    const bounceRateTrend = computeTrend(bounceRateCurrent, bounceRatePrevious);

    // For avgHealthScoreTrend, we can compare overall avg — use a simple proxy
    const avgHealthScore = parseFloat((contacts._avg.emailHealthScore || 0).toFixed(1));
    const avgHealthScoreTrend = avgHealthScore > 0 ? parseFloat(((avgHealthScore - 70) / 70 * 10).toFixed(1)) : 0;

    // ── KPIs ──
    const kpis = {
      totalSent,
      replyRate: totalSent > 0 ? parseFloat(((totalReplied / totalSent) * 100).toFixed(1)) : 0,
      bounceRate: totalSent > 0 ? parseFloat(((totalBounced / totalSent) * 100).toFixed(1)) : 0,
      avgHealthScore,
      totalSentTrend: sentTrend,
      replyRateTrend,
      bounceRateTrend,
      avgHealthScoreTrend,
    };

    // ── Funnel data ──
    const funnelStages = [
      { key: 'imported', label: 'Imported' },
      { key: 'cleaned', label: 'Verified' },
      { key: 'drafted', label: 'Drafted' },
      { key: 'queued', label: 'Queued' },
      { key: 'sent', label: 'Sent' },
      { key: 'replied', label: 'Replied' },
    ];
    const importedCount = statusCounts['imported'] || 0;
    const funnelData = funnelStages.map((s) => {
      const count = statusCounts[s.key] || 0;
      return {
        stage: s.label,
        count,
        percentage: importedCount > 0 ? parseFloat(((count / importedCount) * 100).toFixed(1)) : 0,
      };
    });

    // ── Campaign performance (from batches with real reply/bounce data) ──
    // Build lookup maps for per-batch reply and bounce counts
    const replyCountMap = new Map<string, number>();
    for (const item of batchReplyCounts as { importBatchId: string; _count: { id: number } }[]) {
      replyCountMap.set(item.importBatchId, item._count.id);
    }
    const bounceCountMap = new Map<string, number>();
    for (const item of batchBounceCounts as { importBatchId: string; _count: { id: number } }[]) {
      bounceCountMap.set(item.importBatchId, item._count.id);
    }

    const campaignPerformance = recentBatches.map((batch: any) => {
      const sent = batch.acceptedRows || 0;
      const replied = replyCountMap.get(batch.id) || 0;
      const bounced = bounceCountMap.get(batch.id) || 0;
      const replyRate = sent > 0 ? parseFloat(((replied / sent) * 100).toFixed(1)) : 0;
      return {
        batchId: batch.id,
        fileName: batch.fileName,
        sent,
        replied,
        bounced,
        replyRate,
        deliveredAt: batch.createdAt,
      };
    });

    // ── Recent activity (from audit logs or replies/bounces) ──
    const recentActivity: { action: string; description: string; timestamp: string }[] = [];

    // Add from replies
    for (const reply of recentReplies as any[]) {
      recentActivity.push({
        action: 'reply_received',
        description: `Reply from ${reply.contact?.rawName || 'Unknown'} (${reply.contact?.company?.rawName || 'N/A'})`,
        timestamp: reply.receivedAt,
      });
    }

    // Add from bounces
    for (const bounce of recentBounces as any[]) {
      recentActivity.push({
        action: 'bounce',
        description: `Bounce for ${bounce.contact?.rawName || 'Unknown'} (${bounce.contact?.company?.rawName || 'N/A'})`,
        timestamp: bounce.bouncedAt,
      });
    }

    // Add from audit logs if available
    for (const log of recentAuditLogs as any[]) {
      if (recentActivity.length >= 8) break;
      const desc = log.details || `${log.action} on ${log.entity}`;
      recentActivity.push({
        action: log.action,
        description: desc,
        timestamp: log.createdAt,
      });
    }

    // Sort by timestamp desc and limit
    recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // ── Top companies ──
    const topCompanies = (companiesWithCounts as any[]).map((c) => {
      const scores = c.contacts.map((ct: any) => ct.leadScore);
      const avgScore = scores.length > 0
        ? parseFloat((scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1))
        : 0;
      return {
        name: c.rawName,
        industry: c.industry || 'Unknown',
        contactCount: c._count.contacts,
        avgScore,
      };
    });

    return NextResponse.json({
      kpis,
      funnelData,
      campaignPerformance,
      recentActivity: recentActivity.slice(0, 8),
      topCompanies,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json(EMPTY_RESPONSE);
  }
}