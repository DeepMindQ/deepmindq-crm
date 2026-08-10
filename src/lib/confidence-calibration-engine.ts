/**
 * Confidence Calibration Engine — Phase 3.1
 *
 * Tracks predicted vs actual outcomes to produce correction factors.
 * Uses the CalibrationCurve Prisma model to store per-dimension calibration data.
 *
 * Architecture:
 *
 *   Predicted Score → Record Outcome → Bucket Update → Recalibrate → Correction Factor
 *
 * Key Design Decisions:
 *   - 10-point buckets (0-10, 10-20, ... 90-100) for calibration curves
 *   - Correction factor = mean(actual) / mean(predicted) per bucket
 *   - Status thresholds: <10 uncalibrated, 10-49 partially, 50+ calibrated
 *   - Non-throwing design: all functions return structured results
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CalibrationDataPoint {
  id: string;
  companyId: string;
  dimension: string; // 'overall' | specific dimension
  predictedScore: number; // 0-100
  predictedGrade: string;
  actualOutcome: 'converted' | 'opportunity_created' | 'meeting_held' | 'contacted' | 'rejected' | 'no_response' | 'lost_to_competitor' | 'budget_issue' | 'wrong_contact' | 'project_cancelled' | 'project_delayed';
  actualScore: number; // 0-100 based on outcome
  recordedAt: string;
}

export interface CalibrationResult {
  dimension: string;
  sampleCount: number;
  accuracy: number; // 0-1
  correctionFactor: number;
  status: 'uncalibrated' | 'partially_calibrated' | 'calibrated';
  lastCalibratedAt: string | null;
  buckets: Record<string, { correct: number; total: number }>;
}

export interface CalibrationSummary {
  dimensions: CalibrationResult[];
  overallCorrectionFactor: number;
  totalSamples: number;
  isCalibrated: boolean;
  recommendations: string[];
  /** P3.2: Expected Calibration Error (0 = perfect, >0.1 needs recalibration) */
  ece: number;
  /** P3.2: Human-readable bucket-level report strings */
  bucketReport: string[];
}

// ── Outcome → Score Mapping ────────────────────────────────────────────────

const OUTCOME_SCORES: Record<string, number> = {
  converted: 95,
  opportunity_created: 75,
  meeting_held: 60,
  contacted: 40,
  rejected: 15,
  no_response: 10,
  lost_to_competitor: 20,
  budget_issue: 15,
  wrong_contact: 10,
  project_cancelled: 5,
  project_delayed: 10,
};

// ── Calibration Status Thresholds ─────────────────────────────────────────

const CALIBRATION_THRESHOLDS = {
  uncalibrated: 10,
  partially_calibrated: 50,
} as const;

// ── Core Functions ──────────────────────────────────────────────────────────

/**
 * Record an outcome data point and update calibration curves.
 * Upserts the CalibrationCurve bucket for the given dimension.
 */
