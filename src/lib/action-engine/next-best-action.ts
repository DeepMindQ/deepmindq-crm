/**
 * Sprint 3B: Action Engine — Next Best Action Engine
 *
 * Analyzes all intelligence layers and produces the single most impactful
 * next action for the sales team, with supporting evidence and expected outcomes.
 *
 * This is the "what should I do right now?" engine — it takes the signal noise
 * and distills it into one clear, evidence-backed action.
 */

import { db } from '@/lib/db'
import { callAI } from '@/lib/ai-copilot/ai-caller'

export interface NextBestAction {
  action: string
  actionType: 'outreach' | 'meeting' | 'research' | 'internal_coordination' | 'follow_up' | 'proposal' | 'escalation'
  priority: 'critical' | 'high' | 'medium' | 'low'
  urgency: 'immediate' | 'within_24_hours' | 'within_7_days' | 'within_30_days'
  reason: string
  evidence: Array<{ source: string; snippet: string }>
  expectedOutcome: string
  effort: 'low' | 'medium' | 'high'
  targetContact: { name: string; title: string | null; email: string } | null
  talkingPoint: string
  successMetric: string
  alternatives: Array<{ action: string; reason: string }>
}

export async function generateNextBestAction(
  companyId: string
): Promise<NextBestAction> {
  // ── Gather all intelligence ──
  const [company, signals, contacts, notes, strategy] = await Promise.all([
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
  const recentNotes = notes.filter(n => {
    return (Date.now() - n.createdAt.getTime()) / 86400000 <= 7
  })

  // ── Build context for AI ──
  const signalContext = signals.slice(0, 10).map(s =>
    `- [${s.signalType}/${s.severity}/${s.timingWindow}] ${s.title} (${Math.round(s.confidence * 100)}%) — ${s.recommendedAction || ''}`
  ).join('\n')

  const contactContext = contacts.slice(0, 6).map(c =>
    `- ${c.rawName} (${c.title || c.role}) — score ${c.leadScore}, ${c._count.replies} replies, ${c.status}, ${c.lastContactedAt ? Math.floor((Date.now() - c.lastContactedAt.getTime()) / 86400000) + 'd ago' : 'never contacted'}`
  ).join('\n')

  const systemPrompt = `You are a B2B revenue intelligence analyst. Your job is to identify the SINGLE most impactful next action a salesperson should take for this account RIGHT NOW.

RULES:
- Pick exactly ONE best action — not a list of options
- The action must be specific and actionable (not "review signals")
- Reference specific intelligence as evidence
- Consider urgency: if something is time-sensitive, that wins
- Consider effort vs impact: low-effort high-impact actions win
- If there's a champion at risk, re-engagement is usually the answer
- If there's a critical signal but no engagement, outreach is the answer
- Output valid JSON only`

  const userPrompt = `What is the single best next action for this account?

COMPANY: ${company.rawName} | ${company.industry || 'Unknown'} | ${company.sizeRange || 'Unknown'} | ${company.lifecycleStage}

KEY DATA POINTS:
- Critical signals: ${criticalSignals.length}
- Immediate timing signals: ${immediateSignals.length}
- Champions at risk: ${championAtRisk.map(c => c.rawName).join(', ') || 'None'}
- High-value unengaged contacts: ${noEngagement.map(c => c.rawName).join(', ') || 'None'}
- Recent notes: ${recentNotes.length}
- Has strategy: ${!!strategy}

SIGNALS:
${signalContext}

CONTACTS:
${contactContext}

NOTES:
${notes.map(n => `- [${n.category}] ${n.title}: ${n.body.substring(0, 80)}`).join('\n') || 'No notes'}

Return JSON:
{
  "action": "Specific action to take (e.g. 'Email Sarah Chen with cloud migration insight')",
  "actionType": "outreach|meeting|research|internal_coordination|follow_up|proposal|escalation",
  "priority": "critical|high|medium|low",
  "urgency": "immediate|within_24_hours|within_7_days|within_30_days",
  "reason": "Why this is the best action right now (2-3 sentences)",
  "evidence": [{"source": "signal_type", "snippet": "Evidence snippet"}],
  "expectedOutcome": "What should happen after this action",
  "effort": "low|medium|high",
  "talkingPoint": "The specific talking point or message to use",
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
    timeoutMs: 60000,
  })

  let parsed: Partial<NextBestAction> = {}
  try {
    const cleaned = (aiResult.raw || '').replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
  } catch { /* fallback */ }

  // Determine target contact
  const targetContactName = parsed.action?.match(/(?:email|call|reach out to|contact|engage)\s+(\w+\s+\w+)/i)?.[1]
  const targetContact = targetContactName
    ? contacts.find(c => c.rawName.toLowerCase().includes(targetContactName.toLowerCase()))
    : contacts[0]

  return {
    action: parsed.action || 'Review account intelligence and plan engagement strategy',
    actionType: parsed.actionType || 'research',
    priority: parsed.priority || (criticalSignals.length > 0 ? 'critical' : immediateSignals.length > 0 ? 'high' : 'medium'),
    urgency: parsed.urgency || 'within_7_days',
    reason: parsed.reason || `Based on ${signals.length} signals and ${contacts.length} contacts, next action should focus on building engagement.`,
    evidence: Array.isArray(parsed.evidence) ? parsed.evidence.slice(0, 3) : [],
    expectedOutcome: parsed.expectedOutcome || 'Increased engagement and response from key contact',
    effort: parsed.effort || 'medium',
    targetContact: targetContact ? { name: targetContact.rawName, title: targetContact.title || targetContact.role, email: targetContact.email } : null,
    talkingPoint: parsed.talkingPoint || '',
    successMetric: parsed.successMetric || 'Response received within 7 days',
    alternatives: Array.isArray(parsed.alternatives) ? parsed.alternatives.slice(0, 2) : [],
  }
}
