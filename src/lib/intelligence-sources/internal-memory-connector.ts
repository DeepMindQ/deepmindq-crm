/**
 * Sprint 3A: Internal Memory Connector
 *
 * Bridges the CRM's "memory layer" (notes, emails, timeline events, strategies,
 * research cards, human intelligence) into the intelligence pipeline as
 * first-class CompanySignal records.
 *
 * This is what makes DeepMindQ work for small/mid-market companies that have
 * rich internal data but sparse external signals. It turns your CRM into a
 * ChatGPT-style memory layer for accounts.
 *
 * Source → Signal Type Mapping:
 *   CompanyNote          → internal_memory (with category sub-signals)
 *   ContactNote          → people_change / internal_memory
 *   EmailEvent           → people_change (reply-based) / internal_memory
 *   CompanyTimelineEvent  → internal_memory (14 event types)
 *   AccountStrategy      → internal_memory (strategic intelligence)
 *   CompanyResearchCard  → internal_memory (enrichment intel)
 *   HumanIntelligenceInbox → internal_memory (human-sourced)
 */

import { db } from '@/lib/db'
import { createSignalFromIntelligenceObject, classifySignalType } from './signal-creator'

// ── Types ──

export interface InternalMemorySignal {
  signal: string
  signalType: string
  evidence: string
  confidence: number
  businessImpact: string
  recommendedAction: string
  timing: 'immediate' | 'within_7_days' | 'within_30_days' | 'within_90_days' | 'ongoing'
  severity: 'low' | 'medium' | 'high' | 'critical'
  sourceName: string
  signalDate?: Date
}

export interface InternalMemoryResult {
  companyId: string
  signalsExtracted: number
  signalsPersisted: number
  sources: {
    companyNotes: number
    contactNotes: number
    emailEvents: number
    timelineEvents: number
    accountStrategies: number
    researchCards: number
    humanIntelligence: number
  }
  signals: InternalMemorySignal[]
}

// ── Company Note Extractor ──

function extractCompanyNoteSignals(
  companyId: string,
  notes: Array<{
    id: string
    title: string
    category: string
    body: string
    author: string | null
    pinned: boolean
    createdAt: Date
  }>
): InternalMemorySignal[] {
  const signals: InternalMemorySignal[] = []

  for (const note of notes) {
    const body = note.body || ''
    const title = note.title || 'Untitled Note'
    const category = note.category || 'general'

    // Pinned notes get higher confidence
    const baseConfidence = note.pinned ? 85 : 70

    // Category-specific signal generation
    if (category === 'swot') {
      signals.push({
        signal: `SWOT Analysis: ${title}`,
        signalType: 'internal_memory',
        evidence: body.substring(0, 500),
        confidence: baseConfidence,
        businessImpact: 'High — SWOT analysis contains strategic positioning and competitive intelligence',
        recommendedAction: 'Incorporate SWOT insights into account strategy and messaging',
        timing: 'ongoing',
        severity: note.pinned ? 'high' : 'medium',
        sourceName: `internal:company_note:${note.author || 'unknown'}`,
        signalDate: note.createdAt,
      })
    } else if (category === 'competitive') {
      signals.push({
        signal: `Competitive Intelligence: ${title}`,
        signalType: 'internal_memory',
        evidence: body.substring(0, 500),
        confidence: baseConfidence + 5,
        businessImpact: 'High — Competitive positioning data for account planning',
        recommendedAction: 'Use competitive insights to differentiate messaging and anticipate objections',
        timing: 'within_30_days',
        severity: note.pinned ? 'critical' : 'high',
        sourceName: `internal:company_note:${note.author || 'unknown'}`,
        signalDate: note.createdAt,
      })
    } else if (category === 'discovery') {
      signals.push({
        signal: `Discovery Insight: ${title}`,
        signalType: 'internal_memory',
        evidence: body.substring(0, 500),
        confidence: baseConfidence + 5,
        businessImpact: 'Critical — First-hand discovery call intelligence directly from customer interactions',
        recommendedAction: 'Leverage discovery insights to personalize follow-up and qualify opportunity',
        timing: 'within_7_days',
        severity: 'high',
        sourceName: `internal:discovery:${note.author || 'unknown'}`,
        signalDate: note.createdAt,
      })
    } else if (category === 'meeting') {
      signals.push({
        signal: `Meeting Notes: ${title}`,
        signalType: 'internal_memory',
        evidence: body.substring(0, 500),
        confidence: baseConfidence,
        businessImpact: 'Medium — Meeting context for next interaction preparation',
        recommendedAction: 'Reference meeting outcomes in next touchpoint to demonstrate continuity',
        timing: 'within_7_days',
        severity: 'medium',
        sourceName: `internal:meeting:${note.author || 'unknown'}`,
        signalDate: note.createdAt,
      })
    } else if (category === 'call') {
      signals.push({
        signal: `Call Intelligence: ${title}`,
        signalType: 'internal_memory',
        evidence: body.substring(0, 500),
        confidence: baseConfidence,
        businessImpact: 'Medium — Phone call insights and conversation intelligence',
        recommendedAction: 'Use call intelligence to plan next outreach and maintain conversation thread',
        timing: 'within_7_days',
        severity: 'medium',
        sourceName: `internal:call:${note.author || 'unknown'}`,
        signalDate: note.createdAt,
      })
    } else if (category === 'research') {
      signals.push({
        signal: `Internal Research: ${title}`,
        signalType: 'internal_memory',
        evidence: body.substring(0, 500),
        confidence: baseConfidence - 5,
        businessImpact: 'Medium — Internal research findings and analysis',
        recommendedAction: 'Cross-reference with external intelligence for comprehensive account view',
        timing: 'ongoing',
        severity: 'medium',
        sourceName: `internal:research:${note.author || 'unknown'}`,
        signalDate: note.createdAt,
      })
    } else {
      // General notes — still valuable for small companies
      signals.push({
        signal: `Internal Note: ${title}`,
        signalType: 'internal_memory',
        evidence: body.substring(0, 500),
        confidence: Math.max(50, baseConfidence - 10),
        businessImpact: 'Low-Medium — General internal knowledge about the account',
        recommendedAction: 'Review note for relevant intelligence before next customer interaction',
        timing: 'ongoing',
        severity: 'low',
        sourceName: `internal:note:${note.author || 'unknown'}`,
        signalDate: note.createdAt,
      })
    }
  }

  return signals
}

