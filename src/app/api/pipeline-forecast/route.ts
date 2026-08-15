import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkApiAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    // Get all signals ordered by detection date
    const signals = await db.signal.findMany({
      select: { detectedAt: true, severity: true, signalType: true },
      orderBy: { detectedAt: 'asc' },
    });

    // Build monthly buckets for the last 6 months
    const now = new Date();
    const months: { month: string; total: number; critical: number; high: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      const monthLabel = startDate.toLocaleString('en-US', { month: 'short', year: '2-digit' });

      const monthSignals = signals.filter((s) => {
        const d = new Date(s.detectedAt);
        return d >= startDate && d <= endDate;
      });

      months.push({
        month: monthLabel,
        total: monthSignals.length,
        critical: monthSignals.filter((s) => s.severity === 'critical').length,
        high: monthSignals.filter((s) => s.severity === 'high').length,
      });
    }

    // Organization counts by tracking status
    const [active, paused, archived] = await Promise.all([
      db.organization.count({ where: { trackingStatus: 'active' } }),
      db.organization.count({ where: { trackingStatus: 'paused' } }),
      db.organization.count({ where: { trackingStatus: 'archived' } }),
    ]);

    // Compute projected growth from month-over-month trend
    let projectedGrowth = '0%';
    if (months.length >= 2) {
      const lastMonth = months[months.length - 1].total;
      const prevMonth = months[months.length - 2].total;
      if (prevMonth > 0) {
        const growth = ((lastMonth - prevMonth) / prevMonth) * 100;
        projectedGrowth = `${Math.round(growth)}%`;
      } else if (lastMonth > 0) {
        projectedGrowth = '100%';
      }
    }

    return NextResponse.json({
      monthly: months,
      organizationsByStatus: { active, paused, archived },
      projectedGrowth,
    });
  } catch (error) {
    console.error('[pipeline-forecast] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
