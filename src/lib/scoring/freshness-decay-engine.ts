/**
 * Session 8, Component 4.2 — Freshness Decay Standardization
 *
 * Unified freshness decay engine that consolidates three previously separate
 * freshness systems into a single coherent, pure-function module:
 *
 *   1. freshness-ranking.ts       — Half-life exponential decay, per-signal-type
 *   2. freshness-decay.ts         — DB-backed linear daily decay
 *   3. freshness-manager.ts       — Company-level linear decay over 14 days
 *
 * This engine replaces all three with:
 *   - Half-life exponential decay as the single primary algorithm
 *   - Normalized 0–1 scoring for consistent comparison
 *   - Composite company freshness from multiple dimensions
 *   - Staleness classification with actionable recommendations
 *   - Refresh scheduling logic
 *
 * Design Principles:
 *   - PURE functions only — no DB access, no side effects, no date mutation
 *   - Uses Date.now() for "now" reference (testable by mocking)
 *   - Imports nothing from Prisma or DB layer
 *   - Comprehensive JSDoc on every public member
 */

// ─── Exported Types ────────────────────────────────────────────

/** Staleness classification levels, ordered from freshest to most degraded. */
export type StalenessLevel = 'fresh' | 'aging' | 'stale' | 'expired';

/** Input parameters for computing a single signal's freshness score. */
export interface SignalFreshnessParams {
  /** Base confidence of the signal, 0–1. */
  baseConfidence: number;
  /** When the signal event occurred (highest priority date). */
  signalDate?: Date | string | null;
  /** When the signal was first created/stored in the system (lowest priority). */
  createdAt: Date | string;
  /** Signal type key — selects the appropriate half-life. */
  signalType?: string;
  /** When the source published the signal (medium priority date). */
  sourcePublishedDate?: Date | string | null;
}

/** Result of computing a single signal's freshness. */
export interface SignalFreshnessResult {
  /** Freshness score normalized to 0–1. */
  freshnessScore: number;
  /** Staleness classification. */
  stalenessLevel: StalenessLevel;
  /** Number of days between the reference date and now. */
  daysSinceCapture: number;
  /** The half-life (in days) used for this computation. */
  halfLifeUsed: number;
  /** Identifier for the decay algorithm used. */
  decayMethod: string;
  /** The date used as the reference point for age calculation. */
  referenceDate: Date;
  /** Human-readable recommended action based on staleness. */
  recommendedAction: string;
}

/** Lightweight summary of a signal group, used as input for company freshness. */
export interface SignalSummary {
  /** Signal type key (e.g. 'news', 'funding'). */
  signalType: string;
  /** The most recent date associated with signals of this type. */
  latestDate: Date | null;
  /** How many signals of this type exist. */
  count: number;
  /** Average confidence across signals of this type, 0–1. */
  avgConfidence: number;
}

/** Result of computing a company's composite freshness. */
export interface CompanyFreshnessResult {
  /** Overall weighted freshness score, 0–1. */
  overallScore: number;
  /** Staleness classification for the company. */
  stalenessLevel: StalenessLevel;
  /** Per-dimension freshness scores. Null means no data for that dimension. */
  dimensionScores: {
    profile: number | null;
    signals: number | null;
    contacts: number | null;
    technology: number | null;
  };
  /** Total number of signals that contributed to the score. */
  signalCount: number;
  /** Timestamp of the most recent signal, or null if none. */
  latestSignalAt: Date | null;
  /** Identifier for the decay algorithm used. */
  decayMethod: string;
}

/** Recommendation for when to next refresh a company's intelligence. */
export interface RefreshRecommendation {
  /** Priority level for the refresh action. */
  priority: 'low' | 'medium' | 'high' | 'critical';
  /** Number of days until the recommended refresh. 0 = immediate. */
  refreshInDays: number;
  /** Human-readable explanation for the recommendation. */
  reason: string;
  /** The staleness level that drove this recommendation. */
  stalenessLevel: StalenessLevel;
}

// ─── FreshnessDecayEngine ───────────────────────────────────────

