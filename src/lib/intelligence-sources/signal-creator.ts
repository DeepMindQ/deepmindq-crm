/**
 * Signal Creator — Intelligence Object to CompanySignal Bridge
 *
 * Wave 8B: Converts IntelligenceObject records and AI-generated insights
 * into CompanySignal records with full 8-field Intelligence Object data.
 *
 * This is the bridge between the heavy IntelligenceObject pipeline and the
 * lightweight, actionable CompanySignal table that scoring and UI consume.
 *
 * Sprint 1 Enhancement:
 *   - Integrates three-date model for every signal created
 *   - Uses normalizeType() from signal-type-mapping for canonical taxonomy
 *   - No more signalDate: null — every signal gets the best available date
 */

import { db } from '@/lib/db'
import { normalizeType, type CanonicalSignalType } from './signal-type-mapping'
import { buildThreeDateModel, getBestDateForFreshness, serializeThreeDateModel, dateModelQuality } from './three-date-model'

type TimingWindow =
  | 'immediate' | 'within_7_days' | 'within_30_days' | 'within_90_days' | 'ongoing' | 'expired'

const VALID_TIMINGS: TimingWindow[] = [
  'immediate', 'within_7_days', 'within_30_days', 'within_90_days', 'ongoing', 'expired',
]

interface SignalCreationInput {
  companyId: string
  signal: string
  evidence?: string
  sourceUrl?: string
  sourceName?: string
  confidence: number
  businessImpact: string
  recommendedAction: string
  timing: TimingWindow
  owner?: string
  expiresAt?: string | null
  signalType?: string
  severity?: 'low' | 'medium' | 'high' | 'critical'
  signalDate?: Date | null
  sourceReference?: string
  // Sprint 1: Three-date model fields
  snippet?: string
  publishedDate?: string | null
  discoveryDate?: string
}

interface SignalCreationResult {
  success: boolean
  signalId?: string
  error?: string
}

export function classifySignalType(text: string): string {
  // Sprint 1: Delegate to the canonical taxonomy normalizer
  // First do a quick classification, then normalize to canonical type
  const lower = text.toLowerCase()
  let rawType = 'news'
  if (/\$[\d,.]+(?:m|b|illion|illion)/i.test(text) || /\bfunding\b|\bseries [a-z]\b|\braised\b|\brevenue\b/i.test(lower)) rawType = 'funding'
  else if (/\bhiring\b|\brecruiting\b|\bjob(s| posting)?\b/i.test(lower)) rawType = 'hiring'
  else if (/\bceo\b|\bcto\b|\bcio\b|\bcfo\b|\bvp\b|\bleadership\b|\bdeparted\b|\bstepped down\b/i.test(lower)) rawType = 'leadership'
  else if (/\bcloud\b|\bmigrat\w*\b|\baws\b|\bgcp\b|\bazure\b|\bkubernetes\b|\bdocker\b/i.test(lower)) rawType = 'tech_change'
  else if (/\bpartner\w*\b|\balliance\b|\bjoint venture\b/i.test(lower)) rawType = 'partnership'
  else if (/\bexpanding\b|\bexpansion\b|\bgrowth\b/i.test(lower)) rawType = 'expansion'
  else if (/\bacquir\w*\b|\bmerger\b|\bbuyout\b/i.test(lower)) rawType = 'acquisition'
  // Sprint 1: Normalize to ensure canonical type
  return normalizeType(rawType, text)
}

export function inferSeverity(
  confidence: number,
  businessImpact: string,
  timing: TimingWindow,
): 'low' | 'medium' | 'high' | 'critical' {
  let score = 0
  score += (confidence / 100) * 30
  if (timing === 'immediate') score += 30
  else if (timing === 'within_7_days') score += 25
  else if (timing === 'within_30_days') score += 15
  else if (timing === 'within_90_days') score += 8
  const impactLower = businessImpact.toLowerCase()
  if (/\bcritical\b|\burgent\b|\bhigh\s*impact\b/i.test(impactLower)) score += 40
  else if (/\bsignificant\b|\bmajor\b/i.test(impactLower)) score += 25
  else if (/\bmoderate\b|\bmedium\b/i.test(impactLower)) score += 12
  else score += 5
  if (score >= 70) return 'critical'
  if (score >= 50) return 'high'
  if (score >= 30) return 'medium'
  return 'low'
}

