/**
 * Intelligence Fusion Score — Phase 7.2
 *
 * Novel scoring that measures source agreement + diversity.
 * Provides a composite intelligence quality score that goes beyond
 * simple signal counting by evaluating how signals relate to each other.
 *
 * Architecture:
 *
 *   Signals + Evidence → Agreement Analysis → Diversity Analysis → Recency → Depth → Reliability → Fusion Score
 *
 * Dimensions:
 *   - Source Agreement (25%): Do signals of the same type agree?
 *   - Source Diversity (25%): How many different source types contribute?
 *   - Recency (20%): How recent are the signals?
 *   - Evidence Depth (15%): How much evidence supports the signals?
 *   - Reliability (15%): What is the overall source reliability?
 *
 * NON-THROWING DESIGN: computeFusionScore is a pure function that always returns.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface FusionScoreInput {
  companyId: string;
  signals: Array<{
    id: string;
    type: string;
    source: string;
    sourceType: 'sec_filing' | 'news' | 'web_scrape' | 'crunchbase' | 'social' | 'manual' | 'ai_inferred';
    confidence: number;
    timestamp: string;
    impact: 'high' | 'medium' | 'low';
  }>;
  evidenceCount: number;
  sourceReliabilityScore: number;
}

export interface FusionScoreResult {
  companyId: string;
  fusionScore: number; // 0-100
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  dimensions: {
    sourceAgreement: number; // 0-100
    sourceDiversity: number; // 0-100
    recency: number; // 0-100
    evidenceDepth: number; // 0-100
    reliability: number; // 0-100
  };
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

// ── Dimension Weights ──────────────────────────────────────────────────────

const FUSION_WEIGHTS = {
  sourceAgreement: 0.25,
  sourceDiversity: 0.25,
  recency: 0.20,
  evidenceDepth: 0.15,
  reliability: 0.15,
} as const;

// ── Source Type Reliability Baseline ────────────────────────────────────────

const SOURCE_TYPE_RELIABILITY: Record<FusionScoreInput['signals'][0]['sourceType'], number> = {
  sec_filing: 0.95,
  news: 0.75,
  web_scrape: 0.60,
  crunchbase: 0.80,
  social: 0.55,
  manual: 0.90,
  ai_inferred: 0.65,
};

// ── Core Function ──────────────────────────────────────────────────────────

/**
 * Compute the intelligence fusion score for a company.
 * This is a pure function — no database access, no throwing.
 */
export function computeFusionScore(input: FusionScoreInput): FusionScoreResult {
  const signals = input.signals;

  // Handle edge case: no signals
  if (signals.length === 0) {
    return {
      companyId: input.companyId,
      fusionScore: 0,
      grade: 'F',
      dimensions: {
        sourceAgreement: 0,
        sourceDiversity: 0,
        recency: 0,
        evidenceDepth: 0,
        reliability: Math.round(input.sourceReliabilityScore * 100),
      },
      strengths: [],
      weaknesses: ['No signals detected — no intelligence to fuse'],
      recommendations: ['Run intelligence enrichment to detect buying signals and opportunities'],
    };
  }

  // ── Dimension 1: Source Agreement (25%) ──
  const sourceAgreement = computeSourceAgreement(signals);

  // ── Dimension 2: Source Diversity (25%) ──
  const sourceDiversity = computeSourceDiversity(signals);

  // ── Dimension 3: Recency (20%) ──
  const recency = computeRecency(signals);

  // ── Dimension 4: Evidence Depth (15%) ──
  const evidenceDepth = computeEvidenceDepth(input.evidenceCount, signals.length);

  // ── Dimension 5: Reliability (15%) ──
  const reliability = computeReliability(signals, input.sourceReliabilityScore);

  // ── Composite Score ──
  const fusionScore = Math.round(
    sourceAgreement * FUSION_WEIGHTS.sourceAgreement +
    sourceDiversity * FUSION_WEIGHTS.sourceDiversity +
    recency * FUSION_WEIGHTS.recency +
    evidenceDepth * FUSION_WEIGHTS.evidenceDepth +
    reliability * FUSION_WEIGHTS.reliability
  );

  // ── Grade ──
  const grade = scoreToGrade(fusionScore);

  // ── Strengths, Weaknesses, Recommendations ──
  const { strengths, weaknesses, recommendations } = analyzeFusionDimensions({
    sourceAgreement,
    sourceDiversity,
    recency,
    evidenceDepth,
    reliability,
    signalCount: signals.length,
    evidenceCount: input.evidenceCount,
  });

  return {
    companyId: input.companyId,
    fusionScore,
    grade,
    dimensions: {
      sourceAgreement: Math.round(sourceAgreement),
      sourceDiversity: Math.round(sourceDiversity),
      recency: Math.round(recency),
      evidenceDepth: Math.round(evidenceDepth),
      reliability: Math.round(reliability),
    },
    strengths,
    weaknesses,
    recommendations,
  };
}

// ── Dimension Computations ────────────────────────────────────────────────

/**
 * Source Agreement: How much do signals of the same type agree?
 * If signals of same type have similar confidence → high agreement.
 * If they disagree (one high, one low) → penalize.
 */
