/**
 * P3.3 — AI Output Version History API
 *
 * GET /api/ai/versions?entityType=company&entityId=xxx&generationType=email_draft&limit=10
 *
 * Returns the version history for a given entity+generationType combination,
 * ordered by version desc (newest first).
 */

import { NextRequest } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { apiSuccess, apiError } from '@/lib/apiHelpers';
import { logger } from '@/lib/logger';
import { getAIVersionHistory } from '@/lib/ai-output-versioning';

export async function GET(request: NextRequest) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    const generationType = searchParams.get('generationType');
    const limitParam = searchParams.get('limit');

    // Validate required params
    if (!entityType || !entityId || !generationType) {
      return apiError('Missing required params: entityType, entityId, generationType', 400);
    }

    // Validate limit
    const limit = limitParam ? parseInt(limitParam, 10) : 20;
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return apiError('limit must be between 1 and 100', 400);
    }

    const history = await getAIVersionHistory({
      entityType,
      entityId,
      generationType,
      limit,
    });

    return apiSuccess({
      entityType,
      entityId,
      generationType,
      totalVersions: history.length,
      versions: history,
    });
  } catch (err) {
    logger.error('[ai-versions] Failed to fetch version history:', { error: err });
    return apiError('Failed to fetch AI version history', 500);
  }
}
