import { db } from '@/lib/db'
import { apiSuccess, apiError } from '@/lib/apiHelpers'
import { format } from 'date-fns'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RelationshipMemoryResponse {
  stats: {
    activeRelationships: number
    strongConnections: number
    needAttention: number
    totalInteractions: number
  }
  companyTimelines: Array<{
    id: string
    name: string
    health: number
    contacts: Array<{ name: string; initials: string; color: string }>
    interactions: Array<{
      date: string
      type: 'Email Sent' | 'Meeting' | 'Call' | 'Research' | 'Note'
      description: string
      nextAction?: string
    }>
  }>
  recommendedActions: Array<{
    company: string
    companyId: string
    person: string
    action: string
    reason: string
    priority: 'high' | 'medium'
  }>
  weeklyActivity: {
    emailsSent: number
    meetings: number
    calls: number
    notesAdded: number
  }
}

type InteractionType = 'Email Sent' | 'Meeting' | 'Call' | 'Research' | 'Note'

interface MergedInteraction {
  date: Date
  type: InteractionType
  description: string
  nextAction?: string
}

// ---------------------------------------------------------------------------
// In-memory cache (5 minutes)
// ---------------------------------------------------------------------------

let cachedResult: { data: RelationshipMemoryResponse; ts: number } | null = null
const CACHE_TTL = 5 * 60 * 1000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nameToColor(name: string): string {
  const colors = ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#EF4444', '#14B8A6']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function toInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function eventTypeToDisplay(eventType: string): InteractionType {
  const map: Record<string, InteractionType> = {
    email_sent: 'Email Sent',
    meeting_scheduled: 'Meeting',
    call: 'Call',
    research: 'Research',
  }
  return map[eventType] ?? 'Note'
}

