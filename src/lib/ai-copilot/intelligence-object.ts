/**
 * Intelligence Object Framework — Platform DNA
 *
 * Wave 8A: The 8-field standard for ALL AI output across the platform.
 * Every signal, insight, recommendation, and score must conform to this schema.
 *
 * Fields:
 *   1. Signal         — What was detected (the "what")
 *   2. Evidence       — Source URL + snippet (the "why we know")
 *   3. Confidence     — 0-100 reliability score (the "how sure")
 *   4. BusinessImpact — Revenue/relevance implication (the "so what")
 *   5. RecommendedAction — What sales should do (the "now what")
 *   6. Timing         — When to act (the "when")
 *   7. Owner          — Who should act (the "who")
 *   8. Expiry         — When this intelligence decays (the "freshness")
 */

// ── Core Types ─────────────────────────────────────────────────────────

/** Valid timing window values — how urgently the action should be taken */
export type TimingWindow =
  | 'immediate'        // Act now — this is a live trigger
  | 'within_7_days'    // High priority this week
  | 'within_30_days'   // Plan for this month
  | 'within_90_days'   // Strategic horizon
  | 'ongoing'          // Continuous opportunity, no deadline
  | 'expired'          // Past its window — for historical reference only

/** Impact severity for business implications */
export type ImpactLevel = 'high' | 'medium' | 'low' | 'critical'

/**
 * The canonical Intelligence Object.
 *
 * This is the standard output format for every AI-generated insight
 * in the platform. All 8 fields must be populated — nullable fields
 * indicate incomplete intelligence that should be enriched.
 */
export interface IntelligenceObject {
  /** What was detected — the signal description */
  signal: string

  /** Source evidence — URL + snippet proving this is real */
  evidence: {
    sourceUrl: string
    sourceName: string
    snippet: string
    sourceDate?: string
  }

  /** 0-100 confidence in this intelligence */
  confidence: number

  /** Business impact — what this means for revenue */
  businessImpact: string

  /** Recommended sales action */
  recommendedAction: string

  /** Timing urgency */
  timing: TimingWindow

  /** Who should own this action */
  owner: string

  /** When this intelligence expires (ISO date or null) */
  expiresAt: string | null
}

// ── Prompt Helpers ─────────────────────────────────────────────────────

/**
 * Returns the JSON schema instruction for Intelligence Object output.
 * Include this in every AI system prompt to enforce the 8-field standard.
 */
export const INTELLIGENCE_OBJECT_PROMPT_INSTRUCTION = `
Every output MUST follow the Intelligence Object standard (8 fields):
1. "signal" — What was detected (specific, factual statement)
2. "evidence" — { "sourceUrl": "...", "sourceName": "...", "snippet": "..." }
3. "confidence" — 0-100 (how reliable is this information)
4. "businessImpact" — What this means for revenue/sales (be specific)
5. "recommendedAction" — What the sales team should do (be actionable)
6. "timing" — "immediate" | "within_7_days" | "within_30_days" | "within_90_days" | "ongoing"
7. "owner" — Who should act (role or team)
8. "expiresAt" — ISO date when this intelligence becomes stale, or null

CRITICAL: Every signal without all 8 fields is INCOMPLETE and will be flagged.
If evidence is weak, lower confidence. If timing is unclear, use "within_30_days".
Never leave fields empty — estimate if necessary and note the estimate in evidence.`

/**
 * Returns a single Intelligence Object as a JSON example for prompts.
 */
export const INTELLIGENCE_OBJECT_EXAMPLE = JSON.stringify({
  signal: "Acme Corp hired 15 cloud engineers in Q2 2026, up from 3 in Q1",
  evidence: {
    sourceUrl: "https://linkedin.com/jobs/acme-corp-cloud-engineers",
    sourceName: "LinkedIn Jobs",
    snippet: "Acme Corp is actively hiring 15 cloud infrastructure engineers with AWS/GCP experience requirements",
    sourceDate: "2026-06-15",
  },
  confidence: 88,
  businessImpact: "High — 5x hiring increase signals major cloud migration initiative. Estimated $2-5M infrastructure budget.",
  recommendedAction: "Position cloud optimization assessment. Reference their hiring patterns as conversation opener with CTO.",
  timing: "within_7_days",
  owner: "Enterprise AE — West Region",
  expiresAt: "2026-09-15",
}, null, 2)

// ── Validation Helpers ──────────────────────────────────────────────────

const VALID_TIMINGS: TimingWindow[] = [
  'immediate', 'within_7_days', 'within_30_days', 'within_90_days', 'ongoing', 'expired',
]

/**
 * Validate an Intelligence Object has all required fields populated.
 * Returns array of missing/invalid field names.
 */
