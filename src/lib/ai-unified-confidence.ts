/**
 * Unified AI Confidence Engine — WI-16C
 * ========================================
 *
 * Replaces the fragmented confidence systems with a single, unified model.
 * Merges:
 *   - intelligence-sources/confidence-engine.ts (3-factor composite)
 *   - engines/scoring-engine.ts (9-dimension revenue score)
 *   - ai-copilot/quality-gates.ts (4-gate quality)
 *
 * Into one consistent confidence framework that produces:
 *   - A unified confidence score (0-100)
 *   - A confidence grade (A+ through F)
 *   - A multi-factor breakdown
 *   - Explainability (why this score?)
 *   - Calibration data (accuracy over time)
 *   - Trust classification (enterprise / advisory / speculative)
 *
 * CONFIDENCE FORMULA (6 dimensions):
 *
 *   Confidence = Data Quality (20%) + Source Reliability (20%) + Freshness (15%)
 *              + Cross Validation (15%) + Evidence Coverage (15%) + AI Certainty (15%)
 *
 * NON-THROWING: All functions return results, never throw.
 */

import { logger } from '@/lib/logger';

// ── Types ────────────────────────────────────────────────────────────────────

export type ConfidenceGrade = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
export type TrustClassification = 'enterprise' | 'advisory' | 'speculative' | 'unreliable';
export type ConfidenceDimension = 'data_quality' | 'source_reliability' | 'freshness' | 'cross_validation' | 'evidence_coverage' | 'ai_certainty';

export interface ConfidenceFactor {
  /** Dimension name. */
  dimension: ConfidenceDimension;
  /** Score 0-100 for this dimension. */
  score: number;
  /** Weight 0-1 in the composite formula. */
  weight: number;
  /** Human-readable explanation of why this score. */
  explanation: string;
  /** Positive signals that increased this score. */
  positiveSignals: string[];
  /** Negative signals that decreased this score. */
  negativeSignals: string[];
}

export interface ConfidenceResult {
  /** Unified confidence score 0-100. */
  score: number;
  /** Letter grade. */
  grade: ConfidenceGrade;
  /** Trust classification for enterprise use. */
  trustClass: TrustClassification;
  /** Whether this meets enterprise trust threshold (score >= 70). */
  enterpriseReady: boolean;
  /** Per-dimension breakdown. */
  factors: ConfidenceFactor[];
  /** Human-readable summary. */
  summary: string;
  /** Recommendations for improving confidence. */
  recommendations: string[];
  /** Timestamp. */
  timestamp: string;
  /** Version of the confidence model. */
  modelVersion: string;
}

export interface ConfidenceInput {
  /** Entity being scored (company ID, contact ID, etc.). */
  entityId?: string;
  /** Entity type for context-specific scoring. */
  entityType?: 'company' | 'contact' | 'opportunity' | 'signal' | 'insight';

  // ── Data Quality (20%) ──
  /** Field confidence scores from research context (0-1 per field). */
  fieldConfidence?: Record<string, number>;
  /** How many fields have data vs expected. */
  dataCompleteness?: number; // 0-1

  // ── Source Reliability (20%) ──
  /** Sources used, with reliability scores. */
  sources?: Array<{
    name: string;
    reliability: number; // 0-1
    type: string;
    url?: string | null;
  }>;
  /** Average source reliability (pre-computed). */
  averageSourceReliability?: number;

  // ── Freshness (15%) ──
  /** Days since last research/enrichment. */
  daysSinceResearch?: number;
  /** Per-domain freshness. */
  domainFreshness?: Record<string, { score: number; daysElapsed: number }>;
  /** Overall freshness score (0-100). */
  freshnessScore?: number;

  // ── Cross Validation (15%) ──
  /** Number of independent sources confirming the same facts. */
  crossValidatedFacts?: number;
  /** Total facts claimed. */
  totalFacts?: number;
  /** Number of contradictions detected. */
  contradictions?: number;

  // ── Evidence Coverage (15%) ──
  /** Number of evidence items available. */
  evidenceCount?: number;
  /** Coverage score from GroundingEngine (0-1). */
  evidenceCoverage?: number;
  /** Number of evidence gaps. */
  evidenceGaps?: number;
  /** Dimensions covered vs expected. */
  coveredDimensions?: number;
  expectedDimensions?: number;

