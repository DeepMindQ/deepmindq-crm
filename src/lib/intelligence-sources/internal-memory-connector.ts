/**
 * Internal Memory Connector — Sprint 3A
 *
 * Converts internal CRM data (notes, timeline events, meeting records,
 * human intelligence submissions) into the same IntelligenceObject format
 * that external sources produce. This ensures the Action Engine treats
 * internal memory as a first-class intelligence source.
 *
 * Why this matters:
 *   - Small companies (<200 employees) often have ZERO external signals
 *   - The strongest intelligence for SMBs comes from CRM history:
 *     meeting notes, sales observations, email interactions, past deals
 *   - Without this connector, Action Engine says "no signals found"
 *   - With it, Action Engine sees internal memory equally alongside web search
 *
 * Signal types produced:
 *   - internal_note       — Sales observations, call notes, general CRM notes
 *   - internal_meeting    — Meeting records with outcomes and action items
 *   - internal_interaction — Email replies, engagement signals
 *   - internal_human_intel — Human-submitted intelligence from inbox
 *   - people_change        — Contact role changes, status changes, new hires
 *   - relationship_shift   — Champion left, new contact, engagement change
 *
 * Architecture:
 *   CRM Data → InternalMemoryConnector → IntelligenceObject → Evidence → CompanySignal
 *   (same pipeline as external sources, just different origin)
 */

import { db } from '@/lib/db'

// ─── Types ──────────────────────────────────────────────────────

export interface InternalMemorySignal {
  signalType: string
  title: string
  description: string
  source: string
  confidence: number
  businessImpact: string
  recommendedAction: string
  timing: string
  severity: string
  metadata?: Record<string, unknown>
  sourceDate?: Date
}

export interface InternalMemoryResult {
  companyId: string
  companyName: string
  signalsExtracted: number
  signalsBySource: Record<string, number>
  signals: InternalMemorySignal[]
  // Raw data counts for context
  companyNotesCount: number
  contactNotesCount: number
  timelineEventsCount: number
  humanIntelligenceCount: number
  contactChangesCount: number
  processedAt: string
}

interface ContactChange {
  contactId: string
  name: string
  oldTitle?: string
  newTitle?: string
  oldStatus?: string
  newStatus?: string
  changeType: 'title_change' | 'status_change' | 'role_change' | 'seniority_change'
  detectedAt: Date
  daysSinceChange: number
}

// ─── Source Type Registration ──────────────────────────────────
// These types are recognized by the broader intelligence pipeline

export const INTERNAL_SOURCE_TYPES = [
  'internal_note',
  'internal_meeting',
  'internal_interaction',
  'internal_human_intel',
  'people_change',
  'relationship_shift',
] as const

// ─── Company Note Mining ────────────────────────────────────────

/**
 * Mine company notes for actionable intelligence signals.
 * Categories: research, call, meeting, general, swot, competitive, discovery
 */
function extractSignalsFromCompanyNotes(
  companyId: string,
  companyName: string,
  notes: Array<{ id: string; title: string; category: string; body: string; createdAt: Date; author?: string | null }>
): InternalMemorySignal[] {
  const signals: InternalMemorySignal[] = []

  for (const note of notes) {
    const body = note.body || ''
    const category = note.category || 'general'

    // Skip very short notes — unlikely to contain meaningful intelligence
    if (body.length < 30) continue

    // Classify signal type from note category and content
    const signalType = classifyNoteCategory(category, body)

    // Extract business impact keywords
    const impact = extractBusinessImpact(body)
    const action = extractRecommendedAction(body, category)

    signals.push({
      signalType,
      title: `${note.title || `${category} note`}: ${body.substring(0, 80).trim()}`,
      description: body.substring(0, 500),
      source: `internal_note:${category}`,
      confidence: calculateNoteConfidence(body, category, note.createdAt),
      businessImpact: impact,
      recommendedAction: action,
      timing: inferTimingFromNote(category, body),
      severity: inferSeverityFromContent(body),
      metadata: {
        noteId: note.id,
        category,
        author: note.author || 'unknown',
        noteLength: body.length,
        companyName,
      },
      sourceDate: note.createdAt,
    })
  }

  return signals
}

