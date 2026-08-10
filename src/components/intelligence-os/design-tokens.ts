/* ═══════════════════════════════════════════════════
   Intelligence OS Design Tokens — Single Source of Truth
   
   UNIFIES: :root CSS vars, --ios-* tokens, enterprise-theme.ts,
   gold constants, stripe colors, Tailwind defaults
   
   Phase 3A expanded: covers all previously-hardcoded colors.
   All components MUST reference these tokens. No hardcoded colors.
   ═══════════════════════════════════════════════════ */

// ── Semantic Color Tokens ──
export const tokens = {
  // Surfaces (dark intelligence OS)
  surface: {
    base:       '#0a0c10',
    secondary:  '#0f1219',
    card:       '#141821',
    cardHover:  '#1a1f2b',
    elevated:   '#1e2433',
    overlay:    'rgba(10, 12, 16, 0.85)',
  },

  // Borders
  border: {
    default:    '#1e2535',
    hover:      '#2a3348',
    subtle:     'rgba(42, 51, 72, 0.4)',
    focus:      '#3b82f6',
  },

  // Text hierarchy
  text: {
    primary:    '#e8ecf4',
    secondary:  '#8892a8',
    muted:      '#5a6478',
    inverse:    '#0a0c10',
    accent:     '#93c5fd',
  },

  // Intelligence accent (blue — the ONE accent)
  accent: {
    DEFAULT:    '#3b82f6',
    dim:        '#2563eb',
    bright:     '#60a5fa',
    subtle:     'rgba(59, 130, 246, 0.1)',
    strong:     'rgba(59, 130, 246, 0.25)',
    ghost:      'rgba(59, 130, 246, 0.06)',
  } as const,

  // Domain colors — from MS6 semantic state system
  domain: {
    signal:       '#3b82f6',   // Intelligence signals
    opportunity:  '#a855f7',   // AI-identified opportunities
    risk:         '#ef4444',   // Risk alerts
    enrichment:   '#06b6d4',   // Data enrichment
    reasoning:    '#f59e0b',   // AI reasoning
    action:       '#22c55e',   // Recommended actions (updated from #10b981)
  } as const,

  // Trust scale — 5 tiers from MS6 Phase 2
  trust: {
    verified:  { value: '#22c55e', bg: 'rgba(34, 197, 94, 0.12)',   border: 'rgba(34, 197, 94, 0.3)',   label: 'Verified' },
    high:      { value: '#14b8a6', bg: 'rgba(20, 184, 166, 0.12)',   border: 'rgba(20, 184, 166, 0.3)',   label: 'High Confidence' },
    medium:    { value: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)',  border: 'rgba(245, 158, 11, 0.3)',  label: 'Medium Confidence' },
    low:       { value: '#f97316', bg: 'rgba(249, 115, 22, 0.12)',  border: 'rgba(249, 115, 22, 0.3)',  label: 'Low Confidence' },
    unverified:{ value: '#6b7280', bg: 'rgba(107, 114, 128, 0.12)', border: 'rgba(107, 114, 128, 0.3)', label: 'Unverified' },
  } as const,

  // Confidence scale — 3-tier backward compatibility (maps to trust tiers)
  confidence: {
    high:   { value: '#14b8a6', bg: 'rgba(20, 184, 166, 0.1)',  border: 'rgba(20, 184, 166, 0.2)',  label: 'High' },
    medium: { value: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)',  border: 'rgba(245, 158, 11, 0.2)',  label: 'Medium' },
    low:    { value: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)',   border: 'rgba(239, 68, 68, 0.2)',   label: 'Low' },
  } as const,

  // Priority tiers — aligned with intelligence urgency
  priority: {
    critical: { value: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)',   border: 'rgba(239, 68, 68, 0.2)',   label: 'Critical', order: 0 },
    high:     { value: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)',  border: 'rgba(245, 158, 11, 0.2)',  label: 'High',     order: 1 },
    medium:   { value: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)',  border: 'rgba(59, 130, 246, 0.2)',  label: 'Medium',   order: 2 },
    low:      { value: '#8892a8', bg: 'rgba(136, 146, 168, 0.1)', border: 'rgba(136, 146, 168, 0.2)', label: 'Low',      order: 3 },
  } as const,

  // ── Gold / Premium scale (CRM wealth tier) ──
  gold: {
    DEFAULT:     '#d4af37',
    light:       '#e8c860',
    dark:        '#b8860b',
    deep:        '#9a8340',
    mutedLight:  '#d6bf79',
    bg:          'rgba(212, 175, 55, 0.1)',
    bgMedium:    'rgba(212, 175, 55, 0.12)',
    bgSubtle:    'rgba(212, 175, 55, 0.06)',
    border:      'rgba(212, 175, 55, 0.3)',
    borderLight: 'rgba(212, 175, 55, 0.2)',
    borderFaint: 'rgba(212, 175, 55, 0.15)',
    bgBright:    'rgba(212, 175, 55, 0.25)',
    bgStrong:    'rgba(212, 175, 55, 0.4)',
    bgDark:      'rgba(184, 134, 11, 0.12)',
    bgDarkLight: 'rgba(184, 134, 11, 0.06)',
  } as const,

  // ── Extended domain colors ──
  extended: {
    emerald:    { value: '#10b981', bg: 'rgba(16, 185, 129, 0.1)',  bgMedium: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.2)',  bgDark: 'rgba(5, 150, 105, 0.5)' },
    emeraldDeep:{ value: '#059669', bg: 'rgba(5, 150, 105, 0.1)' },
    purple:     { value: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)',   bgMedium: 'rgba(139, 92, 246, 0.12)', border: 'rgba(139, 92, 246, 0.2)',   bgSubtle: 'rgba(139, 92, 246, 0.06)', bgFaint: 'rgba(139, 92, 246, 0.15)' },
    purpleDeep: { value: '#7c3aed', bg: 'rgba(124, 58, 237, 0.1)',  border: 'rgba(124, 58, 237, 0.2)' },
    indigo:     { value: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)',  bgSubtle: 'rgba(99, 102, 241, 0.06)' },
    sky:        { value: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.1)',  border: 'rgba(14, 165, 233, 0.2)' },
    amber:      { value: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)',  border: 'rgba(251, 191, 36, 0.2)' },
    amberDeep:  { value: '#d97706' },
    rose:       { value: '#f87171', bg: 'rgba(248, 113, 113, 0.1)', border: 'rgba(248, 113, 113, 0.2)' },
    red:        { value: '#dc2626', bg: 'rgba(220, 38, 38, 0.1)',   border: 'rgba(220, 38, 38, 0.2)' },
    redDark:    { value: '#991b1b' },
    violet:     { value: '#a78bfa', bg: 'rgba(167, 139, 250, 0.1)' },
    cyan:       { value: '#22d3ee', bg: 'rgba(34, 211, 238, 0.1)',  border: 'rgba(34, 211, 238, 0.2)' },
    cyanDark:   { value: '#0891b2' },
    lime:       { value: '#84cc16', bg: 'rgba(132, 204, 22, 0.1)' },
    limeBright: { value: '#a3e635' },
    limeDark:   { value: '#65a30d' },
    greenDeep:  { value: '#16a34a' },
    orange:     { value: '#ea580c' },
    orangeLight:{ value: '#f97316' },
    yellowDeep: { value: '#ca8a04' },
    pink:       { value: '#ec4899' },
    blue:       { value: '#1d4ed8', bg: 'rgba(29, 78, 216, 0.1)',  border: 'rgba(29, 78, 216, 0.2)' },
    blueDeep:   { value: '#1e40af' },
    blueBright: { value: '#4361ee', bg: 'rgba(67, 97, 238, 0.1)',  border: 'rgba(67, 97, 238, 0.2)' },
  } as const,

  // ── Neutral extended scale ──
  neutral: {
    50:  '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
    bg:    'rgba(161, 161, 170, 0.12)',
    border:'rgba(161, 161, 170, 0.2)',
  } as const,

  // ── Surface extended ──
  surfaceExtended: {
    darkAlt:   '#0f1117',
    deepDark:  '#0f0f11',
    panel:     '#12121e',
    mutedBg:   '#1a1a2e',
    overlay:   'rgba(6, 9, 15, 0.88)',
    overlayAlt:'rgba(8, 8, 22, 0.85)',
    overlayDeep:'rgba(15, 15, 26, 0.85)',
    backdrop:  'rgba(30, 37, 53, 0.8)',
    backdropAlt:'rgba(17, 24, 39, 0.8)',
  } as const,

  // ── Opacity utility tokens ──
  opacity: {
    strong:  'rgba(0, 0, 0, 0.7)',
    medium:  'rgba(0, 0, 0, 0.5)',
    subtle:  'rgba(0, 0, 0, 0.3)',
    faint:   'rgba(0, 0, 0, 0.16)',
    micro:   'rgba(0, 0, 0, 0.08)',
    whisper: 'rgba(0, 0, 0, 0.06)',
    trace:   'rgba(0, 0, 0, 0.04)',
    shadow:  'rgba(0, 0, 0, 0.02)',
    ghost:   'rgba(0, 0, 0, 0.015)',
    white: {
      strong:  'rgba(255, 255, 255, 0.97)',
      medium:  'rgba(255, 255, 255, 0.85)',
      subtle:  'rgba(255, 255, 255, 0.5)',
      faint:   'rgba(255, 255, 255, 0.2)',
      micro:   'rgba(255, 255, 255, 0.12)',
      whisper: 'rgba(255, 255, 255, 0.1)',
      trace:   'rgba(255, 255, 255, 0.06)',
      shadow:  'rgba(255, 255, 255, 0.05)',
      ghost:   'rgba(255, 255, 255, 0.04)',
      dust:    'rgba(255, 255, 255, 0.03)',
      hint:    'rgba(255, 255, 255, 0.02)',
    },
  } as const,

  // ── Flat utility colors ──
  flat: {
    white:      '#ffffff',
    black:      '#000000',
    offWhite:   '#f8f9fa',
    warmWhite:  '#f0f0f5',
    coolGray:   '#e4e4e7',
    slate:      '#a0a0b8',
    mutedGray:  '#6b6b80',
    dimGray:    '#666666',
    mediumGray: '#999999',
    lightGray:  '#cccccc',
    lighterGray:'#eeeeeee',
    borderGray: '#a1a1aa',
    zinc:       '#71717a',
    zincDark:   '#52525b',
    skyBlue:    '#818cf8',
    lightBlue:  '#bfdbfe',
    softBlue:   '#eff6ff',
    lightRed:   '#fef2f2',
    lightGreen: '#ecfdf5',
    lightAmber: '#fef3c7',
    warmBg:     '#fffdf5',
    warmBgAlt:  '#fffbeb',
    coolBg:     '#f8fafc',
    purpleBg:   '#fef2f2',
    tealBg:     '#fef2f2',
  } as const,
} as const;

