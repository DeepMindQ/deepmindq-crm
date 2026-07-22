/**
 * Phase 7.6: Opportunity Radar — Revenue Intelligence Layer
 *
 * Ranks accounts by composite signal strength, providing a
 * prioritised view of the most promising opportunities.
 * All scoring is deterministic; no LLM involvement.
 */

import { db } from '@/lib/db';
import { getTopOpportunities, type ScoredAccount } from './account-scoring';

// ─── Exported Interfaces ───────────────────────────────────────────────

/** A single account on the radar, enriched with signal data. */
export interface RadarAccount {
  companyId: string;
  companyName: string;
  industry: string | null;
  score: number;
  category: string;
  signalStrength: 'HIGH' | 'MEDIUM' | 'LOW';
  signalCounts: Record<string, number>;
  topSignals: Array<{ title: string; signalType: string; score: number }>;
  possibleOpportunity: string;
}

/** Paginated / filtered result returned by the radar. */
export interface OpportunityRadarResult {
  accounts: RadarAccount[];
  total: number;
}

/** Aggregate statistics across all signals in the system. */
export interface RadarStats {
  totalSignals: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  accountsWithSignals: number;
  avgScore: number;
  newLast7Days: number;
}

// ─── Internal Helpers ──────────────────────────────────────────────────

/**
 * Map a numeric score (0-100) to a signal-strength label.
 */
