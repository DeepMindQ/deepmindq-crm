import { NextRequest } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { apiError, apiSuccess, validateBody } from '@/lib/apiHelpers'
import { createEmailTemplateSchema } from '@/lib/validations'
import type { EmailTemplate } from '@/lib/types'

// ---------------------------------------------------------------------------
// Built-in templates (read-only, always returned)
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
  const dir = join(process.cwd(), 'db')
  await mkdir(dir, { recursive: true })
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

// ---------------------------------------------------------------------------
// GET /api/email-templates — List all templates (built-in + custom)
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const customs = await readCustomTemplates()
    const all: EmailTemplate[] = [
      ...BUILTIN_TEMPLATES,
      ...customs.map(customToTemplate),
    ]
    return apiSuccess({ templates: all, total: all.length })
  } catch {
    return apiError('Failed to fetch templates')
  }
}

// ---------------------------------------------------------------------------
// POST /api/email-templates — Create a custom template
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = validateBody(createEmailTemplateSchema, body)
    if (data instanceof Response) return data

    const customs = await readCustomTemplates()
    const newTemplate: CustomTemplateRecord = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: data.name,
      subject: data.subject,
      body: data.body,
      category: data.category || 'custom',
      description: data.description || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    customs.push(newTemplate)
    await writeCustomTemplates(customs)

    return apiSuccess(customToTemplate(newTemplate), 201)
  } catch {
    return apiError('Failed to create template')
  }
}