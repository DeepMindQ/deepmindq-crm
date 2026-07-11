import { NextRequest } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { apiError, apiSuccess, validateBody } from '@/lib/apiHelpers'
import { updateEmailTemplateSchema } from '@/lib/validations'
import type { EmailTemplate } from '@/lib/types'

// ---------------------------------------------------------------------------
// Built-in templates (same as in the list route)
// ---------------------------------------------------------------------------
const BUILTIN_TEMPLATES: EmailTemplate[] = [
  {
    id: 'builtin-cold-outreach',
    name: 'Cold Outreach',
    category: 'outreach',
    subject: 'Quick question about {{company}}',
    body: 'Hi {{firstName}},\n\nI noticed {{company}} is doing some interesting work in your space. I\'d love to learn more about what you\'re building and explore if there might be ways we could collaborate.\n\nWould you be open to a brief 15-minute chat this week?\n\n{{cta}}',
    description: 'Initial cold outreach to a prospect',
    isBuiltIn: true,
  },
  {
    id: 'builtin-follow-up',
    name: 'Follow-Up',
    category: 'follow-up',
    subject: 'Following up on my previous email',
    body: 'Hi {{firstName}},\n\nJust wanted to follow up on my previous message. I know you\'re busy, but I\'d love to connect if you have a few minutes.\n\n{{cta}}',
    description: 'Follow-up after no response',
    isBuiltIn: true,
  },
  {
    id: 'builtin-meeting-request',
    name: 'Meeting Request',
    category: 'meeting',
    subject: '15 min chat about {{topic}}',
    body: 'Hi {{firstName}},\n\nI\'d love to schedule a brief call to discuss how we might be able to help {{company}}. I promise to keep it short and focused.\n\nWould any of these times work?\n\n{{cta}}',
    description: 'Request a meeting with a prospect',
    isBuiltIn: true,
  },
  {
    id: 'builtin-thank-you',
    name: 'Thank You',
    category: 'post-meeting',
    subject: 'Great meeting you today, {{firstName}}',
    body: 'Hi {{firstName}},\n\nThank you for taking the time to speak with me today. I really enjoyed our conversation about {{topic}}.\n\nAs discussed, I\'ll be sending over {{nextStep}} by {{date}}.\n\n{{cta}}',
    description: 'Post-meeting thank you note',
    isBuiltIn: true,
  },
  {
    id: 'builtin-proposal',
    name: 'Proposal',
    category: 'sales',
    subject: 'Proposal for {{service}} at {{company}}',
    body: 'Hi {{firstName}},\n\nFollowing our discussion, here\'s what I\'d like to propose:\n\n1. {{point1}}\n2. {{point2}}\n3. {{point3}}\n\nI believe this approach will deliver strong results for {{company}}. Happy to discuss any adjustments.\n\n{{cta}}',
    description: 'Send a proposal to a prospect',
    isBuiltIn: true,
  },
  {
    id: 'builtin-reconnection',
    name: 'Reconnection',
    category: 'nurture',
    subject: 'It\'s been a while, {{firstName}}',
    body: 'Hi {{firstName}},\n\nI wanted to reconnect and share some updates. Since we last spoke, we\'ve helped several companies in {{industry}} achieve {{result}}.\n\nWould love to catch up if you\'re open to it.\n\n{{cta}}',
    description: 'Reconnect with a dormant contact',
    isBuiltIn: true,
  },
]

// ---------------------------------------------------------------------------
// Custom templates file storage
// ---------------------------------------------------------------------------
const TEMPLATES_FILE = join(process.cwd(), 'db', 'custom-templates.json')

interface CustomTemplateRecord {
  id: string
  name: string
  subject: string
  body: string
  category: string
  description: string | null
  createdAt: string
  updatedAt: string
}

async function readCustomTemplates(): Promise<CustomTemplateRecord[]> {
  try {
    const raw = await readFile(TEMPLATES_FILE, 'utf-8')
    return JSON.parse(raw) as CustomTemplateRecord[]
  } catch {
    return []
  }
}

async function writeCustomTemplates(templates: CustomTemplateRecord[]): Promise<void> {
  await writeFile(TEMPLATES_FILE, JSON.stringify(templates, null, 2), 'utf-8')
}

function customToTemplate(r: CustomTemplateRecord): EmailTemplate {
  return {
    id: r.id,
    name: r.name,
    subject: r.subject,
    body: r.body,
    category: r.category,
    description: r.description,
    isBuiltIn: false,
  }
}

// Helper: resolve template from built-in or custom
async function findTemplate(id: string): Promise<{ template: EmailTemplate; customIndex?: number } | null> {
  const builtin = BUILTIN_TEMPLATES.find((t) => t.id === id)
  if (builtin) return { template: builtin }

  const customs = await readCustomTemplates()
  const idx = customs.findIndex((t) => t.id === id)
  if (idx >= 0) return { template: customToTemplate(customs[idx]), customIndex: idx }

  return null
}

// ---------------------------------------------------------------------------
// GET /api/email-templates/[id] — Single template
// ---------------------------------------------------------------------------
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const result = await findTemplate(id)
    if (!result) return apiError('Template not found', 404)
    return apiSuccess(result.template)
  } catch {
    return apiError('Failed to fetch template')
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/email-templates/[id] — Update custom template only
// ---------------------------------------------------------------------------
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json()
    const data = validateBody(updateEmailTemplateSchema, body)
    if (data instanceof Response) return data

    const result = await findTemplate(id)
    if (!result) return apiError('Template not found', 404)

    if (result.template.isBuiltIn) {
      return apiError('Cannot modify built-in templates', 403)
    }

    if (result.customIndex === undefined) {
      return apiError('Custom template not found', 404)
    }

    const customs = await readCustomTemplates()
    const record = customs[result.customIndex]
    if (data.name !== undefined) record.name = data.name
    if (data.subject !== undefined) record.subject = data.subject
    if (data.body !== undefined) record.body = data.body
    if (data.category !== undefined) record.category = data.category
    if (data.description !== undefined) record.description = data.description
    record.updatedAt = new Date().toISOString()

    await writeCustomTemplates(customs)

    return apiSuccess(customToTemplate(record))
  } catch {
    return apiError('Failed to update template')
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/email-templates/[id] — Delete custom template only
// ---------------------------------------------------------------------------
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const result = await findTemplate(id)
    if (!result) return apiError('Template not found', 404)

    if (result.template.isBuiltIn) {
      return apiError('Cannot delete built-in templates', 403)
    }

    if (result.customIndex === undefined) {
      return apiError('Custom template not found', 404)
    }

    const customs = await readCustomTemplates()
    customs.splice(result.customIndex, 1)
    await writeCustomTemplates(customs)

    return apiSuccess({ deleted: true })
  } catch {
    return apiError('Failed to delete template')
  }
}