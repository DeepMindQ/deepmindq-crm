import { NextRequest } from 'next/server'
import { z } from 'zod'
import { apiError, apiSuccess, validateBody } from '@/lib/apiHelpers'
import { callLLM } from '@/lib/zai-helpers'
import { getResearchContext, buildResearchContextText } from '@/lib/intelligence-contract'

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
  source: 'phase3_research' | 'phase3_inference'
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
          source: 'phase3_research' as const,
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
      source: 'phase3_research',
    })
  }

  return suggestions
}

// ---------------------------------------------------------------------------
// Company enrichment — REWIRED: reads from Phase 3 ResearchCard
// ---------------------------------------------------------------------------

async function enrichCompany(
  entityId: string,
  autoFill: boolean,
) {
  const { db } = await import('@/lib/db')
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

  // ── CONSUME PHASE 3 INTELLIGENCE (no web search) ──
  let suggestions: EnrichmentSuggestion[] = []

  try {
    const ctx = await getResearchContext(entityId)

    if (ctx.researchCard) {
      // Direct field mapping from Phase 3 research card
      const rc = ctx.researchCard

      const fieldMapping: Record<string, { value: string | null; confidence: number }> = {
        website: { value: rc.website, confidence: ctx.fieldConfidence.website || 0.8 },
        industry: { value: rc.industry, confidence: ctx.fieldConfidence.industry || 0.8 },
      }

      // Map employeeCount → sizeRange
      if (missingFields.includes('sizeRange') && rc.employeeCount && rc.employeeCount !== 'Not found') {
        fieldMapping.sizeRange = { value: rc.employeeCount, confidence: ctx.fieldConfidence.employeeCount || 0.7 }
      }

      // Map from company record if research card has industry/website
      for (const [field, data] of Object.entries(fieldMapping)) {
        if (missingFields.includes(field) && data.value && data.value !== 'Not found') {
          suggestions.push({
            field,
            suggestedValue: data.value,
            confidence: data.confidence,
            source: 'phase3_research',
          })
        }
      }

      // If we still have missing fields, ask LLM to infer from research context
      const stillMissing = missingFields.filter(f => !suggestions.some(s => s.field === f))
      if (stillMissing.length > 0 && ctx.researchCard.businessOverview) {
        const researchText = buildResearchContextText(ctx)
        const systemPrompt = `You are a B2B data enrichment assistant. Based on the company intelligence below, suggest values for these missing fields: ${stillMissing.join(', ')}.

CRITICAL RULES:
- ONLY suggest values supported by the intelligence below
- If the intelligence doesn't contain enough info for a field, set confidence to 0.0 or omit it
- NEVER fabricate values

Respond as JSON array: [{ "field": "...", "suggestedValue": "...", "confidence": 0.0-1.0 }]`

        try {
          const text = await callLLM(systemPrompt, `Company: ${ctx.companyName}\n\n${researchText}`)
          const inferred = parseEnrichmentResponse(text).filter(s =>
            stillMissing.includes(s.field) && s.confidence >= 0.5
          )
          // Mark inferred suggestions differently
          for (const s of inferred) {
            s.source = 'phase3_inference'
          }
          suggestions.push(...inferred)
        } catch {
          // Non-critical
        }
      }
    }
  } catch (err) {
    console.error('[ai/enrich] Phase 3 context fetch failed:', err instanceof Error ? err.message : err)
  }

  // Auto-fill ONLY if:
  // 1. Requested by user
  // 2. Confidence >= 0.7
  // 3. Value comes from Phase 3 research (not inference)
  let enriched = false
  if (autoFill && suggestions.length > 0) {
    const { db: dbImport } = await import('@/lib/db')
    const updateData: Record<string, string> = {}
    for (const s of suggestions) {
      if (s.confidence >= 0.7 && s.source === 'phase3_research' && s.suggestedValue && s.suggestedValue !== 'Not found') {
        updateData[s.field] = s.suggestedValue
      }
    }

    if (Object.keys(updateData).length > 0) {
      await dbImport.company.update({
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
    intelligenceSource: 'phase3',
  })
}

// ---------------------------------------------------------------------------
// Contact enrichment — reads Phase 3 research for the company
// ---------------------------------------------------------------------------

async function enrichContact(
  entityId: string,
  autoFill: boolean,
) {
  const { db } = await import('@/lib/db')
  const contact = await db.contact.findFirst({
    where: { id: entityId, status: { not: 'archived' } },
    include: {
      company: {
        select: {
          id: true,
          rawName: true,
          domain: true,
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

  // ── CONSUME PHASE 3 INTELLIGENCE for the contact's company ──
  if (contact.companyId) {
    try {
      const ctx = await getResearchContext(contact.companyId)

      // Check if Phase 3 keyPeople has a match for this contact
      if (ctx.keyPeople.length > 0) {
        const contactName = (contact.rawName || '').toLowerCase()
        const matchedPerson = ctx.keyPeople.find(p =>
          p.name && contactName.includes(p.name.toLowerCase().split(' ')[0])
        )

        if (matchedPerson) {
          if (missingFields.includes('title') && matchedPerson.title) {
            suggestions.push({
              field: 'title',
              suggestedValue: matchedPerson.title,
              confidence: 0.85,
              source: 'phase3_research',
            })
          }
          if (missingFields.includes('linkedinUrl') && matchedPerson.linkedInUrl) {
            suggestions.push({
              field: 'linkedinUrl',
              suggestedValue: matchedPerson.linkedInUrl,
              confidence: 0.9,
              source: 'phase3_research',
            })
          }
        }
      }
    } catch {
      // Non-critical — continue without Phase 3 data
    }
  }

  // Auto-fill with high confidence from Phase 3
  let enriched = false
  if (autoFill && suggestions.length > 0) {
    const { db: dbImport } = await import('@/lib/db')
    const updateData: Record<string, string> = {}
    for (const s of suggestions) {
      if (s.confidence >= 0.8 && s.source === 'phase3_research') {
        updateData[s.field] = s.suggestedValue
      }
    }

    if (Object.keys(updateData).length > 0) {
      await dbImport.contact.update({
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
    intelligenceSource: 'phase3',
  })
}

// ---------------------------------------------------------------------------
// POST /api/ai/enrich
// REWIRED: Reads from Phase 3 ResearchCard instead of independent web search
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