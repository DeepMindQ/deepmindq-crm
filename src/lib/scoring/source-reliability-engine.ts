/**
 * Source Reliability Scoring Validation Engine (Session 8 — Component 4.3)
 *
 * Unified source reliability scoring engine that cross-validates static TRUST
 * scores against feedback-driven Bayesian reliability from the EvidenceSourceReliability
 * DB table.
 *
 * Two reliability systems exist:
 *   1. Static TRUST scores (trust-metadata.ts) — deterministic 0-100 per source type
 *   2. Per-domain Bayesian reliability (source-reliability.ts) — feedback-driven 0-1
 *
 * This engine merges both into a single composite reliability score on a 0-100 scale,
 * detects drift between static expectations and observed reality, and provides
 * actionable validation reports.
 */

import {
  SOURCE_RELIABILITY_SCORES,
  SOURCE_LABELS,
  getReliabilityScore,
  type TrustSource,
} from '@/lib/intelligence-sources/trust-metadata';
import { getSourceReliability } from '@/lib/source-reliability';
import { db } from '@/lib/db';

// ═══════════════════════════════════════════════════════════════════════════
// Exported Types
// ═══════════════════════════════════════════════════════════════════════════

/** Quality tier for a source based on its reliability score */
export type SourceQualityTier = 'premium' | 'standard' | 'low';

/** Validation status comparing static expectations to observed feedback */
export type ValidationStatus = 'aligned' | 'drift' | 'mismatch' | 'critical';

/** Parameters for computing a composite reliability score */
export interface CompositeReliabilityParams {
  /** Source type key (e.g., 'verified_api', 'web_intelligence') */
  sourceType: string;
  /** Optional domain for fetching Bayesian feedback reliability */
  domain?: string;
  /** Static TRUST score 0-100; falls back to base score for sourceType */
  staticScore?: number;
  /** Bayesian reliability 0-1; fetched from DB if not provided */
  domainReliability?: number;
  /** Number of feedback samples for the domain; affects weighting */
  domainFeedbackCount?: number;
  /** Optional list of evidence source domains/types for diversity scoring (Phase 2) */
  evidenceSources?: string[];
}

/** Result of computing a composite reliability score */
export interface CompositeReliabilityResult {
  /** Unified composite reliability score 0-100 */
  compositeScore: number;
  /** Static TRUST score used (0-100) */
  staticScore: number;
  /** Feedback-driven score (0-100), or null if no feedback data */
  feedbackScore: number | null;
  /** Weight applied to feedback score (0-1) */
  feedbackWeight: number;
  /** Weight applied to static score (0-1) */
  staticWeight: number;
  /** Quality tier for the composite score */
  tier: SourceQualityTier;
  /** Whether domain feedback data was available */
  hasFeedbackData: boolean;
  /** Absolute difference between static and feedback scores (null if no feedback) */
  deviation: number | null;
  /** Validation status of the deviation (null if no feedback) */
  deviationStatus: ValidationStatus | null;
  /** Source diversity analysis (if evidence sources were provided) */
  diversity?: SourceDiversityScore;
  /** Diversity penalty applied to composite score (0 if no penalty) */
  diversityPenalty?: number;
}

/** Parameters for running a source score validation pass */
export interface ValidationResultParams {
  /** Minimum feedback samples to include a domain in validation (default: 5) */
  minFeedbackSamples?: number;
}

/** Result of validating static source scores against observed feedback */
export interface ValidationResult {
  /** Total number of domains evaluated */
  evaluated: number;
  /** Count of domains where static score aligns with feedback */
  aligned: number;
  /** Count of domains showing minor drift */
  drift: number;
  /** Count of domains with significant mismatch */
  mismatch: number;
  /** Count of domains with critically wrong static scores */
  critical: number;
  /** Detailed per-domain validation results */
  details: ValidationDetail[];
}

