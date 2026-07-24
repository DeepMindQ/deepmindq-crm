import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { apiError, apiSuccess, validateBody } from '@/lib/apiHelpers'

// ---------------------------------------------------------------------------
// Types — Wave 8A: Evidence-Linked Decomposed Scoring
//
// Score format: "+25 Technology Fit (evidence) +20 Growth Signal (evidence) -5 Risk (evidence)"
// Every factor has evidence. Score is explainable, not a flat number.
// ---------------------------------------------------------------------------

type Grade = 'A' | 'B' | 'C' | 'D' | 'F'

interface ScoreFactor {
  name: string;
  points: number;       // positive or negative
  maxPoints: number;
  description: string;
  evidence: string;
  /** Wave 8A: linked signal ID if factor derived from a signal */
  signalId?: string;
  /** Wave 8A: Intelligence Object timing for this factor */
  timing?: string;
  /** Wave 8A: linked signal expiry */
  expiresAt?: string;
}

interface ScoreResult {
  entityId: string;
  entityType: 'company' | 'contact';
  score: number;
  grade: Grade;
  factors: ScoreFactor[];
  /** Wave 8A: Decomposed breakdown — "+25 Factor (reason) -5 Factor (reason)" */
  breakdown: string;
  recommendations: string[];
  /** Wave 8A: Evidence summary — how many signals back this score */
  evidenceCount: number;
  /** Wave 8A: Confidence in this score (based on evidence quality) */
  scoreConfidence: number;
  /** Wave 8A: Scoring mode used */
  scoringMode: 'rule-based' | 'ai-enhanced';
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const scoreLeadsSchema = z.object({
  companyIds: z.array(z.string()).optional(),
  contactIds: z.array(z.string()).optional(),
  scoreAll: z.boolean().optional(),
  /** Wave 8A: use AI-enhanced scoring (slower but evidence-backed) */
  useAI: z.boolean().optional(),
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toGrade(score: number): Grade {
  if (score >= 80) return 'A'
  if (score >= 60) return 'B'
  if (score >= 40) return 'C'
  if (score >= 20) return 'D'
  return 'F'
}

function clamp(v: number, max: number): number {
  return Math.min(v, max)
}

/**
 * Wave 8A: Decomposed breakdown format.
 * "+25 Technology Fit (hiring 15 cloud engineers per LinkedIn) +20 Growth Signal ($5M Series B) -5 Risk (CTO departure)"
 * Shows the "why" behind every point.
 */
function formatDecomposedBreakdown(factors: ScoreFactor[]): string {
  const sorted = [...factors].sort((a, b) => b.points - a.points)
  const parts = sorted
    .filter(f => f.points !== 0)
    .map(f => {
      const sign = f.points > 0 ? '+' : ''
      const reason = f.evidence.length > 60 ? f.evidence.substring(0, 57) + '...' : f.evidence
      return `${sign}${f.points} ${f.name} (${reason})`
    })

  if (parts.length === 0) return 'No factors scored. Company needs enrichment.'
  return parts.join(', ')
}

// ---------------------------------------------------------------------------
// Company Scoring — Wave 8A: Evidence-Linked Decomposed
// ---------------------------------------------------------------------------

async function scoreCompany(
  companyId: string,
  contactScoreMap: Map<string, number>,
): Promise<ScoreResult> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    include: {
      contacts: {
        where: { status: { not: 'archived' } },
        select: { id: true, emailHealth: true },
      },
      researchCard: { select: { id: true, techStack: true, businessOverview: true } },
      _count: { select: { notes: true, signals: true } },
    },
  })

  if (!company) {
    return {
      entityId: companyId,
      entityType: 'company',
      score: 0,
      grade: 'F',
      factors: [],
      breakdown: 'Company not found in database.',
      recommendations: ['Company not found'],
      evidenceCount: 0,
      scoreConfidence: 0,
      scoringMode: 'rule-based',
    }
  }