  // ── AI Certainty (15%) ──
  /** LLM's own confidence in its output (if available). */
  aiOutputConfidence?: number;
  /** Hallucination risk score from post-generation check (0-100, lower = better). */
  hallucinationRiskScore?: number;
  /** Quality gate results. */
  qualityGateScore?: number;
}

// ── Source Reliability Registry ──────────────────────────────────────────────

/**
 * Known source reliability ratings. Based on editorial standards,
 * not user-editable. Used as defaults when source metadata is missing.
 */
const SOURCE_RELIABILITY: Record<string, number> = {
  // Government & Regulatory (highest)
  'sec.gov': 0.95,
  'gov.uk': 0.95,
  'congress.gov': 0.95,
  'europa.eu': 0.95,
  'irs.gov': 0.94,

  // Financial & Business (high)
  'bloomberg.com': 0.92,
  'reuters.com': 0.92,
  'wsj.com': 0.90,
  'ft.com': 0.90,
  'yahoo.finance': 0.82,
  'marketwatch.com': 0.85,

  // Company Direct (high)
  'company website': 0.88,
  'press release': 0.85,
  'investor relations': 0.90,
  'annual report': 0.93,
  '10-K filing': 0.95,

  // Crunchbase & Funding (medium-high)
  'crunchbase.com': 0.85,
  'pitchbook.com': 0.85,
  'techcrunch.com': 0.78,
  'venturebeat.com': 0.78,
  'businessinsider.com': 0.75,

  // Professional Networks (medium)
  'linkedin.com': 0.75,
  'glassdoor.com': 0.72,
  'angel.co': 0.70,

  // News & Media (medium)
  'nytimes.com': 0.88,
  'washingtonpost.com': 0.88,
  'theguardian.com': 0.85,
  'apnews.com': 0.88,
  'bbc.com': 0.87,
  'cnn.com': 0.80,

  // Tech & Developer (medium)
  'github.com': 0.80,
  'stackoverflow.com': 0.78,
  'dev.to': 0.65,
  'medium.com': 0.60,

  // Job Boards (medium-low)
  'indeed.com': 0.70,
  'greenhouse.io': 0.72,
  'lever.co': 0.72,

  // Social Media (low)
  'twitter.com': 0.55,
  'x.com': 0.55,
  'reddit.com': 0.50,
  'facebook.com': 0.45,

  // Default for unknown sources
  'unknown': 0.60,
};

/**
 * Get source reliability score.
 */
export function getSourceReliability(sourceName: string): number {
  // Direct lookup
  if (SOURCE_RELIABILITY[sourceName] !== undefined) {
    return SOURCE_RELIABILITY[sourceName];
  }

  // Domain-based lookup
  try {
    const url = sourceName.toLowerCase();
    for (const [domain, reliability] of Object.entries(SOURCE_RELIABILITY)) {
      if (url.includes(domain) || domain.includes(url)) {
        return reliability;
      }
    }
  } catch {
    // Not a URL-like source
  }

  // Check for category keywords
  const name = sourceName.toLowerCase();
  if (name.includes('government') || name.includes('regulatory') || name.includes('filing')) return 0.90;
  if (name.includes('press') || name.includes('official')) return 0.82;
  if (name.includes('news') || name.includes('article')) return 0.70;
  if (name.includes('social') || name.includes('blog')) return 0.50;
  if (name.includes('internal') || name.includes('crm')) return 0.75;

  return SOURCE_RELIABILITY['unknown'];
}

// ── Grade Mapping ─────────────────────────────────────────────────────────────

function scoreToGrade(score: number): ConfidenceGrade {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'B-';
  if (score >= 65) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 55) return 'C-';
  if (score >= 40) return 'D';
  return 'F';
}

function scoreToTrustClass(score: number): TrustClassification {
  if (score >= 80) return 'enterprise';
  if (score >= 60) return 'advisory';
  if (score >= 40) return 'speculative';
  return 'unreliable';
}

// ── Dimension Scoring ───────────────────────────────────────────────────────

/**
 * Score the Data Quality dimension (20% weight).
 *
 * Measures: How complete and reliable is the underlying data?
 */
