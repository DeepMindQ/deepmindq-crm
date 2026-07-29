/* ═══════════════════════════════════════════════════
   Enterprise Design System — DeepMindQ CRM
   
   Single source of truth for ALL screen styling.
   Glass-morphism + gold accent design language.
   ═══════════════════════════════════════════════════ */

/* ── Color Tokens ── */
export const gold = 'var(--color-gold-dim, #D4AF37)';
export const goldLight = 'var(--color-gold, #E8C860)';
export const card = 'rgba(255, 255, 255, 0.85)';
export const cardSolid = '#FFFFFF';
export const border = 'rgba(0, 0, 0, 0.08)';
export const borderSubtle = 'rgba(0, 0, 0, 0.04)';
export const textPrimary = '#111827';
export const textSecondary = '#6B7280';
export const textMuted = '#9CA3AF';

/* ── Functional Colors ── */
export const colors = {
  blue: '#3B82F6',
  green: '#10B981',
  amber: '#F59E0B',
  purple: '#A855F7',
  red: '#EF4444',
  indigo: '#6366F1',
  cyan: '#06B6D4',
  pink: '#EC4899',
  teal: '#14B8A6',
  orange: '#F97316',
  gold: '#D4AF37',
  goldLight: '#E8C860',
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
  borderLeft: '3px solid #D4AF37',
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
    borderLeft: '3px solid #D4AF37',
  },
  interactive: {
    ...defaultCard,
    cursor: 'pointer',
    transition: 'box-shadow 0.2s, transform 0.2s',
  },
} as const;

/* ── Badge Colors ── */
export const badgeColors = {
  positive: { bg: 'rgba(16, 185, 129, 0.12)', text: '#059669', border: 'rgba(16, 185, 129, 0.2)' },
  negative: { bg: 'rgba(239, 68, 68, 0.12)', text: '#DC2626', border: 'rgba(239, 68, 68, 0.2)' },
  warning: { bg: 'rgba(245, 158, 11, 0.12)', text: '#D97706', border: 'rgba(245, 158, 11, 0.2)' },
  info: { bg: 'rgba(59, 130, 246, 0.12)', text: '#2563EB', border: 'rgba(59, 130, 246, 0.2)' },
  purple: { bg: 'rgba(168, 85, 247, 0.12)', text: '#9333EA', border: 'rgba(168, 85, 247, 0.2)' },
  neutral: { bg: 'rgba(113, 113, 122, 0.12)', text: '#71717A', border: 'rgba(113, 113, 122, 0.2)' },
  gold: { bg: 'rgba(212, 175, 55, 0.12)', text: '#B8960C', border: 'rgba(212, 175, 55, 0.2)' },
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
  background: 'linear-gradient(135deg, #D4AF37, #E8C860)',
  color: '#000000',
} as const;

/* ── Chart Gradient IDs ── */
export const chartGradients = {
  gold: { id: 'gradGold', from: 'rgba(212,175,55,0.35)', to: 'rgba(212,175,55,0)' },
  green: { id: 'gradGreen', from: 'rgba(16,185,129,0.35)', to: 'rgba(16,185,129,0)' },
  blue: { id: 'gradBlue', from: 'rgba(59,130,246,0.35)', to: 'rgba(59,130,246,0)' },
  purple: { id: 'gradPurple', from: 'rgba(168,85,247,0.35)', to: 'rgba(168,85,247,0)' },
  dark: { id: 'gradDark', from: 'rgba(0,0,0,0.06)', to: 'rgba(255,255,255,0)' },
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
