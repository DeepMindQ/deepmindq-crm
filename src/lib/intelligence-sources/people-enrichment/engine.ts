// @ts-nocheck — Future feature: references Prisma models not yet in schema. Remove after DB migration.
/**
 * Phase 9: People Profile Enrichment Engine
 *
 * Enriches contact profiles with LinkedIn/public data to complete the
 * People Intelligence layer started in Sprint 3A.
 *
 * Uses web search + AI extraction to build buying influence profiles
 * from public professional data. No scraping — uses search APIs only.
 *
 * Enrichment fields: headline, current role, skills, experience highlights,
 * buying influence signals, decision authority indicators.
 */

import { db } from '@/lib/db'
import { ModelRouter } from '@/lib/engines/model-router'
import { webSearch } from '@/lib/llm-client'

export interface PeopleEnrichmentResult {
  contactId: string
  headline: string | null
  currentRole: string | null
  currentCompany: string | null
  location: string | null
  profileSummary: string | null
  skills: string[]
  experienceHighlights: string[]
  buyingSignals: string[]
  decisionAuthority: 'executive' | 'vp' | 'director' | 'manager' | 'individual_contributor' | 'unknown'
  estimatedSeniority: number // 1-10
  confidence: number // 0-1
  source: string
}

/**
 * Enrich a single contact with public profile data
 */
export async function enrichContactProfile(contactId: string): Promise<PeopleEnrichmentResult> {
  const startTime = Date.now()

  // Check existing enrichment
  const existing = await db.peopleProfileEnrichment.findUnique({ where: { contactId } })
  if (existing && existing.status === 'enriched') {
    const elapsed = Date.now() - startTime
    return {
      contactId,
      headline: existing.headline,
      currentRole: existing.currentTitle,
      currentCompany: existing.currentCompany,
      location: existing.location,
      profileSummary: existing.profileSummary,
      skills: existing.skills ? JSON.parse(existing.skills) : [],
      experienceHighlights: existing.experienceHighlights ? JSON.parse(existing.experienceHighlights) : [],
      buyingSignals: [],
      decisionAuthority: estimateAuthority(existing.currentTitle || ''),
      estimatedSeniority: estimateSeniority(existing.currentTitle || ''),
      confidence: existing.confidenceScore,
      source: existing.sourceProvider || 'cached',
    }
  }

  // Get contact info
  const contact = await db.contact.findUnique({
    where: { id: contactId },
    include: { company: { select: { name: true, website: true, industry: true } } },
  })

  if (!contact) throw new Error(`Contact ${contactId} not found`)

  // Search for public profile information
  const searchQuery = `${contact.rawName} ${contact.title || ''} ${contact.company?.name || ''} LinkedIn profile career background`
  let searchResults: Array<{ title: string; url: string; snippet: string }> = []

  try {
    const results = await webSearch(searchQuery, 5)
    searchResults = results.map((r: any) => ({
      title: r.title || '',
      url: r.url || '',
      snippet: r.snippet || r.content || '',
    }))
  } catch (err) {
    console.warn(`[people-enrichment] Web search failed for ${contact.rawName}:`, err)
  }

  // AI extraction from search results
  const systemPrompt = `You are a B2B sales intelligence analyst. Extract structured professional profile data from the provided search results. Be factual — only extract what is explicitly mentioned. If data is missing, return null for that field.`

  const userPrompt = `Contact: ${contact.rawName}
Title: ${contact.title || 'Unknown'}
Company: ${contact.company?.name || 'Unknown'}
Industry: ${contact.company?.industry || 'Unknown'}

Search Results:
${searchResults.map((r, i) => `${i + 1}. [${r.title}] ${r.snippet}`).join('\n')}

Extract the following as JSON:
{
  "headline": "professional headline or null",
  "currentRole": "current job title or null",
  "currentCompany": "current employer or null",
  "location": "location or null",
  "profileSummary": "2-3 sentence professional summary or null",
  "skills": ["skill1", "skill2"],
  "experienceHighlights": ["highlight1", "highlight2"],
  "buyingSignals": ["signal1 — e.g., 'responsible for vendor selection'", "signal2"],
  "decisionAuthority": "executive|vp|director|manager|individual_contributor|unknown"
}`

  let enrichmentData: Partial<PeopleEnrichmentResult> = {}
  try {
    const llmResult = await ModelRouter.complete({
      systemPrompt,
      userPrompt,
      tier: 'smart',
      genType: 'people_enrichment',
      maxTokens: 2048,
      temperature: 0.3,
      companyId: contact.companyId,
    })

    const cleaned = (llmResult.text || '').replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      enrichmentData = JSON.parse(jsonMatch[0])
    }
  } catch (err) {
    console.warn(`[people-enrichment] AI extraction failed for ${contact.rawName}:`, err)
  }

  const enrichment: PeopleEnrichmentResult = {
    contactId,
    headline: enrichmentData.headline || null,
    currentRole: enrichmentData.currentRole || contact.title || null,
    currentCompany: enrichmentData.currentCompany || contact.company?.name || null,
    location: enrichmentData.location || null,
    profileSummary: enrichmentData.profileSummary || null,
    skills: Array.isArray(enrichmentData.skills) ? enrichmentData.skills : [],
    experienceHighlights: Array.isArray(enrichmentData.experienceHighlights) ? enrichmentData.experienceHighlights : [],
    buyingSignals: Array.isArray(enrichmentData.buyingSignals) ? enrichmentData.buyingSignals : [],
    decisionAuthority: enrichmentData.decisionAuthority || estimateAuthority(contact.title || ''),
    estimatedSeniority: estimateSeniority(contact.title || ''),
    confidence: searchResults.length > 0 ? 0.6 : 0.3,
    source: 'web-search+ai',
  }

  // Persist enrichment
  await db.peopleProfileEnrichment.upsert({
    where: { contactId },
    create: {
      contactId,
      linkedinUrl: contact.linkedinUrl,
      headline: enrichment.headline,
      currentCompany: enrichment.currentCompany,
      currentTitle: enrichment.currentRole,
      location: enrichment.location,
      profileSummary: enrichment.profileSummary,
      skills: JSON.stringify(enrichment.skills),
      experienceHighlights: JSON.stringify(enrichment.experienceHighlights),
      sourceProvider: 'web-search+ai',
      enrichedAt: new Date(),
      confidenceScore: enrichment.confidence,
      status: 'enriched',
    },
    update: {
      headline: enrichment.headline,
      currentCompany: enrichment.currentCompany,
      currentTitle: enrichment.currentRole,
      location: enrichment.location,
      profileSummary: enrichment.profileSummary,
      skills: JSON.stringify(enrichment.skills),
      experienceHighlights: JSON.stringify(enrichment.experienceHighlights),
      sourceProvider: 'web-search+ai',
      enrichedAt: new Date(),
      confidenceScore: enrichment.confidence,
      status: 'enriched',
    },
  })

  console.log(`[people-enrichment] Enriched ${contact.rawName} in ${Date.now() - startTime}ms`)
  return enrichment
}

