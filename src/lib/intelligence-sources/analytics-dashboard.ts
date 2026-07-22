/**
 * Analytics Dashboard — Intelligence Aggregation & Trend Data
 *
 * Sprint 3 module that queries across all Sprint 1–3 models to produce
 * aggregated analytics for the intelligence dashboard UI.
 *
 * @module analytics-dashboard
 */

import { db } from '@/lib/db';
import { KNOWLEDGE_CATEGORIES, ALL_CATEGORIES } from './types';

// ─── Exported Interfaces ───────────────────────────────────────

export interface IntelligenceOverview {
  totalCompanies: number;
  totalIntelligenceObjects: number;
  totalKnowledgeEntries: number;
  totalConnectors: number;
  totalAlerts: number;
  activeAlerts: number;
  avgConfidence: number;
  intelligenceByStatus: Record<string, number>;
  knowledgeByCategory: Record<string, number>;
  totalAssociations: number;
  unresolvedConflicts: number;
  recentActivity: { last24h: number; last7d: number; last30d: number };
}

export interface AcquisitionTrend {
  /** Date in YYYY-MM-DD format */
  date: string;
  /** Total intelligence objects acquired on this day */
  acquired: number;
  /** Breakdown by source type (csv, excel, website, rss, document, human) */
  bySourceType: Record<string, number>;
}

export interface ConfidenceDistribution {
  buckets: Array<{ range: string; count: number; avgFreshness: number }>;
  overallAvg: number;
  totalObjects: number;
}

export interface KnowledgeCoverage {
  categories: Array<{ category: string; count: number; percentage: number }>;
  /** 0–100, fraction of the 13 categories that have at least one entry */
  coverageScore: number;
  /** Category names with zero entries */
  gaps: string[];
  totalEntries: number;
}

export interface SourcePerformance {
  connectorId: string;
  connectorName: string;
  sourceType: string;
  healthScore: number | null;
  totalRecords: number;
  avgConfidence: number;
  lastRunAt: Date | null;
  status: string;
}

export interface ActivityItem {
  id: string;
  type: 'timeline' | 'alert' | 'inbox';
  title: string;
  description?: string;
  timestamp: Date;
  severity?: string;
  metadata?: Record<string, unknown>;
}

// ─── Helpers ───────────────────────────────────────────────────

/** Bucket thresholds for confidence distribution */
const CONFIDENCE_BUCKET_RANGES = [
  { label: '0.0–0.2', min: 0, max: 0.2 },
  { label: '0.2–0.4', min: 0.2, max: 0.4 },
  { label: '0.4–0.6', min: 0.4, max: 0.6 },
  { label: '0.6–0.8', min: 0.6, max: 0.8 },
  { label: '0.8–1.0', min: 0.8, max: 1.0001 }, // slight overshoot to include exactly 1.0
];

/**
 * Truncate a Date to a YYYY-MM-DD string.
 * Uses UTC to avoid timezone drift.
 */
function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Parse a JSON string safely, returning `undefined` on failure.
 */
