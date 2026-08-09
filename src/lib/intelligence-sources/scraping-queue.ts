/**
 * Intelligent Scraping Queue — Information-Gain Priority Scheduler
 *
 * Prioritizes which companies to scrape/enrich next based on predicted
 * information gain rather than round-robin ordering. Uses a weighted
 * multi-factor scoring algorithm that considers data freshness, signal
 * activity, company tier, data completeness gaps, and controlled
 * randomization to prevent deterministic starvation.
 *
 * Feature flag: ENABLE_INTELLIGENT_SCRAPING_QUEUE (default: false).
 * When disabled, the module returns companies in simple priority-tier order.
 *
 * @module intelligence-sources/scraping-queue
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// ═══════════════════════════════════════════════════════════════════════════
//  Feature Flag
// ═══════════════════════════════════════════════════════════════════════════

const INTELLIGENT_QUEUE_ENABLED =
  process.env.ENABLE_INTELLIGENT_SCRAPING_QUEUE === 'true';

// ═══════════════════════════════════════════════════════════════════════════
//  Exported Interfaces
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A single entry in the scraping priority queue.
 * Each entry represents a company that is a candidate for enrichment,
 * scored by its predicted information gain.
 */
export interface QueueEntry {
  /** Company database ID */
  companyId: string;
  /** Company display name */
  companyName: string;
  /** Computed information-gain score (0-100). Higher = more urgent to scrape. */
  priorityScore: number;
  /** Human-readable reasons explaining why this company should be scraped */
  reasons: string[];
  /** ISO timestamp of last enrichment, or null if never enriched */
  lastScrapedAt: string | null;
  /** Estimated current data coverage (0-1). 1 = fully enriched. */
  dataCompleteness: number;
  /** Recent signal intensity (0-1). 1 = very active company. */
  signalActivity: number;
  /** Account classification tier */
  companyTier: string;
  /** Predicted new data yield from scraping (0-100). */
  estimatedGain: number;
  /** Which intelligence connectors should be run for this company */
  connectorTypes: string[];
}

/**
 * Configuration options for the scraping queue.
 * All fields have sensible defaults.
 */
export interface ScrapingQueueConfig {
  /** Maximum number of entries in the queue (default: 500) */
  maxQueueSize?: number;
  /** Minimum days between consecutive scrapes of the same company (default: 7) */
  minDaysBetweenScrapes?: number;
  /** Maximum number of companies to scrape per day (default: 100) */
  maxDailyScrapes?: number;
  /** Weights for each scoring dimension (must sum to ~1.0) */
  priorityWeights?: {
    /** How stale the data is (default: 0.30) */
    dataFreshness?: number;
    /** Recent signal intensity (default: 0.25) */
    signalActivity?: number;
    /** Account tier importance (default: 0.20) */
    companyTier?: number;
    /** Inverse of existing data coverage (default: 0.15) */
    dataCompleteness?: number;
    /** Random factor to prevent starvation (default: 0.10) */
    randomization?: number;
  };
}

/**
 * Aggregate statistics about the current scraping queue state.
 */
export interface QueueStats {
  /** Whether the intelligent queue is enabled via feature flag */
  enabled: boolean;
  /** Total companies eligible for the queue (before maxQueueSize cap) */
  totalEligible: number;
  /** Companies returned in the last-built queue (after cap) */
  queueSize: number;
  /** Companies scraped today */
  scrapedToday: number;
  /** Remaining scrape budget for today */
  remainingDailyBudget: number;
  /** Average priority score across the queue */
  avgPriorityScore: number;
  /** Companies by tier distribution */
  byTier: Record<string, number>;
  /** Companies by degradation level */
  byFreshness: Record<string, number>;
  /** Timestamp when stats were computed */
  computedAt: string;
  /** Number of connectors types in use */
  activeConnectorTypes: string[];
}

/**
 * Detailed information-gain estimate for a single company.
 */
