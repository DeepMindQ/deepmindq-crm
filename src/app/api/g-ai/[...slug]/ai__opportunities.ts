import { db } from '@/lib/db'
import { apiError, apiSuccess } from '@/lib/apiHelpers'
import { callLLM } from '@/lib/zai-helpers'
import { getResearchContext, buildResearchContextText, type ResearchContext } from '@/lib/intelligence-contract'

/* ── In-memory cache (1 hour TTL) ── */
let cachedResult: { data: OpportunitiesResponse; ts: number } | null = null
const CACHE_TTL = 60 * 60 * 1000

/* ── Types ── */
interface ScoredOpportunity {
  companyId: string
  companyName: string
  matchScore: number
  opportunityType: string
  whyNow: string
  relevantCapability: string
  targetPersona: string
  confidence: number
  reasoning: string
  intelligenceSource: 'phase3'
}

interface OpportunitiesResponse {
  opportunities: ScoredOpportunity[]
  companiesScanned: number
  distribution: { hot: number; warm: number; developing: number; monitoring: number }
  generatedAt: string
  intelligenceSource: 'phase3'
}

/* ── LLM JSON parsing with fallback ── */
function parseLLMJson(raw: string): ScoredOpportunity[] {
  if (!raw) return []

  const cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  try {
    const arr = JSON.parse(cleaned)
    if (Array.isArray(arr)) {
      return arr
        .filter(
          (item) =>
            item.companyName &&
            typeof item.matchScore === 'number' &&
            item.matchScore >= 40,
        )
        .map((item) => ({
          companyId: String(item.companyId ?? ''),
          companyName: String(item.companyName),
          matchScore: Math.min(100, Math.max(0, Math.round(item.matchScore))),
          opportunityType: String(item.opportunityType ?? 'Digital Transformation'),
          whyNow: String(item.whyNow ?? ''),
          relevantCapability: String(item.relevantCapability ?? ''),
          targetPersona: String(item.targetPersona ?? 'CIO'),
          confidence: Math.min(100, Math.max(0, Math.round(item.confidence ?? 50))),
          reasoning: String(item.reasoning ?? ''),
          intelligenceSource: 'phase3' as const,
        }))
        .sort((a: ScoredOpportunity, b: ScoredOpportunity) => b.matchScore - a.matchScore)
    }
  } catch {
    // fall through to regex
  }

  const opportunities: ScoredOpportunity[] = []
  const objRegex =
    /\{\s*"companyName"\s*:\s*"([^"]+)"\s*.*?"matchScore"\s*:\s*(\d+)\s*.*?\}/g
  let match: RegExpExecArray | null
  while ((match = objRegex.exec(cleaned)) !== null) {
    const block = match[0]
    const score = parseInt(match[2], 10)
    if (score < 40) continue
    const typeMatch = block.match(/"opportunityType"\s*:\s*"([^"]+)"/)
    const whyMatch = block.match(/"whyNow"\s*:\s*"([^"]*)"/)
    const capMatch = block.match(/"relevantCapability"\s*:\s*"([^"]*)"/)
    const personaMatch = block.match(/"targetPersona"\s*:\s*"([^"]+)"/)
    const confMatch = block.match(/"confidence"\s*:\s*(\d+)/)
    const reasonMatch = block.match(/"reasoning"\s*:\s*"([^"]*)"/)
    const idMatch = block.match(/"companyId"\s*:\s*"([^"]+)"/)
    opportunities.push({
      companyId: idMatch?.[1] ?? '',
      companyName: match[1],
      matchScore: Math.min(100, score),
      opportunityType: typeMatch?.[1] ?? 'Digital Transformation',
      whyNow: whyMatch?.[1] ?? '',
      relevantCapability: capMatch?.[1] ?? '',
      targetPersona: personaMatch?.[1] ?? 'CIO',
      confidence: confMatch ? Math.min(100, parseInt(confMatch[1], 10)) : 50,
      reasoning: reasonMatch?.[1] ?? '',
      intelligenceSource: 'phase3',
    })
  }

  return opportunities.sort((a, b) => b.matchScore - a.matchScore)
}

/* ── Build distribution buckets ── */
function buildDistribution(opportunities: ScoredOpportunity[]) {
  let hot = 0
  let warm = 0
  let developing = 0
  let monitoring = 0

  for (const opp of opportunities) {
    if (opp.matchScore >= 80) hot++
    else if (opp.matchScore >= 60) warm++
    else if (opp.matchScore >= 40) developing++
    else monitoring++
  }

  return { hot, warm, developing, monitoring }
}

