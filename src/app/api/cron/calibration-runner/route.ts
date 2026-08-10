/**
 * POST /api/cron/calibration-runner
 *
 * Phase 2.1: Calibration Job Runner
 *
 * Runs daily via Vercel Cron to:
 * 1. Read all IntelligenceFeedback records with actualOutcome data
 * 2. Convert verdicts and outcomes into calibration data points
 * 3. Feed them to the CalibrationEngine to update CalibrationCurve buckets
 * 4. Update feedback.calibrationApplied flag
 *
 * Dependencies:
 *   - CalibrationCurve table (existing)
 *   - IntelligenceFeedback table (existing)
 *   - confidence-calibration-engine.ts (existing)
 *
 * Auth: Bearer CRON_SECRET (same as other cron routes)
 * Schedule: Daily at 3 AM UTC
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import {
  recordOutcome,
  getCalibration,
  getCalibrationEngineStats,
  outcomeToScore,
} from '@/lib/confidence-calibration-engine';

// ── Verdict → Outcome Mapping ──────────────────────────────────────────────

/**
 * Map IntelligenceFeedback verdict + actualOutcome to a CalibrationDataPoint.
 * 
 * Verdict meanings:
 *   - useful: strong positive signal → outcome = meeting_held
 *   - partially_useful: moderate signal → outcome = contacted
 *   - not_useful: weak signal → outcome = no_response
 *   - incorrect_action: negative signal → outcome = rejected
 *   - wrong_account: targeting error → outcome = wrong_contact
 */
const VERDICT_OUTCOMES: Record<string, string> = {
  useful: 'meeting_held',
  partially_useful: 'contacted',
  not_useful: 'no_response',
  incorrect_action: 'rejected',
  wrong_account: 'wrong_contact',
};

/**
 * Use explicit actualOutcome if available, otherwise derive from verdict.
 */
function deriveActualOutcome(
  verdict: string,
  actualOutcome?: string | null
): string {
  if (actualOutcome && actualOutcome !== '') {
    return actualOutcome;
  }
  return VERDICT_OUTCOMES[verdict] || 'no_response';
}

// ═══════════════════════════════════════════════════════════════════════
// POST /api/cron/calibration-runner
// ═════════════════════════════════════════════════════════════════════

export async function POST(request: Request) {
  // ── Auth: CRON_SECRET ──
  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  const results = {
    processed: 0,
    skipped: 0,
    errors: 0,
    dimensions: [] as string[],
    calibrationBefore: {} as Record<string, number>,
    calibrationAfter: {} as Record<string, number>,
  };

  try {
    // Get calibration state before running
    const statsBefore = await getCalibrationEngineStats();
    for (const key of ['totalSamples', 'averageAccuracy', 'averageCorrectionFactor'] as const) {
      results.calibrationBefore[key] = statsBefore[key as keyof typeof statsBefore] as number;
    }

    // ── Step 1: Read all feedback with actionable outcomes ──
    const feedbacks = await db.intelligenceFeedback.findMany({
        where: {
          calibrationApplied: false,
        actualOutcome: { not: '' },
          verdict: { not: '' },
        },
        orderBy: { createdAt: 'asc' },
      });

    logger.info(`[calibration-runner] Found ${feedbacks.length} unprocessed feedback records`);

    // ── Step 2: Group by confidence dimension ──
    // Each feedback record becomes a data point for the "overall" dimension.
    // Future: enrich with per-dimension scores from recommendationSnapshot.
    const processed = new Set<string>();

    for (const fb of feedbacks) {
      try {
        const predictedScore = fb.scoreAtFeedback ?? 50;
        const actualOutcome = deriveActualOutcome(fb.verdict, fb.actualOutcome);
        const actualScore = outcomeToScore(actualOutcome as any);

        const result = await recordOutcome({
          id: `cal-${fb.id}`,
          companyId: fb.companyId,
          dimension: 'overall',
          predictedScore,
          predictedGrade: fb.confidenceAtFeedback || 'medium',
          actualOutcome: actualOutcome as any,
          actualScore,
          recordedAt: fb.createdAt.toISOString(),
        });

        if (result.success) {
          processed.add(fb.id);
        }

        // Mark feedback as processed
        try {
          await db.intelligenceFeedback.update({
              where: { id: fb.id },
              data: { calibrationApplied: true },
            });
        } catch (err) {
          logger.warn(`[calibration-runner] Failed to mark feedback ${fb.id} as processed:`, { error: err });
        }
      } catch (err) {
        logger.error(`[calibration-runner] Failed to process feedback ${fb.id}:`, { error: err });
        results.errors++;
      }
    }

    results.processed = processed.size;
    results.skipped = feedbacks.length - processed.size;

    // ── Step 3: Get updated calibration summary ──
    const calibration = await getCalibration();

    for (const dim of calibration.dimensions) {
      results.dimensions.push(dim.dimension);
      results.calibrationAfter[dim.dimension] = dim.correctionFactor;
    }

    logger.info(`[calibration-runner] Calibration complete`, {
      processed: results.processed,
      skipped: results.skipped,
      errors: results.errors,
      dimensions: results.dimensions.length,
      before: results.calibrationBefore,
      after: results.calibrationAfter,
    });

    return NextResponse.json({
      success: true,
      ...results,
      calibration,
    });
  } catch (err) {
    logger.error('[calibration-runner] Fatal error:', { error: err });
    return NextResponse.json(
      { success: false, error: 'Calibration runner failed' },
      { status: 500 },
    );
  }
}

// Allow GET for manual testing (auth still required)
export async function GET(request: Request) {
  if (request.method === 'POST') return POST(request);

  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  return POST(request);
}