/** Per-domain validation detail comparing static vs observed reliability */
export interface ValidationDetail {
  /** Domain name being validated */
  domain: string;
  /** Source type assigned to this domain */
  sourceType: string;
  /** Static TRUST score (0-100) for the source type */
  staticScore: number;
  /** Observed Bayesian reliability * 100 (0-100) */
  observedScore: number;
  /** Absolute deviation between static and observed */
  deviation: number;
  /** Validation status category */
  status: ValidationStatus;
  /** Human-readable recommended action */
  recommendedAction: string;
  /** Number of feedback samples for this domain */
  feedbackCount: number;
}

/** Input for computing a full TRUST composite score */
export interface TrustMetadataInput {
  /** Source type key (e.g., 'verified_api', 'ai_inference') */
  source: string;
  /** Confidence level 0-100 */
  confidence: number;
  /** Days since the intelligence was captured (default: 0 = fresh) */
  freshnessAge?: number;
  /** Number of evidence sources backing this intelligence (default: 1) */
  evidenceCount?: number;
}

/** Result of computing a full TRUST composite score with dimensional breakdown */
export interface TrustScoreResult {
  /** Final composite TRUST score 0-100 */
  compositeScore: number;
  /** Letter grade (A+/A/B/C/D/F) */
  grade: string;
  /** Source dimension score 0-100 */
  sourceScore: number;
  /** Confidence dimension score 0-100 */
  confidenceScore: number;
  /** Freshness dimension score 0-100 */
  freshnessScore: number;
  /** Evidence dimension score 0-100 */
  evidenceScore: number;
  /** Detailed breakdown of all dimension scores */
  breakdown: {
    source: number;
    confidence: number;
    freshness: number;
    evidence: number;
  };
}

/** Result of computing source diversity for a set of evidence sources */
export interface SourceDiversityScore {
  /** Diversity score 0-1 where 1 = highly diverse sources */
  diversityScore: number;
  /** Number of distinct source types/domains */
  uniqueSourceCount: number;
  /** Total evidence count */
  totalEvidenceCount: number;
  /** Concentration ratio (0-1) where 1 = single source, 0 = perfectly distributed */
  concentrationRatio: number;
  /** List of source types and their contribution percentages */
  sourceBreakdown: Array<{
    source: string;
    count: number;
    percentage: number;
  }>;
  /** Diversity tier */
  tier: 'diverse' | 'moderate' | 'concentrated' | 'single_source';
  /** Recommendation for improving diversity */
  recommendation: string;
}

