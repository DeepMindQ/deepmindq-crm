/**
 * Phase 5.4 — Comprehensive Audit Trail
 *
 * Enterprise audit trail with:
 *   - Immutable log entries (no update/delete)
 *   - Field-level change tracking (old value → new value)
 *   - Compliance export (CSV/JSON for regulators)
 *   - Structured query API with advanced filtering
 *   - Automatic change detection for CRM entities
 *   - Chain of custody for sensitive operations
 *
 * DEPENDS ON: audit-logger.ts (base audit function), rbac.ts
 *
 * DESIGN DECISIONS:
 *   - Uses a dedicated ComprehensiveAuditLog table (separate from AuditLog)
 *   - Each entry is immutable once written
 *   - Field changes are stored as JSON: { field, oldValue, newValue }
 *   - IP and user-agent captured when available
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// ── Types ────────────────────────────────────────────────────────────

export type AuditAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'role_change'
  | 'permission_change'
  | 'export'
  | 'import'
  | 'config_change'
  | 'bulk_operation'
  | 'data_access'
  | 'privacy_request'
  | 'sso_login'
  | 'encryption_key_rotate'
  | 'rate_limit_exceeded'
  | 'security_alert'
  | 'system_event';

export type AuditEntity =
  | 'Company'
  | 'Contact'
  | 'User'
  | 'Session'
  | 'Draft'
  | 'Sequence'
  | 'Playbook'
  | 'SystemSetting'
  | 'ApiKey'
  | 'Role'
  | 'AuditLog'
  | 'DataExport'
  | 'DataImport'
  | 'EncryptionKey'
  | 'PrivacyRequest'
  | 'SSOConfig'
  | 'RateLimitConfig'
  | 'SecurityScan'
  | 'Other';

export interface FieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface ComprehensiveAuditEntry {
  id: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  ipAddress: string | null;
  userAgent: string | null;
  changes: FieldChange[];
  metadata: Record<string, unknown>;
  requestId: string | null;
  createdAt: string;
}

export interface CreateAuditEntryParams {
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  actorId: string;
  actorEmail?: string;
  actorRole?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  changes?: FieldChange[];
  metadata?: Record<string, unknown>;
  requestId?: string | null;
}

export interface QueryAuditParams {
  action?: AuditAction;
  entity?: AuditEntity;
  entityId?: string;
  actorId?: string;
  actorEmail?: string;
  startDate?: string;
  endDate?: string;
  changesField?: string; // filter by specific field that changed
  limit?: number;
  offset?: number;
  includeChanges?: boolean;
}

export interface AuditExportParams {
  format: 'csv' | 'json';
  startDate: string;
  endDate: string;
  entity?: AuditEntity;
  action?: AuditAction;
  actorEmail?: string;
}

// ── Create ──────────────────────────────────────────────────────────

/**
 * Create an immutable audit entry.
 * Non-throwing: errors are logged but never propagated to callers.
 */
export async function createAuditEntry(
  params: CreateAuditEntryParams,
): Promise<string | null> {
  try {
    const entry = await db.comprehensiveAuditLog.create({
      data: {
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        actorId: params.actorId,
        actorEmail: params.actorEmail || null,
        actorRole: params.actorRole || null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        changes: (params.changes?.length ? params.changes : []) as any,
        metadata: (params.metadata || {}) as any,
        requestId: params.requestId || null,
      },
    });

    return entry.id;
  } catch (err) {
    logger.error('[ComprehensiveAudit] Failed to create entry', {
      error: err instanceof Error ? err.message : String(err),
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
    });
    return null;
  }
}

// ── Change Detection ────────────────────────────────────────────────

/**
 * Detect field-level changes between two objects.
 * Returns array of FieldChange for fields that differ.
 */
export function detectChanges(
  oldObj: Record<string, unknown> | null,
  newObj: Record<string, unknown>,
  ignoredFields: string[] = ['updatedAt', 'createdAt', 'id'],
): FieldChange[] {
  if (!oldObj) {
    // Creation — all fields are "new"
    return Object.entries(newObj)
      .filter(([key]) => !ignoredFields.includes(key))
      .map(([field, newValue]) => ({
        field,
        oldValue: null,
        newValue,
      }));
  }

  const changes: FieldChange[] = [];
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

  for (const field of allKeys) {
    if (ignoredFields.includes(field)) continue;

    const oldValue = oldObj[field];
    const newValue = newObj[field];

    // Deep comparison
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes.push({ field, oldValue, newValue });
    }
  }

  return changes;
}

/**
 * Convenience: Record an update with automatic change detection.
 */
export async function recordUpdate(
  entity: AuditEntity,
  entityId: string,
  actorId: string,
  oldObj: Record<string, unknown> | null,
  newObj: Record<string, unknown>,
  extras?: Partial<CreateAuditEntryParams>,
): Promise<string | null> {
  const changes = detectChanges(oldObj, newObj);
  return createAuditEntry({
    action: 'update',
    entity,
    entityId,
    actorId,
    changes,
    ...extras,
  });
}

/**
 * Convenience: Record a creation event.
 */
export async function recordCreation(
  entity: AuditEntity,
  entityId: string,
  actorId: string,
  newObj: Record<string, unknown>,
  extras?: Partial<CreateAuditEntryParams>,
): Promise<string | null> {
  return createAuditEntry({
    action: 'create',
    entity,
    entityId,
    actorId,
    changes: detectChanges(null, newObj),
    ...extras,
  });
}

/**
 * Convenience: Record a deletion event.
 */
export async function recordDeletion(
  entity: AuditEntity,
  entityId: string,
  actorId: string,
  deletedObj: Record<string, unknown>,
  extras?: Partial<CreateAuditEntryParams>,
): Promise<string | null> {
  return createAuditEntry({
    action: 'delete',
    entity,
    entityId,
    actorId,
    metadata: { deletedData: deletedObj },
    ...extras,
  });
}

