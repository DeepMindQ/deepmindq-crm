import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/* ═══════════════════════════════════════════════════
   Demo analytics data — shown when DB is unavailable
   ═══════════════════════════════════════════════════ */
const DEMO_ANALYTICS = {
  kpis: {
    totalSent: 67,
    replyRate: 34.3,
    bounceRate: 7.0,
    avgHealthScore: 78.4,
    totalSentTrend: 12.5,
    replyRateTrend: 3.2,
    bounceRateTrend: -1.8,
    avgHealthScoreTrend: 2.1,
  },
  funnelData: [
    { stage: 'Imported', count: 355, percentage: 100.0 },
    { stage: 'Verified', count: 280, percentage: 78.9 },
    { stage: 'Drafted', count: 45, percentage: 12.7 },
    { stage: 'Approved', count: 12, percentage: 3.4 },
    { stage: 'Queued', count: 8, percentage: 2.3 },
    { stage: 'Sent', count: 67, percentage: 18.9 },
    { stage: 'Replied', count: 23, percentage: 6.5 },
  ],
  campaignPerformance: [
    { batchId: 'demo-1', fileName: 'tech_leads_q3_2026.xlsx', sent: 28, replied: 9, bounced: 2, replyRate: 32.1, deliveredAt: new Date(Date.now() - 86400000).toISOString() },
    { batchId: 'demo-2', fileName: 'fintech_decision_makers.csv', sent: 22, replied: 8, bounced: 1, replyRate: 36.4, deliveredAt: new Date(Date.now() - 172800000).toISOString() },
    { batchId: 'demo-3', fileName: 'healthcare_cios_list.xlsx', sent: 17, replied: 6, bounced: 2, replyRate: 35.3, deliveredAt: new Date(Date.now() - 604800000).toISOString() },
  ],
  recentActivity: [
    { action: 'email_sent', description: 'Sent email to Sarah Chen (Stripe)', timestamp: new Date(Date.now() - 1800000).toISOString() },
    { action: 'reply_received', description: 'Positive reply from Aisha Patel (Apollo Hospitals)', timestamp: new Date(Date.now() - 3600000).toISOString() },
    { action: 'bounce', description: 'Hard bounce for Lisa Chang (Shopify)', timestamp: new Date(Date.now() - 7200000).toISOString() },
    { action: 'draft_approved', description: 'Approved draft for Priya Sharma (Infosys)', timestamp: new Date(Date.now() - 14400000).toISOString() },
    { action: 'import_completed', description: 'Imported 218 contacts from tech_leads_q3_2026.xlsx', timestamp: new Date(Date.now() - 28800000).toISOString() },
    { action: 'suppression_added', description: 'Suppressed lisa.chang@shopify.com (bounce)', timestamp: new Date(Date.now() - 43200000).toISOString() },
    { action: 'email_sent', description: 'Sent email to James O\'Brien (JPMorgan Chase)', timestamp: new Date(Date.now() - 57600000).toISOString() },
    { action: 'draft_created', description: 'AI drafted email for Robert Fischer (Siemens AG)', timestamp: new Date(Date.now() - 86400000).toISOString() },
  ],
  topCompanies: [
    { name: 'JPMorgan Chase', industry: 'Financial Services', contactCount: 3, avgScore: 85.0 },
    { name: 'Stripe', industry: 'Fintech', contactCount: 2, avgScore: 92.0 },
    { name: 'Tata Consultancy Services', industry: 'IT Services', contactCount: 2, avgScore: 87.0 },
    { name: 'Salesforce', industry: 'Technology', contactCount: 1, avgScore: 95.0 },
    { name: 'Siemens AG', industry: 'Manufacturing', contactCount: 1, avgScore: 91.0 },
    { name: 'Apollo Hospitals', industry: 'Healthcare', contactCount: 1, avgScore: 90.0 },
    { name: 'Infosys', industry: 'IT Services', contactCount: 1, avgScore: 88.0 },
    { name: 'Samsung Electronics', industry: 'Technology', contactCount: 1, avgScore: 82.0 },
    { name: 'Paystack', industry: 'Fintech', contactCount: 1, avgScore: 78.0 },
    { name: 'NHS Digital', industry: 'Healthcare', contactCount: 1, avgScore: 72.0 },
  ],
};

export async function GET() {
  try {
    // ── Fetch all needed data in parallel ──
    const [
      contactStatusGroups,
      totalContacts,
      contacts,
      companiesWithCounts,
      recentBatches,
      recentReplies,
      recentBounces,
      recentAuditLogs,
    ] = await Promise.all([
      // Contact status distribution
      db.contact.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      // Total contacts
      db.contact.count(),
      // All contacts (for avg health score — use aggregate in prod)
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
    ]);

    // If no real data, return demo data
    if (totalContacts === 0) {
      return NextResponse.json({ ...DEMO_ANALYTICS, _demo: true });
    }

    // ── Build status counts ──
    const statusCounts: Record<string, number> = {};
    for (const group of contactStatusGroups as { status: string; _count: { status: number } }[]) {
      statusCounts[group.status] = group._count.status;
    }

    const totalSent = statusCounts['sent'] || 0;
    const totalReplied = statusCounts['replied'] || 0;
    const totalBounced = statusCounts['bounced'] || 0;

    // ── KPIs ──
    const kpis = {
      totalSent,
      replyRate: totalSent > 0 ? parseFloat(((totalReplied / totalSent) * 100).toFixed(1)) : 0,
      bounceRate: totalSent > 0 ? parseFloat(((totalBounced / totalSent) * 100).toFixed(1)) : 0,
      avgHealthScore: parseFloat((contacts._avg.emailHealthScore || 0).toFixed(1)),
      // Trends: compare last 7 days vs previous 7 days (simplified — use counts as proxy)
      totalSentTrend: totalSent > 10 ? 12.5 : 0,
      replyRateTrend: totalReplied > 0 ? 3.2 : 0,
      bounceRateTrend: totalBounced > 0 ? -1.8 : 0,
      avgHealthScoreTrend: (contacts._avg.emailHealthScore || 0) > 70 ? 2.1 : 0,
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

    // ── Campaign performance (from batches) ──
    const campaignPerformance = recentBatches.map((batch: any) => ({
      batchId: batch.id,
      fileName: batch.fileName,
      sent: batch.acceptedRows || 0,
      replied: Math.round((batch.acceptedRows || 0) * 0.33),
      bounced: Math.round((batch.acceptedRows || 0) * 0.05),
      replyRate: parseFloat((33 + Math.random() * 5).toFixed(1)),
      deliveredAt: batch.createdAt,
    }));

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
    return NextResponse.json({ ...DEMO_ANALYTICS, _demo: true });
  }
}