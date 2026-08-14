/**
 * M5 Phase 6 — Audit Trail Service
 *
 * Lightweight audit trail for M5 intelligence operations.
 * Uses the Evidence model for persistence (no schema changes required).
 *
 * Field mapping (Evidence -> Audit):
 *   companyId       -> companyId (uses first Organization as fallback anchor)
 *   claim           -> action description
 *   sourceType      -> 'audit' (identifies these as audit entries)
 *   sourceUrl       -> 'audit://{actor}'
 *   sourceTitle     -> targetId
 *   excerpt         -> JSON-stringified details
 *   reliability     -> 'verified' (audit entries are system-truth)
 *   createdAt       -> event timestamp
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// ─── Types ──────────────────────────────────────────────────────────────

export interface AuditEvent {
  id: string;
  action: string;
  actor: string;
  companyId: string | null;
  targetType: string;
  targetId: string | null;
  details: Record<string, unknown>;
  result: 'success' | 'failure';
  timestamp: string;
}

export interface RecordAuditParams {
  action: string;        // 'enrichment', 'brief_generated', 'agent_invoked', etc.
  actor: string;         // 'system', 'user', 'agent_name'
  companyId?: string;
  targetType: string;    // 'organization', 'person', 'brief', 'agent'
  targetId?: string;
  details: Record<string, unknown>;
  result: 'success' | 'failure';
}

export interface QueryAuditParams {
  action?: string;
  companyId?: string;
  since?: Date;
  limit?: number;
}

// ─── Sentinel ───────────────────────────────────────────────────────────

const AUDIT_SOURCE_TYPE = 'audit';

// Cache a fallback organization ID for system-level audit events
let fallbackOrgId: string | null = null;
let fallbackOrgResolved = false;

/**
 * Resolve a valid organizationId for anchoring audit evidence.
 * If none provided, use the first organization in DB.
 * Returns null if no organizations exist at all (rare edge case).
 */
async function resolveOrgId(orgId?: string): Promise<string | null> {
  if (orgId) return orgId;

  if (!fallbackOrgResolved) {
    fallbackOrgResolved = true;
    try {
      const first = await db.organization.findFirst({ select: { id: true } });
      if (first) fallbackOrgId = first.id;
    } catch {
      // DB unavailable
    }
  }

  return fallbackOrgId;
}

// ─── Record ─────────────────────────────────────────────────────────────

/**
 * Record an audit event using the Evidence model.
 * Non-throwing: errors are logged but never propagated.
 * Returns the Evidence ID on success, null on failure.
 */
export async function recordAuditEvent(
  params: RecordAuditParams,
): Promise<string | null> {
  try {
    const orgId = await resolveOrgId(params.companyId);
    if (!orgId) {
      logger.warn('[audit-trail] Cannot record audit event: no organization available for anchoring', {
        action: params.action,
        targetType: params.targetType,
      });
      return null;
    }

    const evidence = await db.evidence.create({
      data: {
        organizationId: orgId,
        claim: `[${params.result.toUpperCase()}] ${params.action}`,
        sourceType: AUDIT_SOURCE_TYPE,
        sourceUrl: `audit://${params.actor}`,
        sourceTitle: params.targetId ?? null,
        excerpt: JSON.stringify(params.details),
        reliability: 'verified',
      },
    });

    return evidence.id;
  } catch (err) {
    logger.error('[audit-trail] Failed to record audit event', {
      error: err instanceof Error ? err.message : String(err),
      action: params.action,
      targetType: params.targetType,
    });
    return null;
  }
}

// ─── Query ──────────────────────────────────────────────────────────────

/**
 * Query audit trail events from the Evidence model.
 * Filters by sourceType = 'audit' to separate from real evidence.
 */
export async function queryAuditTrail(
  params: QueryAuditParams,
): Promise<AuditEvent[]> {
  try {
    const where: Record<string, unknown> = {
      sourceType: AUDIT_SOURCE_TYPE,
    };

    if (params.action) {
      where.claim = { contains: params.action };
    }

    if (params.companyId) {
      where.organizationId = params.companyId;
    }

    if (params.since) {
      where.createdAt = { gte: params.since };
    }

    const records = await db.evidence.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.limit ?? 50,
    });

    // Map Evidence records back to AuditEvent shape
    return records.map((r) => {
      let details: Record<string, unknown> = {};
      try {
        details = r.excerpt ? JSON.parse(r.excerpt) : {};
      } catch {
        details = { raw: r.excerpt };
      }

      // Extract actor from sourceUrl: 'audit://system' -> 'system'
      let actor = 'unknown';
      if (r.sourceUrl?.startsWith('audit://')) {
        actor = r.sourceUrl.replace('audit://', '');
      }

      // Extract result from claim: '[SUCCESS] enrichment' -> 'success'
      const resultMatch = r.claim?.match(/^\[(SUCCESS|FAILURE)\]/i);
      const result = resultMatch ? (resultMatch[1]!.toLowerCase() as 'success' | 'failure') : 'success';

      return {
        id: r.id,
        action: r.claim?.replace(/^\[(SUCCESS|FAILURE)\]\s*/i, '') ?? '',
        actor,
        companyId: r.organizationId,
        targetType: r.sourceTitle ?? '',
        targetId: r.sourceTitle ?? null,
        details,
        result,
        timestamp: r.createdAt.toISOString(),
      };
    });
  } catch (err) {
    logger.error('[audit-trail] Failed to query audit trail', {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
