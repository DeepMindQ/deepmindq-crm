/**
 * M5 Phase 1.5 — Data Lineage & Provenance Service
 *
 * Tracks the origin, transformation, and verification chain of every
 * intelligence data point in the platform. This is the backbone of the
 * TRUST framework — without lineage, there is no transparency.
 *
 * The service answers:
 *   "Where did this data come from?"
 *   "How was it processed?"
 *   "When was it last verified?"
 *   "What was the original raw value?"
 *
 * Design Principles:
 *   - Every data write should optionally record lineage
 *   - Lineage is append-only (never overwritten)
 *   - Supports querying by company, field, source, or time range
 *   - Lightweight: uses the existing Evidence model for storage
 *   - Composable with TRUST metadata framework
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { TrustSource } from './intelligence-sources/trust-metadata';

// ─── Lineage Types ──────────────────────────────────────────────

/** The lifecycle stages a data point goes through */
export type LineageEvent =
  | 'acquired'          // Raw data received from source
  | 'processed'         // Data was cleaned, normalized, or transformed
  | 'enriched'          // Data was enriched by an external provider
  | 'computed'          // Data was computed by a platform engine
  | 'verified'          // Data was cross-referenced or confirmed
  | 'corrected'         // Data was manually corrected by a user
  | 'deprecated'        // Data was replaced by a newer value
  | 'rejected';         // Data was found to be incorrect

/** A single lineage record for a data point */
export interface DataLineageRecord {
  /** Unique ID for this lineage event */
  id: string;

  /** The company this lineage applies to */
  companyId: string;

  /** The field this lineage tracks (e.g., 'revenue', 'employees', 'industry') */
  field: string;

  /** The type of event in the data lifecycle */
  event: LineageEvent;

  /** Source classification */
  source: TrustSource;

  /** Specific provider or connector (e.g., 'clearbit', 'csv_upload', 'ai_enrichment') */
  provider: string;

  /** The value after this event (what the field was set to) */
  newValue: unknown;

  /** The value before this event (previous state, if any) */
  previousValue: unknown;

  /** The original raw value from the source (before any processing) */
  rawValue: unknown;

  /** Human-readable description of what happened */
  description: string;

  /** Optional evidence ID that supports this lineage event */
  evidenceId: string | null;

  /** When this event occurred */
  timestamp: string;

  /** Who/what triggered this event */
  triggeredBy: string;
}

// ─── Lineage Query Options ──────────────────────────────────────

export interface LineageQuery {
  companyId: string;
  field?: string;
  source?: TrustSource;
  provider?: string;
  event?: LineageEvent;
  since?: Date;
  limit?: number;
}

// ─── Lineage Service ────────────────────────────────────────────

/**
 * Record a data lineage event.
 *
 * Stores lineage information alongside evidence in the Evidence table,
 * using the extractedField to identify the field and extractedValue JSON
 * to store the full lineage data.
 */
export async function recordLineage(params: {
  companyId: string;
  field: string;
  event: LineageEvent;
  source: TrustSource;
  provider: string;
  newValue: unknown;
  previousValue?: unknown;
  rawValue?: unknown;
  description: string;
  evidenceId?: string | null;
  triggeredBy?: string;
}): Promise<string | null> {
  try {
    const lineageData = {
      field: params.field,
      event: params.event,
      source: params.source,
      provider: params.provider,
      newValue: params.newValue,
      previousValue: params.previousValue ?? null,
      rawValue: params.rawValue ?? null,
      triggeredBy: params.triggeredBy ?? 'system',
    };

    // Store as Evidence with lineage-specific fields
    const evidence = await db.evidence.create({
      data: {
        companyId: params.companyId,
        extractedField: `lineage:${params.field}`,
        extractedValue: JSON.stringify(lineageData),
        sourceTitle: params.description,
        sourceName: `lineage:${params.provider}`,
        sourceUrl: `lineage://${params.provider}/${params.field}`,
        snippet: params.description,
        relevanceScore: params.source === 'verified_api' ? 0.9
          : params.source === 'customer_data' ? 0.85
          : params.source === 'platform_computed' ? 0.7
          : 0.5,
        confidence: params.source === 'verified_api' ? 0.9
          : params.source === 'customer_data' ? 0.85
          : 0.5,
        sourceQualityTier: params.source === 'verified_api' || params.source === 'customer_data'
          ? 'premium' : 'standard',
        status: 'active',
      },
    });

    return evidence.id;
  } catch (error) {
    logger.error('[lineage] Failed to record lineage:', {
      companyId: params.companyId,
      field: params.field,
      event: params.event,
      error: error,
    });
    return null;
  }
}

