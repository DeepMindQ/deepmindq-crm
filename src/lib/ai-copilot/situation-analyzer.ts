/**
 * AI Revenue Copilot — Situation Analyzer
 *
 * Pure function that analyzes a company's intelligence data to determine
 * their current buying/engagement phase, key drivers, and maturity level.
 *
 * No DB or LLM calls — this is a deterministic analysis layer that runs
 * before strategy generation to ground the LLM prompt with a pre-computed
 * situation assessment.
 */

import type { ReasoningContext, StrategicInsightOutput } from './types';

// ═══════════════════════════════════════════════════════════════════════════════
//  Public types
// ═══════════════════════════════════════════════════════════════════════════════

export interface SituationAssessment {
  /**
   * Current buying/engagement phase:
   *   - "exploration" — Early research, few signals, low data volume
   *   - "evaluation" — Active comparison, multiple vendors, RFP signals
   *   - "active_procurement" — Hiring for the capability, budget signals, shortlisting
   *   - "implementation" — Already using similar tools, looking to expand/replace
   *   - "optimization" — Mature usage, seeking efficiency gains
   */
  currentPhase: string;

  /**
   * Top 3-5 drivers identified from signals, knowledge, and evidence.
   */
  keyDrivers: string[];

  /**
   * Maturity of their current initiative:
   *   - "early" — Just starting, few knowledge entries, recent signals
   *   - "mid" — Moderate data, established patterns, some evaluation activity
   *   - "late" — High data volume, implementation or expansion signals
   */
  maturityLevel: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Internal scoring helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Normalizes a signal type string to a canonical form for matching.
 */
function normalizeSignalType(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

/**
 * Signal type keywords that indicate active procurement activity.
 */
const PROCUREMENT_SIGNAL_KEYWORDS = [
  'hiring', 'job_posting', 'job_opening', 'talent_acquisition',
  'rfp', 'rfq', 'vendor', 'procurement', 'budget',
  'partnership', 'funding', 'investment',
];

/**
 * Signal type keywords that indicate evaluation / comparison activity.
 */
const EVALUATION_SIGNAL_KEYWORDS = [
  'evaluation', 'comparison', 'pilot', 'proof_of_concept',
  'demo', 'trial', 'assessment', 'shortlist',
];

/**
 * Knowledge category keywords that suggest implementation phase.
 */
const IMPLEMENTATION_CATEGORIES = [
  'implementation', 'deployment', 'integration', 'migration',
  'production', 'operations', 'infrastructure',
];

/**
 * Knowledge category keywords that suggest optimization phase.
 */
const OPTIMIZATION_CATEGORIES = [
  'optimization', 'performance', 'scale', 'efficiency',
  'cost', 'roi', 'analytics', 'monitoring',
];

/**
 * Counts how many knowledge entries match the given category keywords.
 */
function countCategoryMatches(
  entries: ReasoningContext['knowledgeEntries'],
  keywords: string[]
): number {
  let count = 0;
  for (const entry of entries) {
    const cat = entry.category.toLowerCase();
    const content = entry.content.toLowerCase();
    for (const kw of keywords) {
      if (cat.includes(kw) || content.includes(kw)) {
        count++;
        break;
      }
    }
  }
  return count;
}

/**
 * Counts how many signals match the given signal type keywords.
 */
function countSignalMatches(
  signals: ReasoningContext['signals'],
  keywords: string[]
): number {
  let count = 0;
  for (const sig of signals) {
    const normalized = normalizeSignalType(sig.signalType);
    const title = sig.title.toLowerCase();
    for (const kw of keywords) {
      if (normalized.includes(kw) || title.includes(kw.replace(/_/g, ' '))) {
        count++;
        break;
      }
    }
  }
  return count;
}

/**
 * Checks if signals are predominantly recent (within last 30 days).
 */
function isRecentSignalDensityHigh(signals: ReasoningContext['signals']): boolean {
  if (signals.length === 0) return false;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentCount = signals.filter(s => new Date(s.createdAt) >= thirtyDaysAgo).length;
  return (recentCount / signals.length) > 0.5;
}

/**
 * Extracts the top N most frequent themes from knowledge entries.
 */
function extractTopDrivers(
  ctx: ReasoningContext,
  insight: StrategicInsightOutput,
  max: number
): string[] {
  const driverCounts = new Map<string, number>();

  // Weight insight themes heavily (they are already synthesized)
  for (const theme of insight.keyThemes) {
    const lower = theme.toLowerCase().trim();
    if (lower.length > 2) {
      driverCounts.set(lower, (driverCounts.get(lower) ?? 0) + 3);
    }
  }

  // Weight knowledge entry categories
  for (const entry of ctx.knowledgeEntries) {
    const cat = entry.category.toLowerCase().trim();
    if (cat.length > 2) {
      driverCounts.set(cat, (driverCounts.get(cat) ?? 0) + 1);
    }
  }

  // Weight signal types
  for (const sig of ctx.signals) {
    const sigType = sig.signalType.toLowerCase().trim();
    if (sigType.length > 2) {
      driverCounts.set(sigType, (driverCounts.get(sigType) ?? 0) + 1);
    }
  }

  // Sort by frequency descending and take top N
  const sorted = Array.from(driverCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([driver]) => driver);

  return sorted.length > 0 ? sorted : ['Insufficient data for driver identification'];
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Main export
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Analyzes the company's intelligence data to determine where they are
 * in their buying/engagement journey.
 *
 * This is a pure function — no DB or LLM calls. It uses heuristics over
 * the aggregated intelligence data to produce a deterministic assessment.
 *
 * @param ctx - The full reasoning context for the company
 * @param insight - The strategic insight output from the reasoning engine
 * @returns Situation assessment with phase, drivers, and maturity level
 */
export function analyzeSituation(
  ctx: ReasoningContext,
  insight: StrategicInsightOutput
): SituationAssessment {
  const totalKnowledge = ctx.dataQualityMetrics.totalKnowledgeEntries;
  const avgConfidence = ctx.dataQualityMetrics.avgConfidence;
  const recentEntries = ctx.dataQualityMetrics.recentEntryCount;
  const totalSignals = ctx.signals.length;
  const totalOpportunitySignals = ctx.opportunitySignals.length;
  const recentSignalDensity = isRecentSignalDensityHigh(ctx.signals);

  // ── Phase determination ──
  const procurementScore = countSignalMatches(ctx.signals, PROCUREMENT_SIGNAL_KEYWORDS);
  const evaluationScore = countSignalMatches(ctx.signals, EVALUATION_SIGNAL_KEYWORDS);
  const implementationScore = countCategoryMatches(ctx.knowledgeEntries, IMPLEMENTATION_CATEGORIES);
  const optimizationScore = countCategoryMatches(ctx.knowledgeEntries, OPTIMIZATION_CATEGORIES);

  let currentPhase: string;

  if (implementationScore > optimizationScore && implementationScore >= 3) {
    currentPhase = 'implementation';
  } else if (optimizationScore >= 3 && totalKnowledge > 15) {
    currentPhase = 'optimization';
  } else if (procurementScore >= 2 || (procurementScore >= 1 && recentSignalDensity)) {
    currentPhase = 'active_procurement';
  } else if (evaluationScore >= 2 || (evaluationScore >= 1 && totalOpportunitySignals >= 2)) {
    currentPhase = 'evaluation';
  } else if (totalKnowledge < 5 && totalSignals < 3) {
    currentPhase = 'exploration';
  } else {
    // Default: use insight type and data volume as tiebreakers
    if (insight.insightType === 'OPPORTUNITY' && totalOpportunitySignals >= 2) {
      currentPhase = 'evaluation';
    } else if (insight.insightType === 'RISK') {
      currentPhase = 'exploration';
    } else {
      currentPhase = 'exploration';
    }
  }

  // ── Maturity level determination ──
  const intelligenceVolume = totalKnowledge + totalSignals + ctx.evidence.length + ctx.intelligenceObjects.length;
  const recencyFactor = recentEntries / Math.max(totalKnowledge, 1);

  let maturityLevel: string;

  if (intelligenceVolume >= 50 && avgConfidence >= 0.6 && recencyFactor >= 0.3) {
    maturityLevel = 'late';
  } else if (intelligenceVolume >= 15 && avgConfidence >= 0.4) {
    maturityLevel = 'mid';
  } else {
    maturityLevel = 'early';
  }

  // ── Key drivers ──
  const keyDrivers = extractTopDrivers(ctx, insight, 5);

  // ── Log for observability ──
  console.log('[ai-copilot:situation-analyzer]', {
    companyId: ctx.companyId,
    currentPhase,
    maturityLevel,
    driverCount: keyDrivers.length,
    scores: { procurementScore, evaluationScore, implementationScore, optimizationScore },
    volumeMetrics: { intelligenceVolume, totalKnowledge, totalSignals, avgConfidence, recencyFactor },
  });

  return {
    currentPhase,
    keyDrivers,
    maturityLevel,
  };
}
