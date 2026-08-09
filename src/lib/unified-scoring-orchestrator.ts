/**
 * Unified Scoring Orchestration
 * =============================
 *
 * Detects contradictions between DeepMindQ's 6 scoring systems and
 * resolves them into a single harmonized score per company.
 *
 * SCORING SYSTEMS ORCHESTRATED:
 *   1. Unified Confidence   (ai-unified-confidence.ts) — 6-dimension confidence (0-100)
 *   2. Blended Confidence    (blended-confidence.ts) — weighted blend from 6 sources (0-100)
 *   3. Trust Score           (source-reliability-engine.ts) — TRUST composite (0-100)
 *   4. Account Score         (AccountScore DB model) — priority scoring (0-100)
 *   5. Opportunity Score     (OpportunityRecommendation DB) — opportunity likelihood
 *   6. Source Reliability     (source-reliability-engine.ts) — evidence source quality
 *
 * RESOLUTION STRATEGIES:
 *   - low severity (≤15):    weighted_average — reliability-weighted blend
 *   - medium severity (16-30): trust_highest — defer to higher-reliability system
 *   - high severity (31-50):  evidence_weighted — weight by evidence count
 *   - critical severity (>50): flag_for_review — do NOT auto-resolve
 *
 * FEATURE FLAG: ENABLE_SCORING_ORCHESTRATION (default: false for safety)
 *
 * NON-THROWING: All functions return results, never throw.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { computeUnifiedConfidence, type ConfidenceInput } from '@/lib/ai-unified-confidence';
import { computeBlendedConfidence, type BlendedConfidenceInput } from '@/lib/blended-confidence';
import { SourceReliabilityEngine, type TrustMetadataInput } from '@/lib/scoring/source-reliability-engine';

// ═══════════════════════════════════════════════════════════════════════════
// Feature Flag
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Master feature flag for scoring orchestration.
 * Default: false (computationally expensive, opt-in only).
 */
const ORCHESTRATION_ENABLED = process.env.ENABLE_SCORING_ORCHESTRATION === 'true';

// ═══════════════════════════════════════════════════════════════════════════
// Exported Types
// ═══════════════════════════════════════════════════════════════════════════

/** Snapshot of a single scoring system's output for a company. */
export interface ScoringSystemSnapshot {
  /** Canonical system identifier (e.g. 'unified_confidence'). */
  systemName: string;
  /** Normalized score 0-100. 0 means the system had no data. */
  score: number;
  /** Letter grade (A+/A/B/C/D/F). */
  grade: string;
  /** What this score measures (human-readable). */
  dimension: string;
  /** Module name that produced this score. */
  source: string;
  /** ISO date when this snapshot was captured. */
  computedAt: string;
}

/** A detected contradiction between two scoring systems. */
export interface Contradiction {
  /** Unique identifier for this contradiction record. */
  id: string;
  /** System A identifier. */
  systemA: string;
  /** System B identifier. */
  systemB: string;
  /** Score from system A (0-100). */
  scoreA: number;
  /** Score from system B (0-100). */
  scoreB: number;
  /** Absolute deviation |scoreA - scoreB|. */
  deviation: number;
  /** Severity classification. */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Human-readable description of the contradiction. */
  description: string;
  /** Suggested resolution strategy. */
  suggestedResolution: string;
  /** Resolved score, or null if unresolved / flagged for review. */
  resolvedScore: number | null;
  /** Strategy used for resolution, or null if unresolved. */
  resolutionStrategy: string | null;
}

/** Health status for the overall orchestration result. */
export type OverallHealth = 'healthy' | 'minor_concerns' | 'significant_concerns' | 'critical_concerns';

/** Complete orchestration result for a single company. */
export interface OrchestrationResult {
  /** Company ID that was orchestrated. */
  companyId: string;
  /** Snapshots from all 6 scoring systems. */
  snapshots: ScoringSystemSnapshot[];
  /** Detected contradictions between scoring system pairs. */
  contradictions: Contradiction[];
  /** Final harmonized score (0-100) after resolution. */
  resolvedScore: number;
  /** Description of how the final score was derived. */
  resolutionMethod: string;
  /** Overall health assessment. */
  overallHealth: OverallHealth;
  /** ISO date when orchestration was performed. */
  orchestratedAt: string;
}

