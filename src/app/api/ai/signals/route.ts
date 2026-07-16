import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiError, apiSuccess, safeInt } from '@/lib/apiHelpers'
import { randomUUID } from 'crypto'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SignalType = 'hiring' | 'leadership' | 'investment' | 'technology' | 'expansion'
type SignalPriority = 'high' | 'medium' | 'low'

interface RawSearchResult {
  url: string
  name: string
  snippet: string
  host_name: string
  rank: number
  date?: string
  favicon?: string
}

interface ParsedSignal {
  id: string
  companyId: string
  companyName: string
  type: SignalType
  title: string
  description: string
  whyItMatters: string
  recommendedAction: string
  priority: SignalPriority
  source: string
  detectedAt: string
  confidence: number
}

interface SignalsResponse {
  signals: ParsedSignal[]
  scannedCompanies: number
  totalSignalsFound: number
  sources?: { company: string; results: { title: string; url: string; snippet: string }[] }[]
}

interface CacheEntry {
  data: SignalsResponse
  ts: number
}

// ---------------------------------------------------------------------------
// Module-level cache (30 min TTL)
// ---------------------------------------------------------------------------

const CACHE_TTL = 30 * 60 * 1000
const signalCache = new Map<string, CacheEntry>()

function cacheKey(companyId: string | null, limit: number): string {
  return companyId ? `single:${companyId}` : `batch:${limit}`
}

function getCache(companyId: string | null, limit: number): SignalsResponse | null {
  const key = cacheKey(companyId, limit)
  const entry = signalCache.get(key)
  if (entry && Date.now() - entry.ts < CACHE_TTL) {
    return entry.data
  }
  if (entry) signalCache.delete(key)
  return null
}

function setCache(companyId: string | null, limit: number, data: SignalsResponse): void {
  const key = cacheKey(companyId, limit)
  signalCache.set(key, { data, ts: Date.now() })
}

// ---------------------------------------------------------------------------
// SDK helpers (backend only)
// ---------------------------------------------------------------------------

async function getZAI() {
  const ZAI = await import('z-ai-web-dev-sdk').then((m) => m.default)
  return ZAI.create()
}

async function webSearch(zai: Awaited<ReturnType<typeof getZAI>>, query: string, num = 5): Promise<RawSearchResult[]> {
  const results = await zai.functions.invoke('web_search', { query, num })
  return Array.isArray(results) ? results : []
}

async function callLLM(
  zai: Awaited<ReturnType<typeof getZAI>>,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    thinking: { type: 'disabled' },
  })
  return completion.choices?.[0]?.message?.content ?? ''
}

// ---------------------------------------------------------------------------
// Search queries per company
// ---------------------------------------------------------------------------

function buildSearchQueries(companyName: string): string[] {
  return [
    `${companyName} news 2025`,
    `${companyName} hiring AI digital transformation`,
    `${companyName} leadership executive appointment`,
  ]
}

// ---------------------------------------------------------------------------
// LLM signal extraction
// ---------------------------------------------------------------------------

const SIGNAL_SYSTEM_PROMPT = `You are a B2B sales intelligence analyst. Given web search results about a company, extract actionable buying signals.

Classify each signal into one of these types:
- "hiring" — the company is actively recruiting for roles related to AI, digital transformation, engineering growth, or new departments
- "leadership" — executive appointments, C-suite changes, new board members, or leadership restructuring
- "investment" — funding rounds, M&A activity, budget increases, IPOs, or major financial events
- "technology" — new tech adoption, platform migrations, product launches, patent filings, or tech stack changes
- "expansion" — opening new offices, entering new markets, geographic growth, partnerships, or joint ventures

For each signal provide:
- type: one of the five categories above
- title: a concise, specific headline (max 80 chars)
- description: 1-2 sentences summarizing the finding based on the search results
- whyItMatters: 1 sentence explaining why this matters for B2B sales outreach
- recommendedAction: a specific, actionable next step for a sales team
- priority: "high", "medium", or "low" based on urgency and sales relevance
- source: the source domain(s) where this was found, e.g. "LinkedIn / TechCrunch"
- confidence: 0-100 based on how clearly the signal is supported by the search results

Only include signals that are clearly supported by the search results. Do not fabricate information.
Return a JSON array of signal objects. If no meaningful signals are found, return an empty array [].
Respond ONLY with valid JSON, no markdown fences, no explanation.`

