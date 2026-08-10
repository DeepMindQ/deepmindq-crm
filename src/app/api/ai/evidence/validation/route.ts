/**
 * P3.5 — Evidence Validation Report API
 *
 * GET  /api/ai/evidence/validation       — Return last validation report
 * POST /api/ai/evidence/validation/run   — Trigger on-demand validation
 */

import { apiError, apiSuccess } from '@/lib/apiHelpers';
import { checkApiAuth } from '@/lib/api-auth';
import {
  validateEvidenceChains,
  getLastValidationReport,
} from '@/lib/evidence-chain-validator';

export async function GET(request: Request) {
  // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const report = getLastValidationReport();
    if (!report) {
      return apiSuccess({
        available: false,
        message: 'No validation report yet. Trigger a validation run with POST /api/ai/evidence/validation/run',
      });
    }
    return apiSuccess({ available: true, ...report });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Failed to get validation report', 500);
  }
}

export async function POST(request: Request) {
  // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const report = await validateEvidenceChains();
    return apiSuccess({ validationCompleted: true, ...report });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Evidence validation failed', 500);
  }
}
