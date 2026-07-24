import { db } from '@/lib/db'
import { apiError, apiSuccess } from '@/lib/apiHelpers'

/* ── In-memory cache (1 hour TTL) ── */
let cachedResult: { data: OpportunitiesResponse; ts: number } | null = null
const CACHE_TTL = 60 * 60 * 1000

/* ── Types ── */
interface SearchResult {
  companyName: string
  results: { title: string; snippet: string; url: string }[] | null
  error: string | null
}

interface ScoredOpportunity {
  companyName: string
  matchScore: number
  opportunityType: string
  whyNow: string
  relevantCapability: string
  targetPersona: string
  confidence: number
  reasoning: string
}

interface OpportunitiesResponse {
  opportunities: ScoredOpportunity[]
  companiesScanned: number
  distribution: { hot: number; warm: number; developing: number; monitoring: number }
  generatedAt: string
}

/* ── Simple concurrency limiter (semaphore) ── */
async function withConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = []
  const executing: Promise<void>[] = []

  for (const task of tasks) {
    const p = task().then(
      (value) => { results.push({ status: 'fulfilled', value }) },
      (reason) => { results.push({ status: 'rejected', reason }) },
    )
    executing.push(p as Promise<void>)

    if (executing.length >= limit) {
      await Promise.race(executing)
      // Remove settled promises
      const stillRunning = executing.filter((e) => {
        let settled = false
        e.then(
          () => { settled = true },
          () => { settled = true },
        )
        return !settled
      })
      executing.length = 0
      executing.push(...stillRunning)
    }
  }

  await Promise.allSettled(executing)
  return results
}

/* ── Web search for a single company ── */
async function searchCompany(
  zai: any,
  name: string,
): Promise<SearchResult> {
  try {
    const query = `${name} investment digital transformation AI 2025`
    const results = await zai.functions.invoke('web_search', { query, num: 8 })
    const items = results?.results?.map(
      (r: { title?: string; snippet?: string; url?: string }) => ({
        title: r.title ?? '',
        snippet: r.snippet ?? '',
        url: r.url ?? '',
      }),
    ) ?? []
    return { companyName: name, results: items, error: null }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { companyName: name, results: null, error: msg }
  }
}

