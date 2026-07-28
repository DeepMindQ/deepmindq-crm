/**
 * Sprint 3B: Action Engine — Account Strategy Plans
 *
 * Generates or enriches account strategy using all intelligence layers.
 * Combines external signals, internal memory, and people intelligence
 * into a comprehensive strategic plan.
 *
 * Output: { priorities, solutionAlignment, risks, blockers, opportunityAreas, nextSteps }
 */

import { db } from '@/lib/db'
import { callAI } from '@/lib/ai-copilot/ai-caller'

export interface AccountStrategyPlan {
  executiveSummary: string
  accountSituation: string
  priorities: Array<{ priority: string; rationale: string; evidence: string; urgency: 'critical' | 'high' | 'medium' }>
  solutionAlignment: Array<{ capability: string; evidence: string; fitScore: number }>
  risks: Array<{ risk: string; probability: 'high' | 'medium' | 'low'; mitigation: string }>
  blockers: string[]
  opportunityAreas: Array<{ area: string; estimatedValue: string; buyingStage: string; confidence: number }>
  competitivePosition: string
  nextSteps: Array<{ action: string; owner: string; timeline: string; priority: string }>
  resourceRequirements: string[]
}

export async function generateAccountStrategy(
  companyId: string
): Promise<AccountStrategyPlan> {
  // ── Gather all intelligence ──
  const [company, signals, contacts, notes, strategies, researchCard, evidence] = await Promise.all([
    db.company.findUnique({
      where: { id: companyId },
      select: { rawName: true, industry: true, domain: true, sizeRange: true, country: true, status: true, lifecycleStage: true },
    }),
    db.companySignal.findMany({
      where: { companyId, status: { in: ['detected', 'validated', 'active'] } },
      orderBy: { confidence: 'desc' },
    }),
    db.contact.findMany({
      where: { companyId, status: { not: 'archived' } },
      include: { _count: { select: { replies: true, notes: true } } },
      orderBy: { leadScore: 'desc' },
      take: 10,
    }),
    db.companyNote.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    db.accountStrategy.findMany({
      where: { companyId, status: { not: 'archived' } },
      orderBy: { updatedAt: 'desc' },
      take: 2,
    }),
    db.companyResearchCard.findUnique({ where: { companyId } }),
    db.evidence.findMany({
      where: { companyId, status: 'active' },
      orderBy: { confidence: 'desc' },
      take: 10,
    }),
  ])

  if (!company) throw new Error(`Company ${companyId} not found`)

  // ── Build comprehensive context ──
  const externalSignals = signals.filter(s => !['internal_memory', 'people_change'].includes(s.signalType))
  const internalSignals = signals.filter(s => s.signalType === 'internal_memory')
  const peopleSignals = signals.filter(s => s.signalType === 'people_change')

  const context = `
COMPANY: ${company.rawName} | Industry: ${company.industry || 'Unknown'} | Size: ${company.sizeRange || 'Unknown'} | Status: ${company.status} | Stage: ${company.lifecycleStage}

EXTERNAL INTELLIGENCE (${externalSignals.length} signals):
${externalSignals.slice(0, 10).map(s => `- [${s.signalType}/${s.severity}] ${s.title} (${Math.round(s.confidence * 100)}%) — ${s.businessImpact || ''}`).join('\n')}

INTERNAL MEMORY (${internalSignals.length} signals):
${internalSignals.slice(0, 8).map(s => `- [${s.source}] ${s.title}`).join('\n')}

PEOPLE INTELLIGENCE (${peopleSignals.length} signals):
${peopleSignals.slice(0, 5).map(s => `- ${s.title}`).join('\n')}

KEY CONTACTS (${contacts.length}):
${contacts.map(c => `- ${c.rawName} (${c.title || c.role}) — score ${c.leadScore}, ${c._count.replies} replies`).join('\n')}

INTERNAL NOTES (${notes.length}):
${notes.map(n => `- [${n.category}] ${n.title}: ${n.body.substring(0, 100)}`).join('\n')}

EXISTING STRATEGY: ${strategies.length > 0 ? strategies[0].title + ': ' + (strategies[0].objective || 'No objective') : 'None defined'}

RESEARCH CARD: ${researchCard ? `Has business overview, tech landscape, challenges: ${(researchCard.potentialChallenges || '').substring(0, 100)}, opportunities: ${(researchCard.possibleOpportunities || '').substring(0, 100)}` : 'No research card'}
`.trim()

  const systemPrompt = `You are a strategic B2B account planning consultant. Generate a comprehensive account strategy plan by synthesizing all available intelligence — external signals, internal memory, and people intelligence — into actionable strategic recommendations.

RULES:
- Every priority, risk, and opportunity MUST reference specific evidence from the intelligence
- Priorities should be ranked by business impact and timing
- Solution alignment must connect company needs to specific capabilities
- Risks should include probability assessment and specific mitigation plans
- Next steps must have clear owners and timelines
- Be specific and actionable — not generic advice
- Output valid JSON only, no markdown`

  const userPrompt = `Generate account strategy for:\n\n${context}\n\nReturn JSON:
{
  "executiveSummary": "2-3 sentence strategic overview",
  "accountSituation": "Current situation analysis paragraph",
  "priorities": [{"priority": "Strategic priority name", "rationale": "Why this matters now", "evidence": "What intelligence supports this", "urgency": "critical|high|medium"}],
  "solutionAlignment": [{"capability": "Our capability that fits", "evidence": "Why it fits their needs", "fitScore": 85}],
  "risks": [{"risk": "Specific risk description", "probability": "high|medium|low", "mitigation": "Specific mitigation action"}],
  "blockers": ["Current blocker to deal progression"],
  "opportunityAreas": [{"area": "Opportunity name", "estimatedValue": "Estimated deal value", "buyingStage": "Stage assessment", "confidence": 75}],
  "competitivePosition": "Competitive positioning analysis paragraph",
  "nextSteps": [{"action": "Specific action", "owner": "Who should do it", "timeline": "When", "priority": "critical|high|medium"}],
  "resourceRequirements": ["Resource needed for strategy execution"]
}`

  const aiResult = await callAI({
    systemPrompt,
    userPrompt,
    feature: 'sprint3_account_strategy',
    companyId,
    runQualityCheck: true,
    maxRetries: 2,
    timeoutMs: 90000,
  })

  let parsed: Partial<AccountStrategyPlan> = {}
  try {
    const cleaned = (aiResult.raw || '').replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
  } catch { /* fallback */ }

  return {
    executiveSummary: parsed.executiveSummary || `Account strategy for ${company.rawName} based on ${signals.length} intelligence signals and ${contacts.length} contacts.`,
    accountSituation: parsed.accountSituation || `${company.rawName} is in ${company.lifecycleStage || 'discovery'} stage with ${signals.length} signals and ${contacts.length} contacts.`,
    priorities: Array.isArray(parsed.priorities) ? parsed.priorities.slice(0, 5) : [],
    solutionAlignment: Array.isArray(parsed.solutionAlignment) ? parsed.solutionAlignment.slice(0, 4) : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 4) : [],
    blockers: Array.isArray(parsed.blockers) ? parsed.blockers.slice(0, 4) : [],
    opportunityAreas: Array.isArray(parsed.opportunityAreas) ? parsed.opportunityAreas.slice(0, 4) : [],
    competitivePosition: parsed.competitivePosition || 'No competitive positioning data available.',
    nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps.slice(0, 6) : [],
    resourceRequirements: Array.isArray(parsed.resourceRequirements) ? parsed.resourceRequirements.slice(0, 3) : [],
  }
}
