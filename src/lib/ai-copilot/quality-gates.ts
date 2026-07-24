/**
 * AI Quality Gates — 4-Check System
 *
 * Wave 8A Day 3: Every AI output must pass these gates before being
 * surfaced to users. Two gates are fully automatable (evidence + hallucination),
 * two require human review (accuracy + specificity).
 *
 * Gates:
 *   1. Evidence Check   — Does the output have citable sources? (automatable)
 *   2. Hallucination    — Is confidence suspiciously low? (automatable)
 *   3. Accuracy         — Does this match ground truth? (human review)
 *   4. Specificity      — Are there enough named entities? (automatable → flag for review)
 */

import { validateIntelligenceObject, intelligenceObjectCompleteness, type IntelligenceObject } from './intelligence-object'

// ── Types ─────────────────────────────────────────────────────────────

export type GateResult = 'pass' | 'fail' | 'warning' | 'skip'

export interface QualityGateResult {
  gate: string
  status: GateResult
  score: number        // 0-100
  message: string
  details?: string
  requiresHumanReview: boolean
}

export interface QualityReport {
  overallStatus: 'pass' | 'fail' | 'requires_review'
  overallScore: number // 0-100 weighted average
  gates: QualityGateResult[]
  timestamp: string
  objectCompleteness: number // 0-8
}

// ── Gate Configurations ───────────────────────────────────────────────

const HALLUCINATION_CONFIDENCE_THRESHOLD = 60  // Below this = likely hallucination
const SPECIFICITY_NAMED_ENTITY_MIN = 2        // Minimum named entities expected
const EVIDENCE_URL_REQUIRED = true             // Must have at least one source URL

// ── Gate Implementations ──────────────────────────────────────────────

/**
 * Gate 1: Evidence Check (automatable)
 *
 * Checks if the intelligence output has:
 * - At least one source URL
 * - At least one source name
 * - Evidence snippet with meaningful length (>20 chars)
 *
 * Scoring:
 * - 100: Has URL + name + good snippet
 * - 60:  Has URL + name but weak snippet
 * - 30:  Has URL only
 * - 0:   No evidence at all
 */
export function evidenceCheck(obj: Record<string, unknown>): QualityGateResult {
  const evidence = obj.evidence as Record<string, unknown> | undefined
  let score = 0
  const missing: string[] = []

  if (!evidence) {
    return {
      gate: 'evidence',
      status: 'fail',
      score: 0,
      message: 'No evidence object found in output',
      requiresHumanReview: false,
    }
  }

  const hasUrl = !!evidence.sourceUrl && typeof evidence.sourceUrl === 'string' && evidence.sourceUrl.startsWith('http')
  const hasName = !!evidence.sourceName && typeof evidence.sourceName === 'string' && evidence.sourceName.length > 0
  const hasSnippet = !!evidence.snippet && typeof evidence.snippet === 'string' && evidence.snippet.length > 20
  const hasDate = !!evidence.sourceDate && typeof evidence.sourceDate === 'string'

  if (hasUrl) score += 35
  else missing.push('sourceUrl')

  if (hasName) score += 25
  else missing.push('sourceName')

  // Give partial credit for short snippets
  const snippetLen = typeof evidence.snippet === 'string' ? evidence.snippet.length : 0
  if (hasSnippet) score += 25
  else if (snippetLen > 0) score += 10  // partial credit for short snippet
  else missing.push('meaningful snippet (>20 chars)')

  if (hasDate) score += 15

  const status: GateResult = score >= 70 ? 'pass' : score >= 40 ? 'warning' : 'fail'

  return {
    gate: 'evidence',
    status,
    score,
    message: status === 'pass'
      ? 'Evidence is well-sourced with URL, name, and snippet'
      : `Missing evidence fields: ${missing.join(', ')}`,
    details: `URL: ${hasUrl}, Name: ${hasName}, Snippet: ${hasSnippet}, Date: ${hasDate}`,
    requiresHumanReview: false,
  }
}

/**
 * Gate 2: Hallucination Check (automatable)
 *
 * Detects potential hallucinations via:
 * - Confidence score below threshold (default: 60)
 * - Signal text contains hedging language ("may", "might", "possibly")
 * - Evidence URL is a placeholder or generic
 *
 * Scoring:
 * - 100: High confidence + no hedging + real URL
 * - 50:  Medium confidence or mild hedging
 * - 0:   Low confidence + hedging + no real URL
 */
