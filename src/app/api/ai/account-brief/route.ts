import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiError, apiSuccess } from '@/lib/apiHelpers'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchSource { title: string; url: string; snippet: string }

interface AccountBrief {
  businessOverview: string
  technologyContext: string
  industryChallenges: string
  painPoints: string[]
  relevantSolutions: string[]
  targetExecutives: { role: string; focus: string }[]
  conversationStarters: string[]
  recommendedApproach: string
  strategicPriority: string
  keySignals: string[]
  confidence: number
}

interface CachedBrief {
  companyId: string
  companyName: string
  brief: AccountBrief
  sources: SearchSource[]
  generatedAt: string
}

// ---------------------------------------------------------------------------
// In-memory cache with 2-hour TTL
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 2 * 60 * 60 * 1000
const briefCache = new Map<string, { data: CachedBrief; expiresAt: number }>()

// ---------------------------------------------------------------------------
// SDK helpers
// ---------------------------------------------------------------------------

type ZAIInstance = Awaited<ReturnType<typeof createZAI>>

async function createZAI() {
  const ZAI = await import('z-ai-web-dev-sdk').then((m) => m.default)
  return ZAI.create()
}

async function webSearch(zai: ZAIInstance, query: string): Promise<SearchSource[]> {
  try {
    const results = await zai.functions.invoke('web_search', { query, num: 10 })
    const items = results?.results ?? results?.data ?? results
    if (!Array.isArray(items)) return []
    return items
      .filter((r: Record<string, unknown>) => r.title || r.url)
      .map((r: Record<string, unknown>) => ({
        title: String(r.title ?? ''),
        url: String(r.url ?? ''),
        snippet: String(r.snippet ?? r.description ?? r.content ?? ''),
      }))
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[account-brief] Search failed for "${query}": ${msg}`)
    return []
  }
}

async function callLLM(zai: ZAIInstance, userPrompt: string): Promise<string> {
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    thinking: { type: 'disabled' },
  })
  return completion.choices?.[0]?.message?.content ?? ''
}

// ---------------------------------------------------------------------------
// JSON extraction — tolerant of markdown fences
// ---------------------------------------------------------------------------

function parseBriefJson(raw: string): AccountBrief | null {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  const tryParse = (text: string) => { try { return JSON.parse(text) } catch { return null } }
  const obj = tryParse(cleaned) ?? (cleaned.match(/\{[\s\S]*\}/) ? tryParse(cleaned.match(/\{[\s\S]*\}/)![0]) : null)
  if (!obj || typeof obj !== 'object') return null
  return normalizeBrief(obj)
}

const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String).filter(Boolean) : []

function normalizeBrief(o: Record<string, unknown>): AccountBrief {
  const execs = Array.isArray(o.targetExecutives)
    ? o.targetExecutives
        .filter((e: unknown) => e && typeof e === 'object')
        .map((e: unknown) => {
          const r = e as Record<string, unknown>
          return { role: String(r.role ?? ''), focus: String(r.focus ?? '') }
        })
        .filter((e) => e.role)
    : []
  return {
    businessOverview: String(o.businessOverview ?? 'No overview available'),
    technologyContext: String(o.technologyContext ?? 'No technology context available'),
    industryChallenges: String(o.industryChallenges ?? 'No challenges identified'),
    painPoints: strArr(o.painPoints),
    relevantSolutions: strArr(o.relevantSolutions),
    targetExecutives: execs,
    conversationStarters: strArr(o.conversationStarters),
    recommendedApproach: String(o.recommendedApproach ?? 'Not determined'),
    strategicPriority: String(o.strategicPriority ?? 'Medium'),
    keySignals: strArr(o.keySignals),
    confidence: typeof o.confidence === 'number' ? Math.min(100, Math.max(0, Math.round(o.confidence))) : 50,
  }
}

function buildFallbackBrief(errorMsg: string): AccountBrief {
  return {
    businessOverview: `AI generation failed: ${errorMsg}. Raw search results are available in sources.`,
    technologyContext: 'Unable to generate technology context due to an error.',
    industryChallenges: 'Unable to generate industry challenges due to an error.',
    painPoints: [], relevantSolutions: [], targetExecutives: [], conversationStarters: [], keySignals: [],
    recommendedApproach: 'Manual review required — AI brief generation encountered an error.',
    strategicPriority: 'Medium', confidence: 0,
  }
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a senior enterprise intelligence analyst. Based on the provided search results and company data, generate a comprehensive Account Intelligence Brief.

Return ONLY valid JSON (no markdown, no code fences) with this exact structure:
{
  "businessOverview": "2-3 paragraph overview of the company",
  "technologyContext": "Known technology stack, digital initiatives, cloud strategy",
  "industryChallenges": "Key challenges this company/industry faces",
  "painPoints": ["list of 3-5 specific pain points"],
  "relevantSolutions": ["list of 3-5 solution areas that could help"],
  "targetExecutives": [
    { "role": "CIO", "focus": "what they likely care about" },
    { "role": "CTO", "focus": "..." }
  ],
  "conversationStarters": ["3-4 specific conversation opening ideas"],
  "recommendedApproach": "How to approach this company - warm intro, direct, event-based, etc.",
  "strategicPriority": "High/Medium/Low with reasoning",
  "keySignals": ["list of detected signals from search results"],
  "confidence": 75
}

Be specific, data-driven, and actionable. Ground every claim in the provided search results. If the search results are sparse, lower the confidence score accordingly. confidence should be 0-100 integer.`

// ---------------------------------------------------------------------------
// GET /api/ai/account-brief?companyId=xxx
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get('companyId')
  if (!companyId) return apiError('companyId query parameter is required', 400)

  // Check cache
  const cached = briefCache.get(companyId)
  if (cached) {
    if (cached.expiresAt > Date.now()) return apiSuccess(cached.data)
    briefCache.delete(companyId)
  }

  // 1. Fetch company from DB
  let company: {
    id: string; normalizedName: string; domain: string | null; industry: string | null
    country: string | null; sizeRange: string | null; website: string | null
    internalSummary: string | null; _count: { contacts: number }
  } | null
  try {
    company = await db.company.findUnique({
      where: { id: companyId },
      select: {
        id: true, normalizedName: true, domain: true, industry: true, country: true,
        sizeRange: true, website: true, internalSummary: true,
        _count: { select: { contacts: true } },
      },
    })
  } catch (err: unknown) {
    console.error(`[account-brief] DB lookup failed:`, err instanceof Error ? err.message : err)
    return apiError('Failed to look up company', 500)
  }
  if (!company) return apiError('Company not found', 404)

  const name = company.normalizedName

  // 2. Initialize SDK
  let zai: ZAIInstance
  try {
    zai = await createZAI()
  } catch (err: unknown) {
    console.error('[account-brief] SDK init failed:', err instanceof Error ? err.message : err)
    return apiError('Failed to initialize AI SDK', 500)
  }

  // 3. Run 4 parallel web searches
  const queries = [
    `${name} business overview revenue employees`,
    `${name} technology stack digital transformation`,
    `${name} challenges industry trends 2025`,
    `${name} leadership CIO CTO CEO executives`,
  ]
  const searchResults = await Promise.all(queries.map((q) => webSearch(zai, q)))

  // Deduplicate sources by URL
  const seenUrls = new Set<string>()
  const sources: SearchSource[] = []
  for (const batch of searchResults) {
    for (const src of batch) {
      if (src.url && !seenUrls.has(src.url)) { seenUrls.add(src.url); sources.push(src) }
    }
  }

  // 4. Build user prompt with DB data + search context
  const searchContext = searchResults
    .flatMap((batch, i) => batch.map((r) => `[Search ${i + 1}] ${r.title}\n  URL: ${r.url}\n  ${r.snippet}`))
    .join('\n\n')
  const dbContext = [
    `Company Name: ${name}`, `Domain: ${company.domain ?? 'Unknown'}`,
    `Industry: ${company.industry ?? 'Unknown'}`, `Country: ${company.country ?? 'Unknown'}`,
    `Company Size: ${company.sizeRange ?? 'Unknown'}`, `Website: ${company.website ?? 'Unknown'}`,
    `Known Contacts in CRM: ${company._count.contacts}`, `Internal Notes: ${company.internalSummary ?? 'None'}`,
  ].join('\n')

  const userPrompt = `## Company Data (from CRM)\n${dbContext}\n\n## Web Search Results\n${searchContext || 'No search results returned.'}\n\nBased on the above, generate the Account Intelligence Brief as JSON.`

  // 5. Generate brief via LLM
  let brief: AccountBrief
  try {
    const raw = await callLLM(zai, userPrompt)
    const parsed = parseBriefJson(raw)
    brief = parsed ?? (() => { console.error('[account-brief] Unparseable LLM JSON'); return buildFallbackBrief('LLM response was not valid JSON') })()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[account-brief] LLM generation failed: ${msg}`)
    brief = buildFallbackBrief(msg)
  }

  // 6. Build response, cache, and prune stale entries
  const response: CachedBrief = {
    companyId: company.id, companyName: name, brief, sources,
    generatedAt: new Date().toISOString(),
  }
  briefCache.set(companyId, { data: response, expiresAt: Date.now() + CACHE_TTL_MS })
  for (const [key, val] of briefCache.entries()) { if (val.expiresAt <= Date.now()) briefCache.delete(key) }

  return apiSuccess(response)
}