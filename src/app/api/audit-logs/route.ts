import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth, requireAdminRole } from '@/lib/api-auth';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { buildKeysetWhere, encodeCursor } from '@/lib/keyset-pagination';

export async function GET(request: NextRequest) {
  // Auth gate: admin-only for audit logs
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;
  const adminCheck = requireAdminRole(session!);
  if (adminCheck) return adminCheck;

  try {
    const { searchParams } = request.nextUrl;

    // Parse query params — support both page-based and offset-based pagination
    const action = searchParams.get('action') || undefined;
    const entity = searchParams.get('entity') || undefined;
    const userId = searchParams.get('userId') || undefined;
    const search = searchParams.get('search') || undefined;

    // Date filtering: support both from/to and startDate/endDate
    const startDateStr = searchParams.get('startDate') || searchParams.get('from') || undefined;
    const endDateStr = searchParams.get('endDate') || searchParams.get('to') || undefined;

    // Pagination: support both page+limit, offset+limit, and cursor-based
    const limitParam = searchParams.get('limit');
    const limit = Math.min(100, Math.max(1, limitParam ? parseInt(limitParam, 10) : 50));
    const offsetParam = searchParams.get('offset');
    const pageParam = searchParams.get('page');
    const cursorParam = searchParams.get('cursor');
    const offset = offsetParam
      ? parseInt(offsetParam, 10)
      : pageParam
        ? (parseInt(pageParam, 10)) * limit
        : 0;

    // Build where clause
    const where: Prisma.AuditLogWhereInput = {};

    if (action) where.action = action;
    if (entity) where.entity = entity;
    if (userId) where.userId = userId;
    if (search) {
      where.details = { contains: search };
    }
    if (startDateStr || endDateStr) {
      where.createdAt = {};
      if (startDateStr) {
        where.createdAt.gte = new Date(startDateStr);
      }
      if (endDateStr) {
        // Include the entire end date
        const endDate = new Date(endDateStr);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    // Keyset pagination: when cursor is provided, use keyset WHERE; otherwise fall back to offset
    const cursor = cursorParam || null;
    const keysetWhere = cursor
      ? buildKeysetWhere({ cursor, sortBy: 'createdAt', sortOrder: 'desc', additionalCursorFields: { id: null } })
      : {};
    const useKeyset = !!cursor;
    const skip = useKeyset ? undefined : offset;
    const takeLimit = useKeyset ? limit + 1 : limit;

    // Fetch data and total in parallel
    const [data, total] = await Promise.all([
      db.auditLog.findMany({
        where: { ...where, ...keysetWhere },
        orderBy: { createdAt: 'desc' },
        ...(skip !== undefined ? { skip } : {}),
        take: takeLimit,
      }),
      db.auditLog.count({ where }),
    ]);

    // Keyset: detect hasMore and trim extra item
    const hasMore = useKeyset ? data.length > limit : false;
    if (hasMore) data.pop();

    const nextCursor = hasMore && data.length > 0
      ? encodeCursor({ createdAt: data[data.length - 1].createdAt, id: data[data.length - 1].id })
      : null;

    // Map to AuditLogEntry shape expected by the frontend
    const entries = data.map((log) => ({
      id: log.id,
      userId: log.userId || '',
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      details: log.details,
      ipAddress: null,
      userAgent: null,
      createdAt: log.createdAt.toISOString(),
      user: undefined,
    }));

    return NextResponse.json({
      data: entries,
      total,
      page: Math.floor(offset / limit),
      limit,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    logger.error('Audit logs error:', { error: error });
    return NextResponse.json(
      { error: 'Failed to load audit logs' },
      { status: 500 }
    );
  }
}