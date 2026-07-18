import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/apiHelpers'
import { callLLM } from '@/lib/zai-helpers'
import { getResearchContext, buildResearchContextText, type ResearchContext } from '@/lib/intelligence-contract'
import { runGovernanceChecks, recordGeneration, HALLUCINATION_PREVENTION_RULES, buildGovernancePromptAddon, buildEvidenceGroundingNote } from '@/lib/ai-governance'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  sources: Array<{ title: string; url: string; snippet: string }>
  generatedAt: string
  intelligenceSource: 'phase3' | 'fallback_llm'
}

// ---------------------------------------------------------------------------
// In-memory cache with 2-hour TTL
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 2 * 60 * 60 * 1000
const briefCache = new Map<string, { data: CachedBrief; expiresAt: number }>()

// ---------------------------------------------------------------------------
// JSON extraction
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
    businessOverview: `AI generation failed: ${errorMsg}.`,
    technologyContext: 'Unable to generate technology context due to an error.',
    industryChallenges: 'Unable to generate industry challenges due to an error.',
    painPoints: [], relevantSolutions: [], targetExecutives: [], conversationStarters: [], keySignals: [],
    recommendedApproach: 'Manual review required.',
    strategicPriority: 'Medium', confidence: 0,
  }
}

// ---------------------------------------------------------------------------
// Build sources list from Phase 3 evidence
// ---------------------------------------------------------------------------

function buildSourcesFromContext(ctx: ResearchContext): CachedBrief['sources'] {
  const sources: CachedBrief['sources'] = []

  // From signals
  for (const s of ctx.signals) {
    if (s.sourceUrl) {
      sources.push({ title: s.title, url: s.sourceUrl, snippet: s.description || '' })
    }
  }

  // From recent news
  for (const n of ctx.recentNews) {
    if (n.url) {
      sources.push({ title: n.title, url: n.url, snippet: n.snippet })
    }
  }

  return sources.slice(0, 20)
}

// ---------------------------------------------------------------------------
// System prompt — NOW consumes Phase 3 intelligence
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a senior enterprise intelligence analyst. Based on the provided company intelligence data (from our research engine), generate a comprehensive Account Intelligence Brief.

The intelligence below comes from our Phase 3 Research Engine which has already:
- Searched the web across 4 query categories (business, tech, people, news)
- Collected evidence from multiple sources with quality tiers
- Extracted structured company data with per-field confidence scores
- Detected buying signals with impact assessment

Use this intelligence to generate the brief. DO NOT search the web again.

${HALLUCINATION_PREVENTION_RULES}

Return ONLY valid JSON (no markdown, no code fences) with this exact structure:
{
  "businessOverview": "2-3 paragraph overview of the company",
  "technologyContext": "Known technology stack, digital initiatives, cloud strategy",
  "industryChallenges": "Key challenges this company/industry faces",
  "painPoints": ["list of 3-5 specific pain points"],
  "relevantSolutions": ["list of 3-5 solution areas that could help"],
  "targetExecutives": [
    { "role": "CIO", "focus": "what they likely care about" }
  ],
  "conversationStarters": ["3-4 specific conversation opening ideas"],
  "recommendedApproach": "How to approach this company - warm intro, direct, event-based, etc.",
  "strategicPriority": "High/Medium/Low with reasoning",
  "keySignals": ["list of detected signals"],
  "confidence": 75
}

Be specific, data-driven, and actionable. Ground every claim in the provided intelligence.
confidence should be 0-100 integer, reflecting how much Phase 3 data was available.`

// ---------------------------------------------------------------------------
// GET /api/ai/account-brief?companyId=xxx
// REWIRED: Now consumes Phase 3 intelligence via intelligence-contract layer.
// No more independent web searches.
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

  try {
    // ── CONSUME PHASE 3 INTELLIGENCE (single source of truth) ──
    const ctx = await getResearchContext(companyId)

    // ── PHASE 3 HARDENING: Run governance checks ──
    const governanceResult = await runGovernanceChecks({
      companyId,
      generationType: 'account_brief',
      researchContext: ctx,
    })

    // Build the intelligence text for LLM (with governance warnings and grounding notes)
    const governanceAddon = buildGovernancePromptAddon(governanceResult)
    const groundingNote = buildEvidenceGroundingNote(ctx)
    const researchContextText = buildResearchContextText(ctx)
    const fullContextText = researchContextText + (governanceAddon ? '\n\n' + governanceAddon : '') + (groundingNote ? '\n\n' + groundingNote : '')

    // Build CRM context
    const dbContext = [
      `Company Name: ${ctx.companyName}`,
      `Domain: ${ctx.domain || 'Unknown'}`,
      `Industry: ${ctx.industry || 'Unknown'}`,
      `Country: ${ctx.country || 'Unknown'}`,
      `Company Size: ${ctx.sizeRange || 'Unknown'}`,
      `Website: ${ctx.website || 'Unknown'}`,
      `Known Contacts in CRM: ${ctx.contactCount}`,
      `Internal Notes: ${ctx.internalNotes || 'None'}`,
      `Research Freshness: ${ctx.freshness.score}/100 (${ctx.freshness.status})`,
    ].join('\n')

    // Determine base confidence from Phase 3 data quality
    const hasResearch = ctx.researchCard !== null
    const baseConfidence = hasResearch
      ? Math.round(ctx.freshness.score * 0.4 + Object.values(ctx.fieldConfidence).reduce((a, b) => a + b, 0) / Math.max(1, Object.keys(ctx.fieldConfidence).length) * 60)
      : 0

    const userPrompt = '## Company Data (from CRM)\n' + dbContext + '\n\n## Phase 3 Research Intelligence\n' + fullContextText + '\n\nBased on the above Phase 3 intelligence, generate the Account Intelligence Brief as JSON.'

    // Generate brief via LLM (using Phase 3 data, NOT web search)
    let brief: AccountBrief
    try {
      const raw = await callLLM(SYSTEM_PROMPT, userPrompt)
      const parsed = parseBriefJson(raw)
      brief = parsed ?? buildFallbackBrief('LLM response was not valid JSON')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[account-brief] LLM generation failed:', msg)
      brief = buildFallbackBrief(msg)
    }

    // Adjust confidence based on Phase 3 data availability
    if (hasResearch && brief.confidence < baseConfidence) {
      brief.confidence = Math.round((brief.confidence + baseConfidence) / 2)
    }

    // Build response
    const sources = buildSourcesFromContext(ctx)
    const response: CachedBrief = {
      companyId: ctx.companyId,
      companyName: ctx.companyName,
      brief,
      sources,
      generatedAt: new Date().toISOString(),
      intelligenceSource: hasResearch ? 'phase3' : 'fallback_llm',
    }

    // Cache and prune
    briefCache.set(companyId, { data: response, expiresAt: Date.now() + CACHE_TTL_MS })
    for (const [key, val] of briefCache.entries()) { if (val.expiresAt <= Date.now()) briefCache.delete(key) }

    // Phase 3 Hardening: Record generation audit
    recordGeneration({
      generationType: 'account_brief',
      companyId: ctx.companyId,
      researchContext: ctx,
      signalIdsUsed: ctx.signals.map(s => s.id),
      governanceResult,
      outputSummary: brief.strategicPriority + ' priority | confidence: ' + brief.confidence,
      inputParams: { companyId, hasResearch },
    }).catch(() => {})

    return apiSuccess(response)
  } catch (err: unknown) {
    console.error('[account-brief] Error:', err instanceof Error ? err.message : err)
    return apiError('Failed to generate account brief', 500)
  }
}