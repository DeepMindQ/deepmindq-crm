import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { apiError, apiSuccess, validateBody } from '@/lib/apiHelpers'

// ---------------------------------------------------------------------------
// Types — Enhanced with Explainable Scoring
// ---------------------------------------------------------------------------

type Grade = 'A' | 'B' | 'C' | 'D' | 'F'

interface ScoreFactor {
  name: string;
  points: number;
  maxPoints: number;
  description: string;
  evidence: string;
}

interface ScoreResult {
  entityId: string;
  entityType: 'company' | 'contact';
  score: number;
  grade: Grade;
  factors: ScoreFactor[];
  breakdown: string;
  recommendations: string[];
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const scoreLeadsSchema = z.object({
  companyIds: z.array(z.string()).optional(),
  contactIds: z.array(z.string()).optional(),
  scoreAll: z.boolean().optional(),
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

function formatBreakdown(factors: ScoreFactor[]): string {
  const positive = factors
    .filter(f => f.points > 0)
    .sort((a, b) => b.points - a.points)
    .map(f => '+' + f.points + ' ' + f.name.toLowerCase())

  if (positive.length === 0) return 'No positive factors detected. Company needs enrichment.'
  return positive.join(', ')
}

// ---------------------------------------------------------------------------
// Company Scoring — Enhanced with Explainability
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
    }
  }

  const factors: ScoreFactor[] = []
  const status = company.status || 'prospect'
  const lifecycle = company.lifecycleStage || 'discovery'
  const intScore = company.intelligenceScore ?? 0
  const contactCount = company.contacts.length
  const notesCount = company._count.notes
  const signalsCount = company._count.signals
  const hasResearch = !!company.researchCard

  // 1. Status (20pts)
  const statusScore = status === 'active' ? 20 : status === 'engaged' ? 18 : status === 'researching' ? 15 : status === 'new' ? 12 : status === 'paused' ? 5 : 0
  factors.push({
    name: 'Status',
    points: statusScore,
    maxPoints: 20,
    description: 'Company is "' + status + '"',
    evidence: status === 'active'
      ? 'Active status indicates ongoing sales engagement.'
      : status === 'engaged'
      ? 'Engaged status shows recent interaction with sales team.'
      : 'Status "' + status + '" suggests limited current engagement.',
  })

  // 2. Intelligence Score (20pts)
  const intelligencePoints = clamp(Math.round((intScore / 5) * 20), 20)
  factors.push({
    name: 'Intelligence Coverage',
    points: intelligencePoints,
    maxPoints: 20,
    description: intScore + '/5 intelligence data points collected',
    evidence: intelligencePoints >= 15
      ? 'Strong intelligence base with ' + intScore + ' data dimensions enriched.'
      : intelligencePoints >= 8
      ? 'Moderate research — ' + intScore + ' dimensions. Additional enrichment recommended.'
      : 'Limited intelligence — only ' + intScore + ' dimensions. AI enrichment needed.',
  })

  // 3. Contact Network (15pts)
  const contactPoints = clamp(contactCount * 3, 15)
  factors.push({
    name: 'Contact Network',
    points: contactPoints,
    maxPoints: 15,
    description: contactCount + ' contacts in CRM',
    evidence: contactCount >= 4
      ? 'Good stakeholder coverage with ' + contactCount + ' identified contacts.'
      : contactCount >= 2
      ? 'Basic contact coverage — ' + contactCount + ' contacts. More stakeholders needed.'
      : 'Minimal contact coverage. AI stakeholder discovery recommended.',
  })

  // 4. Research Depth (10pts)
  const researchPoints = hasResearch ? 10 : 0
  const hasTechStack = company.researchCard && company.researchCard.techStack
  factors.push({
    name: 'Research Depth',
    points: researchPoints,
    maxPoints: 10,
    description: hasResearch ? 'AI research card exists' : 'No research card',
    evidence: hasResearch
      ? 'Research card with ' + (hasTechStack ? 'technology analysis' : 'basic overview') + ' available.'
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
    description: 'Lifecycle stage: ' + lifecycle,
    evidence: stagePoints >= 7
      ? 'Company at ' + lifecycle + ' stage — strong buying signal.'
      : stagePoints >= 4
      ? 'At discovery stage. Qualification engagement needed.'
      : 'Early stage — nurture before active pursuit.',
  })

