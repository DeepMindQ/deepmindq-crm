import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiError, apiSuccess, safeInt } from '@/lib/apiHelpers'
import { getResearchContext, type ResearchContext } from '@/lib/intelligence-contract'
import { callLLM } from '@/lib/zai-helpers'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SignalPriority = 'high' | 'medium' | 'low'

interface ParsedSignal {
  id: string
  companyId: string
  companyName: string
  type: string
  title: string
  description: string
  whyItMatters: string
  recommendedAction: string
  priority: SignalPriority
  source: string
  detectedAt: string
  confidence: number
  // Phase 3 linkage
  phase3SignalId?: string
  sourceUrl?: string
}

interface SignalsResponse {
  signals: ParsedSignal[]
  scannedCompanies: number
  totalSignalsFound: number
  intelligenceSource: 'phase3' | 'phase3_enriched'
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
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data
  if (entry) signalCache.delete(key)
  return null
}

function setCache(companyId: string | null, limit: number, data: SignalsResponse): void {
  signalCache.set(cacheKey(companyId, limit), { data, ts: Date.now() })
}

// ---------------------------------------------------------------------------
// Map Phase 3 signal types to AI route types
// ---------------------------------------------------------------------------

const TYPE_MAP: Record<string, string> = {
  funding: 'investment',
  hiring: 'hiring',
  leadership_change: 'leadership',
  expansion: 'expansion',
  technology: 'technology',
  product: 'technology',
  partnership: 'expansion',
}

// ---------------------------------------------------------------------------
// Enrich Phase 3 signals with LLM analysis (adds whyItMatters, recommendedAction)
// ---------------------------------------------------------------------------

const ENRICH_SYSTEM_PROMPT = `You are a B2B sales intelligence analyst. Given stored company signals, enrich each with sales-specific analysis.

For each signal, add:
- whyItMatters: 1 sentence explaining why this matters for B2B sales outreach
- recommendedAction: a specific, actionable next step for a sales team
- priority: "high", "medium", or "low" based on urgency and sales relevance

Return a JSON array of signal objects with the SAME structure as input, plus the 3 new fields.
Respond ONLY with valid JSON, no markdown fences.`

async function enrichSignalsWithLLM(
  ctx: ResearchContext,
): Promise<ParsedSignal[]> {
  if (ctx.signals.length === 0) return []

  const signalContext = ctx.signals.map((s, i) =>
    `[${i + 1}] Type: ${s.type} | Title: ${s.title} | Description: ${s.description || 'N/A'} | Impact: ${s.impact} | Confidence: ${s.confidence} | Source: ${s.sourceUrl || 'N/A'}`
  ).join('\n\n')

  const userPrompt = `Company: ${ctx.companyName}
Industry: ${ctx.industry || 'Unknown'}
Employees: ${ctx.researchCard?.employeeCount || 'Unknown'}
Revenue: ${ctx.researchCard?.revenue || 'Unknown'}

Detected Signals:
${signalContext}

Enrich each signal with sales-specific analysis. Return JSON array.`

  try {
    const raw = await callLLM(ENRICH_SYSTEM_PROMPT, userPrompt)
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const enriched = JSON.parse(cleaned)

    if (!Array.isArray(enriched)) return mapSignalsDirectly(ctx)

    return enriched.slice(0, ctx.signals.length).map((e: Record<string, unknown>, i: number) => {
      const original = ctx.signals[i]
      if (!original) return null

      const result: ParsedSignal = {
        id: original.id,
        companyId: ctx.companyId,
        companyName: ctx.companyName,
        type: TYPE_MAP[original.type] || original.type,
        title: String(e.title || original.title),
        description: String(e.description || original.description || ''),
        whyItMatters: String(e.whyItMatters || `This ${original.type} signal indicates potential buying intent or organizational change.`),
        recommendedAction: String(e.recommendedAction || 'Research further and prepare targeted outreach.'),
        priority: ['high', 'medium', 'low'].includes(String(e.priority)) ? String(e.priority) as SignalPriority : (original.impact as SignalPriority) || 'medium',
        source: original.type,
        detectedAt: original.detectedAt,
        confidence: Math.min(100, Math.max(0, Math.round((original.confidence || 0.5) * 100))),
        phase3SignalId: original.id,
        sourceUrl: original.sourceUrl || undefined,
      }
      return result
    }).filter((s): s is ParsedSignal => s !== null)
  } catch (err) {
    console.error('[ai/signals] LLM enrichment failed, using direct mapping:', err)
    return mapSignalsDirectly(ctx)
  }
}