// ── Contact Note Extractor (People Intelligence) ──

function extractContactNoteSignals(
  contacts: Array<{
    id: string
    rawName: string
    email: string
    title: string | null
    role: string | null
    status: string
    leadScore: number
    lastContactedAt: Date | null
    notes: Array<{ body: string; createdAt: Date }>
    _count: { replies: number }
  }>
): InternalMemorySignal[] {
  const signals: InternalMemorySignal[] = []

  for (const contact of contacts) {
    // High-value contact notes → people intelligence signals
    for (const note of contact.notes) {
      const bodyLower = (note.body || '').toLowerCase()

      // Detect champion or advocate signals
      if (/interested|excited|wants to proceed|ready to move forward|positive|loved|impressed/i.test(bodyLower)) {
        signals.push({
          signal: `Champion Signal: ${contact.rawName} expressed positive buying intent`,
          signalType: 'people_change',
          evidence: note.body.substring(0, 300),
          confidence: 82,
          businessImpact: 'Critical — Internal champion detected, strong buying signal',
          recommendedAction: `Accelerate engagement with ${contact.rawName} — provide proposal materials for internal advocacy`,
          timing: 'within_7_days',
          severity: 'high',
          sourceName: `internal:contact_note:${contact.rawName}`,
          signalDate: note.createdAt,
        })
      }

      // Detect objections or concerns
      if (/concern|objection|hesitat|not sure|budget|timing|competing|vendor/i.test(bodyLower)) {
        signals.push({
          signal: `Objection Detected: ${contact.rawName} raised concerns`,
          signalType: 'people_change',
          evidence: note.body.substring(0, 300),
          confidence: 75,
          businessImpact: 'High — Known objection provides opportunity for targeted response',
          recommendedAction: `Prepare objection handling for ${contact.rawName}'s concern before next interaction`,
          timing: 'within_7_days',
          severity: 'medium',
          sourceName: `internal:contact_note:${contact.rawName}`,
          signalDate: note.createdAt,
        })
      }

      // Detect role/authority signals
      if (/decision|budget|approve|authority|executive|sponsor|stakeholder/i.test(bodyLower)) {
        signals.push({
          signal: `Authority Signal: ${contact.rawName} may have decision-making influence`,
          signalType: 'people_change',
          evidence: note.body.substring(0, 300),
          confidence: 70,
          businessImpact: 'High — Decision-making authority identified, critical for deal progression',
          recommendedAction: `Engage ${contact.rawName} as potential economic buyer or coach in the deal`,
          timing: 'within_7_days',
          severity: 'high',
          sourceName: `internal:contact_note:${contact.rawName}`,
          signalDate: note.createdAt,
        })
      }
    }

    // Status-based signals: replied contacts = warm
    if (contact.status === 'replied' && contact.leadScore >= 50) {
      signals.push({
        signal: `Active Engagement: ${contact.rawName} (${contact.title || contact.role || 'Unknown Role'}) has replied and is warm`,
        signalType: 'people_change',
        evidence: `${contact.rawName} — ${contact.title || contact.role} — lead score ${contact.leadScore}, ${contact._count.replies} reply(ies)`,
        confidence: 80,
        businessImpact: 'High — Active engagement signal, contact is responsive and interested',
        recommendedAction: `Prioritize follow-up with ${contact.rawName} — high response probability`,
        timing: 'within_7_days',
        severity: 'high',
        sourceName: 'internal:engagement_tracking',
        signalDate: contact.lastContactedAt || undefined,
      })
    }
  }

  return signals
}