/**
 * Standardized freshness decay engine.
 *
 * All methods are static and pure — no instances, no state, no DB.
 * This is the single source of truth for freshness computation across
 * the entire DeepMindQ Enterprise application.
 *
 * @example
 * ```ts
 * import { FreshnessDecayEngine } from '@/lib/scoring/freshness-decay-engine';
 *
 * const result = FreshnessDecayEngine.computeSignalFreshness({
 *   baseConfidence: 0.92,
 *   signalDate: '2025-01-15',
 *   createdAt: '2025-01-16T08:00:00Z',
 *   signalType: 'news',
 * });
 * // result.freshnessScore → e.g. 0.34
 * // result.stalenessLevel  → e.g. 'aging'
 * ```
 */
export class FreshnessDecayEngine {
  // ── Prevent instantiation — all methods are static ──────────
  private constructor() {}

  // ─── Constants ───────────────────────────────────────────────

  /**
   * Standardized half-lives (in days) per signal type.
   *
   * These define how quickly each signal type loses relevance.
   * A shorter half-life means the signal decays faster.
   *
   * | Type               | Half-life | Rationale                                      |
   * |--------------------|-----------|------------------------------------------------|
   * | mention            | 7 days    | Social mentions are highly ephemeral            |
   * | news               | 14 days   | News cycles move fast                          |
   * | hiring             | 21 days   | Hiring signals remain relevant ~3 weeks        |
   * | financial_pressure | 21 days   | Financial pressures evolve quickly             |
   * | _default           | 30 days   | Reasonable default for unknown types           |
   * | funding            | 30 days   | Funding rounds stay relevant ~1 month          |
   * | tech_change        | 30 days   | Tech changes have medium persistence           |
   * | acquisition        | 30 days   | Acquisition news has medium half-life          |
   * | people_change      | 35 days   | VP/Director org changes ~5 weeks               |
   * | leadership_change  | 45 days   | Leadership changes are more structural          |
   * | partnership        | 45 days   | Partnerships have medium-long relevance         |
   * | technology_adoption| 45 days   | Tech adoption is strategic, slow to decay      |
   * | expansion          | 60 days   | Geographic expansion has long relevance         |
   * | regulatory         | 90 days   | Regulatory changes persist for a long time     |
   */
  static readonly HALF_LIVES: Readonly<Record<string, number>> = {
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
    people_change: 35,
    technology_adoption: 45,
    _default: 30,
  } as const;

  /**
   * Normalized staleness thresholds on a 0–1 scale.
   *
   * These are used for company-level freshness classification.
   * Signal-level staleness uses half-life-relative thresholds instead.
   *
   * | Level    | Threshold | Meaning                                |
   * |----------|-----------|----------------------------------------|
   * | fresh    | ≥ 0.70    | Intelligence is current and reliable    |
   * | aging    | ≥ 0.40    | Starting to degrade, monitor closely   |
   * | stale    | ≥ 0.20    | Significantly degraded, refresh needed |
   * | expired  | < 0.20    | Critical — intelligence is unreliable  |
   */
  static readonly THRESHOLDS: Readonly<{
    fresh: number;
    aging: number;
    stale: number;
    expired: number;
  }> = {
    fresh: 0.70,
    aging: 0.40,
    stale: 0.20,
    expired: 0.20, // same boundary as stale — below this is expired
  } as const;

  /**
   * Identifier for the algorithm version used by this engine.
   * Useful for logging, auditing, and future migration detection.
   */
  static readonly DECAY_METHOD: string = 'half-life-exponential';

  /** Minimum freshness floor — signals never truly reach zero until expired. */
  private static readonly FLOOR = 0.05;

  /** Maximum possible freshness score. */
  private static readonly CEIL = 1.0;

  /**
   * Dimension weights for company freshness composite scoring.
   * Signal freshness is the dominant factor (40%).
   */
  private static readonly DIMENSION_WEIGHTS: Readonly<{
    signals: number;
    profile: number;
    contacts: number;
    technology: number;
  }> = {
    signals: 0.40,
    profile: 0.25,
    contacts: 0.20,
    technology: 0.15,
  } as const;

  /** Half-lives for company-level dimension scoring. */
  private static readonly DIMENSION_HALF_LIVES: Readonly<{
    profile: number;
    contacts: number;
    technology: number;
  }> = {
    profile: 60,
    contacts: 45,
    technology: 90,
  } as const;

