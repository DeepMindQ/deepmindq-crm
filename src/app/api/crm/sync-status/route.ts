/**
 * P4.2 — CRM Sync Status Dashboard Endpoint
 *
 * GET /api/crm/sync-status
 * Returns: list of active connections with lastSyncAt, sync stats, error history.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';
import { apiError, apiSuccess } from '@/lib/apiHelpers';

export async function GET(request: NextRequest) {
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const connections = await db.cRMConnection.findMany({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    });

    const results = await Promise.all(
      connections.map(async (conn) => {
        // Latest 5 sync logs for this connection
        const recentLogs = await db.cRMSyncLog.findMany({
          where: { connectionId: conn.id },
          orderBy: { syncedAt: 'desc' },
          take: 5,
        });

        // Aggregate stats
        const allLogs = await db.cRMSyncLog.findMany({
          where: { connectionId: conn.id },
        });

        const failedLogs = allLogs.filter((l) => l.action === 'failed');

        return {
          id: conn.id,
          provider: conn.provider,
          name: conn.name,
          syncMode: conn.syncMode,
          lastSyncAt: conn.lastSyncAt,
          tokenExpiresAt: conn.tokenExpiresAt,
          stats: {
            totalSyncs: allLogs.length,
            created: allLogs.filter((l) => l.action === 'created').length,
            updated: allLogs.filter((l) => l.action === 'updated').length,
            skipped: allLogs.filter((l) => l.action === 'skipped').length,
            failed: failedLogs.length,
            imports: allLogs.filter((l) => l.direction === 'import').length,
            exports: allLogs.filter((l) => l.direction === 'export').length,
          },
          recentErrors: failedLogs.slice(0, 5).map((l) => ({
            entityType: l.entityType,
            crmExternalId: l.crmExternalId,
            errorMessage: l.errorMessage,
            syncedAt: l.syncedAt,
          })),
          recentLogs: recentLogs.map((l) => ({
            direction: l.direction,
            entityType: l.entityType,
            action: l.action,
            crmExternalId: l.crmExternalId,
            syncedAt: l.syncedAt,
          })),
        };
      }),
    );

    return apiSuccess(results);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[crm:sync-status] Failed to load sync status', { error: msg });
    return apiError('Failed to load CRM sync status');
  }
}
