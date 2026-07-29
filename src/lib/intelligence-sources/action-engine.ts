/**
 * Action Engine — Sprint 3: Intelligence → Outcomes
 *
 * Converts DeepMindQ intelligence (signals, evidence, contacts, insights)
 * into 6 types of structured action artifacts:
 *
 *   1. meeting_prep         — Executive summary + talking points + discovery questions
 *   2. executive_outreach  — Who to approach + why + personalized messaging
 *   3. account_strategy    — Business priorities + solution alignment + risks
 *   4. stakeholder_map     — Decision makers + influencers + relationship intel
 *   5. opportunity_qualification — Buying signals + timing + strategic fit + confidence
 *   6. next_best_action    — THE answer: "What should I do next and why?"
 *
 * PRINCIPLES:
 *   - Evidence first: every claim traces to a CompanySignal or Evidence record
 *   - Memory + external: uses DB data (internal) + fresh web search (external)
 *   - AI interprets, never invents: structured prompts with strict grounding rules
 *   - Recommendations traceable: evidenceReferences JSON on every ActionArtifact
 */

import { db } from '@/lib/db'

// ─── Types ──────────────────────────────────────────────────────

export type ActionType =
  | 'meeting_prep'
  | 'executive_outreach'
  | 'account_strategy'
  | 'stakeholder_map'
  | 'opportunity_qualification'
  | 'next_best_action'

export const ACTION_TYPES: ActionType[] = [
  'meeting_prep',
  'executive_outreach',
  'account_strategy',
  'stakeholder_map',
  'opportunity_qualification',
  'next_best_action',
]

export const ACTION_LABELS: Record<ActionType, string> = {
  meeting_prep: 'Meeting Preparation Brief',
  executive_outreach: 'Executive Outreach Intelligence',
  account_strategy: 'Account Strategy Plan',
  stakeholder_map: 'Stakeholder Map',
  opportunity_qualification: 'Opportunity Qualification',
  next_best_action: 'Next Best Action',
}

export interface ActionArtifactResponse {
  actionType: ActionType
  summary: string
  content: Record<string, unknown>
  priorityScore: number
  confidence: number
  evidenceReferences: Array<{ type: string; id: string; snippet: string }>
  sourceSignalCount: number
  sourceContactCount: number
}

interface Sprint3FullResponse {
  company: {
    id: string
    name: string
    industry: string | null
    domain: string | null
    sizeRange: string | null
    country: string | null
  }
  context: {
    signalCount: number
    contactCount: number
    evidenceCount: number
    insightCount: number
    // Sprint 3A: Internal memory counts
    companyNotesCount: number
    contactNotesCount: number
    timelineEventsCount: number
    internalSignalsCount: number
    humanIntelCount: number
    intelligenceBalance: 'external_heavy' | 'internal_heavy' | 'balanced' | 'empty'
  }
  actions: ActionArtifactResponse[]
  meta: {
    pipelineLatencyMs: number
    aiModelUsed: boolean
    actionsGenerated: number
    errors: string[]
  }
}

// ─── Context Gathering ───────────────────────────────────────────

interface ActionContext {
  companyId: string
  company: {
    id: string
    rawName: string
    industry: string | null
    domain: string | null
    sizeRange: string | null
    country: string | null
    location: string | null
    website: string | null
    internalSummary: string | null
    status: string
    lifecycleStage: string
  }
  signals: Array<{
    id: string
    signalType: string
    title: string
    description: string | null
    severity: string
    confidence: number
    businessImpact: string | null
    recommendedAction: string | null
    timingWindow: string | null
    signalDate: Date | null
    sourceUrl: string | null
    createdAt: Date
  }>
  contacts: Array<{
    id: string
    rawName: string
    email: string
    title: string | null
    role: string | null
    location: string | null
    leadScore: number
    status: string
  }>
  evidence: Array<{
    id: string
    sourceUrl: string
    sourceTitle: string | null
    snippet: string
    extractedField: string | null
    confidence: number
    sourceDate: Date | null
  }>
  researchCard: {
    businessOverview: string | null
    techStack: string | null
    keyPeople: string | null
    recentNews: string | null
    revenue: string | null
    employeeCount: string | null
    strategicPriorities: string | null
    businessProblems: string | null
  } | null
  insights: Array<{
    id: string
    insightType: string
    summary: string
    confidenceScore: number
  }>
  // Sprint 3A: Internal memory context
  companyNotes: Array<{
    id: string
    title: string
    category: string
    body: string
    author: string | null
    createdAt: Date
  }>
  contactNotes: Array<{
    id: string
    contactName: string
    contactTitle: string | null
    body: string
    createdAt: Date
  }>
  timelineEvents: Array<{
    id: string
    eventType: string
    title: string
    description: string | null
    createdAt: Date
  }>
  humanIntelligence: Array<{
    id: string
    content: string
    summary: string | null
    category: string | null
    priority: string
    submittedBy: string
    createdAt: Date
  }>
  accountStrategy: {
    swotAnalysis: string | null
    stakeholderMap: string | null
    keyInitiatives: string | null
  } | null
  internalSignals: Array<{
    signalType: string
    title: string
    description: string
    source: string
    confidence: number
    businessImpact: string
    recommendedAction: string
    timing: string
    severity: string
  }>
}

/**
 * Gather all available context for a company from Sprint 1/2 + Sprint 3A outputs.
 * This is the data foundation for all 6 action generators.
 *
 * Sources:
 *   - External: signals (Sprint 1), evidence, research card, strategic insights
 *   - Internal: company notes, contact notes, timeline events, human intel
 *   - People: contacts, account strategy, internal memory signals (Sprint 3A)
 */
