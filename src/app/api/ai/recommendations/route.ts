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
  aiEnhanced?: boolean
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
// Rule-based recommendation generators (unchanged — collect raw data)
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
      OR: [
        { lastContactedAt: null },
        { lastContactedAt: { lte: fourteenDaysAgo } },
      ],
    },
    include: { company: { select: { normalizedName: true } } },
    take: 10,
    orderBy: { lastContactedAt: 'asc' },
  })

  return contacts.map((c) => ({
    type: 'follow_up' as const,
    priority: 'high' as const,
    entityType: 'contact' as const,
    entityId: c.id,
    entityName: c.normalizedName || c.rawName || 'Unknown',
    action: `Follow up with ${c.normalizedName || c.rawName || 'Unknown'} at ${c.company?.normalizedName || 'Unknown'}`,
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
    },
    include: { company: { select: { normalizedName: true } } },
    take: 5,
  })

  return contacts.map((c) => ({
    type: 'validate' as const,
    priority: 'medium' as const,
    entityType: 'contact' as const,
    entityId: c.id,
    entityName: c.normalizedName,
    action: `Validate email for ${c.normalizedName}`,
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
    entityName: c.normalizedName,
    action: `Generate research card for ${c.normalizedName}`,
    reasoning: `${c.status} company has no AI research card — run research to unlock insights`,
  }))
}

/**
 * 4. Draft pending: Contacts with draft status='draft' → email
 */
async function draftPending(): Promise<Recommendation[]> {
  // Find drafts in 'draft' status with their non-archived contacts
  const drafts = await db.draft.findMany({
    where: { status: 'pending_review' },
    include: {
      contact: {
        include: { company: { select: { normalizedName: true } } },
      },
    },
    take: 5,
    orderBy: { createdAt: 'desc' },
  })

  return drafts
    .filter((d) => d.contact !== null && d.contact.status !== 'archived')
    .map((d) => ({
      type: 'email' as const,
      priority: 'high' as const,
      entityType: 'contact' as const,
      entityId: d.contact.id,
      entityName: d.contact.normalizedName,
      action: `Review and send draft to ${d.contact.normalizedName}`,
      reasoning: `Email draft "${d.subject}" is ready for review and sending`,
    }))
}

/**
 * 5. Hot opportunities: Opportunities in 'negotiation' stage → meeting
 */
async function hotOpportunities(): Promise<Recommendation[]> {
  const companies = await db.company.findMany({
    where: { lifecycleStage: 'negotiation' },
    take: 5,
    orderBy: { updatedAt: 'desc' },
  })

  return companies.map((c) => ({
    type: 'meeting' as const,
    priority: 'high' as const,
    entityType: 'company' as const,
    entityId: c.id,
      entityName: c.normalizedName,
    action: `Schedule meeting with ${c.normalizedName}`,
    reasoning: `Company is in negotiation lifecycle stage — schedule a meeting to advance the deal`,
  }))
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
    entityName: c.normalizedName,
    action: `Add contacts to ${c.normalizedName}`,
    reasoning: `New company with no contacts added yet — identify and add key people`,
  }))
}

/**
 * 7. Won recently: Companies with won opportunities in last 7 days → follow_up (cross-sell)
 */
async function wonRecently(): Promise<Recommendation[]> {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const companies = await db.company.findMany({
    where: {
      status: 'closed_won',
      updatedAt: { gte: sevenDaysAgo },
    },
    take: 5,
    orderBy: { updatedAt: 'desc' },
  })

  return companies.map((c) => ({
    type: 'cross_sell' as const,
    priority: 'high' as const,
    entityType: 'company' as const,
    entityId: c.id,
    entityName: c.normalizedName,
    action: `Follow up with ${c.normalizedName} for cross-sell opportunities`,
    reasoning: `Company was recently marked as closed_won — capitalize on the momentum for additional business`,
  }))
}

// ---------------------------------------------------------------------------
// AI Enhancement via z-ai-web-dev-sdk
// ---------------------------------------------------------------------------

const RECOMMENDATION_SYSTEM_PROMPT = `You are a senior B2B sales strategist and revenue operations analyst. You receive a batch of rule-generated recommendations from a CRM system. Your job is to enhance each one with deep strategic intelligence.

For each recommendation, you must:

1. **Re-assess priority** — consider revenue impact, timing urgency, and relationship warmth. A negotiation-stage deal is almost always higher priority than a research task. A recently-won deal has a narrow cross-sell window. A stale contact at a high-value account is more urgent than one at a small prospect.

2. **Rewrite reasoning** — replace the generic rule explanation with specific, actionable strategic reasoning. Explain WHY this action matters RIGHT NOW. Reference the business context implied by the data (e.g., "negotiation stage means budget is allocated — delay risks losing the deal to a competitor").

3. **Suggest best timing/approach** — embed timing and approach guidance directly into the reasoning (e.g., "Best approached Tuesday-Thursday morning with a value-add email referencing their Q3 initiative").

4. **Identify cross-sell/upsell** — if a recommendation involves a company where you can infer adjacent opportunities (e.g., a won deal suggests expansion to other departments, a negotiation signals related service lines), surface those in the reasoning.

5. **Spot patterns the rules miss** — if multiple recommendations relate to the same company, flag the connection. If a contact is both stale AND has a draft pending, elevate urgency.

Return ONLY a valid JSON array. Each element must have these exact fields:
- "entityId": string (MUST match the input exactly — this is the database ID)
- "priority": "high" | "medium" | "low"
- "action": string (improved, specific action — max 120 chars)
- "reasoning": string (2-3 sentences of specific strategic reasoning — max 300 chars)

Do NOT change entityType, entityName, or type. Do NOT add or remove recommendations.
Respond ONLY with valid JSON, no markdown fences, no explanation.`

