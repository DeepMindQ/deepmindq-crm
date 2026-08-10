/**
 * P3.2 — Confidence Calibration Dashboard API
 *
 * GET /api/ai/calibration?dimension=overall
 *
 * Returns:
 *   - ECE per dimension
 *   - Bucket-level calibration report
 *   - Recommendations for recalibration
 *   - Overall calibration health
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/apiHelpers';
import { checkApiAuth } from '@/lib/api-auth';
import { generateCalibrationReport } from '@/lib/confidence-calibration-engine';

export async function GET(req: NextRequest) {
  const { errorResponse } = await checkApiAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const dimension = searchParams.get('dimension') || undefined;

    const report = await generateCalibrationReport(dimension);

    return apiSuccess({
      generatedAt: report.generatedAt,
      overallECE: report.overallECE,
      overallNeedsRecalibration: report.overallNeedsRecalibration,
      healthGrade: report.overallECE <= 0.05
        ? 'good'
        : report.overallECE <= 0.1
          ? 'acceptable'
          : 'needs_recalibration',
      dimensions: report.dimensions,
      recommendations: report.recommendations,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return apiError(msg, 500);
  }
}
