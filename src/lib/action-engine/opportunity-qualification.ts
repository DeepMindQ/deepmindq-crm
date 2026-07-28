/**
 * Sprint 3B: Action Engine — Opportunity Qualification
 *
 * Qualifies opportunities by analyzing buying signals, timing,
 * strategic fit, and relationship health. Produces a go/no-go
 * assessment with confidence scoring.
 *
 * Output: { buyingSignals, timing, strategicFit, confidenceScore, verdict }
 */

import { db } from '@/lib/db'
import { callAI } from '@/lib/ai-copilot/ai-caller'

export interface OpportunityQualification {
  executiveSummary: string
  verdict: 'strong_fit' | 'good_fit' | 'uncertain' | 'weak_fit' | 'no_fit'
  confidenceScore: number  // 0-100
  scoringBreakdown: {
    signalStrength: number      // 0-100
    timingReadiness: number    // 0-100
    strategicFit: number       // 0-100
    relationshipHealth: number // 0-100
    competitivePosition: number // 0-100
  }
  buyingSignals: Array<{ signal: string; type: string; strength: 'strong' | 'moderate' | 'weak'; evidence: string }>
  timingAssessment: { window: string; urgency: string; catalyst: string; risk: string }
  strategicFit: { industryMatch: boolean; companySizeMatch: boolean; needAlignment: string; budgetIndicator: string }
  relationshipHealth: { championPresent: boolean; accessLevel: string; engagementTrend: string; riskFactors: string[] }
  qualificationQuestions: string[]
  recommendedNextStep: string
  estimatedDealSize: string
  competition: string[]
}

