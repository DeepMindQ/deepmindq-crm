/**
 * Sprint 3A: Internal Memory Connector
 *
 * The "ChatGPT memory layer for accounts" — feeds ALL internal CRM data
 * (meeting notes, sales notes, emails, timeline events, account strategies,
 * human intelligence) into the intelligence pipeline as first-class signals.
 *
 * This is the critical bridge that makes DeepMindQ powerful for ALL company sizes,
 * not just enterprises with abundant public information.
 *
 * Memory Sources:
 * 1. CompanyNote — sales notes, meeting summaries, research, SWOT, competitive
 * 2. ContactNote — per-contact interaction notes, buying signals
 * 3. EmailEvent — reply/bounce/open tracking → engagement signals
 * 4. CompanyTimelineEvent — all account activity events
 * 5. HumanIntelligenceInbox — human-submitted intelligence
 * 6. AccountStrategy — SWOT analysis, stakeholder maps, competitive position
 *
 * Output: RawIntelligenceObject[] ready for the acquisition pipeline
 */

import { db } from '@/lib/db'
import type { RawIntelligenceObject } from './types'
import { classifySignalType } from './signal-creator'
import { createSignalFromIntelligenceObject } from './signal-creator'

// ── Internal Memory Types ──

export type InternalMemorySource =
  | 'company_note'
  | 'contact_note'
  | 'email_engagement'
  | 'timeline_event'
  | 'human_intelligence'
  | 'account_strategy'
  | 'person_change'

export interface InternalMemoryItem {
  source: InternalMemorySource
  companyId: string
  content: string
  summary?: string
  signalDate?: Date
  category?: string
  metadata?: Record<string, unknown>
  confidence?: number // override default confidence for this source
}

// ── Source Confidence Weights ──
// Internal memory from humans is high confidence; system-detected signals are moderate

const MEMORY_SOURCE_CONFIDENCE: Record<InternalMemorySource, number> = {
  company_note: 0.90,        // Human-written sales notes — high trust
  contact_note: 0.85,        // Per-contact interaction notes
  email_engagement: 0.80,   // System-tracked email events
  timeline_event: 0.75,      // System-recorded activity
  human_intelligence: 0.95,  // Deliberately submitted intel — highest trust
  account_strategy: 0.92,   // Strategic analysis — high trust
  person_change: 0.80,      // People movement signals
}

// ── Main Connector Function ──

/**
 * Extract ALL internal memory for a company and convert to intelligence objects.
 * This is the single entry point for the internal memory layer.
 */