  // ─── Signal Freshness ────────────────────────────────────────

  /**
   * Compute the freshness score for a single intelligence signal.
   *
   * Uses half-life exponential decay as the primary algorithm:
   * ```
   * freshnessScore = baseConfidence × 0.5^(daysSinceCapture / halfLife)
   * ```
   *
   * **Date Priority:** `signalDate` > `sourcePublishedDate` > `createdAt`
   * Falls back to `Date.now()` only if all are unavailable (shouldn't happen
   * since `createdAt` is required).
   *
   * **Floor at 0.05** — signals never fully reach zero while they exist,
   * ensuring they remain discoverable but clearly deprioritized.
   *
   * @param params - Signal freshness input parameters
   * @returns Complete freshness result with score, classification, and metadata
   *
   * @example
   * ```ts
   * const r = FreshnessDecayEngine.computeSignalFreshness({
   *   baseConfidence: 0.95,
   *   signalDate: '2025-06-01',
   *   createdAt: '2025-06-02T10:00:00Z',
   *   signalType: 'news',
   * });
   * // If now is 2025-06-08 (7 days later):
   * // freshnessScore = 0.95 × 0.5^(7/14) = 0.95 × 0.707 = 0.672
   * ```
   */
  static computeSignalFreshness(params: SignalFreshnessParams): SignalFreshnessResult {
    const { baseConfidence, signalType } = params;

    // Select half-life for this signal type
    const halfLife = FreshnessDecayEngine.HALF_LIVES[signalType || '']
      ?? FreshnessDecayEngine.HALF_LIVES._default;

    // Resolve the best reference date (three-date priority)
    const referenceDate = FreshnessDecayEngine.resolveReferenceDate(
      params.signalDate,
      params.sourcePublishedDate,
      params.createdAt,
    );

    // Calculate days since the reference event
    const nowMs = Date.now();
    const refMs = referenceDate.getTime();
    const daysSinceCapture = Math.max(0, (nowMs - refMs) / (1000 * 60 * 60 * 24));

    // Apply half-life exponential decay
    const decayFactor = Math.pow(0.5, daysSinceCapture / halfLife);
    let freshnessScore = baseConfidence * decayFactor;

    // Apply floor and ceiling
    freshnessScore = Math.max(FreshnessDecayEngine.FLOOR, Math.min(FreshnessDecayEngine.CEIL, freshnessScore));

    // Classify staleness
    const stalenessLevel = FreshnessDecayEngine.classifySignalStaleness(
      freshnessScore,
      daysSinceCapture,
      halfLife,
    );

    // Determine recommended action
    const recommendedAction = FreshnessDecayEngine.getSignalRecommendedAction(stalenessLevel);

    return {
      freshnessScore: Math.round(freshnessScore * 10000) / 10000, // 4 decimal places
      stalenessLevel,
      daysSinceCapture: Math.round(daysSinceCapture * 100) / 100, // 2 decimal places
      halfLifeUsed: halfLife,
      decayMethod: FreshnessDecayEngine.DECAY_METHOD,
      referenceDate,
      recommendedAction,
    };
  }

  // ─── Company Freshness ───────────────────────────────────────