/* ── LLM JSON parsing with fallback ── */
function parseLLMJson(raw: string): ScoredOpportunity[] {
  if (!raw) return []

  const cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  // Attempt direct JSON parse
  try {
    const arr = JSON.parse(cleaned)
    if (Array.isArray(arr)) {
      return arr
        .filter(
          (item: Record<string, unknown>) =>
            item.companyName &&
            typeof item.matchScore === 'number' &&
            (item.matchScore as number) >= 40,
        )
        .map((item: Record<string, unknown>) => ({
          companyName: String(item.companyName),
          matchScore: Math.min(100, Math.max(0, Math.round(item.matchScore as number))),
          opportunityType: String(item.opportunityType ?? 'Digital Transformation'),
          whyNow: String(item.whyNow ?? ''),
          relevantCapability: String(item.relevantCapability ?? ''),
          targetPersona: String(item.targetPersona ?? 'CIO'),
          confidence: Math.min(100, Math.max(0, Math.round((item.confidence as number) ?? 50))),
          reasoning: String(item.reasoning ?? ''),
        }))
        .sort((a: ScoredOpportunity, b: ScoredOpportunity) => b.matchScore - a.matchScore)
    }
  } catch {
    // fall through to regex
  }

  // Regex fallback — extract individual objects
  const opportunities: ScoredOpportunity[] = []
  const objRegex =
    /\{\s*"companyName"\s*:\s*"([^"]+)"\s*.*?"matchScore"\s*:\s*(\d+)\s*.*?\}/gu
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
    opportunities.push({
      companyName: match[1],
      matchScore: Math.min(100, score),
      opportunityType: typeMatch?.[1] ?? 'Digital Transformation',
      whyNow: whyMatch?.[1] ?? '',
      relevantCapability: capMatch?.[1] ?? '',
      targetPersona: personaMatch?.[1] ?? 'CIO',
      confidence: confMatch ? Math.min(100, parseInt(confMatch[1], 10)) : 50,
      reasoning: reasonMatch?.[1] ?? '',
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

/* ── GET /api/ai/opportunities ── */
export async function GET() {
  try {
    // Return cached result if still fresh
    if (cachedResult && Date.now() - cachedResult.ts < CACHE_TTL) {
      return apiSuccess(cachedResult.data)
    }

    // 1. Fetch up to 15 companies with contact counts, industry, intelligence score
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
      }
      return apiSuccess(empty)
    }

    // 2. Run web searches with concurrency limit of 3
    const ZAI: any = await import('z-ai-web-dev-sdk').then((m) => m.default).then((Z) => Z.create())

    const searchTasks = companies.map(
      (c) => () => searchCompany(ZAI, c.normalizedName),
    )

    const searchResults = await withConcurrency(searchTasks, 3)

    // 3. Merge company data with search results
    const companyContext = companies.map((c, i) => {
      const sr = searchResults[i]
      const searchItems =
        sr?.status === 'fulfilled'
          ? sr.value.results
            ?.map((r) => `- ${r.title}: ${r.snippet}`)
            .join('\n') ?? 'No search results'
          : 'Search failed'

      return [
        `### ${c.normalizedName}`,
        `- Industry: ${c.industry ?? 'Unknown'}`,
        `- Size: ${c.sizeRange ?? 'Unknown'}`,
        `- Location: ${c.location ?? 'Unknown'}`,
        `- Intelligence Score: ${c.intelligenceScore}/100`,
        `- Engagement Score: ${c.engagementScore}/100`,
        `- Lifecycle Stage: ${c.lifecycleStage}`,
        `- Contacts: ${c._count.contacts}`,
        `- Recent Signals:`,
        searchItems,
      ].join('\n')
    })

    const userPrompt = [
      'Here are the companies to analyze:',
      '',
      companyContext.join('\n\n'),
    ].join('\n')

    const systemPrompt = `You are an enterprise opportunity analyst. Given the following companies with their data and recent web signals, score each one as a sales opportunity.

For each company, assess:
- Match score (0-100) based on signals and industry alignment
- Opportunity type (AI Automation, Cloud Modernization, Data Analytics, Digital Transformation, Consulting)
- Why now (based on detected signals)
- Relevant capability to offer
- Target persona to approach
- Confidence level

Return ONLY valid JSON array:
[
  {
    "companyName": "...",
    "matchScore": 87,
    "opportunityType": "AI Automation",
    "whyNow": "Description of why this is timely...",
    "relevantCapability": "Specific capability to offer",
    "targetPersona": "CIO/CTO/COO/VP Digital etc",
    "confidence": 85,
    "reasoning": "Brief explanation"
  }
]

Only include companies with matchScore >= 40. Sort by matchScore descending.`

    // 4. Single LLM call with all companies
    const completion = await ZAI.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
    })

    const raw = completion.choices?.[0]?.message?.content ?? ''
    const opportunities = parseLLMJson(raw)
    const distribution = buildDistribution(opportunities)

    const response: OpportunitiesResponse = {
      opportunities,
      companiesScanned: companies.length,
      distribution,
      generatedAt: new Date().toISOString(),
    }

    cachedResult = { data: response, ts: Date.now() }
    return apiSuccess(response)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[ai/opportunities] Failed:', msg)

    // Return stale cache on failure if available
    if (cachedResult) {
      return apiSuccess(cachedResult.data)
    }

    // Rule-based fallback: return top companies as potential opportunities
    const topCompanies = await db.company.findMany({
      take: 10,
      orderBy: { intelligenceScore: 'desc' },
      where: { status: { not: 'archived' } },
      select: {
        normalizedName: true,
        industry: true,
        intelligenceScore: true,
        lifecycleStage: true,
      },
    })

    const fallbackOpps: ScoredOpportunity[] = topCompanies.map((c) => ({
      companyName: c.normalizedName,
      matchScore: c.intelligenceScore,
      opportunityType: 'Digital Transformation',
      whyNow: `${c.industry ?? 'Technology'} company with ${c.lifecycleStage} stage`,
      relevantCapability: 'AI & Data Analytics',
      targetPersona: 'CIO / CTO',
      confidence: Math.min(95, Math.max(30, c.intelligenceScore)),
      reasoning: `Company has intelligence score of ${c.intelligenceScore}/100 indicating strong opportunity potential`,
    }))

    return apiSuccess({
      opportunities: fallbackOpps,
      companiesScanned: topCompanies.length,
      distribution: buildDistribution(fallbackOpps),
      generatedAt: new Date().toISOString(),
    })
  }
}