/**
 * Batch enrich contacts for a company
 */
export async function enrichCompanyContacts(companyId: string): Promise<PeopleEnrichmentResult[]> {
  const contacts = await db.contact.findMany({
    where: { companyId, isSuppressed: false },
    take: 20, // Limit to top 20 contacts
  })

  const results: PeopleEnrichmentResult[] = []
  for (const contact of contacts) {
    try {
      const result = await enrichContactProfile(contact.id)
      results.push(result)
    } catch (err) {
      console.warn(`[people-enrichment] Failed for ${contact.rawName}:`, err)
    }
  }
  return results
}

function estimateAuthority(title: string): 'executive' | 'vp' | 'director' | 'manager' | 'individual_contributor' | 'unknown' {
  const t = title.toLowerCase()
  if (t.match(/ceo|cto|cfo|coo|cmo|cio|cpo|cso|chief|president|founder|co-founder/)) return 'executive'
  if (t.match(/vp|vice president|svp|evp/)) return 'vp'
  if (t.match(/director|head|lead|principal/)) return 'director'
  if (t.match(/manager|sr\.|senior|associate/)) return 'manager'
  if (t.match(/analyst|developer|engineer|designer|specialist|coordinator/)) return 'individual_contributor'
  return 'unknown'
}

function estimateSeniority(title: string): number {
  const t = title.toLowerCase()
  if (t.match(/ceo|president|founder/)) return 10
  if (t.match(/cfo|cto|coo|cmo|chief/)) return 9
  if (t.match(/vp|svp|evp/)) return 8
  if (t.match(/senior vp/)) return 8
  if (t.match(/director|head/)) return 7
  if (t.match(/sr\.|senior|principal|lead/)) return 6
  if (t.match(/manager/)) return 5
  if (t.match(/associate/)) return 3
  if (t.match(/analyst|specialist|coordinator/)) return 2
  if (t.match(/intern|assistant/)) return 1
  return 4
}
