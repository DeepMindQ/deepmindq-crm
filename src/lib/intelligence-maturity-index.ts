/**
 * Phase 4 — Item 7.3: Intelligence Maturity Index
 *
 * Computes a per-company "how well do we understand this company?" metric.
 *
 * The maturity index is a composite score (0-100) based on:
 *   1. Data Coverage (30%): How many intelligence dimensions have data?
 *   2. Data Freshness (25%): How recent is the intelligence?
 *   3. Data Quality (25%): Confidence scores across sources
 *   4. Data Diversity (20%): How many different source types contributed?
 *
 * Maturity Levels:
 *   0-20:   Emerging — Very limited understanding
 *   21-40:  Developing — Basic understanding with gaps
 *   41-60:  Established — Good understanding across key dimensions
 *   61-80:  Advanced — Comprehensive understanding with high confidence
 *   81-100: Mature — Deep, multi-sourced, fresh intelligence
 *
 * Usage:
 *   import { computeIntelligenceMaturityIndex } from '@/lib/intelligence-maturity-index';
 *   const maturity = await computeIntelligenceMaturityIndex('company-id');
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface IntelligenceMaturityIndex {
  /** Composite maturity score (0-100) */
  score: number;
  /** Maturity level label */
  level: 'emerging' | 'developing' | 'established' | 'advanced' | 'mature';
  /** Dimension breakdown */
  dimensions: {
    coverage: { score: number; weight: number; details: string };
    freshness: { score: number; weight: number; details: string };
    quality: { score: number; weight: number; details: string };
    diversity: { score: number; weight: number; details: string };
  };
  /** Specific improvement suggestions */
  improvementSuggestions: string[];
  /** Timestamp of computation */
  computedAt: string;
}

/**
 * Weight configuration for maturity dimensions.
 * Sum must equal 1.0.
 */
const MATURITY_WEIGHTS = {
  coverage: 0.30,
  freshness: 0.25,
  quality: 0.25,
  diversity: 0.20,
} as const;

/** Maximum age (in days) for data to be considered "fresh" */
const FRESHNESS_THRESHOLD_DAYS = 30;

/** Maturity level thresholds */
const MATURITY_LEVELS = [
  { min: 81, level: 'mature' as const },
  { min: 61, level: 'advanced' as const },
  { min: 41, level: 'established' as const },
  { min: 21, level: 'developing' as const },
  { min: 0, level: 'emerging' as const },
];

/**
 * Compute the intelligence maturity index for a company.
 *
 * @param companyId - The company to analyze
 * @returns IntelligenceMaturityIndex with composite score and dimension breakdown
 */
