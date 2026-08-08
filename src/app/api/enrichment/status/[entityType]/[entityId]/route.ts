/**
 * Task 4.7 — Get Enrichment Status for a specific entity
 *
 * GET /api/enrichment/status/:entityType/:entityId
 */

import { NextRequest } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { apiError, apiSuccess } from '@/lib/apiHelpers';
import { getEnrichmentStatus } from '@/lib/enrichment/enrichment-orchestrator';
import type { EnrichmentEntityType } from '@/lib/enrichment/enrichment-provider';
import { z } from 'zod';

const entityTypeSchema = z.enum(['company', 'contact']);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entityType: string; entityId: string }> },
) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  const { entityType, entityId } = await params;

  const parsed = entityTypeSchema.safeParse(entityType);
  if (!parsed.success) {
    return apiError('entityType must be "company" or "contact"', 400);
  }

  if (!entityId || entityId.length < 1) {
    return apiError('entityId is required', 400);
  }

  const status = await getEnrichmentStatus(parsed.data as EnrichmentEntityType, entityId);
  return apiSuccess(status);
}