function classifyNoteCategory(category: string, body: string): string {
  const lower = body.toLowerCase()

  if (category === 'meeting') return 'internal_meeting'
  if (category === 'call') return 'internal_interaction'
  if (category === 'discovery') {
    // Discovery notes often reveal buying signals
    if (/budget|timeline|decision|authority|need/i.test(lower)) return 'internal_note'
    if (/security|compliance|migration|cloud|infrastructure/i.test(lower)) return 'tech_change'
  }
  if (category === 'competitive') {
    if (/competitor|vendor|alternative/i.test(lower)) return 'partnership'
  }
  if (category === 'swot') return 'internal_note'

  // Content-based classification
  if (/champion left|contact changed|new hire|joined from|promoted/i.test(lower)) return 'people_change'
  if (/security concern|compliance issue|risk/i.test(lower)) return 'internal_note'
  if (/budget|pricing|cost|revenue|investment/i.test(lower)) return 'funding'
  if (/hiring|recruiting|talent|team growth/i.test(lower)) return 'hiring'
  if (/migration|cloud|aws|azure|kubernetes|docker/i.test(lower)) return 'tech_change'
  if (/partnership|alliance|integration|vendor/i.test(lower)) return 'partnership'

  return 'internal_note'
}

function calculateNoteConfidence(body: string, category: string, createdAt: Date): number {
  let confidence = 0.70 // Base: first-party observation is inherently more reliable than web scraping

  // Longer notes tend to be more substantive
  if (body.length > 500) confidence += 0.10
  else if (body.length > 200) confidence += 0.05

  // Certain categories carry higher confidence
  if (category === 'meeting' || category === 'call') confidence += 0.10
  if (category === 'discovery') confidence += 0.05

  // Recency bonus
  const daysSince = Math.floor((Date.now() - createdAt.getTime()) / 86400000)
  if (daysSince < 7) confidence += 0.05
  else if (daysSince < 30) confidence += 0.02
  else if (daysSince > 180) confidence -= 0.10

  return Math.min(0.98, Math.max(0.30, confidence))
}

function extractBusinessImpact(body: string): string {
  const lower = body.toLowerCase()

  if (/security|breach|compliance|risk/i.test(lower)) return 'Security or compliance concern — potential urgency driver'
  if (/budget|pricing|cost|revenue/i.test(lower)) return 'Financial dimension — budget cycle or pricing sensitivity'
  if (/migration|cloud|infrastructure|technical debt/i.test(lower)) return 'Technology investment signal — modernization or migration need'
  if (/hiring|team growth|expansion|new office/i.test(lower)) return 'Growth indicator — company investing in capabilities'
  if (/champion|sponsor|advocate|supporter/i.test(lower)) return 'Relationship intelligence — champion or sponsor identified'
  if (/competitor|alternative|evaluating/i.test(lower)) return 'Competitive situation — active vendor evaluation likely'
  if (/decision|timeline|quarter|fiscal/i.test(lower)) return 'Buying timeline — decision process or budget cycle intelligence'

  return 'Sales intelligence from internal observation'
}

function extractRecommendedAction(body: string, category: string): string {
  const lower = body.toLowerCase()

  if (category === 'meeting') return 'Follow up on meeting outcomes — confirm next steps and timeline'
  if (category === 'call') return 'Send follow-up email referencing call discussion points'
  if (category === 'discovery') return 'Use discovery insights to tailor proposal or next meeting'

  if (/security|compliance/i.test(lower)) return 'Prepare security-focused conversation with relevant stakeholders'
  if (/budget|pricing/i.test(lower)) return 'Align proposal with detected budget parameters and decision timeline'
  if (/migration|cloud/i.test(lower)) return 'Engage technical stakeholders about migration timeline and requirements'
  if (/champion left|contact changed/i.test(lower)) return 'Rebuild relationship with new contact — share context from previous interactions'
  if (/competitor|evaluating/i.test(lower)) return 'Differentiate from detected competitors — prepare competitive positioning'
  if (/hiring|growth/i.test(lower)) return 'Connect hiring growth to solution value — scaling challenges create opportunity'

  return 'Review and incorporate into account strategy'
}