/** Information about a known source type */
export interface SourceTypeInfo {
  /** Source type key */
  type: string;
  /** Static TRUST score 0-100 */
  staticScore: number;
  /** Human-readable description */
  description: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Internal Constants
// ═══════════════════════════════════════════════════════════════════════════

/** Minimum feedback samples required to use feedback-driven weighting */
const MIN_FEEDBACK_FOR_WEIGHTING = 5;

/** Default source type used when domain-to-sourceType mapping is unknown */
const DEFAULT_VALIDATION_SOURCE_TYPE = 'web_intelligence';

/** Maximum age in days for freshness decay calculation */
const MAX_FRESHNESS_AGE_DAYS = 90;

/** TRUST composite dimension weights */
const TRUST_WEIGHTS = {
  source: 0.30,
  confidence: 0.25,
  freshness: 0.25,
  evidence: 0.20,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// Source Reliability Engine
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Unified source reliability scoring engine.
 *
 * Cross-validates static TRUST scores (from trust-metadata) against
 * feedback-driven Bayesian reliability (from EvidenceSourceReliability DB table)
 * and produces a unified 0-100 composite reliability score.
 *
 * All methods are static — no instance state is required.
 */
export class SourceReliabilityEngine {
  // ── Private constructor to prevent instantiation ─────────────────────

  private constructor() {
    // Static-only class
  }

  // ── Base Reliability ─────────────────────────────────────────────────

  /**
   * Get the static TRUST reliability score (0-100) for a given source type.
   *
   * Uses `SOURCE_RELIABILITY_SCORES` from trust-metadata. Accepts both
   * TrustSource keys (e.g., 'verified_api') and legacy SourceType strings
   * (e.g., 'clearbit') via `getReliabilityScore()`.
   *
   * @param sourceType - A TrustSource key or legacy SourceType string
   * @returns Static reliability score 0-100
   */
  static getBaseReliability(sourceType: string): number {
    return getReliabilityScore(sourceType);
  }

  // ── Domain Reliability ───────────────────────────────────────────────

  /**
   * Get the Bayesian feedback-driven reliability (0-1) for a specific domain.
   *
   * Fetches from the EvidenceSourceReliability DB table. Falls back to 0.5
   * (neutral prior) if no data exists for the domain.
   *
   * @param domain - The domain to look up (e.g., 'techcrunch.com')
   * @returns Bayesian reliability score 0-1
   */
  static async getDomainReliability(domain: string): Promise<number> {
    return getSourceReliability(domain);
  }

  // ── Composite Reliability ────────────────────────────────────────────

  /**
   * Compute a composite reliability score by cross-validating static TRUST
   * scores against feedback-driven Bayesian reliability.
   *
   * Cross-validation algorithm:
   * - If no domain or no feedback data: staticWeight = 1.0 (trust static entirely)
   * - If domain has ≥5 feedback samples: staticWeight = 0.6, feedbackWeight = 0.4
   * - If deviation > 40 points: use feedback score as primary (warn)
   * - If deviation > 20 points: use weighted average (flag for review)
   * - Otherwise: use weighted average (normal)
   *
   * All outputs are on a standardized 0-100 scale.
   *
   * @param params - Composite reliability computation parameters
   * @returns Composite reliability result with scores, weights, and tier
   */
  static async getCompositeReliability(
    params: CompositeReliabilityParams,
  ): Promise<CompositeReliabilityResult> {
    const {
      sourceType,
      domain,
      staticScore: overrideStaticScore,
      domainReliability: overrideDomainReliability,
      domainFeedbackCount: overrideFeedbackCount,
      evidenceSources,
    } = params;

    // Resolve static score (0-100)
    const staticScore = overrideStaticScore ?? this.getBaseReliability(sourceType);

    // Resolve domain feedback data
    let feedbackScore: number | null = null;
    let feedbackCount = overrideFeedbackCount ?? 0;
    let hasFeedbackData = false;

    if (overrideDomainReliability !== undefined) {
      // Caller provided the domain reliability directly
      feedbackScore = Math.round(overrideDomainReliability * 100);
      hasFeedbackData = feedbackCount >= MIN_FEEDBACK_FOR_WEIGHTING;
    } else if (domain) {
      // Fetch from DB
      const domainReliability = await this.getDomainReliability(domain);
      feedbackScore = Math.round(domainReliability * 100);
      // Also fetch feedback count from DB
      feedbackCount = overrideFeedbackCount ?? await this.getDomainFeedbackCount(domain);
      hasFeedbackData = feedbackCount >= MIN_FEEDBACK_FOR_WEIGHTING;
    }

    // Compute weights based on feedback availability
    let staticWeight: number;
    let feedbackWeight: number;

    if (!hasFeedbackData || feedbackScore === null) {
      // No significant feedback — trust the static score entirely
      staticWeight = 1.0;
      feedbackWeight = 0.0;
    } else {
      // Has meaningful feedback data — use weighted blend
      staticWeight = 0.6;
      feedbackWeight = 0.4;
    }

    // Compute deviation and adjust weights for extreme cases
    let deviation: number | null = null;
    let deviationStatus: ValidationStatus | null = null;
    let compositeScore: number;

    if (hasFeedbackData && feedbackScore !== null) {
      deviation = Math.abs(staticScore - feedbackScore);
      deviationStatus = this.classifyDeviation(deviation);

      if (deviation > 40) {
        // Critical deviation — use feedback as primary
        compositeScore = Math.round(staticWeight * 0.3 * staticScore + (1 - staticWeight * 0.3) * feedbackScore);
      } else if (deviation > 20) {
        // Significant deviation — flag for review, use weighted average
        compositeScore = Math.round(staticWeight * staticScore + feedbackWeight * feedbackScore);
      } else {
        // Normal range — weighted average
        compositeScore = Math.round(staticWeight * staticScore + feedbackWeight * feedbackScore);
      }
    } else {
      // No feedback data — composite is just the static score
      compositeScore = staticScore;
    }

    // Clamp to 0-100
    compositeScore = Math.max(0, Math.min(100, compositeScore));

    // Compute diversity penalty (Phase 2 — Item 2.6)
    let diversityPenalty = 0;
    let diversity: SourceDiversityScore | undefined;

    if (evidenceSources && evidenceSources.length > 0) {
      diversity = this.computeSourceDiversity(evidenceSources);

      switch (diversity.tier) {
        case 'diverse':
          diversityPenalty = 0;
          break;
        case 'moderate':
          diversityPenalty = -2;
          break;
        case 'concentrated':
          diversityPenalty = -5;
          break;
        case 'single_source':
          diversityPenalty = -10;
          break;
      }

      // Apply diversity penalty to composite score
      compositeScore = Math.max(0, Math.min(100, compositeScore + diversityPenalty));
    }

    return {
      compositeScore,
      staticScore,
      feedbackScore,
      feedbackWeight,
      staticWeight,
      tier: this.getSourceQualityTier(compositeScore),
      hasFeedbackData,
      deviation,
      deviationStatus,
      diversity,
      diversityPenalty: diversityPenalty !== 0 ? diversityPenalty : undefined,
    };
  }

  // ── Source Validation ────────────────────────────────────────────────

  /**
   * Validate whether static TRUST scores still align with observed feedback.
   *
   * Queries all domains in the EvidenceSourceReliability DB table that have
   * at least `minFeedbackSamples` evidence items. For each domain, computes
   * the deviation between the static TRUST score and the observed Bayesian
   * reliability (scaled to 0-100).
   *
   * Validation categories:
   * - `aligned` (≤15 deviation): Static score accurately predicts feedback
   * - `drift` (15-30): Minor drift, should be monitored
   * - `mismatch` (30-50): Significant mismatch, recommend score adjustment
   * - `critical` (>50): Static score is very wrong, needs immediate update
   *
   * @param params - Validation parameters (minFeedbackSamples defaults to 5)
   * @returns Validation result with counts and per-domain details
   */
  static async validateSourceScores(
    params: ValidationResultParams = {},
  ): Promise<ValidationResult> {
    const minSamples = params.minFeedbackSamples ?? 5;

    // Query all domains with enough feedback
    const domainRecords = await db.evidenceSourceReliability.findMany({
      where: {
        totalEvidence: { gte: minSamples },
      },
      orderBy: { totalEvidence: 'desc' },
    });

    const details: ValidationDetail[] = [];
    let aligned = 0;
    let drift = 0;
    let mismatch = 0;
    let critical = 0;

    for (const record of domainRecords) {
      const observedScore = Math.round(record.reliabilityScore * 100);
      const sourceType = DEFAULT_VALIDATION_SOURCE_TYPE;
      const staticScore = this.getBaseReliability(sourceType);
      const deviation = Math.abs(staticScore - observedScore);
      const status = this.classifyDeviation(deviation);

      const recommendedAction = this.getRecommendedAction(status, deviation, record.domain, sourceType);

      // Increment counters
      switch (status) {
        case 'aligned': aligned++; break;
        case 'drift': drift++; break;
        case 'mismatch': mismatch++; break;
        case 'critical': critical++; break;
      }

      details.push({
        domain: record.domain,
        sourceType,
        staticScore,
        observedScore,
        deviation,
        status,
        recommendedAction,
        feedbackCount: record.totalEvidence,
      });
    }

    return {
      evaluated: domainRecords.length,
      aligned,
      drift,
      mismatch,
      critical,
      details,
    };
  }

  // ── Quality Tier ─────────────────────────────────────────────────────

  /**
   * Determine the quality tier for a given reliability score.
   *
   * - `premium` (≥90): Highest quality, suitable for critical decisions
   * - `standard` (≥70): Good quality, suitable for most use cases
   * - `low` (<70): Lower quality, should be used with caution
   *
   * @param score - Reliability score 0-100
   * @returns Quality tier classification
   */
  static getSourceQualityTier(score: number): SourceQualityTier {
    if (score >= 90) return 'premium';
    if (score >= 70) return 'standard';
    return 'low';
  }

  // ── TRUST Score Computation ──────────────────────────────────────────

  /**
   * Compute the full TRUST composite score with dimensional breakdown.
   *
   * Weighting: source(30%) + confidence(25%) + freshness(25%) + evidence(20%)
   *
   * @param metadata - TRUST metadata input with source, confidence, freshness, evidence
   * @returns Full TRUST score result with composite, grade, and dimension breakdown
   */
  static computeTrustScore(metadata: TrustMetadataInput): TrustScoreResult {
    // Source dimension (0-100)
    const sourceScore = this.getBaseReliability(metadata.source);

    // Confidence dimension (0-100) — passed in directly
    const confidenceScore = Math.max(0, Math.min(100, metadata.confidence));

    // Freshness dimension (0-100) — decays linearly over MAX_FRESHNESS_AGE_DAYS
    const freshnessAge = metadata.freshnessAge ?? 0;
    const freshnessDecay = Math.max(0, 1 - freshnessAge / MAX_FRESHNESS_AGE_DAYS);
    const freshnessScore = Math.round(freshnessDecay * 100);

    // Evidence dimension (0-100) — scales with evidence count
    const evidenceCount = metadata.evidenceCount ?? 1;
    const evidenceScore = Math.min(100, Math.round(50 + evidenceCount * 10));

    // Weighted composite
    const compositeScore = Math.round(
      sourceScore * TRUST_WEIGHTS.source +
      confidenceScore * TRUST_WEIGHTS.confidence +
      freshnessScore * TRUST_WEIGHTS.freshness +
      evidenceScore * TRUST_WEIGHTS.evidence,
    );

    // Clamp to 0-100
    const clampedComposite = Math.max(0, Math.min(100, compositeScore));

    return {
      compositeScore: clampedComposite,
      grade: this.scoreToGrade(clampedComposite),
      sourceScore,
      confidenceScore,
      freshnessScore,
      evidenceScore,
      breakdown: {
        source: sourceScore,
        confidence: confidenceScore,
        freshness: freshnessScore,
        evidence: evidenceScore,
      },
    };
  }

  // ── Source Diversity (Phase 2 — Item 2.6) ─────────────────────────

  /**
   * Compute source diversity score from a list of evidence source domains/types.
   *
   * Uses normalized Shannon entropy to measure how evenly distributed
   * evidence is across different sources.
   *
   * Diversity tiers:
   * - 'diverse' (≥0.7): Evidence from many different sources — high trust
   * - 'moderate' (0.4-0.7): Some source concentration — acceptable
   * - 'concentrated' (0.15-0.4): Heavy reliance on few sources — caution
   * - 'single_source' (<0.15): Almost all evidence from one source — penalize
   *
   * @param sources - Array of source identifiers (domains, source types, etc.)
   * @returns Source diversity analysis
   */
  static computeSourceDiversity(sources: string[]): SourceDiversityScore {
    const totalEvidenceCount = sources.length;

    // Edge case: no sources at all
    if (totalEvidenceCount === 0) {
      return {
        diversityScore: 0,
        uniqueSourceCount: 0,
        totalEvidenceCount: 0,
        concentrationRatio: 1,
        sourceBreakdown: [],
        tier: 'single_source',
        recommendation: 'No evidence sources provided. Gather evidence from multiple sources to improve reliability.',
      };
    }

    // Count occurrences per source
    const sourceCounts = new Map<string, number>();
    for (const source of sources) {
      sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
    }

    const uniqueSourceCount = sourceCounts.size;

    // Build breakdown with percentages
    const sourceBreakdown: SourceDiversityScore['sourceBreakdown'] = [];
    for (const [source, count] of sourceCounts.entries()) {
      sourceBreakdown.push({
        source,
        count,
        percentage: count / totalEvidenceCount,
      });
    }
    // Sort by count descending
    sourceBreakdown.sort((a, b) => b.count - a.count);

    // Compute Shannon entropy: H = -sum(p_i * ln(p_i))
    let entropy = 0;
    for (const [, count] of sourceCounts.entries()) {
      const p = count / totalEvidenceCount;
      entropy -= p * Math.log(p);
    }

    // Normalize: H_norm = H / ln(n) where n = number of unique sources
    // This gives 0-1 where 1 = perfectly uniform distribution
    // Edge case: if only 1 unique source, entropy is 0 and ln(1) = 0, so score is 0
    const maxEntropy = Math.log(uniqueSourceCount);
    const diversityScore = maxEntropy === 0 ? 0 : entropy / maxEntropy;

    // Concentration ratio: 1 - diversityScore
    const concentrationRatio = 1 - diversityScore;

    // Determine tier and recommendation
    let tier: SourceDiversityScore['tier'];
    let recommendation: string;

    if (diversityScore >= 0.7) {
      tier = 'diverse';
      recommendation = 'Evidence is well-distributed across multiple sources. No diversity penalty applied.';
    } else if (diversityScore >= 0.4) {
      tier = 'moderate';
      recommendation = 'Some source concentration detected. Consider gathering evidence from additional source types to strengthen reliability.';
    } else if (diversityScore >= 0.15) {
      tier = 'concentrated';
      recommendation = 'Heavy reliance on few sources. Seek corroborating evidence from different source types to reduce concentration risk.';
    } else {
      tier = 'single_source';
      const dominantSource = sourceBreakdown[0]?.source ?? 'unknown';
      recommendation = `Almost all evidence comes from a single source (${dominantSource}). Cross-validate with independent sources before relying on this data.`;
    }

    return {
      diversityScore,
      uniqueSourceCount,
      totalEvidenceCount,
      concentrationRatio,
      sourceBreakdown,
      tier,
      recommendation,
    };
  }

  // ── Source Type Registry ─────────────────────────────────────────────

  /**
   * Get all known source types with their static TRUST scores and descriptions.
   *
   * Returns entries from the canonical `SOURCE_RELIABILITY_SCORES` map,
   * enriched with human-readable descriptions from `SOURCE_LABELS`.
   *
   * @returns Array of source type information objects
   */
  static getAllSourceTypes(): SourceTypeInfo[] {
    const sources: TrustSource[] = [
      'verified_api',
      'customer_data',
      'internal_document',
      'platform_computed',
      'web_intelligence',
      'ai_inference',
    ];

    return sources.map((type) => ({
      type,
      staticScore: SOURCE_RELIABILITY_SCORES[type],
      description: SOURCE_LABELS[type],
    }));
  }

  // ═════════════════════════════════════════════════════════════════════
  // Private Helpers
  // ═════════════════════════════════════════════════════════════════════

  /**
   * Classify a deviation value into a validation status category.
   * @private
   */
  private static classifyDeviation(deviation: number): ValidationStatus {
    if (deviation <= 15) return 'aligned';
    if (deviation <= 30) return 'drift';
    if (deviation <= 50) return 'mismatch';
    return 'critical';
  }

  /**
   * Generate a human-readable recommended action based on validation status.
   * @private
   */
  private static getRecommendedAction(
    status: ValidationStatus,
    deviation: number,
    domain: string,
    sourceType: string,
  ): string {
    switch (status) {
      case 'aligned':
        return 'Static score accurately predicts observed feedback. No action needed.';
      case 'drift':
        return `Minor drift of ${deviation} points detected for ${domain}. Monitor over time; no immediate adjustment required.`;
      case 'mismatch':
        return `Significant mismatch of ${deviation} points for ${domain}. Consider reviewing the static TRUST score for ${sourceType} or investigating domain-specific factors.`;
      case 'critical':
        return `Critical mismatch of ${deviation} points for ${domain}. The static TRUST score for ${sourceType} may be substantially wrong. Immediate review recommended.`;
    }
  }

  /**
   * Convert a numeric score (0-100) to a letter grade.
   * @private
   */
  private static scoreToGrade(score: number): string {
    if (score >= 95) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 70) return 'B';
    if (score >= 55) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  }

  /**
   * Fetch the total evidence count for a domain from the DB.
   * @private
   */
  private static async getDomainFeedbackCount(domain: string): Promise<number> {
    const record = await db.evidenceSourceReliability.findUnique({
      where: { domain },
      select: { totalEvidence: true },
    });
    return record?.totalEvidence ?? 0;
  }
}