export function hallucinationCheck(obj: Record<string, unknown>): QualityGateResult {
  let score = 100

  // Factor 1: Confidence score
  const confidence = typeof obj.confidence === 'number' ? obj.confidence : 50
  if (confidence < HALLUCINATION_CONFIDENCE_THRESHOLD) {
    score -= 40
  } else if (confidence < 75) {
    score -= 15
  }

  // Factor 2: Hedging language in signal
  const signalText = String(obj.signal ?? '')
  const hedgingPatterns = [
    /\bmay\b/i, /\bmight\b/i, /\bpossibly\b/i, /\bpotentially\b/i,
    /\bcould\b/i, /\bperhaps\b/i, /\bit is possible\b/i, /\bappears to\b/i,
    /\bseems to\b/i, /\bsuggests that\b/i, /\bwould appear\b/i,
  ]
  const hedgingCount = hedgingPatterns.filter(p => p.test(signalText)).length
  score -= Math.min(30, hedgingCount * 10)

  // Factor 3: Evidence URL quality
  const evidence = obj.evidence as Record<string, unknown> | undefined
  const url = String(evidence?.sourceUrl ?? '')
  if (!url || !url.startsWith('http')) {
    score -= 20
  } else if (/example\.com|placeholder|localhost|test\.com/i.test(url)) {
    score -= 30
  }

  score = Math.max(0, Math.min(100, score))
  const status: GateResult = score >= 70 ? 'pass' : score >= 40 ? 'warning' : 'fail'

  return {
    gate: 'hallucination',
    status,
    score,
    message: status === 'pass'
      ? 'Output appears to be grounded in real data'
      : status === 'warning'
        ? `Possible hedging detected (confidence: ${confidence}). Review recommended.`
        : `High hallucination risk: low confidence (${confidence}), hedging language, or missing evidence URL`,
    details: `Confidence: ${confidence}, Hedging patterns: ${hedgingCount}, URL quality: ${url ? 'present' : 'missing'}`,
    requiresHumanReview: status === 'fail',
  }
}

/**
 * Gate 3: Accuracy Check (human review required)
 *
 * This gate cannot be fully automated — it requires comparison against
 * ground truth data. We provide the infrastructure for:
 * - Flagging items for human review
 * - Recording human verdicts
 * - Tracking accuracy over time
 *
 * Scoring:
 * - 100: Previously validated as accurate
 * - 50:  Not yet validated (default)
 * - 0:   Previously validated as inaccurate
 */
export function accuracyCheck(obj: Record<string, unknown>, previousVerdict?: boolean): QualityGateResult {
  if (previousVerdict === true) {
    return {
      gate: 'accuracy',
      status: 'pass',
      score: 100,
      message: 'Previously validated as accurate by human reviewer',
      requiresHumanReview: false,
    }
  }

  if (previousVerdict === false) {
    return {
      gate: 'accuracy',
      status: 'fail',
      score: 0,
      message: 'Previously flagged as inaccurate by human reviewer',
      requiresHumanReview: true,
    }
  }

  // Default: unreviewed — flag for human review
  return {
    gate: 'accuracy',
    status: 'warning',
    score: 50,
    message: 'Not yet validated against ground truth. Requires human review.',
    details: 'No human accuracy verdict recorded yet',
    requiresHumanReview: true,
  }
}

/**
 * Gate 4: Specificity Check (automatable → flags for review)
 *
 * Counts named entities in the signal text:
 * - Company names (capitalized multi-word phrases)
 * - Technology names (known tech keywords)
 * - Person names (capitalized words near title keywords)
 * - Monetary values ($X million, $X billion)
 * - Percentage changes (X%)
 *
 * Scoring:
 * - 100: 5+ named entities detected
 * - 70:  3-4 named entities
 * - 40:  1-2 named entities
 * - 0:   No specific entities
 */
