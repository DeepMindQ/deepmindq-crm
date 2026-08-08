/**
 * Task 4.5 — CRM API: Connection CRUD + Sync/Push + Sync Log
 *
 * GET    /api/crm/[id]             — Get connection details with sync status
 * PATCH  /api/crm/[id]             — Update connection settings
 * DELETE /api/crm/[id]             — Disconnect (revoke tokens, mark inactive)
 * POST   /api/crm/[id]/sync       — Trigger manual sync from CRM → local
 * POST   /api/crm/[id]/push       — Push local company data to CRM
 * GET    /api/crm/[id]/sync-log   — Sync history with pagination
 */

import { db } from '@/lib/db';
import { checkApiAuth } from '@/lib/api-auth';
import { validateBody } from '@/lib/apiHelpers';
import { apiSuccess, apiError, apiNotFound } from '@/lib/apiHelpers';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// ─── Route segment params ──────────────────────────────────────────

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const connection = await db.cRMConnection.findUnique({
      where: { id },
      include: {
        syncLogs: {
          orderBy: { syncedAt: 'desc' },
          take: 10,
        },
        _count: {
          select: { syncLogs: true },
        },
      },
    });

    if (!connection) {
      return apiNotFound('CRM connection');
    }

    // Mask sensitive tokens
    return apiSuccess({
      id: connection.id,
      provider: connection.provider,
      name: connection.name,
      isActive: connection.isActive,
      lastSyncAt: connection.lastSyncAt,
      syncMode: connection.syncMode,
      syncInterval: connection.syncInterval,
      instanceUrl: connection.instanceUrl,
      hasAccessToken: !!connection.accessToken,
      tokenExpiresAt: connection.tokenExpiresAt,
      totalSyncLogs: connection._count.syncLogs,
      recentSyncLogs: connection.syncLogs,
      fieldMapping: connection.fieldMapping,
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
    });
  } catch (err) {
    logger.error('[CRM:API] Failed to get connection', {
      connectionId: id,
      error: err instanceof Error ? err.message : String(err),
    });
    return apiError('Failed to get CRM connection', 500);
  }
}

// ─── PATCH /api/crm/[id] — Update connection ────────────────────────

const updateConnectionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  syncMode: z.enum(['manual', 'scheduled', 'realtime']).optional(),
  syncInterval: z.number().int().min(60).max(86400).optional(),
  isActive: z.boolean().optional(),
  fieldMapping: z.record(z.string(), z.unknown()).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const existing = await db.cRMConnection.findUnique({
      where: { id },
    });

    if (!existing) {
      return apiNotFound('CRM connection');
    }

    const body = await request.json();
    const parsed = validateBody(updateConnectionSchema, body);
    if (parsed instanceof Response) return parsed;

    const updateData: Record<string, unknown> = {};

    if (parsed.name !== undefined) updateData.name = parsed.name;
    if (parsed.syncMode !== undefined) updateData.syncMode = parsed.syncMode;
    if (parsed.syncInterval !== undefined) updateData.syncInterval = parsed.syncInterval;
    if (parsed.isActive !== undefined) updateData.isActive = parsed.isActive;
    if (parsed.fieldMapping !== undefined) updateData.fieldMapping = parsed.fieldMapping;

    const connection = await db.cRMConnection.update({
      where: { id },
      data: updateData,
    });

    logger.info('[CRM:API] Connection updated', {
      connectionId: id,
      updates: Object.keys(updateData),
    });

    return apiSuccess({
      id: connection.id,
      provider: connection.provider,
      name: connection.name,
      isActive: connection.isActive,
      syncMode: connection.syncMode,
      syncInterval: connection.syncInterval,
    });
  } catch (err) {
    logger.error('[CRM:API] Failed to update connection', {
      connectionId: id,
      error: err instanceof Error ? err.message : String(err),
    });
    return apiError('Failed to update CRM connection', 500);
  }
}

// ─── DELETE /api/crm/[id] — Disconnect ────────────────────────────

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const existing = await db.cRMConnection.findUnique({
      where: { id },
    });

    if (!existing) {
      return apiNotFound('CRM connection');
    }

    // Clear tokens and mark inactive
    await db.cRMConnection.update({
      where: { id },
      data: {
        accessToken: null,
        refreshToken: null,
        tokenExpiresAt: null,
        isActive: false,
      },
    });

    // Log the disconnect event
    await db.cRMSyncLog.create({
      data: {
        connectionId: id,
        direction: 'import',
        entityType: 'system',
        action: 'failed',
        errorMessage: 'Connection disconnected by user',
      },
    });

    logger.info('[CRM:API] Connection disconnected', {
      connectionId: id,
      provider: existing.provider,
    });

    return apiSuccess({
      message: `CRM connection "${existing.name}" (${existing.provider}) disconnected successfully`,
    });
  } catch (err) {
    logger.error('[CRM:API] Failed to disconnect', {
      connectionId: id,
      error: err instanceof Error ? err.message : String(err),
    });
    return apiError('Failed to disconnect CRM connection', 500);
  }
}
