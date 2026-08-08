/**
 * Task 4.5 — CRM API: Sync Log History
 *
 * GET /api/crm/[id]/sync-log — Paginated sync history
 */

import { checkApiAuth } from '@/lib/api-auth';
import { apiSuccess, apiError, apiNotFound } from '@/lib/apiHelpers';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import { parsePaginationFromUrl } from '@/lib/pagination';

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
    });

    if (!connection) {
      return apiNotFound('CRM connection');
    }

    const { page, limit, skip, sortBy, sortOrder } = parsePaginationFromUrl(request.url);
    const url = new URL(request.url);

    // Optional filters
    const entityType = url.searchParams.get('entityType');
    const direction = url.searchParams.get('direction');
    const action = url.searchParams.get('action');

    const where: Record<string, unknown> = { connectionId: id };
    if (entityType) where.entityType = entityType;
    if (direction) where.direction = direction;
    if (action) where.action = action;

    const [logs, total] = await Promise.all([
      db.cRMSyncLog.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      db.cRMSyncLog.count({ where }),
    ]);

    return apiSuccess({
      connectionId: id,
      provider: connection.provider,
      name: connection.name,
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    logger.error('[CRM:API] Failed to get sync logs', {
      connectionId: id,
      error: err instanceof Error ? err.message : String(err),
    });
    return apiError('Failed to get sync logs', 500);
  }
}
