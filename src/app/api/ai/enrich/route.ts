import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { apiError, apiSuccess, validateBody } from '@/lib/apiHelpers'

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const enrichSchema = z.object({
  entityType: z.enum(['company', 'contact']),
  entityId: z.string().min(1),
  autoFill: z.boolean().optional(),
})

// ---------------------------------------------------------------------------
// Field definitions for missing-field detection
// ---------------------------------------------------------------------------

const COMPANY_FIELDS = [
  { field: 'domain', label: 'Domain' },
  { field: 'website', label: 'Website' },
  { field: 'linkedinUrl', label: 'LinkedIn URL' },
  { field: 'industry', label: 'Industry' },
  { field: 'employeeSize', label: 'Employee Size' },
  { field: 'country', label: 'Country' },
  { field: 'location', label: 'Location' },
] as const

const CONTACT_FIELDS = [
  { field: 'email', label: 'Email' },
  { field: 'jobTitle', label: 'Job Title' },
  { field: 'phone', label: 'Phone' },
  { field: 'location', label: 'Location' },
  { field: 'linkedinUrl', label: 'LinkedIn URL' },
] as const

// ---------------------------------------------------------------------------
// LLM helper for enrichment suggestions
// ---------------------------------------------------------------------------

interface EnrichmentSuggestion {
  field: string
  suggestedValue: string
  confidence: number
}

async function callLlmForEnrichment(
  context: string,
  missingFields: string[],
  apiKey: string,
  provider: string,
  model: string,
): Promise<EnrichmentSuggestion[]> {
  let text = ''

  const systemPrompt = `You are a B2B data enrichment assistant. Given the following context about an entity, suggest plausible values for the missing fields.

Context:
${context}

Missing fields to suggest: ${missingFields.join(', ')}

For each field, provide a suggested value and confidence (0-1). Only suggest values you are reasonably confident about.

Respond as JSON array: [{ "field": "...", "suggestedValue": "...", "confidence": 0.0-1.0 }]`

  if (provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Suggest values for the missing fields.' },
        ],
        temperature: 0.3,
        max_tokens: 512,
      }),
    })
    if (!res.ok) throw new Error(`OpenAI API error ${res.status}`)
    const data = await res.json()
    text = data.choices?.[0]?.message?.content ?? ''
  } else if (provider === 'gemini') {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent'
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt + '\n\nSuggest values for the missing fields.' }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
      }),
    })
    if (!res.ok) throw new Error(`Gemini API error ${res.status}`)
    const data = await res.json()
    text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  } else if (provider === 'groq') {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Suggest values for the missing fields.' },
        ],
        temperature: 0.3,
        max_tokens: 512,
      }),
    })
    if (!res.ok) throw new Error(`Groq API error ${res.status}`)
    const data = await res.json()
    text = data.choices?.[0]?.message?.content ?? ''
  } else {
    return []
  }

  if (!text) return []

  // Parse response
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
        }))
    }
  } catch {
    // fall through
  }

  // Try regex extraction
  const suggestions: EnrichmentSuggestion[] = []
  const itemRegex = /\{\s*"field"\s*:\s*"([^"]+)"\s*,\s*"suggestedValue"\s*:\s*"([^"]+)"\s*(?:,\s*"confidence"\s*:\s*([\d.]+))?\s*\}/g
  let match
  while ((match = itemRegex.exec(cleaned)) !== null) {
    suggestions.push({
      field: match[1],
      suggestedValue: match[2],
      confidence: match[3] ? Math.min(1, Math.max(0, parseFloat(match[3]))) : 0.5,
    })
  }

  return suggestions
}

// ---------------------------------------------------------------------------
// Company enrichment
// ---------------------------------------------------------------------------

