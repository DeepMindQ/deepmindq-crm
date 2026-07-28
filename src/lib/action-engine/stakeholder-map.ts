/**
 * Sprint 3B: Action Engine — Stakeholder Mapping
 *
 * Produces a comprehensive stakeholder map combining the relationship
 * mapping engine with AI-powered analysis. Outputs:
 * - Decision makers, influencers, champions, coaches
 * - Power-interest grid positioning
 * - Coverage gaps and recommendations
 *
 * This wires the existing relationship-mapping-engine.ts into the action layer.
 */

import { db } from '@/lib/db'
import { callAI } from '@/lib/ai-copilot/ai-caller'

export interface StakeholderMapAction {
  summary: string
  powerGrid: {
    manageClosely: Array<{ name: string; title: string; influence: number; engagement: number; action: string }>
    keepSatisfied: Array<{ name: string; title: string; influence: number; engagement: number; action: string }>
    keepInformed: Array<{ name: string; title: string; influence: number; engagement: number; action: string }>
    monitor: Array<{ name: string; title: string; influence: number; engagement: number; action: string }>
  }
  buyingRoles: {
    economicBuyers: Array<{ name: string; title: string; approach: string }>
    technicalBuyers: Array<{ name: string; title: string; approach: string }>
    champions: Array<{ name: string; title: string; approach: string }>
    coaches: Array<{ name: string; title: string; approach: string }>
  }
  coverageGaps: string[]
  recommendations: string[]
  multiThreadingPlan: string
  relationshipHealth: number
}

