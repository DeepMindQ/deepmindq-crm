import { db } from '@/lib/db'
import { apiSuccess, apiError } from '@/lib/apiHelpers'
import { format } from 'date-fns'
import { callLLM } from '@/lib/zai-helpers'

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
    aiNarrative: string | null
    aiHealthReasoning: string | null
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
  aiRelationshipSummary: string | null
  aiTrendAnalysis: string | null
}

type InteractionType = 'Email Sent' | 'Meeting' | 'Call' | 'Research' | 'Note'

interface MergedInteraction {
  date: Date
  type: InteractionType
  description: string
  nextAction?: string
}

interface RecommendedAction {
  company: string
  companyId: string
  person: string
  action: string
  reason: string
  priority: 'high' | 'medium'
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
// LLM helper — uses shared SDK instance
// ---------------------------------------------------------------------------

// callLLM is imported from @/lib/zai-helpers and used directly.

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

      // Compute health score (used as fallback if AI fails)
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
// 3. Recommended Actions — Rule-Based (kept as fallback)
// ---------------------------------------------------------------------------

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

// Stale-company re-engagement AI (original — kept as additional fallback layer)
async function fetchAIActions(
  staleContext: { companyName: string; companyId: string; lastInteraction: string | null; contactName: string }[],
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
          `- Company: "${c.companyName}" (ID: ${c.companyId}), Contact: "${c.contactName}", Last interaction: ${c.lastInteraction ?? 'never'}`,
      )
      .join('\n')}\n\nSuggest 3-5 specific next-best-actions for re-engagement.`

    const raw = await callLLM(systemPrompt, userPrompt)

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
// 5. Previous Week Activity (for AI trend comparison)
// ---------------------------------------------------------------------------

async function fetchPreviousWeekActivity() {
  const now = new Date()
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [emailsSent, meetings, calls, companyNotes, contactNotes] = await Promise.all([
    db.draft.count({
      where: { status: 'sent', createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
    }),
    db.companyTimelineEvent.count({
      where: { eventType: 'meeting_scheduled', createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
    }),
    db.companyTimelineEvent.count({
      where: { eventType: 'call', createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
    }),
    db.companyNote.count({
      where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
    }),
    db.contactNote.count({
      where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
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
// 6. Enriched Company Context (for AI analysis beyond what timelines carry)
// ---------------------------------------------------------------------------

async function fetchCompanyContextForAI() {
  return db.company.findMany({
    where: { status: { not: 'archived' } },
    orderBy: { engagementScore: 'desc' },
    take: 8,
    select: {
      id: true,
      rawName: true,
      engagementScore: true,
      lifecycleStage: true,
      status: true,
      lastActivityAt: true,
      industry: true,
      contacts: {
        select: { rawName: true, leadScore: true, status: true },
        orderBy: { leadScore: 'desc' },
        take: 3,
      },
    },
  })
}

// ---------------------------------------------------------------------------
// AI PILLAR 1: Relationship Health Analysis + Timeline Narratives
// ---------------------------------------------------------------------------

interface AICompanyAnalysisResult {
  companyId: string
  companyName: string
  healthScore: number
  healthReasoning: string
  narrative: string
}

async function fetchAICompanyAnalysis(
  companyContext: Awaited<ReturnType<typeof fetchCompanyContextForAI>>,
  timelines: Awaited<ReturnType<typeof fetchCompanyTimelines>>,
): Promise<AICompanyAnalysisResult[]> {
  if (companyContext.length === 0) return []

  try {
    const companiesData = companyContext.map((c) => {
      const timeline = timelines.find((t) => t.id === c.id)
      return {
        companyId: c.id,
        companyName: c.rawName,
        engagementScore: c.engagementScore,
        lifecycleStage: c.lifecycleStage,
        status: c.status,
        industry: c.industry,
        lastActivity: c.lastActivityAt ? format(new Date(c.lastActivityAt), 'MMM d, yyyy') : 'never',
        contacts: c.contacts.map((ct) => ({
          name: ct.rawName,
          leadScore: ct.leadScore,
          contactStatus: ct.status,
        })),
        recentInteractions: timeline?.interactions.map((int) => ({
          date: int.date,
          type: int.type,
          description: int.description,
        })) ?? [],
      }
    })

    const systemPrompt = `You are a senior relationship intelligence analyst for a B2B sales team. For each company, you must provide a nuanced health assessment and a brief relationship trajectory narrative.

SCORING GUIDELINES:
- Weigh recency heavily: a company engaged this week should score 70+, even with moderate engagement score
- Weigh interaction quality: meetings > calls > emails > research > notes
- Consider lifecycle alignment: a "negotiation" company going cold is worse than a "prospect" going cold
- Consider contact diversity: multiple engaged contacts is a strength signal
- Penalize gaps: >14 days with no activity drops score significantly unless lifecycle is dormant

