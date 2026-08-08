/**
 * Task 4.5 — CRM API: Push Company to CRM
 *
 * POST /api/crm/[id]/push — Push local company data to CRM
 */

import { checkApiAuth } from '@/lib/api-auth';
import { validateBody } from '@/lib/apiHelpers';
import { apiSuccess, apiError, apiNotFound } from '@/lib/apiHelpers';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { syncToCRM } from '@/lib/crm/crm-sync-service';
import { db } from '@/lib/db';

const pushSchema = z.object({
  companyId: z.string().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const connection = await db.cRMConnection.findUnique({
      where: { id },
    });

    if (!connection) {
      return apiNotFound('CRM connection');
    }

    if (!connection.isActive) {
      return apiError('CRM connection is not active', 400);
    }

    const body = await request.json();
    const parsed = validateBody(pushSchema, body);
    if (parsed instanceof Response) return parsed;

    const result = await syncToCRM(id, parsed.companyId);

    if (!result.success) {
      return apiError(result.error || 'Push failed', 400);
    }

    return apiSuccess({
      message: 'Company pushed to CRM successfully',
      externalId: result.externalId,
    });
  } catch (err) {
    logger.error('[CRM:API] Push failed', {
      connectionId: id,
      error: err instanceof Error ? err.message : String(err),
    });
    return apiError('Failed to push to CRM', 500);
  }
}
