/**
 * Intelligence Alerts — DeepMindQ Sprint 3
 *
 * Manages automated alerts for the intelligence pipeline including
 * health degradation, stale sources, conflicts, ingestion failures,
 * and other operational anomalies.
 *
 * Provides CRUD-style lifecycle operations (create, acknowledge, resolve,
 * dismiss), paginated filtering, summary dashboards, and proactive
 * auto-generation that scans SourceHealth, IntelligenceAssociation,
 * and ConnectorRun records for alertable conditions.
 */

import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';

// ─── Exported Types ──────────────────────────────────────────

/** Alert severity levels, ordered low → critical */
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

/** Categorical alert types produced by the intelligence pipeline */
export type AlertType =
  | 'health_degraded'
  | 'source_stale'
  | 'conflict_detected'
  | 'duplicate_cluster'
  | 'confidence_drop'
  | 'ingestion_failure'
  | 'schedule_missed';

/** Alert lifecycle statuses */
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'dismissed';

/** Input for creating a new IntelligenceAlert */
export interface CreateAlertInput {
  companyId?: string;
  connectorId?: string;
  severity: AlertSeverity;
  alertType: AlertType;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
}

/** Filter & pagination options for querying alerts */
export interface AlertFilters {
  companyId?: string;
  connectorId?: string;
  severity?: string;
  alertType?: string;
  status?: string;
  page?: number;
  limit?: number;
}

/** Aggregated summary of current alert state */
export interface AlertSummary {
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  recentActive: IntelligenceAlert[];
  total: number;
}

/**
 * Prisma-generated alert payload with an optionally-included company.
 *
 * The `company` field is present only when the query explicitly
 * includes it (e.g. when filtering by companyId). Use a type guard
 * or optional chaining when accessing `alert.company`.
 */
export type IntelligenceAlert = Prisma.IntelligenceAlertGetPayload<{
  include: { company: { select: { id: true; rawName: true } } };
}>;

// ─── Constants ───────────────────────────────────────────────

const VALID_SEVERITIES: readonly AlertSeverity[] = [
  'low',
  'medium',
  'high',
  'critical',
] as const;

const VALID_ALERT_TYPES: readonly AlertType[] = [
  'health_degraded',
  'source_stale',
  'conflict_detected',
  'duplicate_cluster',
  'confidence_drop',
  'ingestion_failure',
  'schedule_missed',
] as const;

/** Severity ordering for critical-first sorting within the same timestamp */
const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const DEFAULT_PAGE_LIMIT = 20;

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Validate that a value is a recognised alert severity.
 * @throws {Error} If the value is not in the allowed set
 */
function validateSeverity(severity: string): asserts severity is AlertSeverity {
  if (!VALID_SEVERITIES.includes(severity as AlertSeverity)) {
    throw new Error(
      `Invalid severity "${severity}". Must be one of: ${VALID_SEVERITIES.join(', ')}`,
    );
  }
}

/**
 * Validate that a value is a recognised alert type.
 * @throws {Error} If the value is not in the allowed set
 */
function validateAlertType(alertType: string): asserts alertType is AlertType {
  if (!VALID_ALERT_TYPES.includes(alertType as AlertType)) {
    throw new Error(
      `Invalid alertType "${alertType}". Must be one of: ${VALID_ALERT_TYPES.join(', ')}`,
    );
  }
}

/**
 * Build a Prisma where clause from the optional filter fields.
 * Only includes keys whose values are defined.
 */
function buildWhereClause(filters: AlertFilters): Prisma.IntelligenceAlertWhereInput {
  const where: Prisma.IntelligenceAlertWhereInput = {};

  if (filters.companyId) where.companyId = filters.companyId;
  if (filters.connectorId) where.connectorId = filters.connectorId;
  if (filters.severity) where.severity = filters.severity;
  if (filters.alertType) where.alertType = filters.alertType;
  if (filters.status) where.status = filters.status;

  return where;
}

// ─── 1. Create Alert ─────────────────────────────────────────

/**
 * Create a new IntelligenceAlert record with status 'active'.
 *
 * Validates the provided severity and alertType against the
 * allowed enums before persisting.
 *
 * @param input - The alert creation payload
 * @returns The newly created IntelligenceAlert record
 * @throws {Error} If severity or alertType is invalid
 */
export async function createAlert(input: CreateAlertInput) {
  validateSeverity(input.severity);
  validateAlertType(input.alertType);

  return db.intelligenceAlert.create({
    data: {
      companyId: input.companyId ?? null,
      connectorId: input.connectorId ?? null,
      severity: input.severity,
      alertType: input.alertType,
      title: input.title,
      description: input.description,
      metadata: JSON.stringify(input.metadata ?? {}),
      status: 'active',
    },
  });
}