async function gatherCompanyContext(companyId: string): Promise<ActionContext> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      rawName: true,
      industry: true,
      domain: true,
      sizeRange: true,
      country: true,
      location: true,
      website: true,
      internalSummary: true,
      status: true,
      lifecycleStage: true,
    },
  })

  if (!company) throw new Error(`Company ${companyId} not found`)

  // Parallel fetch of all context sources
  const [
    // External intelligence (Sprint 1/2)
    signals,
    evidence,
    researchCard,
    insights,
    // CRM contacts
    contacts,
    // Sprint 3A: Internal memory
    companyNotes,
    contactNotesData,
    timelineEvents,
    humanIntel,
    accountStrategy,
  ] = await Promise.all([
    // Active signals (Sprint 1/2 output)
    db.companySignal.findMany({
      where: { companyId, status: { in: ['detected', 'validated', 'active'] } },
      orderBy: { confidence: 'desc' },
      take: 30,
      select: {
        id: true, signalType: true, title: true, description: true,
        severity: true, confidence: true, businessImpact: true,
        recommendedAction: true, timingWindow: true, signalDate: true,
        sourceUrl: true, createdAt: true,
      },
    }),

    // Recent evidence
    db.evidence.findMany({
      where: { companyId, status: 'active' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true, sourceUrl: true, sourceTitle: true, snippet: true,
        extractedField: true, confidence: true, sourceDate: true,
      },
    }),

    // Research card
    db.companyResearchCard.findUnique({
      where: { companyId },
      select: {
        businessOverview: true, techStack: true, keyPeople: true,
        recentNews: true, revenue: true, employeeCount: true,
        strategicPriorities: true, businessProblems: true,
      },
    }),

    // Strategic insights
    db.strategicInsight.findMany({
      where: { companyId },
      orderBy: { confidenceScore: 'desc' },
      take: 10,
      select: { id: true, insightType: true, summary: true, confidenceScore: true },
    }),

    // Contacts
    db.contact.findMany({
      where: { companyId },
      orderBy: { leadScore: 'desc' },
      take: 20,
      select: {
        id: true, rawName: true, email: true, title: true,
        role: true, location: true, leadScore: true, status: true,
      },
    }),

    // Sprint 3A: Company notes (meeting, call, discovery, research)
    db.companyNote.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, title: true, category: true, body: true, author: true, createdAt: true },
    }),

    // Sprint 3A: Contact notes
    db.contactNote.findMany({
      where: { contact: { companyId } },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: {
        id: true, body: true, createdAt: true,
        contact: { select: { rawName: true, title: true } },
      },
    }),

    // Sprint 3A: Timeline events
    db.companyTimelineEvent.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: { id: true, eventType: true, title: true, description: true, createdAt: true },
    }),

    // Sprint 3A: Human intelligence
    db.humanIntelligenceInbox.findMany({
      where: { companyId, status: { in: ['pending', 'reviewed', 'approved', 'converted'] } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true, content: true, summary: true, category: true,
        priority: true, submittedBy: true, createdAt: true,
      },
    }),

    // Sprint 3A: Account strategy
    db.accountStrategy.findUnique({
      where: { companyId },
      select: { swotAnalysis: true, stakeholderMap: true, keyInitiatives: true },
    }),
  ])

  // Extract internal memory signals using the connector
  let internalSignals: ActionContext['internalSignals'] = []
  try {
    const { extractInternalMemorySignals } = await import('./internal-memory-connector')
    const memResult = await extractInternalMemorySignals(companyId)
    internalSignals = memResult.signals.slice(0, 20).map(s => ({
      signalType: s.signalType,
      title: s.title,
      description: s.description,
      source: s.source,
      confidence: s.confidence,
      businessImpact: s.businessImpact,
      recommendedAction: s.recommendedAction,
      timing: s.timing,
      severity: s.severity,
    }))
  } catch (err) {
    console.warn('[action-engine] Internal memory extraction failed:', err instanceof Error ? err.message : err)
  }

  return {
    companyId,
    company,
    signals,
    contacts,
    evidence,
    researchCard,
    insights,
    companyNotes,
    contactNotes: contactNotesData.map(cn => ({
      id: cn.id,
      contactName: cn.contact.rawName,
      contactTitle: cn.contact.title,
      body: cn.body,
      createdAt: cn.createdAt,
    })),
    timelineEvents,
    humanIntelligence,
    accountStrategy,
    internalSignals,
  }
}

// ─── Context Formatter for AI Prompts ──────────────────────────

function formatSignalsForPrompt(signals: ActionContext['signals']): string {
  if (signals.length === 0) return 'No signals detected for this company.'
  return signals
    .slice(0, 15)
    .map((s, i) => {
      const impact = s.businessImpact || 'Not assessed'
      const action = s.recommendedAction || 'Review signal'
      return `${i + 1}. [${s.signalType.toUpperCase()}] ${s.title}\n   Impact: ${impact}\n   Action: ${action}\n   Confidence: ${Math.round(s.confidence * 100)}% | Severity: ${s.severity} | Timing: ${s.timingWindow || 'unknown'}\n   Source: ${s.sourceUrl || 'internal'}`
    })
    .join('\n\n')
}

function formatContactsForPrompt(contacts: ActionContext['contacts']): string {
  if (contacts.length === 0) return 'No contacts found for this company.'
  return contacts
    .slice(0, 15)
    .map((c, i) => {
      return `${i + 1}. ${c.rawName} — ${c.title || c.role || 'Unknown role'}\n   Email: ${c.email} | Lead Score: ${c.leadScore} | Status: ${c.status}`
    })
    .join('\n')
}

