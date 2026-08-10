/**
 * Unified AI Confidence Engine — WI-16C (CANONICAL)
 * ====================================================
 *
 * ⭐ This is the CANONICAL confidence system for the entire platform.
 * Phase 2.7: All other confidence modules are now deprecated in favor of this.
 *
 * Supersedes:
 *   - intelligence-confidence.ts (4-factor, opportunity-specific)
 *   - blended-confidence.ts (6-source blending, no calibration)
 *
 * Use:
 *   - computeUnifiedConfidence()  — synchronous, for quick computations
 *   - computeCalibratedConfidence() — async, applies real CalibrationCurve correction factors
 *
 * Provides:
 *   - A unified confidence score (0-100)
 *   - A confidence grade (A+ through F)
 *   - A multi-factor breakdown (6 dimensions)
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
import { tokens } from '@/lib/design-tokens';
import { getCalibration, applyCalibration } from '@/lib/confidence-calibration-engine';

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
  /** Phase 1: Whether the confidence floor was applied. */
  confidenceFloorApplied?: boolean;
  /** Phase 2: Calibration status of the confidence model. */
  calibrationStatus?: 'uncalibrated' | 'partially_calibrated' | 'calibrated';
  /** Phase 2: The correction factor applied (1.0 = no correction). */
  calibrationFactor?: number;
  /** Phase 1: How much to trust the confidence score itself (0-100). */
  confidenceInConfidence?: number;
  /** Phase 1: Reason why confidence was floored (if applicable). */
  floorReason?: string;
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

  // ── Multi-Tenant Overrides ──
  /** Tenant ID for looking up tenant-specific confidence weights. */
  tenantId?: string;
  /** Pre-loaded custom confidence weights (keys map to ConfidenceDimension, values are 0-1 weights). */
  customWeights?: Record<string, number>;
  /** Phase 2: Internal — pass pre-fetched calibration status for sync path. */
  _calibrationStatus?: 'uncalibrated' | 'partially_calibrated' | 'calibrated';
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

  // Apply tenant-specific weights if provided
  if (input.customWeights && Object.keys(input.customWeights).length > 0) {
    const weightMap: Record<string, string> = {
      dataQuality: 'data_quality',
      sourceReliability: 'source_reliability',
      freshness: 'freshness',
      crossValidation: 'cross_validation',
      evidenceCoverage: 'evidence_coverage',
      aiCertainty: 'ai_certainty',
    };
    for (const factor of factors) {
      // Check both camelCase and snake_case keys
      const weight = input.customWeights[factor.dimension]
        ?? input.customWeights[Object.entries(weightMap).find(([, v]) => v === factor.dimension)?.[0] ?? ''];
      if (weight !== undefined && weight >= 0 && weight <= 1) {
        (factor as any).weight = weight;
      }
    }
  }

  // Compute weighted composite score
  let score = Math.round(
    factors.reduce((sum, f) => sum + f.score * f.weight, 0)
  );

  // Phase 1: Confidence Floor Enforcement
  // Feature-flagged: ENABLE_CONFIDENCE_FLOOR defaults to true
  const ENABLE_CONFIDENCE_FLOOR = process.env.ENABLE_CONFIDENCE_FLOOR !== 'false';
  let confidenceFloorApplied = false;
  let floorReason: string | undefined;

  if (ENABLE_CONFIDENCE_FLOOR) {
    const evidenceCount = input.evidenceCount ?? 0;
    const daysSinceResearch = input.daysSinceResearch;
    const freshnessScore = input.freshnessScore;

    // Floor 1: Too few evidence items
    if (evidenceCount < 3) {
      const FLOOR = 30;
      if (score > FLOOR) {
        score = FLOOR;
        confidenceFloorApplied = true;
        floorReason = `Only ${evidenceCount} evidence items (< 3 minimum). Confidence capped at ${FLOOR}.`;
      }
    }

    // Floor 2: Stale data (all evidence older than 180 days)
    if (!confidenceFloorApplied && daysSinceResearch !== undefined && daysSinceResearch > 180) {
      const FLOOR = 35;
      if (score > FLOOR) {
        score = FLOOR;
        confidenceFloorApplied = true;
        floorReason = `Data is ${daysSinceResearch} days old (> 180 day threshold). Confidence capped at ${FLOOR}.`;
      }
    }

    // Floor 3: Low freshness score
    if (!confidenceFloorApplied && freshnessScore !== undefined && freshnessScore < 20) {
      const FLOOR = 40;
      if (score > FLOOR) {
        score = FLOOR;
        confidenceFloorApplied = true;
        floorReason = `Freshness score is ${freshnessScore} (< 20 threshold). Confidence capped at ${FLOOR}.`;
      }
    }
  }

  const grade = scoreToGrade(score);
  const trustClass = scoreToTrustClass(score);
  const enterpriseReady = score >= 70;

  // Phase 2: Calibration status — fetched from CalibrationCurve table
  // Note: Synchronous path uses 'uncalibrated' default. Use computeCalibratedConfidence() for async calibrated version.
  const calibrationStatus: 'uncalibrated' | 'partially_calibrated' | 'calibrated' = input._calibrationStatus ?? 'uncalibrated';

  // Phase 1: Confidence-in-Confidence
  // How much should a user trust this confidence score?
  // Based on: evidence count, data freshness, calibration status
  const evidenceCount = input.evidenceCount ?? 0;
  const daysSince = input.daysSinceResearch;
  let cicScore = 50; // Base: moderate trust

  // Boost for more evidence
  if (evidenceCount >= 10) cicScore += 20;
  else if (evidenceCount >= 5) cicScore += 10;
  else if (evidenceCount < 2) cicScore -= 20;

  // Boost for fresh data
  if (daysSince !== undefined) {
    if (daysSince <= 7) cicScore += 15;
    else if (daysSince <= 30) cicScore += 5;
    else if (daysSince > 90) cicScore -= 10;
    else if (daysSince > 180) cicScore -= 20;
  }

  // Penalty for uncalibrated model
  if (calibrationStatus === 'uncalibrated') cicScore -= 10;

  // Penalty for floor applied (indicates data scarcity)
  if (confidenceFloorApplied) cicScore -= 15;

  const confidenceInConfidence = Math.max(0, Math.min(100, cicScore));

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
    confidenceFloorApplied: confidenceFloorApplied || undefined,
    calibrationStatus,
    confidenceInConfidence,
    floorReason,
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
    'A+': tokens.extended.emeraldDeep.value, 'A': tokens.extended.emeraldDeep.value, 'A-': tokens.extended.emerald.value,
    'B+': tokens.extended.limeDark.value, 'B': tokens.extended.lime.value, 'B-': tokens.extended.limeBright.value,
    'C+': tokens.extended.yellowDeep.value, 'C': tokens.extended.amber.value, 'C-': tokens.domain.reasoning,
    'D': tokens.trust.low.value, 'F': tokens.domain.risk,
  };

  return {
    label: `${result.score}/100 (${result.grade})`,
    color: colorMap[result.grade] || tokens.neutral['500'],
    factors: result.factors.map(f => ({
      dimension: f.dimension.replace('_', ' '),
      score: f.score,
    })),
  };
}

