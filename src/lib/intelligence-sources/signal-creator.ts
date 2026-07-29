/**
 * Signal Creator — Intelligence Object to CompanySignal Bridge
 *
 * Wave 8B: Converts IntelligenceObject records and AI-generated insights
 * into CompanySignal records with full 8-field Intelligence Object data.
 *
 * This is the bridge between the heavy IntelligenceObject pipeline and the
 * lightweight, actionable CompanySignal table that scoring and UI consume.
 */

import { db } from '@/lib/db';
import type { SignalType as PrismaSignalType } from '@prisma/client';

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
}

interface SignalCreationResult {
  success: boolean
  signalId?: string
  error?: string
}

/**
 * Sprint 3A: All 12 signal types including internal memory and people change.
 * Order matters — partnership before tech_change (Sprint 1 fix).
 * Internal memory and people change are checked first (highest signal fidelity).
 */
export const ALL_SIGNAL_TYPES = [
  'funding', 'hiring', 'leadership', 'partnership', 'tech_change',
  'expansion', 'product', 'news',
  'internal_memory',   // Sprint 3A: from CRM data
  'people_change',     // Sprint 3A: role changes, champion departures
] as const

export type SignalType = typeof ALL_SIGNAL_TYPES[number]

export function classifySignalType(text: string): string {
  const lower = text.toLowerCase()

  // Sprint 3A: People change signals — check BEFORE internal_memory (more specific patterns)
  if (/\brole change\b|\bchampion at risk\b|\bnew stakeholder\b|\bchampion silence\b|\bpromoted to\b|\bleft the company/i.test(lower)) return 'people_change'
  // Sprint 3A: Internal memory signals — human-curated CRM data patterns
  if (/\[sales note\]|\[human intel|\[pinned\]|account strategy|\bswot\b|\bblocker\b|\bstakeholder map/i.test(lower)) return 'internal_memory'
  // Original 8 signal types (order preserved from Sprint 1 fix)
  if (/\$[\d,.]+(?:m|b|illion|illion)/i.test(text) || /\bfunding\b|\bseries [a-z]\b|\braised\b|\brevenue\b/i.test(lower)) return 'funding'
  if (/\bhiring\b|\brecruiting\b|\bjob(s| posting)?\b/i.test(lower)) return 'hiring'
  if (/\bceo\b|\bcto\b|\bcio\b|\bcfo\b|\bvp\b|\bleadership\b|\bstepped down\b|\bdeparted\b/i.test(lower)) return 'leadership'
  if (/\bpartner\w*\b|\balliance\b|\bjoint venture\b/i.test(lower)) return 'partnership'
  if (/\bcloud\b|\bmigrat\w*\b|\baws\b|\bgcp\b|\bazure\b|\bkubernetes\b|\bdocker\b/i.test(lower)) return 'tech_change'
  if (/\bexpanding\b|\bexpansion\b|\bgrowth\b/i.test(lower)) return 'expansion'
  // product: new product, launched, released (before news catch-all)
  if (/\bnew product\b|\bproduct launch\b|\blaunched\b|\bnew feature\b/i.test(lower)) return 'product'
  return 'news'
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

    const signalType = input.signalType || classifySignalType(input.signal)
    const severity = input.severity || inferSeverity(input.confidence, input.businessImpact, input.timing)

    const signal = await db.companySignal.create({
      data: {
        companyId: input.companyId,
        signalType: signalType as PrismaSignalType,
        title: input.signal.substring(0, 500),
        description: (input.evidence || '').substring(0, 2000) || null,
        source: input.sourceName || null,
        sourceUrl: input.sourceUrl || null,
        severity,
        impact: severity === 'critical' || severity === 'high' ? 'high' : severity === 'medium' ? 'medium' : 'low',
        confidence: input.confidence / 100,
        signalDate: input.signalDate || null,
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
    // Sprint 3A: smarter business impact & recommended actions for internal memory sources
    businessImpact: (metadata.businessImpact as string) || inferBusinessImpact(obj.content, obj.sourceType, metadata),
    recommendedAction: (metadata.recommendedAction as string) || inferRecommendedAction(obj.content, obj.sourceType, metadata),
    timing: (VALID_TIMINGS.includes(metadata.timing as TimingWindow) ? metadata.timing as TimingWindow : 'within_30_days'),
    owner: (metadata.owner as string) || undefined,
    expiresAt: (metadata.expiresAt as string) || undefined,
    signalType: (metadata.signalType as string) || classifySignalType(obj.content),
    signalDate: obj.capturedAt || undefined,
    sourceReference: `intelligence-object:${obj.companyId}`,
  }
}

// ── Sprint 3A: Smart Business Impact & Action Inference ──

function inferBusinessImpact(
  content: string,
  sourceType: string,
  metadata: Record<string, unknown>
): string {
  const lower = content.toLowerCase()
  const memSource = metadata.internalMemorySource as string | undefined

  // Internal memory sources get richer impact descriptions
  if (memSource === 'human_intelligence') return 'High — human-validated intelligence with direct source attribution'
  if (memSource === 'account_strategy') return 'High — reflects strategic account planning with stakeholder mapping'
  if (memSource === 'company_note') {
    if (lower.includes('pinned')) return 'High — pinned sales note indicates critical account information'
    if (lower.includes('meeting')) return 'Medium — meeting record captures buyer context and next steps'
    if (lower.includes('discovery')) return 'High — discovery notes reveal explicit buyer needs and pain points'
    return 'Medium — sales note provides account context and relationship history'
  }
  if (memSource === 'contact_note') return 'Medium — contact interaction note reveals engagement and buying signals'
  if (memSource === 'email_engagement') {
    if (lower.includes('bounce')) return 'Medium — email delivery issues may indicate contact departure'
    if (lower.includes('high') || lower.includes('moderate')) return 'Medium — active email engagement indicates buying interest'
    return 'Low — email activity provides baseline engagement signal'
  }
  if (memSource === 'person_change') {
    if (lower.includes('champion at risk')) return 'Critical — potential champion departure threatens deal momentum'
    if (lower.includes('role change')) return 'High — role change may shift buying authority and priorities'
    if (lower.includes('new stakeholder')) return 'Medium — new contact represents expansion opportunity'
    return 'Medium — people movement detected'
  }

  return `${sourceType} intelligence detected`
}

function inferRecommendedAction(
  content: string,
  sourceType: string,
  metadata: Record<string, unknown>
): string {
  const lower = content.toLowerCase()
  const memSource = metadata.internalMemorySource as string | undefined

  if (memSource === 'human_intelligence') return 'Validate human intelligence against external data and incorporate into account strategy'
  if (memSource === 'account_strategy') return 'Review account strategy alignment with latest signals and update if needed'
  if (memSource === 'company_note') {
    if (lower.includes('pinned')) return 'Reference this critical note in all future account interactions'
    if (lower.includes('meeting')) return 'Follow up on meeting outcomes and action items within 48 hours'
    if (lower.includes('discovery')) return 'Map discovery findings to solution capabilities and build value proposition'
    return 'Review note for actionable insights and update account strategy'
  }
  if (memSource === 'contact_note') return 'Leverage interaction context to personalize next outreach'
  if (memSource === 'email_engagement') {
    if (lower.includes('bounce')) return 'Verify contact email and check if role has changed — potential champion departure'
    if (lower.includes('high') || lower.includes('moderate')) return 'Capitalize on engagement momentum with personalized follow-up'
    return 'Monitor engagement trends and adjust outreach frequency'
  }
  if (memSource === 'person_change') {
    if (lower.includes('champion at risk')) return 'URGENT: Re-engage champion or identify replacement — deal at risk'
    if (lower.includes('role change')) return 'Re-assess buying authority and tailor messaging to new responsibilities'
    if (lower.includes('new stakeholder')) return 'Introduce new contact to value proposition and assess buying role'
    return 'Review people change and assess impact on account strategy'
  }
  if (memSource === 'timeline_event') return 'Review timeline event for patterns that indicate buying readiness'

  return 'Review and determine sales action'
}