/**
 * Query lineage history for a company/field.
 */
export async function queryLineage(
  query: LineageQuery
): Promise<DataLineageRecord[]> {
  const where: Record<string, unknown> = {
    companyId: query.companyId,
    status: 'active',
  };

  // Filter by field
  if (query.field) {
    where.extractedField = `lineage:${query.field}`;
  } else {
    // Match all lineage records
    where.extractedField = { startsWith: 'lineage:' };
  }

  // Filter by date
  if (query.since) {
    where.createdAt = { gte: query.since };
  }

  const evidenceRecords = await db.evidence.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: query.limit || 50,
    select: {
      id: true,
      extractedField: true,
      extractedValue: true,
      sourceTitle: true,
      sourceName: true,
      createdAt: true,
    },
  });

  return evidenceRecords
    .map(record => {
      try {
        const data = JSON.parse(record.extractedValue || '{}');
        const sourceMatch = record.sourceName?.replace('lineage:', '') || '';
        const fieldMatch = record.extractedField?.replace('lineage:', '') || '';

        // Filter by source/provider if specified
        if (query.provider && data.provider !== query.provider) return null;
        if (query.source && data.source !== query.source) return null;
        if (query.event && data.event !== query.event) return null;

        return {
          id: record.id,
          companyId: query.companyId,
          field: data.field || fieldMatch,
          event: data.event,
          source: data.source,
          provider: data.provider,
          newValue: data.newValue,
          previousValue: data.previousValue,
          rawValue: data.rawValue,
          description: record.sourceTitle || '',
          evidenceId: record.id,
          timestamp: record.createdAt.toISOString(),
          triggeredBy: data.triggeredBy,
        } as DataLineageRecord;
      } catch {
        return null;
      }
    })
    .filter((r): r is DataLineageRecord => r !== null);
}

/**
 * Get the latest lineage record for a specific company field.
 * Returns the most recent value and its provenance.
 */
export async function getLatestLineage(
  companyId: string,
  field: string
): Promise<DataLineageRecord | null> {
  const records = await queryLineage({
    companyId,
    field,
    limit: 1,
  });
  return records[0] || null;
}

/**
 * Get lineage summary for all fields of a company.
 * Returns a map of field → latest source/provider/timestamp.
 */
export async function getCompanyLineageSummary(
  companyId: string
): Promise<Record<string, {
  source: TrustSource;
  provider: string;
  event: LineageEvent;
  timestamp: string;
  description: string;
}>> {
  const records = await queryLineage({
    companyId,
    limit: 100,
  });

  const summary: Record<string, {
    source: TrustSource;
    provider: string;
    event: LineageEvent;
    timestamp: string;
    description: string;
  }> = {};

  for (const record of records) {
    if (!summary[record.field]) {
      summary[record.field] = {
        source: record.source,
        provider: record.provider,
        event: record.event,
        timestamp: record.timestamp,
        description: record.description,
      };
    }
  }

  return summary;
}

/**
 * Batch-record lineage for multiple fields at once.
 * Used during company enrichment when multiple fields are updated simultaneously.
 */
export async function recordLineageBatch(
  companyId: string,
  events: Array<{
    field: string;
    event: LineageEvent;
    source: TrustSource;
    provider: string;
    newValue: unknown;
    previousValue?: unknown;
    rawValue?: unknown;
    description: string;
    triggeredBy?: string;
  }>
): Promise<string[]> {
  const ids: string[] = [];

  for (const event of events) {
    const id = await recordLineage({
      companyId,
      ...event,
    });
    if (id) ids.push(id);
  }

  return ids;
}

/**
 * Get data freshness statistics for a company.
 * Returns the age of each field's latest lineage event.
 */
export async function getDataFreshnessStats(
  companyId: string
): Promise<Record<string, {
  ageDays: number;
  source: TrustSource;
  lastUpdated: string;
}>> {
  const summary = await getCompanyLineageSummary(companyId);
  const now = Date.now();
  const stats: Record<string, { ageDays: number; source: TrustSource; lastUpdated: string }> = {};

  for (const [field, info] of Object.entries(summary)) {
    const ageMs = now - new Date(info.timestamp).getTime();
    stats[field] = {
      ageDays: Math.round(ageMs / (1000 * 60 * 60 * 24)),
      source: info.source,
      lastUpdated: info.timestamp,
    };
  }

  return stats;
}