export async function recordOutcome(
  dataPoint: CalibrationDataPoint
): Promise<{ success: boolean; calibrationId: string }> {
  const calibrationId = `cal-${dataPoint.dimension}-${Date.now()}`;

  try {
    // Determine which bucket this data point falls into
    const bucketKey = getBucketKey(dataPoint.predictedScore);

    // Fetch or create the calibration curve for this dimension
    const existing = await db.calibrationCurve.findUnique({
      where: { dimension: dataPoint.dimension },
    });

    let buckets: Record<string, { correct: number; total: number }> = {};

    if (existing) {
      try {
        buckets = typeof existing.buckets === 'string'
          ? JSON.parse(existing.buckets)
          : (existing.buckets as Record<string, { correct: number; total: number }>);
      } catch {
        buckets = {};
      }
    }

    // Initialize bucket if needed
    if (!buckets[bucketKey]) {
      buckets[bucketKey] = { correct: 0, total: 0 };
    }

    // Increment total
    buckets[bucketKey].total += 1;

    // Determine if this was "correct" — predicted high, actual high (or vice versa)
    const isCorrect = isPredictionCorrect(dataPoint.predictedScore, dataPoint.actualScore);
    if (isCorrect) {
      buckets[bucketKey].correct += 1;
    }

    // Compute new calibration metrics from all buckets
    const { accuracy, correctionFactor, sampleCount } = computeCalibrationMetrics(buckets);

    // Determine status
    const status = determineCalibrationStatus(sampleCount);

    // Upsert the calibration curve
    await db.calibrationCurve.upsert({
      where: { dimension: dataPoint.dimension },
      create: {
        dimension: dataPoint.dimension,
        sampleCount,
        buckets: JSON.stringify(buckets),
        accuracy,
        correctionFactor,
        status,
        lastCalibratedAt: new Date(),
      },
      update: {
        sampleCount,
        buckets: JSON.stringify(buckets),
        accuracy,
        correctionFactor,
        status,
        lastCalibratedAt: new Date(),
      },
    });

    logger.info('[CalibrationEngine] Outcome recorded', {
      dimension: dataPoint.dimension,
      companyId: dataPoint.companyId,
      predictedScore: dataPoint.predictedScore,
      actualOutcome: dataPoint.actualOutcome,
      actualScore: dataPoint.actualScore,
      bucket: bucketKey,
      isCorrect,
      newAccuracy: accuracy,
      newFactor: correctionFactor,
      totalSamples: sampleCount,
    });

    return { success: true, calibrationId };
  } catch (err) {
    logger.error('[CalibrationEngine] Failed to record outcome:', {
      error: err,
      dimension: dataPoint.dimension,
      companyId: dataPoint.companyId,
    });
    return { success: false, calibrationId };
  }
}

/**
 * Get calibration data for all dimensions or a specific one.
 */
export async function getCalibration(
  dimension?: string
): Promise<CalibrationSummary> {
  try {
    const whereClause = dimension ? { where: { dimension } } : {};
    const curves = await db.calibrationCurve.findMany({
      ...whereClause,
      orderBy: { sampleCount: 'desc' },
    });

    const dimensions: CalibrationResult[] = curves.map(curve => {
      let buckets: Record<string, { correct: number; total: number }> = {};
      try {
        buckets = typeof curve.buckets === 'string'
          ? JSON.parse(curve.buckets)
          : (curve.buckets as Record<string, { correct: number; total: number }>);
      } catch {
        buckets = {};
      }

      return {
        dimension: curve.dimension,
        sampleCount: curve.sampleCount,
        accuracy: curve.accuracy,
        correctionFactor: curve.correctionFactor,
        status: curve.status as CalibrationResult['status'],
        lastCalibratedAt: curve.lastCalibratedAt?.toISOString() || null,
        buckets,
      };
    });

    // Calculate overall correction factor as weighted average
    const totalSamples = dimensions.reduce((sum, d) => sum + d.sampleCount, 0);
    let overallCorrectionFactor = 1.0;

    if (totalSamples > 0) {
      overallCorrectionFactor = dimensions.reduce(
        (weighted, d) => weighted + d.correctionFactor * (d.sampleCount / totalSamples),
        0
      );
    }

    // Generate recommendations
    const recommendations = generateCalibrationRecommendations(dimensions);

    const isCalibrated = dimensions.length > 0 &&
      dimensions.every(d => d.status === 'calibrated');

    // P3.2: Compute overall ECE and bucket report from merged buckets
    const mergedBuckets: Record<string, { correct: number; total: number }> = {};
    for (const d of dimensions) {
      for (const [key, data] of Object.entries(d.buckets)) {
        if (!mergedBuckets[key]) mergedBuckets[key] = { correct: 0, total: 0 };
        mergedBuckets[key].correct += data.correct;
        mergedBuckets[key].total += data.total;
      }
    }
    const { ece, bucketDetails } = computeECE(mergedBuckets);
    const bucketReport = bucketDetails.map(bd =>
      `When model says ${bd.midpoint}% confidence, actual accuracy is ${bd.accuracy}% (gap: ${bd.gap}%, n=${bd.samples})`
    );

    return {
      dimensions,
      overallCorrectionFactor,
      totalSamples,
      isCalibrated,
      recommendations,
      ece,
      bucketReport,
    };
  } catch (err) {
    logger.error('[CalibrationEngine] Failed to get calibration:', { error: err, dimension });
    return {
      dimensions: [],
      overallCorrectionFactor: 1.0,
      totalSamples: 0,
      isCalibrated: false,
      recommendations: ['Unable to load calibration data'],
      ece: 0,
      bucketReport: [],
    };
  }
}

