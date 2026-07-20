/**
 * Canonical Signal Types — Single Source of Truth
 *
 * All signal-producing and signal-consuming modules MUST reference
 * these constants so that type strings are consistent across the
 * entire pipeline (detection → meaning inference → capability matching
 * → account prioritization).
 */

export const SIGNAL_TYPES = {
  FUNDING: 'funding',
  HIRING: 'hiring',
  LEADERSHIP_CHANGE: 'leadership_change',
  EXPANSION: 'expansion',
  PARTNERSHIP: 'partnership',
  PRODUCT: 'product',
  TECHNOLOGY: 'technology',
  ACQUISITION: 'acquisition',
  REGULATORY: 'regulatory',
  FINANCIAL_PRESSURE: 'financial_pressure',
  NEWS: 'news',
  MENTION: 'mention',
} as const;

export type SignalType = (typeof SIGNAL_TYPES)[keyof typeof SIGNAL_TYPES];

/** Every canonical signal type as a plain string array (for `.includes()` checks). */
export const CANONICAL_SIGNAL_TYPE_LIST: readonly string[] = Object.values(SIGNAL_TYPES);

/**
 * Aliases for backward compatibility.
 * If an incoming signal uses a legacy/non-canonical name, this map
 * resolves it to the canonical form.
 */
export const SIGNAL_TYPE_ALIASES: Record<string, SignalType> = {
  // From capability matching (old keys)
  funding_round: SIGNAL_TYPES.FUNDING,
  hiring_spree: SIGNAL_TYPES.HIRING,
  product_launch: SIGNAL_TYPES.PRODUCT,
  tech_change: SIGNAL_TYPES.TECHNOLOGY,
  tech_stack_change: SIGNAL_TYPES.TECHNOLOGY,
};

/**
 * Normalise any signal type string to its canonical form.
 * Falls through to the input value when no alias exists (so
 * already-canonical types pass through unchanged).
 */
export function normalizeSignalType(raw: string): SignalType {
  return SIGNAL_TYPE_ALIASES[raw] ?? (raw as SignalType);
}