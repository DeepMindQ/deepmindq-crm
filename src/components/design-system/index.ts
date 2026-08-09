/* ═══════════════════════════════════════════════════
   DeepMindQ Enterprise Intelligence OS — Unified Design System
   
   **Single entry point for ALL design tokens and utilities.**
   
   Primary source: intelligence-os/design-tokens.ts (dark/blue semantic tokens)
   Legacy source:  shared/enterprise-theme.ts   (DEPRECATED — gold/light utilities)
   
   New code should import from this file. The enterprise-theme.ts re-exports
   design-tokens primitives for backward compatibility with existing consumers.
   ═══════════════════════════════════════════════════ */

// ── Primary: canonical token objects from design-tokens ──
export {
  tokens,
  getConfidenceTier,
  getTrustTier,
  getPriorityTier,
  spacing,
  radius,
  typography,
  motion,
  elevation,
} from '@/components/intelligence-os/design-tokens';

// ── Legacy: enterprise-theme utilities (DEPRECATED) ──
// These unique exports have no design-tokens equivalent yet.
// Migrate consumers to tokens.* as each is replaced.
export {
  gold,
  goldLight,
  card,
  card as enterpriseCard,
  cardSolid,
  border,
  border as enterpriseBorder,
  borderSubtle,
  textPrimary,
  textSecondary,
  textMuted,
  colors,
  glassPanel,
  glassPanelGold,
  cardStyles,
  badgeColors,
  statusColors,
  animations,
  goldButton,
  chartGradients,
  spacing as enterpriseSpacing,
  cls,
} from '@/components/shared/enterprise-theme';

// ── Typography scale with Tailwind class mappings ──
export const fontClasses = {
  display: 'text-2xl font-bold tracking-tight',
  h1: 'text-xl font-bold tracking-tight',
  h2: 'text-base font-semibold tracking-tight',
  h3: 'text-sm font-semibold',
  body: 'text-[13px] leading-relaxed',
  bodySmall: 'text-xs leading-normal text-muted-foreground',
  caption: 'text-[11px] font-medium text-muted-foreground',
  micro: 'text-[10px] font-semibold text-muted-foreground tracking-wider',
} as const;

// ── Spacing classes ──
export const spaceClasses = {
  section: 'space-y-6',
  cardGap: 'gap-4',
  innerGap: 'gap-3',
  tightGap: 'gap-2',
} as const;

// ── Animation delay stagger helper ──
export function staggerDelay(index: number, baseMs = 50): number {
  return baseMs * index;
}

// ── Standard card wrapper classes ──
export const cardClasses = {
  base: 'rounded-xl border border-border bg-card',
  padded: 'rounded-xl border border-border bg-card p-5',
  interactive:
    'rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-border-hover hover:shadow-raised cursor-pointer',
} as const;

// ── Z-index scale ──
export const zIndex = {
  base: 0,
  dropdown: 50,
  sticky: 100,
  overlay: 200,
  modal: 300,
  popover: 400,
  toast: 500,
  tooltip: 600,
  skipLink: 9999,
} as const;

// ── Convenience: the complete DesignSystem object ──
export const DesignSystem = {
  fontClasses,
  spaceClasses,
  staggerDelay,
  cardClasses,
  zIndex,
} as const;

export default DesignSystem;