function formatResearchForPrompt(rc: ActionContext['researchCard']): string {
  if (!rc) return 'No research card data available.'
  const parts: string[] = []
  if (rc.businessOverview) parts.push(`Business: ${rc.businessOverview}`)
  if (rc.revenue) parts.push(`Revenue: ${rc.revenue}`)
  if (rc.employeeCount) parts.push(`Employees: ${rc.employeeCount}`)
  if (rc.techStack) parts.push(`Tech Stack: ${rc.techStack}`)
  if (rc.strategicPriorities && rc.strategicPriorities !== '[]') parts.push(`Strategic Priorities: ${rc.strategicPriorities}`)
  if (rc.businessProblems && rc.businessProblems !== '[]') parts.push(`Business Problems: ${rc.businessProblems}`)
  return parts.length > 0 ? parts.join('\n') : 'Research card exists but has no populated fields.'
}

function formatInsightsForPrompt(insights: ActionContext['insights']): string {
  if (insights.length === 0) return 'No strategic insights available.'
  return insights
    .map((i, idx) => `${idx + 1}. [${i.insightType}] ${i.summary} (Confidence: ${i.confidenceScore}%)`)
    .join('\n')
}

// Sprint 3A: Internal memory formatters

function formatCompanyNotesForPrompt(notes: ActionContext['companyNotes']): string {
  if (notes.length === 0) return 'No internal notes or meeting records.'
  return notes
    .slice(0, 10)
    .map((n, i) => {
      const daysAgo = Math.floor((Date.now() - n.createdAt.getTime()) / 86400000)
      return `${i + 1}. [${n.category.toUpperCase()}] ${n.title || 'Untitled'} (${daysAgo}d ago, by ${n.author || 'unknown'})\n   ${n.body.substring(0, 200)}`
    })
    .join('\n\n')
}

function formatContactNotesForPrompt(notes: ActionContext['contactNotes']): string {
  if (notes.length === 0) return 'No contact-level notes.'
  return notes
    .slice(0, 8)
    .map((n, i) => {
      const daysAgo = Math.floor((Date.now() - n.createdAt.getTime()) / 86400000)
      return `${i + 1}. ${n.contactName} (${n.contactTitle || 'Unknown role'}) — ${daysAgo}d ago\n   ${n.body.substring(0, 150)}`
    })
    .join('\n\n')
}

function formatTimelineForPrompt(events: ActionContext['timelineEvents']): string {
  if (events.length === 0) return 'No timeline events.'
  return events
    .slice(0, 10)
    .map((e, i) => {
      const daysAgo = Math.floor((Date.now() - e.createdAt.getTime()) / 86400000)
      return `${i + 1}. [${e.eventType}] ${e.title} (${daysAgo}d ago)${e.description ? `\n   ${e.description.substring(0, 100)}` : ''}`
    })
    .join('\n')
}

function formatHumanIntelligenceForPrompt(intel: ActionContext['humanIntelligence']): string {
  if (intel.length === 0) return 'No human-submitted intelligence.'
  return intel
    .slice(0, 5)
    .map((h, i) => {
      return `${i + 1}. [${h.priority.toUpperCase()}] ${h.summary || h.content.substring(0, 100)} (submitted by ${h.submittedBy})`
    })
    .join('\n')
}

function formatInternalSignalsForPrompt(signals: ActionContext['internalSignals']): string {
  if (signals.length === 0) return 'No internal memory signals detected.'
  return signals
    .slice(0, 10)
    .map((s, i) => {
      return `${i + 1}. [${s.signalType.toUpperCase()}] ${s.title}\n   Impact: ${s.businessImpact}\n   Action: ${s.recommendedAction}\n   Confidence: ${Math.round(s.confidence * 100)}% | Severity: ${s.severity}\n   Source: ${s.source}`
    })
    .join('\n\n')
}

function formatAccountStrategyForPrompt(strategy: ActionContext['accountStrategy']): string {
  if (!strategy) return 'No account strategy on file.'
  const parts: string[] = []
  if (strategy.swotAnalysis) parts.push(`SWOT: ${strategy.swotAnalysis.substring(0, 300)}`)
  if (strategy.keyInitiatives) parts.push(`Key Initiatives: ${strategy.keyInitiatives.substring(0, 300)}`)
  return parts.length > 0 ? parts.join('\n') : 'Account strategy exists but has no content.'
}

// ─── AI Call Helper ─────────────────────────────────────────────

const GROUND_RULES = `GROUND RULES — YOU MUST FOLLOW THESE:
1. Use ONLY the provided company data, signals, contacts, and research information.
2. DO NOT invent, fabricate, or assume any information not present in the data.
3. If data is insufficient, explicitly say "Insufficient data" rather than guessing.
4. Every recommendation MUST be traceable to a specific signal, evidence item, or contact.
5. Be specific and actionable — "Schedule a call with their CTO about cloud migration" not "Engage with the company".
6. Assign realistic priority and confidence scores based on available evidence quality.`

async function callAIForAction(systemPrompt: string, userPrompt: string): Promise<string> {
  const { callLLM } = await import('@/lib/zai-helpers')
  return callLLM(systemPrompt, userPrompt)
}

function parseJSONResponse(raw: string): Record<string, unknown> {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  try {
    const obj = JSON.parse(cleaned)
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj as Record<string, unknown>
    if (obj && Array.isArray(obj)) return { items: obj }
  } catch { /* fall through */ }
  const objMatch = cleaned.match(/\{[\s\S]*\}/)
  if (objMatch) {
    try {
      const obj = JSON.parse(objMatch[0])
      if (typeof obj === 'object' && !Array.isArray(obj)) return obj as Record<string, unknown>
    } catch { /* fall through */ }
  }
  return { raw }
}

// ─── 6 Action Generators ───────────────────────────────────────

/**
 * 1. Meeting Preparation Brief
 * Executive summary before a customer meeting.
 */