export async function extractInternalMemory(
  companyId: string
): Promise<{ items: InternalMemoryItem[]; sourceBreakdown: Record<string, number> }> {
  const items: InternalMemoryItem[] = []
  const breakdown: Record<string, number> = {}

  // ── 1. Company Notes ──
  const companyNotes = await db.companyNote.findMany({
    where: { companyId },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  })
  for (const note of companyNotes) {
    const signalContent = buildCompanyNoteIntelligence(note)
    items.push({
      source: 'company_note',
      companyId,
      content: signalContent.content,
      summary: signalContent.summary,
      signalDate: note.updatedAt,
      category: noteCategoryToKnowledge(note.category),
      metadata: {
        noteId: note.id,
        noteCategory: note.category,
        author: note.author,
        pinned: note.pinned,
        noteAge: Math.floor((Date.now() - note.updatedAt.getTime()) / 86400000),
      },
    })
    breakdown.company_note = (breakdown.company_note || 0) + 1
  }

  // ── 2. Contact Notes ──
  const contacts = await db.contact.findMany({
    where: { companyId, status: { not: 'archived' } },
    select: {
      id: true,
      rawName: true,
      title: true,
      role: true,
      email: true,
      status: true,
      leadScore: true,
      engagementScore: true,
      lastContactedAt: true,
      companyFitScore: true,
      notes: {
        orderBy: { updatedAt: 'desc' },
        take: 10,
      },
      _count: { select: { replies: true, events: true } },
    },
    take: 30,
    orderBy: { leadScore: 'desc' },
  })

  for (const contact of contacts) {
    // Contact-level intelligence
    const contactIntel = buildContactIntelligence(contact)
    if (contactIntel) {
      items.push({
        source: 'contact_note',
        companyId,
        content: contactIntel.content,
        summary: contactIntel.summary,
        signalDate: contact.lastContactedAt || undefined,
        category: 'Stakeholders',
        metadata: {
          contactId: contact.id,
          contactName: contact.rawName,
          contactTitle: contact.title,
          contactStatus: contact.status,
          leadScore: contact.leadScore,
          engagementScore: contact.engagementScore,
          replyCount: contact._count.replies,
          emailEventCount: contact._count.events,
        },
      })
      breakdown.contact_note = (breakdown.contact_note || 0) + 1
    }

    // Individual contact notes
    for (const note of contact.notes) {
      if (note.body && note.body.trim().length > 10) {
        items.push({
          source: 'contact_note',
          companyId,
          content: `[${contact.rawName} (${contact.title || 'No title'})] ${note.body}`,
          summary: `Note about ${contact.rawName}: ${note.body.substring(0, 100)}`,
          signalDate: note.updatedAt,
          category: 'Conversations',
          metadata: {
            contactNoteId: note.id,
            contactId: contact.id,
            contactName: contact.rawName,
          },
        })
        breakdown.contact_note = (breakdown.contact_note || 0) + 1
      }
    }
  }

  // ── 3. Email Engagement Signals ──
  const emailEvents = await db.emailEvent.findMany({
    where: {
      contact: { companyId },
      createdAt: { gte: new Date(Date.now() - 90 * 86400000) }, // last 90 days
    },
    include: {
      contact: { select: { rawName: true, title: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const emailSummary = buildEmailEngagementSignal(emailEvents)
  if (emailSummary) {
    items.push({
      source: 'email_engagement',
      companyId,
      content: emailSummary.content,
      summary: emailSummary.summary,
      signalDate: emailSummary.latestDate,
      category: 'Conversations',
      metadata: {
        totalEvents: emailEvents.length,
        replyCount: emailSummary.replyCount,
        bounceCount: emailSummary.bounceCount,
        openCount: emailSummary.openCount,
        activeContacts: emailSummary.activeContacts,
      },
    })
    breakdown.email_engagement = (breakdown.email_engagement || 0) + 1
  }

  // ── 4. Company Timeline Events ──
  const timelineEvents = await db.companyTimelineEvent.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })

  for (const event of timelineEvents) {
    const eventIntel = buildTimelineEventIntelligence(event)
    items.push({
      source: 'timeline_event',
      companyId,
      content: eventIntel.content,
      summary: eventIntel.summary,
      signalDate: event.createdAt,
      category: timelineEventToKnowledge(event.eventType),
      metadata: {
        timelineEventId: event.id,
        eventType: event.eventType,
      },
    })
    breakdown.timeline_event = (breakdown.timeline_event || 0) + 1
  }

  // ── 5. Human Intelligence Inbox ──
  const humanIntel = await db.humanIntelligenceInbox.findMany({
    where: {
      companyId,
      status: { in: ['approved', 'reviewed', 'pending'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  for (const intel of humanIntel) {
    items.push({
      source: 'human_intelligence',
      companyId,
      content: `[HUMAN INTEL - ${intel.priority.toUpperCase()}] ${intel.content}`,
      summary: intel.summary || intel.content.substring(0, 150),
      signalDate: intel.createdAt,
      category: intel.category || 'Strategy',
      confidence: 0.95, // Human-submitted = highest trust
      metadata: {
        inboxId: intel.id,
        submittedBy: intel.submittedBy,
        source: intel.source,
        sourceUrl: intel.sourceUrl,
        priority: intel.priority,
        status: intel.status,
        tags: tryParseJSON(intel.tags),
      },
    })
    breakdown.human_intelligence = (breakdown.human_intelligence || 0) + 1
  }

  // ── 6. Account Strategy ──
  const strategies = await db.accountStrategy.findMany({
    where: { companyId, status: { in: ['active', 'review', 'draft'] } },
    orderBy: { updatedAt: 'desc' },
    take: 5,
  })

  for (const strategy of strategies) {
    const strategyIntel = buildAccountStrategyIntelligence(strategy as any)
    items.push({
      source: 'account_strategy',
      companyId,
      content: strategyIntel.content,
      summary: strategyIntel.summary,
      signalDate: strategy.updatedAt,
      category: 'Strategy',
      confidence: 0.92,
      metadata: {
        strategyId: strategy.id,
        strategyStatus: strategy.status,
        hasSwot: !!strategy.swotAnalysis,
        hasStakeholderMap: !!strategy.stakeholderMap,
        hasInitiatives: !!strategy.keyInitiatives,
      },
    })
    breakdown.account_strategy = (breakdown.account_strategy || 0) + 1
  }

  return { items, sourceBreakdown: breakdown }
}

// ── 7. People Movement Signals ──
// Detect contact status changes, role changes, champion departures

export async function extractPeopleMovementSignals(
  companyId: string
): Promise<InternalMemoryItem[]> {
  const items: InternalMemoryItem[] = []

  // Recent contact status changes (promotions, departures detected via status)
  const recentContacts = await db.contact.findMany({
    where: { companyId, status: { not: 'archived' } },
    select: {
      id: true,
      rawName: true,
      title: true,
      role: true,
      email: true,
      status: true,
      updatedAt: true,
      lastContactedAt: true,
      leadScore: true,
      engagementScore: true,
      companyFitScore: true,
      assignedTo: true,
      linkedinUrl: true,
      phone: true,
      location: true,
      enrichmentData: true,
      _count: { select: { replies: true, events: true, notes: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  })

  for (const contact of recentContacts) {
    const daysSinceUpdate = Math.floor((Date.now() - contact.updatedAt.getTime()) / 86400000)

    // Detect high-value contacts with recent activity
    if (contact.leadScore >= 60 && daysSinceUpdate <= 30) {
      const roleChange = detectRoleChange(contact as any)
      if (roleChange) {
        items.push({
          source: 'person_change',
          companyId,
          content: roleChange.content,
          summary: roleChange.summary,
          signalDate: contact.updatedAt,
          category: 'Leadership',
          metadata: {
            contactId: contact.id,
            contactName: contact.rawName,
            changeType: roleChange.changeType,
            oldRole: roleChange.oldRole,
            newRole: roleChange.newRole,
          },
        })
      }
    }

    // Detect potential champion departure (high engagement → sudden silence)
    if (contact._count.replies >= 2 && contact.engagementScore >= 50) {
      const daysSinceLastContact = contact.lastContactedAt
        ? Math.floor((Date.now() - new Date(contact.lastContactedAt).getTime()) / 86400000)
        : 999

      if (daysSinceLastContact > 45) {
        items.push({
          source: 'person_change',
          companyId,
          content: `CHAMPION AT RISK: ${contact.rawName} (${contact.title}) was actively engaged (${contact._count.replies} replies) but has been silent for ${daysSinceLastContact} days. May have changed roles, left the company, or lost interest.`,
          summary: `Champion risk: ${contact.rawName} — ${daysSinceLastContact} days silent after ${contact._count.replies} replies`,
          signalDate: contact.lastContactedAt || undefined,
          category: 'Stakeholders',
          metadata: {
            contactId: contact.id,
            contactName: contact.rawName,
            changeType: 'champion_silence',
            replyCount: contact._count.replies,
            daysSilent: daysSinceLastContact,
          },
        })
      }
    }

    // Detect new high-value contact (recently added, high fit score)
    if (contact.companyFitScore >= 70 && daysSinceUpdate <= 14) {
      items.push({
        source: 'person_change',
        companyId,
        content: `NEW STAKEHOLDER: ${contact.rawName} (${contact.title || 'Unknown title'}) added to account. Company fit score: ${contact.companyFitScore}/100. ${contact.linkedinUrl ? 'LinkedIn profile available.' : 'No LinkedIn profile yet — needs enrichment.'}`,
        summary: `New contact: ${contact.rawName} (${contact.title}) — fit score ${contact.companyFitScore}`,
        signalDate: contact.updatedAt,
        category: 'Stakeholders',
        metadata: {
          contactId: contact.id,
          contactName: contact.rawName,
          changeType: 'new_contact',
          companyFitScore: contact.companyFitScore,
        },
      })
    }
  }

  return items
}

// ── Intelligence Builders ──

function buildCompanyNoteIntelligence(note: {
  title: string
  body: string
  category: string
  author: string | null
  pinned: boolean
  updatedAt: Date
}): { content: string; summary: string } {
  const daysAgo = Math.floor((Date.now() - note.updatedAt.getTime()) / 86400000)
  const recency = daysAgo <= 7 ? 'RECENT' : daysAgo <= 30 ? 'This month' : 'Historical'
  const pinFlag = note.pinned ? ' [PINNED]' : ''

  return {
    content: `[SALES NOTE${pinFlag} — ${note.category.toUpperCase()} — ${recency}] ${note.title}\n${note.body}\n\nBy: ${note.author || 'Unknown'} | Updated: ${daysAgo} days ago`,
    summary: `${recency} ${note.category} note: ${note.title}`,
  }
}

function buildContactIntelligence(contact: {
  id: string
  rawName: string
  title: string | null
  role: string | null
  email: string
  status: string
  leadScore: number
  engagementScore: number
  lastContactedAt: Date | null
  companyFitScore: number
  _count: { replies: number; events: number }
  notes: Array<{ body: string; updatedAt: Date }>
}): { content: string; summary: string } | null {
  // Only build intelligence for contacts with meaningful data
  const hasActivity = contact._count.replies > 0 || contact.engagementScore > 0 || contact.leadScore > 30
  if (!hasActivity) return null

  const daysSince = contact.lastContactedAt
    ? Math.floor((Date.now() - new Date(contact.lastContactedAt).getTime()) / 86400000)
    : null

  const content = [
    `CONTACT: ${contact.rawName} (${contact.title || 'No title'})`,
    `Status: ${contact.status} | Lead Score: ${contact.leadScore}/100 | Engagement: ${contact.engagementScore}/100`,
    `Company Fit: ${contact.companyFitScore}/100`,
    contact._count.replies > 0 ? `Replies: ${contact._count.replies}` : null,
    daysSince !== null ? `Last Contacted: ${daysSince} days ago` : 'Never contacted',
  ].filter(Boolean).join('\n')

  return {
    content,
    summary: `${contact.rawName} (${contact.title}) — score ${contact.leadScore}, ${contact._count.replies} replies, fit ${contact.companyFitScore}`,
  }
}

interface EmailSummary {
  content: string
  summary: string
  latestDate?: Date
  replyCount: number
  bounceCount: number
  openCount: number
  activeContacts: number
}

function buildEmailEngagementSignal(events: Array<{
  eventType: string
  createdAt: Date
  contact: { rawName: string; title: string | null; email: string }
}>): EmailSummary | null {
  if (events.length === 0) return null

  const replies: typeof events = []
  const bounces: typeof events = []
  const opens: typeof events = []

  for (const e of events) {
    if (e.eventType === 'reply') replies.push(e)
    else if (e.eventType === 'bounce') bounces.push(e)
    else if (e.eventType === 'open') opens.push(e)
  }

  const uniqueContacts = new Set(events.map(e => e.contact.email))
  const latestDate = events[0]?.createdAt

  // Engagement assessment
  let engagementLevel = 'low'
  if (replies.length >= 5) engagementLevel = 'high'
  else if (replies.length >= 2) engagementLevel = 'moderate'
  else if (replies.length >= 1 || opens.length >= 5) engagementLevel = 'low'
  else if (bounces.length > 0) engagementLevel = 'at_risk'

  let riskFlag = ''
  if (bounces.length > 0) {
    const bounceContacts = [...new Set(bounces.map(b => b.contact.rawName))]
    riskFlag = `\n⚠️ BOUNCES: ${bounces.length} bounce(s) from: ${bounceContacts.join(', ')}`
  }

  const topRepliers = replies
    .reduce<Record<string, number>>((acc, r) => {
      acc[r.contact.rawName] = (acc[r.contact.rawName] || 0) + 1
      return acc
    }, {})
  const topReplierList = Object.entries(topRepliers)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => `  - ${name}: ${count} reply(ies)`)
    .join('\n')

  return {
    content: `EMAIL ENGAGEMENT (last 90 days): ${engagementLevel.toUpperCase()}\n` +
      `Total Events: ${events.length} | Replies: ${replies.length} | Opens: ${opens.length} | Bounces: ${bounces.length}\n` +
      `Active Contacts: ${uniqueContacts.size}${riskFlag}` +
      (topReplierList ? `\n\nTop Responders:\n${topReplierList}` : ''),
    summary: `Email engagement: ${engagementLevel} (${replies.length} replies, ${uniqueContacts.size} contacts, ${bounces.length} bounces in 90 days)`,
    latestDate: latestDate || undefined,
    replyCount: replies.length,
    bounceCount: bounces.length,
    openCount: opens.length,
    activeContacts: uniqueContacts.size,
  }
}

function buildTimelineEventIntelligence(event: {
  eventType: string
  title: string
  description: string | null
  createdAt: Date
}): { content: string; summary: string } {
  return {
    content: `[TIMELINE: ${event.eventType}] ${event.title}${event.description ? '\n' + event.description : ''}`,
    summary: `${event.eventType}: ${event.title}`,
  }
}

function buildAccountStrategyIntelligence(strategy: {
  title: string
  objective: string | null
  currentSituation: string | null
  swotAnalysis: string | null
  keyInitiatives: string | null
  stakeholderMap: string | null
  competitivePosition: string | null
  nextSteps: string | null
  status: string
}): { content: string; summary: string } {
  const parts = [`ACCOUNT STRATEGY: ${strategy.title} [${strategy.status.toUpperCase()}]`]

  if (strategy.objective) parts.push(`Objective: ${strategy.objective}`)
  if (strategy.currentSituation) parts.push(`Current Situation: ${strategy.currentSituation}`)

  // Parse SWOT
  if (strategy.swotAnalysis) {
    const swot = tryParseJSON(strategy.swotAnalysis) as Record<string, unknown> | null
    if (swot) {
      if (swot.strengths) parts.push(`Strengths: ${String(swot.strengths).substring(0, 200)}`)
      if (swot.weaknesses) parts.push(`Weaknesses: ${String(swot.weaknesses).substring(0, 200)}`)
      if (swot.opportunities) parts.push(`Opportunities: ${String(swot.opportunities).substring(0, 200)}`)
      if (swot.threats) parts.push(`Threats: ${String(swot.threats).substring(0, 200)}`)
    }
  }

  // Parse stakeholders
  if (strategy.stakeholderMap) {
    const map = tryParseJSON(strategy.stakeholderMap) as Record<string, unknown> | null
    if (map) {
      const roles = ['champions', 'influencers', 'blockers', 'decisionMakers']
      for (const role of roles) {
        if (map[role]) parts.push(`${role}: ${String(map[role]).substring(0, 150)}`)
      }
    }
  }

  if (strategy.nextSteps) parts.push(`Next Steps: ${strategy.nextSteps}`)

  return {
    content: parts.join('\n\n'),
    summary: `Account strategy "${strategy.title}" (${strategy.status}): ${strategy.objective || 'No objective'}`,
  }
}

// ── People Movement Detection ──

function detectRoleChange(contact: {
  title: string | null
  role: string | null
  enrichmentData: string | null
  rawName: string
}): { content: string; summary: string; changeType: string; oldRole: string | null; newRole: string | null } | null {
  // Check enrichment data for role history
  if (!contact.enrichmentData) return null

  const enrichment = tryParseJSON(contact.enrichmentData) as Record<string, unknown> | null
  if (!enrichment) return null

  const currentRole = contact.title || contact.role || 'Unknown'
  const previousRole = enrichment.previousTitle as string | undefined

  if (previousRole && previousRole !== currentRole) {
    return {
      content: `ROLE CHANGE DETECTED: ${contact.rawName} changed from "${previousRole}" to "${currentRole}". This may indicate new responsibilities, expanded scope, or a promotion that shifts buying authority.`,
      summary: `${contact.rawName}: "${previousRole}" → "${currentRole}"`,
      changeType: 'role_change',
      oldRole: previousRole,
      newRole: currentRole,
    }
  }

  return null
}

// ── Category Mapping ──

function noteCategoryToKnowledge(category: string): string {
  const map: Record<string, string> = {
    research: 'Strategy',
    call: 'Conversations',
    meeting: 'Conversations',
    general: 'Strategy',
    swot: 'Competitors',
    competitive: 'Competitors',
    discovery: 'Opportunities',
  }
  return map[category] || 'Strategy'
}

function timelineEventToKnowledge(eventType: string): string {
  const map: Record<string, string> = {
    email_sent: 'Conversations',
    email_opened: 'Conversations',
    email_replied: 'Conversations',
    email_bounced: 'Conversations',
    note_added: 'Strategy',
    enrichment: 'Technology',
    status_change: 'Strategy',
    signal: 'Strategy',
    contact_added: 'Stakeholders',
    research_saved: 'Strategy',
  }
  return map[eventType] || 'Strategy'
}

// ── Convert Internal Memory to RawIntelligenceObject ──

export function internalMemoryToIntelligenceObjects(
  items: InternalMemoryItem[],
  companyName: string
): RawIntelligenceObject[] {
  return items.map(item => ({
    companyIdentifier: companyName,
    content: item.content,
    summary: item.summary,
    sourceUrl: undefined,
    capturedAt: item.signalDate || new Date(),
    category: item.category,
    metadata: {
      ...item.metadata,
      internalMemorySource: item.source,
      internalMemoryConfidence: item.confidence || MEMORY_SOURCE_CONFIDENCE[item.source],
    },
  }))
}

// ═══════════════════════════════════════════════════════════════
// BRIDGE EXPORTS: Used by sprint3 route, unified route, etc.
// ═══════════════════════════════════════════════════════════════

export interface InternalMemorySignal {
  signal: string
  signalType: string
  evidence: string
  sourceName: string
  confidence: number
  businessImpact: string
  recommendedAction: string
  timing: 'immediate' | 'within_7_days' | 'within_30_days' | 'within_90_days' | 'ongoing'
  severity: 'low' | 'medium' | 'high' | 'critical'
  signalDate?: Date
}

export interface InternalMemoryResult {
  signalsExtracted: number
  signalsPersisted: number
  sources: Record<string, number>
  signals: InternalMemorySignal[]
}

export interface MemoryDepthResult {
  score: number    // 0-100
  grade: string   // A, B, C, D, F
  breakdown: Record<string, { available: number; total: number; score: number }>
}

/**
 * Extract internal memory for a company and persist as CompanySignal records.
 * This is the function called by /api/intelligence/internal-memory and /api/intelligence/sprint3.
 */
export async function extractInternalMemorySignals(
  companyId: string
): Promise<InternalMemoryResult> {
  const company = await db.company.findUnique({ where: { id: companyId }, select: { rawName: true } })
  if (!company) throw new Error(`Company ${companyId} not found`)

  // Extract internal memory items
  const { items, sourceBreakdown } = await extractInternalMemory(companyId)

  // Also extract people movement signals
  const peopleItems = await extractPeopleMovementSignals(companyId)
  const allItems = [...items, ...peopleItems]

  // Convert to signal inputs and persist
  const signals: InternalMemorySignal[] = []
  let signalsPersisted = 0

  for (const item of allItems) {
    const conf = item.confidence || MEMORY_SOURCE_CONFIDENCE[item.source]
    const signalType = item.metadata?.signalType as string | undefined
      || (item.source === 'person_change' ? 'people_change' : 'internal_memory')

    signals.push({
      signal: item.summary || item.content.substring(0, 200),
      signalType,
      evidence: item.content.substring(0, 1000),
      sourceName: `internal:${item.source}`,
      confidence: Math.round(conf * 100),
      businessImpact: `Internal memory signal from ${item.source}`,
      recommendedAction: 'Review internal intelligence and incorporate into account strategy',
      timing: 'within_30_days',
      severity: 'medium',
      signalDate: item.signalDate,
    })

    // Persist to DB
    try {
      const result = await createSignalFromIntelligenceObject({
        companyId,
        signal: item.summary || item.content.substring(0, 200),
        evidence: item.content.substring(0, 1000),
        sourceName: `internal:${item.source}`,
        confidence: Math.round(conf * 100),
        businessImpact: `Internal memory signal from ${item.source}`,
        recommendedAction: 'Review internal intelligence and incorporate into account strategy',
        timing: 'within_30_days',
        severity: 'medium',
        signalType,
        signalDate: item.signalDate || null,
      })
      if (result.success) signalsPersisted++
    } catch (err) {
      console.warn(`[internal-memory] Failed to persist signal:`, err)
    }
  }

  // Merge source breakdowns
  const mergedBreakdown = { ...sourceBreakdown }
  for (const pi of peopleItems) {
    mergedBreakdown.person_change = (mergedBreakdown.person_change || 0) + 1
  }

  return {
    signalsExtracted: allItems.length,
    signalsPersisted,
    sources: mergedBreakdown,
    signals,
  }
}

/**
 * Compute the "depth" of internal memory for a company.
 * Measures how rich the CRM data is — the backbone of the small-company intelligence strategy.
 */
export async function computeInternalMemoryDepth(companyId: string): Promise<MemoryDepthResult> {
  const [notes, contactNotes, strategies, researchCard, humanIntel, timeline, contacts] = await Promise.all([
    db.companyNote.count({ where: { companyId } }),
    db.contactNote.count({ where: { contact: { companyId } } }),
    db.accountStrategy.count({ where: { companyId, status: { not: 'archived' } } }),
    db.companyResearchCard.findUnique({ where: { companyId } }),
    db.humanIntelligenceInbox.count({ where: { companyId, status: { not: 'rejected' } } }),
    db.companyTimelineEvent.count({ where: { companyId } }),
    db.contact.count({ where: { companyId, status: { not: 'archived' } } }),
  ])

  // Depth scoring: each source contributes to total depth
  const breakdown: MemoryDepthResult['breakdown'] = {
    company_notes: {
      available: notes,
      total: 10,
      score: Math.min(100, notes >= 10 ? 100 : notes >= 5 ? 80 : notes >= 2 ? 50 : notes >= 1 ? 20 : 0),
    },
    contact_notes: {
      available: contactNotes,
      total: 10,
      score: Math.min(100, contactNotes >= 5 ? 100 : contactNotes >= 2 ? 60 : contactNotes >= 1 ? 25 : 0),
    },
    account_strategy: {
      available: strategies,
      total: 2,
      score: strategies >= 1 ? 100 : 0,
    },
    research_card: {
      available: researchCard ? 1 : 0,
      total: 1,
      score: researchCard ? 100 : 0,
    },
    human_intelligence: {
      available: humanIntel,
      total: 3,
      score: humanIntel >= 2 ? 100 : humanIntel >= 1 ? 60 : 0,
    },
    timeline_events: {
      available: timeline,
      total: 20,
      score: Math.min(100, timeline >= 20 ? 100 : timeline >= 10 ? 80 : timeline >= 5 ? 50 : timeline >= 1 ? 15 : 0),
    },
    contacts: {
      available: contacts,
      total: 10,
      score: Math.min(100, contacts >= 10 ? 100 : contacts >= 5 ? 80 : contacts >= 2 ? 50 : contacts >= 1 ? 20 : 0),
    },
  }

  // Weighted score: notes + contacts are most valuable
  const score = Math.round(
    (breakdown.company_notes.score * 0.20) +
    (breakdown.contact_notes.score * 0.15) +
    (breakdown.account_strategy.score * 0.15) +
    (breakdown.research_card.score * 0.10) +
    (breakdown.human_intelligence.score * 0.10) +
    (breakdown.timeline_events.score * 0.10) +
    (breakdown.contacts.score * 0.20)
  )

  const grade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : score >= 20 ? 'D' : 'F'

  return { score, grade, breakdown }
}

// ── Utility ──

function tryParseJSON(val: unknown): unknown {
  if (!val) return null
  try {
    if (typeof val === 'string') return JSON.parse(val)
    return val
  } catch {
    return null
  }
}
