import { db } from '@/lib/db'
import { apiSuccess, apiError } from '@/lib/apiHelpers'
import { formatDistanceToNow } from 'date-fns'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RecommendationType = 'follow_up' | 'email' | 'research' | 'validate' | 'call' | 'meeting' | 'add_contacts' | 'cross_sell'
type Priority = 'high' | 'medium' | 'low'

interface Recommendation {
  type: RecommendationType
  priority: Priority
  entityType: 'company' | 'contact'
  entityId: string
  entityName: string
  action: string
  reasoning: string
}

// ---------------------------------------------------------------------------
// Priority helpers
// ---------------------------------------------------------------------------

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

function sortRecommendations(recs: Recommendation[]): Recommendation[] {
  return recs.sort((a, b) => {
    const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    if (pDiff !== 0) return pDiff
    return 0
  })
}

// ---------------------------------------------------------------------------
// Rule-based recommendation generators
// ---------------------------------------------------------------------------

/**
 * 1. Stale contacts: lastContactedAt > 14 days ago and status=active → follow_up
 */
async function staleContacts(): Promise<Recommendation[]> {
  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

  const contacts = await db.contact.findMany({
    where: {
      status: 'active',
      archivedAt: null,
      OR: [
        { lastContactedAt: null },
        { lastContactedAt: { lte: fourteenDaysAgo } },
      ],
    },
    include: { company: { select: { name: true } } },
    take: 10,
    orderBy: { lastContactedAt: 'asc' },
  })

  return contacts.map((c) => ({
    type: 'follow_up' as const,
    priority: 'high' as const,
    entityType: 'contact' as const,
    entityId: c.id,
    entityName: c.name,
    action: `Follow up with ${c.name} at ${c.company.name}`,
    reasoning: c.lastContactedAt
      ? `Last contacted ${formatDistanceToNow(new Date(c.lastContactedAt), { addSuffix: true })}, active contact needs re-engagement`
      : 'Never contacted — active contact with no outreach recorded',
  }))
}

/**
 * 2. Unvalidated emails: contacts with emailHealth='unknown' → validate
 */
async function unvalidatedEmails(): Promise<Recommendation[]> {
  const contacts = await db.contact.findMany({
    where: {
      emailHealth: 'unknown',
      archivedAt: null,
      email: { not: null },
    },
    include: { company: { select: { name: true } } },
    take: 5,
  })

  return contacts.map((c) => ({
    type: 'validate' as const,
    priority: 'medium' as const,
    entityType: 'contact' as const,
    entityId: c.id,
    entityName: c.name,
    action: `Validate email for ${c.name}`,
    reasoning: `Email address (${c.email}) has not been validated yet`,
  }))
}

/**
 * 3. No research: Active companies without research card → research
 */
async function noResearch(): Promise<Recommendation[]> {
  const companies = await db.company.findMany({
    where: {
      status: { in: ['active', 'new'] },
      researchCard: null,
    },
    take: 5,
  })

  return companies.map((c) => ({
    type: 'research' as const,
    priority: 'medium' as const,
    entityType: 'company' as const,
    entityId: c.id,
    entityName: c.name,
    action: `Generate research card for ${c.name}`,
    reasoning: `${c.status} company has no AI research card — run research to unlock insights`,
  }))
}

/**
 * 4. Draft pending: Contacts with draft status='draft' → email
 */
async function draftPending(): Promise<Recommendation[]> {
  // Find drafts in 'draft' status with their non-archived contacts
  const drafts = await db.draft.findMany({
    where: { status: 'draft' },
    include: {
      contact: {
        include: { company: { select: { name: true } } },
      },
    },
    take: 5,
    orderBy: { createdAt: 'desc' },
  })

  return drafts
    .filter((d) => d.contact !== null && d.contact.archivedAt === null)
    .map((d) => ({
      type: 'email' as const,
      priority: 'high' as const,
      entityType: 'contact' as const,
      entityId: d.contact.id,
      entityName: d.contact.name,
      action: `Review and send draft to ${d.contact.name}`,
      reasoning: `Email draft "${d.subject}" is ready for review and sending`,
    }))
}

/**
 * 5. Hot opportunities: Opportunities in 'negotiation' stage → meeting
 */
async function hotOpportunities(): Promise<Recommendation[]> {
  const opportunities = await db.opportunity.findMany({
    where: { status: 'negotiation' },
    include: {
      company: { select: { name: true } },
      targetContact: { select: { id: true, name: true } },
    },
    take: 5,
    orderBy: { updatedAt: 'desc' },
  })

  return opportunities.map((o) => {
    const target = o.targetContact
    return {
      type: 'meeting' as const,
      priority: 'high' as const,
      entityType: 'company' as const,
      entityId: o.companyId,
      entityName: o.company.name,
      action: `Schedule meeting for "${o.title}" with ${o.company.name}`,
      reasoning: `Opportunity is in negotiation stage${target ? ` — key contact: ${target.name}` : ''}${o.nextAction ? `. Next action: ${o.nextAction}` : ''}`,
    }
  })
}

/**
 * 6. New companies: Companies with status='new' and no contacts → add contacts
 */
async function newCompaniesNoContacts(): Promise<Recommendation[]> {
  const companies = await db.company.findMany({
    where: {
      status: 'new',
      contacts: { none: {} },
    },
    take: 5,
  })

  return companies.map((c) => ({
    type: 'add_contacts' as const,
    priority: 'medium' as const,
    entityType: 'company' as const,
    entityId: c.id,
    entityName: c.name,
    action: `Add contacts to ${c.name}`,
    reasoning: `New company with no contacts added yet — identify and add key people`,
  }))
}

/**
 * 7. Won recently: Companies with won opportunities in last 7 days → follow_up (cross-sell)
 */
async function wonRecently(): Promise<Recommendation[]> {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const opportunities = await db.opportunity.findMany({
    where: {
      status: 'won',
      updatedAt: { gte: sevenDaysAgo },
    },
    include: {
      company: { select: { name: true } },
    },
    take: 5,
    orderBy: { updatedAt: 'desc' },
  })

  return opportunities.map((o) => ({
    type: 'cross_sell' as const,
    priority: 'high' as const,
    entityType: 'company' as const,
    entityId: o.companyId,
    entityName: o.company.name,
    action: `Follow up with ${o.company.name} for cross-sell opportunities`,
    reasoning: `"${o.title}" was won recently — capitalize on the momentum for additional business`,
  }))
}

// ---------------------------------------------------------------------------
// GET /api/ai/recommendations
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const [
      stale,
      unvalidated,
      noResearchRecs,
      draftPendings,
      hotOpps,
      newCompanies,
      wonRecent,
    ] = await Promise.all([
      staleContacts(),
      unvalidatedEmails(),
      noResearch(),
      draftPending(),
      hotOpportunities(),
      newCompaniesNoContacts(),
      wonRecently(),
    ])

    const all = [
      ...stale,
      ...unvalidated,
      ...noResearchRecs,
      ...draftPendings,
      ...hotOpps,
      ...newCompanies,
      ...wonRecent,
    ]

    const sorted = sortRecommendations(all).slice(0, 20)

    return apiSuccess({ recommendations: sorted })
  } catch {
    return apiError('Failed to generate recommendations')
  }
}