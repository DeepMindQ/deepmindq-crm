/**
 * Phase 2A — Freshness-Based Intelligence Ranking
 *
 * Core principle: Freshness is not just a label. It is a core intelligence
 * attribute that influences how signals compete for attention.
 *
 * A fresh medium-confidence signal may deserve more attention than an old
 * high-confidence signal.
 *
 * The composite Intelligence Ranking Score combines 5 dimensions:
 *   1. Confidence        (25%) — base detection confidence
 *   2. Freshness/Recency (30%) — half-life decay model
 *   3. Source Quality     (15%) — premium/standard/low
 *   4. Business Relevance (15%) — how much this matters to the account
 *   5. Capability Fit    (15%) — how well it maps to our capabilities
 *
 * Architecture:
 *   - Pure functions — no DB access, no side effects
 *   - Used by alignment API for ranking at compose time
 *   - No schema changes required — uses existing CompanySignal fields
 *
 * Sprint 1 Enhancement: Three-date freshness
 *   - Now accepts optional sourcePublishedDate for more accurate freshness
 *   - Date priority: eventDate > sourcePublishedDate > discoveryDate (createdAt)
 *   - Quality multiplier: better date quality → higher ranking weight
 */

// ─── Half-Life Decay Model ────────────────────────────────────

/**
 * Signal-type-specific half-life in days.
 * News decays fast (14d). Structural changes decay slow (90d).
 */
export const SIGNAL_HALF_LIVES: Record<string, number> = {
  news: 14,
  funding: 30,
  hiring: 21,
  leadership_change: 45,
  tech_change: 30,
  partnership: 45,
  expansion: 60,
  acquisition: 30,
  regulatory: 90,
  financial_pressure: 21,
  mention: 7,
  // Phase 2A: New signal types
  people_change: 35,          // VP/Director org changes remain relevant ~5 weeks
  technology_adoption: 45,    // Tech adoption signals are strategic, slow to decay
  // Default for unknown types
  _default: 30,
};

/**
 * Compute a freshness score using half-life exponential decay.
 *
 * freshnessScore = baseConfidence × 0.5^(daysSinceSignal / halfLife)
 *
 * Sprint 1 Enhancement: Three-date model support.
 * Uses the best available date for freshness computation:
 *   Priority: signalDate (event) > sourcePublishedDate > createdAt (discovery)
 *
 * Examples:
 *   - 95% confidence, 1 day old, news type: 95 × 0.5^(1/14) = 95 × 0.952 = 90.4
 *   - 85% confidence, 1 day old, news type: 85 × 0.5^(1/14) = 85 × 0.952 = 80.9
 *   - 95% confidence, 240 days old (8 months), news type: 95 × 0.5^(240/14) = 95 × 0.000 = ~0
 *
 * The second example (85% fresh) crushes the third (95% old) — exactly the
 * behavior the user specified.
 *
 * @param baseConfidence - 0-100 base confidence
 * @param signalDate     - When the signal event occurred (null = skip)
 * @param createdAt      - When we detected/stored the signal (fallback)
 * @param signalType     - Signal type for half-life selection
 * @param sourcePublishedDate - When the source published it (Sprint 1)
 * @returns Freshness score 0-100
 */
export function computeFreshnessScore(
  baseConfidence: number,
  signalDate: string | null | undefined,
  createdAt: string,
  signalType?: string,
  sourcePublishedDate?: string | null
): number {
  const halfLife = SIGNAL_HALF_LIVES[signalType || ''] ?? SIGNAL_HALF_LIVES._default;

  // Sprint 1: Use best available date for freshness
  // Priority: signalDate (event) > sourcePublishedDate > createdAt (discovery)
  let refDate: Date;
  if (signalDate) {
    refDate = new Date(signalDate);
  } else if (sourcePublishedDate) {
    refDate = new Date(sourcePublishedDate);
  } else {
    refDate = new Date(createdAt);
  }

  const daysSince = Math.max(0, (Date.now() - refDate.getTime()) / (1000 * 60 * 60 * 24));

  // Half-life decay: 0.5^(daysSince / halfLife)
  const decay = Math.pow(0.5, daysSince / halfLife);
  const freshness = baseConfidence * decay;

  return Math.round(freshness * 10) / 10; // One decimal precision
}

