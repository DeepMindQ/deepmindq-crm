import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { apiError, apiSuccess, validateBody } from '@/lib/apiHelpers'
import { formatDistanceToNow } from 'date-fns'

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const summarizeSchema = z.object({
  entityType: z.enum(['company', 'contact', 'opportunity']),
  entityId: z.string().min(1),
})

// ---------------------------------------------------------------------------
// LLM helper — uses z-ai-web-dev-sdk (auth handled internally)
// ---------------------------------------------------------------------------

interface SummaryResult {
  summary: string
  keyPoints: string[]
}

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const { ensureZaiConfig } = await import('@/lib/zai-config');
  await ensureZaiConfig();
  const ZAI = await import('z-ai-web-dev-sdk').then(m => m.default).then(Z => Z.create())
  const completion = await ZAI.chat.completions.create({
    messages: [
      { role: 'assistant', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    thinking: { type: 'disabled' },
  })
  return completion.choices?.[0]?.message?.content ?? ''
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
  intelligenceScore: number
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
  if (data.intelligenceScore) keyPoints.push(`Intelligence score: ${data.intelligenceScore}/100`)
  if (data.researchOverview) keyPoints.push('Research card available')

  return {
    summary: parts.join(' '),
    keyPoints: keyPoints.slice(0, 5),
  }
}

function summarizeContact(data: {
  name: string
  jobTitle: string | null
  companyName: string
  emailHealth: string
  draftCount: number
  timelineCount: number
  lastContactedAt: string | null
}): SummaryResult {
  const parts: string[] = []
  const role = data.jobTitle ?? 'team member'
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

function summarizeOpportunity(data: {
  title: string
  companyName: string
  status: string
  contactName: string | null
  nextAction: string | null
  createdAt: string
  updatedAt: string
  description: string | null
}): SummaryResult {
  const parts: string[] = []
  parts.push(`"${data.title}" is an opportunity with ${data.companyName}, currently in the ${data.status} stage.`)

  if (data.contactName) {
    parts.push(`Target contact: ${data.contactName}.`)
  }

  if (data.nextAction) {
    parts.push(`Next action: ${data.nextAction}.`)
  }

  if (data.description) {
    parts.push(data.description.slice(0, 200) + (data.description.length > 200 ? '...' : ''))
  }

  const keyPoints: string[] = []
  keyPoints.push(`Stage: ${data.status}`)
  if (data.contactName) keyPoints.push(`Contact: ${data.contactName}`)
  if (data.nextAction) keyPoints.push(`Next action: ${data.nextAction}`)
  keyPoints.push(`Created ${formatDistanceToNow(new Date(data.createdAt), { addSuffix: true })}`)
  keyPoints.push(`Last updated ${formatDistanceToNow(new Date(data.updatedAt), { addSuffix: true })}`)

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
          contacts: { select: { id: true, rawName: true } },
          researchCard: { select: { businessOverview: true } },
          timeline: { select: { id: true } },
          notes: { select: { id: true } },
        },
      })

      if (!company) return apiError('Company not found', 404)

      const templateData = {
        name: company.rawName,
        status: company.status,
        industry: company.industry,
        contactCount: company.contacts.length,
        notesCount: company.notes.length,
        timelineCount: company.timeline.length,
        researchOverview: company.researchCard?.businessOverview ?? null,
        intelligenceScore: company.intelligenceScore,
      }

      {
        const systemPrompt = `You are a B2B sales intelligence assistant. Summarize the following company data for a sales rep. Include a concise summary (2-3 sentences) and 3-5 key bullet points.

Company data:
- Name: ${company.rawName}
- Status: ${company.status}
- Industry: ${company.industry ?? 'Unknown'}
- Size Range: ${company.sizeRange ?? 'Unknown'}
- Country: ${company.country ?? 'Unknown'}
- Domain: ${company.domain ?? 'Unknown'}
- Intelligence Score: ${company.intelligenceScore}/100
- Contacts: ${company.contacts.length}
- Notes: ${company.notes.length}
- Timeline Events: ${company.timeline.length}
- Research Overview: ${company.researchCard?.businessOverview ?? 'None'}
- Contact Names: ${company.contacts.map((c) => c.rawName).join(', ') || 'None'}

Respond as JSON: { "summary": "...", "keyPoints": ["...", "...", "..."] }`

        try {
          const text = await callAI(systemPrompt, 'Generate the summary now.')
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
        where: { id: entityId },
        include: {
          company: { select: { rawName: true } },
          drafts: { where: { status: 'draft' }, select: { id: true } },
          replies: { select: { id: true } },
        },
      })

      if (!contact) return apiError('Contact not found', 404)

      const templateData = {
        name: contact.rawName,
        jobTitle: contact.title,
        companyName: contact.company.rawName,
        emailHealth: contact.emailHealth,
        draftCount: contact.drafts.length,
        timelineCount: contact.replies.length,
        lastContactedAt: contact.lastContactedAt?.toISOString() ?? null,
      }

      {
        const systemPrompt = `You are a B2B sales intelligence assistant. Summarize the following contact data for a sales rep. Include a concise summary (2-3 sentences) and 3-5 key bullet points.

Contact data:
- Name: ${contact.rawName}
- Job Title: ${contact.title ?? 'Unknown'}
- Company: ${contact.company.rawName}
- Email: ${contact.email ?? 'None'}
- Email Health: ${contact.emailHealth}
- Email Health Score: ${contact.emailHealthScore ?? 'N/A'}
- Status: ${contact.status}
- Location: ${contact.location ?? 'Unknown'}
- LinkedIn: ${contact.linkedinUrl ?? 'None'}
- Last Contacted: ${contact.lastContactedAt ?? 'Never'}
- Draft Emails: ${contact.drafts.length}

Respond as JSON: { "summary": "...", "keyPoints": ["...", "...", "..."] }`

        try {
          const text = await callAI(systemPrompt, 'Generate the summary now.')
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

    // ── Opportunity ──
    if (entityType === 'opportunity') {
      const pursuit = await db.pursuit.findUnique({
        where: { id: entityId },
        include: {
          company: true,
          opportunity: { select: { opportunityTitle: true } },
        },
      })

      if (!pursuit) return apiError('Opportunity not found', 404)

      const templateData = {
        title: pursuit.opportunity?.opportunityTitle ?? 'Untitled',
        companyName: pursuit.company.rawName,
        status: pursuit.status,
        contactName: null,
        nextAction: pursuit.nextAction,
        createdAt: pursuit.createdAt.toISOString(),
        updatedAt: pursuit.updatedAt.toISOString(),
        description: pursuit.notes,
      }

      {
        const systemPrompt = `You are a B2B sales intelligence assistant. Summarize the following opportunity for a sales rep. Include a concise summary (2-3 sentences) and 3-5 key bullet points.

Opportunity data:
- Title: ${pursuit.opportunity?.opportunityTitle ?? 'Untitled'}
- Company: ${pursuit.company.rawName}
- Status: ${pursuit.status}
- Next Action: ${pursuit.nextAction ?? 'None'}
- Description: ${pursuit.notes ?? 'None'}
- Created: ${pursuit.createdAt.toISOString()}
- Updated: ${pursuit.updatedAt.toISOString()}

Respond as JSON: { "summary": "...", "keyPoints": ["...", "...", "..."] }`

        try {
          const text = await callAI(systemPrompt, 'Generate the summary now.')
          result = parseSummaryResponse(text)
          if (result) usedLlm = true
        } catch (llmErr: unknown) {
          const msg = llmErr instanceof Error ? llmErr.message : String(llmErr)
          console.error('[ai/summarize] LLM call failed:', msg)
        }
      }

      if (!result) {
        result = summarizeOpportunity(templateData)
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