export async function qualifyOpportunity(
  companyId: string
): Promise<OpportunityQualification> {
  // ── Gather data ──
  const [company, signals, contacts, strategy, researchCard] = await Promise.all([
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
      include: { _count: { select: { replies: true } } },
      orderBy: { leadScore: 'desc' },
    }),
    db.accountStrategy.findFirst({
      where: { companyId, status: { in: ['active', 'review'] } },
    }),
    db.companyResearchCard.findUnique({ where: { companyId } }),
  ])

  if (!company) throw new Error(`Company ${companyId} not found`)

  // ── Signal strength scoring ──
  const highSeveritySignals = signals.filter(s => s.severity === 'critical' || s.severity === 'high')
  const recentSignals = signals.filter(s => {
    if (!s.createdAt) return false
    return (Date.now() - s.createdAt.getTime()) / 86400000 <= 30
  })
  const signalStrength = Math.min(100,
    (highSeveritySignals.length * 15) +
    (recentSignals.length * 10) +
    Math.min(40, signals.length * 3)
  )

  // ── Timing readiness ──
  const timingSignals = signals.filter(s =>
    s.timingWindow === 'immediate' || s.timingWindow === 'within_7_days'
  )
  const timingReadiness = Math.min(100,
    (timingSignals.length * 20) +
    (recentSignals.length * 8) +
    (company.lifecycleStage === 'qualification' ? 20 : company.lifecycleStage === 'proposal' ? 15 : 5)
  )

  // ── Strategic fit ──
  const strategicFit = Math.min(100,
    (company.industry ? 30 : 0) +
    (company.sizeRange ? 20 : 0) +
    (researchCard ? 20 : 0) +
    (strategy ? 20 : 0) +
    Math.min(10, signals.filter(s => s.signalType === 'tech_change' || s.signalType === 'partnership').length * 5)
  )

  // ── Relationship health ──
  const activeContacts = contacts.filter(c => c._count.replies > 0 || c.status === 'replied')
  const hasChampion = contacts.some(c => c._count.replies >= 2 && c.leadScore >= 50)
  const relationshipHealth = Math.min(100,
    (hasChampion ? 35 : 0) +
    Math.min(30, activeContacts.length * 10) +
    Math.min(35, contacts.length * 5)
  )

  // ── Competitive position ──
  const competitivePosition = Math.min(100,
    (strategy ? 40 : 0) +
    (hasChampion ? 25 : 0) +
    Math.min(35, activeContacts.length * 12)
  )

  // ── Verdict ──
  const overallConfidence = Math.round(
    (signalStrength * 0.25) +
    (timingReadiness * 0.20) +
    (strategicFit * 0.20) +
    (relationshipHealth * 0.20) +
    (competitivePosition * 0.15)
  )

  const verdict: OpportunityQualification['verdict'] =
    overallConfidence >= 75 ? 'strong_fit' :
    overallConfidence >= 55 ? 'good_fit' :
    overallConfidence >= 40 ? 'uncertain' :
    overallConfidence >= 25 ? 'weak_fit' : 'no_fit'

  // ── AI-powered analysis ──
  const signalContext = signals.slice(0, 12).map(s =>
    `- [${s.signalType}/${s.severity}] ${s.title} (${Math.round(s.confidence * 100)}%) — timing: ${s.timingWindow || 'unknown'}`
  ).join('\n')

  const systemPrompt = `You are a B2B opportunity qualification expert. Analyze the intelligence data and provide a qualified assessment of the opportunity at this account.

RULES:
- Every buying signal must reference specific intelligence
- Timing assessment should identify catalysts and risks
- Qualification questions should be strategic and open-ended
- Competition assessment should be evidence-based
- Output valid JSON only`

  const userPrompt = `Qualify this opportunity:

COMPANY: ${company.rawName} | Industry: ${company.industry || 'Unknown'} | Size: ${company.sizeRange || 'Unknown'} | Stage: ${company.lifecycleStage}

SIGNALS (${signals.length} total, ${highSeveritySignals.length} high-severity, ${recentSignals.length} recent):
${signalContext}

CONTACTS (${contacts.length}, ${activeContacts.length} active, champion: ${hasChampion}):
${contacts.slice(0, 8).map(c => `- ${c.rawName} (${c.title || c.role}) — score ${c.leadScore}, ${c._count.replies} replies`).join('\n')}

STRATEGY: ${strategy ? strategy.title + ': ' + (strategy.objective || '') : 'No strategy'}
RESEARCH: ${researchCard ? 'Available — challenges: ' + (researchCard.potentialChallenges || '').substring(0, 100) : 'No research card'}

PRELIMINARY SCORES:
- Signal Strength: ${signalStrength}/100
- Timing Readiness: ${timingReadiness}/100
- Strategic Fit: ${strategicFit}/100
- Relationship Health: ${relationshipHealth}/100
- Competitive Position: ${competitivePosition}/100
- OVERALL: ${overallConfidence}/100 (${verdict})

Return JSON:
{
  "executiveSummary": "2-3 sentence qualification verdict",
  "buyingSignals": [{"signal": "Signal description", "type": "signal_type", "strength": "strong|moderate|weak", "evidence": "Supporting evidence"}],
  "timingAssessment": {"window": "Best timing window", "urgency": "Why now", "catalyst": "What triggered the opportunity", "risk": "Timing risk"},
  "strategicFit": {"industryMatch": true, "companySizeMatch": true, "needAlignment": "What needs align", "budgetIndicator": "Budget signals"},
  "relationshipHealth": {"championPresent": true, "accessLevel": "C-suite|VP|Director|None", "engagementTrend": "improving|stable|declining", "riskFactors": ["Risk"]},
  "qualificationQuestions": ["Strategic question to ask"],
  "recommendedNextStep": "Specific next step action",
  "estimatedDealSize": "Estimated range",
  "competition": ["Known competitor"]
}`

  const aiResult = await callAI({
    systemPrompt,
    userPrompt,
    feature: 'sprint3_opportunity_qualification',
    companyId,
    runQualityCheck: true,
    maxRetries: 2,
    timeoutMs: 60000,
  })

  let parsed: Partial<OpportunityQualification> = {}
  try {
    const cleaned = (aiResult.raw || '').replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
  } catch { /* fallback */ }

  return {
    executiveSummary: parsed.executiveSummary || `Opportunity qualification for ${company.rawName}: ${verdict} (${overallConfidence}/100).`,
    verdict,
    confidenceScore: overallConfidence,
    scoringBreakdown: {
      signalStrength,
      timingReadiness,
      strategicFit,
      relationshipHealth,
      competitivePosition,
    },
    buyingSignals: Array.isArray(parsed.buyingSignals) ? parsed.buyingSignals.slice(0, 6) : [],
    timingAssessment: parsed.timingAssessment || { window: 'Unknown', urgency: 'Unknown', catalyst: 'No catalyst identified', risk: 'Timing unclear' },
    strategicFit: parsed.strategicFit || { industryMatch: !!company.industry, companySizeMatch: !!company.sizeRange, needAlignment: 'Unknown', budgetIndicator: 'No budget signals' },
    relationshipHealth: parsed.relationshipHealth || { championPresent: hasChampion, accessLevel: contacts.length > 0 ? 'Director' : 'None', engagementTrend: 'stable', riskFactors: [] },
    qualificationQuestions: Array.isArray(parsed.qualificationQuestions) ? parsed.qualificationQuestions.slice(0, 5) : [],
    recommendedNextStep: parsed.recommendedNextStep || 'Continue monitoring signals and building relationships.',
    estimatedDealSize: parsed.estimatedDealSize || 'Unknown',
    competition: Array.isArray(parsed.competition) ? parsed.competition.slice(0, 3) : [],
  }
}