// ── Phase 2: Calibration-Aware Async Wrapper ──────────────────────────────────

/**
 * computeCalibratedConfidence — Phase 2 Task 2.2
 *
 * Async version of computeUnifiedConfidence that applies real calibration
 * correction factors from the CalibrationCurve table.
 *
 * Pipeline:
 *   1. Compute raw unified confidence (same 6-dimension formula)
 *   2. Fetch calibration data for the 'overall' dimension
 *   3. Apply correction factor to the raw score
 *   4. Re-grade and re-classify with the calibrated score
 *   5. Attach real calibration status to the result
 */
export async function computeCalibratedConfidence(
  input: ConfidenceInput
): Promise<ConfidenceResult> {
  // Step 1: Compute raw confidence
  const raw = computeUnifiedConfidence(input);

  // Step 2: Fetch calibration data
  let calibratedScore = raw.score;
  let calibrationStatus: 'uncalibrated' | 'partially_calibrated' | 'calibrated' = 'uncalibrated';
  let calibrationFactor = 1.0;

  try {
    const calibration = await getCalibration('overall');
    if (calibration.dimensions.length > 0) {
      const dim = calibration.dimensions[0];
      calibrationStatus = dim.status;

      // Apply correction factor if calibrated or partially calibrated
      if (dim.status !== 'uncalibrated') {
        const result = await applyCalibration(raw.score, 'overall');
        calibratedScore = result.calibrated;
        calibrationFactor = result.factor;

        logger.debug('[UnifiedConfidence] Calibration applied', {
          rawScore: raw.score,
          calibratedScore,
          factor: calibrationFactor,
          status: calibrationStatus,
          sampleCount: dim.sampleCount,
        });
      }
    }
  } catch (err) {
    logger.warn('[UnifiedConfidence] Failed to apply calibration, using raw score:', { error: err });
  }

  // Step 3: Re-grade with calibrated score
  const grade = scoreToGrade(calibratedScore);
  const trustClass = scoreToTrustClass(calibratedScore);
  const enterpriseReady = calibratedScore >= 70;

  // Recompute confidence-in-confidence with real calibration status
  const evidenceCount = input.evidenceCount ?? 0;
  const daysSince = input.daysSinceResearch;
  let cicScore = 50;
  if (evidenceCount >= 10) cicScore += 20;
  else if (evidenceCount >= 5) cicScore += 10;
  else if (evidenceCount < 2) cicScore -= 20;
  if (daysSince !== undefined) {
    if (daysSince <= 7) cicScore += 15;
    else if (daysSince <= 30) cicScore += 5;
    else if (daysSince > 90) cicScore -= 10;
    else if (daysSince > 180) cicScore -= 20;
  }
  if (calibrationStatus === 'uncalibrated') cicScore -= 10;
  if (raw.confidenceFloorApplied) cicScore -= 15;

  return {
    score: calibratedScore,
    grade,
    trustClass,
    enterpriseReady,
    factors: raw.factors,
    summary: raw.summary,
    recommendations: raw.recommendations,
    timestamp: raw.timestamp,
    modelVersion: raw.modelVersion,
    confidenceFloorApplied: raw.confidenceFloorApplied,
    calibrationStatus,
    calibrationFactor,
    confidenceInConfidence: Math.max(0, Math.min(100, cicScore)),
    floorReason: raw.floorReason,
  };
}