For EACH company, return:
1. "companyId": the exact company ID string
2. "companyName": the exact company name string
3. "healthScore": number 0-100 — your nuanced assessment, NOT just the raw engagement score
4. "healthReasoning": 1-2 concise sentences explaining the score. Mention specific signals (max 180 chars)
5. "narrative": 2-3 sentence relationship trajectory. Mention momentum shifts, patterns, and what the data suggests about the relationship direction. Be specific about dates and event types (max 300 chars)

Respond with ONLY a JSON array of objects. No text before or after the array.`

    const userPrompt = `Analyze these company relationships:\n\n${JSON.stringify(companiesData, null, 1)}`

    const raw = await callLLM(systemPrompt, userPrompt)

    let parsed: AICompanyAnalysisResult[]
    try {
      parsed = JSON.parse(raw)
    } catch {
      const match = raw.match(/\[[\s\S]*\]/)
      parsed = match ? JSON.parse(match[0]) : []
    }

    return parsed
      .filter(
        (a) =>
          typeof a.companyId === 'string' &&
          typeof a.companyName === 'string' &&
          typeof a.healthScore === 'number' &&
          typeof a.healthReasoning === 'string' &&
          typeof a.narrative === 'string',
      )
      .map((a) => ({
        companyId: a.companyId,
        companyName: a.companyName,
        healthScore: Math.min(100, Math.max(0, Math.round(a.healthScore))),
        healthReasoning: a.healthReasoning.slice(0, 180),
        narrative: a.narrative.slice(0, 300),
      }))
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// AI PILLAR 2: Strategic Recommendations (cross-sell, sequencing, timing, risk)
// ---------------------------------------------------------------------------

async function fetchAIStrategicRecommendations(
  companyContext: Awaited<ReturnType<typeof fetchCompanyContextForAI>>,
): Promise<RecommendedAction[]> {
  if (companyContext.length === 0) return []

  try {
    const portfolioData = companyContext.map((c) => ({
      id: c.id,
      name: c.rawName,
      lifecycleStage: c.lifecycleStage,
      engagementScore: c.engagementScore,
      status: c.status,
      lastActivity: c.lastActivityAt ? format(new Date(c.lastActivityAt), 'MMM d, yyyy') : 'never',
      contacts: c.contacts.map((ct) => ({
        name: ct.rawName,
        leadScore: ct.leadScore,
        contactStatus: ct.status,
      })),
    }))

    const systemPrompt = `You are a strategic B2B sales advisor analyzing a full relationship portfolio. Generate 5-8 high-impact recommendations across these four categories:

1. CROSS-SELL / UPSELL OPPORTUNITIES: Companies showing buying signals (high engagement, recent activity, multiple contacts) that are ready for expanded conversations.

2. OPTIMAL CONTACT SEQUENCING: When a company has multiple contacts, recommend which person to engage next and why (e.g., "Talk to the VP after the champion's positive response").

3. TIMING RECOMMENDATIONS: Based on lifecycle stage and recent activity patterns, recommend when to reach out (e.g., "Follow up on the proposal within 3 days while momentum is high").

4. RISK ALERTS: Companies showing danger signs — declining engagement, stale relationships in critical stages, single-threaded contacts going cold.

Vary your recommendations across all four categories. For each recommendation:
- "company": exact company name
- "companyId": exact company ID
- "person": specific contact name, or "Team" if no specific person
- "action": specific, actionable step (max 70 chars)
- "reason": strategic reasoning with category context (max 120 chars)
- "priority": "high" or "medium"

Respond with ONLY a JSON array. No text outside the array.`

    const userPrompt = `Portfolio overview:\n\n${JSON.stringify(portfolioData, null, 1)}\n\nGenerate 5-8 strategic recommendations covering cross-sell, contact sequencing, timing, and risk alert categories.`

    const raw = await callLLM(systemPrompt, userPrompt)

    let parsed: RecommendedAction[]
    try {
      parsed = JSON.parse(raw)
    } catch {
      const match = raw.match(/\[[\s\S]*\]/)
      parsed = match ? JSON.parse(match[0]) : []
    }

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
        action: a.action.slice(0, 70),
        reason: a.reason.slice(0, 120),
        priority: a.priority,
      }))
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// AI PILLAR 3: Weekly Pattern Analysis
// ---------------------------------------------------------------------------

async function fetchAIWeeklyPatternAnalysis(
  thisWeek: Awaited<ReturnType<typeof fetchWeeklyActivity>>,
  lastWeek: Awaited<ReturnType<typeof fetchPreviousWeekActivity>>,
): Promise<string | null> {
  try {
    const systemPrompt = `You are a sales activity analytics advisor. Compare this week's outreach activity to last week and provide a concise, actionable trend analysis.

Focus on:
- Significant volume changes (e.g., "email volume dropped 40%")
- Activity mix imbalances (e.g., "heavy on emails but zero meetings — consider converting email conversations to calls")
- Actionable next steps for the coming week
- Be specific with numbers and percentages

Respond with ONLY a JSON object with a single field:
- "trendAnalysis": string, 2-4 sentences, max 350 chars