// ─── 2. Acknowledge Alert ────────────────────────────────────

/**
 * Acknowledge an active alert, marking it as seen by a specific user.
 *
 * Only alerts with status 'active' can be acknowledged.
 *
 * @param alertId - The ID of the alert to acknowledge
 * @param userId  - The ID of the user performing the acknowledgment
 * @returns The updated IntelligenceAlert record
 * @throws {Error} If the alert is not found or not in 'active' status
 */
export async function acknowledgeAlert(alertId: string, userId: string) {
  const alert = await db.intelligenceAlert.findUnique({
    where: { id: alertId },
  });

  if (!alert) {
    throw new Error(`Alert with id "${alertId}" not found`);
  }

  if (alert.status !== 'active') {
    throw new Error(
      `Cannot acknowledge alert with status "${alert.status}". Only "active" alerts can be acknowledged.`,
    );
  }

  return db.intelligenceAlert.update({
    where: { id: alertId },
    data: {
      status: 'acknowledged',
      acknowledgedBy: userId,
      acknowledgedAt: new Date(),
    },
  });
}

// ─── 3. Resolve Alert ────────────────────────────────────────

/**
 * Resolve an alert, optionally attaching resolution notes.
 *
 * Only alerts with status 'active' or 'acknowledged' can be resolved.
 *
 * @param alertId - The ID of the alert to resolve
 * @param userId  - The ID of the user resolving the alert
 * @param notes   - Optional free-text explanation of the resolution
 * @returns The updated IntelligenceAlert record
 * @throws {Error} If the alert is not found or not in a resolvable status
 */
export async function resolveAlert(
  alertId: string,
  userId: string,
  notes?: string,
) {
  const alert = await db.intelligenceAlert.findUnique({
    where: { id: alertId },
  });

  if (!alert) {
    throw new Error(`Alert with id "${alertId}" not found`);
  }

  if (alert.status !== 'active' && alert.status !== 'acknowledged') {
    throw new Error(
      `Cannot resolve alert with status "${alert.status}". Only "active" or "acknowledged" alerts can be resolved.`,
    );
  }

  return db.intelligenceAlert.update({
    where: { id: alertId },
    data: {
      status: 'resolved',
      resolvedBy: userId,
      resolvedAt: new Date(),
      resolutionNotes: notes ?? null,
    },
  });
}

// ─── 4. Dismiss Alert ────────────────────────────────────────

/**
 * Dismiss an alert regardless of its current status.
 *
 * Dismissed alerts are considered noise or non-actionable.
 * Records the dismissing user and timestamp for audit purposes.
 *
 * @param alertId - The ID of the alert to dismiss
 * @param userId  - The ID of the user dismissing the alert
 * @returns The updated IntelligenceAlert record
 * @throws {Error} If the alert is not found
 */
export async function dismissAlert(alertId: string, userId: string) {
  const alert = await db.intelligenceAlert.findUnique({
    where: { id: alertId },
  });

  if (!alert) {
    throw new Error(`Alert with id "${alertId}" not found`);
  }

  return db.intelligenceAlert.update({
    where: { id: alertId },
    data: {
      status: 'dismissed',
      resolvedBy: userId,
      resolvedAt: new Date(),
    },
  });
}

// ─── 5. Get Alerts (paginated) ───────────────────────────────

/**
 * Retrieve a paginated list of IntelligenceAlert records with optional filters.
 *
 * Results are ordered by creation date descending, with critical-severity
 * alerts promoted to the top within the same timestamp bucket.
 * When a companyId filter is present, the related company is included
 * (id + rawName only).
 *
 * @param filters - Optional filter and pagination options
 * @returns The matching alerts and the total count for pagination
 */
export async function getAlerts(
  filters: AlertFilters = {},
): Promise<{ alerts: IntelligenceAlert[]; total: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.max(1, Math.min(100, filters.limit ?? DEFAULT_PAGE_LIMIT));
  const skip = (page - 1) * limit;

  const where = buildWhereClause(filters);

  const [alerts, total] = await Promise.all([
    db.intelligenceAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: { company: { select: { id: true, rawName: true } } },
    }),
    db.intelligenceAlert.count({ where }),
  ]);

  // Stable sort: critical-first within the same createdAt window
  const sorted = [...alerts].sort((a, b) => {
    const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
    if (timeDiff !== 0) return timeDiff;
    return (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99);
  });

  return { alerts: sorted, total };
}

// ─── 6. Get Alert Summary ────────────────────────────────────

/**
 * Produce an aggregated summary of all alerts in the system.
 *
 * Includes counts broken down by severity, status, and alert type,
 * plus the 5 most recently created active alerts.
 *
 * @returns A structured summary object
 */
