/**
 * Source Governance — Health Scores, Rules & Reliability Tracking
 *
 * Computes composite health scores for every connector based on
 * run success rate, intelligence quality, and data freshness.
 * Provides governance reporting and stale-source flagging.
 */

import { db } from '@/lib/db';
import { SOURCE_RELIABILITY, SourceType, FRESHNESS_CONFIG } from './types';

// ─── Exported Interface ───────────────────────────────────────

/** Structured governance report aggregating health across all connectors */
export interface GovernanceReport {
  totalConnectors: number;
  activeConnectors: number;
  degradedConnectors: number;
  failedConnectors: number;
  avgHealthScore: number;
  connectorsByHealth: { healthy: number; warning: number; critical: number };
  topStaleSources: Array<{
    connectorId: string;
    connectorName: string;
    freshnessScore: number;
    healthScore: number;
  }>;
  totalAssociations: number;
  unresolvedConflicts: number;
}

// ─── Freshness Helper ──────────────────────────────────────────

/**
 * Compute a 0–1 freshness score for a single intelligence object.
 *
 * @param capturedAt - When the intelligence was originally captured (null → 0.3)
 * @param sourceType - The connector's source type (determines max allowed age)
 * @returns A value between 0 and 1
 */
function calculateFreshness(capturedAt: Date | null, sourceType: string): number {
  if (!capturedAt) return 0.3;
  const maxDaysMap: Record<string, number> = {
    news: 60,
    patent: 365,
    website: 180,
    rss: 90,
    csv: 365,
    excel: 365,
    document: 365,
    human: 365,
  };
  const maxDays = FRESHNESS_CONFIG[sourceType] ?? maxDaysMap[sourceType] ?? 90;
  const daysElapsed = (Date.now() - capturedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysElapsed <= 0) return 1.0;
  return Math.max(0, Math.min(1, 1 - daysElapsed / maxDays));
}

// ─── Exported Functions ────────────────────────────────────────

/**
 * Calculate (or recalculate) the full health profile for a single connector.
 *
 * Aggregates run history, intelligence-object quality, and data freshness
 * into a composite 0–1 health score, then upserts the SourceHealth record.
 *
 * @param connectorId - The ID of the connector to evaluate
 * @returns The upserted SourceHealth record
 * @throws {Error} If the connector does not exist
 */
export async function calculateSourceHealth(connectorId: string) {
  const connector = await db.connector.findUnique({
    where: { id: connectorId },
    include: { runs: true, sourceHealth: true },
  });

  if (!connector) {
    throw new Error(`Connector with id "${connectorId}" not found`);
  }

  const runs = connector.runs;
  const totalRuns = runs.length;
  const completedRuns = runs.filter((r) => r.status === 'completed');
  const failedRuns = runs.filter((r) => r.status === 'failed');

  const totalSuccesses = completedRuns.length;
  const totalFailures = failedRuns.length;
  const successRate = totalRuns > 0 ? totalSuccesses / totalRuns : 1.0;

  const avgRecordsPerRun =
    completedRuns.length > 0
      ? completedRuns.reduce((sum, r) => sum + r.recordsAcquired, 0) /
        completedRuns.length
      : 0;

  // Runs are assumed returned in creation order (ascending).
  // Walk from the most recent (end of array) to count consecutive statuses.
  let consecutiveSuccesses = 0;
  let consecutiveFailures = 0;

  for (let i = runs.length - 1; i >= 0; i--) {
    if (runs[i].status === 'completed') {
      consecutiveSuccesses++;
    } else {
      break;
    }
  }

  for (let i = runs.length - 1; i >= 0; i--) {
    if (runs[i].status === 'failed') {
      consecutiveFailures++;
    } else {
      break;
    }
  }

  // Most recent completed / failed run timestamps
  const sortedCompleted = completedRuns
    .filter((r) => r.completedAt != null)
    .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime());
  const lastSuccessAt = sortedCompleted.length > 0 ? sortedCompleted[0].completedAt! : null;

  const sortedFailed = failedRuns
    .filter((r) => r.completedAt != null)
    .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime());
  const lastFailureAt = sortedFailed.length > 0 ? sortedFailed[0].completedAt! : null;

  // Quality score: average originalConfidence of IntelligenceObjects from this connector
  const objects = await db.intelligenceObject.findMany({
    where: { connectorId },
    select: { originalConfidence: true },
  });

  const qualityScore =
    objects.length > 0
      ? objects.reduce((sum, o) => sum + o.originalConfidence, 0) / objects.length
      : 0.5;

  // Freshness score: average freshness of the 10 most recent objects
  const recentObjects = await db.intelligenceObject.findMany({
    where: { connectorId },
    orderBy: { capturedAt: 'desc' },
    take: 10,
    select: { capturedAt: true },
  });

  const sourceType = connector.sourceType as string;
  const freshnessScore =
    recentObjects.length > 0
      ? recentObjects.reduce(
          (sum, o) => sum + calculateFreshness(o.capturedAt, sourceType),
          0
        ) / recentObjects.length
      : 1.0;

  // Composite health score
  const healthScore =
    successRate * 0.35 + qualityScore * 0.35 + freshnessScore * 0.3;

  const metrics = JSON.stringify({
    sourceReliability: SOURCE_RELIABILITY[sourceType as SourceType] ?? 0.7,
    objectCount: objects.length,
    recentObjectCount: recentObjects.length,
    calculatedAt: new Date().toISOString(),
  });

  // Upsert SourceHealth
  const sourceHealth = await db.sourceHealth.upsert({
    where: { connectorId },
    create: {
      connectorId,
      healthScore,
      successRate,
      avgRecordsPerRun,
      lastSuccessAt,
      lastFailureAt,
      consecutiveSuccesses,
      consecutiveFailures,
      totalRuns,
      totalSuccesses,
      totalFailures,
      qualityScore,
      freshnessScore,
      metrics,
    },
    update: {
      healthScore,
      successRate,
      avgRecordsPerRun,
      lastSuccessAt,
      lastFailureAt,
      consecutiveSuccesses,
      consecutiveFailures,
      totalRuns,
      totalSuccesses,
      totalFailures,
      qualityScore,
      freshnessScore,
      metrics,
    },
  });

  return sourceHealth;
}

