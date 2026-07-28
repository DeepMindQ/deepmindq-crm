/**
 * POST /api/intelligence/sprint1
 *
 * Sprint 1 Intelligence Pipeline — Web Search → AI Classification → Signal Creation
 *
 * Accepts: { companyId: string }
 * Returns:  { company, reasoning, signals, meta }
 *
 * Uses the governed AI path (ai-caller) + signal-creator for persistence.
 * Tavily web search now has exponential backoff (absorbs 429s).
 */

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { classifySignalType, inferSeverity, createSignalFromIntelligenceObject } from '@/lib/intelligence-sources/signal-creator'

// ─── Types ──────────────────────────────────────────────────────────

interface Sprint1Signal {
  rank: number
  signal: string
  signalType: string
  severity: string
  confidence: number
  businessImpact: string
  recommendedAction: string
  timing: string
  owner: string
  evidence: string
  evidenceUrl: string
  sourceDate: string
  signalId?: string
}

interface Sprint1Response {
  company: {
    id: string
    name: string
    industry: string | null
    domain: string | null
    sizeRange: string | null
    country: string | null
  }
  reasoning: string
  signals: Sprint1Signal[]
  meta: {
    webSourcesFetched: number
    aiModelUsed: boolean
    signalsCreated: number
    signalsUpdated: number
    pipelineLatencyMs: number
    searchQueries: string[]
  }
}

// ─── POST Handler ──────────────────────────────────────────────────