function scoreToStrength(score: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (score >= 70) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

/**
 * Derive a human-readable opportunity label from the dominant signal type.
 */
function opportunityFromSignalType(signalType: string): string {
  switch (signalType) {
    case 'technology':
      return 'AI/Data Transformation';
    case 'growth':
      return 'Growth Advisory';
    case 'leadership':
      return 'Executive Advisory';
    case 'partnership':
      return 'Ecosystem Integration';
    case 'pain':
      return 'Transformation Consulting';
    default:
      return 'General Engagement';
  }
}

/**
 * Given the aggregated signal counts, return the type with the highest count.
 * Tie-breaks by importance order: technology > pain > leadership > growth > partnership.
 */
function dominantSignalType(signalCounts: Record<string, number>): string {
  const importanceOrder = ['technology', 'pain', 'leadership', 'growth', 'partnership'];
  let maxCount = 0;
  let dominant = 'technology';
  for (const type of importanceOrder) {
    const count = signalCounts[type] ?? 0;
    if (count > maxCount) {
      maxCount = count;
      dominant = type;
    }
  }
  // If no recognised types have signals, fall back to the first key with a count
  if (maxCount === 0) {
    for (const [type, count] of Object.entries(signalCounts)) {
      if (count > 0) return type;
    }
  }
  return dominant;
}

// ─── Public API ────────────────────────────────────────────────────────

/**
 * Retrieve the opportunity radar: top-scored accounts ranked by signal
 * strength, with optional filtering and limit controls.
 *
 * @param options.minScore  Minimum account score to include (default 0)
 * @param options.signalTypes  Only include accounts that have at least one signal of these types
 * @param options.limit   Max accounts to return (default 50)
 */
export async function getOpportunityRadar(options?: {
  minScore?: number;
  signalTypes?: string[];
  limit?: number;
}): Promise<OpportunityRadarResult> {
  const minScore = options?.minScore ?? 0;
  const signalTypes = options?.signalTypes;
  const limit = options?.limit ?? 50;

  // 1. Pull top-scored accounts — request enough to allow for post-filtering
  const fetchLimit = signalTypes ? Math.max(limit * 3, 150) : limit;
  const scoredAccounts: ScoredAccount[] = await getTopOpportunities(fetchLimit);

  // 2. For each account, fetch its non-DISMISSED OpportunitySignal records
  const enriched: RadarAccount[] = [];

  for (const account of scoredAccounts) {
    // Apply minimum score filter early
    if (account.score < minScore) continue;

    const signals = await db.opportunitySignal.findMany({
      where: {
        companyId: account.companyId,
        status: { not: 'DISMISSED' },
      },
      orderBy: { score: 'desc' },
    });

    if (signals.length === 0) continue;

    // Count signals by type
    const signalCounts: Record<string, number> = {};
    for (const sig of signals) {
      signalCounts[sig.signalType] = (signalCounts[sig.signalType] ?? 0) + 1;
    }

    // Apply signal-type filter if provided
    if (signalTypes && signalTypes.length > 0) {
      const hasMatchingType = signalTypes.some((t) => (signalCounts[t] ?? 0) > 0);
      if (!hasMatchingType) continue;
    }

    // Top 3 signals by score
    const topSignals = signals.slice(0, 3).map((s) => ({
      title: s.title,
      signalType: s.signalType,
      score: s.score,
    }));

    const dominant = dominantSignalType(signalCounts);

    enriched.push({
      companyId: account.companyId,
      companyName: account.companyName,
      industry: account.industry ?? null,
      score: account.score,
      category: account.category,
      signalStrength: scoreToStrength(account.score),
      signalCounts,
      topSignals,
      possibleOpportunity: opportunityFromSignalType(dominant),
    });

    if (enriched.length >= limit) break;
  }

  // 3. Compute total count (all matching accounts, not capped by limit)
  const total = enriched.length < limit
    ? enriched.length
    : await countMatchingAccounts(minScore, signalTypes);

  return { accounts: enriched, total };
}

/**
 * Count total accounts matching the filter criteria (used when we hit the limit
 * and need to report the true total without fetching everything).
 */
async function countMatchingAccounts(
  minScore: number,
  signalTypes?: string[],
): Promise<number> {
  const where: Record<string, unknown> = {
    status: { not: 'DISMISSED' },
  };

  if (signalTypes && signalTypes.length > 0) {
    where.signalType = { in: signalTypes };
  }

  if (minScore > 0) {
    where.company = { accountScore: { score: { gte: minScore } } };
  }

  const matchingCompanyIds = await db.opportunitySignal.groupBy({
    by: ['companyId'],
    where,
  });

  return matchingCompanyIds.length;
}

/**
 * Retrieve aggregate statistics across all opportunity signals in the
 * system. Useful for dashboard widgets and executive summaries.
 */
export async function getRadarStats(): Promise<RadarStats> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Fire all independent queries in parallel
  const [
    allSignals,
    newLast7DaysResult,
    uniqueCompaniesResult,
    avgScoreResult,
  ] = await Promise.all([
    // All non-DISMISSED signals (lightweight select)
    db.opportunitySignal.findMany({
      where: { status: { not: 'DISMISSED' } },
      select: {
        status: true,
        signalType: true,
        score: true,
        companyId: true,
      },
    }),
    // New signals in the last 7 days
    db.opportunitySignal.count({
      where: {
        status: { not: 'DISMISSED' },
        createdAt: { gte: sevenDaysAgo },
      },
    }),
    // Distinct companies with signals
    db.opportunitySignal.groupBy({
      by: ['companyId'],
      where: { status: { not: 'DISMISSED' } },
    }),
    // Average score
    db.opportunitySignal.aggregate({
      where: { status: { not: 'DISMISSED' } },
      _avg: { score: true },
    }),
  ]);

  // Compute byStatus and byType counts
  const byStatus: Record<string, number> = {};
  const byType: Record<string, number> = {};

  for (const sig of allSignals) {
    byStatus[sig.status] = (byStatus[sig.status] ?? 0) + 1;
    byType[sig.signalType] = (byType[sig.signalType] ?? 0) + 1;
  }

  return {
    totalSignals: allSignals.length,
    byStatus,
    byType,
    accountsWithSignals: uniqueCompaniesResult.length,
    avgScore: avgScoreResult._avg.score ? Math.round(avgScoreResult._avg.score * 10) / 10 : 0,
    newLast7Days: newLast7DaysResult,
  };
}
