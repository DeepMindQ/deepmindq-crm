// Comprehensive design tokens stub — matches the shape expected by all consuming components
// Uses loose typing to accept any property access pattern

// ── Flat colors ──
export const flat = {
  white: '#ffffff',
  black: '#000000',
};

// ── Semantic color tokens ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const tokens: Record<string, any> = {
  flat,
  text: { primary: '#111827', secondary: '#6B7280', muted: '#9CA3AF', inverse: '#ffffff' },
  surface: { primary: '#ffffff', secondary: '#F9FAFB', card: '#ffffff', elevated: '#F9FAFB' },
  surfaceExtended: '#F3F4F6',
  border: { default: '#E5E7EB' },
  borderFaint: '#F3F4F6',
  accent: { primary: '#2563EB', hover: '#1D4ED8', subtle: '#DBEAFE', DEFAULT: '#2563EB', dim: '#93C5FD', ghost: '#EFF6FF', strong: '#1E40AF' },
  confidence: { high: { value: '#16A34A', bg: '#DCFCE7', border: '#BBF7D0' }, medium: { value: '#D97706', bg: '#FEF3C7', border: '#FDE68A' }, low: { value: '#DC2626', bg: '#FEE2E2', border: '#FECACA' }, critical: { value: '#991B1B', bg: '#FEE2E2', border: '#FECACA' } },
  domain: { value: '#7C3AED', bg: '#EDE9FE', border: '#DDD6FE', reasoning: '#7C3AED', opportunity: '#059669', risk: '#DC2626', action: '#2563EB', enrichment: '#D97706' },
  priority: { high: '#DC2626', medium: '#D97706', low: '#16A34A' },
  gold: { dark: '#B8860B', light: '#FDE68A', bgMedium: '#FEF3C7', borderLight: '#FDE68A' },
  neutral: { '100': '#F3F4F6', '400': '#9CA3AF', '900': '#111827', bg: '#F3F4F6', zinc: '#71717A' },
  trust: { verified: '#16A34A', unverified: { value: '#6B7280', low: '#FCA5A5' }, high: { value: '#16A34A', bg: '#DCFCE7' }, medium: { value: '#D97706', bg: '#FEF3C7' }, low: { value: '#DC2626', bg: '#FEE2E2' } },
  opacity: { disabled: '0.5', white: '0.8', whisper: '0.3', micro: '0.05', trace: '0.02', shadow: '0.1', bgBright: '0.15' },
};

// ── Utility functions ──
export function getConfidenceTier(_score: number) {
  return { label: 'medium', color: '#D97706', bg: '#FEF3C7' };
}

export function getTrustTier(_reliability: string) {
  return { label: 'unverified', color: '#6B7280', bg: '#F3F4F6' };
}

export function getPriorityTier(_priority: string) {
  return { label: 'medium', color: '#D97706', bg: '#FEF3C7' };
}

export const spacing = {
  xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px', '2xl': '48px',
};

export const radius = {
  sm: '4px', md: '8px', lg: '12px', xl: '16px', full: '9999px',
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
  sm: '0 1px 2px rgba(0,0,0,0.05)', md: '0 4px 6px rgba(0,0,0,0.07)', lg: '0 10px 15px rgba(0,0,0,0.1)', xl: '0 20px 25px rgba(0,0,0,0.1)',
};