/**
 * Get the correction factor for a specific dimension.
 * Returns 1.0 if uncalibrated, otherwise the stored correction factor.
 */
export async function getCorrectionFactor(dimension: string): Promise<number> {
  try {
    const curve = await db.calibrationCurve.findUnique({
      where: { dimension },
    });

    if (!curve || curve.status === 'uncalibrated') {
      return 1.0;
    }

    return curve.correctionFactor;
  } catch (err) {
    logger.warn('[CalibrationEngine] Failed to get correction factor:', { error: err, dimension });
    return 1.0;
  }
}

/**
 * Apply calibration correction factor to a predicted score.
 */
export async function applyCalibration(
  score: number,
  dimension: string
): Promise<{ calibrated: number; factor: number; applied: boolean }> {
  const factor = await getCorrectionFactor(dimension);
  const applied = factor !== 1.0;
  const calibrated = Math.max(0, Math.min(100, Math.round(score * factor)));

  return { calibrated, factor, applied };
}

// ── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Map a score (0-100) to a bucket key string.
 */
function getBucketKey(score: number): string {
  const clamped = Math.max(0, Math.min(100, score));
  const lower = Math.floor(clamped / 10) * 10;
  return `${lower}-${lower + 10}`;
}

/**
 * Determine if a prediction was correct.
 * A prediction is "correct" if the predicted score and actual score
 * are in the same or adjacent decile (within 10 points).
 */
function isPredictionCorrect(predicted: number, actual: number): boolean {
  const predictedDecile = Math.floor(Math.max(0, Math.min(100, predicted)) / 10);
  const actualDecile = Math.floor(Math.max(0, Math.min(100, actual)) / 10);
  return Math.abs(predictedDecile - actualDecile) <= 1;
}

/**
 * Compute overall accuracy and correction factor from bucket data.
 *
 * Accuracy = total correct / total samples across all buckets.
 * Correction factor = weighted mean(actual_mean / predicted_mean) across non-empty buckets.
 */
function computeCalibrationMetrics(
  buckets: Record<string, { correct: number; total: number }>
): { accuracy: number; correctionFactor: number; sampleCount: number } {
  let totalCorrect = 0;
  let totalSamples = 0;
  let weightedFactorSum = 0;
  let weightSum = 0;

  for (const [bucketKey, data] of Object.entries(buckets)) {
    if (data.total === 0) continue;

    totalCorrect += data.correct;
    totalSamples += data.total;

    // Parse the bucket range to get the predicted mean
    const match = bucketKey.match(/^(\d+)-(\d+)$/);
    if (match) {
      const predictedMean = (parseInt(match[1]) + parseInt(match[2])) / 2;
      // The actual mean for this bucket is approximated from the accuracy
      // If 80% of predictions in the 70-80 bucket were correct,
      // the actual mean is approximately 70-80 range (conservative: accuracy * predictedMean)
      const bucketAccuracy = data.correct / data.total;
      const actualMean = bucketAccuracy * predictedMean;

      if (predictedMean > 0) {
        weightedFactorSum += (actualMean / predictedMean) * data.total;
        weightSum += data.total;
      }
    }
  }

  const accuracy = totalSamples > 0 ? totalCorrect / totalSamples : 0;
  const correctionFactor = weightSum > 0
    ? Math.max(0.5, Math.min(1.5, weightedFactorSum / weightSum))
    : 1.0;

  return { accuracy, correctionFactor, sampleCount: totalSamples };
}

/**
 * Determine calibration status based on sample count thresholds.
 */
function determineCalibrationStatus(
  sampleCount: number
): 'uncalibrated' | 'partially_calibrated' | 'calibrated' {
  if (sampleCount < CALIBRATION_THRESHOLDS.uncalibrated) return 'uncalibrated';
  if (sampleCount < CALIBRATION_THRESHOLDS.partially_calibrated) return 'partially_calibrated';
  return 'calibrated';
}