/**
 * Get the staleness classification used by the alignment API.
 * Enhanced with intelligence ranking context.
 * Sprint 1: Supports sourcePublishedDate for more accurate staleness.
 */
export function computeFreshnessState(
  signalDate: string | null | undefined,
  createdAt: string,
  signalType?: string,
  sourcePublishedDate?: string | null
): {
  staleness: 'fresh' | 'aging' | 'stale' | 'expired';
  freshnessScore: number;
  daysSinceSignal: number;
  halfLife: number;
} {
  const halfLife = SIGNAL_HALF_LIVES[signalType || ''] ?? SIGNAL_HALF_LIVES._default;
  // Sprint 1: Best available date
  let refDate: Date;
  if (signalDate) {
    refDate = new Date(signalDate);
  } else if (sourcePublishedDate) {
    refDate = new Date(sourcePublishedDate);
  } else {
    refDate = new Date(createdAt);
  }
  const daysSince = Math.max(0, (Date.now() - refDate.getTime()) / (1000 * 60 * 60 * 24));

  // Staleness thresholds relative to half-life
  let staleness: 'fresh' | 'aging' | 'stale' | 'expired';
  if (daysSince <= halfLife * 0.5) staleness = 'fresh';
  else if (daysSince <= halfLife) staleness = 'aging';
  else if (daysSince <= halfLife * 2) staleness = 'stale';
  else staleness = 'expired';

  const decay = Math.pow(0.5, daysSince / halfLife);

  return {
    staleness,
    freshnessScore: Math.round(decay * 1000) / 1000, // 0-1 decay factor
    daysSinceSignal: Math.round(daysSince),
    halfLife,
  };
}

// ─── Source Quality Mapping ────────────────────────────────────

/**
 * Map source quality tier to a 0-1 weight.
 * Premium sources (major outlets, official company pages) get full weight.
 * Standard sources (industry publications, reputable blogs) get 80%.
 * Low sources (aggregators, unverified) get 60%.
 */
export function sourceQualityWeight(sourceQuality: string): number {
  switch (sourceQuality) {
    case 'premium': return 1.0;
    case 'standard': return 0.8;
    case 'low': return 0.6;
    default: return 0.7;
  }
}

// ─── Composite Intelligence Ranking ───────────────────────────

export interface IntelligenceRankingInput {
  confidence: number;         // 0-100 — base detection confidence
  signalDate: string | null;  // ISO date of the signal event
  createdAt: string;          // ISO date when we stored it
  signalType?: string;        // Signal type for half-life selection
  sourceQuality: string;      // premium | standard | low
  businessRelevance: number;  // 0-1 — how much this matters to the account
  capabilityRelevance: number; // 0-1 — how well it maps to our capabilities
  sourcePublishedDate?: string | null; // Sprint 1: When source published it
  dateQuality?: number;       // Sprint 1: 0-1 quality of the date model (0.4-1.0)
}

export interface IntelligenceRankingResult {
  /** 0-100 composite ranking score */
  rankingScore: number;
  /** Breakdown of each dimension */
  breakdown: {
    confidenceScore: number;      // 0-100, weighted 25%
    freshnessScore: number;      // 0-100, weighted 30%
    sourceQualityScore: number;  // 0-100, weighted 15%
    businessRelevanceScore: number; // 0-100, weighted 15%
    capabilityRelevanceScore: number; // 0-100, weighted 15%
  };
  /** The freshness state for display */
  freshness: {
    staleness: 'fresh' | 'aging' | 'stale' | 'expired';
    daysSinceSignal: number;
    halfLife: number;
  };
}

