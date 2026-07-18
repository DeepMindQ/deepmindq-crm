import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { apiError, apiSuccess, validateBody } from '@/lib/apiHelpers'
import { formatDistanceToNow } from 'date-fns'
import { callLLM } from '@/lib/zai-helpers'

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const summarizeSchema = z.object({
  entityType: z.enum(['company', 'contact']),
  entityId: z.string().min(1),
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SummaryResult {
  summary: string
  keyPoints: string[]
}

function parseSummaryResponse(text: string): SummaryResult | null {
  if (!text) return null

  // Parse JSON response, tolerant of markdown fences
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  try {
    const obj = JSON.parse(cleaned)
    if (obj.summary) {
      return {
        summary: String(obj.summary),
        keyPoints: Array.isArray(obj.keyPoints)
          ? obj.keyPoints.map(String).slice(0, 5)
          : [],
      }
    }
  } catch {
    // fall through
  }

  // Try regex extraction
  const summaryMatch = cleaned.match(/"summary"\s*:\s*"([\s\S]*?)"/)
  const pointsMatch = cleaned.match(/"keyPoints"\s*:\s*\[([\s\S]*?)\]/)
  if (summaryMatch) {
    const summary = summaryMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n')
    let keyPoints: string[] = []
    if (pointsMatch) {
      const items = pointsMatch[1].match(/"([^"]+)"/g)
      if (items) keyPoints = items.map((s) => s.replace(/"/g, '')).slice(0, 5)
    }
    return { summary, keyPoints }
  }

  // Fallback: use raw text as summary
  return { summary: text.slice(0, 500), keyPoints: [] }
}

// ---------------------------------------------------------------------------
// Template-based summarization (no AI)
// ---------------------------------------------------------------------------

function summarizeCompany(data: {
  name: string
  status: string
  industry: string | null
  contactCount: number
  notesCount: number
  timelineCount: number
  researchOverview: string | null
  intelligenceScore: number | null
}): SummaryResult {
  const parts: string[] = []
  parts.push(
    `${data.name} is a ${data.status} ${data.industry ?? 'technology'} company with ${data.contactCount} tracked contact${data.contactCount !== 1 ? 's' : ''}.`
  )

  if (data.researchOverview) {
    parts.push(data.researchOverview.slice(0, 200) + (data.researchOverview.length > 200 ? '...' : ''))
  }

  if (data.timelineCount > 0) {
    parts.push(`${data.timelineCount} activity event${data.timelineCount !== 1 ? 's' : ''} recorded.`)
  }

  const keyPoints: string[] = []
  keyPoints.push(`Status: ${data.status}`)
  if (data.industry) keyPoints.push(`Industry: ${data.industry}`)
  keyPoints.push(`${data.contactCount} contact${data.contactCount !== 1 ? 's' : ''} tracked`)
  if (data.intelligenceScore) keyPoints.push(`Intelligence score: ${data.intelligenceScore}/5`)
  if (data.researchOverview) keyPoints.push('Research card available')

  return {
    summary: parts.join(' '),
    keyPoints: keyPoints.slice(0, 5),
  }
}

function summarizeContact(data: {
  name: string
  title: string | null
  companyName: string
  emailHealth: string
  draftCount: number
  timelineCount: number
  lastContactedAt: string | null
  role: string | null
}): SummaryResult {
  const parts: string[] = []
  const role = data.title ?? 'team member'
  parts.push(`${data.name} is a ${role} at ${data.companyName}.`)
  parts.push(`Email health: ${data.emailHealth}.`)

  if (data.draftCount > 0) {
    parts.push(`${data.draftCount} email draft${data.draftCount !== 1 ? 's' : ''} generated.`)
  }

  if (data.lastContactedAt) {
    parts.push(`Last contacted ${formatDistanceToNow(new Date(data.lastContactedAt), { addSuffix: true })}.`)
  } else {
    parts.push('No prior contact recorded.')
  }

  const keyPoints: string[] = []
  if (data.role) keyPoints.push(`Seniority: ${data.role}`)
  keyPoints.push(`Email health: ${data.emailHealth}`)
  if (data.draftCount > 0) keyPoints.push(`${data.draftCount} draft${data.draftCount !== 1 ? 's' : ''} available`)
  if (data.timelineCount > 0) keyPoints.push(`${data.timelineCount} timeline event${data.timelineCount !== 1 ? 's' : ''}`)
  if (data.lastContactedAt) {
    keyPoints.push(`Last contact: ${formatDistanceToNow(new Date(data.lastContactedAt), { addSuffix: true })}`)
  }

  return {
    summary: parts.join(' '),
    keyPoints: keyPoints.slice(0, 5),
  }
}

// ---------------------------------------------------------------------------
// POST /api/ai/summarize
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = validateBody(summarizeSchema, body)
    if (parsed instanceof Response) return parsed

    const { entityType, entityId } = parsed

    let result: SummaryResult | null = null
    let usedLlm = false

    // ── Company ──
    if (entityType === 'company') {
      const company = await db.company.findUnique({
        where: { id: entityId },
        include: {
          contacts: { where: { status: { not: 'archived' } }, select: { id: true, rawName: true } },
          researchCard: { select: { businessOverview: true } },
          _count: { select: { notes: true, timeline: true } },
        },
      })

      if (!company) return apiError('Company not found', 404)

      const templateData = {
        name: company.rawName,
        status: company.status,
        industry: company.industry,
        contactCount: company.contacts.length,
        notesCount: company._count.notes,
        timelineCount: company._count.timeline,
        researchOverview: company.researchCard?.businessOverview ?? null,
        intelligenceScore: company.intelligenceScore,
      }

      {
        const systemPrompt = `You are a B2B sales intelligence assistant. Summarize the following company data for a sales rep. Include a concise summary (2-3 sentences) and 3-5 key bullet points.

Company data:
- Name: ${company.rawName}
- Status: ${company.status}
- Industry: ${company.industry ?? 'Unknown'}
- Employees: ${company.sizeRange ?? 'Unknown'}
- Country: ${company.country ?? 'Unknown'}
- Domain: ${company.domain ?? 'Unknown'}
- Intelligence Score: ${company.intelligenceScore ?? 'N/A'}/5
- Contacts: ${company.contacts.length}
- Notes: ${company._count.notes}
- Timeline Events: ${company._count.timeline}
- Research Overview: ${company.researchCard?.businessOverview ?? 'None'}
- Contact Names: ${company.contacts.map((c) => c.rawName).join(', ') || 'None'}

Respond as JSON: { "summary": "...", "keyPoints": ["...", "...", "..."] }`

        try {
          const text = await callLLM(systemPrompt, 'Generate the summary now.')
          result = parseSummaryResponse(text)
          if (result) usedLlm = true
        } catch (llmErr: unknown) {
          const msg = llmErr instanceof Error ? llmErr.message : String(llmErr)
          console.error('[ai/summarize] LLM call failed:', msg)
        }
      }

      if (!result) {
        result = summarizeCompany(templateData)
      }

      return apiSuccess({
        summary: result.summary,
        keyPoints: result.keyPoints,
        confidence: usedLlm ? 0.95 : 0.8,
      })
    }

    // ── Contact ──
    if (entityType === 'contact') {
      const contact = await db.contact.findFirst({
        where: { id: entityId, status: { not: 'archived' } },
        include: {
          company: { select: { rawName: true } },
          drafts: { where: { status: 'draft' }, select: { id: true } },
          _count: { select: { timeline: true } },
        },
      })

      if (!contact) return apiError('Contact not found', 404)

      const templateData = {
        name: contact.rawName,
        title: contact.title,
        companyName: contact.company.rawName,
        emailHealth: contact.emailHealth,
        draftCount: contact.drafts.length,
        timelineCount: contact._count.timeline,
        lastContactedAt: contact.lastContactedAt?.toISOString() ?? null,
        role: contact.role,
      }

      {
        const systemPrompt = `You are a B2B sales intelligence assistant. Summarize the following contact data for a sales rep. Include a concise summary (2-3 sentences) and 3-5 key bullet points.

Contact data:
- Name: ${contact.rawName}
- Job Title: ${contact.title ?? 'Unknown'}
- Role: ${contact.role ?? 'Unknown'}
- Company: ${contact.company.rawName}
- Email: ${contact.email ?? 'None'}
- Email Health: ${contact.emailHealth}
- Email Health Score: ${contact.emailHealthScore ?? 'N/A'}
- Status: ${contact.status}
- Location: ${contact.location ?? 'Unknown'}
- LinkedIn: ${contact.linkedinUrl ?? 'None'}
- Last Contacted: ${contact.lastContactedAt ?? 'Never'}
- Draft Emails: ${contact.drafts.length}
- Timeline Events: ${contact._count.timeline}

Respond as JSON: { "summary": "...", "keyPoints": ["...", "...", "..."] }`

        try {
          const text = await callLLM(systemPrompt, 'Generate the summary now.')
          result = parseSummaryResponse(text)
          if (result) usedLlm = true
        } catch (llmErr: unknown) {
          const msg = llmErr instanceof Error ? llmErr.message : String(llmErr)
          console.error('[ai/summarize] LLM call failed:', msg)
        }
      }

      if (!result) {
        result = summarizeContact(templateData)
      }

      return apiSuccess({
        summary: result.summary,
        keyPoints: result.keyPoints,
        confidence: usedLlm ? 0.95 : 0.8,
      })
    }

    return apiError('Invalid entity type', 400)
  } catch {
    return apiError('Failed to generate summary')
  }
}