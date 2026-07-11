import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiError, apiSuccess } from '@/lib/apiHelpers'
import { Prisma } from '@prisma/client'

// ---------------------------------------------------------------------------
// LLM provider helpers
// ---------------------------------------------------------------------------

async function callOpenAI(systemPrompt: string, userPrompt: string, apiKey: string, model: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 1024,
    }),
  })
  if (!res.ok) throw new Error(`OpenAI API error ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

async function callGemini(systemPrompt: string, userPrompt: string, apiKey: string, model: string): Promise<string> {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent'
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
    }),
  })
  if (!res.ok) throw new Error(`Gemini API error ${res.status}`)
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

async function callGroq(systemPrompt: string, userPrompt: string, apiKey: string, model: string): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 1024,
    }),
  })
  if (!res.ok) throw new Error(`Groq API error ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

// ---------------------------------------------------------------------------
// JSON extraction (tolerant of markdown fences)
// ---------------------------------------------------------------------------

function extractJson(raw: string): unknown {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

  try {
    return JSON.parse(cleaned)
  } catch {
    // fall through
  }

  const match = cleaned.match(/\{[\s\S]*\}/)
  if (match) {
    try {
      return JSON.parse(match[0])
    } catch {
      // fall through
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Safe Prisma query builder
// ---------------------------------------------------------------------------

const ALLOWED_COMPANY_FILTERS: Record<string, (v: string) => Prisma.CompanyWhereInput> = {
  name: (v) => ({ name: { contains: v, mode: 'insensitive' } }),
  domain: (v) => ({ domain: { contains: v, mode: 'insensitive' } }),
  industry: (v) => ({ industry: { contains: v, mode: 'insensitive' } }),
  status: (v) => ({ status: v }),
  employeeSize: (v) => ({ employeeSize: v }),
  country: (v) => ({ country: { contains: v, mode: 'insensitive' } }),
}

const ALLOWED_CONTACT_FILTERS: Record<string, (v: string) => Prisma.ContactWhereInput> = {
  name: (v) => ({ name: { contains: v, mode: 'insensitive' } }),
  email: (v) => ({ email: { contains: v, mode: 'insensitive' } }),
  jobTitle: (v) => ({ jobTitle: { contains: v, mode: 'insensitive' } }),
  roleBucket: (v) => ({ roleBucket: v }),
  status: (v) => ({ status: v }),
  emailHealth: (v) => ({ emailHealth: v }),
}

const ALLOWED_OPPORTUNITY_FILTERS: Record<string, (v: string) => Prisma.OpportunityWhereInput> = {
  title: (v) => ({ title: { contains: v, mode: 'insensitive' } }),
  status: (v) => ({ status: v }),
}

const ALLOWED_COMPANY_SORT: Record<string, Prisma.CompanyOrderByWithRelationInput> = {
  name: { name: 'asc' },
  domain: { domain: 'asc' },
  industry: { industry: 'asc' },
  status: { status: 'asc' },
  employeeSize: { employeeSize: 'asc' },
  country: { country: 'asc' },
  intelligenceScore: { intelligenceScore: 'desc' },
  createdAt: { createdAt: 'desc' },
}

const ALLOWED_CONTACT_SORT: Record<string, Prisma.ContactOrderByWithRelationInput> = {
  name: { name: 'asc' },
  email: { email: 'asc' },
  jobTitle: { jobTitle: 'asc' },
  roleBucket: { roleBucket: 'asc' },
  status: { status: 'asc' },
  emailHealth: { emailHealth: 'asc' },
  createdAt: { createdAt: 'desc' },
}

const ALLOWED_OPPORTUNITY_SORT: Record<string, Prisma.OpportunityOrderByWithRelationInput> = {
  title: { title: 'asc' },
  status: { status: 'asc' },
  createdAt: { createdAt: 'desc' },
}

// ---------------------------------------------------------------------------
// POST /api/ai/query
// ---------------------------------------------------------------------------

const QUERY_SYSTEM_PROMPT = `You are a CRM query parser for DeepMindQ, a sales intelligence platform. Your job is to convert natural language queries into structured JSON for database filtering.

Given the CRM query, return ONLY a JSON object (no markdown, no explanation) with:
- "entityType": one of "company", "contact", "opportunity"
- "filters": a flat object of { field: value } for filtering. Use exact values for enum fields, case-insensitive substring for text fields.
- "sortBy": string field name to sort by
- "sortOrder": "asc" or "desc"

Available fields and their accepted values:

**Companies**: name (text), domain (text), industry (text), status ("new"/"active"/"inactive"/"archived"), employeeSize ("1-10"/"11-50"/"51-200"/"201-500"/"501-1000"/"1001-5000"/"5001+"), country (text), intelligenceScore (number, sort only), createdAt (date, sort only)

**Contacts**: name (text), email (text), jobTitle (text), roleBucket ("Executive"/"Manager"/"Technical"/"Operations"/"Sales"/"Other"), status ("new"/"active"/"inactive"/"archived"), emailHealth ("valid"/"risky"/"invalid"/"unknown"), createdAt (date, sort only)

**Opportunities**: title (text), status ("researching"/"qualified"/"proposal"/"negotiation"/"won"/"lost"/"archived"), createdAt (date, sort only)

Important rules:
- "hot leads" = entityType: "company", status: "active", sortBy: "intelligenceScore", sortOrder: "desc"
- "needs follow-up" = contacts not recently contacted = entityType: "contact", sortBy: "createdAt", sortOrder: "desc"
- Industry names should be capitalized properly
- For "show me X", return the appropriate entityType
- Only include filters that are explicitly mentioned or strongly implied
- Always set sortBy and sortOrder — default to createdAt desc if unsure

Examples:
- "hot leads in healthcare" → { "entityType": "company", "filters": { "industry": "Healthcare", "status": "active" }, "sortBy": "intelligenceScore", "sortOrder": "desc" }
- "executives at active companies" → { "entityType": "contact", "filters": { "roleBucket": "Executive", "status": "active" }, "sortBy": "createdAt", "sortOrder": "desc" }
- "lost deals" → { "entityType": "opportunity", "filters": { "status": "lost" }, "sortBy": "createdAt", "sortOrder": "desc" }
- "companies in technology" → { "entityType": "company", "filters": { "industry": "Technology" }, "sortBy": "intelligenceScore", "sortOrder": "desc" }
- "invalid emails" → { "entityType": "contact", "filters": { "emailHealth": "invalid" }, "sortBy": "createdAt", "sortOrder": "desc" }`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query } = body

    if (!query || typeof query !== 'string') {
      return apiError('Query is required', 400)
    }

    // 1. Get UserPreferences for AI config
    const prefs = await db.userPreferences.findFirst()
    const aiProvider = (prefs?.aiProvider || 'openai').toLowerCase()
    const aiModel = prefs?.aiModel || 'gpt-4o-mini'
    const aiApiKey = prefs?.aiApiKey

    // 2. Try AI-powered query parsing
    if (aiApiKey) {
      try {
        let rawResponse = ''
        if (aiProvider === 'openai') {
          rawResponse = await callOpenAI(QUERY_SYSTEM_PROMPT, query, aiApiKey, aiModel)
        } else if (aiProvider === 'gemini') {
          rawResponse = await callGemini(QUERY_SYSTEM_PROMPT, query, aiApiKey, aiModel)
        } else if (aiProvider === 'groq') {
          rawResponse = await callGroq(QUERY_SYSTEM_PROMPT, query, aiApiKey, aiModel)
        }

        const parsed = extractJson(rawResponse)
        if (parsed && typeof parsed === 'object' && 'entityType' in parsed) {
          const result = await executeQuery(parsed as Record<string, unknown>, query)
          return apiSuccess(result)
        }

        // AI returned non-JSON — return as interpretation with empty results
        return apiSuccess({
          data: [],
          queryInterpretation: rawResponse || 'Could not parse query into a structured search.',
          totalResults: 0,
        })
      } catch (llmErr: unknown) {
        const msg = llmErr instanceof Error ? llmErr.message : String(llmErr)
        console.error(`[ai/query] LLM call failed (${aiProvider}): ${msg}`)
        // Fall through to empty result
      }
    }

    // 3. No AI key or failure — return helpful message
    return apiSuccess({
      data: [],
      queryInterpretation:
        'Natural language query requires an AI provider to be configured. Please set up your AI provider and API key in Settings to use this feature.',
      totalResults: 0,
    })
  } catch {
    return apiError('Failed to process query')
  }
}

// ---------------------------------------------------------------------------
// Execute structured query
// ---------------------------------------------------------------------------

async function executeQuery(
  parsed: Record<string, unknown>,
  originalQuery: string,
): Promise<{ data: unknown[]; queryInterpretation: string; totalResults: number }> {
  const entityType = String(parsed.entityType || 'company')
  const filters = (parsed.filters || {}) as Record<string, string>
  const sortBy = String(parsed.sortBy || 'createdAt')
  const sortOrder = String(parsed.sortOrder || 'desc')

  // Build a human-readable interpretation
  const filterParts = Object.entries(filters)
    .map(([k, v]) => `${k} = ${v}`)
    .join(', ')
  const queryInterpretation = `Showing ${entityType}${filterParts ? ` where ${filterParts}` : ''}, sorted by ${sortBy} ${sortOrder}.`

  try {
    if (entityType === 'company') {
      const where = buildWhereClause(filters, ALLOWED_COMPANY_FILTERS)
      const orderBy = buildOrderBy(sortBy, sortOrder, ALLOWED_COMPANY_SORT, { intelligenceScore: 'desc' })

      const data = await db.company.findMany({
        where,
        orderBy,
        take: 20,
        include: { _count: { select: { contacts: true, opportunities: true } } },
      })

      return { data, queryInterpretation, totalResults: data.length }
    }

    if (entityType === 'contact') {
      const where = buildWhereClause(filters, ALLOWED_CONTACT_FILTERS)
      const orderBy = buildOrderBy(sortBy, sortOrder, ALLOWED_CONTACT_SORT, { createdAt: 'desc' })

      const data = await db.contact.findMany({
        where: { ...where, archivedAt: null },
        orderBy,
        take: 20,
        include: { company: { select: { name: true, industry: true } } },
      })

      return { data, queryInterpretation, totalResults: data.length }
    }

    if (entityType === 'opportunity') {
      const where = buildWhereClause(filters, ALLOWED_OPPORTUNITY_FILTERS)
      const orderBy = buildOrderBy(sortBy, sortOrder, ALLOWED_OPPORTUNITY_SORT, { createdAt: 'desc' })

      const data = await db.opportunity.findMany({
        where,
        orderBy,
        take: 20,
        include: {
          company: { select: { name: true, industry: true } },
          targetContact: { select: { name: true, jobTitle: true } },
        },
      })

      return { data, queryInterpretation, totalResults: data.length }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[ai/query] Prisma query failed: ${msg}`)
  }

  return {
    data: [],
    queryInterpretation: `Could not execute query for "${originalQuery}". Try rephrasing your question.`,
    totalResults: 0,
  }
}

function buildWhereClause<T>(
  filters: Record<string, string>,
  allowedFilters: Record<string, (v: string) => T>,
): T {
  const clauses: T[] = []
  for (const [field, value] of Object.entries(filters)) {
    const builder = allowedFilters[field]
    if (builder && value) {
      clauses.push(builder(value))
    }
  }
  return (clauses.length > 0 ? { AND: clauses } : {}) as T
}

function buildOrderBy<T>(
  sortBy: string,
  sortOrder: string,
  allowedSort: Record<string, T>,
  fallback: T,
): T {
  let order = allowedSort[sortBy]
  if (!order) return fallback

  // Apply sort direction if the order object has a known field
  // Prisma orderBy objects are immutable in TypeScript, so we rely on the
  // allowedSort map already encoding the direction
  return order
}