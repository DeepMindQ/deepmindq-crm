// DEPRECATED: Use @/components/intelligence-os/design-tokens instead.
// This file is kept for backward compatibility and re-exports from the
// canonical design-tokens source where possible. New code should import
// from @/components/design-system (unified) or
// @/components/intelligence-os/design-tokens (tokens only).

/* ═══════════════════════════════════════════════════
   Enterprise Design System — DeepMindQ Enterprise Intelligence OS
   
   Legacy file. The canonical source of truth is now:
   @/components/intelligence-os/design-tokens.ts
   
   Unique exports (gold, glassPanel, cls, badgeColors, etc.) remain
   here until migrated. Structural tokens are re-exported from design-tokens.
   ═══════════════════════════════════════════════════ */

// ── Re-export canonical tokens from design-tokens ──
export { tokens, getConfidenceTier, getTrustTier, getPriorityTier, radius, typography, elevation } from '@/components/intelligence-os/design-tokens';

// P0.3: Import tokens as a local binding for use in this file's own value definitions.
// `export { tokens } from '...'` only re-exports — it doesn't create a local binding.
import { tokens } from '@/components/intelligence-os/design-tokens';

/* ── Color Tokens ── */
export const gold = 'var(--color-gold-dim, #d4af37)';
export const goldLight = 'var(--color-gold, #e8c860)';
export const card = tokens.opacity.white.medium;
export const cardSolid = tokens.flat.white;
export const border = tokens.opacity.micro;
export const borderSubtle = tokens.opacity.trace;
export const textPrimary = tokens.neutral['900'];
export const textSecondary = tokens.trust.unverified.value;
export const textMuted = tokens.neutral['400'];

/* ── Functional Colors ── */
export const colors = {
  blue: tokens.accent.DEFAULT,
  green: tokens.extended.emerald.value,
  amber: tokens.domain.reasoning,
  purple: tokens.domain.opportunity,
  red: tokens.domain.risk,
  indigo: tokens.extended.indigo.value,
  cyan: tokens.domain.enrichment,
  pink: tokens.extended.pink.value,
  teal: tokens.trust.high.value,
  orange: tokens.trust.low.value,
  gold: tokens.gold.DEFAULT,
  goldLight: tokens.gold.light,
} as const;

/* ── Glass Panel Styles ── */
export const glassPanel = {
  background: card,
  backdropFilter: 'blur(20px)',
  border: `1px solid ${border}`,
} as const;

export const glassPanelGold = {
  ...glassPanel,
  border: `1px solid rgba(212, 175, 55, 0.3)`,
  borderLeft: '3px solid #d4af37',
  boxShadow: '0 0 24px rgba(212, 175, 55, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)',
} as const;

/* ── Card Variants ── */
const defaultCard = {
  background: card,
  backdropFilter: 'blur(20px)',
  border: `1px solid ${border}`,
  borderRadius: '12px',
  overflow: 'hidden',
};

export const cardStyles = {
  default: defaultCard,
  bordered: (accentColor: string) => ({
    ...defaultCard,
    borderLeft: `3px solid ${accentColor}`,
  }),
  gold: {
    ...defaultCard,
    border: `1px solid rgba(212, 175, 55, 0.3)`,
    borderLeft: '3px solid #d4af37',
  },
  interactive: {
    ...defaultCard,
    cursor: 'pointer',
    transition: 'box-shadow 0.2s, transform 0.2s',
  },
} as const;

/* ── Badge Colors ── */
export const badgeColors = {
  positive: { bg: tokens.extended.emerald.bgMedium, text: tokens.extended.emeraldDeep.value, border: tokens.extended.emerald.border },
  negative: { bg: tokens.priority.critical.bg, text: tokens.extended.red.value, border: tokens.confidence.low.border },
  warning: { bg: tokens.trust.medium.bg, text: tokens.extended.amberDeep.value, border: tokens.confidence.medium.border },
  info: { bg: tokens.priority.medium.bg, text: tokens.accent.dim, border: tokens.accent.strong },
  purple: { bg: 'rgba(168, 85, 247, 0.12)', text: tokens.extended.purpleDeep.value, border: tokens.domain.opportunity },
  neutral: { bg: tokens.neutral.bg, text: tokens.flat.zinc, border: tokens.neutral.border },
  gold: { bg: tokens.gold.bgMedium, text: tokens.gold.dark, border: tokens.gold.borderLight },
} as const;

