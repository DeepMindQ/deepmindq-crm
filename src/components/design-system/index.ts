/* ═══════════════════════════════════════════════════
   DeepMindQ Enterprise Intelligence OS — Unified Design System
   
   Single entry point that re-exports from all three design token sources:
   1. intelligence-os/design-tokens.ts  (TypeScript token objects)
   2. shared/enterprise-theme.ts        (CSS class utilities, card styles, badges)
   3. globals.css                       (CSS custom properties / Tailwind theme)
   
   PLUS unified typography, spacing, animation, card, and z-index helpers.
   ═══════════════════════════════════════════════════ */

// ── Re-export core token objects ──
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

// ── Re-export enterprise theme utilities ──
export {
  gold,
  goldLight,
  card as enterpriseCard,
  cardSolid,
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
