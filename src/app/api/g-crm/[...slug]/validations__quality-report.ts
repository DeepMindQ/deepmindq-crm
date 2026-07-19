import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/apiHelpers';
import { getQualityReport } from '@/lib/intelligence-validation';

/* ═══════════════════════════════════════════════════════════════
   GET /api/g-crm/validations/quality-report

   Portfolio-wide intelligence quality report.
   Aggregates all validation records to answer:
     Q1: Are signal meanings accurate?       → meaningAccuracyBySignalType
     Q2: Are capability matches relevant?     → matchQualityByCapability
     Q3: Are recommendations actionable?      → recommendationActionability
     Q4: Does pursuit intel improve?         → pursuitTrend
     Q5: Is evidence quality assessment valid? → evidenceValidationSummary
   ═══════════════════════════════════════════════════════════════ */

export async function GET(_request: NextRequest) {
  try {
    const report = await getQualityReport();
    return apiSuccess(report);
  } catch (error) {
    console.error('[validations/quality-report] GET error:', error);
    return apiError('Failed to generate quality report');
  }
}