export function validateIntelligenceObject(obj: Record<string, unknown>): string[] {
  const issues: string[] = []

  if (!obj.signal || typeof obj.signal !== 'string' || obj.signal.length < 5) {
    issues.push('signal: must be a string with at least 5 characters')
  }

  if (!obj.evidence || typeof obj.evidence !== 'object') {
    issues.push('evidence: must be an object with sourceUrl, sourceName, snippet')
  } else {
    const ev = obj.evidence as Record<string, unknown>
    if (!ev.sourceUrl || typeof ev.sourceUrl !== 'string') issues.push('evidence.sourceUrl: required')
    if (!ev.sourceName || typeof ev.sourceName !== 'string') issues.push('evidence.sourceName: required')
    if (!ev.snippet || typeof ev.snippet !== 'string') issues.push('evidence.snippet: required')
  }

  if (typeof obj.confidence !== 'number' || obj.confidence < 0 || obj.confidence > 100) {
    issues.push('confidence: must be 0-100')
  }

  if (!obj.businessImpact || typeof obj.businessImpact !== 'string') {
    issues.push('businessImpact: required string')
  }

  if (!obj.recommendedAction || typeof obj.recommendedAction !== 'string') {
    issues.push('recommendedAction: required string')
  }

  if (!obj.timing || !VALID_TIMINGS.includes(obj.timing as TimingWindow)) {
    issues.push(`timing: must be one of ${VALID_TIMINGS.join(', ')}`)
  }

  if (!obj.owner || typeof obj.owner !== 'string') {
    issues.push('owner: required string')
  }

  // expiresAt is optional but if provided must be valid ISO date
  if (obj.expiresAt !== null && obj.expiresAt !== undefined) {
    if (typeof obj.expiresAt !== 'string' || isNaN(Date.parse(obj.expiresAt as string))) {
      issues.push('expiresAt: must be null or valid ISO date string')
    }
  }

  return issues
}

/**
 * Calculate a completeness score for an Intelligence Object (0-8).
 * Each populated field = 1 point.
 */
export function intelligenceObjectCompleteness(obj: Record<string, unknown>): number {
  let score = 0
  if (obj.signal) score++
  if (obj.evidence && typeof obj.evidence === 'object') score++
  if (typeof obj.confidence === 'number') score++
  if (obj.businessImpact) score++
  if (obj.recommendedAction) score++
  if (obj.timing && VALID_TIMINGS.includes(obj.timing as TimingWindow)) score++
  if (obj.owner) score++
  if (obj.expiresAt !== undefined) score++
  return score
}

/**
 * Normalize a raw LLM JSON output into a valid IntelligenceObject.
 * Fills missing fields with sensible defaults and flags them.
 */
export function normalizeIntelligenceObject(raw: Record<string, unknown>): IntelligenceObject {
  const evidence = (raw.evidence && typeof raw.evidence === 'object')
    ? raw.evidence as Record<string, unknown>
    : {}

  return {
    signal: String(raw.signal ?? 'Unspecified signal'),
    evidence: {
      sourceUrl: String(evidence.sourceUrl ?? ''),
      sourceName: String(evidence.sourceName ?? 'Unknown'),
      snippet: String(evidence.snippet ?? ''),
      sourceDate: evidence.sourceDate ? String(evidence.sourceDate) : undefined,
    },
    confidence: typeof raw.confidence === 'number'
      ? Math.min(100, Math.max(0, Math.round(raw.confidence)))
      : 50,
    businessImpact: String(raw.businessImpact ?? 'Not assessed'),
    recommendedAction: String(raw.recommendedAction ?? 'Not specified'),
    timing: VALID_TIMINGS.includes(raw.timing as TimingWindow)
      ? raw.timing as TimingWindow
      : 'within_30_days',
    owner: String(raw.owner ?? 'Unassigned'),
    expiresAt: raw.expiresAt ? String(raw.expiresAt) : null,
  }
}

// ── Schema ↔ Intelligence Object Mapping ──────────────────────────────

/**
 * Map a CompanySignal DB record to an IntelligenceObject.
 * Fields that don't exist in DB yet (businessImpact, recommendedAction,
 * timingWindow, expiresAt) are filled from description/severity heuristics.
 */
export function companySignalToIntelligenceObject(signal: {
  title: string
  description?: string | null
  source?: string | null
  sourceUrl?: string | null
  confidence: number
  severity: string
  impact: string
  signalDate?: Date | null
  businessImpact?: string | null
  recommendedAction?: string | null
  timingWindow?: string | null
  expiresAt?: Date | null
}): IntelligenceObject {
  return {
    signal: signal.title + (signal.description ? ': ' + signal.description : ''),
    evidence: {
      sourceUrl: signal.sourceUrl ?? '',
      sourceName: signal.source ?? 'CRM Signal',
      snippet: signal.description ?? signal.title,
      sourceDate: signal.signalDate?.toISOString(),
    },
    confidence: Math.round(signal.confidence * 100),
    businessImpact: signal.businessImpact ?? `${capitalize(signal.impact)} impact — ${signal.severity} severity signal`,
    recommendedAction: signal.recommendedAction ?? 'Review signal details and determine sales action',
    timing: (VALID_TIMINGS.includes(signal.timingWindow as TimingWindow)
      ? signal.timingWindow as TimingWindow
      : signal.severity === 'critical' ? 'immediate'
      : signal.severity === 'high' ? 'within_7_days'
      : 'within_30_days'),
    owner: 'Unassigned',
    expiresAt: signal.expiresAt?.toISOString() ?? null,
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