/* ── Status Colors ── */
export const statusColors = {
  active: colors.green,
  inactive: textMuted,
  pending: colors.amber,
  error: colors.red,
  processing: colors.blue,
  completed: colors.green,
  draft: colors.amber,
  sent: colors.blue,
  queued: colors.purple,
  bounced: colors.red,
  replied: colors.gold,
  opened: colors.purple,
  clicked: colors.cyan,
  imported: colors.blue,
  enriched: colors.indigo,
  fresh: colors.green,
  stale: colors.amber,
  old: colors.red,
} as const;

/* ── Animation Presets ── */
export const animations = {
  fadeIn: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
  fadeInScale: {
    initial: { opacity: 0, y: 20, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
  slideIn: (direction: 'left' | 'right' = 'left') => ({
    initial: { opacity: 0, x: direction === 'left' ? -20 : 20 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  }),
  stagger: (index: number, baseDelay = 0) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay: baseDelay + index * 0.04, ease: [0.22, 1, 0.36, 1] as const },
  }),
  barGrow: (index: number, baseDelay = 0) => ({
    initial: { width: 0 },
    animate: { width: 'var(--bar-width)' },
    transition: { duration: 0.8, delay: baseDelay + index * 0.06, ease: [0.22, 1, 0.36, 1] as const },
  }),
  hoverLift: {
    whileHover: { scale: 1.02, y: -1 },
    whileTap: { scale: 0.98 },
    transition: { duration: 0.15 },
  },
} as const;

/* ── Gold Gradient Button Style ── */
export const goldButton = {
  background: 'linear-gradient(135deg, #d4af37, #e8c860)',
  color: tokens.flat.black,
} as const;

/* ── Chart Gradient IDs ── */
export const chartGradients = {
  gold: { id: 'gradGold', from: 'rgba(212,175,55,0.35)', to: 'rgba(212,175,55,0)' },
  green: { id: 'gradGreen', from: 'rgba(16,185,129,0.35)', to: 'rgba(16,185,129,0)' },
  blue: { id: 'gradBlue', from: 'rgba(59,130,246,0.35)', to: 'rgba(59,130,246,0)' },
  purple: { id: 'gradPurple', from: 'rgba(168,85,247,0.35)', to: 'rgba(168,85,247,0)' },
  dark: { id: 'gradDark', from: tokens.opacity.whisper, to: 'rgba(255,255,255,0)' },
} as const;

/* ── Spacing Scale ── */
export const spacing = {
  screenPadding: 'px-1 pr-1',
  sectionGap: 'space-y-5',
  cardPadding: 'p-5',
  compactPadding: 'p-4',
  tightPadding: 'p-3',
} as const;

/* ── CSS Class Utilities ── */
export const cls = {
  scrollContainer: 'max-h-[calc(100vh-200px)] overflow-y-auto pr-1',
  kpiGrid: 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4',
  kpiGrid3: 'grid grid-cols-3 gap-4',
  kpiGrid4: 'grid grid-cols-2 lg:grid-cols-4 gap-4',
  splitView: 'grid grid-cols-1 lg:grid-cols-5 gap-4',
  splitView2: 'grid grid-cols-1 lg:grid-cols-2 gap-4',
  splitView3: 'grid grid-cols-1 lg:grid-cols-3 gap-4',
  sectionTitle: 'text-sm font-bold text-foreground tracking-tight',
  sectionSubtitle: 'text-[11px] text-muted-foreground mt-0.5',
  labelCaps: 'text-[11px] text-muted-foreground uppercase tracking-wider font-medium',
  valueXL: 'text-2xl font-bold tabular-nums text-foreground',
  valueLG: 'text-xl font-bold tabular-nums text-foreground',
  valueMD: 'text-sm font-bold tabular-nums text-foreground',
  valueSM: 'text-xs font-semibold tabular-nums text-foreground',
  tableHeader: 'text-[11px] uppercase tracking-wider font-medium text-muted-foreground h-9',
  iconBox: (color: string) => `w-8 h-8 rounded-lg flex items-center justify-center`,
  iconBoxSM: (color: string) => `w-7 h-7 rounded-lg flex items-center justify-center`,
  iconBoxXS: (color: string) => `w-6 h-6 rounded-lg flex items-center justify-center`,
  iconBoxBg: (color: string) => `${color}18`,
  emptyIcon: (color = gold) =>
    `w-12 h-12 rounded-2xl flex items-center justify-center mb-3`,
  emptyIconBg: (color = gold) =>
    `background: rgba(212,175,55,0.1); border: 1px solid rgba(212,175,55,0.2)`,
  searchInput:
    'h-8 pl-8 pr-7 w-48 text-xs rounded-lg',
} as const;
