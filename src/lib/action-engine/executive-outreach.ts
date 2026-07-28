/**
 * Sprint 3B: Action Engine — Executive Outreach Intelligence
 *
 * Identifies the best executive targets for outreach, generates
 * personalized messaging angles, and ranks by outreach priority.
 *
 * Output: { targets: [{ name, title, reason, approach, messaging, priority }] }
 */

import { db } from '@/lib/db'
import { callAI } from '@/lib/ai-copilot/ai-caller'

export interface OutreachTarget {
  name: string
  title: string | null
  email: string
  influenceScore: number
  buyingRole: string
  relationshipStrength: string
  daysSinceContact: number
  priority: 'critical' | 'high' | 'medium' | 'low'
  reason: string
  approach: string
  messaging: string
  bestChannel: string
  bestTime: string
}

export interface ExecutiveOutreachIntelligence {
  summary: string
  targets: OutreachTarget[]
  outreachStrategy: string
  quickWins: string[]
  risks: string[]
}

export async function generateExecutiveOutreach(
  companyId: string,
  options?: { maxTargets?: number }
): Promise<ExecutiveOutreachIntelligence> {
  const maxTargets = options?.maxTargets || 8

  // ── Gather data ──
  const [company, contacts, signals, notes] = await Promise.all([
    db.company.findUnique({
      where: { id: companyId },
      select: { rawName: true, industry: true, domain: true, sizeRange: true, country: true },
    }),
    db.contact.findMany({
      where: { companyId, status: { not: 'archived' } },
      include: { _count: { select: { replies: true, notes: true } } },
      orderBy: { leadScore: 'desc' },
    }),
    db.companySignal.findMany({
      where: {
        companyId,
        status: { in: ['detected', 'validated', 'active'] },
        severity: { in: ['high', 'critical'] },
      },
      orderBy: { confidence: 'desc' },
      take: 10,
    }),
    db.companyNote.findMany({
      where: { companyId, category: { in: ['discovery', 'meeting', 'call', 'swot'] } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  if (!company) throw new Error(`Company ${companyId} not found`)

  // ── Score and rank contacts for outreach priority ──
  function calcInfluence(title: string | null): number {
    const t = (title || '').toLowerCase()
    if (/ceo|president|chief executive/.test(t)) return 95
    if (/cto|cio|chief technology|chief information/.test(t)) return 92
    if (/cfo|chief financial/.test(t)) return 88
    if (/coo|chief operating/.test(t)) return 86
    if (/vp|svp|evp|vice president/.test(t)) return 78
    if (/director|head|principal/.test(t)) return 65
    if (/senior manager|senior lead/.test(t)) return 55
    if (/manager|lead/.test(t)) return 45
    return 30
  }

  function classifyRole(title: string | null): string {
    const t = (title || '').toLowerCase()
    if (/ceo|cfo|coo|president|chief executive|chief financial/.test(t)) return 'economic_buyer'
    if (/cto|cio|chief technology|chief information|vp engineering|vp technology/.test(t)) return 'technical_buyer'
    if (/vp|svp|evp|director|head/.test(t)) return 'coach'
    if (/manager|lead|senior/.test(t)) return 'champion'
    return 'user'
  }

  const rankedTargets = contacts
    .map(c => {
      const influence = calcInfluence(c.title)
      const daysSince = c.lastContactedAt
        ? (Date.now() - c.lastContactedAt.getTime()) / 86400000
        : 999
      const engagementBonus = c._count.replies > 0 ? 15 : c.status === 'sent' ? 5 : 0
      const recencyBonus = daysSince < 7 ? 10 : daysSince < 30 ? 5 : 0
      const outreachPriority = influence + engagementBonus + recencyBonus + c.leadScore * 0.3

      return {
        contact: c,
        influence,
        buyingRole: classifyRole(c.title),
        daysSince,
        outreachPriority: Math.round(outreachPriority),
      }
    })
    .sort((a, b) => b.outreachPriority - a.outreachPriority)
    .slice(0, maxTargets)

  // ── Generate AI-powered outreach messaging ──
  const signalContext = signals.map(s =>
    `- [${s.signalType}] ${s.title}: ${s.businessImpact || ''}`
  ).join('\n')

  const targetContext = rankedTargets.map(t =>
    `${t.contact.rawName} (${t.contact.title || t.contact.role}) — influence ${t.influence}, role ${t.buyingRole}, ${t.daysSince < 30 ? `${t.daysSince} days since contact` : 'no recent contact'}, lead score ${t.contact.leadScore}`
  ).join('\n')

  const systemPrompt = `You are a B2B executive outreach strategist. Generate personalized outreach intelligence for targeting key decision-makers at an account. Provide specific, actionable messaging that references actual intelligence about the company.

RULES:
- Each target gets a unique outreach reason based on their role and the intelligence
- Messaging should be concise (2-3 sentences), specific, and reference the company's situation
- Approach should be role-appropriate (executives get business outcomes, technical get architecture, etc.)
- Identify quick wins — contacts who are most likely to respond
- Output valid JSON only`

  const userPrompt = `Generate executive outreach intelligence:

COMPANY: ${company.rawName}
INDUSTRY: ${company.industry || 'Unknown'}
SIZE: ${company.sizeRange || 'Unknown'}

HIGH-PRIORITY SIGNALS:
${signalContext || 'No high-priority signals available'}

TARGET CONTACTS (${rankedTargets.length} ranked):
${targetContext || 'No contacts available'}

INTERNAL NOTES:
${notes.map(n => `- [${n.category}] ${n.body.substring(0, 100)}`).join('\n') || 'No notes'}

Return JSON:
{
  "summary": "2-3 sentence outreach strategy summary",
  "targets": [
    {
      "name": "Contact name",
      "title": "Title",
      "reason": "Why target this person now (specific to their role and intelligence)",
      "approach": "How to approach (email, LinkedIn, intro, etc.)",
      "messaging": "2-3 sentence personalized message referencing intelligence",
      "priority": "critical|high|medium|low"
    }
  ],
  "outreachStrategy": "Overall sequencing strategy — who to contact first and why",
  "quickWins": ["Contact most likely to respond and why"],
  "risks": ["Outreach risks and mitigations"]
}`

  const aiResult = await callAI({
    systemPrompt,
    userPrompt,
    feature: 'sprint3_executive_outreach',
    companyId,
    runQualityCheck: true,
    maxRetries: 2,
    timeoutMs: 60000,
  })

  let parsed: Partial<ExecutiveOutreachIntelligence> = {}
  try {
    const cleaned = (aiResult.raw || '').replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
  } catch { /* fallback */ }

  // Merge AI targets with data-enriched contact info
  const aiTargets = Array.isArray(parsed.targets) ? parsed.targets : []
  const targets: OutreachTarget[] = rankedTargets.map((rt, i) => {
    const aiTarget = aiTargets[i] || {}
    return {
      name: rt.contact.rawName,
      title: rt.contact.title || rt.contact.role,
      email: rt.contact.email,
      influenceScore: rt.influence,
      buyingRole: rt.buyingRole,
      relationshipStrength: rt.contact._count.replies >= 3 ? 'strong' : rt.contact._count.replies >= 1 ? 'warm' : 'none',
      daysSinceContact: rt.daysSince,
      priority: (aiTarget.priority as any) || (rt.outreachPriority >= 80 ? 'critical' : rt.outreachPriority >= 60 ? 'high' : rt.outreachPriority >= 40 ? 'medium' : 'low'),
      reason: aiTarget.reason || `High-influence ${rt.buyingRole.replace('_', ' ')} contact (${rt.influence}/100 influence)`,
      approach: aiTarget.approach || 'Personalized email referencing account intelligence',
      messaging: aiTarget.messaging || `Hi ${rt.contact.rawName.split(' ')[0]}, I noticed some developments at ${company.rawName} that may be relevant to your role...`,
      bestChannel: rt.influence >= 80 ? 'Email + LinkedIn connection' : 'Email',
      bestTime: 'Tuesday-Thursday, 9:00-11:00 AM',
    }
  })

  return {
    summary: parsed.summary || `Outreach strategy for ${company.rawName} — ${targets.length} targets identified.`,
    targets,
    outreachStrategy: parsed.outreachStrategy || 'Start with highest-priority contact and work down based on engagement response.',
    quickWins: Array.isArray(parsed.quickWins) ? parsed.quickWins.slice(0, 3) : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 3) : [],
  }
}