function inferTimingFromNote(category: string, body: string): string {
  const lower = body.toLowerCase()

  if (/urgent|immediate|asap|this week/i.test(lower)) return 'within_7_days'
  if (/next month|upcoming|q[1-4]|quarter|fiscal/i.test(lower)) return 'within_30_days'
  if (/this year|annual|roadmap|plan/i.test(lower)) return 'within_90_days'
  if (category === 'meeting' || category === 'call') return 'within_7_days'

  return 'within_30_days'
}

function inferSeverityFromContent(body: string): string {
  const lower = body.toLowerCase()

  if (/urgent|critical|blocker|deal breaker|showstopper/i.test(lower)) return 'critical'
  if (/important|significant|major|key|priority/i.test(lower)) return 'high'
  if (/interesting|potential|possible|exploring/i.test(lower)) return 'medium'

  return 'low'
}

// ─── Contact Note Mining ─────────────────────────────────────────

function extractSignalsFromContactNotes(
  companyId: string,
  companyName: string,
  contactNotes: Array<{ id: string; contactId: string; body: string; createdAt: Date; contactName: string; contactTitle?: string | null }>
): InternalMemorySignal[] {
  const signals: InternalMemorySignal[] = []

  for (const note of contactNotes) {
    if (note.body.length < 20) continue

    const body = note.body
    const lower = body.toLowerCase()

    // Detect relationship shifts
    if (/champion|sponsor|advocate|supporter/i.test(lower)) {
      signals.push({
        signalType: 'relationship_shift',
        title: `Champion/sponsor identified: ${note.contactName}`,
        description: `${note.contactName} (${note.contactTitle || 'Unknown role'}): ${body.substring(0, 300)}`,
        source: 'contact_note:champion',
        confidence: 0.80,
        businessImpact: 'Internal champion detected — leverage for deal acceleration',
        recommendedAction: `Nurture relationship with ${note.contactName} — provide ammunition for internal advocacy`,
        timing: 'within_30_days',
        severity: 'high',
        metadata: { contactId: note.contactId, contactName: note.contactName },
        sourceDate: note.createdAt,
      })
    }

    // Detect buying signals from contact conversations
    if (/budget|need|problem|challenge|looking for|interested in|evaluating/i.test(lower)) {
      signals.push({
        signalType: 'internal_interaction',
        title: `Buying signal from ${note.contactName}: ${body.substring(0, 80).trim()}`,
        description: `${note.contactName} (${note.contactTitle || 'Unknown role'}): ${body.substring(0, 400)}`,
        source: 'contact_note:buying_signal',
        confidence: 0.75,
        businessImpact: 'Explicit buying signal detected in contact interaction',
        recommendedAction: `Follow up with ${note.contactName} on detected need — propose specific solution`,
        timing: 'within_7_days',
        severity: 'high',
        metadata: { contactId: note.contactId, contactName: note.contactName },
        sourceDate: note.createdAt,
      })
    }

    // Generic contact intelligence
    if (signals.length === 0 || !/champion|buying|budget/i.test(lower)) {
      signals.push({
        signalType: 'internal_note',
        title: `Contact intelligence: ${note.contactName} — ${body.substring(0, 60).trim()}`,
        description: `${note.contactName} (${note.contactTitle || 'Unknown role'}): ${body.substring(0, 300)}`,
        source: 'contact_note:general',
        confidence: 0.65,
        businessImpact: 'Contact-level intelligence from direct interaction',
        recommendedAction: `Reference this intelligence in next interaction with ${note.contactName}`,
        timing: 'within_30_days',
        severity: 'medium',
        metadata: { contactId: note.contactId, contactName: note.contactName },
        sourceDate: note.createdAt,
      })
    }
  }

  return signals
}