export async function getAlertSummary(): Promise<AlertSummary> {
  const [bySeverity, byStatus, byType, recentActive, total] = await Promise.all([
    db.intelligenceAlert.groupBy({
      by: ['severity'],
      _count: { id: true },
    }),
    db.intelligenceAlert.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    db.intelligenceAlert.groupBy({
      by: ['alertType'],
      _count: { id: true },
    }),
    db.intelligenceAlert.findMany({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    db.intelligenceAlert.count(),
  ]);

  return {
    bySeverity: Object.fromEntries(
      bySeverity.map((row) => [row.severity, row._count.id]),
    ),
    byStatus: Object.fromEntries(
      byStatus.map((row) => [row.status, row._count.id]),
    ),
    byType: Object.fromEntries(
      byType.map((row) => [row.alertType, row._count.id]),
    ),
    // Raw query doesn't include company — safe to cast since the payload
    // type is a superset when company is absent
    recentActive: recentActive as unknown as IntelligenceAlert[],
    total,
  };
}

// ─── 7. Auto-Generate Alerts ─────────────────────────────────

/**
 * Scan the intelligence pipeline for conditions that warrant automated alerts.
 *
 * Detects four categories of issues:
 *   1. **health_degraded** — SourceHealth.healthScore < 0.5
 *   2. **source_stale**    — SourceHealth.freshnessScore < 0.3
 *   3. **conflict_detected** — Unresolved IntelligenceAssociation with type 'contradicts'
 *   4. **ingestion_failure** — ConnectorRun with status 'failed' in the last 24 hours
 *
 * Deduplication: only creates a new alert if no active alert of the same
 * type + connectorId (or type + companyId for conflicts) exists within the
 * last 24 hours.
 *
 * @param companyId - Optional company scope; when provided, only that
 *   company's connectors are scanned
 * @returns The number of alerts created and the created alert records
 */
export async function autoGenerateAlerts(companyId?: string): Promise<{
  created: number;
  alerts: IntelligenceAlert[];
}> {
  const createdAlerts: IntelligenceAlert[] = [];
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Determine which connectors to scan
  let connectorIds: string[] | null = null;

  if (companyId) {
    // Connectors that have at least one IntelligenceObject for this company
    const objects = await db.intelligenceObject.findMany({
      where: { companyId, connectorId: { not: null } },
      select: { connectorId: true },
      distinct: ['connectorId'],
    });
    connectorIds = objects.map((o) => o.connectorId!).filter(Boolean);
    if (connectorIds.length === 0) {
      return { created: 0, alerts: [] };
    }
  }

  // ── a) health_degraded: SourceHealth.healthScore < 0.5 ──

  const healthWhere: Prisma.SourceHealthWhereInput = {
    healthScore: { lt: 0.5 },
  };
  if (connectorIds) {
    healthWhere.connectorId = { in: connectorIds };
  }

  const degradedHealths = await db.sourceHealth.findMany({
    where: healthWhere,
    include: { connector: true },
  });

  // Batch: pre-fetch existing alerts for all types to avoid N+1 findFirst
  const existingAlerts = await db.intelligenceAlert.findMany({
    where: {
      status: 'active',
      createdAt: { gte: twentyFourHoursAgo },
      alertType: { in: ['health_degraded', 'source_stale', 'conflict_detected', 'ingestion_failure'] },
      ...(companyId ? { companyId } : {}),
    },
    select: { alertType: true, connectorId: true, companyId: true },
  });

  const existingKeys = new Set(
    existingAlerts.map(a => `${a.alertType}:${a.connectorId || ''}:${a.companyId || ''}`)
  );

  const alertExists = (alertType: string, connectorId?: string | null, companyId?: string | null) =>
    existingKeys.has(`${alertType}:${connectorId || ''}:${companyId || ''}`);

  for (const sh of degradedHealths) {
    if (alertExists('health_degraded', sh.connectorId)) continue;

    const severity: AlertSeverity =
      sh.healthScore < 0.2
        ? 'critical'
        : sh.healthScore < 0.35
          ? 'high'
          : 'medium';

    const alert = await db.intelligenceAlert.create({
      data: {
        connectorId: sh.connectorId,
        severity,
        alertType: 'health_degraded',
        title: `Health degraded: ${sh.connector.name}`,
        description: `Connector "${sh.connector.name}" has a health score of ${sh.healthScore.toFixed(2)} (threshold < 0.5). Success rate: ${sh.successRate.toFixed(2)}, quality: ${sh.qualityScore.toFixed(2)}, freshness: ${sh.freshnessScore.toFixed(2)}.`,
        metadata: JSON.stringify({
          healthScore: sh.healthScore,
          successRate: sh.successRate,
          qualityScore: sh.qualityScore,
          freshnessScore: sh.freshnessScore,
          consecutiveFailures: sh.consecutiveFailures,
          connectorName: sh.connector.name,
        }),
        status: 'active',
      },
    });

    createdAlerts.push(alert as unknown as IntelligenceAlert);
  }

  // ── b) source_stale: SourceHealth.freshnessScore < 0.3 ──

  const staleWhere: Prisma.SourceHealthWhereInput = {
    freshnessScore: { lt: 0.3 },
  };
  if (connectorIds) {
    staleWhere.connectorId = { in: connectorIds };
  }

  const staleHealths = await db.sourceHealth.findMany({
    where: staleWhere,
    include: { connector: true },
  });

  for (const sh of staleHealths) {
    if (alertExists('source_stale', sh.connectorId)) continue;

    const severity: AlertSeverity =
      sh.freshnessScore < 0.1
        ? 'critical'
        : sh.freshnessScore < 0.2
          ? 'high'
          : 'medium';

    const alert = await db.intelligenceAlert.create({
      data: {
        connectorId: sh.connectorId,
        severity,
        alertType: 'source_stale',
        title: `Stale source: ${sh.connector.name}`,
        description: `Connector "${sh.connector.name}" has a freshness score of ${sh.freshnessScore.toFixed(2)} (threshold < 0.3). Data may be outdated and should be refreshed.`,
        metadata: JSON.stringify({
          freshnessScore: sh.freshnessScore,
          connectorName: sh.connector.name,
          lastSuccessAt: sh.lastSuccessAt,
        }),
        status: 'active',
      },
    });

    createdAlerts.push(alert as unknown as IntelligenceAlert);
  }

  // ── c) conflict_detected: Unresolved contradicts associations ──

  const conflictWhere: Prisma.IntelligenceAssociationWhereInput = {
    associationType: 'contradicts',
    resolved: false,
  };
  if (companyId) {
    conflictWhere.companyId = companyId;
  }

  const conflicts = await db.intelligenceAssociation.groupBy({
    by: ['companyId'],
    where: conflictWhere,
    _count: { id: true },
  });

  for (const group of conflicts) {
    if (alertExists('conflict_detected', null, group.companyId)) continue;

    const severity: AlertSeverity =
      group._count.id >= 5
        ? 'critical'
        : group._count.id >= 2
          ? 'high'
          : 'medium';

    const alert = await db.intelligenceAlert.create({
      data: {
        companyId: group.companyId,
        severity,
        alertType: 'conflict_detected',
        title: `Unresolved contradictions detected`,
        description: `${group._count.id} unresolved contradiction(s) found for company ${group.companyId}. Review and resolve these conflicts to maintain data integrity.`,
        metadata: JSON.stringify({
          conflictCount: group._count.id,
          companyId: group.companyId,
        }),
        status: 'active',
      },
    });

    createdAlerts.push(alert as unknown as IntelligenceAlert);
  }

  // ── d) ingestion_failure: Failed ConnectorRuns in last 24h ──

  const runWhere: Prisma.ConnectorRunWhereInput = {
    status: 'failed',
    createdAt: { gte: twentyFourHoursAgo },
  };
  if (connectorIds) {
    runWhere.connectorId = { in: connectorIds };
  }

  const failedRuns = await db.connectorRun.groupBy({
    by: ['connectorId'],
    where: runWhere,
    _count: { id: true },
    _max: { createdAt: true },
  });

  for (const group of failedRuns) {
    if (alertExists('ingestion_failure', group.connectorId)) continue;

    const connector = await db.connector.findUnique({
      where: { id: group.connectorId },
      select: { name: true },
    });

    const severity: AlertSeverity =
      group._count.id >= 5
        ? 'critical'
        : group._count.id >= 3
          ? 'high'
          : group._count.id >= 2
            ? 'medium'
            : 'low';

    const alert = await db.intelligenceAlert.create({
      data: {
        connectorId: group.connectorId,
        severity,
        alertType: 'ingestion_failure',
        title: `Ingestion failures: ${connector?.name ?? group.connectorId}`,
        description: `${group._count.id} connector run(s) failed in the last 24 hours for "${connector?.name ?? group.connectorId}". Last failure at ${group._max.createdAt?.toISOString() ?? 'unknown'}.`,
        metadata: JSON.stringify({
          failedRunCount: group._count.id,
          lastFailureAt: group._max.createdAt,
          connectorName: connector?.name,
        }),
        status: 'active',
      },
    });

    createdAlerts.push(alert as unknown as IntelligenceAlert);
  }

  return { created: createdAlerts.length, alerts: createdAlerts };
}