function buildAnalysisPrompt(companyName: string, allResults: RawSearchResult[]): string {
  const formatted = allResults
    .slice(0, 20)
    .map((r, i) => `[${i + 1}] ${r.name}\n    Source: ${r.host_name} | URL: ${r.url}\n    Date: ${r.date ?? 'unknown'}\n    Snippet: ${r.snippet}`)
    .join('\n\n')

  return `Analyze these web search results about "${companyName}" and extract buying signals.\n\n${formatted}\n\nExtract all relevant buying signals as a JSON array.`
}

interface RawLLMSignal {
  type?: string
  title?: string
  description?: string
  whyItMatters?: string
  recommendedAction?: string
  priority?: string
  source?: string
  confidence?: number
}

function parseLLMSignals(raw: string): RawLLMSignal[] {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

  try {
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) return parsed
  } catch {
    // Try regex extraction of individual objects
    const signals: RawLLMSignal[] = []
    const objRegex = /\{\s*"type"\s*:\s*"[^"]+"/g
    let match = objRegex.exec(cleaned)
    while (match) {
      try {
        // Find the matching closing brace
        let depth = 0
        let start = match.index
        let end = start
        for (let i = start; i < cleaned.length; i++) {
          if (cleaned[i] === '{') depth++
          else if (cleaned[i] === '}') depth--
          if (depth === 0) { end = i + 1; break }
        }
        const obj = JSON.parse(cleaned.slice(start, end))
        signals.push(obj)
      } catch {
        // skip malformed objects
      }
      match = objRegex.exec(cleaned)
    }
    return signals
  }

  return []
}

const VALID_TYPES: SignalType[] = ['hiring', 'leadership', 'investment', 'technology', 'expansion']
const VALID_PRIORITIES: SignalPriority[] = ['high', 'medium', 'low']

function normalizeSignal(raw: RawLLMSignal, companyId: string, companyName: string): ParsedSignal | null {
  if (!raw.title && !raw.description) return null

  const type = VALID_TYPES.includes(raw.type as SignalType) ? (raw.type as SignalType) : 'technology'
  const priority = VALID_PRIORITIES.includes(raw.priority as SignalPriority) ? (raw.priority as SignalPriority) : 'medium'
  const confidence = typeof raw.confidence === 'number'
    ? Math.min(100, Math.max(0, Math.round(raw.confidence)))
    : 60

  return {
    id: randomUUID(),
    companyId,
    companyName,
    type,
    title: String(raw.title || 'Detected Activity'),
    description: String(raw.description || 'Activity detected from web search results.'),
    whyItMatters: String(raw.whyItMatters || 'This signal indicates potential buying intent or organizational change.'),
    recommendedAction: String(raw.recommendedAction || 'Research further and prepare targeted outreach.'),
    priority,
    source: String(raw.source || 'Web Search'),
    detectedAt: new Date().toISOString(),
    confidence,
  }
}

// ---------------------------------------------------------------------------
// Per-company signal scanning
// ---------------------------------------------------------------------------

interface CompanyRow {
  id: string
  normalizedName: string
}

interface ScanCompanyResult {
  signals: ParsedSignal[]
  rawResults: RawSearchResult[]
}