/**
 * Direct mapping from Phase 3 signals without LLM enrichment (fallback).
 */
function mapSignalsDirectly(ctx: ResearchContext): ParsedSignal[] {
  return ctx.signals.map(s => ({
    id: s.id,
    companyId: ctx.companyId,
    companyName: ctx.companyName,
    type: TYPE_MAP[s.type] || s.type,
    title: s.title,
    description: s.description || '',
    whyItMatters: `This ${s.type} signal indicates potential buying intent or organizational change.`,
    recommendedAction: 'Research further and prepare targeted outreach.',
    priority: (s.impact as SignalPriority) || 'medium',
    source: s.type,
    detectedAt: s.detectedAt,
    confidence: Math.min(100, Math.max(0, Math.round(s.confidence * 100))),
    phase3SignalId: s.id,
    sourceUrl: s.sourceUrl || undefined,
  }))
}

// ---------------------------------------------------------------------------
// Process a single company using Phase 3 data
// ---------------------------------------------------------------------------

async function processCompanySignals(ctx: ResearchContext): Promise<ParsedSignal[]> {
  if (ctx.signals.length === 0) return []

  // Use LLM to enrich Phase 3 signals with sales-specific analysis
  return enrichSignalsWithLLM(ctx)
}

// ---------------------------------------------------------------------------
// GET /api/ai/signals
// REWIRED: Now reads from CompanySignal table (Phase 3) instead of
// performing independent web searches.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const companyId = searchParams.get('company') || null
  const limit = safeInt(searchParams.get('limit'), 10, 1)

  // Check cache first
  const cached = getCache(companyId, limit)
  if (cached) return apiSuccess(cached)

  try {
    // Fetch companies to process
    let companyIds: string[]

    if (companyId) {
      // Single company
      const exists = await db.company.findUnique({
        where: { id: companyId },
        select: { id: true },
      })
      if (!exists) return apiError('Company not found', 404)
      companyIds = [companyId]
    } else {
      // Batch: top companies by intelligence score
      const companies = await db.company.findMany({
        where: { status: { not: 'archived' } },
        orderBy: { intelligenceScore: 'desc' },
        take: limit,
        select: { id: true },
      })
      companyIds = companies.map(c => c.id)
    }

    if (companyIds.length === 0) {
      return apiSuccess({ signals: [], scannedCompanies: 0, totalSignalsFound: 0, intelligenceSource: 'phase3' } as SignalsResponse)
    }

    // ── CONSUME PHASE 3 SIGNALS (no web search) ──
    const allSignals: ParsedSignal[] = []

    const results = await Promise.allSettled(
      companyIds.map(id => getResearchContext(id).then(processCompanySignals))
    )

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allSignals.push(...result.value)
      }
    }

    const response: SignalsResponse = {
      signals: allSignals.sort((a, b) => b.confidence - a.confidence),
      scannedCompanies: companyIds.length,
      totalSignalsFound: allSignals.length,
      intelligenceSource: 'phase3',
    }

    setCache(companyId, limit, response)
    return apiSuccess(response)
  } catch (err) {
    console.error('[ai/signals] Error:', err instanceof Error ? err.message : err)
    return apiError('Failed to fetch signals', 500)
  }
}