// ── Email Event Extractor ──

function extractEmailEventSignals(
  companyId: string,
  events: Array<{
    contactId: string
    eventType: string
    createdAt: Date
    contact: { rawName: string; title: string | null }
  }>
): InternalMemorySignal[] {
  const signals: InternalMemorySignal[] = []

  // Count events by type
  const replyEvents = events.filter(e => e.eventType === 'reply')
  const bounceEvents = events.filter(e => e.eventType === 'bounce')
  const recentReplies = replyEvents.filter(e => {
    const daysSince = (Date.now() - e.createdAt.getTime()) / 86400000
    return daysSince <= 30
  })

  // Recent reply cluster = active engagement signal
  if (recentReplies.length >= 2) {
    const contactNames = [...new Set(recentReplies.map(e => e.contact?.rawName || 'Unknown'))]
    signals.push({
      signal: `Reply Cluster: ${recentReplies.length} replies from ${contactNames.join(', ')} in last 30 days`,
      signalType: 'people_change',
      evidence: `Multiple reply events detected from same account — indicates active dialogue`,
      confidence: 85,
      businessImpact: 'Critical — Multiple recent replies indicate strong engagement and buying interest',
      recommendedAction: 'Escalate account engagement — multiple stakeholders are responsive and engaged',
      timing: 'immediate',
      severity: 'critical',
      sourceName: 'internal:email_events',
    })
  }

  // Bounce signals = data health issue
  if (bounceEvents.length > 0) {
    signals.push({
      signal: `Email Deliverability Issue: ${bounceEvents.length} bounced email(s) detected`,
      signalType: 'internal_memory',
      evidence: `${bounceEvents.length} bounce events found — email addresses may need updating`,
      confidence: 90,
      businessImpact: 'Medium — Data quality issue affects outreach capability',
      recommendedAction: 'Update contact email addresses and verify deliverability before next campaign',
      timing: 'within_7_days',
      severity: 'medium',
      sourceName: 'internal:email_health',
    })
  }

  return signals
}

// ── Timeline Event Extractor ──

