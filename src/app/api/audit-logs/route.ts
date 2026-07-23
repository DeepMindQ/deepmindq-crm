import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
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

    // Pagination: support both page+limit and offset+limit
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    const offsetParam = searchParams.get('offset');
    const pageParam = searchParams.get('page');
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

    // Fetch data and total in parallel
    const [data, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      db.auditLog.count({ where }),
    ]);

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
    });
  } catch (error) {
    console.error('Audit logs error:', error);
    return NextResponse.json(
      { error: 'Failed to load audit logs' },
      { status: 500 }
    );
  }
}