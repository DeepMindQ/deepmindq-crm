/**
 * Sprint 3B (v2): Next Best Action Engine — Production Intelligence Layer
 *
 * Enhanced with:
 * - Evidence traceability (links to actual DB records)
 * - AI cost governance check
 * - Action history persistence
 * - Hallucination prevention (evidence context injection)
 * - Freshness awareness
 * - Performance instrumentation
 */

import { db } from '@/lib/db'
import { callAI } from '@/lib/ai-copilot/ai-caller'
import { buildDataSourceMap, buildEvidenceContextForPrompt, traceOutputAgainstSources } from '@/lib/intelligence-sources/evidence-traceability'
import { getFreshnessStatus } from '@/lib/intelligence-sources/freshness-manager'
import { canMakeAICall } from '@/lib/intelligence-sources/ai-cost-governance'
import { updateFreshnessAfterCollection } from '@/lib/intelligence-sources/freshness-manager'

export interface NextBestAction {
  action: string
  actionType: 'outreach' | 'meeting' | 'research' | 'internal_coordination' | 'follow_up' | 'proposal' | 'escalation'
  priority: 'critical' | 'high' | 'medium' | 'low'
  urgency: 'immediate' | 'within_24_hours' | 'within_7_days' | 'within_30_days'
  reason: string
  evidence: Array<{ source: string; snippet: string; sourceId?: string }>
  expectedOutcome: string
  effort: 'low' | 'medium' | 'high'
  targetContact: { name: string; title: string | null; email: string } | null
  talkingPoint: string
  successMetric: string
  alternatives: Array<{ action: string; reason: string }>
  // Production intelligence fields
  sourceIds: string[]
  unverifiableClaims: string[]
  freshnessLevel: string
  generatedAt: string
  generationTimeMs: number
  degradationNotice?: string
}

