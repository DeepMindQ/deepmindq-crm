/**
 * Phase 9: Competitive Intelligence Engine
 *
 * Monitors competitor movements and propagates relevant signals to
 * accounts in the pipeline that are affected.
 *
 * Signal types: product_launch, pricing_change, partnership, acquisition,
 * hiring, leadership_change, funding, expansion
 *
 * When a competitive signal is detected, it cross-references against
 * all tracked accounts to find those using the competitor's products
 * or operating in the same competitive space.
 */

import { db } from '@/lib/db'
import { webSearch } from '@/lib/llm-client'
import { ModelRouter } from '@/lib/engines/model-router'

export interface CompetitiveIntelResult {
  competitorName: string
  eventTitle: string
  eventType: string
  eventSummary: string
  sourceUrl: string | null
  sourceName: string | null
  affectedAccountCount: number
  affectedAccountIds: string[]
  impactAnalysis: string | null
}

const COMPETITOR_EVENT_TYPES = [
  'product_launch', 'pricing_change', 'partnership', 'acquisition',
  'hiring', 'leadership_change', 'funding', 'expansion',
] as const

/**
 * Collect competitive intelligence for a specific competitor
 */
export async function collectCompetitiveIntel(competitorName: string): Promise<CompetitiveIntelResult[]> {
  const startTime = Date.now()

  const searchQuery = `${competitorName} news announcement launch partnership acquisition 2024 2025`
  let searchResults: Array<{ title: string; url: string; snippet: string }> = []

  try {
    const results = await webSearch(searchQuery, 10)
    searchResults = results.map((r: any) => ({
      title: r.title || '',
      url: r.url || '',
      snippet: r.snippet || r.content || '',
    }))
  } catch (err) {
    console.warn(`[competitive-intel] Search failed for ${competitorName}:`, err)
    return []
  }

  // AI extraction of competitive events
  let events: Array<{
    eventTitle: string
    eventType: string
    eventSummary: string
    sourceUrl: string | null
    sourceName: string | null
  }> = []

  try {
    const llmResult = await ModelRouter.complete({
      systemPrompt: `You are a competitive intelligence analyst. Extract recent competitive events from search results. Classify each event into one of: ${COMPETITOR_EVENT_TYPES.join(', ')}. Be factual.`,
      userPrompt: `Competitor: ${competitorName}

Search Results:
${searchResults.map((r, i) => `${i + 1}. [${r.title}] ${r.snippet} (URL: ${r.url})`).join('\n')}

Extract competitive events as JSON array:
[{
  "eventTitle": "short event title",
  "eventType": "${COMPETITOR_EVENT_TYPES[0]}",
  "eventSummary": "2-3 sentence summary",
  "sourceUrl": "url or null",
  "sourceName": "publication name or null"
}]`,
      tier: 'smart',
      genType: 'competitive_intel_collection',
      maxTokens: 4096,
      temperature: 0.3,
    })

    const cleaned = (llmResult.text || '').replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const match = cleaned.match(/\[[\s\S]*\]/)
    if (match) events = JSON.parse(match[0])
  } catch (err) {
    console.warn(`[competitive-intel] AI extraction failed for ${competitorName}:`, err)
    return []
  }

  // For each event, find affected accounts
  const results: CompetitiveIntelResult[] = []
  for (const event of events) {
    // Find accounts that mention this competitor in their intelligence
    const affectedAccounts = await findAffectedAccounts(competitorName, event.eventSummary)
    
    // Impact analysis
    let impactAnalysis: string | null = null
    if (affectedAccounts.length > 0) {
      try {
        const impactResult = await ModelRouter.complete({
          systemPrompt: 'You are a B2B revenue intelligence analyst. Analyze how a competitive event affects specific prospect accounts.',
          userPrompt: `Competitive Event: ${event.eventTitle} — ${event.eventSummary}
Affected Accounts: ${affectedAccounts.map(a => a.rawName).join(', ')}

What should the sales team do for each affected account? Be specific and actionable.`,
          tier: 'smart',
          genType: 'competitive_impact_analysis',
          maxTokens: 2048,
          temperature: 0.5,
        })
        impactAnalysis = impactResult.text
      } catch {
        impactAnalysis = null
      }
    }

    // Persist signal
    await db.competitiveSignal.create({
      data: {
        competitorName,
        eventTitle: event.eventTitle,
        eventType: event.eventType,
        eventSummary: event.eventSummary,
        sourceUrl: event.sourceUrl,
        sourceName: event.sourceName,
        impactAnalysis,
        affectedAccounts: JSON.stringify(affectedAccounts.map(a => a.id)),
        status: 'active',
      },
    })

    results.push({
      competitorName,
      eventTitle: event.eventTitle,
      eventType: event.eventType,
      eventSummary: event.eventSummary,
      sourceUrl: event.sourceUrl,
      sourceName: event.sourceName,
      affectedAccountCount: affectedAccounts.length,
      affectedAccountIds: affectedAccounts.map(a => a.id),
      impactAnalysis,
    })
  }

  console.log(`[competitive-intel] Collected ${results.length} events for ${competitorName} in ${Date.now() - startTime}ms`)
  return results
}

