'use client'

/* ═══════════════════════════════════════════════════════════════
   Settings Screen — Constants & Shared Utilities
   Extracted from settings-screen.tsx (Task 3.2)
   ═══════════════════════════════════════════════════════════════ */

export const INPUT_CLS =
  'bg-input/30 border-border focus:border-[var(--color-gold-dim)] focus:ring-1 focus:ring-[var(--color-gold-dim)]/30 transition-all duration-300'

export const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Kolkata',
  'Australia/Sydney',
  'UTC',
]

export const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 || 12
  const suffix = i < 12 ? 'AM' : 'PM'
  return { value: String(i).padStart(2, '0') + ':00', label: `${h}:00 ${suffix}` }
})

export const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

export interface ScoringRule {
  id: string
  label: string
  points: number
}

export const DEFAULT_SCORING_RULES: ScoringRule[] = [
  { id: 'corporate-domain', label: 'Corporate email domain', points: 15 },
  { id: 'email-verified', label: 'Email verified valid', points: 25 },
  { id: 'executive-role', label: 'Executive role (CTO, CIO, VP)', points: 20 },
  { id: 'director-role', label: 'Director role', points: 15 },
  { id: 'manager-role', label: 'Manager role', points: 10 },
  { id: 'target-industry', label: 'Company in target industry', points: 10 },
  { id: 'company-size', label: 'Company size 1000+', points: 10 },
]

export function getUserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}
