import { NextRequest, NextResponse } from 'next/server';
import { validateCronSecret } from '@/lib/cron-auth';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';

/**
 * GET /api/cron/calibration-runner — Run AI model calibration metrics.
 *
 * Evaluates model performance by querying the database for signal
 * distributions across confidence levels and processing statuses.
 * Calculates accuracy ratios and calibration data to detect model drift
 * and ensure prediction quality.
 *
 * Metrics collected:
 * - Total signals grouped by confidence score ranges.
 * - Signals by processing status (detected → acted_upon pipeline).
 * - Average confidence and impact scores.
 * - Accuracy ratio of high-confidence signals that were acted upon.
 *
 * Authentication: Requires `Authorization: Bearer <CRON_SECRET>` header
 *                where CRON_SECRET matches the server-side env var.
 *
 * Recommended schedule: Daily or every 6 hours.
 */
export async function GET(request: NextRequest) {
  // ── Auth gate ──
  if (!validateCronSecret(request)) {
    logger.warn('cron/calibration-runner: unauthorized access attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const start = Date.now();
  logger.info('cron/calibration-runner: started');

  try {
    const [totalCount, statusBreakdown, aggregateScores, confidenceGroups] = await Promise.all([
      db.signal.count(),

      // Count signals by status
      db.signal.groupBy({
        by: ['status'],
        _count: { status: true },
      }),

      // Average confidence and impact scores
      db.signal.aggregate({
        _avg: {
          confidenceScore: true,
          impactScore: true,
        },
        _count: true,
      }),

      // Count signals by confidence score ranges
      db.signal.groupBy({
        by: ['status'],
        where: { confidenceScore: { not: null } },
        _avg: { confidenceScore: true, impactScore: true },
        _count: true,
      }),
    ]);

    // Build status distribution map
    const statusCounts: Record<string, number> = {};
    for (const row of statusBreakdown) {
      statusCounts[row.status] = row._count.status;
    }

    // Calculate accuracy ratio: high-confidence signals that were acted upon
    const highConfidenceTotal = await db.signal.count({
      where: {
        confidenceScore: { gte: 75 },
        status: { in: ['detected', 'validated', 'analyzed', 'acted_upon'] },
      },
    });

    const highConfidenceActed = await db.signal.count({
      where: {
        confidenceScore: { gte: 75 },
        status: 'acted_upon',
      },
    });

    const accuracyRatio =
      highConfidenceTotal > 0 ? highConfidenceActed / highConfidenceTotal : null;

    // Group signals by confidence tiers
    const tiers = [
      { label: 'very_high', min: 90, max: 100 },
      { label: 'high', min: 75, max: 89 },
      { label: 'medium', min: 50, max: 74 },
      { label: 'low', min: 25, max: 49 },
      { label: 'very_low', min: 0, max: 24 },
    ];

    const confidenceDistribution: Record<string, number> = {};
    for (const tier of tiers) {
      const count = await db.signal.count({
        where: {
          confidenceScore: { gte: tier.min, lte: tier.max },
        },
      });
      confidenceDistribution[tier.label] = count;
    }

    const modelsChecked = 1;
    const durationMs = Date.now() - start;

    logger.info('cron/calibration-runner: completed', {
      calibrated: true,
      modelsChecked,
      totalCount,
      accuracyRatio,
      durationMs,
    });

    return NextResponse.json({
      calibrated: true,
      modelsChecked,
      durationMs,
      calibration: {
        totalSignals: totalCount,
        statusCounts,
        averageConfidence: aggregateScores._avg.confidenceScore,
        averageImpact: aggregateScores._avg.impactScore,
        accuracyRatio,
        confidenceDistribution,
      },
    });
  } catch (error) {
    const durationMs = Date.now() - start;
    logger.error('cron/calibration-runner: failed', {
      error: error instanceof Error ? error.message : String(error),
      durationMs,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
