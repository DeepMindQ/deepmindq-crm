import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { apiError, apiSuccess, validateBody } from '@/lib/apiHelpers'
import { callLLM, webSearch, extractJSON } from '@/lib/zai-helpers'

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const enrichSchema = z.object({
  entityType: z.enum(['company', 'contact']),
  entityId: z.string().min(1),
  autoFill: z.boolean().optional(),
})

// ---------------------------------------------------------------------------
// Field definitions
// ---------------------------------------------------------------------------

const COMPANY_FIELDS = [
  { field: 'domain', label: 'Domain' },
  { field: 'website', label: 'Website' },
  { field: 'industry', label: 'Industry' },
  { field: 'sizeRange', label: 'Employee Size' },
  { field: 'country', label: 'Country' },
  { field: 'location', label: 'Location' },
] as const

const CONTACT_FIELDS = [
  { field: 'email', label: 'Email' },
  { field: 'title', label: 'Job Title' },
  { field: 'phone', label: 'Phone' },
  { field: 'location', label: 'Location' },
  { field: 'linkedinUrl', label: 'LinkedIn URL' },
] as const

interface EnrichmentSuggestion {
  field: string
  suggestedValue: string
  confidence: number
  source: 'web_search' | 'llm_inference'
}

function parseEnrichmentResponse(text: string): EnrichmentSuggestion[] {
  if (!text) return []

  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

  try {
    const arr = JSON.parse(cleaned)
    if (Array.isArray(arr)) {
      return arr
        .filter((item) => item.field && item.suggestedValue)
        .map((item) => ({
          field: String(item.field),
          suggestedValue: String(item.suggestedValue),
          confidence: typeof item.confidence === 'number' ? Math.min(1, Math.max(0, item.confidence)) : 0.5,
          source: item.source === 'web_search' ? 'web_search' as const : 'llm_inference' as const,
        }))
    }
  } catch {
    // fall through
  }

  const suggestions: EnrichmentSuggestion[] = []
  const itemRegex = /\{\s*"field"\s*:\s*"([^"]+)"\s*,\s*"suggestedValue"\s*:\s*"([^"]+)"\s*(?:,\s*"confidence"\s*:\s*([\d.]+))?\s*\}/g
  let match
  while ((match = itemRegex.exec(cleaned)) !== null) {
    suggestions.push({
      field: match[1],
      suggestedValue: match[2],
      confidence: match[3] ? Math.min(1, Math.max(0, parseFloat(match[3]))) : 0.5,
      source: 'web_search',
    })
  }

  return suggestions
}

// ---------------------------------------------------------------------------
// Company enrichment — NOW uses web search
// ---------------------------------------------------------------------------

async function enrichCompany(
  entityId: string,
  autoFill: boolean,
) {
  const company = await db.company.findUnique({
    where: { id: entityId },
    include: {
      contacts: {
        where: { status: { not: 'archived' } },
        select: { email: true, location: true, title: true },
        take: 5,
      },
    },
  })

  if (!company) return apiError('Company not found', 404)

  // Identify missing fields
  const missingFields: string[] = []
  const companyData = company as Record<string, unknown>

  for (const f of COMPANY_FIELDS) {
    if (!companyData[f.field]) {
      missingFields.push(f.field)
    }
  }

  if (missingFields.length === 0) {
    return apiSuccess({ missingFields: [], suggestions: [], enriched: false, message: 'All fields populated' })
  }

  let suggestions: EnrichmentSuggestion[] = []

  // STEP 1: Web search for REAL data
  const companyName = company.rawName || company.normalizedName || ''
  const searchResults = await webSearch(
    `${companyName} ${company.domain || ''} employees revenue industry country headquarters website LinkedIn`,
    10
  )

  const searchContext = searchResults
    .slice(0, 10)
    .map(r => `[${r.title}] ${r.snippet}`)
    .join('\n')

  // STEP 2: Ask LLM with REAL search context (not guessing!)
  const context = `Company Name: ${company.rawName}
Domain: ${company.domain || 'Unknown'}
Website: ${company.website || 'Unknown'}
Industry: ${company.industry || 'Unknown'}
Employees: ${company.sizeRange || 'Unknown'}
Country: ${company.country || 'Unknown'}
Location: ${company.location || 'Unknown'}
Contacts: ${company.contacts.map((c) => `${c.email ?? 'no email'} - ${c.location ?? 'no location'}`).join('; ') || 'None'}

WEB SEARCH RESULTS (real-time data):
${searchContext || 'No search results found.'}`

  const systemPrompt = `You are a B2B data enrichment assistant. Based on the COMPANY CONTEXT and WEB SEARCH RESULTS below, fill in the missing fields.

CRITICAL RULES:
- ONLY suggest values that are DIRECTLY supported by the web search results
- If the search results don't mention a field, set confidence to 0.0 or omit it
- NEVER guess or fabricate values
- For domain/website: only suggest if found in search results
- For industry: use what search results say, not your training data
- For employee count: use exact numbers from search results

Missing fields: ${missingFields.join(', ')}

For each field, provide a suggested value, confidence (0-1), and source.
source must be "web_search" if the value comes from search results, "llm_inference" only if you're very confident from context.

Respond as JSON array: [{ "field": "...", "suggestedValue": "...", "confidence": 0.0-1.0, "source": "web_search" }]`

  try {
    const text = await callLLM(systemPrompt, `Fill in the missing fields for this company using the search results.\n\n${context}`)
    suggestions = parseEnrichmentResponse(text)
    // Filter to only suggest for actually missing fields
    suggestions = suggestions.filter((s) => missingFields.includes(s.field))
  } catch (llmErr: unknown) {
    const msg = llmErr instanceof Error ? llmErr.message : String(llmErr)
    console.error('[ai/enrich] LLM call failed:', msg)
  }

  // Auto-fill ONLY if:
  // 1. Requested by user
  // 2. Confidence >= 0.8 (raised from 0.6 to prevent hallucination)
  // 3. Value comes from web search (not LLM inference)
  let enriched = false
  if (autoFill && suggestions.length > 0) {
    const updateData: Record<string, string> = {}
    for (const s of suggestions) {
      if (s.confidence >= 0.8 && s.source === 'web_search' && s.suggestedValue && s.suggestedValue !== 'Not found') {
        updateData[s.field] = s.suggestedValue
      }
    }

    if (Object.keys(updateData).length > 0) {
      await db.company.update({
        where: { id: entityId },
        data: updateData,
      })
      enriched = true
    }
  }

  return apiSuccess({
    missingFields,
    suggestions,
    enriched,
    searchResultsCount: searchResults.length,
  })
}