async function generateMeetingPrep(ctx: ActionContext): Promise<{ content: Record<string, unknown>; summary: string; confidence: number }> {
  const signalText = formatSignalsForPrompt(ctx.signals)
  const researchText = formatResearchForPrompt(ctx.researchCard)
  const contactText = formatContactsForPrompt(ctx.contacts)
  const notesText = formatCompanyNotesForPrompt(ctx.companyNotes)
  const contactNotesText = formatContactNotesForPrompt(ctx.contactNotes)
  const internalSignalsText = formatInternalSignalsForPrompt(ctx.internalSignals)
  const strategyText = formatAccountStrategyForPrompt(ctx.accountStrategy)

  // Adjust confidence based on data richness
  const totalDataPoints = ctx.signals.length + ctx.companyNotes.length + ctx.contactNotes.length +
    ctx.internalSignals.length + (ctx.researchCard ? 1 : 0)
  const baseConfidence = totalDataPoints >= 10 ? 0.85 : totalDataPoints >= 5 ? 0.75 : 0.60

  const systemPrompt = `${GROUND_RULES}

You are a B2B sales enablement specialist preparing a meeting brief for an account executive.
Your brief helps the AE walk into a meeting fully informed and ready to have a strategic conversation.

IMPORTANT: Combine BOTH external intelligence (news, signals) AND internal memory (notes, previous meetings,
contact observations, human intel). Internal memory is often MORE valuable for small/mid-market companies.

OUTPUT FORMAT: Valid JSON only.
{
  "executiveSummary": "2-3 sentence overview combining external signals AND internal memory",
  "keyBusinessChanges": ["change from external OR internal sources"],
  "previousInteractions": ["summary of past meetings, calls, notes from CRM"],
  "talkingPoints": [
    { "point": "Specific talking point", "evidence": "Which signal/note/data supports this", "goal": "What you want to achieve" }
  ],
  "discoveryQuestions": [
    { "question": "Open-ended discovery question", "rationale": "Why ask this now", "signalRef": "Related signal or note" }
  ],
  "icebreakers": ["personalized icebreaker based on company news, previous interactions, or contact"],
  "riskAreas": ["potential objections or concerns to prepare for"],
  "recommendedObjective": "What the AE should aim to achieve in this meeting"
}`

  const userPrompt = `Prepare a meeting brief for:

Company: ${ctx.company.rawName}
Industry: ${ctx.company.industry || 'Unknown'}
Size: ${ctx.company.sizeRange || 'Unknown'}
Country: ${ctx.company.country || 'Unknown'}

=== EXTERNAL INTELLIGENCE ===
COMPANY RESEARCH:
${researchText}

ACTIVE SIGNALS (${ctx.signals.length}):
${signalText}

=== INTERNAL MEMORY ===
INTERNAL NOTES & MEETINGS (${ctx.companyNotes.length}):
${notesText}

CONTACT OBSERVATIONS (${ctx.contactNotes.length}):
${contactNotesText}

INTERNAL MEMORY SIGNALS (${ctx.internalSignals.length}):
${internalSignalsText}

ACCOUNT STRATEGY:
${strategyText}

KEY CONTACTS (${ctx.contacts.length}):
${contactText}

Generate the meeting prep brief combining external and internal intelligence.`

  const raw = await callAIForAction(systemPrompt, userPrompt)
  const content = parseJSONResponse(raw)
  return {
    content,
    summary: String(content.executiveSummary || content.recommendedObjective || 'Meeting preparation brief generated'),
    confidence: baseConfidence,
  }
}

/**
 * 2. Executive Outreach Intelligence
 * Who to approach, why, and how to make contact.
 */
async function generateExecutiveOutreach(ctx: ActionContext): Promise<{ content: Record<string, unknown>; summary: string; confidence: number }> {
  const signalText = formatSignalsForPrompt(ctx.signals)
  const contactText = formatContactsForPrompt(ctx.contacts)
  const researchText = formatResearchForPrompt(ctx.researchCard)

  const systemPrompt = `${GROUND_RULES}

You are a B2B sales strategist specializing in executive outreach.
Identify the best people to approach at this company and craft personalized outreach strategies.

OUTPUT FORMAT: Valid JSON only.
{
  "primaryTarget": {
    "name": "Best person to contact first",
    "title": "Their title",
    "reason": "Why this person — linked to a specific signal or business change",
    "approach": "How to approach them (warm intro, cold email, LinkedIn, etc.)",
    "messaging": "2-3 sentence personalized outreach message",
    "timing": "Best time to reach out and why"
  },
  "secondaryTargets": [
    {
      "name": "Person name",
      "title": "Their title",
      "reason": "Why approach this person",
      "approach": "Suggested approach",
      "messaging": "Personalized message angle"
    }
  ],
  "avoidContacts": ["People or roles to avoid and why"],
  "outreachSequence": [
    { "step": 1, "action": "What to do", "channel": "email|linkedin|phone", "timing": "When" }
  ]
}`

  const userPrompt = `Generate executive outreach intelligence for:

Company: ${ctx.company.rawName}
Industry: ${ctx.company.industry || 'Unknown'}
Size: ${ctx.company.sizeRange || 'Unknown'}

COMPANY RESEARCH:
${researchText}

ACTIVE SIGNALS:
${signalText}

AVAILABLE CONTACTS:
${contactText}

Identify the best outreach targets and strategies.`

  const raw = await callAIForAction(systemPrompt, userPrompt)
  const content = parseJSONResponse(raw)
  const primary = content.primaryTarget as Record<string, unknown> | undefined
  return {
    content,
    summary: primary
      ? `Approach ${primary.name || 'primary target'} (${primary.title || 'unknown role'}) — ${primary.reason || 'highest potential entry point'}`
      : 'Executive outreach analysis generated',
    confidence: 0.75,
  }
}

/**
 * 3. Account Strategy Plan
 * Opportunity areas, solution alignment, risks.
 */
