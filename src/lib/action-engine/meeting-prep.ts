/**
 * Sprint 3B: Action Engine — Meeting Prep Briefs
 *
 * Generates a comprehensive meeting preparation brief by combining
 * all intelligence layers (external, internal, people) into an
 * actionable brief that a salesperson can consume in 3 minutes.
 *
 * Output: { executiveSummary, keyChanges, talkingPoints, discoveryQuestions, icebreakers, risks }
 */

import { db } from '@/lib/db'
import { callAI } from '@/lib/ai-copilot/ai-caller'

export interface MeetingPrepBrief {
  executiveSummary: string
  keyChanges: Array<{ change: string; source: string; timing: string }>
  talkingPoints: Array<{ point: string; evidence: string; priority: 'high' | 'medium' }>
  discoveryQuestions: string[]
  icebreakers: string[]
  risks: string[]
  contactContext: Array<{
    name: string
    title: string | null
    buyingRole: string
    lastInteraction: string | null
    relationshipStrength: string
    conversationAngle: string
  }>
}

export async function generateMeetingPrep(
  companyId: string,
  options?: { targetContactId?: string; meetingContext?: string }
): Promise<MeetingPrepBrief> {
  // ── Gather intelligence context ──
  const [company, signals, contacts, notes, strategy] = await Promise.all([
    db.company.findUnique({
      where: { id: companyId },
      select: { rawName: true, industry: true, domain: true, sizeRange: true, country: true },
    }),
    db.companySignal.findMany({
      where: { companyId, status: { in: ['detected', 'validated', 'active'] } },
      orderBy: { confidence: 'desc' },
      take: 15,
    }),
    db.contact.findMany({
      where: { companyId, status: { not: 'archived' } },
      include: { _count: { select: { replies: true, notes: true } } },
      orderBy: { leadScore: 'desc' },
      take: 8,
    }),
    db.companyNote.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    db.accountStrategy.findFirst({
      where: { companyId, status: { in: ['active', 'review', 'draft'] } },
    }),
  ])

  if (!company) throw new Error(`Company ${companyId} not found`)

  // ── Build AI prompt ──
  const signalContext = signals.map((s, i) =>
    `${i + 1}. [${s.signalType}/${s.severity}] ${s.title} (confidence: ${Math.round(s.confidence * 100)}%) — ${s.businessImpact || 'No impact stated'}`
  ).join('\n')

  const contactContext = contacts.map(c =>
    `- ${c.rawName} (${c.title || c.role || 'Unknown'}) — lead score ${c.leadScore}, ${c._count.replies} replies, ${c.status === 'replied' ? 'actively engaged' : 'not yet replied'}`
  ).join('\n')

  const noteContext = notes.slice(0, 5).map(n =>
    `- [${n.category}] ${n.title}: ${n.body.substring(0, 150)}...`
  ).join('\n')

  const targetContact = options?.targetContactId
    ? contacts.find(c => c.id === options.targetContactId)
    : contacts[0]

  const systemPrompt = `You are an expert B2B sales meeting preparation assistant. Generate a concise, actionable meeting prep brief that a salesperson can read in 3 minutes before walking into a meeting.

RULES:
- Be specific and evidence-backed — reference actual data from the intelligence
- Talking points should be ranked by sales impact
- Discovery questions should be open-ended and strategic
- Icebreakers should reference specific, recent intelligence (not generic)
- Keep the executive summary to 2-3 sentences max
- Output valid JSON only, no markdown`

  const userPrompt = `Generate a meeting prep brief for:

COMPANY: ${company.rawName}
INDUSTRY: ${company.industry || 'Unknown'}
SIZE: ${company.sizeRange || 'Unknown'}
${targetContact ? `MEETING WITH: ${targetContact.rawName} (${targetContact.title || targetContact.role || 'Unknown'})` : ''}
${options?.meetingContext ? `MEETING CONTEXT: ${options.meetingContext}` : 'No specific meeting context provided'}

INTELLIGENCE SIGNALS (${signals.length}):
${signalContext || 'No signals available'}

KEY CONTACTS (${contacts.length}):
${contactContext || 'No contacts available'}

INTERNAL NOTES (${notes.length}):
${noteContext || 'No internal notes'}

ACCOUNT STRATEGY: ${strategy ? strategy.title + ': ' + (strategy.objective || 'No objective') : 'No strategy defined'}

Return JSON:
{
  "executiveSummary": "2-3 sentence brief",
  "keyChanges": [{"change": "What changed", "source": "Where we learned this", "timing": "When"}],
  "talkingPoints": [{"point": "The talking point", "evidence": "Supporting evidence", "priority": "high|medium"}],
  "discoveryQuestions": ["Open-ended strategic question 1", "question 2", "question 3", "question 4", "question 5"],
  "icebreakers": ["Personalized icebreaker 1", "icebreaker 2", "icebreaker 3"],
  "risks": ["Risk 1", "Risk 2"]
}`

  const aiResult = await callAI({
    systemPrompt,
    userPrompt,
    feature: 'sprint3_meeting_prep',
    companyId,
    runQualityCheck: true,
    maxRetries: 2,
    timeoutMs: 60000,
  })

  // ── Parse AI response ──
  let parsed: Partial<MeetingPrepBrief> = {}
  try {
    const cleaned = (aiResult.raw || '').replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
  } catch {
    // Fallback to empty
  }

  // ── Build contact context section ──
  const contactContextList = contacts.map(c => {
    const daysSince = c.lastContactedAt
      ? Math.floor((Date.now() - c.lastContactedAt.getTime()) / 86400000)
      : 999

    const title = (c.title || c.role || '').toLowerCase()
    const buyingRole = /ceo|cfo|coo|president|chief/.test(title) ? 'economic_buyer'
      : /cto|cio|vp engineering/.test(title) ? 'technical_buyer'
      : /director|head/.test(title) ? 'champion' : 'user'

    return {
      name: c.rawName,
      title: c.title || c.role,
      buyingRole,
      lastInteraction: c.lastContactedAt?.toISOString() || null,
      relationshipStrength: c._count.replies >= 3 ? 'strong' : c._count.replies >= 1 ? 'warm' : 'cold',
      conversationAngle: buyingRole === 'economic_buyer'
        ? `Focus on business outcomes and ROI for ${company.industry || 'their'} industry`
        : buyingRole === 'technical_buyer'
          ? 'Discuss technical architecture, integration, and security considerations'
          : 'Share relevant insights and demonstrate value',
    }
  })

  return {
    executiveSummary: parsed.executiveSummary || `Meeting prep for ${company.rawName}. Review signals and contact intelligence before the call.`,
    keyChanges: Array.isArray(parsed.keyChanges) ? parsed.keyChanges.slice(0, 5) : [],
    talkingPoints: Array.isArray(parsed.talkingPoints) ? parsed.talkingPoints.slice(0, 6) : [],
    discoveryQuestions: Array.isArray(parsed.discoveryQuestions) ? parsed.discoveryQuestions.slice(0, 6) : [],
    icebreakers: Array.isArray(parsed.icebreakers) ? parsed.icebreakers.slice(0, 3) : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 4) : [],
    contactContext: contactContextList,
  }
}
