import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { apiError, apiSuccess, validateBody } from '@/lib/apiHelpers'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Grade = 'A' | 'B' | 'C' | 'D' | 'F'

interface ScoreResult {
  entityId: string
  entityType: 'company' | 'contact'
  score: number
  grade: Grade
  factors: Record<string, number>
  recommendations: string[]
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

const STATUS_SCORES: Record<string, number> = {
  active: 20,
  new: 15,
  inactive: 5,
  archived: 0,
}

const FRESHNESS_SCORES: Record<string, number> = {
  fresh: 15,
  stale: 8,
  old: 3,
  unknown: 0,
}

const EMAIL_HEALTH_SCORES: Record<string, number> = {
  valid: 25,
  risky: 15,
  invalid: 0,
  unknown: 10,
}

const SENIORITY_SCORES: Record<string, number> = {
  Executive: 10,
  Manager: 7,
  Technical: 5,
  Operations: 4,
  Sales: 4,
  Other: 3,
}

// ---------------------------------------------------------------------------
// Company Scoring
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
      researchCard: { select: { id: true } },
      _count: { select: { notes: true } },
    },
  })

  if (!company) {
    return {
      entityId: companyId,
      entityType: 'company',
      score: 0,
      grade: 'F',
      factors: {},
      recommendations: ['Company not found'],
    }
  }

  const factors: Record<string, number> = {}

  // 1. Status (20pts)
  factors.status = STATUS_SCORES[company.status] ?? 0

  // 2. Intelligence Score (20pts): /5 * 20
  const intScore = company.intelligenceScore ?? 0
  factors.intelligence = clamp(Math.round((intScore / 5) * 20), 20)

  // 3. Data Freshness (15pts)
  factors.dataFreshness = FRESHNESS_SCORES['unknown'] ?? 0

  // 4. Contact Count (15pts): min(contacts * 3, 15)
  const contactCount = company.contacts.length
  factors.contactCount = clamp(contactCount * 3, 15)

  // 5. Has Research Card (10pts)
  factors.hasResearch = company.researchCard ? 10 : 0

  // 6. Has Open Opportunities (10pts)
  factors.hasOpportunities = company.lifecycleStage === 'proposal' || company.lifecycleStage === 'negotiation' ? 10 : 0

  // 7. Notes Activity (10pts): min(notesCount * 2, 10)
  const notesCount = company._count.notes
  factors.notesActivity = clamp(notesCount * 2, 10)

  // 8. Email Health Bonus (+5): if avg contact email health is 'valid'
  let emailBonus = 0
  if (company.contacts.length > 0) {
    const validCount = company.contacts.filter((c) => c.emailHealth === 'valid').length
    if (validCount / company.contacts.length >= 0.5) {
      emailBonus = 5
    }
  }
  factors.emailHealth = emailBonus

  const total = Object.values(factors).reduce((sum, v) => sum + v, 0)
  const score = clamp(total, 100)

  // Recommendations
  const recommendations: string[] = []
  if (factors.status < 20) recommendations.push('Update company status to active')
  if (factors.intelligence < 10) recommendations.push('Generate research card to improve intelligence score')
  // Data freshness is always unknown for now
  if (factors.contactCount < 9) recommendations.push('Add more contacts to this company')
  if (factors.hasResearch === 0) recommendations.push('Generate AI research card')
  if (factors.hasOpportunities === 0) recommendations.push('Advance this company to proposal or negotiation stage')
  if (factors.notesActivity < 6) recommendations.push('Add notes from recent interactions')
  if (emailBonus === 0 && contactCount > 0) recommendations.push('Validate email addresses for contacts')

  return {
    entityId: companyId,
    entityType: 'company',
    score,
    grade: toGrade(score),
    factors,
    recommendations,
  }
}

// ---------------------------------------------------------------------------
// Contact Scoring
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
      factors: {},
      recommendations: ['Contact not found'],
    }
  }

  const factors: Record<string, number> = {}

  // 1. Status (20pts)
  factors.status = STATUS_SCORES[contact.status] ?? 0

  // 2. Email Health (25pts)
  factors.emailHealth = EMAIL_HEALTH_SCORES[contact.emailHealth] ?? 10

  // 3. Has Drafts (15pts): min(drafts * 5, 15)
  const draftCount = contact.drafts.length
  factors.hasDrafts = clamp(draftCount * 5, 15)

  // 4. Company Score (20pts): mapped from parent company score
  const parentCompanyScore = companyScoreMap.get(contact.company.id) ?? 0
  factors.companyScore = Math.round((parentCompanyScore / 100) * 20)

  // 5. Timeline Activity (10pts): min(timelineCount * 2, 10)
  const eventCount = contact._count.events
  factors.timelineActivity = clamp(eventCount * 2, 10)

  // 6. Job Title Seniority (10pts)
  factors.seniority = contact.title ? SENIORITY_SCORES[contact.title.includes('Executive') || contact.title.includes('CEO') || contact.title.includes('VP') || contact.title.includes('CTO') || contact.title.includes('CFO') ? 'Executive' : contact.title.includes('Manager') || contact.title.includes('Director') || contact.title.includes('Head') ? 'Manager' : 'Other'] ?? 3 : 3

  const total = Object.values(factors).reduce((sum, v) => sum + v, 0)
  const score = clamp(total, 100)

  // Recommendations
  const recommendations: string[] = []
  if (factors.status < 20) recommendations.push('Update contact status to active')
  if (factors.emailHealth < 20) recommendations.push('Validate email address')
  if (factors.hasDrafts < 10) recommendations.push('Generate an outreach email draft')
  if (factors.companyScore < 10) recommendations.push('Improve parent company data to boost score')
  if (factors.timelineActivity < 6) recommendations.push('Log interactions and activities')
  if (factors.seniority < 7) recommendations.push('Identify more senior decision-makers at this company')

  return {
    entityId: contactId,
    entityType: 'contact',
    score,
    grade: toGrade(score),
    factors,
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

    // Determine which companies to score
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

    // First pass: score all companies to build the company score map
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

    // Second pass: score contacts using company score map
    const contactResults: ScoreResult[] = []

    if (targetContactIds.length > 0) {
      // If scoring specific contacts, also fetch their parent companies if not already scored
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

    // Combine and sort by score descending
    const scores = [...companyResults, ...contactResults].sort((a, b) => b.score - a.score)

    return apiSuccess({ scores })
  } catch {
    return apiError('Failed to score leads')
  }
}