async function generateAccountStrategy(ctx: ActionContext): Promise<{ content: Record<string, unknown>; summary: string; confidence: number }> {
  const signalText = formatSignalsForPrompt(ctx.signals)
  const researchText = formatResearchForPrompt(ctx.researchCard)
  const insightText = formatInsightsForPrompt(ctx.insights)

  const systemPrompt = `${GROUND_RULES}

You are a strategic account planner for B2B enterprise sales.
Create an account strategy that identifies where the best opportunities exist
and how to position solutions against the company's priorities.

OUTPUT FORMAT: Valid JSON only.
{
  "businessPriorities": [
    { "priority": "What they care about most", "evidence": "Signal/data backing this", "alignment": "How our solution maps to this" }
  ],
  "opportunityAreas": [
    { "area": "Specific opportunity", "estimatedValue": "Rough sizing", "confidence": 80, "entryPoint": "How to start this conversation" }
  ],
  "solutionAlignment": {
    "primaryFit": "Where our solution best fits their needs",
    "secondaryFit": "Secondary use cases",
    "competitiveAdvantage": "What differentiates our approach"
  },
  "risks": [
    { "risk": "What could go wrong", "severity": "high|medium|low", "mitigation": "How to address" }
  ],
  "blockers": ["Things that could prevent a deal from progressing"],
  "recommendedApproach": "Overall strategy summary — how to win this account"
}`

  const userPrompt = `Create an account strategy plan for:

Company: ${ctx.company.rawName}
Industry: ${ctx.company.industry || 'Unknown'}
Size: ${ctx.company.sizeRange || 'Unknown'}

COMPANY RESEARCH:
${researchText}

ACTIVE SIGNALS:
${signalText}

STRATEGIC INSIGHTS:
${insightText}

Generate the account strategy.`

  const raw = await callAIForAction(systemPrompt, userPrompt)
  const content = parseJSONResponse(raw)
  const approach = content.recommendedApproach as string | undefined
  return {
    content,
    summary: approach || 'Account strategy plan generated',
    confidence: 0.75,
  }
}

/**
 * 4. Stakeholder Map
 * Decision makers, influencers, champions, relationship intelligence.
 */
async function generateStakeholderMap(ctx: ActionContext): Promise<{ content: Record<string, unknown>; summary: string; confidence: number }> {
  const contactText = formatContactsForPrompt(ctx.contacts)
  const signalText = formatSignalsForPrompt(ctx.signals)
  const researchText = formatResearchForPrompt(ctx.researchCard)

  // Parse key people from research card if available
  let keyPeopleText = 'No key people data in research card.'
  if (ctx.researchCard?.keyPeople) {
    try {
      const people = JSON.parse(ctx.researchCard.keyPeople)
      if (Array.isArray(people) && people.length > 0) {
        keyPeopleText = people
          .map((p: Record<string, unknown>, i: number) =>
            `${i + 1}. ${p.name || 'Unknown'} — ${p.title || 'Unknown'}${p.department ? ` (${p.department})` : ''}`
          )
          .join('\n')
      }
    } catch {
      keyPeopleText = ctx.researchCard.keyPeople
    }
  }

  const systemPrompt = `${GROUND_RULES}

You are a B2B stakeholder mapping specialist.
Map the decision-making landscape at this company — who holds power,
who influences, and where the champions might be.

OUTPUT FORMAT: Valid JSON only.
{
  "decisionMakers": [
    { "name": "Name", "title": "Title", "role": "economic_buyer|technical_buyer|user_buyer|sponsor", "influence": "high|medium|low", "evidence": "Why we believe this" }
  ],
  "influencers": [
    { "name": "Name", "title": "Title", "influenceArea": "What they influence", "relationship": "How they relate to decision makers" }
  ],
  "champions": [
    { "name": "Name", "title": "Title", "evidence": "Why they might be a champion", "engagementStrategy": "How to nurture this relationship" }
  ],
  "blockers": [
    { "name": "Name or role", "title": "Title", "concern": "What they might object to", "counterApproach": "How to handle" }
  ],
  "relationshipSummary": "Overall stakeholder landscape assessment",
  "engagementPriority": "Who to engage first and why"
}`

  const userPrompt = `Map the stakeholders for:

Company: ${ctx.company.rawName}
Industry: ${ctx.company.industry || 'Unknown'}
Size: ${ctx.company.sizeRange || 'Unknown'}

COMPANY RESEARCH:
${researchText}

KEY PEOPLE FROM RESEARCH:
${keyPeopleText}

ACTIVE SIGNALS:
${signalText}

CRM CONTACTS:
${contactText}

Generate the stakeholder map.`

  const raw = await callAIForAction(systemPrompt, userPrompt)
  const content = parseJSONResponse(raw)
  return {
    content,
    summary: String(content.engagementPriority || content.relationshipSummary || 'Stakeholder map generated'),
    confidence: 0.7,
  }
}

/**
 * 5. Opportunity Qualification
 * Buying signals, timing, strategic fit, confidence scoring.
 */