export async function generateNextBestAction(
  companyId: string
): Promise<NextBestAction> {
  const startTime = Date.now()

  // ── AI Cost Governance Check ──
  const costCheck = await canMakeAICall(0.001)
  if (!costCheck.allowed) {
    return getDegradedNBA(companyId, costCheck.reason || 'Budget exceeded')
  }

  // ── Gather all intelligence ──
  const [company, signals, contacts, notes, strategy, freshness, dataSources] = await Promise.all([
    db.company.findUnique({
      where: { id: companyId },
      select: { rawName: true, industry: true, domain: true, sizeRange: true, status: true, lifecycleStage: true },
    }),
    db.companySignal.findMany({
      where: { companyId, status: { in: ['detected', 'validated', 'active'] } },
      orderBy: { confidence: 'desc' },
      take: 15,
    }),
    db.contact.findMany({
      where: { companyId, status: { not: 'archived' } },
      include: { _count: { select: { replies: true } } },
      orderBy: { leadScore: 'desc' },
      take: 10,
    }),
    db.companyNote.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    db.accountStrategy.findFirst({
      where: { companyId, status: { in: ['active', 'review'] } },
    }),
    getFreshnessStatus(companyId),
    buildDataSourceMap(companyId),
  ])

  if (!company) throw new Error(`Company ${companyId} not found`)

  // ── Priority calculation (data-driven, before AI) ──
  const criticalSignals = signals.filter(s => s.severity === 'critical')
  const immediateSignals = signals.filter(s => s.timingWindow === 'immediate' || s.timingWindow === 'within_7_days')
  const championAtRisk = contacts.filter(c =>
    c._count.replies >= 2 && c.leadScore >= 50 &&
    c.lastContactedAt && (Date.now() - c.lastContactedAt.getTime()) / 86400000 > 45
  )
  const noEngagement = contacts.filter(c => c.status !== 'replied' && c._count.replies === 0 && c.leadScore >= 60)

  // ── Build evidence-grounded context ──
  const signalContext = signals.slice(0, 10).map(s =>
    `- [Signal ${s.id}/${s.signalType}/${s.severity}/${s.timingWindow}] ${s.title} (${Math.round(s.confidence * 100)}%) — ${s.recommendedAction || ''}`
  ).join('\n')

  const contactContext = contacts.slice(0, 6).map(c =>
    `- ${c.rawName} (${c.title || c.role}) — score ${c.leadScore}, ${c._count.replies} replies, ${c.status}`
  ).join('\n')

  const evidenceContext = buildEvidenceContextForPrompt(dataSources)

  const systemPrompt = `You are a B2B revenue intelligence analyst. Your job is to identify the SINGLE most impactful next action a salesperson should take for this account RIGHT NOW.

RULES:
- Pick exactly ONE best action — not a list of options
- The action must be specific and actionable (not "review signals")
- Reference specific evidence from the database — use the provided source IDs
- Consider urgency: if something is time-sensitive, that wins
- Consider effort vs impact: low-effort high-impact actions win
- If there's a champion at risk, re-engagement is usually the answer
- If there's a critical signal but no engagement, outreach is the answer
- Prefix any claim you cannot verify with [Unverified]
- Output valid JSON only`

  const userPrompt = `What is the single best next action for this account?

COMPANY: ${company.rawName} | ${company.industry || 'Unknown'} | ${company.sizeRange || 'Unknown'} | ${company.lifecycleStage}
INTELLIGENCE FRESHNESS: ${freshness?.degradationLevel || 'unknown'} (last refresh: ${freshness?.daysSinceRefresh != null ? freshness.daysSinceRefresh + ' days ago' : 'never'})

KEY DATA POINTS:
- Critical signals: ${criticalSignals.length}
- Immediate timing signals: ${immediateSignals.length}
- Champions at risk: ${championAtRisk.map(c => c.rawName).join(', ') || 'None'}
- High-value unengaged contacts: ${noEngagement.map(c => c.rawName).join(', ') || 'None'}
- Has strategy: ${!!strategy}

${evidenceContext}

SIGNALS:
${signalContext}

CONTACTS:
${contactContext}

NOTES:
${notes.map(n => `- [Note ${n.id}/${n.category}] ${n.title}: ${n.body.substring(0, 80)}`).join('\n') || 'No notes'}

Return JSON:
{
  "action": "Specific action (e.g. 'Email Sarah Chen with cloud migration insight')",
  "actionType": "outreach|meeting|research|internal_coordination|follow_up|proposal|escalation",
  "priority": "critical|high|medium|low",
  "urgency": "immediate|within_24_hours|within_7_days|within_30_days",
  "reason": "Why this is the best action right now (2-3 sentences)",
  "evidence": [{"source": "signal_type", "snippet": "Evidence snippet", "sourceId": "actual_db_record_id"}],
  "expectedOutcome": "What should happen after this action",
  "effort": "low|medium|high",
  "talkingPoint": "Specific talking point or message to use",
  "successMetric": "How to measure if this action worked",
  "alternatives": [{"action": "Alternative action", "reason": "Why this is second choice"}]
}`

  const aiResult = await callAI({
    systemPrompt,
    userPrompt,
    feature: 'sprint3_next_best_action',
    companyId,
    runQualityCheck: true,
    maxRetries: 2,
    timeoutMs: 30000, // 30s SLA for NBA
  })

  let parsed: Partial<NextBestAction> = {}
  try {
    const cleaned = (aiResult.raw || '').replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
  } catch { /* fallback */ }

  // ── Evidence Traceability ──
  const traceResult = traceOutputAgainstSources(aiResult.raw || '', dataSources)

  // ── Target contact resolution ──
  const targetContactName = parsed.action?.match(/(?:email|call|reach out to|contact|engage)\s+(\w+\s+\w+)/i)?.[1]
  const targetContact = targetContactName
    ? contacts.find(c => c.rawName.toLowerCase().includes(targetContactName.toLowerCase()))
    : contacts[0]

  const generationTimeMs = Date.now() - startTime

  const result: NextBestAction = {
    action: parsed.action || 'Review account intelligence and plan engagement strategy',
    actionType: parsed.actionType || 'research',
    priority: parsed.priority || (criticalSignals.length > 0 ? 'critical' : immediateSignals.length > 0 ? 'high' : 'medium'),
    urgency: parsed.urgency || 'within_7_days',
    reason: parsed.reason || `Based on ${signals.length} signals and ${contacts.length} contacts.`,
    evidence: Array.isArray(parsed.evidence) ? parsed.evidence.slice(0, 3) : [],
    expectedOutcome: parsed.expectedOutcome || 'Increased engagement',
    effort: parsed.effort || 'medium',
    targetContact: targetContact ? { name: targetContact.rawName, title: targetContact.title || targetContact.role, email: targetContact.email } : null,
    talkingPoint: parsed.talkingPoint || '',
    successMetric: parsed.successMetric || 'Response within 7 days',
    alternatives: Array.isArray(parsed.alternatives) ? parsed.alternatives.slice(0, 2) : [],
    sourceIds: traceResult.sourceIds,
    unverifiableClaims: traceResult.unverifiableClaims,
    freshnessLevel: freshness?.degradationLevel || 'unknown',
    generatedAt: new Date().toISOString(),
    generationTimeMs,
  }

  // ── Persist Action History ──
  try {
    // Supersede previous NBA
    await db.intelligenceActionHistory.updateMany({
      where: { companyId, actionType: 'next_best_action', supersededAt: null },
      data: { supersededAt: new Date() },
    })

    await db.intelligenceActionHistory.create({
      data: {
        companyId,
        actionType: 'next_best_action',
        summary: result.action,
        content: JSON.stringify(result),
        confidence: 1 - traceResult.confidenceAdjustment,
        signalCount: signals.length,
        contactCount: contacts.length,
        evidenceIds: JSON.stringify(traceResult.sourceIds),
      },
    })
  } catch { /* best effort */ }

  return result
}

/**
 * Degraded NBA when budget is exceeded or service unavailable
 */
function getDegradedNBA(companyId: string, reason: string): NextBestAction {
  return {
    action: 'Review account notes and recent interactions for next steps',
    actionType: 'research',
    priority: 'medium',
    urgency: 'within_7_days',
    reason: `Intelligence services temporarily limited. ${reason}`,
    evidence: [],
    expectedOutcome: 'Manual review of available information',
    effort: 'low',
    targetContact: null,
    talkingPoint: '',
    successMetric: 'Complete account review',
    alternatives: [],
    sourceIds: [],
    unverifiableClaims: [],
    freshnessLevel: 'degraded',
    generatedAt: new Date().toISOString(),
    generationTimeMs: 0,
    degradationNotice: reason,
  }
}