  /**
   * Compute the composite freshness score for a company.
   *
   * Combines four dimensions using a weighted average:
   * ```
   * companyFreshness = weightedAverage(
   *   profile:   latestProfileDays   (halfLife=60),  weight=25%
   *   signals:   maxSignalFreshness  (per-signal),     weight=40%
   *   contacts:  latestContactDays   (halfLife=45),  weight=20%
   *   technology: latestTechDays     (halfLife=90),  weight=15%
   * )
   * ```
   *
   * **Weight Redistribution:** If a dimension has no data (null), its weight
   * is distributed proportionally to the remaining dimensions. If ALL
   * dimensions are null, returns 0.
   *
   * **Signal Dimension:** For the signals dimension, we compute freshness
   * for each signal summary using `computeSignalFreshness` internally,
   * then take the maximum freshness as the signal dimension's score.
   * This ensures that a single very fresh signal can keep the signal
   * dimension healthy.
   *
   * @param signals - Array of signal summaries for this company
   * @param latestProfileDays - Days since the company profile was last updated (null = no data)
   * @param latestContactDays - Days since the last contact interaction (null = no data)
   * @param latestTechDays - Days since the last technology signal (null = no data)
   * @returns Composite company freshness result with per-dimension breakdown
   *
   * @example
   * ```ts
   * const result = FreshnessDecayEngine.computeCompanyFreshness(
   *   [{ signalType: 'news', latestDate: new Date(), count: 3, avgConfidence: 0.8 }],
   *   5,   // profile updated 5 days ago
   *   10,  // last contact 10 days ago
   *   30,  // last tech signal 30 days ago
   * );
   * ```
   */
  static computeCompanyFreshness(
    signals: SignalSummary[],
    latestProfileDays?: number | null,
    latestContactDays?: number | null,
    latestTechDays?: number | null,
  ): CompanyFreshnessResult {
    const W = FreshnessDecayEngine.DIMENSION_WEIGHTS;
    const DH = FreshnessDecayEngine.DIMENSION_HALF_LIVES;

    // ── Compute per-dimension scores ──

    // Signals: take the max freshness across all signal summaries
    let signalsScore: number | null = null;
    let signalCount = 0;
    let latestSignalAt: Date | null = null;

    if (signals.length > 0) {
      signalCount = signals.reduce((sum, s) => sum + s.count, 0);

      // Find the latest signal date across all summaries
      for (const s of signals) {
        if (s.latestDate) {
          if (!latestSignalAt || s.latestDate.getTime() > latestSignalAt.getTime()) {
            latestSignalAt = s.latestDate;
          }
        }
      }

      // Compute freshness for each signal summary and take the max
      let maxFreshness = 0;
      for (const s of signals) {
        if (!s.latestDate) continue;
        const signalResult = FreshnessDecayEngine.computeSignalFreshness({
          baseConfidence: s.avgConfidence,
          signalDate: s.latestDate,
          createdAt: s.latestDate, // use latestDate as fallback for createdAt
          signalType: s.signalType,
        });
        maxFreshness = Math.max(maxFreshness, signalResult.freshnessScore);
      }
      signalsScore = maxFreshness > 0 ? maxFreshness : null;
    }

    // Profile: half-life decay from days since last profile update
    const profileScore = (latestProfileDays != null)
      ? FreshnessDecayEngine.applyDecay(1.0, latestProfileDays, DH.profile)
      : null;

    // Contacts: half-life decay from days since last contact
    const contactsScore = (latestContactDays != null)
      ? FreshnessDecayEngine.applyDecay(1.0, latestContactDays, DH.contacts)
      : null;

    // Technology: half-life decay from days since last tech signal
    const techScore = (latestTechDays != null)
      ? FreshnessDecayEngine.applyDecay(1.0, latestTechDays, DH.technology)
      : null;

    // ── Compute weighted average with redistribution ──
    const dimensions: Array<{ score: number | null; weight: number }> = [
      { score: signalsScore, weight: W.signals },
      { score: profileScore, weight: W.profile },
      { score: contactsScore, weight: W.contacts },
      { score: techScore, weight: W.technology },
    ];

    const available = dimensions.filter(d => d.score !== null);
    const overallScore = FreshnessDecayEngine.weightedAverageWithRedistribution(dimensions);

    const stalenessLevel = FreshnessDecayEngine.classifyStaleness(overallScore);

    return {
      overallScore: Math.round(overallScore * 10000) / 10000,
      stalenessLevel,
      dimensionScores: {
        profile: profileScore !== null ? Math.round(profileScore * 10000) / 10000 : null,
        signals: signalsScore !== null ? Math.round(signalsScore * 10000) / 10000 : null,
        contacts: contactsScore !== null ? Math.round(contactsScore * 10000) / 10000 : null,
        technology: techScore !== null ? Math.round(techScore * 10000) / 10000 : null,
      },
      signalCount,
      latestSignalAt,
      decayMethod: FreshnessDecayEngine.DECAY_METHOD,
    };
  }

  // ─── Staleness Classification ────────────────────────────────