async function generateOpportunityQualification(ctx: ActionContext): Promise<{ content: Record<string, unknown>; summary: string; confidence: number }> {
  const signalText = formatSignalsForPrompt(ctx.signals)
  const researchText = formatResearchForPrompt(ctx.researchCard)
  const insightText = formatInsightsForPrompt(ctx.insights)

  const systemPrompt = `${GROUND_RULES}

You are a B2B opportunity qualification specialist.
Assess whether this company represents a real sales opportunity
and qualify it using evidence-based scoring.

OUTPUT FORMAT: Valid JSON only.
{
  "buyingSignals": [
    { "signal": "Specific buying indicator", "strength": "strong|moderate|weak", "evidence": "Supporting data", "signalId": "Source signal reference" }
  ],
  "timingIndicators": {
    "window": "immediate|within_30_days|within_90_days|uncertain",
    "evidence": "What tells us about their timing",
    "triggers": ["Events that might accelerate their buying decision"]
  },
  "strategicFit": {
    "overallFit": "high|medium|low",
    "reasoning": "Why this is or isn't a good fit",
    "idealCustomerProfileMatch": "How well they match ICP criteria"
  },
  "confidenceScore": 75,
  "budgetIndicators": ["Evidence of budget availability or constraints"],
  "competitiveThreats": ["Known competitors in play"],
  "verdict": "QUALIFY|DEVELOP|INVEST|DISQUALIFY",
  "nextStep": "Immediate recommended action based on qualification"
}`

  const userPrompt = `Qualify the opportunity for:

Company: ${ctx.company.rawName}
Industry: ${ctx.company.industry || 'Unknown'}
Size: ${ctx.company.sizeRange || 'Unknown'}
Current Status: ${ctx.company.status} | Lifecycle: ${ctx.company.lifecycleStage}

COMPANY RESEARCH:
${researchText}

ACTIVE SIGNALS (${ctx.signals.length}):
${signalText}

STRATEGIC INSIGHTS:
${insightText}

Generate the opportunity qualification.`

  const raw = await callAIForAction(systemPrompt, userPrompt)
  const content = parseJSONResponse(raw)
  const verdict = String(content.verdict || 'ASSESS')
  return {
    content,
    summary: `Verdict: ${verdict} | Confidence: ${content.confidenceScore || 'N/A'}%`,
    confidence: (Number(content.confidenceScore) || 50) / 100,
  }
}

/**
 * 6. Next Best Action (NBA)
 * THE final output: "What should the salesperson do next and why?"
 * This runs LAST and consumes all other 5 action outputs.
 */
async function generateNextBestAction(
  ctx: ActionContext,
  previousActions: Map<ActionType, { content: Record<string, unknown>; summary: string }>,
): Promise<{ content: Record<string, unknown>; summary: string; confidence: number }> {
  const meetingPrep = previousActions.get('meeting_prep')
  const outreach = previousActions.get('executive_outreach')
  const strategy = previousActions.get('account_strategy')
  const stakeholder = previousActions.get('stakeholder_map')
  const qualification = previousActions.get('opportunity_qualification')

  const internalSignalsText = formatInternalSignalsForPrompt(ctx.internalSignals)
  const notesText = formatCompanyNotesForPrompt(ctx.companyNotes)
  const contactNotesText = formatContactNotesForPrompt(ctx.contactNotes)
  const timelineText = formatTimelineForPrompt(ctx.timelineEvents)

  // Determine intelligence balance for confidence calibration
  const externalCount = ctx.signals.length
  const internalCount = ctx.internalSignals.length + ctx.companyNotes.length + ctx.contactNotes.length
  const hasBothSources = externalCount > 0 && internalCount > 0
  const isInternalHeavy = internalCount > externalCount
  const balanceNote = hasBothSources
    ? 'INTELLIGENCE BALANCE: Both external signals and internal memory available — high confidence'
    : isInternalHeavy
    ? 'INTELLIGENCE BALANCE: Primarily internal memory (common for small/mid-market companies) — moderate-high confidence'
    : 'INTELLIGENCE BALANCE: Primarily external signals — standard confidence'

  const systemPrompt = `${GROUND_RULES}

You are a B2B sales intelligence system. Your job is to answer ONE question:
"What should the salesperson do next, and why?"

You are given the outputs of 5 analysis modules PLUS internal memory data.
Synthesize everything into a single, prioritized, actionable recommendation.

CRITICAL: Do not ignore internal memory. For many companies (especially small/mid-market),
internal notes, meeting records, and contact observations are MORE valuable than external
news signals. Always prioritize the most recent and highest-confidence data regardless of source.

OUTPUT FORMAT: Valid JSON only.
{
  "action": "The single most important action to take right now (one sentence)",
  "actionType": "email|call|meeting|research|linkedin|internal_review",
  "target": {
    "person": "Who to target (name or role)",
    "company": "Company name"
  },
  "reason": "2-3 sentence rationale — why this action, why now. Reference both external signals AND internal memory.",
  "urgency": "immediate|today|this_week|this_month",
  "effort": "low|medium|high",
  "expectedOutcome": "What success looks like",
  "evidenceLinks": [
    { "type": "signal|contact|insight|internal_note|contact_note|timeline", "reference": "Brief reference to supporting data" }
  ],
  "alternativeActions": [
    { "action": "What else could be done", "priority": 2, "reason": "Why this is second priority" }
  ],
  "confidence": 80,
  "suggestedMessage": "If this is an email/linkedin action, provide the message text"
}`

  const userPrompt = `Based on the following intelligence analysis, determine the NEXT BEST ACTION:

COMPANY: ${ctx.company.rawName}
Industry: ${ctx.company.industry || 'Unknown'}
Size: ${ctx.company.sizeRange || 'Unknown'}

${balanceNote}

=== MEETING PREP SUMMARY ===
${meetingPrep?.summary || 'Not generated'}

=== EXECUTIVE OUTREACH SUMMARY ===
${outreach?.summary || 'Not generated'}

=== ACCOUNT STRATEGY SUMMARY ===
${strategy?.summary || 'Not generated'}
Key priorities: ${JSON.stringify(
  Array.isArray(strategy?.content?.businessPriorities)
    ? (strategy.content.businessPriorities as unknown[]).slice(0, 3)
    : 'N/A'
)}

=== STAKEHOLDER MAP SUMMARY ===
${stakeholder?.summary || 'Not generated'}
Engagement priority: ${stakeholder?.content?.engagementPriority || 'N/A'}

=== OPPORTUNITY QUALIFICATION ===
${qualification?.summary || 'Not generated'}
Verdict: ${qualification?.content?.verdict || 'N/A'}
Next step: ${qualification?.content?.nextStep || 'N/A'}

=== TOP EXTERNAL SIGNALS (${ctx.signals.length}) ===
${ctx.signals.slice(0, 3).map((s, i) => `${i + 1}. ${s.title} (${s.signalType}) — ${s.businessImpact || 'No impact assessed'}`).join('\n')}

=== INTERNAL MEMORY SIGNALS (${ctx.internalSignals.length}) ===
${internalSignalsText}

=== RECENT NOTES & MEETINGS (${ctx.companyNotes.length}) ===
${notesText}

=== CONTACT OBSERVATIONS (${ctx.contactNotes.length}) ===
${contactNotesText}

=== RECENT ACTIVITY TIMELINE (${ctx.timelineEvents.length}) ===
${timelineText}

=== TOP CONTACTS ===
${ctx.contacts.slice(0, 3).map((c, i) => `${i + 1}. ${c.rawName} (${c.title || c.role || 'Unknown'}) — Lead Score: ${c.leadScore}`).join('\n')}

What should the salesperson do NEXT and why? Ground your answer in BOTH external and internal intelligence.`

  const raw = await callAIForAction(systemPrompt, userPrompt)
  const content = parseJSONResponse(raw)
  const action = String(content.action || 'Review intelligence and plan engagement')
  return {
    content,
    summary: action,
    confidence: (Number(content.confidence) || 70) / 100,
  }
}

