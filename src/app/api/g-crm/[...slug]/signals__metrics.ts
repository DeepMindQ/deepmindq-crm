import { NextRequest } from 'next/server';
import { getSignalMetrics } from '@/lib/intelligence-contract';
import { apiSuccess, apiError } from '@/lib/apiHelpers';

/**
 * GET /api/g-crm/signals/metrics
 *
 * Phase 6 Readiness: Signal analytics for the analytics dashboard.
 *
 * Query params:
 *   ?daysBack=30 — number of days to look back (default 30)
 *   ?limit=10 — number of top companies to return (default 10)
 *
 * Returns:
 * - Total signal count
 * - Signals by type (funding, hiring, leadership_change, etc.)
 * - Signals by impact (high/medium/low)
 * - Signals by severity
 * - Daily trend (last N days)
 * - Top companies by signal count
 * - Per-type details with average confidence
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const daysBack = parseInt(searchParams.get('daysBack') || '30', 10) || 30;
    const limit = parseInt(searchParams.get('limit') || '10', 10) || 10;

    // Clamp values
    const safeDays = Math.min(Math.max(daysBack, 1), 365);
    const safeLimit = Math.min(Math.max(limit, 1), 50);

    const metrics = await getSignalMetrics({
      daysBack: safeDays,
      limit: safeLimit,
    });

    return apiSuccess(metrics);
  } catch (error) {
    console.error('[signal-metrics] Error:', error);
    return apiError('Failed to fetch signal metrics', 500);
  }
}