  /**
   * Classify a freshness score into a staleness level.
   *
   * For **company-level** freshness (normalized 0–1 scale):
   * - `fresh`    (≥ 0.70): Intelligence is current and reliable
   * - `aging`    (≥ 0.40): Starting to degrade, monitor closely
   * - `stale`    (≥ 0.20): Significantly degraded, refresh needed
   * - `expired`  (< 0.20): Critical — intelligence is unreliable
   *
   * The optional `signalType` parameter is accepted for API compatibility
   * but does not affect company-level classification (which uses fixed
   * normalized thresholds). Signal-level classification uses
   * half-life-relative thresholds instead (see `classifySignalStaleness`).
   *
   * @param freshnessScore - Normalized freshness score (0–1)
   * @param _signalType - Optional signal type (not used in company-level classification)
   * @returns The staleness level
   */
  static classifyStaleness(freshnessScore: number, _signalType?: string): StalenessLevel {
    const T = FreshnessDecayEngine.THRESHOLDS;
    if (freshnessScore >= T.fresh) return 'fresh';
    if (freshnessScore >= T.aging) return 'aging';
    if (freshnessScore >= T.stale) return 'stale';
    return 'expired';
  }

  // ─── Refresh Schedule ────────────────────────────────────────

  /**
   * Determine the recommended refresh schedule for a company.
   *
   * Based on the company's staleness level:
   * - **fresh**    → low priority, refresh in 7 days
   * - **aging**    → medium priority, refresh in 1–3 days (proportional to degradation)
   * - **stale**    → high priority, immediate refresh (0 days)
   * - **expired**  → critical priority, immediate refresh (0 days) + elevated urgency
   *
   * For the `aging` level, the number of days is interpolated:
   * closer to the `fresh` threshold → 3 days;
   * closer to the `stale` threshold → 1 day.
   *
   * @param freshnessResult - The company freshness result to base the schedule on
   * @returns Refresh recommendation with priority, timing, and reasoning
   */
  static getRefreshSchedule(freshnessResult: CompanyFreshnessResult): RefreshRecommendation {
    const { overallScore, stalenessLevel } = freshnessResult;
    const T = FreshnessDecayEngine.THRESHOLDS;

    switch (stalenessLevel) {
      case 'fresh':
        return {
          priority: 'low',
          refreshInDays: 7,
          reason: 'Intelligence is current. No immediate action needed; routine refresh in 7 days.',
          stalenessLevel,
        };

      case 'aging': {
        // Interpolate: closer to fresh threshold → 3 days, closer to stale → 1 day
        const range = T.fresh - T.stale; // 0.50
        const position = (overallScore - T.stale) / range; // 0.0 (at stale) to 1.0 (at fresh)
        const clampedPos = Math.max(0, Math.min(1, position));
        const refreshInDays = Math.round(1 + clampedPos * 2); // 1 to 3 days

        return {
          priority: 'medium',
          refreshInDays,
          reason: `Intelligence is aging (score: ${overallScore.toFixed(2)}). Consider refreshing within ${refreshInDays} day${refreshInDays > 1 ? 's' : ''}.`,
          stalenessLevel,
        };
      }

      case 'stale':
        return {
          priority: 'high',
          refreshInDays: 0,
          reason: 'Intelligence is stale. Immediate refresh required to maintain data quality.',
          stalenessLevel,
        };

      case 'expired':
        return {
          priority: 'critical',
          refreshInDays: 0,
          reason: 'Intelligence has expired. Urgent refresh recommended — data may be unreliable for decision-making.',
          stalenessLevel,
        };
    }
  }

  // ─── Confidence Decay ────────────────────────────────────────

  /**
   * Apply half-life decay to a base confidence score.
   *
   * This is a convenience wrapper around the core decay formula:
   * ```
   * decayedConfidence = baseConfidence × 0.5^(daysSinceCapture / halfLife)
   * ```
   *
   * The result is floored at 0.05 — confidence never truly reaches zero
   * while the signal exists in the system. This prevents signals from
   * becoming completely invisible and ensures they can still be
   * discovered and evaluated, just heavily deprioritized.
   *
   * @param baseConfidence - Original confidence score (0–1)
   * @param daysSinceCapture - Number of days since the signal was captured
   * @param signalType - Signal type for half-life selection
   * @returns Decayed confidence score (0.05–1.0)
   *
   * @example
   * ```ts
   * // News signal (halfLife=14), 28 days old, originally 90% confident
   * const decayed = FreshnessDecayEngine.computeConfidenceDecay(0.9, 28, 'news');
   * // 0.9 × 0.5^(28/14) = 0.9 × 0.25 = 0.225
   * ```
   */
  static computeConfidenceDecay(
    baseConfidence: number,
    daysSinceCapture: number,
    signalType: string,
  ): number {
    const halfLife = FreshnessDecayEngine.HALF_LIVES[signalType || '']
      ?? FreshnessDecayEngine.HALF_LIVES._default;

    return FreshnessDecayEngine.applyDecay(baseConfidence, daysSinceCapture, halfLife);
  }