function computeSourceAgreement(signals: FusionScoreInput['signals']): number {
  if (signals.length < 2) {
    // Single signal: assume moderate agreement
    return 70;
  }

  // Group signals by type
  const typeGroups = new Map<string, typeof signals>();
  for (const sig of signals) {
    const group = typeGroups.get(sig.type) || [];
    group.push(sig);
    typeGroups.set(sig.type, group);
  }

  // If all signals are of different types, agreement is neutral
  if (typeGroups.size === signals.length) {
    return 60;
  }

  let totalAgreement = 0;
  let groupCount = 0;

  for (const [, group] of typeGroups) {
    if (group.length < 2) continue;

    groupCount++;

    // Check pairwise confidence agreement within this type
    let pairAgreements = 0;
    let pairCount = 0;

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const confDiff = Math.abs(group[i].confidence - group[j].confidence);
        // Small diff = high agreement
        const agreement = Math.max(0, 1 - confDiff * 2);
        pairAgreements += agreement;
        pairCount++;
      }
    }

    // Impact-weighted: high-impact signals contribute more
    const impactMultiplier = group.some(s => s.impact === 'high') ? 1.1 : 1.0;
    const avgAgreement = pairCount > 0 ? (pairAgreements / pairCount) * 100 * impactMultiplier : 80;
    totalAgreement += Math.min(100, avgAgreement);
  }

  // If no groups with 2+ signals, but signals exist, return moderate
  if (groupCount === 0) return 70;

  return Math.min(100, totalAgreement / groupCount);
}

/**
 * Source Diversity: How many different source types contribute?
 * Penalize over-reliance on one source type.
 */
function computeSourceDiversity(signals: FusionScoreInput['signals']): number {
  if (signals.length === 0) return 0;

  const sourceTypes = new Set(signals.map(s => s.sourceType));
  const uniqueCount = sourceTypes.size;
  const totalCount = signals.length;

  // Ideal: signals spread across 4+ source types
  // Full diversity (7 types): 100
  // Each unique type contributes proportionally
  const diversityRatio = uniqueCount / 7; // 7 is the total possible source types
  const typeScore = Math.min(1.0, diversityRatio * 1.5); // 1.5x to make 4-5 types score well

  // Penalize if one type dominates (>60% of signals)
  const typeCounts = new Map<string, number>();
  for (const sig of signals) {
    typeCounts.set(sig.sourceType, (typeCounts.get(sig.sourceType) || 0) + 1);
  }
  const maxTypeShare = Math.max(...typeCounts.values()) / totalCount;
  const dominancePenalty = maxTypeShare > 0.6 ? (maxTypeShare - 0.6) * 50 : 0;

  // Bonus for having high-reliability sources
  const hasHighReliability = signals.some(s => SOURCE_TYPE_RELIABILITY[s.sourceType] >= 0.8);
 const reliabilityBonus = hasHighReliability ? 5 : 0;

  return Math.max(0, Math.min(100, typeScore * 100 - dominancePenalty + reliabilityBonus));
}

/**
 * Recency: How recent are the signals?
 * Weighted average based on signal age and impact.
 */