/**
 * Build company context from Phase 3 research data (no web search).
 * Uses the intelligence-contract layer as single source of truth.
 */
function buildCompanyContext(c: { id: string; normalizedName: string; industry: string | null; sizeRange: string | null; location: string | null; intelligenceScore: number; engagementScore: number; lifecycleStage: string | null }, ctx: ResearchContext): string {
  const parts: string[] = [
    `### ${c.normalizedName}`,
    `- Industry: ${c.industry ?? 'Unknown'}`,
    `- Size: ${c.sizeRange ?? 'Unknown'}`,
    `- Location: ${c.location ?? 'Unknown'}`,
    `- Intelligence Score: ${c.intelligenceScore}/100`,
    `- Engagement Score: ${c.engagementScore}/100`,
    `- Lifecycle Stage: ${c.lifecycleStage}`,
    `- Research Freshness: ${ctx.freshness.score}/100 (${ctx.freshness.status})`,
  ]

  // Phase 3 signals
  if (ctx.signals.length > 0) {
    parts.push(`- Buying Signals (${ctx.signals.length}):`)
    for (const s of ctx.signals.slice(0, 5)) {
      parts.push(`  - [${s.impact.toUpperCase()}] ${s.title}: ${s.description || 'No details'} (confidence: ${Math.round(s.confidence * 100)}%)`)
    }
  } else {
    parts.push('- Buying Signals: None detected')
  }

  // Phase 3 key people
  if (ctx.keyPeople.length > 0) {
    parts.push(`- Key People: ${ctx.keyPeople.slice(0, 3).map(p => `${p.name} (${p.title})`).join(', ')}`)
  }

  // Phase 3 business overview
  if (ctx.researchCard?.businessOverview) {
    parts.push(`- Business: ${ctx.researchCard.businessOverview.slice(0, 200)}`)
  }

  // Phase 3 tech stack
  if (ctx.researchCard?.techStack && ctx.researchCard.techStack !== 'Not found') {
    parts.push(`- Tech Stack: ${ctx.researchCard.techStack}`)
  }

  // Phase 3 evidence summary
  if (ctx.evidenceSummary.totalEvidence > 0) {
    parts.push(`- Evidence: ${ctx.evidenceSummary.totalEvidence} sources, ${Object.keys(ctx.evidenceSummary.fields).length} enriched fields`)
  }

  return parts.join('\n')
}

/* ── GET /api/ai/opportunities ──
 * REWIRED: Now consumes Phase 3 intelligence instead of independent web searches.
 * No webSearch calls. All data comes from the intelligence-contract layer.
 */