function scoreDataQuality(input: ConfidenceInput): ConfidenceFactor {
  const positive: string[] = [];
  const negative: string[] = [];
  let score = 50; // Start at midpoint

  // Field confidence analysis
  const fieldConf = input.fieldConfidence;
  if (fieldConf && Object.keys(fieldConf).length > 0) {
    const values = Object.values(fieldConf);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const highConfFields = values.filter(v => v >= 0.7).length;
    const lowConfFields = values.filter(v => v < 0.3).length;

    // Average field confidence
    score += (avg - 0.5) * 40;

    if (avg >= 0.7) positive.push(`Average field confidence is high (${(avg * 100).toFixed(0)}%)`);
    if (avg < 0.4) negative.push(`Average field confidence is low (${(avg * 100).toFixed(0)}%)`);

    // Distribution
    if (highConfFields >= 5) positive.push(`${highConfFields} fields have high confidence (>=70%)`);
    if (lowConfFields >= 3) negative.push(`${lowConfFields} fields have very low confidence (<30%)`);
  } else {
    negative.push('No field confidence data available');
    score -= 20;
  }

  // Data completeness
  if (input.dataCompleteness !== undefined) {
    if (input.dataCompleteness >= 0.8) {
      positive.push(`Data completeness is ${(input.dataCompleteness * 100).toFixed(0)}%`);
      score += 15;
    } else if (input.dataCompleteness < 0.4) {
      negative.push(`Data completeness is only ${(input.dataCompleteness * 100).toFixed(0)}%`);
      score -= 15;
    }
  }

  score = Math.max(0, Math.min(100, score));

  return {
    dimension: 'data_quality',
    score: Math.round(score),
    weight: 0.20,
    explanation: `Data quality score of ${Math.round(score)}/100 based on field confidence and data completeness.`,
    positiveSignals: positive,
    negativeSignals: negative,
  };
}

/**
 * Score the Source Reliability dimension (20% weight).
 *
 * Measures: How trustworthy are the sources backing this intelligence?
 */
function scoreSourceReliability(input: ConfidenceInput): ConfidenceFactor {
  const positive: string[] = [];
  const negative: string[] = [];
  let score = 50;

  if (input.averageSourceReliability !== undefined) {
    score = input.averageSourceReliability * 100;
  }

  if (input.sources && input.sources.length > 0) {
    const reliabilities = input.sources.map(s => s.reliability);
    const avg = reliabilities.reduce((a, b) => a + b, 0) / reliabilities.length;
    score = avg * 100;

    const highRelSources = input.sources.filter(s => s.reliability >= 0.85);
    const lowRelSources = input.sources.filter(s => s.reliability < 0.5);

    if (highRelSources.length > 0) positive.push(`${highRelSources.length} high-reliability source(s): ${highRelSources.map(s => s.name).slice(0, 3).join(', ')}`);
    if (lowRelSources.length > 0) negative.push(`${lowRelSources.length} low-reliability source(s): ${lowRelSources.map(s => s.name).slice(0, 3).join(', ')}`);

    // Bonus for source diversity
    const sourceTypes = new Set(input.sources.map(s => s.type));
    if (sourceTypes.size >= 3) {
      positive.push(`${sourceTypes.size} different source types (diverse evidence)`);
      score += 5;
    }

    // Bonus for multiple sources
    if (input.sources.length >= 5) {
      positive.push(`${input.sources.length} independent sources`);
      score += 5;
    }
  } else {
    negative.push('No source reliability data available');
    score -= 15;
  }

  score = Math.max(0, Math.min(100, score));

  return {
    dimension: 'source_reliability',
    score: Math.round(score),
    weight: 0.20,
    explanation: `Source reliability score of ${Math.round(score)}/100 based on ${input.sources?.length ?? 0} sources.`,
    positiveSignals: positive,
    negativeSignals: negative,
  };
}

/**
 * Score the Freshness dimension (15% weight).
 *
 * Measures: How recent is the intelligence data?
 */