// ─── Persistence ───────────────────────────────────────────────

async function persistActionArtifact(
  companyId: string,
  actionType: ActionType,
  summary: string,
  content: Record<string, unknown>,
  confidence: number,
  signalCount: number,
  contactCount: number,
): Promise<string> {
  // Calculate priority score from confidence + content quality heuristics
  let priorityScore = Math.round(confidence * 100)
  if (actionType === 'next_best_action') priorityScore = Math.min(100, priorityScore + 10)
  if (actionType === 'opportunity_qualification') priorityScore = Math.min(100, priorityScore + 5)

  // Build evidence references from content
  const evidenceRefs: Array<{ type: string; id: string; snippet: string }> = []
  // Extract signal references if present
  const rawEvidence = content.evidenceLinks || content.evidenceReferences || []
  if (Array.isArray(rawEvidence)) {
    for (const ref of rawEvidence.slice(0, 10)) {
      if (typeof ref === 'object' && ref !== null) {
        evidenceRefs.push({
          type: String((ref as Record<string, unknown>).type || 'unknown'),
          id: String((ref as Record<string, unknown>).id || ''),
          snippet: String((ref as Record<string, unknown>).reference || (ref as Record<string, unknown>).snippet || ''),
        })
      }
    }
  }

  // Upsert: replace existing artifact of same type for this company
  const existing = await db.actionArtifact.findFirst({
    where: { companyId, actionType, status: { in: ['draft', 'approved'] } },
  })

  if (existing) {
    await db.actionArtifact.update({
      where: { id: existing.id },
      data: {
        summary,
        content: JSON.stringify(content),
        confidence,
        priorityScore,
        evidenceReferences: JSON.stringify(evidenceRefs),
        sourceSignalCount: signalCount,
        sourceContactCount: contactCount,
        status: 'draft',
        updatedAt: new Date(),
      },
    })
    return existing.id
  }

  const artifact = await db.actionArtifact.create({
    data: {
      companyId,
      actionType,
      summary,
      content: JSON.stringify(content),
      confidence,
      priorityScore,
      evidenceReferences: JSON.stringify(evidenceRefs),
      sourceSignalCount: signalCount,
      sourceContactCount: contactCount,
      status: 'draft',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30-day expiry
    },
  })
  return artifact.id
}

// ─── Master Orchestrator ────────────────────────────────────────

/**
 * Generate all 6 action types for a company.
 * This is the main entry point called by the Sprint 3 API route.
 *
 * Flow:
 *   1. Gather context (signals, contacts, evidence, research, insights)
 *   2. Generate actions 1-5 in parallel
 *   3. Generate action 6 (Next Best Action) — depends on 1-5
 *   4. Persist all to ActionArtifact
 *   5. Return unified response
 */