export async function generateStakeholderMap(
  companyId: string
): Promise<StakeholderMapAction> {
  // ── Gather data ──
  const [company, contacts, signals] = await Promise.all([
    db.company.findUnique({
      where: { id: companyId },
      select: { rawName: true, industry: true, domain: true, sizeRange: true },
    }),
    db.contact.findMany({
      where: { companyId, status: { not: 'archived' } },
      include: { _count: { select: { replies: true, notes: true } } },
      orderBy: { leadScore: 'desc' },
    }),
    db.companySignal.findMany({
      where: { companyId, status: { in: ['detected', 'validated', 'active'] }, signalType: 'people_change' },
      orderBy: { confidence: 'desc' },
      take: 10,
    }),
  ])

  if (!company) throw new Error(`Company ${companyId} not found`)

  // ── Score each contact ──
  function calcInfluence(title: string | null): number {
    const t = (title || '').toLowerCase()
    if (/ceo|president|chief executive/.test(t)) return 95
    if (/cto|cio|chief technology|chief information/.test(t)) return 92
    if (/cfo|chief financial/.test(t)) return 88
    if (/coo|chief operating/.test(t)) return 86
    if (/vp|svp|evp|vice president/.test(t)) return 78
    if (/director|head|principal/.test(t)) return 65
    if (/senior manager/.test(t)) return 55
    if (/manager|lead/.test(t)) return 45
    return 30
  }

  function classifyRole(title: string | null): string {
    const t = (title || '').toLowerCase()
    if (/ceo|cfo|coo|president|chief executive|chief financial/.test(t)) return 'economic_buyer'
    if (/cto|cio|chief technology|chief information|vp engineering|vp technology|architect/.test(t)) return 'technical_buyer'
    if (/director|head/.test(t)) return 'champion'
    if (/vp|svp|evp/.test(t)) return 'coach'
    return 'user'
  }

  function calcEngagement(contact: typeof contacts[0]): number {
    let score = 0
    if (contact.status === 'replied') score += 50
    else if (contact.status === 'sent') score += 20
    score += contact._count.replies * 15
    score += Math.min(20, contact.engagementScore * 0.2)
    return Math.min(100, score)
  }

  const scored = contacts.map(c => ({
    ...c,
    influence: calcInfluence(c.title),
    buyingRole: classifyRole(c.title),
    engagement: calcEngagement(c),
    daysSince: c.lastContactedAt ? Math.floor((Date.now() - c.lastContactedAt.getTime()) / 86400000) : 999,
  }))

  // ── Power-Interest Grid ──
  const manageClosely = scored.filter(c => c.influence >= 60 && c.engagement >= 40)
  const keepSatisfied = scored.filter(c => c.influence >= 60 && c.engagement < 40)
  const keepInformed = scored.filter(c => c.influence < 60 && c.engagement >= 40)
  const monitor = scored.filter(c => c.influence < 60 && c.engagement < 40)

  // ── Buying role groups ──
  const economicBuyers = scored.filter(c => c.buyingRole === 'economic_buyer')
  const technicalBuyers = scored.filter(c => c.buyingRole === 'technical_buyer')
  const champions = scored.filter(c => c.buyingRole === 'champion' && c._count.replies >= 1)
  const coaches = scored.filter(c => c.buyingRole === 'coach')

  // ── Coverage analysis ──
  const coverageGaps: string[] = []
  if (economicBuyers.length === 0) coverageGaps.push('No economic buyer — no one with budget authority identified')
  if (technicalBuyers.length === 0) coverageGaps.push('No technical buyer — no one to evaluate technical fit')
  if (champions.length === 0) coverageGaps.push('No confirmed champion — no internal advocate for your solution')
  if (contacts.length === 0) coverageGaps.push('No contacts in account — start with initial outreach')

  // ── AI analysis ──
  const signalContext = signals.map(s => `- ${s.title}`).join('\n')

  const systemPrompt = `You are a B2B stakeholder mapping expert. Analyze the contact landscape and provide strategic recommendations for stakeholder engagement.

RULES:
- Provide specific actions for each stakeholder group
- Multi-threading plan should specify who to contact in what order
- Recommendations should address identified gaps
- Output valid JSON only`

  const userPrompt = `Generate stakeholder mapping analysis:

COMPANY: ${company.rawName}
INDUSTRY: ${company.industry || 'Unknown'}

CONTACTS (${scored.length}):
${scored.map(c => `- ${c.rawName} (${c.title || c.role}) — influence ${c.influence}, engagement ${c.engagement}, role ${c.buyingRole}, ${c._count.replies} replies`).join('\n')}

POWER GRID: Manage Closely: ${manageClosely.length}, Keep Satisfied: ${keepSatisfied.length}, Keep Informed: ${keepInformed.length}, Monitor: ${monitor.length}

PEOPLE SIGNALS:
${signalContext || 'No people signals'}

COVERAGE GAPS: ${coverageGaps.join('; ')}

Return JSON:
{
  "summary": "2-3 sentence stakeholder landscape summary",
  "buyingRoles": {
    "economicBuyers": [{"name": "Name", "title": "Title", "approach": "How to engage"}],
    "technicalBuyers": [{"name": "Name", "title": "Title", "approach": "How to engage"}],
    "champions": [{"name": "Name", "title": "Title", "approach": "How to engage"}],
    "coaches": [{"name": "Name", "title": "Title", "approach": "How to engage"}]
  },
  "coverageGaps": ["Gap description"],
  "recommendations": ["Strategic recommendation"],
  "multiThreadingPlan": "Step-by-step engagement sequence plan"
}`

  const aiResult = await callAI({
    systemPrompt,
    userPrompt,
    feature: 'sprint3_stakeholder_map',
    companyId,
    runQualityCheck: true,
    maxRetries: 2,
    timeoutMs: 60000,
  })

  let parsed: Partial<StakeholderMapAction> = {}
  try {
    const cleaned = (aiResult.raw || '').replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
  } catch { /* fallback */ }

  const aiBuyingRoles = (parsed.buyingRoles || {}) as Record<string, Array<{ name: string; title: string; approach: string }>>

  return {
    summary: parsed.summary || `Stakeholder map for ${company.rawName} — ${scored.length} contacts across ${new Set(scored.map(c => c.buyingRole)).size} buying roles.`,
    powerGrid: {
      manageClosely: manageClosely.map(c => ({
        name: c.rawName, title: c.title || c.role || 'Unknown', influence: c.influence, engagement: c.engagement,
        action: 'Nurture this relationship — high influence and already engaged',
      })),
      keepSatisfied: keepSatisfied.map(c => ({
        name: c.rawName, title: c.title || c.role || 'Unknown', influence: c.influence, engagement: c.engagement,
        action: 'Increase engagement — high influence but not yet responsive',
      })),
      keepInformed: keepInformed.map(c => ({
        name: c.rawName, title: c.title || c.role || 'Unknown', influence: c.influence, engagement: c.engagement,
        action: 'Keep warm with periodic insights — engaged but lower influence',
      })),
      monitor: monitor.map(c => ({
        name: c.rawName, title: c.title || c.role || 'Unknown', influence: c.influence, engagement: c.engagement,
        action: 'Monitor for changes — currently low priority',
      })),
    },
    buyingRoles: {
      economicBuyers: (aiBuyingRoles.economicBuyers || economicBuyers.map(c => ({ name: c.rawName, title: c.title || c.role || 'Unknown', approach: 'Focus on business outcomes and ROI' }))).slice(0, 3),
      technicalBuyers: (aiBuyingRoles.technicalBuyers || technicalBuyers.map(c => ({ name: c.rawName, title: c.title || c.role || 'Unknown', approach: 'Discuss technical capabilities and integration' }))).slice(0, 3),
      champions: (aiBuyingRoles.champions || champions.map(c => ({ name: c.rawName, title: c.title || c.role || 'Unknown', approach: 'Empower with ammunition for internal advocacy' }))).slice(0, 3),
      coaches: (aiBuyingRoles.coaches || coaches.map(c => ({ name: c.rawName, title: c.title || c.role || 'Unknown', approach: 'Leverage for internal intelligence and introductions' }))).slice(0, 3),
    },
    coverageGaps: Array.isArray(parsed.coverageGaps) ? [...coverageGaps, ...parsed.coverageGaps].slice(0, 5) : coverageGaps,
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 5) : [],
    multiThreadingPlan: parsed.multiThreadingPlan || 'Start with highest-influence engaged contact and expand from there.',
    relationshipHealth: scored.length > 0 ? Math.round(
      (manageClosely.length * 100 + keepSatisfied.length * 60 + keepInformed.length * 40 + monitor.length * 20) /
      Math.max(1, scored.length)
    ) : 0,
  }
}
