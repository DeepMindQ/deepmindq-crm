import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { checkApiAuth } from '@/lib/api-auth';

const statsSchema = z.object({
  period: z.enum(['7d', '30d', '90d']).optional().default('30d'),
});

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const parsed = statsSchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid parameters' }, { status: 400 });
    }

    const period = parsed.data.period;
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const [
      totalCount,
      newCount,
      criticalCount,
      dismissedCount,
      typeBreakdown,
      severityBreakdown,
      periodSignals,
    ] = await Promise.all([
      db.signal.count(),
      db.signal.count({ where: { detectedAt: { gte: cutoff } } }),
      db.signal.count({ where: { severity: 'critical', detectedAt: { gte: cutoff } } }),
      db.signal.count({ where: { status: 'dismissed', detectedAt: { gte: cutoff } } }),
      db.signal.groupBy({
        by: ['signalType'],
        where: { detectedAt: { gte: cutoff } },
        _count: true,
      }),
      db.signal.groupBy({ by: ['severity'], where: { detectedAt: { gte: cutoff } }, _count: true }),
      // Fetch signals in period for JS-side daily grouping (SQLite compatible)
      db.signal.findMany({
        where: { detectedAt: { gte: cutoff } },
        select: { detectedAt: true },
        orderBy: { detectedAt: 'asc' },
      }),
    ]);

    // Group by date in JavaScript (avoids SQLite DATE() compatibility issues)
    const dailyMap = new Map<string, number>();
    for (const s of periodSignals) {
      const dateStr = s.detectedAt.toISOString().slice(0, 10);
      dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + 1);
    }
    const dailyTrend = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    return NextResponse.json({
      success: true,
      data: {
        total: totalCount,
        period,
        newInPeriod: newCount,
        criticalInPeriod: criticalCount,
        dismissedInPeriod: dismissedCount,
        byType: typeBreakdown.map((t) => ({ type: t.signalType, count: t._count })),
        bySeverity: severityBreakdown.map((s) => ({ severity: s.severity, count: s._count })),
        dailyTrend,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (_error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch signal stats' },
      { status: 500 },
    );
  }
}