/**
 * Compute the composite Intelligence Ranking Score.
 *
 * This is the CORE function that makes signals compete on multiple dimensions.
 * A fresh medium-confidence signal CAN outrank an old high-confidence signal.
 *
 * Weights:
 *   Confidence:        25% — base detection quality
 *   Freshness/Recency: 30% — the strongest differentiator
 *   Source Quality:     15% — where the intelligence came from
 *   Business Relevance: 15% — why this matters to THIS account
 *   Capability Fit:    15% — how it connects to OUR capabilities
 */
export function computeIntelligenceRanking(input: IntelligenceRankingInput): IntelligenceRankingResult {
  // 1. Confidence (25%)
  const confidenceScore = Math.min(100, input.confidence);

  // 2. Freshness/Recency (30%) — the differentiator
  // Sprint 1: Pass sourcePublishedDate for better freshness accuracy
  const freshnessScore = computeFreshnessScore(
    input.confidence, input.signalDate, input.createdAt, input.signalType, input.sourcePublishedDate
  );
  // Sprint 1: Quality multiplier — better dates get a small boost
  const dateQualityMultiplier = 1 + (input.dateQuality ?? 0.5) * 0.05; // up to +5%

  // 3. Source Quality (15%)
  const sqWeight = sourceQualityWeight(input.sourceQuality);
  const sourceQualityScore = sqWeight * 100;

  // 4. Business Relevance (15%)
  const businessRelevanceScore = input.businessRelevance * 100;

  // 5. Capability Relevance (15%)
  const capabilityRelevanceScore = input.capabilityRelevance * 100;

  // Composite
  const rawScore = confidenceScore * 0.25 +
    freshnessScore * 0.30 * dateQualityMultiplier +
    sourceQualityScore * 0.15 +
    businessRelevanceScore * 0.15 +
    capabilityRelevanceScore * 0.15;
  const rankingScore = Math.min(100, Math.round(rawScore));

  const freshnessState = computeFreshnessState(input.signalDate, input.createdAt, input.signalType);

  return {
    rankingScore,
    breakdown: {
      confidenceScore: Math.round(confidenceScore),
      freshnessScore: Math.round(freshnessScore * 10) / 10,
      sourceQualityScore: Math.round(sourceQualityScore),
      businessRelevanceScore: Math.round(businessRelevanceScore * 100) / 100,
      capabilityRelevanceScore: Math.round(capabilityRelevanceScore * 100) / 100,
    },
    freshness: freshnessState,
  };
}

// ─── Convenience: Rank a CompanySignal ─────────────────────────

/**
 * Compute intelligence ranking for a single signal record.
 * Extracts all needed fields from the raw DB record.
 */
export function rankSignal(
  signal: {
    confidence: number;
    signalDate: string | null;
    createdAt: string;
    signalType: string;
    sourceQuality: string;
    // Sprint 1: Optional three-date fields
    sourcePublishedDate?: string | null;
    dateQuality?: number;
  },
  businessRelevance: number = 0.5,
  capabilityRelevance: number = 0.5
): IntelligenceRankingResult {
  return computeIntelligenceRanking({
    confidence: Math.round((signal.confidence ?? 0.5) * 100),
    signalDate: signal.signalDate != null ? new Date(signal.signalDate).toISOString() : null,
    createdAt: signal.createdAt != null ? new Date(signal.createdAt).toISOString() : new Date().toISOString(),
    signalType: signal.signalType,
    sourceQuality: signal.sourceQuality || 'standard',
    businessRelevance,
    capabilityRelevance,
    // Sprint 1: Pass through three-date fields
    sourcePublishedDate: signal.sourcePublishedDate,
    dateQuality: signal.dateQuality,
  });
}

/**
 * Sort an array of ranked signals by their intelligence ranking score,
 * descending (highest-ranked first).
 */
export function sortByIntelligenceRanking<T extends { rankingScore: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.rankingScore - a.rankingScore);
}