function safeJsonParse(str: string | null | undefined): Record<string, unknown> | undefined {
  if (!str) return undefined;
  try {
    return JSON.parse(str) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

// ─── Exported Functions ────────────────────────────────────────

/**
 * Returns a high-level overview of the intelligence system.
 *
 * Aggregates counts, status breakdowns, confidence averages,
 * association stats, and recent-activity windows across all
 * Sprint 1–3 models.
 */
export async function getIntelligenceOverview(): Promise<IntelligenceOverview> {
  const now = new Date();

  // Run all independent counts in parallel
  const [
    companiesWithIntel,
    intelObjects,
    knowledgeEntries,
    connectors,
    alerts,
    associations,
    contradictions,
    timeline24h,
    timeline7d,
    timeline30d,
  ] = await Promise.all([
    // Distinct companies that have at least one intelligence object
    db.intelligenceObject.findMany({ select: { companyId: true }, distinct: ['companyId'] }),
    db.intelligenceObject.findMany({
      select: { status: true, originalConfidence: true },
    }),
    db.knowledgeEntry.findMany({
      select: { category: true },
    }),
    db.connector.count(),
    db.intelligenceAlert.findMany({
      select: { status: true },
    }),
    db.intelligenceAssociation.count(),
    db.intelligenceAssociation.count({ where: { resolved: false, associationType: 'contradicts' } }),
    db.intelligenceTimeline.count({
      where: { createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
    }),
    db.intelligenceTimeline.count({
      where: { createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } },
    }),
    db.intelligenceTimeline.count({
      where: { createdAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } },
    }),
  ]);

  // Breakdown intelligence objects by status
  const intelligenceByStatus: Record<string, number> = {};
  let confidenceSum = 0;
  for (const obj of intelObjects) {
    intelligenceByStatus[obj.status] = (intelligenceByStatus[obj.status] ?? 0) + 1;
    confidenceSum += obj.originalConfidence;
  }
  const avgConfidence = intelObjects.length > 0 ? confidenceSum / intelObjects.length : 0;

  // Breakdown knowledge entries by category
  const knowledgeByCategory: Record<string, number> = {};
  for (const entry of knowledgeEntries) {
    knowledgeByCategory[entry.category] = (knowledgeByCategory[entry.category] ?? 0) + 1;
  }

  // Alert counts
  let activeAlerts = 0;
  for (const alert of alerts) {
    if (alert.status === 'active') activeAlerts++;
  }

  return {
    totalCompanies: companiesWithIntel.length,
    totalIntelligenceObjects: intelObjects.length,
    totalKnowledgeEntries: knowledgeEntries.length,
    totalConnectors: connectors,
    totalAlerts: alerts.length,
    activeAlerts,
    avgConfidence: Math.round(avgConfidence * 10_000) / 10_000,
    intelligenceByStatus,
    knowledgeByCategory,
    totalAssociations: associations,
    unresolvedConflicts: contradictions,
    recentActivity: {
      last24h: timeline24h,
      last7d: timeline7d,
      last30d: timeline30d,
    },
  };
}

/**
 * Returns daily acquisition counts over the last N days.
 *
 * Groups intelligence objects by their `createdAt` date (UTC) and
 * further breaks them down by `sourceType`. Because the project may
 * run on SQLite in test environments (where `date_trunc` is
 * unavailable), all grouping is performed in JavaScript.
 *
 * @param days - Number of days to look back (default 30, max 90)
 */
export async function getAcquisitionTrends(days: number = 30): Promise<AcquisitionTrend[]> {
  const clampedDays = Math.min(Math.max(days, 1), 90);
  const since = new Date(Date.now() - clampedDays * 24 * 60 * 60 * 1000);

  const objects = await db.intelligenceObject.findMany({
    where: { createdAt: { gte: since } },
    select: {
      createdAt: true,
      sourceType: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Build a map of date → { total, bySourceType }
  const map = new Map<string, { acquired: number; bySourceType: Record<string, number> }>();

  for (const obj of objects) {
    const dateStr = toDateString(obj.createdAt);
    const existing = map.get(dateStr) ?? { acquired: 0, bySourceType: {} };
    existing.acquired += 1;
    existing.bySourceType[obj.sourceType] = (existing.bySourceType[obj.sourceType] ?? 0) + 1;
    map.set(dateStr, existing);
  }

  // Sort by date ascending
  const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));

  return sorted.map(([date, data]) => ({
    date,
    acquired: data.acquired,
    bySourceType: data.bySourceType,
  }));
}

/**
 * Returns the distribution of intelligence objects across
 * confidence buckets, plus the overall average confidence
 * and total object count.
 *
 * Buckets: 0.0–0.2, 0.2–0.4, 0.4–0.6, 0.6–0.8, 0.8–1.0
 * Each bucket includes a count and an average freshness based
 * on the `capturedAt` field (days since capture; 0 if unavailable).
 */
export async function getConfidenceDistribution(): Promise<ConfidenceDistribution> {
  const objects = await db.intelligenceObject.findMany({
    select: {
      originalConfidence: true,
      capturedAt: true,
    },
  });

  const now = Date.now();
  const totalObjects = objects.length;

  // Initialize buckets
  const buckets = CONFIDENCE_BUCKET_RANGES.map((b) => ({
    range: b.label,
    count: 0,
    _freshnessSum: 0 as number,
  }));

  let confidenceSum = 0;

  for (const obj of objects) {
    confidenceSum += obj.originalConfidence;

    // Find matching bucket
    const idx = CONFIDENCE_BUCKET_RANGES.findIndex(
      (b) => obj.originalConfidence >= b.min && obj.originalConfidence < b.max
    );
    if (idx >= 0) {
      buckets[idx].count += 1;
      // Freshness: days since capture (lower = fresher)
      if (obj.capturedAt) {
        const daysSince = (now - obj.capturedAt.getTime()) / (24 * 60 * 60 * 1000);
        buckets[idx]._freshnessSum += daysSince;
      }
    }
  }

  const overallAvg =
    totalObjects > 0 ? Math.round((confidenceSum / totalObjects) * 10_000) / 10_000 : 0;

  // Finalize buckets — compute avg freshness per bucket
  const resultBuckets = buckets.map((b) => ({
    range: b.range,
    count: b.count,
    avgFreshness:
      b.count > 0
        ? Math.round((b._freshnessSum / b.count) * 100) / 100
        : 0,
  }));

  return {
    buckets: resultBuckets,
    overallAvg,
    totalObjects,
  };
}

/**
 * Returns knowledge-coverage statistics across the 13 knowledge
 * categories.
 *
 * When `companyId` is provided, only entries for that company are
 * considered. Otherwise all entries are aggregated globally.
 *
 * @param companyId - Optional company to scope the analysis
 */
export async function getKnowledgeCoverage(companyId?: string): Promise<KnowledgeCoverage> {
  const whereClause = companyId ? { companyId } : {};

  const entries = await db.knowledgeEntry.findMany({
    where: whereClause,
    select: { category: true },
  });

  // Count per category
  const countMap: Record<string, number> = {};
  for (const cat of ALL_CATEGORIES) {
    countMap[cat] = 0;
  }
  for (const entry of entries) {
    if (entry.category in countMap) {
      countMap[entry.category] += 1;
    }
  }

  const totalEntries = entries.length;
  const coveredCategories = ALL_CATEGORIES.filter((c) => countMap[c] > 0);
  const gaps = ALL_CATEGORIES.filter((c) => countMap[c] === 0);
  const coverageScore = Math.round((coveredCategories.length / ALL_CATEGORIES.length) * 100);

  const categories = ALL_CATEGORIES.map((cat) => ({
    category: cat,
    count: countMap[cat],
    percentage: totalEntries > 0 ? Math.round((countMap[cat] / totalEntries) * 10_000) / 100 : 0,
  }));

  return {
    categories,
    coverageScore,
    gaps,
    totalEntries,
  };
}

/**
 * Returns performance metrics for every active connector.
 *
 * For each connector the response includes health-score from
 * `SourceHealth`, total records acquired, average confidence of
 * its intelligence objects, and the timestamp of the most recent
 * run. Results are ordered by total records descending.
 */
export async function getSourcePerformance(): Promise<SourcePerformance[]> {
  const connectors = await db.connector.findMany({
    where: { status: 'active' },
    include: {
      sourceHealth: { select: { healthScore: true } },
      runs: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  if (connectors.length === 0) return [];

  // For each connector, fetch its intelligence-object stats
  const connectorIds = connectors.map((c) => c.id);

  // Batch: count + avg confidence per connectorId
  const objectStats = await db.intelligenceObject.groupBy({
    by: ['connectorId'],
    where: { connectorId: { in: connectorIds } },
    _count: true,
    _avg: { originalConfidence: true },
  });

  const statsMap = new Map<string, { total: number; avgConfidence: number }>();
  for (const row of objectStats) {
    if (row.connectorId == null) continue;
    statsMap.set(row.connectorId, {
      total: row._count,
      avgConfidence: row._avg.originalConfidence ?? 0,
    });
  }

  const performance: SourcePerformance[] = connectors.map((c) => {
    const stats = statsMap.get(c.id);
    return {
      connectorId: c.id,
      connectorName: c.name,
      sourceType: c.sourceType,
      healthScore: c.sourceHealth?.healthScore ?? null,
      totalRecords: stats?.total ?? 0,
      avgConfidence: stats
        ? Math.round(stats.avgConfidence * 10_000) / 10_000
        : 0,
      lastRunAt: c.runs[0]?.createdAt ?? c.lastRunAt ?? null,
      status: c.status,
    };
  });

  // Order by total records descending
  performance.sort((a, b) => b.totalRecords - a.totalRecords);

  return performance;
}

/**
 * Returns a unified activity feed combining timeline events,
 * active alerts, and recent inbox submissions.
 *
 * Each source is normalised into an `ActivityItem` with a `type`
 * discriminator. The combined list is sorted by `timestamp` DESC.
 *
 * @param limit - Maximum items to return (default 20)
 */
export async function getActivityFeed(limit: number = 20): Promise<ActivityItem[]> {
  const clampedLimit = Math.min(Math.max(limit, 1), 200);
  const fetchLimit = clampedLimit; // fetch the same amount from each source then merge

  const [timelineEvents, alerts, inboxItems] = await Promise.all([
    db.intelligenceTimeline.findMany({
      orderBy: { createdAt: 'desc' },
      take: fetchLimit,
      select: {
        id: true,
        eventType: true,
        title: true,
        description: true,
        metadata: true,
        createdAt: true,
      },
    }),
    db.intelligenceAlert.findMany({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' },
      take: fetchLimit,
      select: {
        id: true,
        severity: true,
        alertType: true,
        title: true,
        description: true,
        metadata: true,
        createdAt: true,
      },
    }),
    db.humanIntelligenceInbox.findMany({
      orderBy: { createdAt: 'desc' },
      take: fetchLimit,
      select: {
        id: true,
        content: true,
        summary: true,
        priority: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  // Normalise into ActivityItem[]
  const items: ActivityItem[] = [];

  for (const ev of timelineEvents) {
    items.push({
      id: ev.id,
      type: 'timeline',
      title: ev.title,
      description: ev.description ?? undefined,
      timestamp: ev.createdAt,
      severity: undefined,
      metadata: safeJsonParse(ev.metadata),
    });
  }

  for (const al of alerts) {
    items.push({
      id: al.id,
      type: 'alert',
      title: al.title,
      description: al.description,
      timestamp: al.createdAt,
      severity: al.severity,
      metadata: {
        ...safeJsonParse(al.metadata),
        alertType: al.alertType,
      },
    });
  }

  for (const ib of inboxItems) {
    items.push({
      id: ib.id,
      type: 'inbox',
      title: ib.summary ?? ib.content.slice(0, 120),
      description: ib.content.length > 120 ? ib.content.slice(0, 300) : undefined,
      timestamp: ib.createdAt,
      severity: ib.priority,
      metadata: { status: ib.status, priority: ib.priority },
    });
  }

  // Sort by timestamp descending, then limit
  items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return items.slice(0, clampedLimit);
}