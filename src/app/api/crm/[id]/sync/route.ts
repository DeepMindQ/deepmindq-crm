/**
 * Task 4.5 — CRM API: Manual Sync Trigger
 *
 * POST /api/crm/[id]/sync — Trigger manual sync from CRM → local
 */

import { NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { apiSuccess, apiError, apiNotFound } from '@/lib/apiHelpers';
import { logger } from '@/lib/logger';
import { syncFromCRM } from '@/lib/crm/crm-sync-service';
import type { SyncConflictResolution } from '@/lib/crm/crm-sync-service';
import { db } from '@/lib/db';

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
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine — use defaults
    }

    const result = await syncFromCRM(id, {
      conflictResolution: (body.conflictResolution as SyncConflictResolution) || 'local_wins',
      limit: typeof body.limit === 'number' ? body.limit : 200,
      modifiedAfter: typeof body.modifiedAfter === 'string' ? body.modifiedAfter : undefined,
      syncAccounts: body.syncAccounts !== false,
      syncContacts: body.syncContacts !== false,
      syncDeals: body.syncDeals !== false,
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
