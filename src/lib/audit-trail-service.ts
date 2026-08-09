/**
 * M5 Phase 6 — Audit Trail Service
 *
 * Lightweight audit trail for M5 intelligence operations.
 * Reuses the Evidence model for persistence (no schema changes required).
 *
 * Field mapping (Evidence → Audit):
 *   companyId       → companyId (required; fallback: first company in DB)
 *   searchQuery     → action (e.g., 'enrichment', 'brief_generated')
 *   sourceUrl       → 'audit://{actor}' (URL format required by Evidence)
 *   sourceName      → targetType (e.g., 'company', 'contact', 'brief')
 *   sourceTitle     → targetId
 *   snippet         → JSON-stringified details
 *   extractedField  → result ('success' | 'failure')
 *   extractedValue  → targetId (denormalized for filtering)
 *   sourceQualityTier → 'audit' (identifies these as audit entries vs real evidence)
 *   status          → 'active'
 *   confidence      → 1.0 (audit entries are system-truth, not estimated)
 *   relevanceScore  → 1.0
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
  targetType: string;    // 'company', 'contact', 'brief', 'agent'
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

const AUDIT_QUALITY_TIER = 'audit';

// Cache a fallback company ID for system-level audit events
let fallbackCompanyId: string | null = null;
let fallbackCompanyResolved = false;

/**
 * Resolve a valid companyId. If none provided, use the first company in DB.
 * Returns null if no companies exist at all (rare edge case).
 */
async function resolveCompanyId(companyId?: string): Promise<string | null> {
  if (companyId) return companyId;

  if (!fallbackCompanyResolved) {
    fallbackCompanyResolved = true;
    try {
      const first = await db.company.findFirst({ select: { id: true } });
      if (first) fallbackCompanyId = first.id;
    } catch {
      // DB unavailable
    }
  }

  return fallbackCompanyId;
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
    const companyId = await resolveCompanyId(params.companyId);
    if (!companyId) {
      logger.warn('[audit-trail] Cannot record audit event: no company available for anchoring', {
        action: params.action,
        targetType: params.targetType,
      });
      return null;
    }

    const evidence = await db.evidence.create({
      data: {
        companyId,
        searchQuery: params.action,
        sourceUrl: `audit://${params.actor}`,
        sourceName: params.targetType,
        sourceTitle: params.targetId ?? null,
        snippet: JSON.stringify(params.details),
        extractedField: params.result,
        extractedValue: params.targetId ?? null,
        sourceQualityTier: AUDIT_QUALITY_TIER,
        status: 'active',
        confidence: 1.0,
        relevanceScore: 1.0,
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
 * Filters by sourceQualityTier = 'audit' to separate from real evidence.
 */
export async function queryAuditTrail(
  params: QueryAuditParams,
): Promise<AuditEvent[]> {
  try {
    const where: Record<string, unknown> = {
      sourceQualityTier: AUDIT_QUALITY_TIER,
      status: 'active',
    };

    if (params.action) {
      where.searchQuery = params.action;
    }

    if (params.companyId) {
      where.companyId = params.companyId;
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
    return records.map(r => {
      let details: Record<string, unknown> = {};
      try {
        details = r.snippet ? JSON.parse(r.snippet) : {};
      } catch {
        details = { raw: r.snippet };
      }

      // Extract actor from sourceUrl: 'audit://system' → 'system'
      let actor = 'unknown';
      if (r.sourceUrl.startsWith('audit://')) {
        actor = r.sourceUrl.replace('audit://', '');
      }

      return {
        id: r.id,
        action: r.searchQuery ?? '',
        actor,
        companyId: r.companyId,
        targetType: r.sourceName ?? '',
        targetId: r.sourceTitle ?? r.extractedValue ?? null,
        details,
        result: (r.extractedField === 'success' ? 'success' : 'failure') as 'success' | 'failure',
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
