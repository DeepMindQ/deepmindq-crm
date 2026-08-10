/**
 * Consolidated Dashboard Queries
 *
 * Replaces multiple separate Prisma calls with fewer, combined raw SQL queries.
 * Each function is designed to be wrapped with `dashboardCache.cached()`
 * in the route handlers.
 *
 * Query reduction summary:
 *   dashboard/route.ts:      9 queries → 4 queries
 *   dashboard/stats/route.ts: 15 queries → 4 queries
 *   cro-dashboard/route.ts:   12 queries → 6 queries
 *
 * Uses `db.$queryRaw` with tagged template literals (safe from SQL injection).
 */

import { db } from '@/lib/db';

// ═══════════════════════════════════════════════════════════════════════════
// 1. Dashboard Main (/api/dashboard) — 9 queries → 4 queries
// ═══════════════════════════════════════════════════════════════════════════

export interface DashboardMetricsResult {
  contactsByStatus: Record<string, number>;
  emailHealthDistribution: Record<string, number>;
  totalCompanies: number;
  bouncesCount: number;
  suppressionsCount: number;
  draftsPendingReview: number;
  queuePending: number;
  repliesThisWeek: number;
  recentBatches: Array<{ id: string; fileName: string; totalRows: number; acceptedRows: number; status: string; createdAt: Date }>;
}

/**
 * Query 1 (was 2): contactsByStatus + emailHealthDistribution
 * Single raw query with UNION ALL on the Contact table.
 */
async function getContactGroupBy(): Promise<{
  contactsByStatus: Record<string, number>;
  emailHealthDistribution: Record<string, number>;
}> {
  const rows = await db.$queryRaw<Array<{ dimension: string; value: string; count: bigint }>>`
    SELECT 'status' as dimension, "status" as value, COUNT(*)::int as count
    FROM "Contact"
    GROUP BY "status"
    UNION ALL
    SELECT 'emailHealth' as dimension, "emailHealth" as value, COUNT(*)::int as count
    FROM "Contact"
    GROUP BY "emailHealth"
  `;

  const contactsByStatus: Record<string, number> = {};
  const emailHealthDistribution: Record<string, number> = {};

  for (const row of rows) {
    if (row.dimension === 'status') {
      contactsByStatus[row.value] = Number(row.count);
    } else {
      emailHealthDistribution[row.value] = Number(row.count);
    }
  }

  return { contactsByStatus, emailHealthDistribution };
}

/**
 * Query 2 (was 3): totalCompanies + bouncesCount + suppressionsCount
 * Single raw query with multiple COUNT columns.
 */
async function getMiscCounts(): Promise<{
  totalCompanies: number;
  bouncesCount: number;
  suppressionsCount: number;
}> {
  const [row] = await db.$queryRaw<Array<{
    totalCompanies: bigint;
    bouncesCount: bigint;
    suppressionsCount: bigint;
  }>>`
    SELECT
      (SELECT COUNT(*)::int FROM "Company") as "totalCompanies",
      (SELECT COUNT(*)::int FROM "Bounce") as "bouncesCount",
      (SELECT COUNT(*)::int FROM "Suppression") as "suppressionsCount"
  `;

  return {
    totalCompanies: Number(row.totalCompanies),
    bouncesCount: Number(row.bouncesCount),
    suppressionsCount: Number(row.suppressionsCount),
  };
}

/**
 * Query 3 (was 3): draftsPendingReview + queuePending + repliesThisWeek
 * Single raw query with conditional COUNT expressions.
 */
async function getOperationalCounts(): Promise<{
  draftsPendingReview: number;
  queuePending: number;
  repliesThisWeek: number;
}> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

  const [row] = await db.$queryRaw<Array<{
    draftsPendingReview: bigint;
    queuePending: bigint;
    repliesThisWeek: bigint;
  }>>`
    SELECT
      (SELECT COUNT(*)::int FROM "Draft" WHERE "status" = 'pending_review') as "draftsPendingReview",
      (SELECT COUNT(*)::int FROM "SendQueue" WHERE "status" IN ('pending', 'scheduled')) as "queuePending",
      (SELECT COUNT(*)::int FROM "Reply" WHERE "receivedAt" >= ${sevenDaysAgo.toISOString()}) as "repliesThisWeek"
  `;

  return {
    draftsPendingReview: Number(row.draftsPendingReview),
    queuePending: Number(row.queuePending),
    repliesThisWeek: Number(row.repliesThisWeek),
  };
}

/**
 * Query 4 (was 1): recentBatches — kept as Prisma query (different entity, needs specific select).
 */
async function getRecentBatches() {
  return db.importBatch.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
}

/**
 * Fetches all dashboard metrics with consolidated queries (4 DB queries instead of 9).
 * Designed to be wrapped with `dashboardCache.cached()`.
 */