// ── Get confidence tier from numeric value (3-tier legacy) ──
export function getConfidenceTier(value: number): keyof typeof tokens.confidence {
  if (value >= 70) return 'high';
  if (value >= 45) return 'medium';
  return 'low';
}

// ── Get trust tier from numeric value (5-tier from MS6) ──
export function getTrustTier(value: number): keyof typeof tokens.trust {
  if (value >= 90) return 'verified';
  if (value >= 70) return 'high';
  if (value >= 45) return 'medium';
  if (value >= 25) return 'low';
  return 'unverified';
}

// ── Get priority tier from label ──
export function getPriorityTier(priority: string): keyof typeof tokens.priority {
  const p = priority.toLowerCase();
  if (p === 'critical') return 'critical';
  if (p === 'high') return 'high';
  if (p === 'medium') return 'medium';
  return 'low';
}

// ── Spacing Scale ──
export const spacing = {
  xs:  '4px',
  sm:  '8px',
  md:  '12px',
  lg:  '16px',
  xl:  '20px',
  '2xl': '24px',
  '3xl': '32px',
} as const;

// ── Radius Scale ──
export const radius = {
  sm:  '6px',
  md:  '8px',
  lg:  '12px',
  xl:  '16px',
  full: '9999px',
} as const;

// ── Typography Scale (dark theme) ──
export const typography = {
  display:   { size: '24px', weight: 700, lineHeight: 1.15, tracking: '-0.025em', color: tokens.text.primary },
  h1:        { size: '20px', weight: 700, lineHeight: 1.2,  tracking: '-0.02em',  color: tokens.text.primary },
  h2:        { size: '16px', weight: 600, lineHeight: 1.3,  tracking: '-0.01em',  color: tokens.text.primary },
  h3:        { size: '14px', weight: 600, lineHeight: 1.4,  tracking: '0',         color: tokens.text.primary },
  body:      { size: '13px', weight: 400, lineHeight: 1.6,  tracking: '0',         color: tokens.text.primary },
  bodySmall: { size: '12px', weight: 400, lineHeight: 1.5,  tracking: '0',         color: tokens.text.secondary },
  caption:   { size: '11px', weight: 500, lineHeight: 1.4,  tracking: '0.02em',    color: tokens.text.muted },
  micro:     { size: '10px', weight: 600, lineHeight: 1.3,  tracking: '0.04em',    color: tokens.text.muted },
} as const;

