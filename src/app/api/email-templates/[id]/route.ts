import { NextRequest } from 'next/server'
import { apiError, apiSuccess, validateBody } from '@/lib/apiHelpers'
import { updateEmailTemplateSchema } from '@/lib/validations'
import { db } from '@/lib/db'
import type { EmailTemplate } from '@/lib/types'
import { checkApiAuth } from '@/lib/api-auth'

const BUILTIN_TEMPLATES: EmailTemplate[] = [
  { id: 'builtin-cold-outreach', name: 'Cold Outreach', category: 'outreach', subject: 'Quick question about {{company}}', body: 'Hi {{firstName}},\n\nI noticed {{company}} is doing some interesting work in your space.\n\n{{cta}}', description: 'Initial cold outreach', isBuiltIn: true },
  { id: 'builtin-follow-up', name: 'Follow-Up', category: 'follow-up', subject: 'Following up', body: 'Hi {{firstName}},\n\nJust following up.\n\n{{cta}}', description: 'Follow-up after no response', isBuiltIn: true },
  { id: 'builtin-meeting-request', name: 'Meeting Request', category: 'meeting', subject: '15 min chat', body: 'Hi {{firstName}},\n\nI\'d love to schedule a brief call.\n\n{{cta}}', description: 'Request a meeting', isBuiltIn: true },
  { id: 'builtin-thank-you', name: 'Thank You', category: 'post-meeting', subject: 'Great meeting you', body: 'Hi {{firstName}},\n\nThank you for the conversation.\n\n{{cta}}', description: 'Post-meeting thank you', isBuiltIn: true },
  { id: 'builtin-proposal', name: 'Proposal', category: 'sales', subject: 'Proposal', body: 'Hi {{firstName}},\n\nHere is our proposal.\n\n{{cta}}', description: 'Send a proposal', isBuiltIn: true },
  { id: 'builtin-reconnection', name: 'Reconnection', category: 'nurture', subject: 'Reconnecting', body: 'Hi {{firstName}},\n\nWanted to reconnect.\n\n{{cta}}', description: 'Reconnect dormant contact', isBuiltIn: true },
]

function dbToTemplate(r: { id: string; name: string; subject: string; body: string; category: string; description: string | null }): EmailTemplate {
  return { id: r.id, name: r.name, subject: r.subject, body: r.body, category: r.category, description: r.description, isBuiltIn: false }
}

// GET /api/email-templates/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

try {
    const { id } = await params
    const builtin = BUILTIN_TEMPLATES.find((t) => t.id === id)
    if (builtin) return apiSuccess(builtin)

    const custom = await db.customEmailTemplate.findUnique({ where: { id } })
    if (!custom) return apiError('Template not found', 404)
    return apiSuccess(dbToTemplate(custom))
  } catch {
    return apiError('Failed to fetch template')
  }
}

// PATCH /api/email-templates/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

try {
    const { id } = await params
    const body = await req.json()
    const data = validateBody(updateEmailTemplateSchema, body)
    if (data instanceof Response) return data

    const builtin = BUILTIN_TEMPLATES.find((t) => t.id === id)
    if (builtin) return apiError('Cannot modify built-in templates', 403)

    const updated = await db.customEmailTemplate.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.subject !== undefined && { subject: data.subject }),
        ...(data.body !== undefined && { body: data.body }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.description !== undefined && { description: data.description }),
      },
    })

    return apiSuccess(dbToTemplate(updated))
  } catch {
    return apiError('Failed to update template')
  }
}

// DELETE /api/email-templates/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

try {
    const { id } = await params
    const builtin = BUILTIN_TEMPLATES.find((t) => t.id === id)
    if (builtin) return apiError('Cannot delete built-in templates', 403)

    await db.customEmailTemplate.delete({ where: { id } })
    return apiSuccess({ deleted: true })
  } catch {
    return apiError('Failed to delete template')
  }
}