/**
 * Generate actionable recommendations based on calibration data.
 */
function generateCalibrationRecommendations(
  dimensions: CalibrationResult[]
): string[] {
  const recs: string[] = [];

  const uncalibrated = dimensions.filter(d => d.status === 'uncalibrated');
  const partiallyCalibrated = dimensions.filter(d => d.status === 'partially_calibrated');
  const calibrated = dimensions.filter(d => d.status === 'calibrated');
  const lowAccuracy = dimensions.filter(d => d.status !== 'uncalibrated' && d.accuracy < 0.5);
  const overCorrecting = dimensions.filter(d => d.correctionFactor > 1.2);
  const underCorrecting = dimensions.filter(d => d.correctionFactor < 0.8);

  if (uncalibrated.length > 0) {
    recs.push(`${uncalibrated.length} dimension(s) uncalibrated (${uncalibrated.map(d => d.dimension).join(', ')}). Collect at least 10 outcome samples per dimension.`);
  }

  if (partiallyCalibrated.length > 0) {
    recs.push(`${partiallyCalibrated.length} dimension(s) partially calibrated. Collect ${partiallyCalibrated.map(d => `${d.dimension}: ${50 - d.sampleCount} more`).join(', ')} samples for full calibration.`);
  }

  if (calibrated.length > 0) {
    recs.push(`${calibrated.length} dimension(s) fully calibrated. Correction factors are actively applied to new predictions.`);
  }

  if (lowAccuracy.length > 0) {
    recs.push(`Low accuracy in: ${lowAccuracy.map(d => `${d.dimension} (${Math.round(d.accuracy * 100)}%)`).join(', ')}. Consider reviewing scoring models for these dimensions.`);
  }

  if (overCorrecting.length > 0) {
    recs.push(`Over-correction detected in: ${overCorrecting.map(d => `${d.dimension} (factor: ${d.correctionFactor.toFixed(2)})`).join(', ')}. Predicted scores may be systematically too low.`);
  }

  if (underCorrecting.length > 0) {
    recs.push(`Under-correction detected in: ${underCorrecting.map(d => `${d.dimension} (factor: ${d.correctionFactor.toFixed(2)})`).join(', ')}. Predicted scores may be systematically too high.`);
  }

  if (dimensions.length === 0) {
    recs.push('No calibration data recorded yet. Begin by recording outcomes against predicted scores.');
  }

  return recs;
}

// ── P3.2: ECE Computation ───────────────────────────────────────────────────

/**
 * P3.2: Compute Expected Calibration Error (ECE).
 *
 * ECE = Σ (n_b / N) × |accuracy_b - confidence_b|
 * where:
 *   n_b = number of samples in bucket b
 *   N = total number of samples
 *   accuracy_b = actual accuracy within bucket b (correct/total)
 *   confidence_b = predicted confidence midpoint of bucket b
 *
 * ECE ranges from 0 (perfectly calibrated) to 1 (terribly calibrated).
 * ECE < 0.05 is good, ECE > 0.1 needs recalibration.
 */
export function computeECE(buckets: Record<string, { correct: number; total: number }>): {
  ece: number;
  bucketDetails: Array<{
    bucket: string;
    midpoint: number;
    accuracy: number;
    gap: number;
    weight: number;
    samples: number;
  }>;
} {
  let totalSamples = 0;
  for (const b of Object.values(buckets)) totalSamples += b.total;
  if (totalSamples === 0) return { ece: 0, bucketDetails: [] };

  const bucketRanges: Array<{ key: string; low: number; high: number }> = [
    { key: '0-10', low: 0, high: 10 },
    { key: '10-20', low: 10, high: 20 },
    { key: '20-30', low: 20, high: 30 },
    { key: '30-40', low: 30, high: 40 },
    { key: '40-50', low: 40, high: 50 },
    { key: '50-60', low: 50, high: 60 },
    { key: '60-70', low: 60, high: 70 },
    { key: '70-80', low: 70, high: 80 },
    { key: '80-90', low: 80, high: 90 },
    { key: '90-100', low: 90, high: 100 },
  ];

  let ece = 0;
  const bucketDetails: Array<{
    bucket: string;
    midpoint: number;
    accuracy: number;
    gap: number;
    weight: number;
    samples: number;
  }> = [];

  for (const range of bucketRanges) {
    const bucket = buckets[range.key];
    if (!bucket || bucket.total === 0) continue;

    const midpoint = (range.low + range.high) / 2 / 100; // 0-1 scale
    const accuracy = bucket.correct / bucket.total;
    const gap = Math.abs(accuracy - midpoint);
    const weight = bucket.total / totalSamples;

    ece += weight * gap;
    bucketDetails.push({
      bucket: range.key,
      midpoint: Math.round(midpoint * 100),
      accuracy: Math.round(accuracy * 10000) / 100,
      gap: Math.round(gap * 10000) / 100,
      weight: Math.round(weight * 10000) / 100,
      samples: bucket.total,
    });
  }

  return {
    ece: Math.round(ece * 10000) / 10000,
    bucketDetails,
  };
}