// ─── Timeline Event Mining ──────────────────────────────────────

function extractSignalsFromTimeline(
  companyId: string,
  companyName: string,
  events: Array<{ id: string; eventType: string; title: string; description?: string | null; metadata?: string | null; createdAt: Date }>
): InternalMemorySignal[] {
  const signals: InternalMemorySignal[] = []

  for (const event of events) {
    const type = event.eventType
    const desc = event.description || event.title

    // Email reply = strong engagement signal
    if (type === 'email_replied') {
      signals.push({
        signalType: 'internal_interaction',
        title: `Email engagement: ${desc.substring(0, 80).trim()}`,
        description: desc.substring(0, 300),
        source: 'timeline:email_replied',
        confidence: 0.85,
        businessImpact: 'Active email engagement — contact is responsive and interested',
        recommendedAction: 'Continue conversation thread — capitalize on engagement momentum',
        timing: 'within_7_days',
        severity: 'medium',
        metadata: { eventId: event.id, eventType: type },
        sourceDate: event.createdAt,
      })
    }

    // New contact added = expansion signal
    if (type === 'contact_added') {
      signals.push({
        signalType: 'relationship_shift',
        title: `New contact identified: ${desc.substring(0, 80).trim()}`,
        description: desc.substring(0, 300),
        source: 'timeline:contact_added',
        confidence: 0.80,
        businessImpact: 'Stakeholder expansion — new contact added to account',
        recommendedAction: 'Engage new contact to expand relationship footprint',
        timing: 'within_30_days',
        severity: 'medium',
        metadata: { eventId: event.id, eventType: type },
        sourceDate: event.createdAt,
      })
    }

    // Research saved = active interest
    if (type === 'research_saved') {
      signals.push({
        signalType: 'internal_note',
        title: `Research activity: ${desc.substring(0, 80).trim()}`,
        description: desc.substring(0, 300),
        source: 'timeline:research_saved',
        confidence: 0.75,
        businessImpact: 'Active research being conducted on this account',
        recommendedAction: 'Review research findings and incorporate into account strategy',
        timing: 'within_30_days',
        severity: 'medium',
        metadata: { eventId: event.id },
        sourceDate: event.createdAt,
      })
    }

    // Signal detected = external intelligence event
    if (type === 'signal') {
      signals.push({
        signalType: 'internal_note',
        title: `Intelligence signal recorded: ${desc.substring(0, 80).trim()}`,
        description: desc.substring(0, 300),
        source: 'timeline:signal',
        confidence: 0.70,
        businessImpact: 'Intelligence signal captured in account timeline',
        recommendedAction: 'Review signal details and determine follow-up action',
        timing: 'within_30_days',
        severity: 'medium',
        metadata: { eventId: event.id },
        sourceDate: event.createdAt,
      })
    }

    // Status change = lifecycle movement
    if (type === 'status_change' || type === 'enrichment') {
      signals.push({
        signalType: 'internal_interaction',
        title: `Account status update: ${desc.substring(0, 80).trim()}`,
        description: desc.substring(0, 300),
        source: `timeline:${type}`,
        confidence: 0.70,
        businessImpact: 'Account status has changed — review implications for engagement',
        recommendedAction: 'Update engagement strategy based on new status',
        timing: 'within_30_days',
        severity: 'medium',
        metadata: { eventId: event.id },
        sourceDate: event.createdAt,
      })
    }
  }

  return signals
}

// ─── Human Intelligence Mining ──────────────────────────────────