function scoreFreshness(input: ConfidenceInput): ConfidenceFactor {
  const positive: string[] = [];
  const negative: string[] = [];
  let score = 50;

  if (input.freshnessScore !== undefined) {
    score = input.freshnessScore;
    if (score >= 70) positive.push(`Overall freshness score is ${Math.round(score)}/100`);
    if (score < 30) negative.push(`Overall freshness score is only ${Math.round(score)}/100 — data may be severely outdated`);
  }

  if (input.daysSinceResearch !== undefined) {
    const days = input.daysSinceResearch;
    if (days <= 7) {
      score = Math.max(score, 95);
      positive.push('Research is less than 1 week old — very fresh');
    } else if (days <= 14) {
      score = Math.max(score, 85);
      positive.push('Research is less than 2 weeks old — fresh');
    } else if (days <= 30) {
      score = Math.max(score, 70);
      positive.push(`Research is ${days} days old — moderately fresh`);
    } else if (days <= 60) {
      score = Math.max(score, 50);
      negative.push(`Research is ${days} days old — may be outdated`);
    } else if (days <= 90) {
      score = Math.max(score, 35);
      negative.push(`Research is ${days} days old — likely outdated`);
    } else {
      score = Math.max(score, 15);
      negative.push(`Research is ${days} days old — severely outdated`);
    }
  }

  // Domain-specific freshness
  if (input.domainFreshness) {
    const staleDomains = Object.entries(input.domainFreshness)
      .filter(([, v]) => v.score < 0.3);
    if (staleDomains.length > 0) {
      negative.push(`Stale domains: ${staleDomains.map(([d]) => d).join(', ')}`);
      score -= staleDomains.length * 3;
    }
  }

  score = Math.max(0, Math.min(100, score));

  return {
    dimension: 'freshness',
    score: Math.round(score),
    weight: 0.15,
    explanation: `Freshness score of ${Math.round(score)}/100. ${input.daysSinceResearch !== undefined ? `Research is ${input.daysSinceResearch} days old.` : 'No research date available.'}`,
    positiveSignals: positive,
    negativeSignals: negative,
  };
}

/**
 * Score the Cross Validation dimension (15% weight).
 *
 * Measures: How many facts are confirmed by multiple independent sources?
 */
function scoreCrossValidation(input: ConfidenceInput): ConfidenceFactor {
  const positive: string[] = [];
  const negative: string[] = [];
  let score = 40; // Default moderate (cross-validation is often partial)

  if (input.crossValidatedFacts !== undefined && input.totalFacts !== undefined) {
    const ratio = input.totalFacts > 0 ? input.crossValidatedFacts / input.totalFacts : 0;

    if (ratio >= 0.8) {
      score = 95;
      positive.push(`${input.crossValidatedFacts}/${input.totalFacts} facts cross-validated — very high confirmation`);
    } else if (ratio >= 0.5) {
      score = 75;
      positive.push(`${input.crossValidatedFacts}/${input.totalFacts} facts cross-validated`);
    } else if (ratio >= 0.2) {
      score = 55;
      positive.push(`${input.crossValidatedFacts}/${input.totalFacts} facts cross-validated — partial`);
    } else {
      score = 30;
      negative.push(`Only ${input.crossValidatedFacts}/${input.totalFacts} facts cross-validated — low confirmation`);
    }
  }

  // Contradictions penalty
  if (input.contradictions !== undefined && input.contradictions > 0) {
    score -= input.contradictions * 15;
    negative.push(`${input.contradictions} contradiction(s) detected between sources`);
  }

  score = Math.max(0, Math.min(100, score));

  return {
    dimension: 'cross_validation',
    score: Math.round(score),
    weight: 0.15,
    explanation: `Cross-validation score of ${Math.round(score)}/100 based on multi-source fact confirmation.`,
    positiveSignals: positive,
    negativeSignals: negative,
  };
}

/**
 * Score the Evidence Coverage dimension (15% weight).
 *
 * Measures: How well does evidence cover the expected analysis dimensions?
 */