/** System-wide orchestration health metrics. */
export interface OrchestrationHealth {
  /** Whether orchestration is enabled via feature flag. */
  enabled: boolean;
  /** Total number of companies that have been orchestrated. */
  totalOrchestrated: number;
  /** Number of companies currently in 'healthy' state. */
  healthyCount: number;
  /** Number of companies with 'minor_concerns'. */
  minorConcernsCount: number;
  /** Number of companies with 'significant_concerns'. */
  significantConcernsCount: number;
  /** Number of companies with 'critical_concerns'. */
  criticalConcernsCount: number;
  /** Total unresolved contradictions across all companies. */
  unresolvedContradictions: number;
  /** Breakdown by severity. */
  contradictionsBySeverity: Record<string, number>;
  /** Most common contradiction pair across the system. */
  topContradictionPair: { systemA: string; systemB: string; count: number } | null;
  /** Companies with the most unresolved critical contradictions. */
  topCriticalCompanies: Array<{ companyId: string; count: number }>;
  /** ISO timestamp of this health check. */
  checkedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Internal Constants
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Reliability weights for each scoring system in weighted_average resolution.
 * Must sum to 1.0.
 */
const SYSTEM_WEIGHTS: Record<string, number> = {
  unified_confidence: 0.25,
  blended_confidence: 0.20,
  trust_score: 0.20,
  account_score: 0.20,
  opportunity_score: 0.15,
  source_reliability: 0.00, // source_reliability is meta — not included in average
};

/** Normalize the system weights to ensure they sum to exactly 1.0. */
const WEIGHT_SUM = Object.values(SYSTEM_WEIGHTS).reduce((a, b) => a + b, 0);
const NORMALIZED_WEIGHTS: Record<string, number> = Object.fromEntries(
  Object.entries(SYSTEM_WEIGHTS).map(([k, v]) => [k, v / WEIGHT_SUM]),
);

/**
 * Static reliability ranking for each scoring system (0-100).
 * Used by trust_highest resolution to pick the more trustworthy system.
 *
 * Rationale:
 *   - unified_confidence: 6-dimension, well-calibrated → highest trust
 *   - trust_score: 4-dimension TRUST composite → high trust
 *   - account_score: DB-derived priority scoring → moderate-high trust
 *   - blended_confidence: multi-source blend, depends on inputs → moderate trust
 *   - opportunity_score: derived from signal matching → moderate trust
 *   - source_reliability: per-domain Bayesian, volatile → lower trust
 */
const SYSTEM_TRUST_RANKING: Record<string, number> = {
  unified_confidence: 92,
  trust_score: 88,
  account_score: 82,
  blended_confidence: 75,
  opportunity_score: 70,
  source_reliability: 60,
};

/** Severity thresholds for deviation. */
const SEVERITY_THRESHOLDS = {
  low: 15,
  medium: 30,
  high: 50,
} as const;

/** Maximum number of recent orchestration results to return for history. */
const DEFAULT_HISTORY_LIMIT = 20;

// ═══════════════════════════════════════════════════════════════════════════
// Internal: Grade Computation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert a numeric score (0-100) to a letter grade.
 * Mirrors the grade scales used across DeepMindQ scoring systems.
 */
function scoreToGrade(score: number): string {
  if (score >= 95) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

// ═══════════════════════════════════════════════════════════════════════════
// Internal: Severity Classification
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Classify a deviation value into a severity level.
 * @param deviation - Absolute difference between two scores (0-100).
 */
function classifySeverity(deviation: number): 'low' | 'medium' | 'high' | 'critical' {
  if (deviation <= SEVERITY_THRESHOLDS.low) return 'low';
  if (deviation <= SEVERITY_THRESHOLDS.medium) return 'medium';
  if (deviation <= SEVERITY_THRESHOLDS.high) return 'high';
  return 'critical';
}

// ═══════════════════════════════════════════════════════════════════════════
// Internal: Data Gathering — Collect Snapshots from All 6 Systems
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Gather scoring data from all 6 scoring systems for a given company.
 *
 * Each system is queried independently. Failures in any single system
 * do not affect the others — a failed system returns a snapshot with
 * score = 0 (indicating no data).
 *
 * @param companyId - The company to gather scores for.
 * @returns Array of up to 6 snapshots, one per scoring system.
 */
async function gatherScoringSnapshots(companyId: string): Promise<ScoringSystemSnapshot[]> {
  const now = new Date().toISOString();
  const snapshots: ScoringSystemSnapshot[] = [];

  // ── 1. Unified Confidence ──
  try {
    // Gather confidence input data from available evidence for this company
    const evidenceItems = await db.evidence.findMany({
      where: { companyId },
      select: { id: true, sourceName: true, sourceDate: true, confidence: true },
      take: 50,
    });

    const signals = await db.companySignal.findMany({
      where: { companyId, status: { in: ['active', 'validated', 'detected'] } },
      select: { id: true, signalDate: true },
      take: 20,
    });

    // Build confidence input from gathered data
    const sources = evidenceItems.map(e => ({
      name: e.sourceName || 'unknown',
      reliability: e.confidence ?? 0.6,
      type: 'evidence',
    }));

    const avgSourceRel = sources.length > 0
      ? sources.reduce((s, src) => s + src.reliability, 0) / sources.length
      : undefined;

    // Compute freshness from most recent evidence
    const latestEvidence = evidenceItems.length > 0
      ? evidenceItems.reduce((latest, e) => {
          const t = e.sourceDate?.getTime() ?? 0;
          return t > latest ? t : latest;
        }, 0)
      : 0;
    const daysSinceResearch = latestEvidence > 0
      ? Math.floor((Date.now() - latestEvidence) / (1000 * 60 * 60 * 24))
      : undefined;

    const confidenceInput: ConfidenceInput = {
      entityId: companyId,
      entityType: 'company',
      sources,
      averageSourceReliability: avgSourceRel,
      evidenceCount: evidenceItems.length,
      daysSinceResearch,
    };

    const result = computeUnifiedConfidence(confidenceInput);
    snapshots.push({
      systemName: 'unified_confidence',
      score: result.score,
      grade: result.grade,
      dimension: '6-dimension confidence (data quality, source reliability, freshness, cross-validation, evidence coverage, AI certainty)',
      source: 'ai-unified-confidence.ts',
      computedAt: now,
    });
  } catch (err) {
    logger.warn('[ScoringOrchestrator] Failed to compute unified confidence', {
      companyId,
      error: err instanceof Error ? err.message : String(err),
    });
    snapshots.push({
      systemName: 'unified_confidence',
      score: 0,
      grade: 'F',
      dimension: '6-dimension confidence',
      source: 'ai-unified-confidence.ts',
      computedAt: now,
    });
  }

  // ── 2. Blended Confidence ──
  try {
    // Use unified confidence score as the base for blending
    const unifiedSnap = snapshots.find(s => s.systemName === 'unified_confidence');
    const baseScore = (unifiedSnap && unifiedSnap.score > 0) ? unifiedSnap.score : 50;

    const blendedInput: BlendedConfidenceInput = {
      baseScore,
      companyId,
    };

    const result = await computeBlendedConfidence(blendedInput);
    snapshots.push({
      systemName: 'blended_confidence',
      score: result.blendedScore,
      grade: scoreToGrade(result.blendedScore),
      dimension: 'weighted blend from 6 intelligence sources (base, calibration, decision learning, knowledge graph, memory, evidence quality)',
      source: 'blended-confidence.ts',
      computedAt: now,
    });
  } catch (err) {
    logger.warn('[ScoringOrchestrator] Failed to compute blended confidence', {
      companyId,
      error: err instanceof Error ? err.message : String(err),
    });
    snapshots.push({
      systemName: 'blended_confidence',
      score: 0,
      grade: 'F',
      dimension: 'weighted blend from 6 sources',
      source: 'blended-confidence.ts',
      computedAt: now,
    });
  }

  // ── 3. Trust Score (TRUST composite) ──
  try {
    const evidenceItems = await db.evidence.findMany({
      where: { companyId },
      select: { id: true, sourceName: true, sourceDate: true, confidence: true },
      take: 50,
    });

    // Determine the most common source type for TRUST input
    const sourceTypeCounts = new Map<string, number>();
    for (const e of evidenceItems) {
      const st = e.sourceName || 'web_intelligence';
      sourceTypeCounts.set(st, (sourceTypeCounts.get(st) ?? 0) + 1);
    }
    let topSourceType = 'web_intelligence';
    let topSourceCount = 0;
    for (const [st, count] of sourceTypeCounts) {
      if (count > topSourceCount) {
        topSourceType = st;
        topSourceCount = count;
      }
    }

    // Compute average confidence from existing unified snapshot
    const unifiedSnap = snapshots.find(s => s.systemName === 'unified_confidence');
    const confidenceForTrust = (unifiedSnap && unifiedSnap.score > 0) ? unifiedSnap.score : 50;

    // Freshness age from most recent evidence
    const latestEvidence = evidenceItems.length > 0
      ? evidenceItems.reduce((latest, e) => {
          const t = e.sourceDate?.getTime() ?? 0;
          return t > latest ? t : latest;
        }, 0)
      : 0;
    const freshnessAge = latestEvidence > 0
      ? Math.floor((Date.now() - latestEvidence) / (1000 * 60 * 60 * 24))
      : 0;

    const trustInput: TrustMetadataInput = {
      source: topSourceType,
      confidence: confidenceForTrust,
      freshnessAge,
      evidenceCount: evidenceItems.length,
    };

    const result = SourceReliabilityEngine.computeTrustScore(trustInput);
    snapshots.push({
      systemName: 'trust_score',
      score: result.compositeScore,
      grade: result.grade,
      dimension: 'TRUST composite (source reliability, confidence, freshness, evidence)',
      source: 'source-reliability-engine.ts',
      computedAt: now,
    });
  } catch (err) {
    logger.warn('[ScoringOrchestrator] Failed to compute trust score', {
      companyId,
      error: err instanceof Error ? err.message : String(err),
    });
    snapshots.push({
      systemName: 'trust_score',
      score: 0,
      grade: 'F',
      dimension: 'TRUST composite',
      source: 'source-reliability-engine.ts',
      computedAt: now,
    });
  }

  // ── 4. Account Score (from AccountScore DB model) ──
  try {
    const accountScore = await db.accountScore.findUnique({
      where: { companyId },
      select: { score: true, calculatedAt: true },
    });

    if (accountScore) {
      snapshots.push({
        systemName: 'account_score',
        score: Math.round(accountScore.score),
        grade: scoreToGrade(Math.round(accountScore.score)),
        dimension: 'priority scoring (intelligence coverage, signal strength, freshness, strategic fit)',
        source: 'AccountScore DB model',
        computedAt: now,
      });
    } else {
      snapshots.push({
        systemName: 'account_score',
        score: 0,
        grade: 'F',
        dimension: 'priority scoring',
        source: 'AccountScore DB model',
        computedAt: now,
      });
    }
  } catch (err) {
    logger.warn('[ScoringOrchestrator] Failed to fetch account score', {
      companyId,
      error: err instanceof Error ? err.message : String(err),
    });
    snapshots.push({
      systemName: 'account_score',
      score: 0,
      grade: 'F',
      dimension: 'priority scoring',
      source: 'AccountScore DB model',
      computedAt: now,
    });
  }

  // ── 5. Opportunity Score (from OpportunityRecommendation DB) ──
  try {
    // Get the highest opportunity score for this company
    const topOpportunity = await db.opportunityRecommendation.findFirst({
      where: {
        companyId,
        status: { in: ['pending_review', 'accepted', 'monitored'] },
      },
      orderBy: { opportunityScore: 'desc' },
      select: { opportunityScore: true },
    });

    if (topOpportunity && topOpportunity.opportunityScore > 0) {
      snapshots.push({
        systemName: 'opportunity_score',
        score: topOpportunity.opportunityScore,
        grade: scoreToGrade(topOpportunity.opportunityScore),
        dimension: 'opportunity likelihood (signal-capability match, business trigger, confidence)',
        source: 'OpportunityRecommendation DB',
        computedAt: now,
      });
    } else {
      snapshots.push({
        systemName: 'opportunity_score',
        score: 0,
        grade: 'F',
        dimension: 'opportunity likelihood',
        source: 'OpportunityRecommendation DB',
        computedAt: now,
      });
    }
  } catch (err) {
    logger.warn('[ScoringOrchestrator] Failed to fetch opportunity score', {
      companyId,
      error: err instanceof Error ? err.message : String(err),
    });
    snapshots.push({
      systemName: 'opportunity_score',
      score: 0,
      grade: 'F',
      dimension: 'opportunity likelihood',
      source: 'OpportunityRecommendation DB',
      computedAt: now,
    });
  }

  // ── 6. Source Reliability (composite from SourceReliabilityEngine) ──
  try {
    const evidenceItems = await db.evidence.findMany({
      where: { companyId },
      select: { sourceName: true, sourceUrl: true },
      distinct: ['sourceName'],
      take: 20,
    });

    if (evidenceItems.length > 0) {
      // Compute average composite reliability across all evidence sources
      let totalComposite = 0;
      let validCount = 0;

      for (const evidence of evidenceItems) {
        const composite = await SourceReliabilityEngine.getCompositeReliability({
          sourceType: evidence.sourceName || 'web_intelligence',
          domain: evidence.sourceName || undefined,
        });
        totalComposite += composite.compositeScore;
        validCount++;
      }

      const avgReliability = validCount > 0 ? Math.round(totalComposite / validCount) : 0;
      snapshots.push({
        systemName: 'source_reliability',
        score: avgReliability,
        grade: scoreToGrade(avgReliability),
        dimension: 'evidence source quality (static TRUST + Bayesian feedback cross-validation)',
        source: 'source-reliability-engine.ts',
        computedAt: now,
      });
    } else {
      snapshots.push({
        systemName: 'source_reliability',
        score: 0,
        grade: 'F',
        dimension: 'evidence source quality',
        source: 'source-reliability-engine.ts',
        computedAt: now,
      });
    }
  } catch (err) {
    logger.warn('[ScoringOrchestrator] Failed to compute source reliability', {
      companyId,
      error: err instanceof Error ? err.message : String(err),
    });
    snapshots.push({
      systemName: 'source_reliability',
      score: 0,
      grade: 'F',
      dimension: 'evidence source quality',
      source: 'source-reliability-engine.ts',
      computedAt: now,
    });
  }

  return snapshots;
}

// ═══════════════════════════════════════════════════════════════════════════
// Internal: Contradiction Detection
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect contradictions by comparing all pairs of scoring systems.
 *
 * Algorithm:
 *   - Compare all 6 choose 2 = 15 pairs
 *   - Compute deviation = |scoreA - scoreB|
 *   - Only flag if BOTH systems have data (score > 0)
 *   - Classify severity: low (≤15), medium (16-30), high (31-50), critical (>50)
 *
 * @param snapshots - Snapshots from all scoring systems.
 * @param companyId - Company ID for persistence.
 * @returns Array of detected contradictions.
 */
function detectContradictions(
  snapshots: ScoringSystemSnapshot[],
  companyId: string,
): Contradiction[] {
  const contradictions: Contradiction[] = [];

  // Only compare snapshots that have actual data
  const activeSnapshots = snapshots.filter(s => s.score > 0);

  for (let i = 0; i < activeSnapshots.length; i++) {
    for (let j = i + 1; j < activeSnapshots.length; j++) {
      const a = activeSnapshots[i];
      const b = activeSnapshots[j];
      const deviation = Math.abs(a.score - b.score);
      const severity = classifySeverity(deviation);

      // Generate a deterministic ID from the system pair + company
      const pairKey = [a.systemName, b.systemName].sort().join('::');
      const id = `contradiction_${companyId}_${pairKey}`;

      const description = `${a.systemName} (${a.score}) vs ${b.systemName} (${b.score}): ${deviation}-point deviation. ${a.systemName} measures ${a.dimension.split('(')[0].trim()}, while ${b.systemName} measures ${b.dimension.split('(')[0].trim()}.`;

      const suggestedResolution = getSuggestedResolution(severity, a, b);

      contradictions.push({
        id,
        systemA: a.systemName,
        systemB: b.systemName,
        scoreA: a.score,
        scoreB: b.score,
        deviation,
        severity,
        description,
        suggestedResolution,
        resolvedScore: null,
        resolutionStrategy: null,
      });
    }
  }

  return contradictions;
}

/**
 * Get the suggested resolution description for a given severity level.
 */
function getSuggestedResolution(
  severity: 'low' | 'medium' | 'high' | 'critical',
  a: ScoringSystemSnapshot,
  _b: ScoringSystemSnapshot,
): string {
  switch (severity) {
    case 'low':
      return 'Minor deviation within tolerance. Use weighted average of both systems.';
    case 'medium':
      return 'Moderate deviation. Defer to the scoring system with higher source reliability.';
    case 'high':
      return 'Significant deviation. Weight resolution by available evidence count backing each score.';
    case 'critical':
      return 'Extreme deviation. Cannot auto-resolve — requires human review to determine which system is correct.';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Internal: Contradiction Resolution
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resolve all detected contradictions using severity-appropriate strategies.
 *
 * Resolution strategies:
 *   - low:    weighted_average — use normalized system reliability weights
 *   - medium: trust_highest — use the score from the system with higher trust ranking
 *   - high:   evidence_weighted — weight by evidence count (proxied by system trust ranking)
 *   - critical: flag_for_review — do NOT auto-resolve, leave null
 *
 * @param contradictions - Detected contradictions to resolve.
 * @param snapshots - Original snapshots (for evidence context).
 * @returns Contradictions with resolved scores and strategies filled in.
 */
function resolveContradictions(
  contradictions: Contradiction[],
  snapshots: ScoringSystemSnapshot[],
): Contradiction[] {
  return contradictions.map(contradiction => {
    const { severity, systemA, systemB, scoreA, scoreB } = contradiction;

    switch (severity) {
      case 'low': {
        // Weighted average using system reliability weights
        const weightA = NORMALIZED_WEIGHTS[systemA] ?? 0.1;
        const weightB = NORMALIZED_WEIGHTS[systemB] ?? 0.1;
        const totalWeight = weightA + weightB;
        const resolved = totalWeight > 0
          ? Math.round(((scoreA * weightA) + (scoreB * weightB)) / totalWeight)
          : Math.round((scoreA + scoreB) / 2);

        return {
          ...contradiction,
          resolvedScore: clampScore(resolved),
          resolutionStrategy: 'weighted_average',
        };
      }

      case 'medium': {
        // Trust the system with higher static trust ranking
        const trustA = SYSTEM_TRUST_RANKING[systemA] ?? 50;
        const trustB = SYSTEM_TRUST_RANKING[systemB] ?? 50;
        const resolved = trustA >= trustB ? scoreA : scoreB;

        return {
          ...contradiction,
          resolvedScore: clampScore(resolved),
          resolutionStrategy: 'trust_highest',
        };
      }

      case 'high': {
        // Evidence-weighted: use trust ranking as a proxy for evidence backing
        // Systems with higher trust rankings generally have more/better evidence
        const trustA = SYSTEM_TRUST_RANKING[systemA] ?? 50;
        const trustB = SYSTEM_TRUST_RANKING[systemB] ?? 50;
        const totalTrust = trustA + trustB;
        const resolved = totalTrust > 0
          ? Math.round(((scoreA * trustA) + (scoreB * trustB)) / totalTrust)
          : Math.round((scoreA + scoreB) / 2);

        return {
          ...contradiction,
          resolvedScore: clampScore(resolved),
          resolutionStrategy: 'evidence_weighted',
        };
      }

      case 'critical': {
        // Do NOT auto-resolve — flag for human review
        return {
          ...contradiction,
          resolvedScore: null,
          resolutionStrategy: 'flag_for_review',
        };
      }
    }
  });
}

/**
 * Clamp a score to the valid 0-100 range.
 */
function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

// ═══════════════════════════════════════════════════════════════════════════
// Internal: Final Score Computation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute the final harmonized score from snapshots and resolved contradictions.
 *
 * Algorithm:
 *   1. If there are no active snapshots, return 0.
 *   2. If there are no contradictions, use a simple weighted average of active systems.
 *   3. If there are contradictions, compute a weighted average where:
 *      - Resolved contradictions contribute their resolved score
 *      - Unresolved (critical) contradictions use the higher-trust system's score
 *   4. If all systems agree (low max deviation), use weighted average directly.
 *
 * @param snapshots - All scoring system snapshots.
 * @param contradictions - Detected (and possibly resolved) contradictions.
 * @returns Object with final score and description of the method used.
 */
function computeFinalScore(
  snapshots: ScoringSystemSnapshot[],
  contradictions: Contradiction[],
): { score: number; method: string } {
  const activeSnapshots = snapshots.filter(s => s.score > 0);

  if (activeSnapshots.length === 0) {
    return { score: 0, method: 'no_data' };
  }

  // If only one system has data, use it directly
  if (activeSnapshots.length === 1) {
    return {
      score: activeSnapshots[0].score,
      method: `single_system (${activeSnapshots[0].systemName})`,
    };
  }

  // Check if there are any non-trivial contradictions (medium or above)
  const significantContradictions = contradictions.filter(
    c => c.severity !== 'low',
  );

  if (significantContradictions.length === 0) {
    // No significant contradictions — use weighted average
    let totalWeight = 0;
    let weightedSum = 0;

    for (const snap of activeSnapshots) {
      const w = NORMALIZED_WEIGHTS[snap.systemName] ?? 0.1;
      weightedSum += snap.score * w;
      totalWeight += w;
    }

    const finalScore = totalWeight > 0
      ? Math.round(weightedSum / totalWeight)
      : Math.round(activeSnapshots.reduce((s, snap) => s + snap.score, 0) / activeSnapshots.length);

    return {
      score: clampScore(finalScore),
      method: `weighted_average (${activeSnapshots.length} systems, no significant contradictions)`,
    };
  }

  // There are significant contradictions — use resolved scores where available
  const hasCriticalUnresolved = contradictions.some(
    c => c.severity === 'critical' && c.resolvedScore === null,
  );

  if (hasCriticalUnresolved) {
    // For critical unresolved contradictions, use the higher-trust system's score
    // and downweight the lower-trust system
    const systemScoreMap = new Map<string, { score: number; effectiveWeight: number }>();

    // Initialize with base weights
    for (const snap of activeSnapshots) {
      systemScoreMap.set(snap.systemName, {
        score: snap.score,
        effectiveWeight: NORMALIZED_WEIGHTS[snap.systemName] ?? 0.1,
      });
    }

    // Adjust weights based on critical contradictions
    for (const c of contradictions) {
      if (c.severity === 'critical' && c.resolvedScore === null) {
        // Penalize the lower-trust system by halving its weight
        const trustA = SYSTEM_TRUST_RANKING[c.systemA] ?? 50;
        const trustB = SYSTEM_TRUST_RANKING[c.systemB] ?? 50;
        const loser = trustA >= trustB ? c.systemB : c.systemA;

        const entry = systemScoreMap.get(loser);
        if (entry) {
          entry.effectiveWeight *= 0.3; // Heavy penalty for being contradicted at critical level
        }
      }
    }

    let totalWeight = 0;
    let weightedSum = 0;
    for (const [, entry] of systemScoreMap) {
      weightedSum += entry.score * entry.effectiveWeight;
      totalWeight += entry.effectiveWeight;
    }

    const finalScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;

    return {
      score: clampScore(finalScore),
      method: `trust_penalized_average (${activeSnapshots.length} systems, ${contradictions.filter(c => c.severity === 'critical').length} critical unresolved)`,
    };
  }

  // All significant contradictions are resolved — use resolved scores
  // Build a score map from resolved contradictions
  const resolvedScores = new Map<string, number[]>();
  for (const snap of activeSnapshots) {
    resolvedScores.set(snap.systemName, [snap.score]);
  }
  for (const c of contradictions) {
    if (c.resolvedScore !== null) {
      // Add resolved score to both systems (they converge)
      if (!resolvedScores.has(c.systemA)) resolvedScores.set(c.systemA, []);
      if (!resolvedScores.has(c.systemB)) resolvedScores.set(c.systemB, []);
      resolvedScores.get(c.systemA)!.push(c.resolvedScore);
      resolvedScores.get(c.systemB)!.push(c.resolvedScore);
    }
  }

  // Average each system's scores (original + resolved contributions)
  let totalWeight = 0;
  let weightedSum = 0;

  for (const [systemName, scores] of resolvedScores) {
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const w = NORMALIZED_WEIGHTS[systemName] ?? 0.1;
    weightedSum += avgScore * w;
    totalWeight += w;
  }

  const finalScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;

  return {
    score: clampScore(finalScore),
    method: `resolved_weighted_average (${activeSnapshots.length} systems, ${significantContradictions.length} contradictions resolved)`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Internal: Overall Health Assessment
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Determine overall health based on contradiction severities.
 *
 * - healthy: no contradictions, or only low-severity ones
 * - minor_concerns: at least one medium-severity contradiction
 * - significant_concerns: at least one high-severity contradiction
 * - critical_concerns: at least one critical-severity contradiction
 */
function assessOverallHealth(contradictions: Contradiction[]): OverallHealth {
  if (contradictions.length === 0) return 'healthy';

  const severityOrder: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
  const maxSeverity = contradictions.reduce((max, c) => {
    return (severityOrder[c.severity] ?? 0) > (severityOrder[max] ?? 0) ? c.severity : max;
  }, 'low');

  switch (maxSeverity) {
    case 'critical': return 'critical_concerns';
    case 'high': return 'significant_concerns';
    case 'medium': return 'minor_concerns';
    case 'low': return 'healthy';
    default: return 'healthy';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Internal: DB Persistence
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Persist detected contradictions to the ScoringContradictionResolution table.
 *
 * Only persists non-trivial (medium+) contradictions to avoid DB bloat.
 * Critical contradictions are persisted with resolvedScore = null.
 *
 * @param companyId - Company ID.
 * @param contradictions - Contradictions to persist.
 */
async function persistContradictions(
  companyId: string,
  contradictions: Contradiction[],
): Promise<void> {
  // Only persist medium and above to reduce DB noise
  const toPersist = contradictions.filter(c => c.severity !== 'low');

  if (toPersist.length === 0) return;

  try {
    // Close previous unresolved records for this company (they get replaced)
    await db.scoringContradictionResolution.updateMany({
      where: {
        companyId,
        resolvedAt: null,
      },
      data: {
        resolvedAt: new Date(),
        resolutionReason: 'Auto-superseded by re-orchestration',
      },
    });

    // Create new records
    for (const c of toPersist) {
      await db.scoringContradictionResolution.create({
        data: {
          companyId,
          scoringSystemA: c.systemA,
          scoringSystemB: c.systemB,
          scoreA: c.scoreA,
          scoreB: c.scoreB,
          deviation: c.deviation,
          severity: c.severity,
          resolutionStrategy: c.resolutionStrategy ?? 'pending',
          resolvedScore: c.resolvedScore,
          resolutionReason: c.suggestedResolution,
        },
      });
    }
  } catch (err) {
    logger.error('[ScoringOrchestrator] Failed to persist contradictions', {
      companyId,
      error: err instanceof Error ? err.message : String(err),
    });
    // Non-throwing — don't let DB errors break the orchestration
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API: Orchestrate Scores
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Orchestrate all scoring systems for a company — detect and resolve contradictions.
 *
 * This is the main entry point. It:
 *   1. Gathers snapshots from all 6 scoring systems
 *   2. Detects pairwise contradictions (15 pairs)
 *   3. Resolves contradictions using severity-appropriate strategies
 *   4. Computes a final harmonized score
 *   5. Persists contradictions to DB
 *
 * NON-THROWING: Returns a result even if individual systems fail.
 * If the feature flag is disabled, returns a minimal result with score 0.
 *
 * @param companyId - The company to orchestrate scores for.
 * @returns Complete orchestration result with snapshots, contradictions, and resolved score.
 *
 * @example
 * ```ts
 * const result = await orchestrateScores('company_123');
 * console.log(result.resolvedScore);  // 72
 * console.log(result.overallHealth);  // 'minor_concerns'
 * console.log(result.contradictions);  // [{ systemA: 'unified_confidence', systemB: 'account_score', ... }]
 * ```
 */
export async function orchestrateScores(companyId: string): Promise<OrchestrationResult> {
  const orchestratedAt = new Date().toISOString();

  // Feature flag guard
  if (!ORCHESTRATION_ENABLED) {
    logger.debug('[ScoringOrchestrator] Orchestration disabled (ENABLE_SCORING_ORCHESTRATION not set)', {
      companyId,
    });
    return {
      companyId,
      snapshots: [],
      contradictions: [],
      resolvedScore: 0,
      resolutionMethod: 'disabled (feature flag off)',
      overallHealth: 'healthy',
      orchestratedAt,
    };
  }

  try {
    // Step 1: Gather snapshots from all 6 scoring systems
    const snapshots = await gatherScoringSnapshots(companyId);

    const activeSystemCount = snapshots.filter(s => s.score > 0).length;
    logger.info('[ScoringOrchestrator] Gathered scoring snapshots', {
      companyId,
      totalSystems: snapshots.length,
      activeSystems: activeSystemCount,
    });

    // Step 2: Detect contradictions
    const rawContradictions = detectContradictions(snapshots, companyId);

    logger.info('[ScoringOrchestrator] Detected contradictions', {
      companyId,
      totalPairs: (snapshots.filter(s => s.score > 0).length * (snapshots.filter(s => s.score > 0).length - 1)) / 2,
      contradictions: rawContradictions.length,
      bySeverity: {
        low: rawContradictions.filter(c => c.severity === 'low').length,
        medium: rawContradictions.filter(c => c.severity === 'medium').length,
        high: rawContradictions.filter(c => c.severity === 'high').length,
        critical: rawContradictions.filter(c => c.severity === 'critical').length,
      },
    });

    // Step 3: Resolve contradictions
    const resolvedContradictions = resolveContradictions(rawContradictions, snapshots);

    // Step 4: Compute final score
    const { score: resolvedScore, method: resolutionMethod } = computeFinalScore(
      snapshots,
      resolvedContradictions,
    );

    // Step 5: Assess overall health
    const overallHealth = assessOverallHealth(resolvedContradictions);

    // Step 6: Persist contradictions to DB (non-blocking)
    // Fire and forget — don't await, but we do await for consistency
    await persistContradictions(companyId, resolvedContradictions);

    logger.info('[ScoringOrchestrator] Orchestration complete', {
      companyId,
      resolvedScore,
      overallHealth,
      resolutionMethod,
      contradictionsResolved: resolvedContradictions.filter(c => c.resolvedScore !== null).length,
      contradictionsUnresolved: resolvedContradictions.filter(c => c.resolvedScore === null).length,
    });

    return {
      companyId,
      snapshots,
      contradictions: resolvedContradictions,
      resolvedScore,
      resolutionMethod,
      overallHealth,
      orchestratedAt,
    };
  } catch (err) {
    logger.error('[ScoringOrchestrator] Orchestration failed', {
      companyId,
      error: err instanceof Error ? err.message : String(err),
    });

    // Return a graceful fallback — never throw
    return {
      companyId,
      snapshots: [],
      contradictions: [],
      resolvedScore: 0,
      resolutionMethod: 'error_fallback',
      overallHealth: 'critical_concerns',
      orchestratedAt,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API: Orchestration History
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get orchestration history for a company.
 *
 * Returns past contradiction resolutions from the ScoringContradictionResolution
 * table, ordered by most recent first.
 *
 * Since the orchestration result itself is not persisted as a whole (only
 * contradictions are), we reconstruct the history from persisted contradiction
 * records grouped by detection time.
 *
 * NON-THROWING: Returns empty array on error.
 *
 * @param companyId - The company to get history for.
 * @param limit - Maximum number of historical results to return (default: 20).
 * @returns Array of orchestration-like results reconstructed from DB records.
 */
export async function getOrchestrationHistory(
  companyId: string,
  limit: number = DEFAULT_HISTORY_LIMIT,
): Promise<OrchestrationResult[]> {
  try {
    const records = await db.scoringContradictionResolution.findMany({
      where: { companyId },
      orderBy: { detectedAt: 'desc' },
      take: limit,
    });

    if (records.length === 0) return [];

    // Group records by detectedAt day (approximate orchestration batches)
    const batches = new Map<string, typeof records>();
    for (const record of records) {
      const dayKey = record.detectedAt.toISOString().split('T')[0];
      if (!batches.has(dayKey)) batches.set(dayKey, []);
      batches.get(dayKey)!.push(record);
    }

    const results: OrchestrationResult[] = [];

    for (const [dayKey, batchRecords] of batches) {
      const contradictions: Contradiction[] = batchRecords.map(r => ({
        id: r.id,
        systemA: r.scoringSystemA,
        systemB: r.scoringSystemB,
        scoreA: r.scoreA,
        scoreB: r.scoreB,
        deviation: r.deviation,
        severity: r.severity as Contradiction['severity'],
        description: `${r.scoringSystemA} (${r.scoreA}) vs ${r.scoringSystemB} (${r.scoreB}): ${r.deviation}-point deviation`,
        suggestedResolution: r.resolutionReason ?? '',
        resolvedScore: r.resolvedScore,
        resolutionStrategy: r.resolutionStrategy,
      }));

      const severityOrder: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
      const maxSeverity = contradictions.reduce((max: string, c) => {
        return (severityOrder[c.severity] ?? 0) > (severityOrder[max] ?? 0) ? c.severity : max;
      }, 'low');

      const overallHealth = assessOverallHealth(contradictions);

      // Reconstruct a rough resolved score from the records
      const resolvedScores = contradictions
        .filter(c => c.resolvedScore !== null)
        .map(c => c.resolvedScore as number);
      const avgResolved = resolvedScores.length > 0
        ? Math.round(resolvedScores.reduce((a, b) => a + b, 0) / resolvedScores.length)
        : 0;

      results.push({
        companyId,
        snapshots: [], // Historical snapshots not persisted
        contradictions,
        resolvedScore: avgResolved,
        resolutionMethod: `reconstructed_from_history (${batchRecords.length} records on ${dayKey})`,
        overallHealth,
        orchestratedAt: batchRecords[0].detectedAt.toISOString(),
      });
    }

    return results;
  } catch (err) {
    logger.error('[ScoringOrchestrator] Failed to get orchestration history', {
      companyId,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API: System Health
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get system-wide orchestration health.
 *
 * Aggregates metrics across all companies that have been orchestrated:
 *   - Total orchestrated companies
 *   - Health distribution
 *   - Unresolved contradictions by severity
 *   - Most common contradiction pairs
 *   - Companies with most critical contradictions
 *
 * NON-THROWING: Returns a minimal health object on error.
 *
 * @returns System-wide orchestration health metrics.
 */
export async function getSystemHealth(): Promise<OrchestrationHealth> {
  const checkedAt = new Date().toISOString();

  const emptyHealth: OrchestrationHealth = {
    enabled: ORCHESTRATION_ENABLED,
    totalOrchestrated: 0,
    healthyCount: 0,
    minorConcernsCount: 0,
    significantConcernsCount: 0,
    criticalConcernsCount: 0,
    unresolvedContradictions: 0,
    contradictionsBySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
    topContradictionPair: null,
    topCriticalCompanies: [],
    checkedAt,
  };

  if (!ORCHESTRATION_ENABLED) {
    return emptyHealth;
  }

  try {
    // Get all contradiction records
    const allRecords = await db.scoringContradictionResolution.findMany({
      select: {
        companyId: true,
        severity: true,
        scoringSystemA: true,
        scoringSystemB: true,
        resolvedAt: true,
      },
    });

    if (allRecords.length === 0) {
      return emptyHealth;
    }

    // Count unique companies that have been orchestrated
    const uniqueCompanies = new Set(allRecords.map(r => r.companyId));
    const totalOrchestrated = uniqueCompanies.size;

    // Count unresolved contradictions
    const unresolved = allRecords.filter(r => r.resolvedAt === null);
    const unresolvedContradictions = unresolved.length;

    // Count by severity
    const contradictionsBySeverity: Record<string, number> = {
      low: 0, medium: 0, high: 0, critical: 0,
    };
    for (const r of allRecords) {
      contradictionsBySeverity[r.severity] = (contradictionsBySeverity[r.severity] ?? 0) + 1;
    }

    // Determine health distribution per company
    // Group by company and find max severity
    const companyMaxSeverity = new Map<string, string>();
    for (const r of allRecords) {
      const current = companyMaxSeverity.get(r.companyId);
      const order: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
      if (!current || (order[r.severity] ?? 0) > (order[current] ?? 0)) {
        companyMaxSeverity.set(r.companyId, r.severity);
      }
    }

    let healthyCount = 0;
    let minorConcernsCount = 0;
    let significantConcernsCount = 0;
    let criticalConcernsCount = 0;

    for (const [, maxSev] of companyMaxSeverity) {
      switch (maxSev) {
        case 'low': healthyCount++; break;
        case 'medium': minorConcernsCount++; break;
        case 'high': significantConcernsCount++; break;
        case 'critical': criticalConcernsCount++; break;
      }
    }

    // Find most common contradiction pair
    const pairCounts = new Map<string, number>();
    for (const r of allRecords) {
      const pairKey = [r.scoringSystemA, r.scoringSystemB].sort().join('::');
      pairCounts.set(pairKey, (pairCounts.get(pairKey) ?? 0) + 1);
    }

    let topContradictionPair: { systemA: string; systemB: string; count: number } | null = null;
    let maxPairCount = 0;
    for (const [pairKey, count] of pairCounts) {
      if (count > maxPairCount) {
        maxPairCount = count;
        const [systemA, systemB] = pairKey.split('::');
        topContradictionPair = { systemA, systemB, count };
      }
    }

    // Find companies with most critical contradictions
    const criticalByCompany = new Map<string, number>();
    for (const r of unresolved) {
      if (r.severity === 'critical') {
        criticalByCompany.set(
          r.companyId,
          (criticalByCompany.get(r.companyId) ?? 0) + 1,
        );
      }
    }
    const topCriticalCompanies = Array.from(criticalByCompany.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([companyId, count]) => ({ companyId, count }));

    return {
      enabled: ORCHESTRATION_ENABLED,
      totalOrchestrated,
      healthyCount,
      minorConcernsCount,
      significantConcernsCount,
      criticalConcernsCount,
      unresolvedContradictions,
      contradictionsBySeverity,
      topContradictionPair,
      topCriticalCompanies,
      checkedAt,
    };
  } catch (err) {
    logger.error('[ScoringOrchestrator] Failed to get system health', {
      error: err instanceof Error ? err.message : String(err),
    });
    return emptyHealth;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API: Manual Contradiction Resolution
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Manually resolve a contradiction.
 *
 * Used by human reviewers to resolve critical-severity contradictions
 * that were flagged for review. Updates the ScoringContradictionResolution
 * record in the DB with the provided strategy and optional resolved score.
 *
 * NON-THROWING: Logs errors but never throws.
 *
 * @param contradictionId - The ID of the contradiction record to resolve.
 * @param strategy - The resolution strategy used (e.g., 'manual_review', 'trust_system_a').
 * @param resolvedScore - Optional resolved score. If not provided, the record
 *   is marked as resolved but without a specific score.
 */
export async function resolveContradiction(
  contradictionId: string,
  strategy: string,
  resolvedScore?: number,
): Promise<void> {
  try {
    const existing = await db.scoringContradictionResolution.findUnique({
      where: { id: contradictionId },
      select: { id: true, resolvedAt: true },
    });

    if (!existing) {
      logger.warn('[ScoringOrchestrator] Cannot resolve — contradiction not found', {
        contradictionId,
      });
      return;
    }

    if (existing.resolvedAt) {
      logger.warn('[ScoringOrchestrator] Contradiction already resolved', {
        contradictionId,
        resolvedAt: existing.resolvedAt.toISOString(),
      });
      return;
    }

    await db.scoringContradictionResolution.update({
      where: { id: contradictionId },
      data: {
        resolutionStrategy: strategy,
        resolvedScore: resolvedScore !== undefined ? resolvedScore : null,
        resolutionReason: `Manually resolved with strategy: ${strategy}`,
        resolvedAt: new Date(),
      },
    });

    logger.info('[ScoringOrchestrator] Contradiction manually resolved', {
      contradictionId,
      strategy,
      resolvedScore,
    });
  } catch (err) {
    logger.error('[ScoringOrchestrator] Failed to resolve contradiction', {
      contradictionId,
      strategy,
      resolvedScore,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