export async function getDashboardMetrics(): Promise<DashboardMetricsResult> {
  const [contactGroupBy, miscCounts, operationalCounts, recentBatches] = await Promise.all([
    getContactGroupBy(),
    getMiscCounts(),
    getOperationalCounts(),
    getRecentBatches(),
  ]);

  return {
    ...contactGroupBy,
    ...miscCounts,
    ...operationalCounts,
    recentBatches: recentBatches.map(b => ({
      id: b.id,
      fileName: b.fileName,
      totalRows: b.totalRows,
      acceptedRows: b.acceptedRows,
      status: b.status,
      createdAt: b.createdAt,
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Dashboard Stats (/api/dashboard/stats) — 15 queries → 4 queries
// ═══════════════════════════════════════════════════════════════════════════

export interface DashboardStatsResult {
  companies: number;
  contacts: number;
  signals: number;
  insights: number;
  opportunities: number;
  risks: number;
  recommendations: number;
  avgIntelligenceScore: number;
  today: {
    newSignals: number;
    newOpportunities: number;
    newRisks: number;
    newRecommendations: number;
  };
  breakdown: {
    signalsByImpact: Record<string, number>;
    signalsByType: Record<string, number>;
    insightsByType: Record<string, number>;
  };
}

/**
 * Query 1 (was 8): All entity counts + avgIntelligenceScore
 * Companies, contacts, signals, insights, opportunities, risks, recommendations + avg score.
 */
async function getAllCounts(): Promise<{
  companies: number;
  contacts: number;
  signals: number;
  insights: number;
  opportunities: number;
  risks: number;
  recommendations: number;
  avgIntelligenceScore: number;
}> {
  const [row] = await db.$queryRaw<Array<{
    companies: bigint;
    contacts: bigint;
    signals: bigint;
    insights: bigint;
    opportunities: bigint;
    risks: bigint;
    recommendations: bigint;
    avgIntelligenceScore: number | null;
  }>>`
    SELECT
      (SELECT COUNT(*)::int FROM "Company" WHERE "status" != 'archived') as "companies",
      (SELECT COUNT(*)::int FROM "Contact" WHERE "status" != 'archived') as "contacts",
      (SELECT COUNT(*)::int FROM "CompanySignal" WHERE "status" NOT IN ('archived', 'expired')) as "signals",
      (SELECT COUNT(*)::int FROM "AIInsight" WHERE "status" = 'active') as "insights",
      (SELECT COUNT(*)::int FROM "OpportunityRecommendation" WHERE "status" != 'rejected') as "opportunities",
      (SELECT COUNT(*)::int FROM "CompanySignal"
        WHERE "severity" IN ('high', 'critical') AND "status" NOT IN ('archived', 'expired')) as "risks",
      (SELECT COUNT(*)::int FROM "AIInsight" WHERE "status" = 'active' AND "type" = 'RECOMMENDATION') as "recommendations",
      (SELECT AVG("intelligenceScore") FROM "Company" WHERE "status" != 'archived' AND "intelligenceScore" >= 0) as "avgIntelligenceScore"
  `;

  return {
    companies: Number(row.companies),
    contacts: Number(row.contacts),
    signals: Number(row.signals),
    insights: Number(row.insights),
    opportunities: Number(row.opportunities),
    risks: Number(row.risks),
    recommendations: Number(row.recommendations),
    avgIntelligenceScore: Math.round(row.avgIntelligenceScore ?? 0),
  };
}

/**
 * Query 2 (was 4): All "today" delta counts
 * newSignals, newOpportunities, newRisks, newRecommendations created since start of today.
 */
async function getTodayDeltas(startOfToday: Date): Promise<{
  newSignals: number;
  newOpportunities: number;
  newRisks: number;
  newRecommendations: number;
}> {
  const [row] = await db.$queryRaw<Array<{
    newSignals: bigint;
    newOpportunities: bigint;
    newRisks: bigint;
    newRecommendations: bigint;
  }>>`
    SELECT
      (SELECT COUNT(*)::int FROM "CompanySignal" WHERE "createdAt" >= ${startOfToday.toISOString()}) as "newSignals",
      (SELECT COUNT(*)::int FROM "OpportunityRecommendation" WHERE "createdAt" >= ${startOfToday.toISOString()}) as "newOpportunities",
      (SELECT COUNT(*)::int FROM "CompanySignal"
        WHERE "severity" IN ('high', 'critical') AND "createdAt" >= ${startOfToday.toISOString()}) as "newRisks",
      (SELECT COUNT(*)::int FROM "AIInsight"
        WHERE "status" = 'active' AND "type" = 'RECOMMENDATION' AND "createdAt" >= ${startOfToday.toISOString()}) as "newRecommendations"
  `;

  return {
    newSignals: Number(row.newSignals),
    newOpportunities: Number(row.newOpportunities),
    newRisks: Number(row.newRisks),
    newRecommendations: Number(row.newRecommendations),
  };
}

/**
 * Query 3 (was 2): signalsByImpact + signalsByType
 * Combined via UNION ALL on CompanySignal table.
 */
async function getSignalGroupBys(): Promise<{
  signalsByImpact: Record<string, number>;
  signalsByType: Record<string, number>;
}> {
  const rows = await db.$queryRaw<Array<{
    dimension: string;
    value: string;
    count: bigint;
  }>>`
    SELECT 'impact' as dimension, "impact" as value, COUNT(*)::int as count
    FROM "CompanySignal"
    WHERE "status" NOT IN ('archived', 'expired')
    GROUP BY "impact"
    UNION ALL
    SELECT 'signalType' as dimension, "signalType" as value, COUNT(*)::int as count
    FROM "CompanySignal"
    WHERE "status" NOT IN ('archived', 'expired')
    GROUP BY "signalType"
  `;

  const signalsByImpact: Record<string, number> = {};
  const signalsByType: Record<string, number> = {};

  for (const row of rows) {
    const record = row.dimension === 'impact' ? signalsByImpact : signalsByType;
    record[row.value] = Number(row.count);
  }

  return { signalsByImpact, signalsByType };
}

/**
 * Query 4 (was 1): insightsByType
 * Kept separate (different table from signals).
 */
async function getInsightGroupBys(): Promise<{
  insightsByType: Record<string, number>;
}> {
  const rows = await db.$queryRaw<Array<{
    type: string;
    count: bigint;
  }>>`
    SELECT "type", COUNT(*)::int as count
    FROM "AIInsight"
    WHERE "status" = 'active'
    GROUP BY "type"
  `;

  const insightsByType: Record<string, number> = {};
  for (const row of rows) {
    insightsByType[row.type] = Number(row.count);
  }

  return { insightsByType };
}

/**
 * Fetches all dashboard stats with consolidated queries (4 DB queries instead of 15).
 * Designed to be wrapped with `dashboardCache.cached()`.
 */
export async function getDashboardStats(): Promise<DashboardStatsResult> {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const [counts, today, signalGroupBys, insightGroupBys] = await Promise.all([
    getAllCounts(),
    getTodayDeltas(startOfToday),
    getSignalGroupBys(),
    getInsightGroupBys(),
  ]);

  return {
    ...counts,
    today,
    breakdown: {
      ...signalGroupBys,
      ...insightGroupBys,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. CRO Dashboard (/api/cro-dashboard) — 12 queries → 6 queries
// ═══════════════════════════════════════════════════════════════════════════

export interface CroDashboardAggResult {
  totalSignals: number;
  signalsLast30Days: number;
  companiesWithSignalsCount: number;
}

export interface CroCompanyCountsResult {
  totalCompanies: number;
  enrichedCompanies: number;
  companiesWithoutIndustry: number;
}

/**
 * Query (was 3): signal counts — totalSignals + signalsLast30Days + companiesWithSignals
 * Combined into a single raw query with conditional aggregation.
 */
export async function getCroSignalCounts(thirtyDaysAgo: Date): Promise<CroDashboardAggResult> {
  const [row] = await db.$queryRaw<Array<{
    totalSignals: bigint;
    signalsLast30Days: bigint;
    companiesWithSignalsCount: bigint;
  }>>`
    SELECT
      COUNT(*)::int as "totalSignals",
      COUNT(*) FILTER (WHERE "createdAt" >= ${thirtyDaysAgo.toISOString()})::int as "signalsLast30Days",
      COUNT(DISTINCT "companyId") FILTER (WHERE "createdAt" >= ${thirtyDaysAgo.toISOString()})::int as "companiesWithSignalsCount"
    FROM "CompanySignal"
  `;

  return {
    totalSignals: Number(row.totalSignals),
    signalsLast30Days: Number(row.signalsLast30Days),
    companiesWithSignalsCount: Number(row.companiesWithSignalsCount),
  };
}

/**
 * Query (was 3 + 1 duplicate): company counts — total + enriched + withoutIndustry
 * Also provides the totalCompany count needed for signalCoverage calculation.
 * Fixes the original code's bug of calling db.company.count() three separate times.
 */
export async function getCroCompanyCounts(): Promise<CroCompanyCountsResult> {
  const [row] = await db.$queryRaw<Array<{
    totalCompanies: bigint;
    enrichedCompanies: bigint;
    companiesWithoutIndustry: bigint;
  }>>`
    SELECT
      COUNT(*)::int as "totalCompanies",
      COUNT(*) FILTER (WHERE "intelligenceScore" >= 3)::int as "enrichedCompanies",
      COUNT(*) FILTER (WHERE "industry" IS NULL)::int as "companiesWithoutIndustry"
    FROM "Company"
  `;

  return {
    totalCompanies: Number(row.totalCompanies),
    enrichedCompanies: Number(row.enrichedCompanies),
    companiesWithoutIndustry: Number(row.companiesWithoutIndustry),
  };
}