/**
 * Find accounts affected by a competitive event
 */
async function findAffectedAccounts(competitorName: string, eventSummary: string): Promise<Array<{ id: string; rawName: string }>> {
  // Strategy 1: Check company research cards for competitor mentions
  const companiesWithCompetitor = await db.company.findMany({
    where: {
      researchCard: { not: null },
    },
    select: { id: true, rawName: true, researchCard: true },
    take: 20,
  })

  // Filter client-side for JSON field matching
  const filtered = companiesWithCompetitor.filter(c => {
    try {
      const rc = typeof c.researchCard === 'string' ? JSON.parse(c.researchCard) : (c.researchCard || {})
      const techStack = (rc.techStack || '').toLowerCase()
      const competitors = (rc.competitors || []).join(' ').toLowerCase()
      const search = competitorName.toLowerCase()
      return techStack.includes(search) || competitors.includes(search)
    } catch { return false }
  })

  // Strategy 2: Check signals for competitor mentions
  let results = filtered.map(c => ({ id: c.id, rawName: c.rawName }))
  if (results.length === 0) {
    const signalsWithCompetitor = await db.companySignal.findMany({
      where: { title: { contains: competitorName, mode: 'insensitive' } },
      distinct: ['companyId'],
      select: { companyId: true },
      take: 10,
    })

    if (signalsWithCompetitor.length > 0) {
      const companies = await db.company.findMany({
        where: { id: { in: signalsWithCompetitor.map(s => s.companyId) } },
        select: { id: true, rawName: true },
      })
      results = companies.map(c => ({ id: c.id, rawName: c.rawName }))
    }
  }

  return results
}

/**
 * Run competitive intelligence across all known competitors
 */
export async function runCompetitiveScan(): Promise<CompetitiveIntelResult[]> {
  // Extract competitor names from all company data
  const allCompanies = await db.company.findMany({
    select: { id: true, rawName: true, researchCard: true },
    where: { researchCard: { not: null } },
    take: 50,
  })

  const competitorNames = new Set<string>()
  for (const company of allCompanies) {
    try {
      const rc = typeof company.researchCard === 'string' ? JSON.parse(company.researchCard) : (company.researchCard || {})
      const competitors = rc.competitors || []
      for (const c of competitors) {
        if (typeof c === 'string') competitorNames.add(c)
      }
    } catch { /* skip */ }
  }

  const allResults: CompetitiveIntelResult[] = []
  for (const competitor of competitorNames) {
    try {
      const results = await collectCompetitiveIntel(competitor)
      allResults.push(...results)
    } catch (err) {
      console.warn(`[competitive-intel] Failed for ${competitor}:`, err)
    }
  }

  return allResults
}