function extractSignalsFromHumanIntel(
  companyId: string,
  companyName: string,
  submissions: Array<{ id: string; content: string; summary?: string | null; category?: string | null; priority: string; source: string; status: string; createdAt: Date; submittedBy: string }>
): InternalMemorySignal[] {
  const signals: InternalMemorySignal[] = []

  for (const sub of submissions) {
    if (sub.status === 'rejected') continue
    if (sub.content.length < 20) continue

    signals.push({
      signalType: 'internal_human_intel',
      title: sub.summary || sub.content.substring(0, 80).trim(),
      description: sub.content.substring(0, 500),
      source: `human_intelligence:${sub.source}:${sub.submittedBy}`,
      confidence: sub.priority === 'critical' ? 0.90 : sub.priority === 'high' ? 0.85 : 0.75,
      businessImpact: 'Human-submitted intelligence — first-hand observation or expert assessment',
      recommendedAction: 'Incorporate into account intelligence and validate with other sources',
      timing: 'within_30_days',
      severity: sub.priority === 'critical' ? 'critical' : sub.priority === 'high' ? 'high' : 'medium',
      metadata: {
        humanIntelId: sub.id,
        category: sub.category,
        priority: sub.priority,
        submittedBy: sub.submittedBy,
      },
      sourceDate: sub.createdAt,
    })
  }

  return signals
}

// ─── Contact Change Detection ────────────────────────────────────

/**
 * Detect contact changes that signal people movement.
 * This is the "LinkedIn-like" intelligence from CRM data:
 *   - Title changes (promotion, role shift)
 *   - Status changes (left company, became unresponsive)
 *   - Seniority changes (promotion detection)
 */
function detectContactChanges(
  companyId: string,
  contacts: Array<{ id: string; rawName: string; title: string | null; role: string | null; status: string; updatedAt: Date; enrichmentData?: string | null }>
): { changes: ContactChange[]; signals: InternalMemorySignal[] } {
  const changes: ContactChange[] = []
  const signals: InternalMemorySignal[] = []

  for (const contact of contacts) {
    let enrichmentData: Record<string, unknown> = {}
    try {
      enrichmentData = contact.enrichmentData ? JSON.parse(contact.enrichmentData) : {}
    } catch { /* ignore */ }

    const previousTitle = enrichmentData.previousTitle as string | undefined
    const previousStatus = enrichmentData.previousStatus as string | undefined
    const currentTitle = contact.title || contact.role || ''
    const currentStatus = contact.status
    const daysSinceUpdate = Math.floor((Date.now() - contact.updatedAt.getTime()) / 86400000)

    // Detect title changes (promotion or role shift)
    if (previousTitle && currentTitle && previousTitle !== currentTitle && daysSinceUpdate <= 90) {
      const changeType: ContactChange['changeType'] = detectChangeType(previousTitle, currentTitle)

      changes.push({
        contactId: contact.id,
        name: contact.rawName,
        oldTitle: previousTitle,
        newTitle: currentTitle,
        changeType,
        detectedAt: contact.updatedAt,
        daysSinceChange: daysSinceUpdate,
      })

      if (changeType === 'seniority_change') {
        signals.push({
          signalType: 'people_change',
          title: `Promotion detected: ${contact.rawName} — ${previousTitle} → ${currentTitle}`,
          description: `${contact.rawName} was promoted from ${previousTitle} to ${currentTitle} (${daysSinceUpdate} days ago). This suggests increased influence and potential buying authority change.`,
          source: 'contact_change:promotion',
          confidence: 0.85,
          businessImpact: 'Contact promoted — may now have more buying authority or different priorities',
          recommendedAction: `Re-engage ${contact.rawName} with messaging appropriate for ${currentTitle} role — their priorities may have shifted`,
          timing: 'within_14_days',
          severity: 'high',
          metadata: {
            contactId: contact.id,
            changeType: 'promotion',
            oldTitle: previousTitle,
            newTitle: currentTitle,
          },
        })
      } else {
        signals.push({
          signalType: 'people_change',
          title: `Role change: ${contact.rawName} — ${previousTitle} → ${currentTitle}`,
          description: `${contact.rawName} changed roles from ${previousTitle} to ${currentTitle} (${daysSinceUpdate} days ago).`,
          source: 'contact_change:role',
          confidence: 0.80,
          businessImpact: 'Contact role changed — reassess buying influence and engagement strategy',
          recommendedAction: `Update relationship strategy for ${contact.rawName} — new role may indicate different priorities`,
          timing: 'within_30_days',
          severity: 'medium',
          metadata: {
            contactId: contact.id,
            changeType: 'role_change',
            oldTitle: previousTitle,
            newTitle: currentTitle,
          },
        })
      }
    }

    // Detect status changes (contact went cold, bounced, etc.)
    if (previousStatus && previousStatus !== currentStatus && daysSinceUpdate <= 90) {
      if (currentStatus === 'bounced' || currentStatus === 'suppressed') {
        signals.push({
          signalType: 'relationship_shift',
          title: `Contact unreachable: ${contact.rawName} — status changed to ${currentStatus}`,
          description: `${contact.rawName}'s contact status changed from ${previousStatus} to ${currentStatus}. Communication channel may be broken.`,
          source: 'contact_change:status',
          confidence: 0.80,
          businessImpact: `Contact channel disrupted — ${currentStatus === 'bounced' ? 'email bouncing' : 'contact suppressed'}`,
          recommendedAction: `Find alternative contact channel for ${contact.rawName} or identify backup contact in same department`,
          timing: 'within_7_days',
          severity: 'medium',
          metadata: { contactId: contact.id, oldStatus: previousStatus, newStatus: currentStatus },
        })
      }
    }
  }

  return { changes, signals }
}