function scoreEvidenceCoverage(input: ConfidenceInput): ConfidenceFactor {
  const positive: string[] = [];
  const negative: string[] = [];
  let score = 40;

  if (input.evidenceCoverage !== undefined) {
    score = input.evidenceCoverage * 100;
    if (score >= 80) positive.push(`Evidence coverage is ${(score).toFixed(0)}% — comprehensive`);
    if (score < 40) negative.push(`Evidence coverage is only ${(score).toFixed(0)}% — significant gaps`);
  }

  if (input.evidenceCount !== undefined) {
    if (input.evidenceCount >= 10) {
      positive.push(`${input.evidenceCount} evidence items available`);
      score += 10;
    } else if (input.evidenceCount >= 5) {
      positive.push(`${input.evidenceCount} evidence items available`);
    } else if (input.evidenceCount > 0) {
      negative.push(`Only ${input.evidenceCount} evidence item(s) — limited grounding`);
      score -= 10;
    } else {
      negative.push('No evidence items available');
      score -= 20;
    }
  }

  if (input.coveredDimensions !== undefined && input.expectedDimensions !== undefined) {
    const coverageRatio = input.expectedDimensions > 0
      ? input.coveredDimensions / input.expectedDimensions
      : 0;

    if (coverageRatio >= 0.8) positive.push(`${input.coveredDimensions}/${input.expectedDimensions} dimensions covered`);
    if (coverageRatio < 0.4) negative.push(`Only ${input.coveredDimensions}/${input.expectedDimensions} dimensions covered — incomplete analysis`);
  }

  if (input.evidenceGaps !== undefined && input.evidenceGaps > 3) {
    negative.push(`${input.evidenceGaps} evidence gaps detected`);
    score -= input.evidenceGaps * 3;
  }

  score = Math.max(0, Math.min(100, score));

  return {
    dimension: 'evidence_coverage',
    score: Math.round(score),
    weight: 0.15,
    explanation: `Evidence coverage score of ${Math.round(score)}/100 based on available evidence and dimension coverage.`,
    positiveSignals: positive,
    negativeSignals: negative,
  };
}

/**
 * Score the AI Certainty dimension (15% weight).
 *
 * Measures: How certain is the AI about its own output?
 * Uses post-generation quality signals.
 */
function scoreAICertainty(input: ConfidenceInput): ConfidenceFactor {
  const positive: string[] = [];
  const negative: string[] = [];
  let score = 50;

  // Quality gate score (if available)
  if (input.qualityGateScore !== undefined) {
    score = input.qualityGateScore;
    if (score >= 70) positive.push(`Quality gate score is ${Math.round(score)}/100`);
    if (score < 40) negative.push(`Quality gate score is only ${Math.round(score)}/100`);
  }

  // AI output confidence (if LLM reports it)
  if (input.aiOutputConfidence !== undefined) {
    const aiConf = input.aiOutputConfidence * 100;
    if (aiConf >= 80) positive.push(`AI self-assessed confidence: ${Math.round(aiConf)}%`);
    if (aiConf < 50) negative.push(`AI self-assessed confidence is low: ${Math.round(aiConf)}%`);
    score = (score + aiConf) / 2;
  }

  // Hallucination risk (inverse — lower risk = higher score)
  if (input.hallucinationRiskScore !== undefined) {
    const antiHallucination = 100 - input.hallucinationRiskScore;
    score = (score + antiHallucination) / 2;

    if (input.hallucinationRiskScore >= 50) {
      negative.push(`Post-generation hallucination risk is high (${input.hallucinationRiskScore}/100)`);
    } else if (input.hallucinationRiskScore <= 20) {
      positive.push(`Post-generation hallucination risk is low (${input.hallucinationRiskScore}/100)`);
    }
  }

  score = Math.max(0, Math.min(100, score));

  return {
    dimension: 'ai_certainty',
    score: Math.round(score),
    weight: 0.15,
    explanation: `AI certainty score of ${Math.round(score)}/100 based on quality gates and post-generation validation.`,
    positiveSignals: positive,
    negativeSignals: negative,
  };
}

// ── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Confidence model version. Bump when formula changes.
 */
const CONFIDENCE_MODEL_VERSION = 'v1-wi16c-unified';

/**
 * Compute unified confidence score.
 *
 * This is the main entry point for WI-16C. All confidence scoring
 * should go through this function for consistent, explainable results.
 *
 * @param input - Confidence input data (partial — missing fields get defaults)
 * @returns Full confidence result with score, grade, breakdown, and recommendations
 */
export function computeUnifiedConfidence(input: ConfidenceInput): ConfidenceResult {
  const timestamp = new Date().toISOString();

  // Score each dimension
  const factors: ConfidenceFactor[] = [
    scoreDataQuality(input),
    scoreSourceReliability(input),
    scoreFreshness(input),
    scoreCrossValidation(input),
    scoreEvidenceCoverage(input),
    scoreAICertainty(input),
  ];

  // Compute weighted composite score
  const score = Math.round(
    factors.reduce((sum, f) => sum + f.score * f.weight, 0)
  );

  const grade = scoreToGrade(score);
  const trustClass = scoreToTrustClass(score);
  const enterpriseReady = score >= 70;

  // Generate summary
  const summary = generateConfidenceSummary(score, grade, trustClass, factors);

  // Generate recommendations
  const recommendations = generateConfidenceRecommendations(factors, score);

  return {
    score,
    grade,
    trustClass,
    enterpriseReady,
    factors,
    summary,
    recommendations,
    timestamp,
    modelVersion: CONFIDENCE_MODEL_VERSION,
  };
}