export async function computeIntelligenceMaturityIndex(
  companyId: string,
): Promise<IntelligenceMaturityIndex> {
  try {
    // Gather all intelligence dimensions for this company
    // Using actual Prisma schema field names:
    //   CompanySignal: extractedAt, confidence, source
    //   OpportunityRecommendation: calculatedAt, confidenceScore, opportunityScore
    //   SignalCapabilityMatch: createdAt, matchScore
    //   Contact: createdAt (no source field)
    //   AccountScore: updatedAt, score
    const [signals, opportunities, capabilityMatches, contacts, accountScores] = await Promise.all([
      db.companySignal.findMany({ where: { companyId }, select: { extractedAt: true, confidence: true, source: true } }),
      db.opportunityRecommendation.findMany({ where: { companyId }, select: { createdAt: true, confidenceScore: true, opportunityScore: true } }),
      db.signalCapabilityMatch.findMany({ where: { companyId }, select: { createdAt: true, matchScore: true } }),
      db.contact.findMany({ where: { companyId }, select: { createdAt: true } }),
      db.accountScore.findMany({ where: { companyId }, select: { updatedAt: true, score: true } }),
    ]).catch(() => {
      // If DB queries fail, return minimal maturity
      return [[], [], [], [], []] as any[][];
    });

    // Compute individual dimension scores
    const coverageScore = computeCoverageScore(signals.length, opportunities.length, capabilityMatches.length, contacts.length, accountScores.length);
    const freshnessScore = computeFreshnessScore(signals, opportunities, capabilityMatches, contacts, accountScores);
    const qualityScore = computeQualityScore(signals, opportunities, capabilityMatches, accountScores);
    const diversityScore = computeDiversityScore(signals);

    // Compute composite score
    const compositeScore = Math.round(
      coverageScore * MATURITY_WEIGHTS.coverage +
      freshnessScore * MATURITY_WEIGHTS.freshness +
      qualityScore * MATURITY_WEIGHTS.quality +
      diversityScore * MATURITY_WEIGHTS.diversity
    );

    // Determine maturity level
    const level = MATURITY_LEVELS.find(t => compositeScore >= t.min)?.level ?? 'emerging';

    // Generate improvement suggestions
    const suggestions = generateImprovementSuggestions(
      coverageScore, freshnessScore, qualityScore, diversityScore,
      signals.length, contacts.length,
    );

    return {
      score: compositeScore,
      level,
      dimensions: {
        coverage: {
          score: coverageScore,
          weight: MATURITY_WEIGHTS.coverage,
          details: `${[signals.length, opportunities.length, capabilityMatches.length, contacts.length, accountScores.length].filter(n => n > 0).length}/5 dimensions covered`,
        },
        freshness: {
          score: freshnessScore,
          weight: MATURITY_WEIGHTS.freshness,
          details: freshnessScore >= 70 ? 'Data is relatively fresh' : 'Data may be stale — refresh recommended',
        },
        quality: {
          score: qualityScore,
          weight: MATURITY_WEIGHTS.quality,
          details: qualityScore >= 70 ? 'High confidence across sources' : 'Consider adding verified data sources',
        },
        diversity: {
          score: diversityScore,
          weight: MATURITY_WEIGHTS.diversity,
          details: diversityScore >= 60 ? 'Multiple source types contributing' : 'Intelligence comes from few sources',
        },
      },
      improvementSuggestions: suggestions,
      computedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error(`[maturity-index] Computation failed for ${companyId}: ${error}`);
    return {
      score: 0,
      level: 'emerging',
      dimensions: {
        coverage: { score: 0, weight: MATURITY_WEIGHTS.coverage, details: 'Computation failed' },
        freshness: { score: 0, weight: MATURITY_WEIGHTS.freshness, details: 'Computation failed' },
        quality: { score: 0, weight: MATURITY_WEIGHTS.quality, details: 'Computation failed' },
        diversity: { score: 0, weight: MATURITY_WEIGHTS.diversity, details: 'Computation failed' },
      },
      improvementSuggestions: ['Enable data connectors to build intelligence coverage'],
      computedAt: new Date().toISOString(),
    };
  }
}

/**
 * Coverage score: How many intelligence dimensions have data?
 */
function computeCoverageScore(
  signalCount: number,
  opportunityCount: number,
  capabilityMatchCount: number,
  contactCount: number,
  accountScoreCount: number,
): number {
  const dimensions = [signalCount, opportunityCount, capabilityMatchCount, contactCount, accountScoreCount];
  const covered = dimensions.filter(n => n > 0).length;
  const maxPerDim = [10, 5, 5, 10, 3];
  const weightedSum = dimensions.reduce((sum, count, i) => {
    return sum + Math.min(1, count / maxPerDim[i]);
  }, 0);
  // Combine presence (40%) and depth (60%)
  return Math.round((covered / 5) * 40 + (weightedSum / 5) * 60);
}

/**
 * Freshness score: How recent is the intelligence data?
 * Accepts arrays of Prisma select results — extracts Date fields dynamically.
 */
function computeFreshnessScore(
  signals: any[],
  opportunities: any[],
  capabilityMatches: any[],
  contacts: any[],
  accountScores: any[],
): number {
  const allItems: Date[] = [];

  for (const s of signals) {
    if (s.extractedAt) allItems.push(new Date(s.extractedAt));
  }
  for (const o of opportunities) {
    if (o.calculatedAt) allItems.push(new Date(o.calculatedAt));
  }
  for (const c of capabilityMatches) {
    if (c.createdAt) allItems.push(new Date(c.createdAt));
  }
  for (const c of contacts) {
    if (c.createdAt) allItems.push(new Date(c.createdAt));
  }
  for (const a of accountScores) {
    if (a.updatedAt) allItems.push(new Date(a.updatedAt));
  }

  if (allItems.length === 0) return 0;

  const now = Date.now();
  const threshold = FRESHNESS_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
  const freshCount = allItems.filter(d => (now - d.getTime()) < threshold).length;

  return Math.round((freshCount / allItems.length) * 100);
}

/**
 * Quality score: Average confidence across all data points.
 */
function computeQualityScore(
  signals: any[],
  opportunities: any[],
  capabilityMatches: any[],
  accountScores: any[],
): number {
  const scores: number[] = [];

  for (const s of signals) {
    if (s.confidence != null) scores.push(s.confidence * 100);
  }
  for (const o of opportunities) {
    if (o.confidenceScore != null) scores.push(o.confidenceScore * 100);
    if (o.opportunityScore != null) scores.push(o.opportunityScore);
  }
  for (const c of capabilityMatches) {
    if (c.matchScore != null) scores.push(c.matchScore * 100);
  }
  for (const a of accountScores) {
    if (a.score != null) scores.push(a.score);
  }

  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

/**
 * Diversity score: How many unique source types contribute?
 */
function computeDiversityScore(signals: any[]): number {
  const sources = signals
    .map(s => s.source)
    .filter((s: string | null) => s != null && s.trim() !== '');
  const unique = new Set(sources);
  // Normalize: 1 source = 20%, 5+ sources = 100%
  return Math.min(100, Math.round(unique.size * 20));
}

/**
 * Generate actionable improvement suggestions.
 */
function generateImprovementSuggestions(
  coverage: number,
  freshness: number,
  quality: number,
  diversity: number,
  signalCount: number,
  contactCount: number,
): string[] {
  const suggestions: string[] = [];

  if (coverage < 50) {
    suggestions.push('Enable additional data connectors to cover more intelligence dimensions');
  }
  if (freshness < 50) {
    suggestions.push('Refresh stale intelligence data — some signals may be outdated');
  }
  if (quality < 50) {
    suggestions.push('Add higher-confidence data sources to improve intelligence reliability');
  }
  if (diversity < 50) {
    suggestions.push('Diversify intelligence sources — currently relying on few sources');
  }
  if (signalCount < 3) {
    suggestions.push('Configure signal detection rules to capture more buying signals');
  }
  if (contactCount < 2) {
    suggestions.push('Import contacts from CRM or enrichment providers');
  }

  return suggestions.length > 0 ? suggestions : ['Intelligence coverage is strong — continue monitoring for changes'];
}
