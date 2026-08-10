/**
 * P3.3 — AI Output Version Comparison API
 *
 * GET /api/ai/versions/compare?v1=id1&v2=id2
 *
 * Compares two specific AI output versions and returns:
 *   - Confidence delta
 *   - Days between versions
 *   - Output similarity (Jaccard on word sets)
 */

import { NextRequest } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { apiSuccess, apiError } from '@/lib/apiHelpers';
import { logger } from '@/lib/logger';
import { compareAIVersions } from '@/lib/ai-output-versioning';

export async function GET(request: NextRequest) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const v1 = searchParams.get('v1');
    const v2 = searchParams.get('v2');

    // Validate required params
    if (!v1 || !v2) {
      return apiError('Missing required params: v1, v2 (snapshot IDs)', 400);
    }

    if (v1 === v2) {
      return apiError('v1 and v2 must be different snapshot IDs', 400);
    }

    const comparison = await compareAIVersions(v1, v2);

    if (!comparison) {
      return apiError('One or both snapshot versions not found', 404);
    }

    return apiSuccess(comparison);
  } catch (err) {
    logger.error('[ai-versions/compare] Failed to compare versions:', { error: err });
    return apiError('Failed to compare AI versions', 500);
  }
}
