/**
 * Phase 6.4 — Data Access Audit Trail
 *
 * Logs every read/write of sensitive intelligence data.
 * Uses DataAccessAudit table for compliance with GDPR Article 30
 * (records of processing activities) and SOC 2 CC6.1/CC6.2.
 *
 * DESIGN:
 *   - Fire-and-forget writes (non-blocking, never impacts request handling)
 *   - Batched in production for performance
 *   - IP and user-agent captured from request headers when available
 *   - Metadata field carries context (e.g., query filters, field names accessed)
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// ── Types ────────────────────────────────────────────────────────────

export type DataAccessAction = 'read' | 'write' | 'export' | 'delete' | 'admin_access';

export interface DataAccessAuditRecord {
  id: string;
  userId: string;
  action: DataAccessAction;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface LogDataAccessParams {
  userId: string;
  action: DataAccessAction;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  request?: Request;
}

export interface LogFieldAccessParams {
  userId: string;
  action: 'read' | 'write';
  entityType: string;
  entityId: string;
  fields: string[];
  request?: Request;
}

export interface QueryAccessAuditParams {
  userId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// ── Internal Helpers ─────────────────────────────────────────────────

/**
 * Extract client IP from request headers.
 * Checks x-forwarded-for first (reverse proxy), then x-real-ip.
 */
function extractIpAddress(request?: Request): string | null {
  if (!request) return null;
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for can be a comma-separated list; first entry is the original client
    return forwarded.split(',')[0].trim() || null;
  }
  const realIp = request.headers.get('x-real-ip');
  return realIp || null;
}

/**
 * Extract user-agent from request headers.
 */
function extractUserAgent(request?: Request): string | null {
  if (!request) return null;
  return request.headers.get('user-agent') || null;
}

// ── Core: logDataAccess ──────────────────────────────────────────────

/**
 * Log a data access event to the DataAccessAudit table.
 *
 * Fire-and-forget: errors are logged but never thrown to callers.
 * This ensures audit logging never impacts request handling latency.
 */
export async function logDataAccess(params: LogDataAccessParams): Promise<void> {
  try {
    await db.dataAccessAudit.create({
      data: {
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: (params.metadata || {}) as any,
        ipAddress: extractIpAddress(params.request),
        userAgent: extractUserAgent(params.request),
      },
    });
  } catch (err) {
    logger.error('[AccessAudit] Failed to write audit entry', {
      error: err instanceof Error ? err.message : String(err),
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
    });
    // Intentionally swallowed — audit failures never propagate
  }
}

// ── Convenience: logFieldAccess ──────────────────────────────────────

/**
 * Convenience wrapper that logs field-level access.
 * Puts the accessed/written field names into metadata.fields.
 */
export async function logFieldAccess(params: LogFieldAccessParams): Promise<void> {
  return logDataAccess({
    userId: params.userId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    metadata: {
      ...(params.request ? {} : {}),
      fields: params.fields,
    },
    request: params.request,
  });
}

// ── Query: queryAccessAudit ──────────────────────────────────────────

/**
 * Query the data access audit log with optional filters.
 * Returns typed records and a total count for pagination.
 */
export async function queryAccessAudit(
  params: QueryAccessAuditParams,
): Promise<{ data: DataAccessAuditRecord[]; total: number }> {
  try {
    const where: Record<string, unknown> = {};

    if (params.userId) where.userId = params.userId;
    if (params.entityType) where.entityType = params.entityType;
    if (params.entityId) where.entityId = params.entityId;
    if (params.action) where.action = params.action;

    if (params.startDate || params.endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (params.startDate) dateFilter.gte = params.startDate;
      if (params.endDate) dateFilter.lte = params.endDate;
      where.createdAt = dateFilter;
    }

    const limit = Math.min(params.limit || 50, 500);
    const offset = params.offset || 0;

    const [rows, total] = await Promise.all([
      db.dataAccessAudit.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      db.dataAccessAudit.count({ where }),
    ]);

    return {
      data: rows.map((r: any) => ({
        id: r.id,
        userId: r.userId,
        action: r.action as DataAccessAction,
        entityType: r.entityType,
        entityId: r.entityId,
        metadata: (r.metadata as Record<string, unknown>) || {},
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
    };
  } catch (err) {
    logger.error('[AccessAudit] Query failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { data: [], total: 0 };
  }
}