function extractTimelineSignals(
  companyId: string,
  events: Array<{
    eventType: string
    title: string
    description: string | null
    createdAt: Date
  }>
): InternalMemorySignal[] {
  const signals: InternalMemorySignal[] = []

  // Focus on recent events (last 90 days)
  const recentEvents = events.filter(e => {
    const daysSince = (Date.now() - e.createdAt.getTime()) / 86400000
    return daysSince <= 90
  })

  // Status change events = lifecycle intelligence
  const statusChanges = recentEvents.filter(e => e.eventType === 'status_change')
  if (statusChanges.length > 0) {
    const latest = statusChanges[statusChanges.length - 1]
    signals.push({
      signal: `Account Status Changed: ${latest.title}`,
      signalType: 'internal_memory',
      evidence: latest.description || latest.title,
      confidence: 95,
      businessImpact: 'High — Account lifecycle stage has changed, adjust strategy accordingly',
      recommendedAction: 'Review updated account status and align outreach strategy to current lifecycle stage',
      timing: 'within_7_days',
      severity: 'high',
      sourceName: 'internal:timeline',
      signalDate: latest.createdAt,
    })
  }

  // Signal events from timeline
  const signalEvents = recentEvents.filter(e => e.eventType === 'signal')
  for (const event of signalEvents.slice(0, 3)) {
    signals.push({
      signal: `Historical Signal: ${event.title}`,
      signalType: 'internal_memory',
      evidence: event.description || event.title,
      confidence: 65,
      businessImpact: 'Medium — Previously detected signal provides historical context',
      recommendedAction: 'Cross-reference with current intelligence for signal evolution analysis',
      timing: 'ongoing',
      severity: 'low',
      sourceName: 'internal:timeline',
      signalDate: event.createdAt,
    })
  }

  // Contact added events = account growth
  const contactAdded = recentEvents.filter(e => e.eventType === 'contact_added')
  if (contactAdded.length >= 2) {
    signals.push({
      signal: `Account Expansion: ${contactAdded.length} new contacts added recently`,
      signalType: 'internal_memory',
      evidence: `Multiple new contacts added to the account in the last 90 days`,
      confidence: 78,
      businessImpact: 'Medium — Account team is growing, potential expansion or buying committee forming',
      recommendedAction: 'Map new contacts to buying roles and identify expanded opportunity scope',
      timing: 'within_30_days',
      severity: 'medium',
      sourceName: 'internal:timeline',
    })
  }

  // Enrichment events
  const enrichmentEvents = recentEvents.filter(e => e.eventType === 'enrichment')
  if (enrichmentEvents.length > 0) {
    signals.push({
      signal: `Data Enrichment: ${enrichmentEvents.length} enrichment event(s) recorded`,
      signalType: 'internal_memory',
      evidence: `Account has been enriched with additional data`,
      confidence: 70,
      businessImpact: 'Low — Improved data quality enhances targeting precision',
      recommendedAction: 'Leverage enriched data for more personalized outreach',
      timing: 'ongoing',
      severity: 'low',
      sourceName: 'internal:timeline',
    })
  }

  return signals
}

// ── Account Strategy Extractor ──

function extractStrategySignals(
  companyId: string,
  strategies: Array<{
    id: string
    title: string
    objective: string | null
    currentSituation: string | null
    swotAnalysis: string | null
    status: string
    createdAt: Date
    updatedAt: Date
  }>
): InternalMemorySignal[] {
  const signals: InternalMemorySignal[] = []

  for (const strategy of strategies) {
    if (strategy.status === 'archived') continue

    const isActive = strategy.status === 'active' || strategy.status === 'review'
    const confidence = isActive ? 88 : 65

    signals.push({
      signal: `Account Strategy: ${strategy.title}`,
      signalType: 'internal_memory',
      evidence: `Objective: ${strategy.objective || 'N/A'}. Current situation: ${(strategy.currentSituation || 'N/A').substring(0, 300)}`,
      confidence,
      businessImpact: isActive
        ? 'Critical — Active account strategy with defined objectives and SWOT analysis'
        : 'Medium — Draft account strategy available for reference',
      recommendedAction: isActive
        ? 'Align all outreach and engagement with the active account strategy'
        : 'Review and activate the draft account strategy to drive coordinated engagement',
      timing: 'ongoing',
      severity: isActive ? 'high' : 'medium',
      sourceName: 'internal:account_strategy',
      signalDate: strategy.updatedAt,
    })

    // Extract SWOT-specific signals
    if (strategy.swotAnalysis) {
      try {
        const swot = JSON.parse(strategy.swotAnalysis)
        if (swot.opportunities && Array.isArray(swot.opportunities) && swot.opportunities.length > 0) {
          signals.push({
            signal: `Strategic Opportunity: ${(swot.opportunities[0] || '').substring(0, 100)}`,
            signalType: 'internal_memory',
            evidence: `From SWOT analysis: Opportunities — ${JSON.stringify(swot.opportunities).substring(0, 300)}`,
            confidence: 75,
            businessImpact: 'High — Internal SWOT identifies specific opportunity to pursue',
            recommendedAction: 'Build messaging and value proposition around identified SWOT opportunities',
            timing: 'within_30_days',
            severity: 'high',
            sourceName: 'internal:swot',
          })
        }
        if (swot.threats && Array.isArray(swot.threats) && swot.threats.length > 0) {
          signals.push({
            signal: `Competitive Threat: ${(swot.threats[0] || '').substring(0, 100)}`,
            signalType: 'internal_memory',
            evidence: `From SWOT analysis: Threats — ${JSON.stringify(swot.threats).substring(0, 300)}`,
            confidence: 70,
            businessImpact: 'High — Internal SWOT identifies threats requiring proactive response',
            recommendedAction: 'Develop competitive displacement messaging addressing identified threats',
            timing: 'within_30_days',
            severity: 'medium',
            sourceName: 'internal:swot',
          })
        }
      } catch {
        // SWOT parse failed — non-critical
      }
    }
  }

  return signals
}

