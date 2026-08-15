// ═══════════════════════════════════════════════════════════
// Design Tokens — Intelligence OS Dark Theme
// Authoritative JS token layer matching --ios-* CSS variables
// ═══════════════════════════════════════════════════════════

// ── Flat colors ──
export const flat = {
  white: '#ffffff',
  black: '#000000',
};

// ── Semantic color tokens (dark theme) ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const tokens: Record<string, any> = {
  flat,

  // Text — matches --ios-text-*
  text: {
    primary: '#e8ecf4', // --ios-text-primary / --foreground
    secondary: '#8892a8', // --ios-text-secondary / --muted-foreground
    muted: '#5a6478', // --ios-text-muted
    inverse: '#0a0c10', // --background
  },

  // Surfaces — matches --ios-bg-* / --card / --secondary
  surface: {
    primary: '#0a0c10', // --ios-bg-primary / --background
    secondary: '#0f1219', // --ios-bg-secondary
    card: '#141821', // --ios-bg-card / --card
    elevated: '#1e2433', // --ios-bg-elevated / --popover
  },
  surfaceExtended: '#1e2535', // --muted / --ios-border

  // Borders — matches --ios-border-*
  border: { default: '#1e2535' }, // --ios-border / --border
  borderFaint: '#141821',

  // Accent — Intelligence Blue
  accent: {
    primary: '#2563EB', // --primary
    hover: '#1D4ED8', // darker blue
    subtle: 'rgba(59,130,246,0.1)', // --accent (transparent for dark)
    DEFAULT: '#2563EB',
    dim: '#93C5FD', // --accent-foreground
    ghost: 'rgba(59,130,246,0.08)',
    strong: '#1E40AF',
  },

  // Confidence — matches --ios-confidence-*
  confidence: {
    high: { value: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)' },
    medium: { value: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' },
    low: { value: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)' },
    critical: { value: '#dc2626', bg: 'rgba(220,38,38,0.15)', border: 'rgba(220,38,38,0.3)' },
  },

  // Domain — intelligence domains
  domain: {
    value: '#7c3aed',
    bg: 'rgba(124,58,237,0.12)',
    border: 'rgba(124,58,237,0.25)',
    reasoning: '#7c3aed',
    opportunity: '#059669',
    risk: '#dc2626',
    action: '#2563eb',
    enrichment: '#d97706',
  },

  // Priority — matches --ios-status-*
  priority: {
    high: '#ef4444', // red
    medium: '#f59e0b', // amber
    low: '#10b981', // green
  },

  // Gold (legacy, kept for backward compatibility)
  gold: { dark: '#B8860B', light: '#FDE68A', bgMedium: '#FEF3C7', borderLight: '#FDE68A' },

  // Neutral shades for dark theme
  neutral: {
    '100': '#1e2535', // darkest usable surface
    '400': '#8892a8', // secondary text
    '900': '#e8ecf4', // lightest text / inverse
    bg: '#1e2535',
    zinc: '#71717A',
  },

  // Trust — matches --ios-confidence-* pattern
  trust: {
    verified: '#10b981',
    unverified: { value: '#8892a8', low: 'rgba(239,68,68,0.2)' },
    high: { value: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    medium: { value: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    low: { value: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  },

  // Opacity — unchanged from light theme
  opacity: {
    disabled: '0.5',
    white: '0.8',
    whisper: '0.3',
    micro: '0.05',
    trace: '0.02',
    shadow: '0.1',
    bgBright: '0.15',
  },
};

// ── Utility functions (now properly implemented) ──

type TierResult = { label: string; color: string; bg: string };

export function getConfidenceTier(score: number): TierResult {
  if (score >= 75) return { label: 'high', color: '#10b981', bg: 'rgba(16,185,129,0.12)' };
  if (score >= 40) return { label: 'medium', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
  return { label: 'low', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
}

export function getTrustTier(reliability: string): TierResult {
  switch (reliability.toLowerCase()) {
    case 'verified':
    case 'high':
      return { label: 'verified', color: '#10b981', bg: 'rgba(16,185,129,0.12)' };
    case 'medium':
      return { label: 'medium', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
    case 'low':
      return { label: 'low', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
    default:
      return { label: 'unverified', color: '#8892a8', bg: 'rgba(136,146,168,0.12)' };
  }
}

export function getPriorityTier(priority: string): TierResult {
  switch (priority.toLowerCase()) {
    case 'high':
    case 'critical':
      return { label: 'high', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
    case 'medium':
    case 'normal':
      return { label: 'medium', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
    case 'low':
      return { label: 'low', color: '#10b981', bg: 'rgba(16,185,129,0.12)' };
    default:
      return { label: 'medium', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
  }
}

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
};

export const radius = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
};

export const typography = {
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: { xs: '12px', sm: '14px', md: '16px', lg: '18px', xl: '24px' },
  fontWeight: { normal: '400', medium: '500', bold: '700' },
};

export const motion = {
  duration: { fast: '150ms', normal: '250ms', slow: '500ms' },
  easing: { default: 'ease-in-out' },
};

export const elevation = {
  sm: '0 1px 2px rgba(0,0,0,0.05)',
  md: '0 4px 6px rgba(0,0,0,0.07)',
  lg: '0 10px 15px rgba(0,0,0,0.1)',
  xl: '0 20px 25px rgba(0,0,0,0.1)',
};