interface RawAIRecommendation {
  entityId?: string
  priority?: string
  action?: string
  reasoning?: string
}

const VALID_PRIORITIES: Priority[] = ['high', 'medium', 'low']

function buildAIUserPrompt(recs: Recommendation[]): string {
  const items = recs.map((r, i) => {
    return `[${i}] {
  "type": "${r.type}",
  "priority": "${r.priority}",
  "entityType": "${r.entityType}",
  "entityId": "${r.entityId}",
  "entityName": "${r.entityName}",
  "action": "${r.action.replace(/"/g, '\\"')}",
  "reasoning": "${r.reasoning.replace(/"/g, '\\"')}"
}`
  }).join(',\n')

  return `Analyze and enhance these ${recs.length} CRM recommendations. Re-prioritize, improve reasoning, add timing/approach guidance, and identify cross-sell opportunities.\n\n[\n${items}\n]`
}

function parseAIResponse(raw: string, originals: Recommendation[]): Recommendation[] {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

  let aiRecs: RawAIRecommendation[] = []

  // Try direct JSON parse first
  try {
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) {
      aiRecs = parsed
    }
  } catch {
    // Regex fallback: extract individual objects by entityId
    const objRegex = /\{\s*"entityId"\s*:\s*"[^"]+"/g
    let match = objRegex.exec(cleaned)
    while (match) {
      try {
        let depth = 0
        let start = match.index
        let end = start
        for (let i = start; i < cleaned.length; i++) {
          if (cleaned[i] === '{') depth++
          else if (cleaned[i] === '}') depth--
          if (depth === 0) { end = i + 1; break }
        }
        aiRecs.push(JSON.parse(cleaned.slice(start, end)))
      } catch {
        // skip malformed
      }
      match = objRegex.exec(cleaned)
    }
  }

  // Build a lookup from entityId → AI enhancement
  const aiMap = new Map<string, RawAIRecommendation>()
  for (const ai of aiRecs) {
    if (ai.entityId) {
      aiMap.set(ai.entityId, ai)
    }
  }

  // Merge AI enhancements into the original recommendations
  const enhanced: Recommendation[] = originals.map((orig) => {
    const ai = aiMap.get(orig.entityId)
    if (!ai) return { ...orig, aiEnhanced: true }

    const priority = VALID_PRIORITIES.includes(ai.priority as Priority)
      ? (ai.priority as Priority)
      : orig.priority

    return {
      ...orig,
      priority,
      action: ai.action && ai.action.length > 5 ? ai.action.slice(0, 120) : orig.action,
      reasoning: ai.reasoning && ai.reasoning.length > 10 ? ai.reasoning.slice(0, 300) : orig.reasoning,
      aiEnhanced: true,
    }
  })

  return enhanced
}

async function enhanceWithAI(recs: Recommendation[]): Promise<Recommendation[]> {
  if (recs.length === 0) return recs

  const { ensureZaiConfig } = await import('@/lib/zai-config');
  await ensureZaiConfig();
  const ZAI = await import('z-ai-web-dev-sdk').then((m) => m.default).then((Z) => Z.create())

  const completion = await ZAI.chat.completions.create({
    messages: [
      { role: 'assistant', content: RECOMMENDATION_SYSTEM_PROMPT },
      { role: 'user', content: buildAIUserPrompt(recs) },
    ],
    thinking: { type: 'disabled' },
  })

  const raw = completion.choices?.[0]?.message?.content ?? ''

  if (!raw || raw.length < 10) {
    console.warn('[ai/recommendations] AI returned empty or too-short response, using rule-based fallback')
    return recs
  }

  return parseAIResponse(raw, recs)
}

// ---------------------------------------------------------------------------
// GET /api/ai/recommendations
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    // Phase 1: Run all rule-based generators in parallel
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

    if (all.length === 0) {
      return apiSuccess({ recommendations: [] })
    }

    // Phase 2: Enhance with AI — graceful fallback on any failure
    let enhanced: Recommendation[]
    try {
      enhanced = await enhanceWithAI(all)
      // Sort by AI-reassessed priority
      enhanced = sortRecommendations(enhanced)
    } catch (err) {
      console.warn(
        '[ai/recommendations] AI enhancement failed, returning rule-based recommendations:',
        err instanceof Error ? err.message : err,
      )
      enhanced = sortRecommendations(all).map((r) => ({ ...r, aiEnhanced: false }))
    }

    // Limit to top 20
    const sorted = enhanced.slice(0, 20)

    return apiSuccess({ recommendations: sorted })
  } catch {
    return apiError('Failed to generate recommendations')
  }
}