export function specificityCheck(obj: Record<string, unknown>): QualityGateResult {
  const text = String(obj.signal ?? '') + ' ' + String(
    (obj.evidence as Record<string, unknown> | undefined)?.snippet ?? ''
  )

  let entityCount = 0
  const detectedEntities: string[] = []

  // Technology keywords
  const techKeywords = [
    'AWS', 'GCP', 'Azure', 'Kubernetes', 'Docker', 'Python', 'Java', 'React',
    'Node.js', 'TypeScript', 'PostgreSQL', 'MongoDB', 'Redis', 'Terraform',
    'Snowflake', 'Databricks', 'Salesforce', 'HubSpot', 'SAP', 'Oracle',
    'Machine Learning', 'AI', 'Cloud', 'API', 'microservices', 'DevOps',
  ]
  for (const tech of techKeywords) {
    if (new RegExp(`\\b${tech}\\b`, 'i').test(text)) {
      entityCount++
      detectedEntities.push(tech)
    }
  }

  // Monetary values
  const moneyPattern = /\$[\d,.]+(?:million|billion|M|B|K)?/gi
  const moneyMatches = text.match(moneyPattern)
  if (moneyMatches) {
    entityCount += moneyMatches.length
    detectedEntities.push(...moneyMatches.map(m => '$' + m.slice(1)))
  }

  // Percentage changes
  const percentPattern = /\d+(?:\.\d+)?%/g
  const percentMatches = text.match(percentPattern)
  if (percentMatches) {
    entityCount += percentMatches.length
    detectedEntities.push(...percentMatches)
  }

  // Named entities (capitalized multi-word)
  const namedPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g
  const namedMatches = text.match(namedPattern)
  if (namedMatches) {
    const filtered = namedMatches.filter(m => !techKeywords.includes(m))
    entityCount += Math.min(filtered.length, 3) // Cap at 3 to avoid overcounting
    detectedEntities.push(...filtered.slice(0, 3))
  }

  // Cap entity count for scoring
  entityCount = Math.min(entityCount, 8)

  let score: number
  let status: GateResult

  if (entityCount >= 5) {
    score = 100
    status = 'pass'
  } else if (entityCount >= 3) {
    score = 70
    status = 'pass'
  } else if (entityCount >= SPECIFICITY_NAMED_ENTITY_MIN) {
    score = 50
    status = 'warning'
  } else {
    score = entityCount * 25
    status = 'fail'
  }

  return {
    gate: 'specificity',
    status,
    score,
    message: status === 'pass'
      ? `Output contains ${entityCount}+ specific entities — well-grounded`
      : status === 'warning'
        ? `Only ${entityCount} named entities found. Consider enriching with more specifics.`
        : `Vague output — only ${entityCount} named entity detected. Needs more specific language.`,
    details: `Entities (${entityCount}): ${detectedEntities.slice(0, 5).join(', ') || 'none detected'}`,
    requiresHumanReview: status === 'fail',
  }
}

// ── Composite Quality Report ───────────────────────────────────────────

/**
 * Run all 4 quality gates on an intelligence object.
 *
 * @param obj - The intelligence object (raw LLM output or normalized)
 * @param previousVerdict - Optional human accuracy verdict from previous review
 * @returns Full quality report with per-gate results and overall assessment
 */
export function runQualityGates(
  obj: Record<string, unknown>,
  previousVerdict?: boolean,
): QualityReport {
  const gates: QualityGateResult[] = [
    evidenceCheck(obj),
    hallucinationCheck(obj),
    accuracyCheck(obj, previousVerdict),
    specificityCheck(obj),
  ]

  // Weighted average: evidence(30) + hallucination(25) + accuracy(20) + specificity(25)
  const weights = [0.30, 0.25, 0.20, 0.25]
  const overallScore = Math.round(
    gates.reduce((sum, gate, i) => sum + gate.score * weights[i], 0)
  )

  // Overall status: any 'fail' = fail, any 'requiresHumanReview' = requires_review
  const hasFail = gates.some(g => g.status === 'fail')
  const hasReview = gates.some(g => g.requiresHumanReview)
  const overallStatus = hasFail ? 'fail' : hasReview ? 'requires_review' : 'pass'

  // Check Intelligence Object completeness (bonus metric)
  const completeness = intelligenceObjectCompleteness(obj)

  return {
    overallStatus,
    overallScore,
    gates,
    timestamp: new Date().toISOString(),
    objectCompleteness: completeness,
  }
}

/**
 * Quick pass/fail check — does this object meet minimum quality bar?
 * Use this for filtering AI outputs before displaying to users.
 */
export function meetsMinimumQuality(obj: Record<string, unknown>): boolean {
  const report = runQualityGates(obj)
  // Fail if: overall fail, or any critical gate fails
  return report.overallStatus !== 'fail' && report.objectCompleteness >= 5
}

/**
 * Format a quality report for logging / audit trail.
 */
export function formatQualityReportForLog(report: QualityReport): string {
  return [
    `[QualityGate] Status: ${report.overallStatus} | Score: ${report.overallScore} | Completeness: ${report.objectCompleteness}/8`,
    ...report.gates.map(g =>
      `  [${g.gate}] ${g.status.toUpperCase()} (${g.score}) — ${g.message}${g.requiresHumanReview ? ' [HUMAN REVIEW]' : ''}`
    ),
  ].join('\n')
}
