import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { apiError, apiSuccess, validateBody } from '@/lib/apiHelpers'
import { createInsight } from '@/lib/ai-insight-service'
import { governedAICallAggregate } from '@/lib/ai-governance'
import { logger } from '@/lib/logger'
import { checkApiAuth } from '@/lib/api-auth'

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
// Types
// ---------------------------------------------------------------------------

interface EnrichmentSuggestion {
  field: string
  suggestedValue: string
  confidence: number
}

function parseEnrichmentResponse(text: string): EnrichmentSuggestion[] {
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
) {
  const company = await db.company.findUnique({
    where: { id: entityId },
    include: {
      contacts: {
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

  // Generate suggestions via AI
  let suggestions: EnrichmentSuggestion[] = []

  if (missingFields.length > 0) {
    const context = `Company Name: ${company.rawName}
Domain: ${company.domain || 'Unknown'}
Website: ${company.website || 'Unknown'}
Industry: ${company.industry || 'Unknown'}
Employees: ${company.sizeRange || 'Unknown'}
Country: ${company.country || 'Unknown'}
Location: ${company.location || 'Unknown'}
LinkedIn: ${company.website || 'Unknown'}
Contacts: ${company.contacts.map((c) => `${c.email ?? 'no email'} - ${c.location ?? 'no location'}`).join('; ') || 'None'}`

    const systemPrompt = `You are a B2B data enrichment assistant. Given the following context about an entity, suggest plausible values for the missing fields.

Context:
${context}

Missing fields to suggest: ${missingFields.join(', ')}

For each field, provide a suggested value and confidence (0-1). Only suggest values you are reasonably confident about.

Respond as JSON array: [{ "field": "...", "suggestedValue": "...", "confidence": 0.0-1.0 }]`

    try {
      const governed = await governedAICallAggregate({
        generationType: 'enrichment',
        systemPrompt,
        userPrompt: 'Suggest values for the missing fields.',
        tier: 'smart',
        maxTokens: 2048,
        temperature: 0.7,
      })
      if (governed.success && governed.response) {
        suggestions = parseEnrichmentResponse(governed.response)
        // Filter to only suggest for actually missing fields
        suggestions = suggestions.filter((s) => missingFields.includes(s.field))
      }
    } catch (llmErr: unknown) {
      const msg = llmErr instanceof Error ? llmErr.message : String(llmErr)
      logger.error('[ai/enrich] LLM call failed:', { detail: msg })
    }
  }

  // Auto-fill if requested
  // Milestone 1: Human-approval gate — AI suggestions are NOT written directly to DB.
  // Instead, they are returned with a `pending` status for admin review.
  // The autoFill parameter now only marks suggestions as "approved" but does NOT write.
  let enriched = false
  if (autoFill && suggestions.length > 0) {
    // PREVIOUS BEHAVIOR (removed): Directly wrote AI values to DB at 60% confidence.
    // NEW BEHAVIOR: Return suggestions with `canAutoFill: true` flag.
    // The client must explicitly confirm each suggestion before it's persisted.
    // This prevents unverified AI data from corrupting company/contact records.
    enriched = false // Never auto-write; requires explicit approval
  }

  // Persist as AI Insight
  try {
    await createInsight({
      companyId: entityId,
      type: suggestions.length > 0 ? 'RECOMMENDATION' : 'SIGNAL',
      title: `Enrichment: ${company.rawName} — ${suggestions.length} suggestion(s)`,
      description: `Missing ${missingFields.length} field(s): ${missingFields.join(', ')}. ${suggestions.length} AI-suggested enrichment(s) generated.${enriched ? ' Auto-filled high-confidence values.' : ''}`,
      evidence: suggestions.slice(0, 5).map(s => ({
        source: 'ai-enrich',
        snippet: `${s.field}: ${s.suggestedValue} (${Math.round(s.confidence * 100)}% confidence)`,
        reliability: s.confidence,
      })),
      confidenceScore: suggestions.length > 0 ? 70 : 30,
      impactScore: Math.min(100, suggestions.length * 20),
      urgencyScore: missingFields.length > 3 ? 60 : 20,
      recommendedAction: enriched
        ? 'High-confidence fields auto-filled. Review remaining suggestions.'
        : suggestions.length > 0
          ? 'Review AI suggestions and auto-fill approved values.'
          : 'All key fields populated. No enrichment needed.',
      sourceType: 'enrichment_engine',
      sourceRoute: '/api/ai/enrich',
    })
  } catch (insightErr) {
    logger.warn('[ai/enrich] Failed to persist insight:', { error: insightErr })
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
) {
  const contact = await db.contact.findUnique({
    where: { id: entityId },
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

  // Generate suggestions via AI
  let suggestions: EnrichmentSuggestion[] = []

  if (missingFields.length > 0) {
    const context = `Contact Name: ${contact.rawName}
Email: ${contact.email || 'Unknown'}
Job Title: ${contact.title || 'Unknown'}
Role: ${contact.role || 'Unknown'}
Phone: ${contact.phone || 'Unknown'}
Location: ${contact.location || 'Unknown'}
LinkedIn: ${contact.linkedinUrl || 'Unknown'}
Company: ${contact.company.rawName}
Company Domain: ${contact.company.domain || 'Unknown'}
Company Industry: ${contact.company.industry || 'Unknown'}
Company Location: ${contact.company.location || 'Unknown'}
Company Country: ${contact.company.country || 'Unknown'}`

    const systemPrompt = `You are a B2B data enrichment assistant. Given the following context about an entity, suggest plausible values for the missing fields.

Context:
${context}

Missing fields to suggest: ${missingFields.join(', ')}

For each field, provide a suggested value and confidence (0-1). Only suggest values you are reasonably confident about.

Respond as JSON array: [{ "field": "...", "suggestedValue": "...", "confidence": 0.0-1.0 }]`

    try {
      const governed = await governedAICallAggregate({
        generationType: 'enrichment',
        systemPrompt,
        userPrompt: 'Suggest values for the missing fields.',
        tier: 'smart',
        maxTokens: 2048,
        temperature: 0.7,
      })
      if (governed.success && governed.response) {
        suggestions = parseEnrichmentResponse(governed.response)
        // Filter to only suggest for actually missing fields
        suggestions = suggestions.filter((s) => missingFields.includes(s.field))
      }
    } catch (llmErr: unknown) {
      const msg = llmErr instanceof Error ? llmErr.message : String(llmErr)
      logger.error('[ai/enrich] LLM call failed:', { detail: msg })
    }
  }

  // Auto-fill if requested — Milestone 1: Human-approval gate (same as company path)
  let enriched = false
  if (autoFill && suggestions.length > 0) {
    // Milestone 1: Never auto-write AI suggestions to DB. Requires explicit approval.
    enriched = false
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
  // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request)
  if (errorResponse) return errorResponse

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