/**
 * Retrieve all SourceHealth records, ordered worst-first (ascending healthScore).
 *
 * @returns Array of SourceHealth records sorted by healthScore ASC
 */
export async function getAllSourceHealth() {
  return db.sourceHealth.findMany({
    orderBy: { healthScore: 'asc' },
  });
}

/**
 * Retrieve the SourceHealth record for a specific connector.
 *
 * @param connectorId - The connector to look up
 * @returns The SourceHealth record, or null if none exists yet
 */
export async function getSourceHealth(connectorId: string) {
  return db.sourceHealth.findUnique({
    where: { connectorId },
  });
}

/**
 * Generate a full governance report aggregating health across all connectors.
 *
 * Computes totals, averages, health-tier breakdowns, stale-source rankings,
 * and conflict counts from IntelligenceAssociation records.
 *
 * @returns A structured GovernanceReport
 */
export async function getGovernanceReport(): Promise<GovernanceReport> {
  const allHealth = await db.sourceHealth.findMany({
    include: { connector: { select: { id: true, name: true, status: true, sourceType: true } } },
  });

  const totalConnectors = allHealth.length;
  const activeConnectors = allHealth.filter(
    (h) => h.connector.status === 'active'
  ).length;
  const degradedConnectors = allHealth.filter(
    (h) => h.healthScore < 0.6
  ).length;
  const failedConnectors = allHealth.filter(
    (h) => h.healthScore < 0.3
  ).length;

  const avgHealthScore =
    totalConnectors > 0
      ? allHealth.reduce((sum, h) => sum + h.healthScore, 0) / totalConnectors
      : 0;

  const connectorsByHealth = {
    healthy: allHealth.filter((h) => h.healthScore >= 0.7).length,
    warning: allHealth.filter(
      (h) => h.healthScore >= 0.4 && h.healthScore < 0.7
    ).length,
    critical: allHealth.filter((h) => h.healthScore < 0.4).length,
  };

  const topStaleSources = allHealth
    .filter((h) => h.freshnessScore < 0.5)
    .sort((a, b) => a.freshnessScore - b.freshnessScore)
    .slice(0, 5)
    .map((h) => ({
      connectorId: h.connector.id,
      connectorName: h.connector.name,
      freshnessScore: h.freshnessScore,
      healthScore: h.healthScore,
    }));

  const [totalAssociations, unresolvedConflicts] = await Promise.all([
    db.intelligenceAssociation.count(),
    db.intelligenceAssociation.count({
      where: {
        associationType: 'contradicts',
        resolved: false,
      },
    }),
  ]);

  return {
    totalConnectors,
    activeConnectors,
    degradedConnectors,
    failedConnectors,
    avgHealthScore,
    connectorsByHealth,
    topStaleSources,
    totalAssociations,
    unresolvedConflicts,
  };
}

/**
 * Flag and pause connectors whose data has gone excessively stale.
 *
 * Any connector with a freshnessScore below 0.3 that is currently active
 * will be transitioned to 'paused' status.
 *
 * @returns The count of flagged connectors and their details
 */
export async function flagStaleSources(): Promise<{
  flagged: number;
  details: Array<{ connectorId: string; connectorName: string; freshnessScore: number }>;
}> {
  const staleHealth = await db.sourceHealth.findMany({
    where: { freshnessScore: { lt: 0.3 } },
    include: { connector: { select: { id: true, name: true, status: true } } },
  });

  const toFlag = staleHealth.filter(
    (h) => h.connector.status === 'active'
  );

  const details = toFlag.map((h) => ({
    connectorId: h.connector.id,
    connectorName: h.connector.name,
    freshnessScore: h.freshnessScore,
  }));

  if (toFlag.length > 0) {
    await Promise.all(
      toFlag.map((h) =>
        db.connector.update({
          where: { id: h.connector.id },
          data: { status: 'paused' },
        })
      )
    );
  }

  return { flagged: toFlag.length, details };
}

/**
 * Recalculate health scores for every connector in the system.
 *
 * Iterates through all connectors and invokes {@link calculateSourceHealth}
 * for each one. Useful after bulk data imports or scheduled maintenance.
 *
 * @returns The number of connectors whose health was updated
 */
export async function recalculateAllHealth(): Promise<{ updated: number }> {
  const connectors = await db.connector.findMany({
    select: { id: true },
  });

  let updated = 0;
  for (const connector of connectors) {
    try {
      await calculateSourceHealth(connector.id);
      updated++;
    } catch {
      // Continue processing remaining connectors even if one fails
    }
  }

  return { updated };
}
