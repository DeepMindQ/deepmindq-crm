/**
 * GET  /api/intelligence/calibration?dimension=overall
 * POST /api/intelligence/calibration (record outcome)
 *
 * 3.1 — Calibration Data API
 *
 * GET: Returns CalibrationSummary for a dimension (overall or specific).
 * POST: Records a calibration outcome (predicted vs actual) to improve future accuracy.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { utilityGuard, utilitySuccess, utilityError, utilityCatchError, RateLimitedError } from '@/lib/intelligence-api/guard';

// ── Validation ──────────────────────────────────────────────────────────

const VALID_DIMENSIONS = [
  'overall', 'data_quality', 'source_reliability', 'freshness',
  'cross_validation', 'evidence_coverage', 'ai_certainty',
] as const;

const RecordOutcomeSchema = z.object({
  companyId: z.string().min(1),
  dimension: z.enum(VALID_DIMENSIONS),
  predictedScore: z.number().min(0).max(100),
  predictedGrade: z.string().optional(),
  actualOutcome: z.string().min(1),
  actualScore: z.number().min(0).max(100).optional(),
});

// ── Types ──────────────────────────────────────────────────────────────

interface CalibrationSummary {
  dimension: string;
  status: string;
  sampleCount: number;
  accuracy: number;
  correctionFactor: number;
  lastCalibratedAt: string | null;
  buckets: Record<string, { correct: number; total: number }>;
}

// ── GET: Retrieve calibration summary ───────────────────────────────────

export async function GET(request: NextRequest) {
  let correlationId;
  let responseHeaders;

  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const ctx = utilityGuard(request, 'calibration');
    correlationId = ctx.correlationId;
    responseHeaders = ctx.responseHeaders;
  } catch (e) {
    if (e instanceof RateLimitedError) {
      return new Response(JSON.stringify(e.errorBody), { status: 429, headers: e.headers });
    }
    throw e;
  }

  const ctx = { correlationId, responseHeaders };
  const startedAt = Date.now();

  try {
    const url = new URL(request.url);
    const dimension = url.searchParams.get('dimension') || 'overall';

    if (!VALID_DIMENSIONS.includes(dimension as typeof VALID_DIMENSIONS[number])) {
      return utilityError(ctx, 400, `Invalid dimension: ${dimension}. Must be one of: ${VALID_DIMENSIONS.join(', ')}`, 'VALIDATION_FAILED', Date.now() - startedAt);
    }

    const curves = await db.calibrationCurve.findMany({
      where: dimension === 'overall'
        ? { status: { in: ['partially_calibrated', 'calibrated'] } }
        : { dimension },
    });

    // Build summary for requested dimension
    const targetCurve = dimension === 'overall'
      ? curves.find(c => c.dimension === 'overall') ?? curves[0]
      : curves.find(c => c.dimension === dimension);

    if (!targetCurve) {
      return utilitySuccess(ctx, {
        dimension,
        status: 'uncalibrated',
        sampleCount: 0,
        accuracy: 0,
        correctionFactor: 1.0,
        lastCalibratedAt: null,
        buckets: {},
      } as CalibrationSummary, 'calibration', Date.now() - startedAt);
    }

    const summary: CalibrationSummary = {
      dimension: targetCurve.dimension,
      status: targetCurve.status,
      sampleCount: targetCurve.sampleCount,
      accuracy: targetCurve.accuracy,
      correctionFactor: targetCurve.correctionFactor,
      lastCalibratedAt: targetCurve.lastCalibratedAt?.toISOString() ?? null,
      buckets: (targetCurve.buckets as Record<string, { correct: number; total: number }>) ?? {},
    };

    // If 'overall', aggregate across all dimensions
    if (dimension === 'overall') {
      const allCurves = await db.calibrationCurve.findMany();
      const totalSamples = allCurves.reduce((s, c) => s + c.sampleCount, 0);
      const avgAccuracy = allCurves.length > 0
        ? allCurves.reduce((s, c) => s + c.accuracy, 0) / allCurves.length
        : 0;
      const avgCorrection = allCurves.length > 0
        ? allCurves.reduce((s, c) => s + c.correctionFactor, 0) / allCurves.length
        : 1.0;

      // Merge buckets from all dimensions
      const mergedBuckets: Record<string, { correct: number; total: number }> = {};
      for (const c of allCurves) {
        const b = c.buckets as Record<string, { correct: number; total: number }> | null;
        if (b) {
          for (const [range, counts] of Object.entries(b)) {
            if (!mergedBuckets[range]) mergedBuckets[range] = { correct: 0, total: 0 };
            mergedBuckets[range].correct += counts.correct;
            mergedBuckets[range].total += counts.total;
          }
        }
      }

      const overallStatus = allCurves.some(c => c.status === 'calibrated')
        ? 'calibrated'
        : allCurves.some(c => c.status === 'partially_calibrated')
          ? 'partially_calibrated'
          : 'uncalibrated';

      const latestCalibrated = allCurves
        .filter(c => c.lastCalibratedAt)
        .sort((a, b) => b.lastCalibratedAt!.getTime() - a.lastCalibratedAt!.getTime())[0];

      return utilitySuccess(ctx, {
        dimension: 'overall',
        status: overallStatus,
        sampleCount: totalSamples,
        accuracy: Math.round(avgAccuracy * 10000) / 10000,
        correctionFactor: Math.round(avgCorrection * 10000) / 10000,
        lastCalibratedAt: latestCalibrated?.lastCalibratedAt?.toISOString() ?? null,
        buckets: mergedBuckets,
        dimensions: allCurves.map(c => ({
          dimension: c.dimension,
          status: c.status,
          sampleCount: c.sampleCount,
          accuracy: c.accuracy,
        })),
      } as CalibrationSummary & { dimensions: Array<{ dimension: string; status: string; sampleCount: number; accuracy: number }> }, 'calibration', Date.now() - startedAt);
    }

    return utilitySuccess(ctx, summary, 'calibration', Date.now() - startedAt);
  } catch (error) {
    return utilityCatchError(ctx, error, 500, 'INTERNAL_ERROR', 'calibration', Date.now() - startedAt);
  }
}

// ── POST: Record a calibration outcome ────────────────────────────────

export async function POST(request: NextRequest) {
  let correlationId;
  let responseHeaders;

  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const ctx = utilityGuard(request, 'calibration');
    correlationId = ctx.correlationId;
    responseHeaders = ctx.responseHeaders;
  } catch (e) {
    if (e instanceof RateLimitedError) {
      return new Response(JSON.stringify(e.errorBody), { status: 429, headers: e.headers });
    }
    throw e;
  }

  const ctx = { correlationId, responseHeaders };
  const startedAt = Date.now();

  try {
    const body = await request.json();
    const parsed = RecordOutcomeSchema.safeParse(body);
    if (!parsed.success) {
      return utilityError(ctx, 400, `Validation failed: ${parsed.error.issues.map(i => i.message).join(', ')}`, 'VALIDATION_FAILED', Date.now() - startedAt);
    }

    const { companyId, dimension, predictedScore, actualOutcome, actualScore } = parsed.data;

    // Upsert the calibration curve for this dimension
    const bucketSize = 10;
    const bucketStart = Math.floor(predictedScore / bucketSize) * bucketSize;
    const bucketEnd = bucketStart + bucketSize;
    const bucketKey = `${bucketStart}-${bucketEnd}`;

    // Determine if prediction was correct
    const isCorrect = actualScore !== undefined
      ? Math.abs(predictedScore - actualScore) <= 15 // Within 15 points = correct
      : actualOutcome === 'converted' || actualOutcome === 'opportunity_created' || actualOutcome === 'meeting_held';

    // Fetch or create calibration curve
    const existing = await db.calibrationCurve.findUnique({
      where: { dimension },
    });

    const currentBuckets = (existing?.buckets as Record<string, { correct: number; total: number }>) ?? {};
    const bucket = currentBuckets[bucketKey] ?? { correct: 0, total: 0 };
    bucket.total += 1;
    if (isCorrect) bucket.correct += 1;
    currentBuckets[bucketKey] = bucket;

    // Recalculate accuracy and correction factor
    let totalCorrect = 0;
    let totalEntries = 0;
    for (const b of Object.values(currentBuckets)) {
      totalCorrect += b.correct;
      totalEntries += b.total;
    }
    const accuracy = totalEntries > 0 ? totalCorrect / totalEntries : 0;

    // Correction factor: actual mean / predicted mean
    // Simplified: if accuracy < 0.5, reduce correction factor
    const correctionFactor = accuracy > 0.7 ? 1.0 : accuracy > 0.5 ? 0.95 : 0.85;

    const newStatus = totalEntries >= 50
      ? 'calibrated'
      : totalEntries >= 10
        ? 'partially_calibrated'
        : 'uncalibrated';

    await db.calibrationCurve.upsert({
      where: { dimension },
      create: {
        dimension,
        sampleCount: totalEntries,
        buckets: currentBuckets,
        accuracy,
        correctionFactor,
        status: newStatus,
        lastCalibratedAt: new Date(),
      },
      update: {
        sampleCount: totalEntries,
        buckets: currentBuckets,
        accuracy,
        correctionFactor,
        status: newStatus,
        lastCalibratedAt: new Date(),
      },
    });

    logger.info('[calibration] Recorded outcome', {
      companyId,
      dimension,
      predictedScore,
      actualOutcome,
      isCorrect,
      newSampleCount: totalEntries,
    });

    return utilitySuccess(ctx, {
      dimension,
      isCorrect,
      bucket: bucketKey,
      newSampleCount: totalEntries,
      accuracy: Math.round(accuracy * 10000) / 10000,
      correctionFactor,
      status: newStatus,
    }, 'calibration', Date.now() - startedAt);
  } catch (error) {
    return utilityCatchError(ctx, error, 500, 'INTERNAL_ERROR', 'calibration', Date.now() - startedAt);
  }
}