  // 6. Activity Signals (10pts)
  const activityPoints = clamp(Math.round(notesCount * 1.5 + signalsCount * 1), 10)
  factors.push({
    name: 'Activity Signals',
    points: activityPoints,
    maxPoints: 10,
    description: notesCount + ' notes, ' + signalsCount + ' AI signals',
    evidence: notesCount + signalsCount >= 5
      ? notesCount + ' notes and ' + signalsCount + ' signals show active sales engagement.'
      : notesCount + signalsCount >= 2
      ? 'Some activity recorded — ' + notesCount + ' notes, ' + signalsCount + ' signals.'
      : 'Low activity. Sales team should log interactions for better scoring.',
  })

  // 7. Signal Intelligence (10pts)
  const signalPoints = signalsCount >= 5 ? 10 : signalsCount >= 3 ? 7 : signalsCount >= 1 ? 4 : 0
  factors.push({
    name: 'Signal Intelligence',
    points: signalPoints,
    maxPoints: 10,
    description: signalsCount + ' AI-detected buying signals',
    evidence: signalsCount >= 3
      ? signalsCount + ' signals indicate active business changes — strong opportunity indicator.'
      : signalsCount >= 1
      ? signalsCount + ' signal detected. More signals expected as engagement deepens.'
      : 'No AI signals detected yet. Run intelligence analysis to identify opportunities.',
  })

  // 8. Email Health (5pts)
  let emailPoints = 0
  if (company.contacts.length > 0) {
    const validCount = company.contacts.filter((c) => c.emailHealth === 'valid').length
    const validRate = validCount / company.contacts.length
    emailPoints = validRate >= 0.8 ? 5 : validRate >= 0.5 ? 3 : validRate > 0 ? 1 : 0
  }
  const validPct = emailPoints > 0
    ? Math.round((company.contacts.length > 0 ? company.contacts.filter(c => c.emailHealth === 'valid').length / company.contacts.length * 100 : 0)) + '% valid emails'
    : 'No contacts'
  factors.push({
    name: 'Email Health',
    points: emailPoints,
    maxPoints: 5,
    description: validPct,
    evidence: emailPoints >= 4
      ? 'Strong email deliverability — outreach campaigns can proceed confidently.'
      : emailPoints >= 2
      ? 'Some invalid emails — verify before bulk outreach.'
      : 'Email validation needed before any outreach campaign.',
  })

  const total = factors.reduce((sum, f) => sum + f.points, 0)
  const score = clamp(total, 100)
  const breakdown = formatBreakdown(factors)

  const recommendations: string[] = []
  if (factors.find(f => f.name === 'Research Depth')!.points === 0) recommendations.push('Run AI Enrich to generate research intelligence')
  if (factors.find(f => f.name === 'Contact Network')!.points < 6) recommendations.push('Use AI Stakeholder Discovery to find key decision-makers')
  if (factors.find(f => f.name === 'Signal Intelligence')!.points < 4) recommendations.push('Generate AI Intelligence analysis to detect buying signals')
  if (factors.find(f => f.name === 'Activity Signals')!.points < 3) recommendations.push('Log recent interactions to improve activity tracking')
  if (factors.find(f => f.name === 'Email Health')!.points < 3) recommendations.push('Validate email addresses before outreach campaigns')
  if (factors.find(f => f.name === 'Sales Readiness')!.points < 4) recommendations.push('Advance qualification by engaging key stakeholders')
  if (factors.find(f => f.name === 'Status')!.points < 12) recommendations.push('Update company status to reflect current engagement level')

  return {
    entityId: companyId,
    entityType: 'company',
    score,
    grade: toGrade(score),
    factors,
    breakdown: 'Score: ' + score + ' because: ' + breakdown,
    recommendations,
  }
}