// ── Motion Presets ──
export const motion = {
  fast:    { duration: 0.15, ease: [0.22, 1, 0.36, 1] as const },
  default: { duration: 0.25, ease: [0.22, 1, 0.36, 1] as const },
  smooth:  { duration: 0.4,  ease: [0.22, 1, 0.36, 1] as const },
  gentle:  { duration: 0.6,  ease: [0.16, 1, 0.3, 1]  as const },
} as const;

// ── Elevation System ──
const shadowRest    = '0 1px 2px 0 rgba(0,0,0,0.08)';
const shadowRaised  = '0 1px 3px 0 rgba(0,0,0,0.12), 0 1px 2px -1px rgba(0,0,0,0.06)';
const shadowOverlay = '0 10px 15px -3px rgba(0,0,0,0.16), 0 4px 6px -4px rgba(0,0,0,0.08)';
const shadowModal   = '0 20px 25px -5px rgba(0,0,0,0.2), 0 8px 10px -6px rgba(0,0,0,0.08)';
const shadowFloat   = '0 0 0 1px rgba(0,0,0,0.06), 0 8px 16px rgba(0,0,0,0.16)';

export const elevation = {
  rest:    { shadow: shadowRest,    border: '1px solid ' + tokens.border.default },
  raised:  { shadow: shadowRaised,  border: '1px solid ' + tokens.border.hover },
  overlay: { shadow: shadowOverlay },
  modal:   { shadow: shadowModal },
  float:   { shadow: shadowFloat },
} as const;