export async function createSignalFromIntelligenceObject(
  input: SignalCreationInput,
): Promise<SignalCreationResult> {
  try {
    const existing = await db.companySignal.findFirst({
      where: {
        companyId: input.companyId,
        title: input.signal.substring(0, 100),
        status: { in: ['detected', 'validated', 'active'] },
      },
    })

    if (existing) {
      await db.companySignal.update({
        where: { id: existing.id },
        data: {
          description: input.evidence || existing.description,
          sourceUrl: input.sourceUrl || existing.sourceUrl,
          source: input.sourceName || existing.source,
          confidence: input.confidence / 100,
          businessImpact: input.businessImpact,
          recommendedAction: input.recommendedAction,
          timingWindow: input.timing,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          severity: input.severity || inferSeverity(input.confidence, input.businessImpact, input.timing),
          status: 'active',
          extractedAt: new Date(),
        },
      })
      return { success: true, signalId: existing.id }
    }

    // Sprint 1: Normalize signal type to canonical taxonomy
    const signalType = input.signalType
      ? normalizeType(input.signalType, input.signal, input.evidence)
      : classifySignalType(input.signal)
    const severity = input.severity || inferSeverity(input.confidence, input.businessImpact, input.timing)

    // Sprint 1: Build three-date model for every signal
    const discoveryDate = input.discoveryDate || new Date().toISOString()
    const dates = buildThreeDateModel({
      publishedDate: input.publishedDate || null,
      snippet: input.snippet || input.signal || '',
      url: input.sourceUrl || null,
      discoveryDate,
    })
    const bestDate = getBestDateForFreshness(dates)
    const dateQuality = dateModelQuality(dates)

    const signal = await db.companySignal.create({
      data: {
        companyId: input.companyId,
        signalType,
        title: input.signal.substring(0, 500),
        description: (input.evidence || '').substring(0, 2000) || null,
        source: input.sourceName || null,
        sourceUrl: input.sourceUrl || null,
        severity,
        impact: severity === 'critical' || severity === 'high' ? 'high' : severity === 'medium' ? 'medium' : 'low',
        confidence: input.confidence / 100,
        signalDate: new Date(bestDate), // Sprint 1: Never null — always best available date
        // Sprint 1: Store sourcePublishedDate in publicationDate field
        publicationDate: dates.sourcePublishedDate ? new Date(dates.sourcePublishedDate) : null,
        businessImpact: input.businessImpact,
        recommendedAction: input.recommendedAction,
        timingWindow: input.timing,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        status: 'detected',
        extractedAt: new Date(),
      },
    })

    return { success: true, signalId: signal.id }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function createSignalsBatch(
  inputs: SignalCreationInput[],
): Promise<{ created: number; updated: number; failed: number; results: SignalCreationResult[] }> {
  let created = 0
  let updated = 0
  let failed = 0
  const results: SignalCreationResult[] = []

  for (const input of inputs) {
    const result = await createSignalFromIntelligenceObject(input)
    results.push(result)
    if (result.success && result.signalId) {
      created++
    } else {
      failed++
    }
  }

  return { created, updated, failed, results }
}

export function intelligenceObjectToSignalInput(
  obj: {
    companyId: string
    content: string
    summary: string | null
    sourceType: string
    sourceName: string
    sourceUrl: string | null
    originalConfidence: number
    capturedAt: Date | null
    metadata: string | null
  },
): SignalCreationInput {
  let metadata: Record<string, unknown> = {}
  try { metadata = obj.metadata ? JSON.parse(obj.metadata) : {} } catch { /* ignore */ }

  return {
    companyId: obj.companyId,
    signal: obj.summary || obj.content.substring(0, 200),
    evidence: obj.content.substring(0, 1000),
    sourceUrl: obj.sourceUrl || undefined,
    sourceName: obj.sourceName,
    confidence: Math.round(obj.originalConfidence * 100),
    businessImpact: (metadata.businessImpact as string) || `${obj.sourceType} intelligence detected`,
    recommendedAction: (metadata.recommendedAction as string) || 'Review and determine sales action',
    timing: (VALID_TIMINGS.includes(metadata.timing as TimingWindow) ? metadata.timing as TimingWindow : 'within_30_days'),
    owner: (metadata.owner as string) || undefined,
    expiresAt: (metadata.expiresAt as string) || undefined,
    signalType: (metadata.signalType as string) || classifySignalType(obj.content),
    signalDate: obj.capturedAt || undefined,
    sourceReference: `intelligence-object:${obj.companyId}`,
    // Sprint 1: Pass through fields for three-date model
    snippet: obj.content.substring(0, 200),
    publishedDate: obj.capturedAt?.toISOString() || null,
    discoveryDate: new Date().toISOString(),
  }
}