async function scanCompany(zai: Awaited<ReturnType<typeof getZAI>>, company: CompanyRow): Promise<ScanCompanyResult> {
  const queries = buildSearchQueries(company.normalizedName)

  // Run all 3 searches in parallel, tolerate individual failures
  const searchSettled = await Promise.allSettled(
    queries.map((q) => webSearch(zai, q, 5)),
  )

  const allResults: RawSearchResult[] = []
  const sources: string[] = []

  for (const result of searchSettled) {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      allResults.push(...result.value)
      for (const r of result.value) {
        if (r.host_name && !sources.includes(r.host_name)) {
          sources.push(r.host_name)
        }
      }
    }
  }

  if (allResults.length === 0) return { signals: [], rawResults: [] }

  // Ask LLM to analyze
  try {
    const userPrompt = buildAnalysisPrompt(company.normalizedName, allResults)
    const llmResponse = await callLLM(zai, SIGNAL_SYSTEM_PROMPT, userPrompt)
    const rawSignals = parseLLMSignals(llmResponse)

    return {
      signals: rawSignals
        .map((s) => normalizeSignal(s, company.id, company.normalizedName))
        .filter((s): s is ParsedSignal => s !== null),
      rawResults: allResults,
    }
  } catch (err) {
    console.error(`[ai/signals] LLM analysis failed for ${company.normalizedName}:`, err instanceof Error ? err.message : err)
    return { signals: [], rawResults: allResults }
  }
}

// ---------------------------------------------------------------------------
// GET /api/ai/signals
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const companyId = searchParams.get('company') || null
  const limit = safeInt(searchParams.get('limit'), 10, 1)

  // Check cache first
  const cached = getCache(companyId, limit)
  if (cached) return apiSuccess(cached)

  try {
    const zai = await getZAI()

    // Fetch companies to scan
    let companies: CompanyRow[]

    if (companyId) {
      const single = await db.company.findUnique({
        where: { id: companyId },
        select: { id: true, normalizedName: true },
      })
      if (!single) return apiError('Company not found', 404)
      companies = [single]
    } else {
      companies = await db.company.findMany({
        where: { status: { not: 'archived' } },
        orderBy: { intelligenceScore: 'desc' },
        take: limit,
        select: { id: true, normalizedName: true },
      })
    }

    if (companies.length === 0) {
      const empty: SignalsResponse = { signals: [], scannedCompanies: 0, totalSignalsFound: 0 }
      return apiSuccess(empty)
    }

    // Scan each company — use allSettled so one failure doesn't kill the batch
    const scanSettled = await Promise.allSettled(
      companies.map((c) => scanCompany(zai, c)),
    )

    const allSignals: ParsedSignal[] = []
    const allSources: SignalsResponse['sources'] = []

    for (let i = 0; i < scanSettled.length; i++) {
      const result = scanSettled[i]
      if (result.status === 'fulfilled') {
        allSignals.push(...result.value.signals)
        if (result.value.rawResults.length > 0) {
          allSources.push({
            company: companies[i].normalizedName,
            results: result.value.rawResults.map(r => ({
              title: r.name,
              url: r.url,
              snippet: r.snippet,
            })),
          })
        }
      } else {
        console.error('[ai/signals] Company scan failed:', result.reason instanceof Error ? result.reason.message : result.reason)
      }
    }

    const response: SignalsResponse = {
      signals: allSignals.sort((a, b) => b.confidence - a.confidence),
      scannedCompanies: companies.length,
      totalSignalsFound: allSignals.length,
      sources: allSources,
    }

    // Cache the result
    setCache(companyId, limit, response)

    return apiSuccess(response)
  } catch (err) {
    console.error('[ai/signals] Unhandled error:', err instanceof Error ? err.message : err)

    // If we had a partial result from cache, return it as a fallback
    const stale = getStaleCache(companyId, limit)
    if (stale) {
      return apiSuccess({ ...stale, _stale: true })
    }

    return apiError('Failed to scan for signals', 500)
  }
}

// ---------------------------------------------------------------------------
// Stale cache fallback
// ---------------------------------------------------------------------------

function getStaleCache(companyId: string | null, limit: number): SignalsResponse | null {
  const key = cacheKey(companyId, limit)
  const entry = signalCache.get(key)
  if (entry) {
    // Clean up expired entry
    signalCache.delete(key)
    return entry.data
  }
  return null
}