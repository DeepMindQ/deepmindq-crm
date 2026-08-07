/**
 * S4-2.4 — Decision Learning Confidence Blending
 * ================================================
 *
 * Blends confidence scores from multiple intelligence sources into a
 * single unified confidence score for recommendations.
 *
 * SOURCES OF CONFIDENCE:
 *   1. Base Score         — Original recommendation score (0-100)
 *   2. Calibration         — Score adjustments from calibration engine
 *   3. Decision Learning   — Historical feedback/outcome effectiveness
 *   4. Knowledge Graph      — Evidence chain confidence from graph reasoning
 *   5. Memory Match         — Enterprise context match quality
 *   6. Evidence Quality    — Cross-validated evidence strength
 *
 * BLENDING FORMULA:
 *   blended = (base * w1) + (calibration_delta * w2) + (decision_adj * w3)
 *             + (kg_confidence * w4) + (memory_confidence * w5) + (evidence_quality * w6)
 *
 *   Default weights: base=0.35, calibration=0.15, decision=0.20, kg=0.15, memory=0.10, evidence=0.05
 *
 * DESIGN:
 *   - Each source is optional — missing sources use neutral defaults
 *   - Weights are configurable per deployment
 *   - Returns blended confidence (0-100) + per-source breakdown for explainability
 *   - Non-throwing: errors in any source don't affect others
 */

import { logger } from '@/lib/logger';
import { adjustConfidence as adjustDecisionConfidence } from '@/lib/decision-learning';

// ─── Types ───────────────────────────────────────────────────────────

export interface ConfidenceSource {
  /** Source identifier */
  name: string;
  /** Raw confidence value from this source (0-100) */
  value: number;
  /** Weight applied in blending (0-1) */
  weight: number;
  /** Whether this source contributed (had valid data) */
  contributed: boolean;
  /** Human-readable description of what this source measured */
  description: string;
}

export interface BlendedConfidenceResult {
  /** Final blended confidence score (0-100) */
  blendedScore: number;
  /** Per-source confidence breakdown */
  sources: ConfidenceSource[];
  /** Sum of applied weights (for normalization) */
  totalWeightApplied: number;
  /** The dominant source (highest weighted contribution) */
  dominantSource: string;
}

export interface BlendedConfidenceInput {
  /** Base recommendation score (0-100) */
  baseScore: number;
  /** Calibration adjustment (delta, e.g., +5 or -3) */
  calibrationDelta?: number;
  /** Agent type for decision-learning lookup */
  agentType?: string;
  /** Company ID for company-specific adjustments */
  companyId?: string;
  /** Knowledge graph evidence chain confidence (0-100) */
  kgConfidence?: number;
  /** Memory/context match quality (0-100) */
  memoryConfidence?: number;
  /** Evidence quality score (0-100) */
  evidenceQuality?: number;
  /** Custom weights override */
  customWeights?: Partial<ConfidenceWeights>;
}

export interface ConfidenceWeights {
  base: number;
  calibration: number;
  decisionLearning: number;
  knowledgeGraph: number;
  memory: number;
  evidenceQuality: number;
}

// ─── Default Weights ─────────────────────────────────────────────────

export const DEFAULT_WEIGHTS: ConfidenceWeights = {
  base: 0.35,
  calibration: 0.15,
  decisionLearning: 0.20,
  knowledgeGraph: 0.15,
  memory: 0.10,
  evidenceQuality: 0.05,
};

// ─── Main Blending Function ──────────────────────────────────────────

/**
 * Compute a blended confidence score from multiple intelligence sources.
 *
 * Each source is independently evaluated and weighted. Missing sources
 * receive neutral defaults (no boost or penalty). The result is a
 * normalized confidence score between 0 and 100.
 *
 * The sources array provides full explainability of how the final
 * score was derived — each source's contribution is visible.
 */
