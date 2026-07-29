/**
 * Sprint 3A: Unified Memory Query Engine
 *
 * The "What do we know about this account?" API.
 * Combines all three intelligence layers into a single comprehensive view:
 *
 *   1. EXTERNAL INTELLIGENCE — Web search signals (Sprint 1)
 *   2. INTERNAL MEMORY — CRM notes, strategies, research cards (Sprint 3A)
 *   3. PEOPLE INTELLIGENCE — Contact profiles, influence scores, relationships (Sprint 3A)
 *
 * This is the core value proposition of DeepMindQ as a "ChatGPT memory layer
 * for accounts" — one query returns everything the sales team knows about
 * an account, ranked and organized for action.
 */

import { db } from '@/lib/db'
import { computeInternalMemoryDepth, type InternalMemoryResult } from './internal-memory-connector'

// ── Types ──

export interface UnifiedMemoryQuery {
  companyId: string
  companyName: string
  industry: string | null
  domain: string | null
  sizeRange: string | null
  country: string | null

  // Intelligence Layer Summary
  layers: {
    external: ExternalLayerSummary
    internal: InternalLayerSummary
    people: PeopleLayerSummary
  }

  // Composite Intelligence Score
  compositeScore: {
    overall: number           // 0-100
    external: number         // 0-100
    internal: number         // 0-100
    people: number           // 0-100
    grade: string            // A+, A, B, C, D, F
    scenario: string         // enterprise, midmarket, small_company
    scenarioReason: string   // Why this scenario was classified
  }

  // Top signals across all layers (ranked)
  topSignals: Array<{
    rank: number
    signal: string
    signalType: string
    source: 'external' | 'internal' | 'people'
    severity: string
    confidence: number
    businessImpact: string
  }>

  // Key Contacts (people intelligence summary)
  keyContacts: Array<{
    name: string
    title: string | null
    email: string
    buyingRole: string
    influenceScore: number
    relationshipStrength: string
    daysSinceContact: number
    leadScore: number
  }>

  // Account Risks & Opportunities
  risks: string[]
  opportunities: string[]

  // Recommended Actions (priority-ordered)
  recommendedActions: string[]

  // Memory Gaps — what we DON'T know
  memoryGaps: string[]

  // Meta
  meta: {
    totalSignals: number
    externalSignals: number
    internalSignals: number
    peopleSignals: number
    internalMemoryDepth: number
    internalMemoryGrade: string
    queryLatencyMs: number
  }
}

interface ExternalLayerSummary {
  signalCount: number
  topSignalTypes: Array<{ type: string; count: number }>
  averageConfidence: number
  lastExternalSearch: string | null
  coverage: 'rich' | 'moderate' | 'sparse' | 'empty'
}

interface InternalLayerSummary {
  signalCount: number
  noteCount: number
  hasStrategy: boolean
  hasResearchCard: boolean
  hasSwot: boolean
  humanIntelligenceCount: number
  memoryDepth: number
  memoryGrade: string
}

interface PeopleLayerSummary {
  totalContacts: number
  mappedContacts: number
  highInfluence: number
  activeEngagement: number
  championCount: number
  stakeholderGaps: string[]
  coverageScore: number
}

// ═══════════════════════════════════════════════════════════════
// MAIN QUERY FUNCTION
// ═══════════════════════════════════════════════════════════════