function detectChangeType(oldTitle: string, newTitle: string): ContactChange['changeType'] {
  const seniorityOrder = [
    'analyst', 'associate', 'coordinator', 'specialist', 'representative',
    'manager', 'senior manager', 'director', 'senior director', 'head',
    'vp', 'svp', 'evp', 'c-level', 'cso', 'cto', 'cfo', 'cio', 'coo', 'ceo', 'president', 'founder',
  ]

  const oldLevel = seniorityOrder.findIndex(s => oldTitle.toLowerCase().includes(s))
  const newLevel = seniorityOrder.findIndex(s => newTitle.toLowerCase().includes(s))

  if (oldLevel >= 0 && newLevel >= 0 && newLevel > oldLevel) return 'seniority_change'
  if (oldLevel >= 0 && newLevel >= 0 && newLevel < oldLevel) return 'seniority_change' // lateral move
  return 'title_change'
}

// ─── Main Connector Function ────────────────────────────────────

/**
 * Extract all internal memory signals for a company.
 * This is the primary entry point for the Internal Memory Connector.
 *
 * Returns structured signals from:
 *   1. Company notes (meeting, call, discovery, research, swot, competitive)
 *   2. Contact notes (champion detection, buying signals)
 *   3. Timeline events (email replies, contact additions, status changes)
 *   4. Human intelligence inbox (approved submissions)
 *   5. Contact changes (promotions, role shifts, status changes)
 *
 * Each signal is formatted identically to external CompanySignals so the
 * Action Engine treats them as equivalent intelligence.
 */