// ── Research Card Extractor ──

function extractResearchCardSignals(
  companyId: string,
  card: {
    id: string
    businessOverview: string | null
    techLandscape: string | null
    potentialChallenges: string | null
    possibleOpportunities: string | null
    relevantServices: string | null
    keyDecisionMakers: string | null
    keyPeople: string | null
    strategicPriorities: string | null
    businessProblems: string | null
    transformationAreas: string | null
    techStack: string | null
  } | null
): InternalMemorySignal[] {
  if (!card) return []
  const signals: InternalMemorySignal[] = []

  if (card.businessOverview) {
    signals.push({
      signal: `Business Context: Account has detailed research card with business overview`,
      signalType: 'internal_memory',
      evidence: card.businessOverview.substring(0, 400),
      confidence: 80,
      businessImpact: 'Medium — Rich internal knowledge base available for personalized engagement',
      recommendedAction: 'Use business overview to craft account-specific messaging and value proposition',
      timing: 'ongoing',
      severity: 'medium',
      sourceName: 'internal:research_card',
    })
  }

  if (card.techLandscape || card.techStack) {
    const techInfo = card.techStack || card.techLandscape || ''
    signals.push({
      signal: `Technology Intelligence: ${card.techLandscape ? 'Detailed tech landscape' : 'Tech stack'} available for this account`,
      signalType: 'internal_memory',
      evidence: (card.techLandscape || card.techStack || '').substring(0, 400),
      confidence: 82,
      businessImpact: 'High — Technology intelligence enables precise solution positioning',
      recommendedAction: 'Map technology intelligence to solution capabilities for targeted messaging',
      timing: 'within_30_days',
      severity: 'high',
      sourceName: 'internal:research_card',
    })
  }

  if (card.potentialChallenges) {
    signals.push({
      signal: `Known Pain Points: ${card.potentialChallenges.substring(0, 100)}`,
      signalType: 'internal_memory',
      evidence: card.potentialChallenges.substring(0, 400),
      confidence: 78,
      businessImpact: 'High — Known challenges enable proactive problem-solution mapping',
      recommendedAction: 'Frame outreach around solving identified pain points with relevant solutions',
      timing: 'within_30_days',
      severity: 'high',
      sourceName: 'internal:research_card',
    })
  }

  if (card.strategicPriorities) {
    try {
      const priorities = JSON.parse(card.strategicPriorities)
      if (Array.isArray(priorities) && priorities.length > 0) {
        signals.push({
          signal: `Strategic Priority: ${(priorities[0]?.priority || priorities[0]?.description || '').substring(0, 100)}`,
          signalType: 'internal_memory',
          evidence: JSON.stringify(priorities).substring(0, 400),
          confidence: 85,
          businessImpact: 'Critical — Known strategic priorities enable precision targeting',
          recommendedAction: 'Align all messaging and engagement with account\'s stated strategic priorities',
          timing: 'within_30_days',
          severity: 'high',
          sourceName: 'internal:research_card',
        })
      }
    } catch {
      // Non-critical
    }
  }

  if (card.keyDecisionMakers || card.keyPeople) {
    try {
      const people = JSON.parse(card.keyPeople || card.keyDecisionMakers || '[]')
      if (Array.isArray(people) && people.length > 0) {
        signals.push({
          signal: `Key People Identified: ${people.length} decision-makers/influencers documented`,
          signalType: 'people_change',
          evidence: JSON.stringify(people.slice(0, 3)).substring(0, 400),
          confidence: 80,
          businessImpact: 'High — Pre-identified key people accelerate stakeholder mapping',
          recommendedAction: 'Cross-reference documented key people with CRM contacts for gap analysis',
          timing: 'within_30_days',
          severity: 'high',
          sourceName: 'internal:research_card',
        })
      }
    } catch {
      // Non-critical
    }
  }

  return signals
}