// ---------------------------------------------------------------------------
// Contact enrichment — NOW uses web search
// ---------------------------------------------------------------------------

async function enrichContact(
  entityId: string,
  autoFill: boolean,
) {
  const contact = await db.contact.findFirst({
    where: { id: entityId, status: { not: 'archived' } },
    include: {
      company: {
        select: {
          rawName: true,
          domain: true,
          website: true,
          industry: true,
          country: true,
          location: true,
        },
      },
    },
  })

  if (!contact) return apiError('Contact not found', 404)

  // Identify missing fields
  const missingFields: string[] = []
  const contactData = contact as Record<string, unknown>

  for (const f of CONTACT_FIELDS) {
    if (!contactData[f.field]) {
      missingFields.push(f.field)
    }
  }

  if (missingFields.length === 0) {
    return apiSuccess({ missingFields: [], suggestions: [], enriched: false, message: 'All fields populated' })
  }

  let suggestions: EnrichmentSuggestion[] = []

  // Web search for the contact
  const searchQuery = [
    contact.rawName,
    contact.company?.rawName,
    contact.title,
    'LinkedIn',
  ].filter(Boolean).join(' ');

  const searchResults = await webSearch(searchQuery, 8)
  const searchContext = searchResults
    .slice(0, 8)
    .map(r => `[${r.title}] ${r.snippet}`)
    .join('\n')

  const context = `Contact Name: ${contact.rawName}
Email: ${contact.email || 'Unknown'}
Job Title: ${contact.title || 'Unknown'}
Phone: ${contact.phone || 'Unknown'}
Location: ${contact.location || 'Unknown'}
LinkedIn: ${contact.linkedinUrl || 'Unknown'}
Company: ${contact.company.rawName}
Company Domain: ${contact.company.domain || 'Unknown'}
Company Industry: ${contact.company.industry || 'Unknown'}

WEB SEARCH RESULTS (real-time data):
${searchContext || 'No search results found.'}`

  const systemPrompt = `You are a B2B data enrichment assistant. Based on the CONTEXT and WEB SEARCH RESULTS below, fill in the missing fields.

CRITICAL RULES:
- ONLY suggest values DIRECTLY supported by the web search results
- If search results don't mention a field, set confidence to 0.0 or omit it
- NEVER guess or fabricate values
- For LinkedIn URL: only provide if found in search results as a URL

Missing fields: ${missingFields.join(', ')}

Respond as JSON array: [{ "field": "...", "suggestedValue": "...", "confidence": 0.0-1.0, "source": "web_search" }]`

  try {
    const text = await callLLM(systemPrompt, `Fill in the missing fields for this contact.\n\n${context}`)
    suggestions = parseEnrichmentResponse(text)
    suggestions = suggestions.filter((s) => missingFields.includes(s.field))
  } catch (llmErr: unknown) {
    const msg = llmErr instanceof Error ? llmErr.message : String(llmErr)
    console.error('[ai/enrich] LLM call failed:', msg)
  }

  // Auto-fill with high confidence + web search source only
  let enriched = false
  if (autoFill && suggestions.length > 0) {
    const updateData: Record<string, string> = {}
    for (const s of suggestions) {
      if (s.confidence >= 0.8 && s.source === 'web_search' && s.suggestedValue && s.suggestedValue !== 'Not found') {
        updateData[s.field] = s.suggestedValue
      }
    }

    if (Object.keys(updateData).length > 0) {
      await db.contact.update({
        where: { id: entityId },
        data: updateData,
      })
      enriched = true
    }
  }

  return apiSuccess({
    missingFields,
    suggestions,
    enriched,
    searchResultsCount: searchResults.length,
  })
}

// ---------------------------------------------------------------------------
// POST /api/ai/enrich
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = validateBody(enrichSchema, body)
    if (parsed instanceof Response) return parsed

    const { entityType, entityId, autoFill = false } = parsed

    if (entityType === 'company') {
      return enrichCompany(entityId, autoFill)
    }

    return enrichContact(entityId, autoFill)
  } catch {
    return apiError('Failed to enrich entity')
  }
}