// ── P3.2: Calibration Report Generation ──────────────────────────────────────

/**
 * P3.2: Generate calibration report.
 * Returns human-readable calibration data: "When model says X% confidence, actual accuracy is Y%"
 */
export async function generateCalibrationReport(dimension?: string): Promise<{
  generatedAt: string;
  dimensions: Array<{
    dimension: string;
    ece: number;
    needsRecalibration: boolean;
    totalSamples: number;
    status: string;
    bucketReport: string[];
  }>;
  overallECE: number;
  overallNeedsRecalibration: boolean;
  recommendations: string[];
}> {
  try {
    const whereClause = dimension ? { where: { dimension } } : {};
    const curves = await db.calibrationCurve.findMany({
      ...whereClause,
      orderBy: { sampleCount: 'desc' },
    });

    if (curves.length === 0) {
      return {
        generatedAt: new Date().toISOString(),
        dimensions: [],
        overallECE: 0,
        overallNeedsRecalibration: false,
        recommendations: ['No calibration data recorded yet. Begin by recording outcomes against predicted scores.'],
      };
    }

    // Merge buckets across all dimensions for overall ECE
    const mergedBuckets: Record<string, { correct: number; total: number }> = {};
    let overallTotalSamples = 0;

    const dimReports = curves.map(curve => {
      let buckets: Record<string, { correct: number; total: number }> = {};
      try {
        buckets = typeof curve.buckets === 'string'
          ? JSON.parse(curve.buckets)
          : (curve.buckets as Record<string, { correct: number; total: number }>);
      } catch {
        buckets = {};
      }

      const { ece, bucketDetails } = computeECE(buckets);

      // Generate human-readable bucket report
      const bucketReport = bucketDetails.map(bd =>
        `When model says ${bd.midpoint}% confidence, actual accuracy is ${bd.accuracy}% (gap: ${bd.gap}%, n=${bd.samples})`
      );

      // Accumulate into merged buckets
      for (const [key, data] of Object.entries(buckets)) {
        if (!mergedBuckets[key]) mergedBuckets[key] = { correct: 0, total: 0 };
        mergedBuckets[key].correct += data.correct;
        mergedBuckets[key].total += data.total;
        overallTotalSamples += data.total;
      }

      return {
        dimension: curve.dimension,
        ece,
        needsRecalibration: ece > 0.1,
        totalSamples: curve.sampleCount,
        status: curve.status,
        bucketReport,
      };
    });

    const { ece: overallECE } = computeECE(mergedBuckets);
    const overallNeedsRecalibration = overallECE > 0.1;

    // Generate recommendations
    const recommendations: string[] = [];
    const needsRecal = dimReports.filter(d => d.needsRecalibration);
    if (needsRecal.length > 0) {
      recommendations.push(
        `Recalibration needed for ${needsRecal.length} dimension(s): ${needsRecal.map(d => `${d.dimension} (ECE=${d.ece})`).join(', ')}. Consider resetting buckets or adjusting scoring models.`
      );
    }
    const goodDims = dimReports.filter(d => d.ece > 0 && d.ece <= 0.05);
    if (goodDims.length > 0) {
      recommendations.push(
        `Well-calibrated dimensions (ECE ≤ 0.05): ${goodDims.map(d => d.dimension).join(', ')}.`
      );
    }
    if (overallTotalSamples < 50) {
      recommendations.push(`Low sample count (${overallTotalSamples}). Collect at least 50 outcomes for reliable calibration.`);
    }
    if (overallNeedsRecalibration) {
      recommendations.push('Overall ECE exceeds 0.1 threshold. Automated recalibration alert will be triggered.');
    }
    if (recommendations.length === 0) {
      recommendations.push('All dimensions are within acceptable calibration range.');
    }

    return {
      generatedAt: new Date().toISOString(),
      dimensions: dimReports,
      overallECE,
      overallNeedsRecalibration,
      recommendations,
    };
  } catch (err) {
    logger.error('[CalibrationEngine] Failed to generate calibration report:', { error: err, dimension });
    return {
      generatedAt: new Date().toISOString(),
      dimensions: [],
      overallECE: 0,
      overallNeedsRecalibration: false,
      recommendations: ['Failed to generate calibration report. Check server logs.'],
    };
  }
}