export async function queryUnifiedMemory(
  companyId: string
): Promise<UnifiedMemoryQuery> {
  const startTime = Date.now()

  // ── 0. Fetch company ──
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      rawName: true,
      normalizedName: true,
      industry: true,
      domain: true,
      sizeRange: true,
      country: true,
      location: true,
      website: true,
      intelligenceScore: true,
      status: true,
      lifecycleStage: true,
    },
  })

  if (!company) throw new Error(`Company ${companyId} not found`)

  // ── 1. EXTERNAL LAYER: Fetch signals from Sprint 1/2 pipeline ──
  const externalSignals = await db.companySignal.findMany({
    where: {
      companyId,
      signalType: { notIn: ['internal_memory', 'people_change'] },
      status: { in: ['detected', 'validated', 'active'] },
    },
    orderBy: { confidence: 'desc' },
    take: 20,
  })

  // ── 2. INTERNAL LAYER: Compute memory depth + fetch internal signals ──
  const [internalMemoryDepth, internalSignals, companyNotes, strategies, researchCard, humanInbox] =
    await Promise.all([
      computeInternalMemoryDepth(companyId),
      db.companySignal.findMany({
        where: {
          companyId,
          signalType: 'internal_memory',
          status: { in: ['detected', 'validated', 'active'] },
        },
        orderBy: { confidence: 'desc' },
        take: 15,
      }),
      db.companyNote.count({ where: { companyId } }),
      db.accountStrategy.count({ where: { companyId, status: { not: 'archived' } } }),
      db.companyResearchCard.findUnique({ where: { companyId } }),
      db.humanIntelligenceInbox.count({ where: { companyId, status: { not: 'rejected' } } }),
    ])

  const hasSwot = await db.companyNote.findFirst({
    where: { companyId, category: 'swot' },
    select: { id: true },
  })

  // ── 3. PEOPLE LAYER: Contact analysis ──
  const contacts = await db.contact.findMany({
    where: { companyId, status: { not: 'archived' } },
    include: { _count: { select: { replies: true, notes: true } } },
    orderBy: { leadScore: 'desc' },
  })

  const peopleSignals = await db.companySignal.findMany({
    where: {
      companyId,
      signalType: 'people_change',
      status: { in: ['detected', 'validated', 'active'] },
    },
    orderBy: { confidence: 'desc' },
    take: 10,
  })

  // ── Classify buying roles (lightweight, no full engine call) ──
  function classifyRole(title: string | null | undefined): string {
    const t = (title || '').toLowerCase()
    if (/ceo|cfo|coo|president|chief executive|chief financial|chief operating/.test(t)) return 'economic_buyer'
    if (/cto|cio|chief technology|chief information|vp engineering|vp technology/.test(t)) return 'technical_buyer'
    if (/vp|svp|evp|vice president/.test(t)) return 'coach'
    if (/director|head|lead|senior manager/.test(t)) return 'champion'
    return 'user'
  }

  function calcInfluence(title: string | null | undefined): number {
    const t = (title || '').toLowerCase()
    if (/ceo|president|chief executive/.test(t)) return 95
    if (/cto|cio|chief technology|chief information/.test(t)) return 92
    if (/cfo|chief financial/.test(t)) return 88
    if (/vp|svp|evp|vice president/.test(t)) return 78
    if (/director|head|principal/.test(t)) return 65
    if (/senior manager|senior lead/.test(t)) return 55
    if (/manager|lead/.test(t)) return 45
    return 30
  }

  const keyContacts = contacts.slice(0, 10).map(c => {
    const daysSince = c.lastContactedAt
      ? Math.floor((Date.now() - c.lastContactedAt.getTime()) / 86400000)
      : 999
    return {
      name: c.rawName,
      title: c.title || c.role,
      email: c.email,
      buyingRole: classifyRole(c.title),
      influenceScore: calcInfluence(c.title),
      relationshipStrength: c._count.replies >= 3 ? 'strong' : c._count.replies >= 1 ? 'warm' : daysSince < 14 ? 'cold' : 'none',
      daysSinceContact: daysSince,
      leadScore: c.leadScore,
    }
  })

  // ── Stakeholder gap analysis ──
  const titles = contacts.map(c => (c.title || c.role || '').toLowerCase())
  const stakeholderGaps: string[] = []
  if (!titles.some(t => /ceo|cfo|coo|president|chief/.test(t))) stakeholderGaps.push('No C-suite contact')
  if (!titles.some(t => /cto|cio|vp engineering|vp technology/.test(t))) stakeholderGaps.push('No technology executive')
  if (!titles.some(t => /director|head|lead/.test(t))) stakeholderGaps.push('No mid-level champion')

  // ── 4. Build Top Signals (merged across layers, ranked) ──
  const allSignalsForRanking = [
    ...externalSignals.map(s => ({
      signal: s.title,
      signalType: s.signalType,
      source: 'external' as const,
      severity: s.severity,
      confidence: Math.round(s.confidence * 100),
      businessImpact: s.businessImpact || '',
    })),
    ...internalSignals.map(s => ({
      signal: s.title,
      signalType: s.signalType,
      source: 'internal' as const,
      severity: s.severity,
      confidence: Math.round(s.confidence * 100),
      businessImpact: s.businessImpact || '',
    })),
    ...peopleSignals.map(s => ({
      signal: s.title,
      signalType: s.signalType,
      source: 'people' as const,
      severity: s.severity,
      confidence: Math.round(s.confidence * 100),
      businessImpact: s.businessImpact || '',
    })),
  ].sort((a, b) => b.confidence - a.confidence).slice(0, 15)

  const topSignals = allSignalsForRanking.map((s, i) => ({ rank: i + 1, ...s }))

  // ── 5. Risks & Opportunities ──
  const risks: string[] = []
  const opportunities: string[] = []

  // From external signals
  for (const s of externalSignals) {
    const title = (s.title || '').toLowerCase()
    if (/risk|threat|challenge|decline|loss|layoff|downsize/.test(title)) {
      risks.push(s.title.substring(0, 100))
    }
    if (/growth|expand|hire|fund|partner|launch|win|new/.test(title)) {
      opportunities.push(s.title.substring(0, 100))
    }
  }

  // From internal signals
  if (stakeholderGaps.length >= 2) risks.push('Critical stakeholder gaps — missing multiple buying roles')
  const championRisk = contacts.filter(c => c._count.replies >= 2 && c.leadScore >= 60 &&
    c.lastContactedAt && (Date.now() - c.lastContactedAt.getTime()) / 86400000 > 45)
  if (championRisk.length > 0) risks.push(`${championRisk.length} previously engaged contact(s) going cold`)

  // From people
  if (strategies > 0) opportunities.push('Active account strategy exists — foundation for coordinated engagement')
  if (researchCard) opportunities.push('Rich research card available — deep account knowledge for personalization')
  if (humanInbox > 0) opportunities.push(`${humanInbox} human intelligence submission(s) — team has direct account insights`)

  // ── 6. Recommended Actions ──
  const recommendedActions: string[] = []

  if (externalSignals.length === 0 && internalMemoryDepth.score < 20) {
    recommendedActions.push('CRITICAL: Zero intelligence coverage. Run Sprint 1 (external search) immediately and begin internal data capture.')
  }

  if (stakeholderGaps.length >= 2) {
    recommendedActions.push(`Fill critical stakeholder gaps: ${stakeholderGaps.slice(0, 2).join(', ')}`)
  }

  if (championRisk.length > 0) {
    recommendedActions.push(`Re-engage cold champion(s): ${championRisk.map(c => c.rawName).join(', ')}`)
  }

  if (internalMemoryDepth.score < 40) {
    recommendedActions.push('Build internal memory — add meeting notes, discovery call notes, and account strategy')
  }

  const highConfExternal = externalSignals.filter(s => s.confidence > 0.7)
  if (highConfExternal.length > 0) {
    recommendedActions.push(`Leverage ${highConfExternal.length} high-confidence external signal(s) in outreach messaging`)
  }

  if (contacts.length === 0) {
    recommendedActions.push('No contacts in account — import contacts and begin outreach')
  }

  // ── 7. Memory Gaps ──
  const memoryGaps: string[] = []
  if (companyNotes === 0) memoryGaps.push('No company notes — add discovery, meeting, and research notes')
  if (strategies === 0) memoryGaps.push('No account strategy — create one to guide coordinated engagement')
  if (!researchCard) memoryGaps.push('No research card — run account research to build knowledge base')
  if (humanInbox === 0) memoryGaps.push('No human intelligence submissions — capture team knowledge about this account')
  if (contacts.length === 0) memoryGaps.push('No contacts — import and begin relationship building')
  if (externalSignals.length === 0) memoryGaps.push('No external intelligence — run web search to gather public signals')

  // ── 8. Coverage Scores ──
  const externalCoverage = externalSignals.length >= 10 ? 'rich' as const
    : externalSignals.length >= 4 ? 'moderate' as const
    : externalSignals.length >= 1 ? 'sparse' as const
    : 'empty' as const

  const externalAvgConf = externalSignals.length > 0
    ? Math.round(externalSignals.reduce((s, sig) => s + sig.confidence, 0) / externalSignals.length * 100)
    : 0

  const peopleCoverageScore = Math.min(100,
    (contacts.length > 0 ? 30 : 0) +
    (stakeholderGaps.length === 0 ? 40 : stakeholderGaps.length === 1 ? 20 : 0) +
    (contacts.filter(c => c._count.replies > 0).length > 0 ? 30 : 0)
  )

  // ── 9. Composite Score ──
  const externalScore = externalSignals.length >= 10 ? 90
    : externalSignals.length >= 5 ? 70
    : externalSignals.length >= 2 ? 50
    : externalSignals.length >= 1 ? 30 : 0

  const internalScore = internalMemoryDepth.score
  const peopleScore = peopleCoverageScore

  // Weighted composite: external 30%, internal 40%, people 30%
  const compositeOverall = Math.round(
    (externalScore * 0.30) + (internalScore * 0.40) + (peopleScore * 0.30)
  )

  const grade = compositeOverall >= 90 ? 'A+' :
    compositeOverall >= 80 ? 'A' :
    compositeOverall >= 65 ? 'B' :
    compositeOverall >= 50 ? 'C' :
    compositeOverall >= 30 ? 'D' : 'F'

  // Scenario classification
  const scenario = externalScore >= 50 && company.sizeRange === 'enterprise'
    ? 'enterprise'
    : (externalScore < 30 && internalScore >= 40) || (externalScore < 30 && company.sizeRange === 'small')
      ? 'small_company'
      : 'midmarket'

  const scenarioReason = scenario === 'enterprise'
    ? 'Rich external intelligence + large company size = enterprise scenario. Full intelligence picture available.'
    : scenario === 'small_company'
      ? 'Sparse external intelligence + internal memory dependence = small company scenario. CRM memory is primary intelligence source.'
      : 'Mixed external/internal intelligence = mid-market scenario. Balanced approach needed.'

  // ── External signal type breakdown ──
  const externalTypeMap: Record<string, number> = {}
  for (const s of externalSignals) {
    externalTypeMap[s.signalType] = (externalTypeMap[s.signalType] || 0) + 1
  }
  const topSignalTypes = Object.entries(externalTypeMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([type, count]) => ({ type, count }))

  // ── Build response ──
  return {
    companyId: company.id,
    companyName: company.rawName,
    industry: company.industry,
    domain: company.domain,
    sizeRange: company.sizeRange,
    country: company.country,

    layers: {
      external: {
        signalCount: externalSignals.length,
        topSignalTypes,
        averageConfidence: externalAvgConf,
        lastExternalSearch: null, // Could be populated from last IntelligenceObject
        coverage: externalCoverage,
      },
      internal: {
        signalCount: internalSignals.length,
        noteCount: companyNotes,
        hasStrategy: strategies > 0,
        hasResearchCard: !!researchCard,
        hasSwot: !!hasSwot,
        humanIntelligenceCount: humanInbox,
        memoryDepth: internalMemoryDepth.score,
        memoryGrade: internalMemoryDepth.grade,
      },
      people: {
        totalContacts: contacts.length,
        mappedContacts: keyContacts.length,
        highInfluence: contacts.filter(c => c.leadScore >= 60).length,
        activeEngagement: contacts.filter(c => c.status === 'replied' || c._count.replies > 0).length,
        championCount: contacts.filter(c => c._count.replies >= 2 && c.leadScore >= 50).length,
        stakeholderGaps,
        coverageScore: peopleCoverageScore,
      },
    },

    compositeScore: {
      overall: compositeOverall,
      external: externalScore,
      internal: internalScore,
      people: peopleScore,
      grade,
      scenario,
      scenarioReason,
    },

    topSignals,
    keyContacts,
    risks: risks.slice(0, 5),
    opportunities: opportunities.slice(0, 5),
    recommendedActions: recommendedActions.slice(0, 5),
    memoryGaps,

    meta: {
      totalSignals: topSignals.length,
      externalSignals: externalSignals.length,
      internalSignals: internalSignals.length,
      peopleSignals: peopleSignals.length,
      internalMemoryDepth: internalMemoryDepth.score,
      internalMemoryGrade: internalMemoryDepth.grade,
      queryLatencyMs: Date.now() - startTime,
    },
  }
}