function computeRecency(signals: FusionScoreInput['signals']): number {
  if (signals.length === 0) return 0;

  const now = Date.now();
  let weightedRecency = 0;
  let totalWeight = 0;

  for (const sig of signals) {
    const signalTime = new Date(sig.timestamp).getTime();
    const daysAgo = Math.max(0, (now - signalTime) / (1000 * 60 * 60 * 24));

    // Exponential decay: signal value halves every 30 days
    const recencyValue = Math.max(0, 100 * Math.exp(-daysAgo / 30));

    // Weight by impact
    const impactWeight = sig.impact === 'high' ? 1.5 : sig.impact === 'medium' ? 1.0 : 0.6;

    // Weight by confidence
    const confidenceWeight = sig.confidence;

    const weight = impactWeight * confidenceWeight;
    weightedRecency += recencyValue * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;

  return Math.min(100, weightedRecency / totalWeight);
}

/**
 * Evidence Depth: How much evidence supports the signals?
 * Normalized based on signal count.
 */
function computeEvidenceDepth(evidenceCount: number, signalCount: number): number {
  if (signalCount === 0) return 0;

  // Ideal ratio: 3+ evidence items per signal
  const ratio = evidenceCount / signalCount;

  // Scoring:
  // 0 evidence → 0
  // 1:1 ratio → 40
  // 2:1 ratio → 70
  // 3:1 ratio → 90
  // 5:1 ratio → 100
  let score: number;
  if (ratio >= 5) score = 100;
  else if (ratio >= 3) score = 90 + (ratio - 3) * 5;
  else if (ratio >= 2) score = 70 + (ratio - 2) * 20;
  else if (ratio >= 1) score = 40 + (ratio - 1) * 30;
  else if (ratio > 0) score = ratio * 40;
  else score = 0;

  return Math.min(100, score);
}

/**
 * Reliability: Overall source reliability score.
 * Combines per-signal source type reliability with the provided score.
 */
function computeReliability(
  signals: FusionScoreInput['signals'],
  sourceReliabilityScore: number
): number {
  if (signals.length === 0) {
    return sourceReliabilityScore * 100;
  }

  // Compute weighted average of per-signal source type reliability
  let weightedReliability = 0;
  let totalWeight = 0;

  for (const sig of signals) {
    const typeReliability = SOURCE_TYPE_RELIABILITY[sig.sourceType] || 0.5;
    const weight = sig.impact === 'high' ? 1.5 : sig.impact === 'medium' ? 1.0 : 0.6;
    weightedReliability += typeReliability * weight * sig.confidence;
    totalWeight += weight * sig.confidence;
  }

  const signalReliability = totalWeight > 0 ? weightedReliability / totalWeight : 0.5;

  // Blend signal-based reliability with provided overall reliability (60/40)
  const blended = signalReliability * 0.6 + sourceReliabilityScore * 0.4;

  return Math.min(100, blended * 100);
}

// ── Grade Mapping ──────────────────────────────────────────────────────────

function scoreToGrade(score: number): FusionScoreResult['grade'] {
  if (score >= 95) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}

// ── Strength/Weakness/Recommendation Analysis ──────────────────────────────

interface FusionDimensions {
  sourceAgreement: number;
  sourceDiversity: number;
  recency: number;
  evidenceDepth: number;
  reliability: number;
  signalCount: number;
  evidenceCount: number;
}

function analyzeFusionDimensions(dims: FusionDimensions): {
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
} {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: string[] = [];

  // Source Agreement
  if (dims.sourceAgreement >= 80) {
    strengths.push('High signal agreement — intelligence sources are consistent');
  } else if (dims.sourceAgreement < 50) {
    weaknesses.push('Low signal agreement — conflicting signals may reduce confidence');
    recommendations.push('Review conflicting signals and resolve contradictions before acting');
  }

  // Source Diversity
  if (dims.sourceDiversity >= 70) {
    strengths.push('Excellent source diversity — intelligence from multiple independent sources');
  } else if (dims.sourceDiversity < 40) {
    weaknesses.push('Low source diversity — intelligence may be biased from limited source types');
    recommendations.push('Enrich with additional source types (SEC filings, news, web data) to improve diversity');
  }

  // Recency
  if (dims.recency >= 80) {
    strengths.push('Signals are very recent — intelligence is current and actionable');
  } else if (dims.recency < 40) {
    weaknesses.push('Signals are stale — intelligence may no longer reflect current state');
    recommendations.push('Re-run intelligence enrichment to refresh signals and verify current conditions');
  } else if (dims.recency < 60) {
    recommendations.push('Consider refreshing intelligence — some signals are aging');
  }

  // Evidence Depth
  if (dims.evidenceDepth >= 80) {
    strengths.push('Strong evidence depth — signals are well-supported by corroborating evidence');
  } else if (dims.evidenceDepth < 40) {
    weaknesses.push('Shallow evidence — signals lack corroborating evidence');
    recommendations.push('Gather additional evidence to support signal findings before acting');
  }

  // Reliability
  if (dims.reliability >= 80) {
    strengths.push('High source reliability — intelligence comes from trustworthy sources');
  } else if (dims.reliability < 50) {
    weaknesses.push('Low source reliability — intelligence may not be trustworthy');
    recommendations.push('Prioritize enrichment from high-reliability sources (SEC filings, manual entry, Crunchbase)');
  }

  // Overall signal/evidence counts
  if (dims.signalCount >= 5) {
    strengths.push(`${dims.signalCount} signals detected — rich intelligence coverage`);
  } else if (dims.signalCount <= 1) {
    weaknesses.push('Very few signals — limited intelligence available');
  }

  if (dims.evidenceCount >= 10) {
    strengths.push(`${dims.evidenceCount} evidence items — strong factual foundation`);
  } else if (dims.evidenceCount === 0 && dims.signalCount > 0) {
    weaknesses.push('Signals exist without any corroborating evidence');
  }

  return { strengths, weaknesses, recommendations };
}

/**
 * Get a quick summary of the fusion score for a company.
 * Lightweight version for list views.
 */
export function getFusionScoreSummary(input: FusionScoreInput): {
 score: number;
 grade: string;
 topDimension: string;
 weakDimension: string;
} {
  const result = computeFusionScore(input);

  const dimEntries = Object.entries(result.dimensions) as [string, number][];
  const sorted = dimEntries.sort((a, b) => b[1] - a[1]);

  return {
    score: result.fusionScore,
    grade: result.grade,
    topDimension: formatDimensionName(sorted[0]?.[0] || ''),
    weakDimension: formatDimensionName(sorted[sorted.length - 1]?.[0] || ''),
  };
}

function formatDimensionName(key: string): string {
  const names: Record<string, string> = {
    sourceAgreement: 'Source Agreement',
    sourceDiversity: 'Source Diversity',
    recency: 'Recency',
    evidenceDepth: 'Evidence Depth',
    reliability: 'Reliability',
  };
  return names[key] || key;
}