// ── P3.2: Calibration Health Check ──────────────────────────────────────────

/**
 * P3.2: Check if recalibration is needed and trigger alert if so.
 * Called by the scheduled calibration check in instrumentation.ts
 */
export async function checkCalibrationHealth(): Promise<{
  needsAttention: boolean;
  dimensions: Array<{ dimension: string; ece: number; status: string }>;
}> {
  try {
    const curves = await db.calibrationCurve.findMany();

    if (curves.length === 0) {
      return { needsAttention: false, dimensions: [] };
    }

    const dimHealth = curves.map(curve => {
      let buckets: Record<string, { correct: number; total: number }> = {};
      try {
        buckets = typeof curve.buckets === 'string'
          ? JSON.parse(curve.buckets)
          : (curve.buckets as Record<string, { correct: number; total: number }>);
      } catch {
        buckets = {};
      }

      const { ece } = computeECE(buckets);
      return {
        dimension: curve.dimension,
        ece,
        status: curve.status,
      };
    });

    const needsAttention = dimHealth.some(d => d.ece > 0.1);

    if (needsAttention) {
      const badDims = dimHealth.filter(d => d.ece > 0.1);
      logger.warn('[CalibrationEngine] Recalibration needed', {
        dimensions: badDims.map(d => `${d.dimension} (ECE=${d.ece})`),
        totalDimensions: dimHealth.length,
      });
    }

    return { needsAttention, dimensions: dimHealth };
  } catch (err) {
    logger.error('[CalibrationEngine] Calibration health check failed:', { error: err });
    return { needsAttention: false, dimensions: [] };
  }
}

/**
 * Map an actual outcome to a 0-100 score for calibration.
 */
export function outcomeToScore(
  outcome: CalibrationDataPoint['actualOutcome']
): number {
  return OUTCOME_SCORES[outcome] || 50;
}

/**
 * Get a quick summary of calibration engine status.
 */
export async function getCalibrationEngineStats(): Promise<{
  totalDimensions: number;
  calibratedDimensions: number;
  totalSamples: number;
  averageAccuracy: number;
  averageCorrectionFactor: number;
}> {
  try {
    const curves = await db.calibrationCurve.findMany();

    const totalDimensions = curves.length;
    const calibratedDimensions = curves.filter(c => c.status === 'calibrated').length;
    const totalSamples = curves.reduce((sum, c) => sum + c.sampleCount, 0);
    const averageAccuracy = curves.length > 0
      ? curves.reduce((sum, c) => sum + c.accuracy, 0) / curves.length
      : 0;
    const averageCorrectionFactor = curves.length > 0
      ? curves.reduce((sum, c) => sum + c.correctionFactor, 0) / curves.length
      : 1.0;

    return {
      totalDimensions,
      calibratedDimensions,
      totalSamples,
      averageAccuracy,
      averageCorrectionFactor,
    };
  } catch (err) {
    logger.warn('[CalibrationEngine] Failed to get stats:', { error: err });
    return {
      totalDimensions: 0,
      calibratedDimensions: 0,
      totalSamples: 0,
      averageAccuracy: 0,
      averageCorrectionFactor: 1.0,
    };
  }
}
