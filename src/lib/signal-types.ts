/**
 * Canonical Signal Types — Single Source of Truth
 *
 * Sprint 1: Unified to the 10-type taxonomy.
 * All signal-producing and signal-consuming modules MUST reference
 * these constants so that type strings are consistent across the
 * entire pipeline (detection → meaning inference → capability matching
 * → account prioritization).
 *
 * The 10 canonical types:
 *   funding, hiring, leadership_change, people_change, expansion,
 *   tech_change, technology_adoption, partnership, acquisition, news
 *
 * Legacy types (product, regulatory, financial_pressure, mention)
 * are mapped to canonical types via the alias table below.
 */

export const SIGNAL_TYPES = {
  FUNDING: 'funding',
  HIRING: 'hiring',
  LEADERSHIP_CHANGE: 'leadership_change',
  PEOPLE_CHANGE: 'people_change',
  EXPANSION: 'expansion',
  TECH_CHANGE: 'tech_change',
  TECHNOLOGY_ADOPTION: 'technology_adoption',
  PARTNERSHIP: 'partnership',
  ACQUISITION: 'acquisition',
  NEWS: 'news',
} as const;

export type SignalType = (typeof SIGNAL_TYPES)[keyof typeof SIGNAL_TYPES];

/** Every canonical signal type as a plain string array (for `.includes()` checks). */
export const CANONICAL_SIGNAL_TYPE_LIST: readonly string[] = Object.values(SIGNAL_TYPES);

/**
 * Aliases for backward compatibility.
 * Legacy types map to the closest canonical Sprint 1 type:
 *   - product → news (product launches are announcements)
 *   - technology → tech_change (generic technology signals)
 *   - regulatory → news (regulatory changes are news events)
 *   - financial_pressure → news (financial signals are news events)
 *   - mention → news (mentions are low-specificity news)
 */
export const SIGNAL_TYPE_ALIASES: Record<string, SignalType> = {
  // From capability matching (old keys)
  funding_round: SIGNAL_TYPES.FUNDING,
  hiring_spree: SIGNAL_TYPES.HIRING,
  product_launch: SIGNAL_TYPES.NEWS,
  tech_change: SIGNAL_TYPES.TECH_CHANGE,
  tech_stack_change: SIGNAL_TYPES.TECH_CHANGE,
  technology: SIGNAL_TYPES.TECH_CHANGE,

  // Sprint 1: Legacy type mappings
  product: SIGNAL_TYPES.NEWS,
  regulatory: SIGNAL_TYPES.NEWS,
  financial_pressure: SIGNAL_TYPES.NEWS,
  mention: SIGNAL_TYPES.NEWS,
  signal: SIGNAL_TYPES.NEWS,
  business: SIGNAL_TYPES.NEWS,
  external: SIGNAL_TYPES.NEWS,
  relationship: SIGNAL_TYPES.PARTNERSHIP,
  unknown: SIGNAL_TYPES.NEWS,
  other: SIGNAL_TYPES.NEWS,
};

/**
 * Normalise any signal type string to its canonical form.
 * Falls through to the input value when no alias exists (so
 * already-canonical types pass through unchanged).
 */
export function normalizeSignalType(raw: string): SignalType {
  return SIGNAL_TYPE_ALIASES[raw] ?? (raw as SignalType);
}