No text outside the JSON object.`

    const userPrompt = `This week's activity: ${JSON.stringify(thisWeek)}\nLast week's activity: ${JSON.stringify(lastWeek)}`

    const raw = await callLLM(systemPrompt, userPrompt)

    let parsed: { trendAnalysis: string }
    try {
      parsed = JSON.parse(raw)
    } catch {
      const match = raw.match(/\{[\s\S]*\}/)
      parsed = match ? JSON.parse(match[0]) : { trendAnalysis: '' }
    }

    return parsed.trendAnalysis?.length ? parsed.trendAnalysis.slice(0, 350) : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// AI PILLAR 4: Relationship Portfolio Summary
// ---------------------------------------------------------------------------

async function fetchAIRelationshipSummary(
  stats: Awaited<ReturnType<typeof fetchStats>>,
  companyContext: Awaited<ReturnType<typeof fetchCompanyContextForAI>>,
): Promise<string | null> {
  try {
    const companyLines = companyContext.map((c) => {
      const contactSummary = c.contacts.map((ct) => `${ct.rawName} (lead:${ct.leadScore})`).join(', ')
      return `"${c.rawName}": engagement=${c.engagementScore}, stage=${c.lifecycleStage ?? 'unknown'}, status=${c.status}, contacts=[${contactSummary || 'none'}]`
    })

    const systemPrompt = `You are a relationship portfolio advisor providing a high-level executive summary. Analyze the full portfolio and provide insights.

Cover:
- Overall portfolio health and balance (are too many relationships going cold? is engagement concentrated in a few companies?)
- Notable strengths (strong multi-threaded relationships, hot opportunities)
- Key concern or strategic focus for the coming week

Respond with ONLY a JSON object with a single field:
- "summary": string, 3-4 sentences, max 450 chars

No text outside the JSON object.`

    const userPrompt = `Portfolio stats: ${JSON.stringify(stats)}\n\nTop companies:\n${companyLines.join('\n')}`

    const raw = await callLLM(systemPrompt, userPrompt)

    let parsed: { summary: string }
    try {
      parsed = JSON.parse(raw)
    } catch {
      const match = raw.match(/\{[\s\S]*\}/)
      parsed = match ? JSON.parse(match[0]) : { summary: '' }
    }

    return parsed.summary?.length ? parsed.summary.slice(0, 450) : null
  } catch {
    return null
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

    // -----------------------------------------------------------------------
    // Phase 1: Fetch all raw data from DB in parallel
    // -----------------------------------------------------------------------
    const [stats, companyTimelines, ruleBasedActions, weeklyActivity, companyContext, previousWeekActivity] =
      await Promise.all([
        fetchStats(),
        fetchCompanyTimelines(),
        fetchRecommendedActions(), // rule-based + stale-company AI (original fallback layer)
        fetchWeeklyActivity(),
        fetchCompanyContextForAI(),
        fetchPreviousWeekActivity(),
      ])

    // -----------------------------------------------------------------------
    // Phase 2: Run all four AI analysis pillars in parallel
    // Each pillar independently catches errors — one failure won't block others
    // -----------------------------------------------------------------------
    const [aiCompanyAnalysis, aiStrategicRecs, aiTrendAnalysis, aiRelationshipSummary] = await Promise.all([
      fetchAICompanyAnalysis(companyContext, companyTimelines),
      fetchAIStrategicRecommendations(companyContext),
      fetchAIWeeklyPatternAnalysis(weeklyActivity, previousWeekActivity),
      fetchAIRelationshipSummary(stats, companyContext),
    ])

    // -----------------------------------------------------------------------
    // Phase 3: Merge AI results into response
    // -----------------------------------------------------------------------

    // 3a. Enrich company timelines with AI health scores, reasoning, and narratives
    const enrichedTimelines = companyTimelines.map((timeline) => {
      const aiResult = aiCompanyAnalysis.find((a) => a.companyId === timeline.id)
      return {
        ...timeline,
        // Use AI health score if available, otherwise keep the math-based fallback
        health: aiResult ? aiResult.healthScore : timeline.health,
        aiNarrative: aiResult?.narrative ?? null,
        aiHealthReasoning: aiResult?.healthReasoning ?? null,
      }
    })

    // 3b. Merge AI strategic recommendations with existing rule-based + stale-company actions
    // Rule-based actions serve as the guaranteed fallback; AI recs are additive
    const allActions = [...ruleBasedActions, ...aiStrategicRecs]
    allActions.sort((a, b) =>
      a.priority === 'high' && b.priority !== 'high'
        ? -1
        : a.priority !== 'high' && b.priority === 'high'
          ? 1
          : 0,
    )

    const data: RelationshipMemoryResponse = {
      stats,
      companyTimelines: enrichedTimelines,
      recommendedActions: allActions.slice(0, 12),
      weeklyActivity,
      aiRelationshipSummary,
      aiTrendAnalysis,
    }

    cachedResult = { data, ts: Date.now() }
    return apiSuccess(data)
  } catch (err) {
    console.error('[relationship-memory] Error:', err)
    return apiError('Failed to load relationship memory data')
  }
}