  // ─── Private Helpers ─────────────────────────────────────────

  /**
   * Resolve the best reference date using three-date priority.
   *
   * Priority: `signalDate` > `sourcePublishedDate` > `createdAt`
   * Falls back to `Date.now()` only if all are unavailable.
   *
   * Returns a **new Date instance** to prevent mutation of inputs.
   */
  private static resolveReferenceDate(
    signalDate: Date | string | null | undefined,
    sourcePublishedDate: Date | string | null | undefined,
    createdAt: Date | string | null | undefined,
  ): Date {
    if (signalDate) return new Date(signalDate);
    if (sourcePublishedDate) return new Date(sourcePublishedDate);
    if (createdAt) return new Date(createdAt);
    return new Date(Date.now());
  }

  /**
   * Apply half-life exponential decay with floor and ceiling.
   *
   * Core formula: `value × 0.5^(days / halfLife)`
   * Result is clamped to [0.05, 1.0].
   */
  private static applyDecay(
    value: number,
    daysSince: number,
    halfLife: number,
  ): number {
    const decay = Math.pow(0.5, daysSince / halfLife);
    const result = value * decay;
    return Math.max(FreshnessDecayEngine.FLOOR, Math.min(FreshnessDecayEngine.CEIL, result));
  }

  /**
   * Classify staleness for an individual signal using half-life-relative thresholds.
   *
   * Unlike company-level classification (which uses fixed 0–1 thresholds),
   * signal-level classification is relative to the signal's half-life:
   * - `fresh`    → within 0.5× half-life
   * - `aging`    → within 1.0× half-life
   * - `stale`    → within 2.0× half-life
   * - `expired`  → beyond 2.0× half-life
   *
   * This means a regulatory signal (90d half-life) can be "fresh" at 30 days,
   * while a mention (7d half-life) is already "stale" at 30 days.
   */
  private static classifySignalStaleness(
    freshnessScore: number,
    daysSince: number,
    halfLife: number,
  ): StalenessLevel {
    // Use half-life-relative days for classification
    if (daysSince <= halfLife * 0.5) return 'fresh';
    if (daysSince <= halfLife * 1.0) return 'aging';
    if (daysSince <= halfLife * 2.0) return 'stale';
    return 'expired';
  }

  /**
   * Get a human-readable recommended action for a signal's staleness level.
   */
  private static getSignalRecommendedAction(stalenessLevel: StalenessLevel): string {
    switch (stalenessLevel) {
      case 'fresh':
        return 'No action needed';
      case 'aging':
        return 'Monitor — consider refresh soon';
      case 'stale':
        return 'Action required — schedule refresh';
      case 'expired':
        return 'Urgent — immediate refresh recommended';
    }
  }

  /**
   * Compute a weighted average with automatic weight redistribution.
   *
   * Dimensions with null scores are excluded, and their weights are
   * redistributed proportionally to the remaining dimensions.
   *
   * If all dimensions are null, returns 0.
   *
   * @param dimensions - Array of { score, weight } pairs
   * @returns Weighted average score (0–1)
   */
  private static weightedAverageWithRedistribution(
    dimensions: Array<{ score: number | null; weight: number }>,
  ): number {
    const available = dimensions.filter(d => d.score !== null);
    if (available.length === 0) return 0;

    const totalWeight = available.reduce((sum, d) => sum + d.weight, 0);
    if (totalWeight === 0) return 0;

    const weightedSum = available.reduce(
      (sum, d) => sum + (d.score as number) * d.weight,
      0,
    );

    return Math.max(
      FreshnessDecayEngine.FLOOR,
      Math.min(FreshnessDecayEngine.CEIL, weightedSum / totalWeight),
    );
  }
}