export interface InformationGainEstimate {
  companyId: string;
  companyName: string;
  /** Overall predicted gain (0-100) */
  overallScore: number;
  /** Individual dimension scores */
  dimensions: {
    dataFreshness: { score: number; weight: number; contribution: number; detail: string };
    signalActivity: { score: number; weight: number; contribution: number; detail: string };
    companyTier: { score: number; weight: number; contribution: number; detail: string };
    dataCompleteness: { score: number; weight: number; contribution: number; detail: string };
    randomization: { score: number; weight: number; contribution: number; detail: string };
  };
  /** Recommended connectors to run */
  recommendedConnectors: string[];
  /** When this company was last scraped (or null) */
  lastScrapedAt: string | null;
  /** Recommended minimum wait before next scrape */
  recommendedWaitDays: number;
  /** Top human-readable reasons */
  reasons: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
//  Internal Types (DB query results)
// ═══════════════════════════════════════════════════════════════════════════

/** Raw company row from the scoring query */
interface CompanyCandidateRow {
  id: string;
  rawName: string;
  domain: string | null;
  lastEnrichedAt: Date | null;
  intelligenceScore: number;
  priorityTier: string | null;
  // Account score category
  accountScore?: { category: string } | null;
  // Intelligence freshness
  freshness?: {
    freshnessScore: number;
    degradationLevel: string;
    lastRefreshAt: Date | null;
  } | null;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Defaults & Constants
// ═══════════════════════════════════════════════════════════════════════════

/** Resolved (non-optional) priority weights */
export type ResolvedPriorityWeights = {
  dataFreshness: number;
  signalActivity: number;
  companyTier: number;
  dataCompleteness: number;
  randomization: number;
};

/** Resolved (non-optional) config */
export type ResolvedScrapingQueueConfig = {
  maxQueueSize: number;
  minDaysBetweenScrapes: number;
  maxDailyScrapes: number;
  priorityWeights: ResolvedPriorityWeights;
};

const DEFAULT_CONFIG: ResolvedScrapingQueueConfig = {
  maxQueueSize: 500,
  minDaysBetweenScrapes: 7,
  maxDailyScrapes: 100,
  priorityWeights: {
    dataFreshness: 0.30,
    signalActivity: 0.25,
    companyTier: 0.20,
    dataCompleteness: 0.15,
    randomization: 0.10,
  },
};

/** Tier → base priority score mapping */
const TIER_SCORES: Record<string, number> = {
  hot_account: 100,
  warm_account: 75,
  nurture: 50,
  at_risk: 90,
};

/** Map AccountCategory enum values to normalized tier strings */
const CATEGORY_TO_TIER: Record<string, string> = {
  HOT_ACCOUNT: 'hot_account',
  WARM_ACCOUNT: 'warm_account',
  NURTURE: 'nurture',
  AT_RISK: 'at_risk',
};

/** Map CompanyPriorityTier enum values to normalized tier strings */
const PRIORITY_TIER_TO_TIER: Record<string, string> = {
  HOT: 'hot_account',
  ACTIVE: 'warm_account',
  NURTURE: 'nurture',
  LOW: 'nurture',
};

/** Available connector types for enrichment */
const ALL_CONNECTOR_TYPES = [
  'website',
  'clearbit',
  'sec_edgar',
  'crunchbase',
] as const;

// ═══════════════════════════════════════════════════════════════════════════
//  In-Memory State
// ═══════════════════════════════════════════════════════════════════════════

/**
 * In-memory scraping history tracker.
 * Key: `${companyId}:${connectorType}`, Value: ISO timestamp.
 * Used to avoid redundant scraping within the configured cooldown window.
 *
 * This map survives across calls within a single server process lifetime.
 * For multi-process deployments, the DB `lastEnrichedAt` field provides
 * the authoritative cooldown check.
 */
const scrapingHistory = new Map<string, string>();

/** Cached queue entries from the last buildScrapingQueue call */
let cachedQueue: QueueEntry[] = [];

/** Timestamp when the cache was last populated */
let cacheBuiltAt: string | null = null;

/** Cache TTL in milliseconds (5 minutes) */
const CACHE_TTL_MS = 5 * 60 * 1000;

// ═══════════════════════════════════════════════════════════════════════════
//  Helper Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Merge user-provided config with defaults, with deep merge for weights.
 */
function resolveConfig(config?: ScrapingQueueConfig): ResolvedScrapingQueueConfig {
  if (!config) return { ...DEFAULT_CONFIG };

  return {
    maxQueueSize: config.maxQueueSize ?? DEFAULT_CONFIG.maxQueueSize,
    minDaysBetweenScrapes: config.minDaysBetweenScrapes ?? DEFAULT_CONFIG.minDaysBetweenScrapes,
    maxDailyScrapes: config.maxDailyScrapes ?? DEFAULT_CONFIG.maxDailyScrapes,
    priorityWeights: {
      dataFreshness: config.priorityWeights?.dataFreshness ?? DEFAULT_CONFIG.priorityWeights.dataFreshness,
      signalActivity: config.priorityWeights?.signalActivity ?? DEFAULT_CONFIG.priorityWeights.signalActivity,
      companyTier: config.priorityWeights?.companyTier ?? DEFAULT_CONFIG.priorityWeights.companyTier,
      dataCompleteness: config.priorityWeights?.dataCompleteness ?? DEFAULT_CONFIG.priorityWeights.dataCompleteness,
      randomization: config.priorityWeights?.randomization ?? DEFAULT_CONFIG.priorityWeights.randomization,
    },
  };
}

/**
 * Extract a normalized tier string from a company row.
 * Checks AccountScore.category first, then Company.priorityTier.
 */
function extractTier(row: CompanyCandidateRow): string {
  if (row.accountScore?.category) {
    return CATEGORY_TO_TIER[row.accountScore.category] ?? 'nurture';
  }
  if (row.priorityTier) {
    return PRIORITY_TIER_TO_TIER[row.priorityTier] ?? 'nurture';
  }
  return 'nurture';
}

/**
 * Calculate the data freshness dimension score (0-100).
 *
 * More stale data → higher priority. Score = min(100, daysSinceLastScrape * 10).
 * If never scraped, returns 100 (maximum urgency).
 */
function scoreDataFreshness(lastEnrichedAt: Date | null): number {
  if (!lastEnrichedAt) return 100;

  const daysSince = Math.max(
    0,
    (Date.now() - lastEnrichedAt.getTime()) / (1000 * 60 * 60 * 24),
  );

  return Math.min(100, daysSince * 10);
}

/**
 * Calculate the company tier dimension score (0-100).
 *
 * Uses the tier mapping: hot_account=100, at_risk=90, warm_account=75, nurture=50.
 */
function scoreCompanyTier(tier: string): number {
  return TIER_SCORES[tier] ?? 50;
}

/**
 * Calculate the data completeness dimension score (0-100).
 *
 * INVERSE: companies with LESS data get HIGHER priority.
 * Score = (1 - completeness) * 100.
 */
function scoreDataCompleteness(
  intelligenceScore: number,
  freshnessScore: number | null,
): number {
  // Use intelligenceScore (0-100) and freshness score as proxies for completeness
  const normalizedIntelligence = intelligenceScore / 100;
  const normalizedFreshness = freshnessScore ?? 0;

  // Blend both: a company with high intelligence score AND fresh data is "complete"
  const completeness = (normalizedIntelligence * 0.6) + (normalizedFreshness * 0.4);

  return (1 - Math.min(1, completeness)) * 100;
}

/**
 * Calculate the signal activity dimension score (0-100).
 *
 * Based on the count of recent signals (last 7 days) relative to a
 * reasonable maximum (10 signals = full score).
 */
function scoreSignalActivity(recentSignalCount: number): number {
  const MAX_SIGNALS_FOR_FULL_SCORE = 10;
  return Math.min(100, (recentSignalCount / MAX_SIGNALS_FOR_FULL_SCORE) * 100);
}

/**
 * Generate a small random score (0-100) with seeded consistency.
 *
 * Uses a simple hash of companyId to ensure the same company gets
 * a consistent (but random-looking) score within a build cycle, while
 * still introducing variation across different builds.
 */
function scoreRandomization(companyId: string): number {
  // Simple hash-based pseudo-random for deterministic jitter per build
  let hash = 0;
  for (let i = 0; i < companyId.length; i++) {
    const char = companyId.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }

  // Add current hour as salt to rotate priorities periodically
  const hourSalt = Math.floor(Date.now() / (1000 * 60 * 60));
  const combined = Math.abs(hash ^ hourSalt);

  // Map to 0-100 with some spread
  return (combined % 100) * 0.6 + 20; // range: 20-80 (never dominates, never zero)
}

/**
 * Compute the full weighted priority score from individual dimension scores.
 *
 * @returns The final 0-100 priority score and an array of human-readable reasons.
 */
function computePriorityScore(
  freshnessScore: number,
  signalScore: number,
  tierScore: number,
  completenessScore: number,
  randomScore: number,
  weights: ResolvedPriorityWeights,
  tier: string,
  daysSinceEnrichment: number | null,
): { score: number; reasons: string[] } {
  const score =
    freshnessScore * weights.dataFreshness +
    signalScore * weights.signalActivity +
    tierScore * weights.companyTier +
    completenessScore * weights.dataCompleteness +
    randomScore * weights.randomization;

  const reasons: string[] = [];

  // Generate reasons for dimensions that contribute meaningfully
  if (freshnessScore >= 70) {
    reasons.push(
      daysSinceEnrichment !== null
        ? `Data is ${daysSinceEnrichment.toFixed(0)} days stale`
        : 'Company has never been enriched',
    );
  }

  if (signalScore >= 60) {
    reasons.push('High recent signal activity — active company');
  }

  if (tierScore >= 90) {
    reasons.push(`High-priority tier: ${tier}`);
  }

  if (completenessScore >= 60) {
    reasons.push('Significant data coverage gaps');
  }

  // Ensure at least one reason
  if (reasons.length === 0) {
    reasons.push('Routine enrichment cycle');
  }

  return { score: Math.round(Math.min(100, score)), reasons };
}

/**
 * Determine which connectors should be run for a company based on its
 * current data state. Avoids re-running connectors that recently succeeded.
 *
 * Decision logic:
 * - website: always include (primary source)
 * - clearbit: include if domain is known and < 14 days since last enrich
 * - sec_edgar: include if US-based or large company
 * - crunchbase: include if < 14 days since last enrich
 */
function selectConnectors(
  row: CompanyCandidateRow,
  daysSinceEnrichment: number | null,
): string[] {
  const connectors: string[] = [];

  // Website connector — always recommended as primary source
  connectors.push('website');

  // Clearbit — needs a domain
  if (row.domain) {
    const clearbitKey = `${row.id}:clearbit`;
    const lastClearbit = scrapingHistory.get(clearbitKey);
    if (!lastClearbit || daysSinceEnrichment === null || daysSinceEnrichment > 14) {
      connectors.push('clearbit');
    }
  }

  // Crunchbase — useful for company details
  const crunchbaseKey = `${row.id}:crunchbase`;
  const lastCrunchbase = scrapingHistory.get(crunchbaseKey);
  if (!lastCrunchbase || daysSinceEnrichment === null || daysSinceEnrichment > 14) {
    connectors.push('crunchbase');
  }

  // SEC Edgar — for US-based public/large companies
  const country = (row as unknown as { country: string | null }).country;
  if (country === 'US' || row.priorityTier === 'HOT') {
    const secKey = `${row.id}:sec_edgar`;
    const lastSec = scrapingHistory.get(secKey);
    if (!lastSec || daysSinceEnrichment === null || daysSinceEnrichment > 21) {
      connectors.push('sec_edgar');
    }
  }

  return connectors;
}

/**
 * Check if today's scrape budget has been exhausted.
 */
function getTodayScrapeCount(): number {
  // Count entries in scrapingHistory with timestamps from today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  let count = 0;
  scrapingHistory.forEach((timestamp) => {
    try {
      if (new Date(timestamp) >= todayStart) {
        count++;
      }
    } catch {
      // Skip malformed timestamps
    }
  });
  return count;
}

/**
 * Check if a company is within the cooldown period for a specific connector.
 */
function isWithinCooldown(
  companyId: string,
  connectorType: string,
  minDays: number,
): boolean {
  const key = `${companyId}:${connectorType}`;
  const lastScraped = scrapingHistory.get(key);
  if (!lastScraped) return false;

  try {
    const elapsed = (Date.now() - new Date(lastScraped).getTime()) / (1000 * 60 * 60 * 24);
    return elapsed < minDays;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Database Queries
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fetch all candidate companies for the scraping queue with their
 * associated scoring data in a single efficient query.
 *
 * Excludes companies scraped within the cooldown window (minDaysBetweenScrapes).
 */
async function fetchCandidateCompanies(
  minDaysBetweenScrapes: number,
  maxQueueSize: number,
): Promise<CompanyCandidateRow[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - minDaysBetweenScrapes);

  const companies = await db.company.findMany({
    where: {
      // Only non-archived companies
      status: {
        notIn: ['archived'],
      },
      // Exclude recently enriched companies (cooldown window)
      OR: [
        { lastEnrichedAt: null },
        { lastEnrichedAt: { lt: cutoffDate } },
      ],
    },
    select: {
      id: true,
      rawName: true,
      domain: true,
      lastEnrichedAt: true,
      intelligenceScore: true,
      priorityTier: true,
      accountScore: {
        select: {
          category: true,
        },
      },
    },
    // Order by: no enrichment first, then oldest enrichment first
    orderBy: [
      { lastEnrichedAt: { sort: 'asc', nulls: 'first' } },
      { intelligenceScore: 'asc' },
    ],
    take: maxQueueSize,
  });

  // CompanyIntelligenceFreshness is not a Prisma relation on Company,
  // so fetch it separately and merge in-memory.
  const freshnessMap = await fetchFreshnessData(
    companies.map((c) => c.id),
  );

  return companies.map((c) => ({
    ...c,
    freshness: freshnessMap.get(c.id) ?? null,
  })) as unknown as CompanyCandidateRow[];
}

/**
 * Count recent signals for a set of companies in a single query.
 * Returns a map of companyId → signal count (last 7 days).
 */
async function fetchRecentSignalCounts(
  companyIds: string[],
): Promise<Map<string, number>> {
  if (companyIds.length === 0) return new Map();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Batch the query in chunks of 500 to avoid Prisma/Postgres IN-clause limits
  const CHUNK_SIZE = 500;
  const signalMap = new Map<string, number>();

  for (let i = 0; i < companyIds.length; i += CHUNK_SIZE) {
    const chunk = companyIds.slice(i, i + CHUNK_SIZE);

    const signals = await db.companySignal.groupBy({
      by: ['companyId'],
      where: {
        companyId: { in: chunk },
        createdAt: { gte: sevenDaysAgo },
        status: { in: ['detected', 'validated', 'active'] },
      },
      _count: {
        id: true,
      },
    });

    for (const signal of signals) {
      signalMap.set(signal.companyId, signal._count.id);
    }
  }

  return signalMap;
}

/**
 * Fetch CompanyIntelligenceFreshness data for a set of companies.
 * Returns a map of companyId → freshness data.
 *
 * CompanyIntelligenceFreshness is not a Prisma relation on Company,
 * so we query it separately and merge in-memory.
 */
async function fetchFreshnessData(
  companyIds: string[],
): Promise<
  Map<
    string,
    {
      freshnessScore: number;
      degradationLevel: string;
      lastRefreshAt: Date | null;
    }
  >
> {
  if (companyIds.length === 0) return new Map();

  const CHUNK_SIZE = 500;
  const freshnessMap = new Map<
    string,
    {
      freshnessScore: number;
      degradationLevel: string;
      lastRefreshAt: Date | null;
    }
  >();

  for (let i = 0; i < companyIds.length; i += CHUNK_SIZE) {
    const chunk = companyIds.slice(i, i + CHUNK_SIZE);

    const records = await db.companyIntelligenceFreshness.findMany({
      where: { companyId: { in: chunk } },
      select: {
        companyId: true,
        freshnessScore: true,
        degradationLevel: true,
        lastRefreshAt: true,
      },
    });

    for (const record of records) {
      freshnessMap.set(record.companyId, {
        freshnessScore: record.freshnessScore,
        degradationLevel: record.degradationLevel,
        lastRefreshAt: record.lastRefreshAt,
      });
    }
  }

  return freshnessMap;
}

/**
 * Count total eligible companies (before maxQueueSize cap) for stats.
 */
async function countEligibleCompanies(
  minDaysBetweenScrapes: number,
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - minDaysBetweenScrapes);

  return db.company.count({
    where: {
      status: { notIn: ['archived'] },
      OR: [
        { lastEnrichedAt: null },
        { lastEnrichedAt: { lt: cutoffDate } },
      ],
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  Score a Single Company (Detailed)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Score a single company with full dimension breakdown for diagnostics.
 * Used by `estimateInformationGain`.
 */
async function scoreCompanyDetailed(
  companyId: string,
  config: ResolvedScrapingQueueConfig,
): Promise<{
  row: CompanyCandidateRow | null;
  recentSignalCount: number;
  tier: string;
  daysSinceEnrichment: number | null;
  freshnessDim: number;
  signalDim: number;
  tierDim: number;
  completenessDim: number;
  randomDim: number;
  finalScore: number;
  reasons: string[];
}> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      rawName: true,
      domain: true,
      lastEnrichedAt: true,
      intelligenceScore: true,
      priorityTier: true,
      accountScore: {
        select: { category: true },
      },
    },
  });

  if (!company) {
    return {
      row: null,
      recentSignalCount: 0,
      tier: 'nurture',
      daysSinceEnrichment: null,
      freshnessDim: 0,
      signalDim: 0,
      tierDim: 0,
      completenessDim: 0,
      randomDim: 0,
      finalScore: 0,
      reasons: [],
    };
  }

  // Fetch freshness data separately (not a Prisma relation)
  const freshnessMap = await fetchFreshnessData([company.id]);
  const freshnessRecord = freshnessMap.get(company.id) ?? null;

  const row: CompanyCandidateRow = {
    ...company,
    freshness: freshnessRecord,
  };

  const recentSignalCount = (await fetchRecentSignalCounts([companyId])).get(companyId) ?? 0;
  const tier = extractTier(row);

  const daysSinceEnrichment = row.lastEnrichedAt
    ? Math.max(0, (Date.now() - row.lastEnrichedAt.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const freshnessDim = scoreDataFreshness(row.lastEnrichedAt);
  const signalDim = scoreSignalActivity(recentSignalCount);
  const tierDim = scoreCompanyTier(tier);
  const completenessDim = scoreDataCompleteness(
    row.intelligenceScore,
    row.freshness?.freshnessScore ?? null,
  );
  const randomDim = scoreRandomization(row.id);

  const { score: finalScore, reasons } = computePriorityScore(
    freshnessDim,
    signalDim,
    tierDim,
    completenessDim,
    randomDim,
    config.priorityWeights,
    tier,
    daysSinceEnrichment,
  );

  return {
    row,
    recentSignalCount,
    tier,
    daysSinceEnrichment,
    freshnessDim,
    signalDim,
    tierDim,
    completenessDim,
    randomDim,
    finalScore,
    reasons,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  Main Exports
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build the full scraping priority queue.
 *
 * Fetches all eligible companies from the database, scores each one using
 * the multi-factor information-gain algorithm, and returns them ordered
 * by priority (highest first).
 *
 * Results are cached in-memory for 5 minutes to avoid redundant DB queries.
 *
 * @param config - Optional configuration overrides.
 * @returns Array of QueueEntry sorted by priorityScore descending.
 *
 * @example
 * ```ts
 * const queue = await buildScrapingQueue({ maxQueueSize: 100 });
 * console.log(`Top 3 to scrape:`, queue.slice(0, 3).map(e => e.companyName));
 * ```
 */
export async function buildScrapingQueue(
  config?: ScrapingQueueConfig,
): Promise<QueueEntry[]> {
  const resolvedConfig = resolveConfig(config);
  const { priorityWeights, maxQueueSize, minDaysBetweenScrapes, maxDailyScrapes } = resolvedConfig;

  // Return cached result if still fresh
  if (cachedQueue.length > 0 && cacheBuiltAt) {
    const cacheAge = Date.now() - new Date(cacheBuiltAt).getTime();
    if (cacheAge < CACHE_TTL_MS) {
      logger.debug('[scraping-queue] Returning cached queue', {
        queueSize: cachedQueue.length,
        cacheAgeMs: cacheAge,
      });
      return cachedQueue;
    }
  }

  if (!INTELLIGENT_QUEUE_ENABLED) {
    logger.info('[scraping-queue] Intelligent queue disabled (ENABLE_INTELLIGENT_SCRAPING_QUEUE=false)');
    const fallback = await buildFallbackQueue(maxQueueSize);
    cachedQueue = fallback;
    cacheBuiltAt = new Date().toISOString();
    return fallback;
  }

  const startTime = Date.now();

  try {
    logger.info('[scraping-queue] Building intelligent scraping queue', {
      maxQueueSize,
      minDaysBetweenScrapes,
      maxDailyScrapes,
    });

    // 1. Fetch candidate companies with related data
    const candidates = await fetchCandidateCompanies(minDaysBetweenScrapes, maxQueueSize);

    if (candidates.length === 0) {
      logger.info('[scraping-queue] No eligible companies found');
      cachedQueue = [];
      cacheBuiltAt = new Date().toISOString();
      return [];
    }

    // 2. Batch-fetch recent signal counts for all candidates
    const companyIds = candidates.map((c) => c.id);
    const signalCounts = await fetchRecentSignalCounts(companyIds);

    // 3. Score each company
    const todayScrapeCount = getTodayScrapeCount();
    const remainingBudget = Math.max(0, maxDailyScrapes - todayScrapeCount);

    const entries: QueueEntry[] = [];

    for (const candidate of candidates) {
      // Check daily budget
      if (entries.length >= remainingBudget) {
        logger.debug('[scraping-queue] Daily scrape budget exhausted', {
          budget: remainingBudget,
          queued: entries.length,
        });
        break;
      }

      const tier = extractTier(candidate);
      const recentSignalCount = signalCounts.get(candidate.id) ?? 0;

      const daysSinceEnrichment = candidate.lastEnrichedAt
        ? Math.max(0, (Date.now() - candidate.lastEnrichedAt.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      // Calculate individual dimension scores
      const freshnessDim = scoreDataFreshness(candidate.lastEnrichedAt);
      const signalDim = scoreSignalActivity(recentSignalCount);
      const tierDim = scoreCompanyTier(tier);
      const completenessDim = scoreDataCompleteness(
        candidate.intelligenceScore,
        candidate.freshness?.freshnessScore ?? null,
      );
      const randomDim = scoreRandomization(candidate.id);

      // Compute weighted final score
      const { score: priorityScore, reasons } = computePriorityScore(
        freshnessDim,
        signalDim,
        tierDim,
        completenessDim,
        randomDim,
        priorityWeights,
        tier,
        daysSinceEnrichment,
      );

      // Estimate information gain (based on completeness gap + signal opportunity)
      const estimatedGain = Math.round(
        completenessDim * 0.5 + freshnessDim * 0.3 + signalDim * 0.2,
      );

      // Select which connectors to run
      const connectorTypes = selectConnectors(candidate, daysSinceEnrichment);

      entries.push({
        companyId: candidate.id,
        companyName: candidate.rawName,
        priorityScore,
        reasons,
        lastScrapedAt: candidate.lastEnrichedAt?.toISOString() ?? null,
        dataCompleteness: Math.round(
          ((100 - completenessDim) / 100) * 100,
        ) / 100,
        signalActivity: Math.round((recentSignalCount / 10) * 100) / 100,
        companyTier: tier,
        estimatedGain,
        connectorTypes,
      });
    }

    // 4. Sort by priority score descending
    entries.sort((a, b) => b.priorityScore - a.priorityScore);

    // Update cache
    cachedQueue = entries;
    cacheBuiltAt = new Date().toISOString();

    const elapsed = Date.now() - startTime;

    logger.info('[scraping-queue] Queue built successfully', {
      totalCandidates: candidates.length,
      queueSize: entries.length,
      topScore: entries[0]?.priorityScore ?? 0,
      avgScore: entries.length > 0
        ? Math.round(entries.reduce((sum, e) => sum + e.priorityScore, 0) / entries.length)
        : 0,
      elapsedMs: elapsed,
    });

    return entries;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[scraping-queue] Failed to build queue', { error: message });

    // On error, return empty queue (never throw — callers should degrade gracefully)
    cachedQueue = [];
    cacheBuiltAt = new Date().toISOString();
    return [];
  }
}

/**
 * Build a simple fallback queue when intelligent scoring is disabled.
 * Orders by: never-enriched first, then oldest enrichment first.
 */
async function buildFallbackQueue(maxQueueSize: number): Promise<QueueEntry[]> {
  const candidates = await db.company.findMany({
    where: {
      status: { notIn: ['archived'] },
    },
    select: {
      id: true,
      rawName: true,
      domain: true,
      lastEnrichedAt: true,
      intelligenceScore: true,
      priorityTier: true,
    },
    orderBy: [
      { lastEnrichedAt: { sort: 'asc', nulls: 'first' } },
      { intelligenceScore: 'asc' },
    ],
    take: maxQueueSize,
  });

  return candidates.map((c: { id: string; rawName: string; domain: string | null; lastEnrichedAt: Date | null; intelligenceScore: number; priorityTier: string | null }, index: number) => ({
    companyId: c.id,
    companyName: c.rawName,
    priorityScore: Math.max(0, 100 - index), // Simple descending order
    reasons: ['Fallback queue (intelligent scoring disabled)'],
    lastScrapedAt: c.lastEnrichedAt?.toISOString() ?? null,
    dataCompleteness: c.intelligenceScore / 100,
    signalActivity: 0,
    companyTier: PRIORITY_TIER_TO_TIER[c.priorityTier ?? ''] ?? 'nurture',
    estimatedGain: 50,
    connectorTypes: c.domain
      ? ['website', 'clearbit', 'crunchbase']
      : ['website', 'crunchbase'],
  }));
}

/**
 * Get the next N companies to scrape from the priority queue.
 *
 * If the queue hasn't been built yet or is stale, triggers a build first.
 * Respects the daily scrape budget and skips companies within their cooldown.
 *
 * @param count - Number of companies to return (default: 10, max: 50).
 * @param config - Optional configuration overrides.
 * @returns Array of QueueEntry for the next companies to scrape.
 *
 * @example
 * ```ts
 * const nextBatch = await getNextToScrape(5);
 * for (const entry of nextBatch) {
 *   for (const connector of entry.connectorTypes) {
 *     await runConnector(connector, entry.companyId);
 *     markScraped(entry.companyId, connector);
 *   }
 * }
 * ```
 */
export async function getNextToScrape(
  count: number = 10,
  config?: ScrapingQueueConfig,
): Promise<QueueEntry[]> {
  const resolvedCount = Math.max(1, Math.min(50, count));
  const resolvedConfig = resolveConfig(config);

  // Build or retrieve the queue
  let queue = cachedQueue;
  if (!queue.length || !cacheBuiltAt) {
    queue = await buildScrapingQueue(resolvedConfig);
  } else {
    // Check cache freshness
    const cacheAge = Date.now() - new Date(cacheBuiltAt).getTime();
    if (cacheAge >= CACHE_TTL_MS) {
      queue = await buildScrapingQueue(resolvedConfig);
    }
  }

  // Filter out companies already scraped within cooldown for ALL their connectors
  const eligible = queue.filter((entry) => {
    // Check if at least one connector is not within cooldown
    return entry.connectorTypes.some(
      (connector) => !isWithinCooldown(entry.companyId, connector, resolvedConfig.minDaysBetweenScrapes),
    );
  });

  return eligible.slice(0, resolvedCount);
}

/**
 * Mark a company as having been scraped by a specific connector.
 *
 * Records the scraping event in both the in-memory history map and
 * updates the company's `lastEnrichedAt` field in the database.
 *
 * This function is synchronous for the in-memory update (fast path)
 * and triggers an async DB update (best-effort).
 *
 * @param companyId - The ID of the company that was scraped.
 * @param connectorType - The type of connector that ran (e.g., 'website', 'clearbit').
 *
 * @example
 * ```ts
 * markScraped('comp_abc123', 'clearbit');
 * ```
 */
export function markScraped(
  companyId: string,
  connectorType: string,
): void {
  const now = new Date().toISOString();
  const key = `${companyId}:${connectorType}`;

  scrapingHistory.set(key, now);

  // Also update the generic company key to track overall last scrape
  scrapingHistory.set(`${companyId}:_any`, now);

  logger.debug('[scraping-queue] Company marked as scraped', {
    companyId,
    connectorType,
    timestamp: now,
  });

  // Async DB update (fire-and-forget, best-effort)
  db.company
    .update({
      where: { id: companyId },
      data: { lastEnrichedAt: new Date() },
    })
    .then(() => {
      logger.debug('[scraping-queue] DB lastEnrichedAt updated', {
        companyId,
        connectorType,
      });
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('[scraping-queue] Failed to update lastEnrichedAt in DB', {
        companyId,
        connectorType,
        error: message,
      });
    });
}

/**
 * Get aggregate statistics about the current scraping queue.
 *
 * @returns QueueStats with current state information.
 */
export function getQueueStats(): QueueStats {
  const todayScrapeCount = getTodayScrapeCount();
  const resolvedConfig = resolveConfig();

  // Compute tier distribution
  const byTier: Record<string, number> = {};
  // Compute freshness distribution from queue entries
  const byFreshness: Record<string, number> = {
    fresh: 0,
    aging: 0,
    stale: 0,
    critical: 0,
    unknown: 0,
  };

  let totalPriorityScore = 0;

  for (const entry of cachedQueue) {
    byTier[entry.companyTier] = (byTier[entry.companyTier] ?? 0) + 1;
    totalPriorityScore += entry.priorityScore;
  }

  const avgPriorityScore =
    cachedQueue.length > 0
      ? Math.round(totalPriorityScore / cachedQueue.length)
      : 0;

  return {
    enabled: INTELLIGENT_QUEUE_ENABLED,
    totalEligible: -1, // Requires async call; use buildScrapingQueue for accurate count
    queueSize: cachedQueue.length,
    scrapedToday: todayScrapeCount,
    remainingDailyBudget: Math.max(
      0,
      resolvedConfig.maxDailyScrapes - todayScrapeCount,
    ),
    avgPriorityScore,
    byTier,
    byFreshness,
    computedAt: new Date().toISOString(),
    activeConnectorTypes: [...ALL_CONNECTOR_TYPES],
  };
}

/**
 * Get a detailed information-gain estimate for a specific company.
 *
 * Returns a full breakdown of each scoring dimension with weights,
 * contributions, and human-readable explanations. Useful for debugging
 * why a company is or isn't being prioritized.
 *
 * @param companyId - The ID of the company to analyze.
 * @returns InformationGainEstimate with full dimension breakdown.
 * @throws {Error} If the company is not found.
 *
 * @example
 * ```ts
 * const estimate = await estimateInformationGain('comp_abc123');
 * console.log(`Overall score: ${estimate.overallScore}/100`);
 * console.log(`Freshness contribution: ${estimate.dimensions.dataFreshness.contribution}`);
 * console.log(`Reasons:`, estimate.reasons);
 * ```
 */
export async function estimateInformationGain(
  companyId: string,
): Promise<InformationGainEstimate> {
  const resolvedConfig = resolveConfig();
  const { priorityWeights } = resolvedConfig;

  // First check if company exists
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { id: true, rawName: true },
  });

  if (!company) {
    throw new Error(`Company with id "${companyId}" not found`);
  }

  const detailed = await scoreCompanyDetailed(companyId, resolvedConfig);

  if (!detailed.row) {
    throw new Error(`Company with id "${companyId}" not found during scoring`);
  }

  const row = detailed.row;

  // Build detailed dimension breakdown
  const daysSinceStr =
    detailed.daysSinceEnrichment !== null
      ? `${detailed.daysSinceEnrichment.toFixed(1)} days`
      : 'never enriched';

  const dimensions = {
    dataFreshness: {
      score: Math.round(detailed.freshnessDim),
      weight: priorityWeights.dataFreshness,
      contribution: Math.round(detailed.freshnessDim * priorityWeights.dataFreshness * 100) / 100,
      detail: `Last enriched ${daysSinceStr}. Score: min(100, days × 10).`,
    },
    signalActivity: {
      score: Math.round(detailed.signalDim),
      weight: priorityWeights.signalActivity,
      contribution: Math.round(detailed.signalDim * priorityWeights.signalActivity * 100) / 100,
      detail: `${detailed.recentSignalCount} signals in last 7 days.`,
    },
    companyTier: {
      score: Math.round(detailed.tierDim),
      weight: priorityWeights.companyTier,
      contribution: Math.round(detailed.tierDim * priorityWeights.companyTier * 100) / 100,
      detail: `Tier "${detailed.tier}" → base score ${detailed.tierDim}.`,
    },
    dataCompleteness: {
      score: Math.round(detailed.completenessDim),
      weight: priorityWeights.dataCompleteness,
      contribution: Math.round(detailed.completenessDim * priorityWeights.dataCompleteness * 100) / 100,
      detail: `Intelligence score ${row.intelligenceScore}/100, freshness ${(row.freshness?.freshnessScore ?? 0).toFixed(2)}.`,
    },
    randomization: {
      score: Math.round(detailed.randomDim),
      weight: priorityWeights.randomization,
      contribution: Math.round(detailed.randomDim * priorityWeights.randomization * 100) / 100,
      detail: 'Hash-based jitter with hourly rotation to prevent starvation.',
    },
  };

  // Determine recommended connectors
  const connectors = selectConnectors(row, detailed.daysSinceEnrichment);

  return {
    companyId,
    companyName: company.rawName,
    overallScore: detailed.finalScore,
    dimensions,
    recommendedConnectors: connectors,
    lastScrapedAt: row.lastEnrichedAt?.toISOString() ?? null,
    recommendedWaitDays: detailed.daysSinceEnrichment !== null
      ? Math.max(0, resolvedConfig.minDaysBetweenScrapes - detailed.daysSinceEnrichment)
      : 0,
    reasons: detailed.reasons,
  };
}

/**
 * Invalidate the in-memory queue cache, forcing a fresh build on next access.
 *
 * Useful after manual enrichment, data imports, or configuration changes
 * that should immediately affect queue ordering.
 */
export function invalidateCache(): void {
  cachedQueue = [];
  cacheBuiltAt = null;
  logger.debug('[scraping-queue] Cache invalidated');
}

/**
 * Clear the in-memory scraping history.
 *
 * Primarily useful for testing. In production, the history map
 * naturally grows and is bounded by the number of unique
 * company × connector combinations.
 */
export function clearScrapingHistory(): void {
  scrapingHistory.clear();
  logger.debug('[scraping-queue] Scraping history cleared');
}

/**
 * Get the current in-memory scraping history size (for diagnostics).
 */
export function getScrapingHistorySize(): number {
  return scrapingHistory.size;
}