// ── Human Intelligence Inbox Extractor ──

function extractHumanIntelligenceSignals(
  companyId: string,
  items: Array<{
    id: string
    content: string
    summary: string | null
    category: string | null
    source: string
    priority: string
    status: string
    submittedBy: string
    createdAt: Date
  }>
): InternalMemorySignal[] {
  const signals: InternalMemorySignal[] = []

  for (const item of items) {
    if (item.status === 'rejected') continue

    const isHighPriority = item.priority === 'high' || item.priority === 'critical'
    const baseConfidence = isHighPriority ? 90 : 75

    signals.push({
      signal: `Human Intelligence: ${item.summary || item.content.substring(0, 80)}`,
      signalType: 'internal_memory',
      evidence: `${item.content.substring(0, 300)} (submitted by ${item.submittedBy}, source: ${item.source})`,
      confidence: baseConfidence,
      businessImpact: isHighPriority
        ? 'Critical — High-priority human intelligence from team member with direct account knowledge'
        : 'Medium — Team-sourced intelligence from internal expertise',
      recommendedAction: isHighPriority
        ? 'Immediately incorporate this intelligence into account strategy and brief team'
        : 'Add to account knowledge base and reference in next interaction',
      timing: isHighPriority ? 'immediate' : 'within_7_days',
      severity: isHighPriority ? 'critical' : 'medium',
      sourceName: `human:${item.submittedBy}`,
      signalDate: item.createdAt,
    })
  }

  return signals
}

// ═══════════════════════════════════════════════════════════════
// MAIN CONNECTOR: Pull all internal memory and produce signals
// ═══════════════════════════════════════════════════════════════