// ---------------------------------------------------------------------------
// LLM helper — uses z-ai-web-dev-sdk (auth handled internally)
// ---------------------------------------------------------------------------

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const ZAI = await import('z-ai-web-dev-sdk').then(m => m.default).then(Z => Z.create())
  const completion = await ZAI.chat.completions.create({
    messages: [
      { role: 'assistant', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    thinking: { type: 'disabled' },
  })
  return completion.choices?.[0]?.message?.content ?? ''
}

// ---------------------------------------------------------------------------
// 1. Stats
// ---------------------------------------------------------------------------

async function fetchStats() {
  const [activeRelationships, strongConnections, needAttention, timelineCount, noteCount, draftSentCount] =
    await Promise.all([
      db.company.count({
        where: { engagementScore: { gt: 0 }, status: { not: 'archived' } },
      }),
      db.company.count({
        where: { engagementScore: { gte: 60 }, status: { not: 'archived' } },
      }),
      db.company.count({
        where: { status: 'active', engagementScore: { lt: 30 } },
      }),
      db.companyTimelineEvent.count(),
      db.contactNote.count(),
      db.draft.count({ where: { status: 'sent' } }),
    ])

  return {
    activeRelationships,
    strongConnections,
    needAttention,
    totalInteractions: timelineCount + noteCount + draftSentCount,
  }
}

// ---------------------------------------------------------------------------
// 2. Company Timelines
// ---------------------------------------------------------------------------

async function fetchCompanyTimelines() {
  const companies = await db.company.findMany({
    where: { status: { not: 'archived' } },
    orderBy: { engagementScore: 'desc' },
    take: 8,
    select: {
      id: true,
      rawName: true,
      engagementScore: true,
      lastActivityAt: true,
      contacts: {
        select: { id: true, rawName: true, leadScore: true },
        orderBy: { leadScore: 'desc' },
        take: 3,
      },
    },
  })

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const timelines = await Promise.all(
    companies.map(async (company) => {
      // Fetch timeline events, contact notes, and sent drafts in parallel
      const [timelineEvents, contactNotes, sentDrafts] = await Promise.all([
        db.companyTimelineEvent.findMany({
          where: { companyId: company.id },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { eventType: true, title: true, description: true, createdAt: true },
        }),
        db.contactNote.findMany({
          where: { contact: { companyId: company.id } },
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: { body: true, createdAt: true },
        }),
        db.draft.findMany({
          where: { contact: { companyId: company.id }, status: 'sent' },
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: { subject: true, createdAt: true },
        }),
      ])

      // Merge all interactions into a single timeline
      const merged: MergedInteraction[] = [
        ...timelineEvents.map((e) => ({
          date: e.createdAt,
          type: eventTypeToDisplay(e.eventType),
          description: e.description ?? e.title,
        })),
        ...contactNotes.map((n) => ({
          date: n.createdAt,
          type: 'Note' as const,
          description: n.body.length > 100 ? n.body.slice(0, 100) + '...' : n.body,
        })),
        ...sentDrafts.map((d) => ({
          date: d.createdAt,
          type: 'Email Sent' as const,
          description: d.subject,
        })),
      ]

      // Sort by date desc, take top 5
      merged.sort((a, b) => b.date.getTime() - a.date.getTime())
      const topInteractions = merged.slice(0, 5)

      // Compute health score
      let health = Math.min(company.engagementScore, 100) * 0.5
      const hasRecentInteraction = company.lastActivityAt && company.lastActivityAt >= sevenDaysAgo
      if (hasRecentInteraction) health += 25
      const hasMultipleContacts = company.contacts.length >= 2
      if (hasMultipleContacts) health += 25
      health = Math.min(Math.round(health), 100)

      // Format contacts
      const formattedContacts = company.contacts.map((c) => ({
        name: c.rawName,
        initials: toInitials(c.rawName),
        color: nameToColor(c.rawName),
      }))

      // Format interactions for response
      const formattedInteractions = topInteractions.map((i) => ({
        date: format(i.date, 'MMM d, yyyy'),
        type: i.type,
        description: i.description,
        nextAction: i.nextAction,
      }))

      return {
        id: company.id,
        name: company.rawName,
        health,
        contacts: formattedContacts,
        interactions: formattedInteractions,
      }
    }),
  )

  return timelines
}

// ---------------------------------------------------------------------------
// 3. Recommended Actions
// ---------------------------------------------------------------------------

interface RecommendedAction {
  company: string
  companyId: string
  person: string
  action: string
  reason: string
  priority: 'high' | 'medium'
}

async function fetchRuleBasedActions(): Promise<RecommendedAction[]> {
  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

  const actions: RecommendedAction[] = []

  // Rule 1: Companies with highest engagementScore but no sent Draft in last 14 days
  const highEngagementNoRecentEmail = await db.company.findMany({
    where: {
      engagementScore: { gte: 40 },
      status: { not: 'archived' },
      contacts: {
        some: {
          drafts: {
            none: {
              status: 'sent',
              createdAt: { gte: fourteenDaysAgo },
            },
          },
        },
      },
    },
    orderBy: { engagementScore: 'desc' },
    take: 5,
    select: {
      id: true,
      rawName: true,
      engagementScore: true,
      contacts: {
        select: { id: true, rawName: true, leadScore: true },
        orderBy: { leadScore: 'desc' },
        take: 1,
      },
    },
  })

  for (const c of highEngagementNoRecentEmail) {
    const person = c.contacts[0]?.rawName ?? 'Team'
    actions.push({
      company: c.rawName,
      companyId: c.id,
      person,
      action: 'Send follow-up email',
      reason: `High engagement score (${c.engagementScore}) but no email sent in the last 14 days — re-engage to maintain momentum`,
      priority: 'high',
    })
  }

  // Rule 2: Contacts with leadScore >= 70 but status in ('imported','cleaned')
  const highScoreUncontacted = await db.contact.findMany({
    where: {
      leadScore: { gte: 70 },
      status: { in: ['imported', 'cleaned'] },
    },
    orderBy: { leadScore: 'desc' },
    take: 5,
    select: {
      id: true,
      rawName: true,
      leadScore: true,
      company: { select: { id: true, rawName: true } },
    },
  })

  for (const c of highScoreUncontacted) {
    actions.push({
      company: c.company.rawName,
      companyId: c.company.id,
      person: c.rawName,
      action: 'Generate and send outreach email',
      reason: `Lead score of ${c.leadScore} indicates strong potential but contact hasn't been outreached yet`,
      priority: 'medium',
    })
  }

  // Rule 3: Companies in 'negotiation' opportunity stage → schedule follow-up meeting
  const negotiationCompanies = await db.company.findMany({
    where: {
      lifecycleStage: 'negotiation',
      status: { not: 'archived' },
    },
    take: 5,
    select: {
      id: true,
      rawName: true,
      contacts: {
        select: { id: true, rawName: true },
        orderBy: { leadScore: 'desc' },
        take: 1,
      },
    },
  })

  for (const c of negotiationCompanies) {
    const person = c.contacts[0]?.rawName ?? 'Decision maker'
    actions.push({
      company: c.rawName,
      companyId: c.id,
      person,
      action: 'Schedule follow-up meeting',
      reason: 'Company is in negotiation stage — a meeting could help close the deal',
      priority: 'high',
    })
  }

  return actions
}

async function fetchAIActions(
  staleContext: { companyName: string; lastInteraction: string | null; contactName: string }[],
): Promise<RecommendedAction[]> {
  if (staleContext.length === 0) return []

  try {
    const systemPrompt = `You are a sales relationship advisor. Given a list of companies with stale or neglected relationships, suggest 3-5 specific next-best-actions to re-engage them.

Respond with ONLY a JSON array of objects. Each object must have exactly these fields:
- "company": company name (string)
- "companyId": company ID (string)
- "person": contact person name (string)
- "action": specific action to take (string, max 60 chars)
- "reason": brief reasoning (string, max 100 chars)
- "priority": "high" or "medium"

Do NOT include any text outside the JSON array.`

    const userPrompt = `Here are companies that need attention:\n\n${staleContext
      .map(
        (c) =>
          `- Company: "${c.companyName}", Contact: "${c.contactName}", Last interaction: ${c.lastInteraction ?? 'never'}`,
      )
      .join('\n')}\n\nSuggest 3-5 specific next-best-actions for re-engagement.`

    const raw = await callAI(systemPrompt, userPrompt)

    // Parse JSON with fallback
    let parsed: RecommendedAction[]
    try {
      parsed = JSON.parse(raw)
    } catch {
      const match = raw.match(/\[[\s\S]*\]/)
      if (match) {
        parsed = JSON.parse(match[0])
      } else {
        return []
      }
    }

    // Validate and sanitize
    return parsed
      .filter(
        (a): a is RecommendedAction =>
          typeof a.company === 'string' &&
          typeof a.companyId === 'string' &&
          typeof a.person === 'string' &&
          typeof a.action === 'string' &&
          typeof a.reason === 'string' &&
          (a.priority === 'high' || a.priority === 'medium'),
      )
      .map((a) => ({
        company: a.company.slice(0, 100),
        companyId: a.companyId,
        person: a.person.slice(0, 100),
        action: a.action.slice(0, 60),
        reason: a.reason.slice(0, 100),
        priority: a.priority,
      }))
  } catch {
    // AI failed — fall back to rule-based only
    return []
  }
}

async function fetchRecommendedActions(): Promise<RecommendedAction[]> {
  const [ruleBased, staleCompanies] = await Promise.all([
    fetchRuleBasedActions(),
    // Fetch stale context for AI
    db.company.findMany({
      where: {
        status: { not: 'archived' },
        OR: [
          { lastActivityAt: null },
          { lastActivityAt: { lte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        ],
      },
      take: 10,
      orderBy: { engagementScore: 'desc' },
      select: {
        id: true,
        rawName: true,
        lastActivityAt: true,
        contacts: {
          select: { rawName: true },
          orderBy: { leadScore: 'desc' },
          take: 1,
        },
      },
    }),
  ])

  const staleContext = staleCompanies.map((c) => ({
    companyName: c.rawName,
    companyId: c.id,
    contactName: c.contacts[0]?.rawName ?? 'Unknown',
    lastInteraction: c.lastActivityAt ? format(new Date(c.lastActivityAt), 'MMM d, yyyy') : null,
  }))

  const aiActions = await fetchAIActions(staleContext)

  // Combine and sort: high first, then medium
  const combined = [...ruleBased, ...aiActions]
  combined.sort((a, b) => (a.priority === 'high' && b.priority !== 'high' ? -1 : a.priority !== 'high' && b.priority === 'high' ? 1 : 0))

  return combined.slice(0, 8)
}

// ---------------------------------------------------------------------------
// 4. Weekly Activity
// ---------------------------------------------------------------------------

async function fetchWeeklyActivity() {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const [emailsSent, meetings, calls, companyNotes, contactNotes] = await Promise.all([
    db.draft.count({
      where: { status: 'sent', createdAt: { gte: sevenDaysAgo } },
    }),
    db.companyTimelineEvent.count({
      where: { eventType: 'meeting_scheduled', createdAt: { gte: sevenDaysAgo } },
    }),
    db.companyTimelineEvent.count({
      where: { eventType: 'call', createdAt: { gte: sevenDaysAgo } },
    }),
    db.companyNote.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    }),
    db.contactNote.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    }),
  ])

  return {
    emailsSent,
    meetings,
    calls,
    notesAdded: companyNotes + contactNotes,
  }
}

// ---------------------------------------------------------------------------
// GET /api/ai/relationship-memory
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    // Return cached result if still fresh
    if (cachedResult && Date.now() - cachedResult.ts < CACHE_TTL) {
      return apiSuccess(cachedResult.data)
    }

    const [stats, companyTimelines, recommendedActions, weeklyActivity] = await Promise.all([
      fetchStats(),
      fetchCompanyTimelines(),
      fetchRecommendedActions(),
      fetchWeeklyActivity(),
    ])

    const data: RelationshipMemoryResponse = {
      stats,
      companyTimelines,
      recommendedActions,
      weeklyActivity,
    }

    cachedResult = { data, ts: Date.now() }
    return apiSuccess(data)
  } catch (err) {
    console.error('[relationship-memory] Error:', err)
    return apiError('Failed to load relationship memory data')
  }
}