// ── Query ──────────────────────────────────────────────────────────

/**
 * Query the comprehensive audit trail with advanced filtering.
 */
export async function queryComprehensiveAudit(
  params: QueryAuditParams,
): Promise<{ data: ComprehensiveAuditEntry[]; total: number }> {
  try {
    const where: Record<string, unknown> = {};

    if (params.action) where.action = params.action;
    if (params.entity) where.entity = params.entity;
    if (params.entityId) where.entityId = params.entityId;
    if (params.actorId) where.actorId = params.actorId;
    if (params.actorEmail) where.actorEmail = params.actorEmail;

    if (params.startDate || params.endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (params.startDate) dateFilter.gte = new Date(params.startDate);
      if (params.endDate) dateFilter.lte = new Date(params.endDate);
      where.createdAt = dateFilter;
    }

    // Field-level change filtering (JSON contains query)
    if (params.changesField) {
      where.changes = {
        path: ['$'],
        array_contains: [{ field: params.changesField }],
      };
    }

    const limit = Math.min(params.limit || 50, 500);
    const offset = params.offset || 0;

    const [data, total] = await Promise.all([
      db.comprehensiveAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      db.comprehensiveAuditLog.count({ where }),
    ]);

    return {
      data: data.map((r) => ({
        id: r.id,
        action: r.action as AuditAction,
        entity: r.entity as AuditEntity,
        entityId: r.entityId,
        actorId: r.actorId,
        actorEmail: r.actorEmail || '',
        actorRole: r.actorRole || '',
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        changes: (r.changes as unknown[]) as FieldChange[],
        metadata: (r.metadata as Record<string, unknown>) || {},
        requestId: r.requestId,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
    };
  } catch (err) {
    logger.error('[ComprehensiveAudit] Query failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { data: [], total: 0 };
  }
}

// ── Compliance Export ───────────────────────────────────────────────

/**
 * Export audit trail for compliance (GDPR, SOC2, etc.)
 * Returns either CSV or JSON format.
 */
export async function exportAuditTrail(
  params: AuditExportParams,
): Promise<{ content: string; filename: string; mimeType: string } | null> {
  try {
    const result = await queryComprehensiveAudit({
      startDate: params.startDate,
      endDate: params.endDate,
      entity: params.entity,
      action: params.action,
      actorEmail: params.actorEmail,
      limit: 10000, // Compliance exports can be large
    });

    if (result.data.length === 0) {
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (params.format === 'csv') {
      const headers = [
        'id', 'timestamp', 'action', 'entity', 'entityId',
        'actorId', 'actorEmail', 'actorRole', 'ipAddress',
        'changes', 'requestId',
      ];
      const rows = result.data.map((entry) => [
        entry.id,
        entry.createdAt,
        entry.action,
        entry.entity,
        entry.entityId,
        entry.actorId,
        entry.actorEmail,
        entry.actorRole,
        entry.ipAddress || '',
        JSON.stringify(entry.changes),
        entry.requestId || '',
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((r) =>
          r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
        ),
      ].join('\n');

      return {
        content: csvContent,
        filename: `audit-trail-${timestamp}.csv`,
        mimeType: 'text/csv',
      };
    }

    // JSON format
    return {
      content: JSON.stringify(result.data, null, 2),
      filename: `audit-trail-${timestamp}.json`,
      mimeType: 'application/json',
    };
  } catch (err) {
    logger.error('[ComprehensiveAudit] Export failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ── Audit Statistics ─────────────────────────────────────────────────

/**
 * Get audit statistics for admin dashboard.
 */
export async function getAuditStatistics(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<{
  total: number;
  byAction: Record<string, number>;
  byEntity: Record<string, number>;
  topActors: Array<{ actorEmail: string; count: number }>;
  recentAlerts: number;
}> {
  try {
    const where: Record<string, unknown> = {};

    if (params?.startDate || params?.endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (params?.startDate) dateFilter.gte = new Date(params.startDate);
      if (params?.endDate) dateFilter.lte = new Date(params.endDate);
      where.createdAt = dateFilter;
    }

    const total = await db.comprehensiveAuditLog.count({ where });

    // Group by action
    const actionGroups = await db.comprehensiveAuditLog.groupBy({
      by: ['action'],
      where,
      _count: { action: true },
    });
    const byAction: Record<string, number> = {};
    for (const g of actionGroups) {
      byAction[g.action] = g._count.action;
    }

    // Group by entity
    const entityGroups = await db.comprehensiveAuditLog.groupBy({
      by: ['entity'],
      where,
      _count: { entity: true },
    });
    const byEntity: Record<string, number> = {};
    for (const g of entityGroups) {
      byEntity[g.entity] = g._count.entity;
    }

    // Top actors
    const actorGroups = await db.comprehensiveAuditLog.groupBy({
      by: ['actorEmail'],
      where,
      _count: { actorEmail: true },
      orderBy: { _count: { actorEmail: 'desc' } },
      take: 10,
    });
    const topActors = actorGroups.map((g) => ({
      actorEmail: g.actorEmail || 'unknown',
      count: g._count.actorEmail,
    }));

    // Recent security alerts
    const recentAlerts = await db.comprehensiveAuditLog.count({
      where: {
        ...where,
        action: { in: ['security_alert', 'rate_limit_exceeded', 'delete', 'role_change'] },
      },
    });

    return { total, byAction, byEntity, topActors, recentAlerts };
  } catch (err) {
    logger.error('[ComprehensiveAudit] Statistics failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { total: 0, byAction: {}, byEntity: {}, topActors: [], recentAlerts: 0 };
  }
}
