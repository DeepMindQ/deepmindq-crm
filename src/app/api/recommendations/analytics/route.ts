import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';

const analyticsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

/**
 * GET /api/recommendations/analytics
 *
 * Returns recommendation analytics including:
 * - Status distribution (count by status)
 * - Reasoning method distribution (count by reasoningMethod)
 * - Acceptance rate over time (time-series)
 * - Feedback sentiment distribution
 * - Recommendation counts by type over time
 */
export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const parsed = analyticsQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { days } = parsed.data;
    const since = new Date();
    since.setDate(since.getDate() - days);

    // ── 1. Recommendation status distribution ──
    const statusGroups = await db.insight.groupBy({
      by: ['status'],
      where: { category: 'recommendation' },
      _count: { id: true },
    });

    const statusMap: Record<string, number> = {
      active: 0,
      acted_upon: 0,
      dismissed: 0,
      expired: 0,
    };
    for (const g of statusGroups) {
      statusMap[g.status] = g._count.id;
    }

    // ── 2. Reasoning method distribution ──
    const methodGroups = await db.insight.groupBy({
      by: ['reasoningMethod'],
      where: { category: 'recommendation' },
      _count: { id: true },
    });

    const byMethod: Record<string, number> = {};
    for (const g of methodGroups) {
      byMethod[g.reasoningMethod] = g._count.id;
    }

    // ── 3. Acceptance rate over time (daily buckets) ──
    const allRecentRecs = await db.insight.findMany({
      where: {
        category: 'recommendation',
        createdAt: { gte: since },
      },
      select: {
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date
    const dailyBuckets: Record<string, { total: number; accepted: number }> = {};
    for (const rec of allRecentRecs) {
      const day = rec.createdAt.toISOString().slice(0, 10);
      if (!dailyBuckets[day]) dailyBuckets[day] = { total: 0, accepted: 0 };
      dailyBuckets[day].total += 1;
      if (rec.status === 'acted_upon') dailyBuckets[day].accepted += 1;
    }

    const acceptanceRateOverTime = Object.entries(dailyBuckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { total, accepted }]) => ({
        date,
        total,
        accepted,
        acceptanceRate: total > 0 ? Math.round((accepted / total) * 100) : 0,
      }));

    // ── 4. Recommendation counts by type over time ──
    const recsByType = await db.insight.groupBy({
      by: ['reasoningMethod', 'status'],
      where: {
        category: 'recommendation',
        createdAt: { gte: since },
      },
      _count: { id: true },
    });

    const countsByType: Record<string, number> = {};
    for (const g of recsByType) {
      const key = g.reasoningMethod;
      if (!countsByType[key]) countsByType[key] = 0;
      countsByType[key] += g._count.id;
    }

    // ── 5. Feedback sentiment distribution from AuditLog ──
    const feedbackLogs = await db.auditLog.findMany({
      where: {
        action: 'feedback',
        resource: { contains: 'recommendation' },
        createdAt: { gte: since },
      },
      select: {
        details: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const sentimentCounts = { positive: 0, negative: 0 };
    const feedbackOverTime: Record<string, { positive: number; negative: number }> = {};

    for (const log of feedbackLogs) {
      let details: { sentiment?: string } = {};
      try {
        details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
      } catch {
        // ignore malformed JSON
      }
      const sentiment = details.sentiment === 'positive' ? 'positive' : 'negative';
      sentimentCounts[sentiment] += 1;

      const day = log.createdAt.toISOString().slice(0, 10);
      if (!feedbackOverTime[day]) feedbackOverTime[day] = { positive: 0, negative: 0 };
      feedbackOverTime[day][sentiment] += 1;
    }

    const sentimentDistribution = [
      { sentiment: 'positive', count: sentimentCounts.positive },
      { sentiment: 'negative', count: sentimentCounts.negative },
    ];

    const sentimentTrends = Object.entries(feedbackOverTime)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts }));

    return NextResponse.json({
      data: {
        statusDistribution: {
          pending: statusMap.active,
          accepted: statusMap.acted_upon,
          dismissed: statusMap.dismissed,
          expired: statusMap.expired,
        },
        byReasoningMethod: byMethod,
        overTime: acceptanceRateOverTime,
        countsByType,
        feedback: {
          sentimentDistribution,
          sentimentTrends,
          totalFeedback: sentimentCounts.positive + sentimentCounts.negative,
        },
      },
    });
  } catch (_error) {
    return NextResponse.json(
      { error: 'Failed to fetch recommendation analytics' },
      { status: 500 },
    );
  }
}