export async function computeBlendedConfidence(
  input: BlendedConfidenceInput
): Promise<BlendedConfidenceResult> {
  const weights: ConfidenceWeights = { ...DEFAULT_WEIGHTS, ...input.customWeights };
  const sources: ConfidenceSource[] = [];

  // ── Source 1: Base Score ──
  const baseContribution = input.baseScore * weights.base;
  sources.push({
    name: 'base_score',
    value: input.baseScore,
    weight: weights.base,
    contributed: true,
    description: `Original recommendation score: ${input.baseScore}`,
  });

  // ── Source 2: Calibration Delta ──
  let calibrationValue = 0;
  if (input.calibrationDelta !== undefined) {
    calibrationValue = input.calibrationDelta;
  }
  sources.push({
    name: 'calibration',
    value: calibrationValue,
    weight: weights.calibration,
    contributed: input.calibrationDelta !== undefined && input.calibrationDelta !== 0,
    description: input.calibrationDelta !== undefined
      ? `Calibration adjustment: ${input.calibrationDelta > 0 ? '+' : ''}${input.calibrationDelta}`
      : 'No calibration data available',
  });

  // ── Source 3: Decision Learning ──
  let decisionValue = 0;
  if (input.agentType) {
    try {
      const adjusted = await adjustDecisionConfidence(
        input.baseScore,
        input.agentType,
        input.companyId
      );
      decisionValue = adjusted - input.baseScore; // delta from base
    } catch {
      // Decision learning unavailable
    }
  }
  sources.push({
    name: 'decision_learning',
    value: decisionValue,
    weight: weights.decisionLearning,
    contributed: input.agentType !== undefined && decisionValue !== 0,
    description: input.agentType
      ? `Decision learning adjustment (${input.agentType}): ${decisionValue > 0 ? '+' : ''}${Math.round(decisionValue)}`
      : 'No decision learning data',
  });

  // ── Source 4: Knowledge Graph Confidence ──
  let kgValue = 0;
  if (input.kgConfidence !== undefined && input.kgConfidence > 0) {
    // Convert KG confidence (0-1 typically) to delta from base
    // If KG says confidence is high but base is low, boost
    kgValue = (input.kgConfidence - 50) * 0.2; // Normalize around 50
  }
  sources.push({
    name: 'knowledge_graph',
    value: kgValue,
    weight: weights.knowledgeGraph,
    contributed: input.kgConfidence !== undefined && input.kgConfidence > 0,
    description: input.kgConfidence !== undefined && input.kgConfidence > 0
      ? `KG evidence chain confidence: ${input.kgConfidence} → delta ${kgValue > 0 ? '+' : ''}${Math.round(kgValue)}`
      : 'No KG evidence chain available',
  });

  // ── Source 5: Memory Match Confidence ──
  let memoryValue = 0;
  if (input.memoryConfidence !== undefined && input.memoryConfidence > 0) {
    // Memory match provides context boost
    memoryValue = (input.memoryConfidence - 50) * 0.15;
  }
  sources.push({
    name: 'memory',
    value: memoryValue,
    weight: weights.memory,
    contributed: input.memoryConfidence !== undefined && input.memoryConfidence > 0,
    description: input.memoryConfidence !== undefined && input.memoryConfidence > 0
      ? `Memory/context match: ${input.memoryConfidence} → delta ${memoryValue > 0 ? '+' : ''}${Math.round(memoryValue)}`
      : 'No memory context available',
  });

  // ── Source 6: Evidence Quality ──
  let evidenceValue = 0;
  if (input.evidenceQuality !== undefined && input.evidenceQuality > 0) {
    evidenceValue = (input.evidenceQuality - 50) * 0.1;
  }
  sources.push({
    name: 'evidence_quality',
    value: evidenceValue,
    weight: weights.evidenceQuality,
    contributed: input.evidenceQuality !== undefined && input.evidenceQuality > 0,
    description: input.evidenceQuality !== undefined && input.evidenceQuality > 0
      ? `Evidence quality score: ${input.evidenceQuality} → delta ${evidenceValue > 0 ? '+' : ''}${Math.round(evidenceValue)}`
      : 'No evidence quality data',
  });

  // ── Compute blended score ──
  // base_contribution + sum(weighted_deltas)
  const totalWeight = weights.base + weights.calibration + weights.decisionLearning +
    weights.knowledgeGraph + weights.memory + weights.evidenceQuality;

  const deltaSum =
    (calibrationValue * weights.calibration) +
    (decisionValue * weights.decisionLearning) +
    (kgValue * weights.knowledgeGraph) +
    (memoryValue * weights.memory) +
    (evidenceValue * weights.evidenceQuality);

  const blendedScore = Math.min(100, Math.max(0, Math.round((baseContribution + deltaSum) * 100) / 100));

  // ── Determine dominant source ──
  const contributions = [
    { name: 'base_score', absContrib: Math.abs(input.baseScore * weights.base) },
    { name: 'calibration', absContrib: Math.abs(calibrationValue * weights.calibration) },
    { name: 'decision_learning', absContrib: Math.abs(decisionValue * weights.decisionLearning) },
    { name: 'knowledge_graph', absContrib: Math.abs(kgValue * weights.knowledgeGraph) },
    { name: 'memory', absContrib: Math.abs(memoryValue * weights.memory) },
    { name: 'evidence_quality', absContrib: Math.abs(evidenceValue * weights.evidenceQuality) },
  ];
  contributions.sort((a, b) => b.absContrib - a.absContrib);

  return {
    blendedScore,
    sources,
    totalWeightApplied: totalWeight,
    dominantSource: contributions[0].name,
  };
}

/**
 * Convenience function: compute blended confidence and return
 * only the score (for cases where breakdown is not needed).
 */
export async function getBlendedScore(input: BlendedConfidenceInput): Promise<number> {
  const result = await computeBlendedConfidence(input);
  return result.blendedScore;
}

/**
 * Generate a human-readable explanation of how the blended
 * confidence was computed. Useful for the confidence explainability panel.
 */
export function explainBlendedConfidence(result: BlendedConfidenceResult): string {
  const contributing = result.sources.filter(s => s.contributed);
  if (contributing.length === 0) {
    return `Blended confidence: ${result.blendedScore}/100 (base score only, no additional intelligence sources)`;
  }

  const parts = contributing.map(s => `${s.description} (weight: ${(s.weight * 100).toFixed(0)}%)`);
  return `Blended confidence: ${result.blendedScore}/100. Sources: ${parts.join('; ')}. Dominant: ${result.dominantSource}.`;
}