// ---------------------------------------------------------------------------
// Contact Scoring — Enhanced with Explainability
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
    }
  }

  const factors: ScoreFactor[] = []
  const cStatus = contact.status || 'prospect'

  // 1. Status (20pts)
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
      ? 'Verified email address — safe for direct outreach.'
      : contact.emailHealth === 'risky'
      ? 'Risky email — may bounce. Verify before outreach.'
      : 'Email not yet validated. Run email verification.',
  })

  // 3. Has Outreach Drafts (15pts)
  const draftCount = contact.drafts.length
  const draftPoints = clamp(draftCount * 5, 15)
  factors.push({
    name: 'Outreach Readiness',
    points: draftPoints,
    maxPoints: 15,
    description: draftCount + ' draft email(s) prepared',
    evidence: draftCount > 0
      ? draftCount + ' outreach draft(s) ready — personalized messaging available.'
      : 'No outreach drafts yet. Generate AI email drafts for personalized outreach.',
  })

  // 4. Company Score Contribution (20pts)
  const parentCompanyScore = companyScoreMap.get(contact.company.id) ?? 0
  const companyContribution = Math.round((parentCompanyScore / 100) * 20)
  factors.push({
    name: 'Company Quality',
    points: companyContribution,
    maxPoints: 20,
    description: 'Parent company score: ' + parentCompanyScore + '/100',
    evidence: parentCompanyScore >= 60
      ? 'Strong company fit — ' + parentCompanyScore + ' score indicates qualified target.'
      : parentCompanyScore >= 40
      ? 'Moderate company quality at ' + parentCompanyScore + '. Parent company needs enrichment.'
      : 'Parent company has low score. Verify company fit before engagement.',
  })

  // 5. Timeline Activity (10pts)
  const eventCount = contact._count.events
  const activityPoints = clamp(eventCount * 2, 10)
  factors.push({
    name: 'Engagement Activity',
    points: activityPoints,
    maxPoints: 10,
    description: eventCount + ' timeline events',
    evidence: eventCount >= 3
      ? 'Active engagement history with ' + eventCount + ' recorded interactions.'
      : eventCount >= 1
      ? eventCount + ' interaction(s) recorded. More engagement needed.'
      : 'No engagement history. Begin outreach sequence.',
  })

  // 6. Seniority Level (10pts)
  const title = contact.title || ''
  const isExecutive = /CEO|CTO|CIO|CFO|COO|VP|SVP|EVP|Chief|President|Director/.test(title)
  const isManager = /Manager|Lead|Head|Principal|Senior/.test(title)
  const seniorityPoints = isExecutive ? 10 : isManager ? 7 : 3
  let titleEvidence = 'No title recorded. Update contact role for better scoring.'
  if (isExecutive) titleEvidence = '"' + title + '" — C-suite or VP level. Key decision-maker for enterprise deals.'
  else if (isManager) titleEvidence = '"' + title + '" — management level. Important influencer in buying process.'
  else if (title) titleEvidence = '"' + title + '" — individual contributor. May not be primary decision-maker.'
  factors.push({
    name: 'Decision Authority',
    points: seniorityPoints,
    maxPoints: 10,
    description: 'Title: ' + (title || 'Unknown'),
    evidence: titleEvidence,
  })

  const total = factors.reduce((sum, f) => sum + f.points, 0)
  const score = clamp(total, 100)
  const breakdown = formatBreakdown(factors)

  const recommendations: string[] = []
  if (factors.find(f => f.name === 'Email Deliverability')!.points < 20) recommendations.push('Verify email address before outreach')
  if (factors.find(f => f.name === 'Outreach Readiness')!.points < 10) recommendations.push('Generate AI email draft for personalized outreach')
  if (factors.find(f => f.name === 'Company Quality')!.points < 10) recommendations.push('Improve parent company data quality to boost contact score')
  if (factors.find(f => f.name === 'Engagement Activity')!.points < 6) recommendations.push('Log interactions and begin outreach sequence')
  if (factors.find(f => f.name === 'Decision Authority')!.points < 7) recommendations.push('Identify senior decision-makers at this company')

  return {
    entityId: contactId,
    entityType: 'contact',
    score,
    grade: toGrade(score),
    factors,
    breakdown: 'Score: ' + score + ' because: ' + breakdown,
    recommendations,
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

    const { companyIds, contactIds, scoreAll } = parsed

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
    return apiSuccess({ scores })
  } catch {
    return apiError('Failed to score leads')
  }
}