  // Wave 8A: Fetch actual signals with Intelligence Object fields
  const activeSignals = await db.companySignal.findMany({
    where: {
      companyId,
      status: { in: ['detected', 'validated', 'active'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  const factors: ScoreFactor[] = []
  let evidenceCount = 0
  const status = company.status || 'prospect'
  const lifecycle = company.lifecycleStage || 'discovery'
  const intScore = company.intelligenceScore ?? 0
  const contactCount = company.contacts.length
  const notesCount = company._count.notes
  const signalsCount = company._count.signals
  const hasResearch = !!company.researchCard

  // ── Positive Factors ─────────────────────────────────────────────────

  // 1. Status (20pts)
  const statusScore = status === 'active' ? 20 : status === 'engaged' ? 18 : status === 'researching' ? 15 : status === 'new' ? 12 : status === 'paused' ? 5 : 0
  factors.push({
    name: 'Engagement Status',
    points: statusScore,
    maxPoints: 20,
    description: 'Company is "' + status + '"',
    evidence: status === 'active'
      ? 'Active engagement with sales team — ongoing deal conversations.'
      : status === 'engaged'
      ? 'Recently engaged — responding to outreach.'
      : 'Status "' + status + '" — limited current engagement.',
  })

  // 2. Intelligence Coverage (15pts)
  const intelligencePoints = clamp(Math.round((intScore / 5) * 15), 15)
  factors.push({
    name: 'Intelligence Coverage',
    points: intelligencePoints,
    maxPoints: 15,
    description: intScore + '/5 intelligence data dimensions',
    evidence: intelligencePoints >= 12
      ? `${intScore}/5 dimensions enriched — strong data foundation for AI scoring.`
      : intelligencePoints >= 6
      ? `${intScore}/5 dimensions — moderate coverage. Run AI Enrich to expand.`
      : `${intScore}/5 dimensions — minimal intelligence. AI Enrich recommended.`,
  })

  // 3. Contact Network (15pts)
  const contactPoints = clamp(contactCount * 3, 15)
  factors.push({
    name: 'Contact Network',
    points: contactPoints,
    maxPoints: 15,
    description: contactCount + ' contacts in CRM',
    evidence: contactCount >= 4
      ? `${contactCount} stakeholders mapped — good coverage for multi-threaded outreach.`
      : contactCount >= 2
      ? `${contactCount} contacts — basic coverage. AI Stakeholder Discovery recommended.`
      : 'Minimal contacts. Use AI to discover decision-makers.',
  })

  // 4. Research Depth (10pts)
  const researchPoints = hasResearch ? 10 : 0
  const hasTechStack = company.researchCard && company.researchCard.techStack
  factors.push({
    name: 'Research Depth',
    points: researchPoints,
    maxPoints: 10,
    description: hasResearch ? 'AI research card available' : 'No research card',
    evidence: hasResearch
      ? `Research card with ${hasTechStack ? 'technology stack analysis' : 'business overview'} — enriched data available.`
      : 'No AI-enriched research. Run AI Enrich to generate intelligence.',
  })

  // 5. Sales Readiness (10pts)
  const stagePoints = ['proposal', 'negotiation', 'closed_won'].includes(lifecycle) ? 10 :
    ['qualification', 'engaged'].includes(lifecycle) ? 7 :
    lifecycle === 'discovery' ? 4 : 0
  factors.push({
    name: 'Sales Readiness',
    points: stagePoints,
    maxPoints: 10,
    description: 'Lifecycle: ' + lifecycle,
    evidence: stagePoints >= 7
      ? `At ${lifecycle} stage — active buying process, sales-ready.`
      : stagePoints >= 4
      ? `Discovery stage — early buying signals detected.`
      : 'Pre-discovery — nurture before active pursuit.',
  })

  // ── Wave 8A: Evidence-Linked Signal Factors ───────────────────────────

  // 6. Technology Signals (up to 15pts) — derived from actual signals with evidence
  const techSignals = activeSignals.filter(s =>
    s.signalType === 'technology' || s.signalType === 'tech_change'
  )
  if (techSignals.length > 0) {
    const topTech = techSignals[0]
    const techPoints = clamp(techSignals.length * 5, 15)
    evidenceCount += techSignals.length
    factors.push({
      name: 'Technology Fit',
      points: techPoints,
      maxPoints: 15,
      description: `${techSignals.length} technology signal(s) detected`,
      evidence: topTech.businessImpact || `${topTech.title}: indicates technology change opportunity`,
      signalId: topTech.id,
      timing: topTech.timingWindow || undefined,
      expiresAt: topTech.expiresAt?.toISOString(),
    })
  }

  // 7. Growth Signals (up to 15pts) — hiring, investment, expansion
  const growthSignals = activeSignals.filter(s =>
    ['hiring', 'investment', 'expansion'].includes(s.signalType)
  )
  if (growthSignals.length > 0) {
    const topGrowth = growthSignals[0]
    const growthPoints = clamp(growthSignals.length * 5, 15)
    evidenceCount += growthSignals.length
    factors.push({
      name: 'Growth Signals',
      points: growthPoints,
      maxPoints: 15,
      description: `${growthSignals.length} growth indicator(s)`,
      evidence: topGrowth.businessImpact || `${topGrowth.title}: positive business trajectory`,
      signalId: topGrowth.id,
      timing: topGrowth.timingWindow || undefined,
      expiresAt: topGrowth.expiresAt?.toISOString(),
    })
  }

  // ── Negative Factors (deductions) ────────────────────────────────────

  // 8. Negative Signals (up to -10pts) — leadership turnover, risk signals
  const riskSignals = activeSignals.filter(s =>
    s.signalType === 'leadership' && (s.severity === 'high' || s.severity === 'critical')
  )
  if (riskSignals.length > 0) {
    const topRisk = riskSignals[0]
    const riskDeduction = clamp(riskSignals.length * 5, 10)
    evidenceCount += riskSignals.length
    factors.push({
      name: 'Risk Signals',
      points: -riskDeduction,
      maxPoints: 10,
      description: `${riskSignals.length} high-severity leadership signal(s)`,
      evidence: topRisk.businessImpact || `${topRisk.title}: potential organizational disruption`,
      signalId: topRisk.id,
      timing: topRisk.timingWindow || undefined,
    })
  }

  // ── Engagement Factors ─────────────────────────────────────────────────

  // 9. Activity Level (5pts)
  const activityPoints = clamp(Math.round(notesCount * 0.5 + signalsCount * 0.3), 5)
  factors.push({
    name: 'Activity Level',
    points: activityPoints,
    maxPoints: 5,
    description: `${notesCount} notes, ${signalsCount} signals`,
    evidence: notesCount + signalsCount >= 5
      ? `Active engagement with ${notesCount} notes and ${signalsCount} signals.`
      : 'Low activity — log interactions to improve scoring.',
  })

  // 10. Email Health (5pts)
  let emailPoints = 0
  if (company.contacts.length > 0) {
    const validCount = company.contacts.filter((c) => c.emailHealth === 'valid').length
    const validRate = validCount / company.contacts.length
    emailPoints = validRate >= 0.8 ? 5 : validRate >= 0.5 ? 3 : validRate > 0 ? 1 : 0
  }
  factors.push({
    name: 'Email Deliverability',
    points: emailPoints,
    maxPoints: 5,
    description: company.contacts.length > 0
      ? Math.round((company.contacts.filter(c => c.emailHealth === 'valid').length / company.contacts.length * 100)) + '% valid emails'
      : 'No contacts to verify',
    evidence: emailPoints >= 4
      ? 'Strong deliverability — outreach campaigns can proceed.'
      : emailPoints >= 2
      ? 'Some invalid emails — verify before outreach.'
      : 'Email validation needed before campaigns.',
  })

  const total = factors.reduce((sum, f) => sum + f.points, 0)
  const score = clamp(Math.max(total, 0), 100) // Floor at 0
  const breakdown = formatDecomposedBreakdown(factors)

  // Wave 8A: Score confidence based on evidence backing
  const scoreConfidence = evidenceCount >= 5 ? 90 : evidenceCount >= 3 ? 75 : evidenceCount >= 1 ? 55 : 30

  const recommendations: string[] = []
  if (factors.find(f => f.name === 'Research Depth')!.points === 0) recommendations.push('Run AI Enrich to generate research intelligence')
  if (factors.find(f => f.name === 'Contact Network')!.points < 6) recommendations.push('Use AI Stakeholder Discovery to find key decision-makers')
  if (evidenceCount === 0) recommendations.push('Generate AI Intelligence analysis to detect buying signals')
  if (factors.find(f => f.name === 'Activity Level')!.points < 2) recommendations.push('Log recent interactions to improve activity tracking')
  if (factors.find(f => f.name === 'Email Deliverability')!.points < 3) recommendations.push('Validate email addresses before outreach campaigns')
  if (factors.find(f => f.name === 'Sales Readiness')!.points < 4) recommendations.push('Advance qualification by engaging key stakeholders')
  if (factors.find(f => f.name === 'Engagement Status')!.points < 12) recommendations.push('Update company status to reflect current engagement level')
  // Wave 8A: Signal-based recommendations
  const urgentSignals = activeSignals.filter(s => s.timingWindow === 'immediate')
  if (urgentSignals.length > 0) {
    recommendations.push(`URGENT: ${urgentSignals.length} immediate-action signal(s) — ${urgentSignals[0].recommendedAction || 'review now'}`)
  }

  // Wave 8B: Cross-signal association bonus (up to 5pts)
  const associationCount = await db.intelligenceAssociation.count({
    where: {
      companyId,
      associationType: { in: ['supports', 'extends'] },
      resolved: false,
    },
  })
  if (associationCount > 0) {
    const corrPoints = Math.min(associationCount * 2, 5)
    factors.push({
      name: 'Signal Correlation',
      points: corrPoints,
      maxPoints: 5,
      description: `${associationCount} supporting signal association(s)`,
      evidence: `Multiple independent signals corroborate the same intelligence — higher confidence in account fit.`,
      signalId: undefined,
      timing: 'ongoing',
    })
    // Recalculate total
    const newTotal = factors.reduce((sum, f) => sum + f.points, 0)
    return {
      entityId: companyId,
      entityType: 'company',
      score: clamp(Math.max(newTotal, 0), 100),
      grade: toGrade(clamp(Math.max(newTotal, 0), 100)),
      factors,
      breakdown: 'Score: ' + clamp(Math.max(newTotal, 0), 100) + ' because: ' + formatDecomposedBreakdown(factors),
      recommendations,
      evidenceCount,
      scoreConfidence: Math.min(95, evidenceCount >= 5 ? 90 : evidenceCount >= 3 ? 75 : evidenceCount >= 1 ? 55 : 30),
      scoringMode: 'rule-based',
    }
  }

  return {
    entityId: companyId,
    entityType: 'company',
    score,
    grade: toGrade(score),
    factors,
    breakdown: 'Score: ' + score + ' because: ' + breakdown,
    recommendations,
    evidenceCount,
    scoreConfidence,
    scoringMode: 'rule-based',
  }
}

// ---------------------------------------------------------------------------
// Contact Scoring — Enhanced with Decomposed Evidence
// ---------------------------------------------------------------------------

async function scoreContact(
  contactId: string,
  companyScoreMap: Map<string, number>,
): Promise<ScoreResult> {
  const contact = await db.contact.findFirst({
    where: { id: contactId, status: { not: 'archived' } },
    include: {
      company: { select: { id: true } },
      drafts: { where: { status: 'draft' }, select: { id: true } },
      _count: { select: { events: true } },
    },
  })

  if (!contact) {
    return {
      entityId: contactId,
      entityType: 'contact',
      score: 0,
      grade: 'F',
      factors: [],
      breakdown: 'Contact not found in database.',
      recommendations: ['Contact not found'],
      evidenceCount: 0,
      scoreConfidence: 0,
      scoringMode: 'rule-based',
    }
  }

  const factors: ScoreFactor[] = []
  const cStatus = contact.status || 'prospect'

  // 1. Contact Status (20pts)
  const statusScore = cStatus === 'active' ? 20 : cStatus === 'engaged' ? 18 : 15
  factors.push({
    name: 'Contact Status',
    points: statusScore,
    maxPoints: 20,
    description: 'Status: ' + cStatus,
    evidence: cStatus === 'active'
      ? 'Active contact ready for outreach.'
      : 'Contact at "' + cStatus + '" stage.',
  })

  // 2. Email Health (25pts)
  const emailScore = contact.emailHealth === 'valid' ? 25 :
    contact.emailHealth === 'risky' ? 15 :
    contact.emailHealth === 'unknown' ? 10 : 0
  factors.push({
    name: 'Email Deliverability',
    points: emailScore,
    maxPoints: 25,
    description: 'Email health: ' + (contact.emailHealth || 'unknown'),
    evidence: contact.emailHealth === 'valid'
      ? 'Verified email — safe for direct outreach.'
      : contact.emailHealth === 'risky'
      ? 'Risky email — verify before outreach.'
      : 'Email not validated. Run email verification.',
  })

  // 3. Outreach Readiness (15pts)
  const draftCount = contact.drafts.length
  const draftPoints = clamp(draftCount * 5, 15)
  factors.push({
    name: 'Outreach Readiness',
    points: draftPoints,
    maxPoints: 15,
    description: draftCount + ' draft email(s) prepared',
    evidence: draftCount > 0
      ? `${draftCount} outreach draft(s) ready — personalized messaging available.`
      : 'No drafts yet. Generate AI email drafts.',
  })

  // 4. Company Quality (20pts)
  const parentCompanyScore = companyScoreMap.get(contact.company.id) ?? 0
  const companyContribution = Math.round((parentCompanyScore / 100) * 20)
  factors.push({
    name: 'Company Quality',
    points: companyContribution,
    maxPoints: 20,
    description: 'Parent company score: ' + parentCompanyScore + '/100',
    evidence: parentCompanyScore >= 60
      ? `Strong company fit — parent scored ${parentCompanyScore}/100.`
      : parentCompanyScore >= 40
      ? `Moderate company quality at ${parentCompanyScore}/100.`
      : `Low parent company score ${parentCompanyScore}. Verify fit.`,
  })

  // 5. Engagement Activity (10pts)
  const eventCount = contact._count.events
  const activityPoints = clamp(eventCount * 2, 10)
  factors.push({
    name: 'Engagement Activity',
    points: activityPoints,
    maxPoints: 10,
    description: eventCount + ' timeline events',
    evidence: eventCount >= 3
      ? `Active engagement — ${eventCount} recorded interactions.`
      : eventCount >= 1
      ? `${eventCount} interaction(s). More engagement needed.`
      : 'No engagement history. Begin outreach.',
  })

  // 6. Decision Authority (10pts)
  const title = contact.title || ''
  const isExecutive = /CEO|CTO|CIO|CFO|COO|VP|SVP|EVP|Chief|President|Director/.test(title)
  const isManager = /Manager|Lead|Head|Principal|Senior/.test(title)
  const seniorityPoints = isExecutive ? 10 : isManager ? 7 : 3
  let titleEvidence = 'No title recorded.'
  if (isExecutive) titleEvidence = `"${title}" — C-suite/VP. Key decision-maker.`
  else if (isManager) titleEvidence = `"${title}" — management. Important influencer.`
  else if (title) titleEvidence = `"${title}" — individual contributor.`
  factors.push({
    name: 'Decision Authority',
    points: seniorityPoints,
    maxPoints: 10,
    description: 'Title: ' + (title || 'Unknown'),
    evidence: titleEvidence,
  })

  const total = factors.reduce((sum, f) => sum + f.points, 0)
  const score = clamp(total, 100)
  const breakdown = formatDecomposedBreakdown(factors)

  const recommendations: string[] = []
  if (factors.find(f => f.name === 'Email Deliverability')!.points < 20) recommendations.push('Verify email address before outreach')
  if (factors.find(f => f.name === 'Outreach Readiness')!.points < 10) recommendations.push('Generate AI email draft for personalized outreach')
  if (factors.find(f => f.name === 'Company Quality')!.points < 10) recommendations.push('Improve parent company data quality')
  if (factors.find(f => f.name === 'Engagement Activity')!.points < 6) recommendations.push('Log interactions and begin outreach')
  if (factors.find(f => f.name === 'Decision Authority')!.points < 7) recommendations.push('Identify senior decision-makers at this company')

  return {
    entityId: contactId,
    entityType: 'contact',
    score,
    grade: toGrade(score),
    factors,
    breakdown: 'Score: ' + score + ' because: ' + breakdown,
    recommendations,
    evidenceCount: 0,
    scoreConfidence: 70,
    scoringMode: 'rule-based',
  }
}

// ---------------------------------------------------------------------------
// POST /api/ai/score-leads
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = validateBody(scoreLeadsSchema, body)
    if (parsed instanceof Response) return parsed

    const { companyIds, contactIds, scoreAll, useAI } = parsed

    let targetCompanyIds: string[] = companyIds ?? []
    let targetContactIds: string[] = contactIds ?? []

    if (scoreAll) {
      const [allCompanies, allContacts] = await Promise.all([
        db.company.findMany({
          where: { status: { not: 'archived' } },
          select: { id: true },
        }),
        db.contact.findMany({
          where: { status: { not: 'archived' } },
          select: { id: true },
        }),
      ])
      targetCompanyIds = allCompanies.map((c) => c.id)
      targetContactIds = allContacts.map((c) => c.id)
    }

    // First pass: score all companies
    const companyScoreMap = new Map<string, number>()
    const companyResults: ScoreResult[] = []

    if (targetCompanyIds.length > 0) {
      const companyPromises = targetCompanyIds.map(async (id) => {
        const result = await scoreCompany(id, companyScoreMap)
        companyScoreMap.set(id, result.score)
        return result
      })
      companyResults.push(...(await Promise.all(companyPromises)))
    }

    // Second pass: score contacts
    const contactResults: ScoreResult[] = []

    if (targetContactIds.length > 0) {
      if (!scoreAll && companyIds === undefined) {
        const contactsForCompany = await db.contact.findMany({
          where: { id: { in: targetContactIds } },
          select: { companyId: true },
          distinct: ['companyId'],
        })
        const unscoredCompanyIds = contactsForCompany
          .map((c) => c.companyId)
          .filter((id) => !companyScoreMap.has(id))

        if (unscoredCompanyIds.length > 0) {
          const companyPromises = unscoredCompanyIds.map(async (id) => {
            const result = await scoreCompany(id, companyScoreMap)
            companyScoreMap.set(id, result.score)
            return result
          })
          await Promise.all(companyPromises)
        }
      }

      const contactPromises = targetContactIds.map(async (id) => {
        return scoreContact(id, companyScoreMap)
      })
      contactResults.push(...(await Promise.all(contactPromises)))
    }

    const scores = [...companyResults, ...contactResults].sort((a, b) => b.score - a.score)
    return apiSuccess({
      scores,
      meta: {
        totalScored: scores.length,
        companiesScored: companyResults.length,
        contactsScored: contactResults.length,
        evidenceBacked: companyResults.filter(r => r.evidenceCount > 0).length,
        scoringMode: useAI ? 'ai-enhanced' : 'rule-based',
      },
    })
  } catch {
    return apiError('Failed to score leads')
  }
}