export async function POST(request: Request) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { companyId } = body as { companyId?: string }

    if (!companyId || typeof companyId !== 'string') {
      return NextResponse.json(
        { error: 'companyId is required (string)' },
        { status: 400 },
      )
    }

    // 1. Fetch company
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
      },
    })

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // 2. Build search queries
    const name = company.rawName || 'unknown'
    const industry = company.industry || ''
    const searchQueries = [
      `${name} ${industry} company overview recent news 2025 2026`,
      `${name} technology stack cloud engineering digital transformation`,
      `${name} hiring growth funding revenue expansion`,
      `${name} ${industry} competitors market landscape partnerships`,
    ]

    // 3. Parallel web search (with backoff via llm-client)
    const { parallelWebSearch } = await import('@/lib/llm-client')
    const searchResults = await parallelWebSearch(searchQueries, 5)

    const webContext = searchResults
      .slice(0, 20)
      .map((r, i) => `${i + 1}. [${r.title}] ${r.snippet}\n   URL: ${r.url}`)
      .join('\n\n')

    // 4. AI Classification — extract structured signals from web data
    const systemPrompt = `You are a B2B revenue intelligence analyst. Analyze the web search results for a target company and extract actionable sales intelligence signals.

RULES:
- Extract 5-10 specific, evidence-backed signals ranked by sales relevance
- Each signal needs: what happened, why it matters, what sales should do
- Classify each signal into one of: funding, hiring, leadership, tech_change, partnership, expansion, product, news
- Assign confidence (0-100), severity (low/medium/high/critical), timing window
- Ground every claim in the provided search results
- If search results are sparse, say so and reduce confidence

TIMING OPTIONS: immediate, within_7_days, within_30_days, within_90_days, ongoing, expired
OWNER: Sales role who should act (e.g. "Enterprise AE", "SDR Team", "VP Sales")

OUTPUT: Valid JSON only, no markdown.`

    const userPrompt = `Analyze this company and extract intelligence signals:

Company: ${name}
Industry: ${industry || 'Unknown'}
Domain: ${company.domain || 'Unknown'}
Size: ${company.sizeRange || 'Unknown'}
Country: ${company.country || 'Unknown'}

WEB SEARCH RESULTS (${searchResults.length} sources):
${webContext || 'No results found.'}

Return JSON:
{
  "reasoning": "2-3 sentence analysis of what we found and overall intelligence quality",
  "overallConfidence": 75,
  "signals": [
    {
      "signal": "Specific signal description",
      "signalType": "funding|leadership|hiring|tech_change|partnership|expansion|product|news",
      "evidence": "What evidence supports this signal",
      "evidenceUrl": "https://source-url.com",
      "sourceDate": "2026-07-28",
      "confidence": 80,
      "businessImpact": "What this means for sales",
      "recommendedAction": "Specific action for sales team",
      "timing": "within_30_days",
      "owner": "Enterprise AE",
      "severity": "medium"
    }
  ]
}`

    // Use governed AI caller
    const { callAI } = await import('@/lib/llm-client')
    const aiResult = await callAI({
      systemPrompt,
      userPrompt,
      feature: 'sprint1_intelligence',
      companyId: company.id,
      runQualityCheck: true,
      maxRetries: 2,
      timeoutMs: 90000,
    })

    if (!aiResult.success || !aiResult.raw) {
      return NextResponse.json({
        company: {
          id: company.id,
          name: company.rawName,
          industry: company.industry,
          domain: company.domain,
          sizeRange: company.sizeRange,
          country: company.country,
        },
        reasoning: `AI classification failed: ${aiResult.error || 'empty response'}`,
        signals: [],
        meta: {
          webSourcesFetched: searchResults.length,
          aiModelUsed: false,
          signalsCreated: 0,
          signalsUpdated: 0,
          pipelineLatencyMs: Date.now() - startTime,
          searchQueries,
        },
      })
    }

    // 5. Parse AI response
    let parsed: {
      reasoning?: string
      overallConfidence?: number
      signals?: Array<Record<string, unknown>>
    } = aiResult.parsed as any || {}

    // Fallback parse
    if (!parsed.signals) {
      try {
        const cleaned = aiResult.raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
      } catch {
        // Use empty structure
      }
    }

    const reasoning = parsed.reasoning || 'Analysis completed.'
    const rawSignals = Array.isArray(parsed.signals) ? parsed.signals : []

    // 6. Persist signals via signal-creator + build ranked response
    const rankedSignals: Sprint1Signal[] = []
    let signalsCreated = 0
    let signalsUpdated = 0

    for (let i = 0; i < rawSignals.length; i++) {
      const s = rawSignals[i]
      const signalText = String(s.signal || 'Unknown signal')
      const signalType = String(s.signalType || classifySignalType(signalText))
      const confidence = typeof s.confidence === 'number' ? Math.min(100, Math.max(0, Math.round(s.confidence))) : 50
      const timing = String(s.timing || 'within_30_days')
      const severity = String(s.severity || inferSeverity(confidence, String(s.businessImpact || ''), timing as any))

      // Persist to DB
      try {
        const result = await createSignalFromIntelligenceObject({
          companyId: company.id,
          signal: signalText,
          evidence: String(s.evidence || ''),
          sourceUrl: String(s.evidenceUrl || ''),
          sourceName: 'sprint1_web_intelligence',
          confidence,
          businessImpact: String(s.businessImpact || 'Not assessed'),
          recommendedAction: String(s.recommendedAction || 'Review signal'),
          timing: timing as any,
          owner: String(s.owner || 'Unassigned'),
          expiresAt: s.expiresAt ? String(s.expiresAt) : null,
          signalType,
          severity: severity as any,
          signalDate: s.sourceDate ? new Date(String(s.sourceDate)) : null,
        })

        if (result.success) {
          if (result.signalId) {
            // Check if it was an update (signalId from existing) or create
            const existing = await db.companySignal.findFirst({
              where: {
                companyId: company.id,
                title: signalText.substring(0, 100),
              },
            })
            if (existing && existing.status === 'active') {
              signalsUpdated++
            } else {
              signalsCreated++
            }
          }
        }
      } catch (err) {
        console.warn(`[sprint1] Signal persistence failed for "${signalText}":`, err)
      }

      rankedSignals.push({
        rank: i + 1,
        signal: signalText,
        signalType,
        severity,
        confidence,
        businessImpact: String(s.businessImpact || 'Not assessed'),
        recommendedAction: String(s.recommendedAction || 'Review signal'),
        timing,
        owner: String(s.owner || 'Unassigned'),
        evidence: String(s.evidence || ''),
        evidenceUrl: String(s.evidenceUrl || ''),
        sourceDate: String(s.sourceDate || new Date().toISOString().split('T')[0]),
      })
    }

    // Sort by confidence descending
    rankedSignals.sort((a, b) => b.confidence - a.confidence)
    rankedSignals.forEach((s, i) => { s.rank = i + 1 })

    // 7. Return response
    const response: Sprint1Response = {
      company: {
        id: company.id,
        name: company.rawName,
        industry: company.industry,
        domain: company.domain,
        sizeRange: company.sizeRange,
        country: company.country,
      },
      reasoning,
      signals: rankedSignals,
      meta: {
        webSourcesFetched: searchResults.length,
        aiModelUsed: aiResult.success,
        signalsCreated,
        signalsUpdated,
        pipelineLatencyMs: Date.now() - startTime,
        searchQueries,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[sprint1] Pipeline error:', message)
    return NextResponse.json(
      { error: `Sprint 1 pipeline failed: ${message}` },
      { status: 500 },
    )
  }
}