export async function extractInternalMemorySignals(companyId: string): Promise<InternalMemoryResult> {
  const startMs = Date.now()

  // Fetch company
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { id: true, rawName: true, normalizedName: true },
  })

  if (!company) throw new Error(`Company ${companyId} not found`)

  const companyName = company.normalizedName || company.rawName

  // Parallel data fetch from all internal sources
  const [
    companyNotes,
    contactNotesData,
    timelineEvents,
    humanIntel,
    contacts,
  ] = await Promise.all([
    // 1. Company notes
    db.companyNote.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        category: true,
        body: true,
        createdAt: true,
        author: true,
      },
    }),

    // 2. Contact notes (with contact info)
    db.contactNote.findMany({
      where: {
        contact: { companyId },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        contactId: true,
        body: true,
        createdAt: true,
        contact: {
          select: { rawName: true, title: true },
        },
      },
    }),

    // 3. Timeline events
    db.companyTimelineEvent.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true,
        eventType: true,
        title: true,
        description: true,
        metadata: true,
        createdAt: true,
      },
    }),

    // 4. Human intelligence submissions
    db.humanIntelligenceInbox.findMany({
      where: {
        companyId,
        status: { in: ['pending', 'reviewed', 'approved', 'converted'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        content: true,
        summary: true,
        category: true,
        priority: true,
        source: true,
        status: true,
        createdAt: true,
        submittedBy: true,
      },
    }),

    // 5. Contacts (for change detection)
    db.contact.findMany({
      where: { companyId, status: { not: 'archived' } },
      select: {
        id: true,
        rawName: true,
        title: true,
        role: true,
        status: true,
        updatedAt: true,
        enrichmentData: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 30,
    }),
  ])

  // Extract signals from each source
  const noteSignals = extractSignalsFromCompanyNotes(companyId, companyName, companyNotes)
  const contactNoteSignals = extractSignalsFromContactNotes(
    companyId,
    companyName,
    contactNotesData.map(cn => ({
      ...cn,
      contactName: cn.contact.rawName,
      contactTitle: cn.contact.title,
    })),
  )
  const timelineSignals = extractSignalsFromTimeline(companyId, companyName, timelineEvents)
  const humanSignals = extractSignalsFromHumanIntel(companyId, companyName, humanIntel)
  const { signals: changeSignals, changes } = detectContactChanges(companyId, contacts)

  // Combine and deduplicate
  const allSignals = [...noteSignals, ...contactNoteSignals, ...timelineSignals, ...humanSignals, ...changeSignals]

  // Sort by confidence descending
  allSignals.sort((a, b) => b.confidence - a.confidence)

  // Count by source
  const signalsBySource: Record<string, number> = {}
  for (const s of allSignals) {
    const source = s.source.split(':')[0]
    signalsBySource[source] = (signalsBySource[source] || 0) + 1
  }

  return {
    companyId,
    companyName,
    signalsExtracted: allSignals.length,
    signalsBySource,
    signals: allSignals,
    companyNotesCount: companyNotes.length,
    contactNotesCount: contactNotesData.length,
    timelineEventsCount: timelineEvents.length,
    humanIntelligenceCount: humanIntel.length,
    contactChangesCount: changes.length,
    processedAt: new Date().toISOString(),
  }
}

// ─── Persist Internal Memory as Signals ─────────────────────────

/**
 * Optionally persist internal memory signals as CompanySignals.
 * This bridges the internal memory connector to the Sprint 1/2 pipeline
 * so that the Action Engine sees them through the standard signal path.
 */
export async function persistInternalSignalsAsCompanySignals(
  companyId: string,
  signals: InternalMemorySignal[]
): Promise<{ created: number; skipped: number; failed: number }> {
  const { createSignalFromIntelligenceObject } = await import('./signal-creator')

  let created = 0
  let skipped = 0
  let failed = 0

  for (const sig of signals.slice(0, 20)) { // Cap at 20 to avoid flooding
    try {
      // Check for existing signal with similar title
      const existing = await db.companySignal.findFirst({
        where: {
          companyId,
          title: { startsWith: sig.title.substring(0, 60) },
          status: { in: ['detected', 'validated', 'active'] },
        },
      })

      if (existing) {
        skipped++
        continue
      }

      const result = await createSignalFromIntelligenceObject({
        companyId,
        signal: sig.title,
        evidence: sig.description,
        sourceName: sig.source,
        confidence: Math.round(sig.confidence * 100),
        businessImpact: sig.businessImpact,
        recommendedAction: sig.recommendedAction,
        timing: sig.timing as 'immediate' | 'within_7_days' | 'within_30_days' | 'within_90_days' | 'ongoing' | 'expired',
        severity: sig.severity as 'low' | 'medium' | 'high' | 'critical',
        signalType: sig.signalType,
        signalDate: sig.sourceDate,
        sourceReference: `internal-memory:${companyId}`,
      })

      if (result.success) created++
      else failed++
    } catch (err) {
      failed++
    }
  }

  return { created, skipped, failed }
}