async function enrichCompany(
  entityId: string,
  autoFill: boolean,
  aiApiKey: string | null,
  aiProvider: string,
  aiModel: string,
) {
  const company = await db.company.findUnique({
    where: { id: entityId },
    include: {
      contacts: {
        where: { archivedAt: null },
        select: { email: true, location: true, jobTitle: true },
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

  // Generate suggestions via AI
  let suggestions: EnrichmentSuggestion[] = []

  if (aiApiKey && missingFields.length > 0) {
    const context = `Company Name: ${company.name}
Domain: ${company.domain || 'Unknown'}
Website: ${company.website || 'Unknown'}
Industry: ${company.industry || 'Unknown'}
Employees: ${company.employeeSize || 'Unknown'}
Country: ${company.country || 'Unknown'}
Location: ${company.location || 'Unknown'}
LinkedIn: ${company.linkedinUrl || 'Unknown'}
Contacts: ${company.contacts.map((c) => `${c.email ?? 'no email'} - ${c.location ?? 'no location'}`).join('; ') || 'None'}`

    try {
      suggestions = await callLlmForEnrichment(context, missingFields, aiApiKey, aiProvider, aiModel)
      // Filter to only suggest for actually missing fields
      suggestions = suggestions.filter((s) => missingFields.includes(s.field))
    } catch (llmErr: unknown) {
      const msg = llmErr instanceof Error ? llmErr.message : String(llmErr)
      console.error(`[ai/enrich] LLM call failed (${aiProvider}): ${msg}`)
    }
  }

  // Auto-fill if requested
  let enriched = false
  if (autoFill && suggestions.length > 0) {
    const updateData: Record<string, string> = {}
    for (const s of suggestions) {
      if (s.confidence >= 0.6) {
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
  })
}

// ---------------------------------------------------------------------------
// Contact enrichment
// ---------------------------------------------------------------------------

async function enrichContact(
  entityId: string,
  autoFill: boolean,
  aiApiKey: string | null,
  aiProvider: string,
  aiModel: string,
) {
  const contact = await db.contact.findFirst({
    where: { id: entityId, archivedAt: null },
    include: {
      company: {
        select: {
          name: true,
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

  // Generate suggestions via AI
  let suggestions: EnrichmentSuggestion[] = []

  if (aiApiKey && missingFields.length > 0) {
    const context = `Contact Name: ${contact.name}
Email: ${contact.email || 'Unknown'}
Job Title: ${contact.jobTitle || 'Unknown'}
Role Bucket: ${contact.roleBucket || 'Unknown'}
Phone: ${contact.phone || 'Unknown'}
Location: ${contact.location || 'Unknown'}
LinkedIn: ${contact.linkedinUrl || 'Unknown'}
Company: ${contact.company.name}
Company Domain: ${contact.company.domain || 'Unknown'}
Company Industry: ${contact.company.industry || 'Unknown'}
Company Location: ${contact.company.location || 'Unknown'}
Company Country: ${contact.company.country || 'Unknown'}`

    try {
      suggestions = await callLlmForEnrichment(context, missingFields, aiApiKey, aiProvider, aiModel)
      // Filter to only suggest for actually missing fields
      suggestions = suggestions.filter((s) => missingFields.includes(s.field))
    } catch (llmErr: unknown) {
      const msg = llmErr instanceof Error ? llmErr.message : String(llmErr)
      console.error(`[ai/enrich] LLM call failed (${aiProvider}): ${msg}`)
    }
  }

  // Auto-fill if requested
  let enriched = false
  if (autoFill && suggestions.length > 0) {
    const updateData: Record<string, string> = {}
    for (const s of suggestions) {
      if (s.confidence >= 0.6) {
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

    // Read AI preferences
    const prefs = await db.userPreferences.findFirst()
    const aiProvider = (prefs?.aiProvider || 'openai').toLowerCase()
    const aiModel = prefs?.aiModel || 'gpt-4o-mini'
    const aiApiKey = prefs?.aiApiKey

    if (entityType === 'company') {
      return enrichCompany(entityId, autoFill, aiApiKey ?? null, aiProvider, aiModel)
    }

    return enrichContact(entityId, autoFill, aiApiKey ?? null, aiProvider, aiModel)
  } catch {
    return apiError('Failed to enrich entity')
  }
}