export async function extractInternalMemorySignals(
  companyId: string
): Promise<InternalMemoryResult> {
  const allSignals: InternalMemorySignal[] = []

  // ── 1. Company Notes ──
  const companyNotes = await db.companyNote.findMany({
    where: { companyId },
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    take: 20,
  })
  const noteSignals = extractCompanyNoteSignals(companyId, companyNotes)
  allSignals.push(...noteSignals)

  // ── 2. Contact Notes (with contact context) ──
  const contacts = await db.contact.findMany({
    where: {
      companyId,
      status: { not: 'archived' },
    },
    include: {
      notes: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
      _count: { select: { replies: true } },
    },
    orderBy: { leadScore: 'desc' },
    take: 15,
  })
  const contactSignals = extractContactNoteSignals(contacts)
  allSignals.push(...contactSignals)

  // ── 3. Email Events (last 90 days) ──
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000)
  const emailEvents = await db.emailEvent.findMany({
    where: {
      contact: { companyId },
      createdAt: { gte: ninetyDaysAgo },
      eventType: { in: ['reply', 'bounce', 'click'] },
    },
    include: {
      contact: { select: { rawName: true, title: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
  const emailSignals = extractEmailEventSignals(companyId, emailEvents)
  allSignals.push(...emailSignals)

  // ── 4. Timeline Events (last 90 days) ──
  const timelineEvents = await db.companyTimelineEvent.findMany({
    where: {
      companyId,
      createdAt: { gte: ninetyDaysAgo },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  const timelineSignals = extractTimelineSignals(companyId, timelineEvents)
  allSignals.push(...timelineSignals)

  // ── 5. Account Strategies ──
  const strategies = await db.accountStrategy.findMany({
    where: {
      companyId,
      status: { not: 'archived' },
    },
    orderBy: { updatedAt: 'desc' },
    take: 5,
  })
  const strategySignals = extractStrategySignals(companyId, strategies)
  allSignals.push(...strategySignals)

  // ── 6. Research Card ──
  const researchCard = await db.companyResearchCard.findUnique({
    where: { companyId },
  })
  const researchSignals = extractResearchCardSignals(companyId, researchCard)
  allSignals.push(...researchSignals)

  // ── 7. Human Intelligence Inbox ──
  const humanIntelligence = await db.humanIntelligenceInbox.findMany({
    where: {
      companyId,
      status: { not: 'rejected' },
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    take: 10,
  })
  const humanSignals = extractHumanIntelligenceSignals(companyId, humanIntelligence)
  allSignals.push(...humanSignals)

  // ── Persist signals to database ──
  let signalsPersisted = 0
  for (const sig of allSignals) {
    try {
      const result = await createSignalFromIntelligenceObject({
        companyId,
        signal: sig.signal,
        evidence: sig.evidence,
        sourceUrl: undefined,
        sourceName: sig.sourceName,
        confidence: sig.confidence,
        businessImpact: sig.businessImpact,
        recommendedAction: sig.recommendedAction,
        timing: sig.timing,
        severity: sig.severity,
        signalType: sig.signalType,
        signalDate: sig.signalDate || undefined,
      })
      if (result.success) signalsPersisted++
    } catch (err) {
      console.warn(`[internal-memory] Failed to persist signal "${sig.signal}":`, err)
    }
  }

  return {
    companyId,
    signalsExtracted: allSignals.length,
    signalsPersisted,
    sources: {
      companyNotes: noteSignals.length,
      contactNotes: contactSignals.length,
      emailEvents: emailSignals.length,
      timelineEvents: timelineSignals.length,
      accountStrategies: strategySignals.length,
      researchCards: researchSignals.length,
      humanIntelligence: humanSignals.length,
    },
    signals: allSignals,
  }
}

// ═══════════════════════════════════════════════════════════════
// INTERNAL MEMORY DEPTH SCORE: How rich is the internal memory?
// ═══════════════════════════════════════════════════════════════

export async function computeInternalMemoryDepth(companyId: string): Promise<{
  score: number          // 0-100
  grade: 'rich' | 'moderate' | 'sparse' | 'empty'
  breakdown: {
    companyNotes: number
    contactNotes: number
    emailEvents: number
    timelineEvents: number
    hasStrategy: boolean
    hasResearchCard: boolean
    humanIntelligence: number
    contactCount: number
  }
  signalCounts: Record<string, number>
}> {
  const [companyNotes, contacts, emailEvents, timelineEvents, strategyCount, researchCard, humanInbox] =
    await Promise.all([
      db.companyNote.count({ where: { companyId } }),
      db.contact.count({ where: { companyId, status: { not: 'archived' } } }),
      db.emailEvent.count({ where: { contact: { companyId } } }),
      db.companyTimelineEvent.count({ where: { companyId } }),
      db.accountStrategy.count({ where: { companyId, status: { not: 'archived' } } }),
      db.companyResearchCard.findUnique({ where: { companyId } }),
      db.humanIntelligenceInbox.count({ where: { companyId, status: { not: 'rejected' } } }),
    ])

  const contactNotes = await db.contactNote.count({
    where: { contact: { companyId } },
  })

  // Score calculation (0-100)
  let score = 0
  score += Math.min(20, companyNotes * 4)       // Up to 20 pts for notes
  score += Math.min(15, contactNotes * 3)       // Up to 15 pts for contact notes
  score += Math.min(10, contacts * 2)           // Up to 10 pts for contacts
  score += Math.min(10, emailEvents * 1)         // Up to 10 pts for email history
  score += Math.min(10, timelineEvents * 2)      // Up to 10 pts for timeline
  score += strategyCount > 0 ? 15 : 0       // 15 pts for having strategy
  score += researchCard ? 15 : 0                 // 15 pts for having research card
  score += Math.min(5, humanInbox * 2)           // Up to 5 pts for human intel

  const grade: 'rich' | 'moderate' | 'sparse' | 'empty' =
    score >= 70 ? 'rich' : score >= 40 ? 'moderate' : score >= 15 ? 'sparse' : 'empty'

  return {
    score,
    grade,
    breakdown: {
      companyNotes,
      contactNotes,
      emailEvents,
      timelineEvents,
      hasStrategy: strategyCount > 0,
      hasResearchCard: !!researchCard,
      humanIntelligence: humanInbox,
      contactCount: contacts,
    },
    signalCounts: {
      companyNotes,
      contactNotes,
      emailEvents,
      timelineEvents,
      strategies: strategyCount,
      researchCard: researchCard ? 1 : 0,
      humanInbox,
    },
  }
}