export async function GET() {
  try {
    // Return cached result if still fresh
    if (cachedResult && Date.now() - cachedResult.ts < CACHE_TTL) {
      return apiSuccess(cachedResult.data)
    }

    // 1. Fetch up to 15 companies (prioritize those with research cards)
    const companies = await db.company.findMany({
      take: 15,
      orderBy: { intelligenceScore: 'desc' },
      where: { status: { not: 'archived' } },
      select: {
        id: true,
        normalizedName: true,
        industry: true,
        sizeRange: true,
        location: true,
        intelligenceScore: true,
        engagementScore: true,
        lifecycleStage: true,
        status: true,
        _count: { select: { contacts: true } },
      },
    })

    if (companies.length === 0) {
      const empty: OpportunitiesResponse = {
        opportunities: [],
        companiesScanned: 0,
        distribution: { hot: 0, warm: 0, developing: 0, monitoring: 0 },
        generatedAt: new Date().toISOString(),
        intelligenceSource: 'phase3',
      }
      return apiSuccess(empty)
    }

    // 2. Fetch Phase 3 research context for all companies in parallel (no web search!)
    const researchContexts = await Promise.allSettled(
      companies.map(c => getResearchContext(c.id))
    )

    // 3. Build company context from Phase 3 data
    const companyBlocks: string[] = []
    const companyIds: string[] = []

    for (let i = 0; i < companies.length; i++) {
      const c = companies[i]
      const result = researchContexts[i]
      const ctx = result.status === 'fulfilled' ? result.value : null

      if (ctx) {
        companyBlocks.push(buildCompanyContext(c, ctx))
        companyIds.push(c.id)
      }
    }

    if (companyBlocks.length === 0) {
      const empty: OpportunitiesResponse = {
        opportunities: [],
        companiesScanned: companies.length,
        distribution: { hot: 0, warm: 0, developing: 0, monitoring: 0 },
        generatedAt: new Date().toISOString(),
        intelligenceSource: 'phase3',
      }
      return apiSuccess(empty)
    }

    const userPrompt = [
      'Here are the companies to analyze (intelligence from our Phase 3 Research Engine — evidence-based, no live web search):',
      '',
      companyBlocks.join('\n\n'),
    ].join('\n')

    const systemPrompt = `You are an enterprise opportunity analyst. Given the following companies with their Phase 3 research intelligence (evidence, signals, key people, tech stack), score each one as a sales opportunity.

The intelligence below was gathered by our research engine from multiple web sources. It includes:
- Buying signals (funding, hiring, expansion, leadership changes, etc.)
- Business overview and tech stack
- Key decision makers
- Evidence confidence scores
- Research freshness indicators

For each company, assess:
- Match score (0-100) based on signals, research quality, and industry alignment
- Opportunity type (AI Automation, Cloud Modernization, Data Analytics, Digital Transformation, Consulting)
- Why now (based on detected Phase 3 signals and intelligence)
- Relevant capability to offer
- Target persona to approach (use key people data if available)
- Confidence level (based on evidence quality and freshness)

Return ONLY valid JSON array:
[
  {
    "companyId": "...",
    "companyName": "...",
    "matchScore": 87,
    "opportunityType": "AI Automation",
    "whyNow": "Description of why this is timely based on signals...",
    "relevantCapability": "Specific capability to offer",
    "targetPersona": "CIO/CTO/COO/VP Digital etc (use key people names if available)",
    "confidence": 85,
    "reasoning": "Brief explanation grounded in Phase 3 intelligence"
  }
]

Only include companies with matchScore >= 40. Sort by matchScore descending.`

    // 4. Single LLM call with all Phase 3 intelligence
    const raw = await callLLM(systemPrompt, userPrompt)
    const opportunities = parseLLMJson(raw)

    // Enrich with companyId mapping
    const idMap = new Map(companies.map((c, i) => [c.normalizedName, c.id]))
    for (const opp of opportunities) {
      if (!opp.companyId) {
        opp.companyId = idMap.get(opp.companyName) || ''
      }
    }

    const distribution = buildDistribution(opportunities)

    const response: OpportunitiesResponse = {
      opportunities,
      companiesScanned: companies.length,
      distribution,
      generatedAt: new Date().toISOString(),
      intelligenceSource: 'phase3',
    }

    cachedResult = { data: response, ts: Date.now() }
    return apiSuccess(response)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[ai/opportunities] Failed:', msg)

    // Return stale cache on failure if available
    if (cachedResult) {
      return apiSuccess(cachedResult.data)
    }

    // Rule-based fallback: return top companies as potential opportunities using DB data only
    const topCompanies = await db.company.findMany({
      take: 10,
      orderBy: { intelligenceScore: 'desc' },
      where: { status: { not: 'archived' } },
      select: {
        id: true,
        normalizedName: true,
        industry: true,
        intelligenceScore: true,
        engagementScore: true,
        lifecycleStage: true,
      },
    })

    const fallbackOpps: ScoredOpportunity[] = topCompanies.map((c) => ({
      companyId: c.id,
      companyName: c.normalizedName,
      matchScore: c.intelligenceScore,
      opportunityType: 'Digital Transformation',
      whyNow: `${c.industry ?? 'Technology'} company with ${c.lifecycleStage} stage`,
      relevantCapability: 'AI & Data Analytics',
      targetPersona: 'CIO / CTO',
      confidence: Math.min(95, Math.max(30, c.intelligenceScore)),
      reasoning: `Company has intelligence score of ${c.intelligenceScore}/100 indicating strong opportunity potential`,
      intelligenceSource: 'phase3',
    }))

    return apiSuccess({
      opportunities: fallbackOpps,
      companiesScanned: topCompanies.length,
      distribution: buildDistribution(fallbackOpps),
      generatedAt: new Date().toISOString(),
      intelligenceSource: 'phase3',
    })
  }
}