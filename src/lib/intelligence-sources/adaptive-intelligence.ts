/**
 * Sprint 1 — Adaptive Intelligence Density
 *
 * The intelligence pipeline must gracefully adapt to company signal availability.
 *
 * For signal-rich companies (enterprise):
 *   External intelligence: 70%
 *   Internal memory: 30%
 *   Output: "Microsoft is increasing AI investment externally, and your
 *            previous engagement history shows alignment opportunity."
 *
 * For signal-scarce companies (small):
 *   Internal memory: 70%
 *   External intelligence: 30%
 *   Output: "Based on previous interactions, existing opportunities, and
 *            limited external signals, this company appears to be entering
 *            a technology expansion phase."
 *
 * This module provides the adaptive weighting logic used by the reasoning engine.
 */

import { type SignalInput } from './reasoning-engine';
import { normalizeSignalType, type CanonicalSignalType } from './signal-type-mapping';

// ─── Signal Density Assessment ────────────────────────────────────

export type SignalDensity = 'abundant' | 'moderate' | 'sparse' | 'minimal';

export interface DensityAssessment {
  density: SignalDensity;
  externalSignalCount: number;
  uniqueSignalTypes: number;
  externalWeight: number;  // 0-1 — how much to weight external intelligence
  internalWeight: number;  // 0-1 — how much to weight internal memory
  recommendation: string;
}

/**
 * Assess signal density and compute the external/internal intelligence weight ratio.
 *
 * The weight ratio determines how the reasoning engine balances external signals
 * against internal CRM data when producing intelligence narratives.
 */
export function assessSignalDensity(
  signals: SignalInput[],
  internalContext?: {
    contactCount?: number;
    openOpportunities?: number;
    existingNotes?: number;
    lastInteractionDays?: number | null;
  }
): DensityAssessment {
  // Normalize signal types
  const normalizedSignals = signals.map(s => ({
    ...s,
    normalizedType: normalizeSignalType(s.signalType, s.title, s.description || undefined),
  }));

  const totalCount = normalizedSignals.length;
  const uniqueTypes = new Set(normalizedSignals.map(s => s.normalizedType)).size;

  // Compute density
  let density: SignalDensity;
  if (totalCount >= 8 && uniqueTypes >= 4) density = 'abundant';
  else if (totalCount >= 4 && uniqueTypes >= 2) density = 'moderate';
  else if (totalCount >= 1) density = 'sparse';
  else density = 'minimal';

  // Compute weights based on density + internal context availability
  const hasInternal = internalContext && (
    (internalContext.contactCount || 0) > 0 ||
    (internalContext.openOpportunities || 0) > 0 ||
    (internalContext.existingNotes || 0) > 0
  );

  let externalWeight: number;
  let recommendation: string;

  switch (density) {
    case 'abundant':
      externalWeight = 0.70;
      recommendation = 'Strong external signal coverage. Use external intelligence as primary driver, supplement with internal relationship context.';
      break;
    case 'moderate':
      externalWeight = 0.60;
      recommendation = 'Moderate external signals. Balance external findings with internal knowledge for comprehensive understanding.';
      break;
    case 'sparse':
      externalWeight = 0.40;
      recommendation = 'Limited external signals. Internal knowledge and relationship history become the primary intelligence source. External signals provide supplementary context.';
      break;
    case 'minimal':
      externalWeight = 0.20;
      recommendation = 'Minimal external signals detected. Rely primarily on internal CRM data and relationship history. Consider manual research to build intelligence baseline.';
      break;
  }

  // Adjust weights based on internal context availability
  if (!hasInternal) {
    // No internal context — external gets full weight regardless of density
    externalWeight = Math.max(externalWeight, 0.5);
    recommendation += ' Note: No internal context available — external signals are the sole intelligence source.';
  } else {
    // Rich internal context boosts internal weight for sparse signal companies
    const internalRichness = Math.min(
      ((internalContext.contactCount || 0) > 5 ? 0.3 : (internalContext.contactCount || 0) * 0.06) +
      ((internalContext.openOpportunities || 0) > 2 ? 0.3 : (internalContext.openOpportunities || 0) * 0.15) +
      ((internalContext.existingNotes || 0) > 10 ? 0.2 : (internalContext.existingNotes || 0) * 0.02),
      0.5
    );

    if (density === 'sparse' || density === 'minimal') {
      // Boost internal weight when external is weak but internal is rich
      const internalBoost = Math.min(internalRichness, 0.3);
      externalWeight = Math.max(0.15, externalWeight - internalBoost);
      recommendation += ` Rich internal context (${internalContext.contactCount || 0} contacts, ${internalContext.openOpportunities || 0} opportunities) provides strong foundation.`;
    }
  }

  return {
    density,
    externalSignalCount: totalCount,
    uniqueSignalTypes: uniqueTypes,
    externalWeight: Math.round(externalWeight * 100) / 100,
    internalWeight: Math.round((1 - externalWeight) * 100) / 100,
    recommendation,
  };
}

/**
 * Get the intelligence output template based on signal density.
 *
 * This determines how the reasoning engine phrases its output.
 * For abundant signals, we can be specific and data-driven.
 * For minimal signals, we acknowledge limitations and emphasize internal context.
 */
export function getIntelligenceTemplate(density: SignalDensity): {
  openingStyle: 'data_driven' | 'balanced' | 'context_aware' | 'cautious';
  changePresentation: 'detailed' | 'summary' | 'highlight' | 'acknowledgment';
  actionStyle: 'specific' | 'general' | 'exploratory' | 'research';
} {
  switch (density) {
    case 'abundant':
      return {
        openingStyle: 'data_driven',
        changePresentation: 'detailed',
        actionStyle: 'specific',
      };
    case 'moderate':
      return {
        openingStyle: 'balanced',
        changePresentation: 'summary',
        actionStyle: 'specific',
      };
    case 'sparse':
      return {
        openingStyle: 'context_aware',
        changePresentation: 'highlight',
        actionStyle: 'exploratory',
      };
    case 'minimal':
      return {
        openingStyle: 'cautious',
        changePresentation: 'acknowledgment',
        actionStyle: 'research',
      };
  }
}