/**
 * Generate a human-readable confidence summary.
 */
function generateConfidenceSummary(
  score: number,
  grade: ConfidenceGrade,
  trustClass: TrustClassification,
  factors: ConfidenceFactor[],
): string {
  const topFactors = factors
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
  const bottomFactors = factors
    .sort((a, b) => a.score - b.score)
    .slice(0, 2);

  const lines = [
    `Confidence: ${score}/100 (${grade}) — ${trustClass.charAt(0).toUpperCase() + trustClass.slice(1)} trust level.`,
    `Strongest dimensions: ${topFactors.map(f => `${f.dimension.replace('_', ' ')} (${f.score})`).join(', ')}.`,
    `Weakest dimensions: ${bottomFactors.map(f => `${f.dimension.replace('_', ' ')} (${f.score})`).join(', ')}.`,
  ];

  return lines.join(' ');
}

/**
 * Generate actionable recommendations for improving confidence.
 */
function generateConfidenceRecommendations(
  factors: ConfidenceFactor[],
  overallScore: number,
): string[] {
  const recs: string[] = [];
  const weakDimensions = factors.filter(f => f.score < 50);

  for (const factor of weakDimensions) {
    switch (factor.dimension) {
      case 'data_quality':
        recs.push('Run a data enrichment to improve field confidence scores.');
        break;
      case 'source_reliability':
        recs.push('Add more high-reliability sources (SEC filings, official press releases, Bloomberg/Reuters).');
        break;
      case 'freshness':
        recs.push('Run a research refresh — intelligence data is stale.');
        break;
      case 'cross_validation':
        recs.push('Cross-reference claims with additional independent sources.');
        break;
      case 'evidence_coverage':
        recs.push('Provide more evidence to cover analysis gaps.');
        break;
      case 'ai_certainty':
        recs.push('Post-generation validation detected issues — review AI output for accuracy.');
        break;
    }
  }

  if (overallScore < 40) {
    recs.push('Overall confidence is very low. Consider this intelligence as speculative only.');
  }

  if (recs.length === 0) {
    recs.push('Confidence is strong across all dimensions. No improvements needed.');
  }

  return recs;
}

// ── Formatting ────────────────────────────────────────────────────────────────

/**
 * Format confidence result for audit logging.
 */
export function formatConfidenceForLog(result: ConfidenceResult): string {
  const lines = [
    `[Confidence] ${result.score}/100 (${result.grade}) — ${result.trustClass} | Enterprise: ${result.enterpriseReady ? 'YES' : 'NO'}`,
    ...result.factors.map(f =>
      `  [${f.dimension.replace('_', ' ')}] ${f.score}/100 (weight: ${(f.weight * 100).toFixed(0)}%) — ${f.explanation}`
    ),
  ];

  if (result.recommendations.length > 0) {
    lines.push('  Recommendations:');
    for (const rec of result.recommendations) {
      lines.push(`    - ${rec}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format confidence result for user-facing display.
 * Compact format suitable for UI components.
 */
export function formatConfidenceForDisplay(result: ConfidenceResult): {
  label: string;
  color: string;
  factors: Array<{ dimension: string; score: number }>;
} {
  const colorMap: Record<string, string> = {
    'A+': '#059669', 'A': '#059669', 'A-': '#10b981',
    'B+': '#65a30d', 'B': '#84cc16', 'B-': '#a3e635',
    'C+': '#ca8a04', 'C': '#eab308', 'C-': '#f59e0b',
    'D': '#f97316', 'F': '#ef4444',
  };

  return {
    label: `${result.score}/100 (${result.grade})`,
    color: colorMap[result.grade] || '#6b7280',
    factors: result.factors.map(f => ({
      dimension: f.dimension.replace('_', ' '),
      score: f.score,
    })),
  };
}
