/**
 * Task 4.5 — CRM API: Manual Sync Trigger
 *
 * POST /api/crm/[id]/sync — Trigger manual sync from CRM → local
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { apiSuccess, apiError, apiNotFound, validateBody } from '@/lib/apiHelpers';
import { logger } from '@/lib/logger';
import { syncFromCRM } from '@/lib/crm/crm-sync-service';
import type { SyncConflictResolution } from '@/lib/crm/crm-sync-service';
import { db } from '@/lib/db';
import { crmSyncOptionsSchema } from '@/lib/validation-schemas';

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

    // Parse optional body for sync options
    let parsedOptions: z.infer<typeof crmSyncOptionsSchema> = {};
    try {
      const rawBody = await request.json();
      const validated = validateBody(crmSyncOptionsSchema, rawBody);
      if (validated instanceof Response) return validated;
      parsedOptions = validated;
    } catch {
      // Empty body is fine — use defaults
    }

    const result = await syncFromCRM(id, {
      conflictResolution: (parsedOptions.conflictResolution as SyncConflictResolution) || 'local_wins',
      limit: typeof parsedOptions.limit === 'number' ? parsedOptions.limit : 200,
      modifiedAfter: typeof parsedOptions.modifiedAfter === 'string' ? parsedOptions.modifiedAfter : undefined,
      syncAccounts: parsedOptions.syncAccounts !== false,
      syncContacts: parsedOptions.syncContacts !== false,
      syncDeals: parsedOptions.syncDeals !== false,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Sync completed with errors',
          result,
          timestamp: new Date().toISOString(),
        },
        { status: 207 }, // Multi-Status
      );
    }

    return apiSuccess(result);
  } catch (err) {
    logger.error('[CRM:API] Sync failed', {
      connectionId: id,
      error: err instanceof Error ? err.message : String(err),
    });
    return apiError('Failed to trigger CRM sync', 500);
  }
}
