/**
 * Data Export API Routes — Task 4.6: Bulk Import/Export Pipeline
 *
 * POST   /api/data-export              — Create export job
 * GET    /api/data-export              — List export jobs (paginated)
 * GET    /api/data-export/[id]         — Get export details + progress
 * GET    /api/data-export/[id]/download — Download exported file
 * DELETE /api/data-export/[id]         — Cancel/delete export
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiSuccess, apiError, safeInt, validateBody } from '@/lib/apiHelpers';
import { checkApiAuth } from '@/lib/api-auth';
import {
  createExportJob,
} from '@/lib/data-export/streaming-export';
import { logAction } from '@/lib/audit';
import { checkRateLimit } from '@/lib/rate-limit';
import { db } from '@/lib/db';
import { buildKeysetWhere, encodeCursor } from '@/lib/keyset-pagination';
import { dataExportPostSchema } from '@/lib/validation-schemas';

// ═══════════════════════════════════════════════════════════════
// POST /api/data-export — Create export job
// ═══════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const { session, errorResponse } = await checkApiAuth(req);
  if (errorResponse) return errorResponse;

  const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  if (!checkRateLimit(clientIp, 10)) {
    return apiError('Rate limit exceeded. Maximum 10 export operations per minute.', 429);
  }

  try {
    const rawBody = await req.json();
    const parsed = validateBody(dataExportPostSchema, rawBody);
    if (parsed instanceof Response) return parsed;
    const { format, entityType, filters, fields } = parsed;

    const exportJob = await createExportJob(
      { format: format as 'csv' | 'json' | 'xlsx', entityType: entityType as 'companies' | 'contacts' | 'opportunities' | 'signals', filters: filters ?? undefined, fields: fields ?? undefined },
      session?.id,
    );

    return apiSuccess(exportJob);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create export job';
    return apiError(message, message.includes('Invalid') ? 400 : 500);
  }
}

// ═══════════════════════════════════════════════════════════════
// GET /api/data-export — List export jobs
// ═══════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const { errorResponse } = await checkApiAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, safeInt(searchParams.get('page'), 1));
    const limit = Math.min(100, Math.max(1, safeInt(searchParams.get('limit'), 20)));
    const status = searchParams.get('status') ?? undefined;
    const cursorParam = searchParams.get('cursor') || null;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    // Keyset pagination: when cursor is provided, use keyset WHERE; otherwise fall back to page/limit
    const cursor = cursorParam;
    const keysetWhere = cursor
      ? buildKeysetWhere({ cursor, sortBy: 'createdAt', sortOrder: 'desc', additionalCursorFields: { id: null } })
      : {};
    const useKeyset = !!cursor;
    const skip = useKeyset ? undefined : (page - 1) * limit;
    const takeLimit = useKeyset ? limit + 1 : limit;

    const [items, total] = await Promise.all([
      db.dataExport.findMany({
        where: { ...where, ...keysetWhere },
        orderBy: { createdAt: 'desc' },
        ...(skip !== undefined ? { skip } : {}),
        take: takeLimit,
      }),
      db.dataExport.count({ where }),
    ]);

    // Keyset: detect hasMore and trim extra item
    const hasMore = useKeyset ? items.length > limit : false;
    if (hasMore) items.pop();

    const nextCursor = hasMore && items.length > 0
      ? encodeCursor({ createdAt: items[items.length - 1].createdAt, id: items[items.length - 1].id })
      : null;

    return NextResponse.json({
      success: true,
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        nextCursor,
        hasMore,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list exports';
    return apiError(message);
  }
}