export async function generateCompanyActions(companyId: string): Promise<Sprint3FullResponse> {
  const startTime = Date.now()
  const errors: string[] = []

  // Step 1: Gather context
  const ctx = await gatherCompanyContext(companyId)

  // Step 2: Generate first 5 action types in sequence
  // (Parallel would be faster but risks rate-limiting the LLM)
  const previousActions = new Map<ActionType, { content: Record<string, unknown>; summary: string }>()

  const generators = [
    { type: 'meeting_prep' as ActionType, fn: generateMeetingPrep },
    { type: 'executive_outreach' as ActionType, fn: generateExecutiveOutreach },
    { type: 'account_strategy' as ActionType, fn: generateAccountStrategy },
    { type: 'stakeholder_map' as ActionType, fn: generateStakeholderMap },
    { type: 'opportunity_qualification' as ActionType, fn: generateOpportunityQualification },
  ]

  for (const gen of generators) {
    try {
      const result = await gen.fn(ctx)
      previousActions.set(gen.type, { content: result.content, summary: result.summary })
      await persistActionArtifact(
        companyId,
        gen.type,
        result.summary,
        result.content,
        result.confidence,
        ctx.signals.length,
        ctx.contacts.length,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${gen.type}: ${msg}`)
      console.warn(`[action-engine] ${gen.type} generation failed:`, msg)
    }
  }

  // Step 3: Generate Next Best Action (depends on 1-5)
  try {
    const nbaResult = await generateNextBestAction(ctx, previousActions)
    previousActions.set('next_best_action', { content: nbaResult.content, summary: nbaResult.summary })
    await persistActionArtifact(
      companyId,
      'next_best_action',
      nbaResult.summary,
      nbaResult.content,
      nbaResult.confidence,
      ctx.signals.length,
      ctx.contacts.length,
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`next_best_action: ${msg}`)
    console.warn(`[action-engine] next_best_action generation failed:`, msg)
  }

  // Step 4: Build response
  const actions: ActionArtifactResponse[] = []

  // Calculate intelligence balance
  const externalCount = ctx.signals.length
  const internalCount = ctx.internalSignals.length + ctx.companyNotes.length + ctx.contactNotes.length
  const intelligenceBalance: Sprint3FullResponse['context']['intelligenceBalance'] =
    externalCount === 0 && internalCount === 0 ? 'empty' :
    internalCount > externalCount * 2 ? 'internal_heavy' :
    externalCount > internalCount * 2 ? 'external_heavy' : 'balanced'

  for (const actionType of ACTION_TYPES) {
    const prev = previousActions.get(actionType)
    if (prev) {
      const artifact = await db.actionArtifact.findFirst({
        where: { companyId, actionType },
        orderBy: { generatedAt: 'desc' },
      })
      actions.push({
        actionType,
        summary: prev.summary,
        content: prev.content,
        priorityScore: artifact?.priorityScore || Math.round((prev.content.confidence as number || 0.5) * 100),
        confidence: Number(prev.content.confidence) || 0.5,
        evidenceReferences: artifact ? JSON.parse(artifact.evidenceReferences) : [],
        sourceSignalCount: ctx.signals.length,
        sourceContactCount: ctx.contacts.length,
      })
    }
  }

  return {
    company: {
      id: ctx.company.id,
      name: ctx.company.rawName,
      industry: ctx.company.industry,
      domain: ctx.company.domain,
      sizeRange: ctx.company.sizeRange,
      country: ctx.company.country,
    },
    context: {
      signalCount: ctx.signals.length,
      contactCount: ctx.contacts.length,
      evidenceCount: ctx.evidence.length,
      insightCount: ctx.insights.length,
      companyNotesCount: ctx.companyNotes.length,
      contactNotesCount: ctx.contactNotes.length,
      timelineEventsCount: ctx.timelineEvents.length,
      internalSignalsCount: ctx.internalSignals.length,
      humanIntelCount: ctx.humanIntelligence.length,
      intelligenceBalance,
    },
    actions,
    meta: {
      pipelineLatencyMs: Date.now() - startTime,
      aiModelUsed: errors.length < ACTION_TYPES.length,
      actionsGenerated: actions.length,
      errors,
    },
  }
}

// ─── Quick Next-Best-Action Only ────────────────────────────────

/**
 * Quick endpoint: generate only the Next Best Action for a company.
 * Uses cached actions 1-5 if they exist, generates them if not.
 */
export async function generateNextBestActionOnly(companyId: string): Promise<ActionArtifactResponse> {
  // Check if we have recent actions 1-5
  const existingActions = await db.actionArtifact.findMany({
    where: {
      companyId,
      actionType: { in: ACTION_TYPES.filter(t => t !== 'next_best_action') },
      status: { in: ['draft', 'approved'] },
      generatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // within last 24h
    },
  })

  let previousActions = new Map<ActionType, { content: Record<string, unknown>; summary: string }>()

  if (existingActions.length >= 3) {
    // We have enough cached context — use it
    for (const artifact of existingActions) {
      try {
        const content = JSON.parse(artifact.content)
        previousActions.set(artifact.actionType as ActionType, { content, summary: artifact.summary })
      } catch {
        // Skip malformed
      }
    }
  }

  // If not enough cached, generate the full suite
  if (previousActions.size < 3) {
    const fullResult = await generateCompanyActions(companyId)
    const nba = fullResult.actions.find(a => a.actionType === 'next_best_action')
    if (nba) return nba
    throw new Error('Failed to generate Next Best Action')
  }

  // Generate NBA from cached context
  const ctx = await gatherCompanyContext(companyId)
  const result = await generateNextBestAction(ctx, previousActions)
  await persistActionArtifact(companyId, 'next_best_action', result.summary, result.content, result.confidence, ctx.signals.length, ctx.contacts.length)

  return {
    actionType: 'next_best_action',
    summary: result.summary,
    content: result.content,
    priorityScore: Math.round(result.confidence * 100) + 10,
    confidence: result.confidence,
    evidenceReferences: [],
    sourceSignalCount: ctx.signals.length,
    sourceContactCount: ctx.contacts.length,
  }
}

// ─── Retrieve Cached Actions ────────────────────────────────────

/**
 * Retrieve the most recent action artifacts for a company.
 * Returns cached results without calling the AI.
 */
export async function getCachedActions(companyId: string): Promise<ActionArtifactResponse[]> {
  const artifacts = await db.actionArtifact.findMany({
    where: { companyId, status: { in: ['draft', 'approved'] } },
    orderBy: { generatedAt: 'desc' },
  })

  // Deduplicate by actionType (keep most recent)
  const seen = new Set<string>()
  const results: ActionArtifactResponse[] = []

  for (const artifact of artifacts) {
    if (seen.has(artifact.actionType)) continue
    seen.add(artifact.actionType)

    let content: Record<string, unknown> = {}
    try {
      content = JSON.parse(artifact.content)
    } catch {
      content = { raw: artifact.content }
    }

    results.push({
      actionType: artifact.actionType as ActionType,
      summary: artifact.summary,
      content,
      priorityScore: artifact.priorityScore,
      confidence: artifact.confidence,
      evidenceReferences: JSON.parse(artifact.evidenceReferences),
      sourceSignalCount: artifact.sourceSignalCount,
      sourceContactCount: artifact.sourceContactCount,
    })
  }

  return results
}
