import { db } from '@/lib/db'
import { apiError, apiSuccess, validateBody } from '@/lib/apiHelpers'
import { z } from 'zod'

/* ── Built-in templates ── */
export const BUILTIN_PROMPTS = [
  {
    id: 'builtin-cold-outreach-v1',
    name: 'Professional Cold Outreach',
    category: 'email',
    description: 'Formal B2B cold email with research-backed personalization',
    systemPrompt:
      'You are a professional B2B sales writer. Craft personalized, concise cold emails that demonstrate genuine understanding of the prospect\'s business. Focus on value proposition, keep tone confident but not aggressive, and always include a clear but soft call-to-action.',
    userPromptTemplate:
      'Write a cold outreach email to {{contactName}} at {{companyName}} ({{industry}}). {{researchContext}} The email should be 3-4 paragraphs, professional yet approachable, with a soft CTA requesting a brief call.',
    variables: ['contactName', 'companyName', 'industry', 'researchContext'],
  },
  {
    id: 'builtin-casual-outreach',
    name: 'Casual Friendly Outreach',
    category: 'email',
    description: 'Relaxed, conversational cold email for warm introductions',
    systemPrompt:
      'You are a friendly B2B outreach specialist. Write warm, conversational emails that feel personal and human. Use a relaxed tone, short sentences, and casual language. Avoid corporate jargon. Make it feel like you\'re writing to a colleague, not a prospect.',
    userPromptTemplate:
      'Write a casual, friendly cold email to {{contactName}} at {{companyName}} in the {{industry}} space. {{researchContext}} Keep it under 150 words, warm and conversational, with a casual meeting ask.',
    variables: ['contactName', 'companyName', 'industry', 'researchContext'],
  },
  {
    id: 'builtin-follow-up-v1',
    name: 'Gentle Follow-Up',
    category: 'email',
    description: 'Polite follow-up after initial outreach with no response',
    systemPrompt:
      'You are writing a polite follow-up email. Be brief, add new value or a fresh angle, and never sound pushy. Reference the previous email subtly. The goal is to re-engage without being annoying.',
    userPromptTemplate:
      'Write a gentle follow-up email to {{contactName}} at {{companyName}}. {{researchContext}} This is a follow-up after our initial outreach. Add a new insight or value angle. Keep it short (2-3 paragraphs max) with a soft CTA.',
    variables: ['contactName', 'companyName', 'researchContext'],
  },
  {
    id: 'builtin-meeting-ask',
    name: 'Meeting Request',
    category: 'email',
    description: 'Request a discovery call or product demo',
    systemPrompt:
      'You are requesting a meeting with a prospect. Write a compelling, concise email that clearly articulates what they\'ll gain from the meeting. Be specific about the agenda, respectful of their time, and make the ask direct but polite.',
    userPromptTemplate:
      'Write a meeting request email to {{contactName}} at {{companyName}} ({{industry}}). {{researchContext}} Propose a 15-20 minute discovery call. Be specific about potential agenda items and what value they\'ll get.',
    variables: ['contactName', 'companyName', 'industry', 'researchContext'],
  },
  {
    id: 'builtin-research-v1',
    name: 'Company Research',
    category: 'research',
    description: 'Comprehensive company intelligence report',
    systemPrompt:
      'You are a business intelligence analyst. Generate a comprehensive research report covering: business overview, current technology landscape, potential challenges, growth opportunities, relevant services we could offer, and key decision makers. Be factual, structured, and actionable.',
    userPromptTemplate:
      'Generate a comprehensive research report for {{companyName}} in the {{industry}} industry. {{researchContext}} Company size: {{employeeSize}}. Location: {{location}}. Cover business overview, tech landscape, challenges, opportunities, and recommended approach.',
    variables: ['companyName', 'industry', 'researchContext', 'employeeSize', 'location'],
  },
  {
    id: 'builtin-competitor-analysis',
    name: 'Competitive Analysis',
    category: 'research',
    description: 'Analyze company competitive position and market landscape',
    systemPrompt:
      'You are a competitive intelligence analyst. Analyze the competitive landscape for the target company. Identify key competitors, market position, differentiation opportunities, and strategic recommendations. Be analytical, data-driven, and objective.',
    userPromptTemplate:
      'Perform a competitive analysis for {{companyName}} in the {{industry}} sector. {{researchContext}} Identify main competitors, analyze market positioning, and suggest differentiation strategies.',
    variables: ['companyName', 'industry', 'researchContext'],
  },
]

/* ── GET: List all templates (built-in + custom) ── */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    // Always start with built-in
    const builtins = category
      ? BUILTIN_PROMPTS.filter((p) => p.category === category)
      : BUILTIN_PROMPTS

    // Fetch custom templates from DB
    const where = category ? { category, isBuiltIn: false } : { isBuiltIn: false }
    const customTemplates = await db.promptTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    const mapped = [
      ...builtins.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        description: p.description,
        systemPrompt: p.systemPrompt,
        userPromptTemplate: p.userPromptTemplate,
        variables: p.variables,
        isBuiltIn: true,
        createdAt: null,
        updatedAt: null,
      })),
      ...customTemplates.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        description: p.description,
        systemPrompt: p.systemPrompt,
        userPromptTemplate: p.userPromptTemplate,
        variables: JSON.parse(p.variables) as string[],
        isBuiltIn: false,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
    ]

    return apiSuccess(mapped)
  } catch (error) {
    console.error('Failed to list prompt templates:', error)
    return apiError('Failed to list prompt templates', 500)
  }
}

/* ── POST: Create custom template ── */
const createSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().min(1),
  description: z.string().max(1000).optional(),
  systemPrompt: z.string().min(1).max(10000),
  userPromptTemplate: z.string().min(1).max(10000),
  variables: z.array(z.string()).optional(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const data = validateBody(createSchema, body)
    if (data instanceof Response) return data

    // Auto-detect variables from template if not provided
    const variables = data.variables ?? extractVariables(data.userPromptTemplate)

    const template = await db.promptTemplate.create({
      data: {
        name: data.name,
        category: data.category,
        description: data.description ?? null,
        systemPrompt: data.systemPrompt,
        userPromptTemplate: data.userPromptTemplate,
        variables: JSON.stringify(variables),
      },
    })

    return apiSuccess({
      ...template,
      variables: JSON.parse(template.variables) as string[],
    })
  } catch (error) {
    console.error('Failed to create prompt template:', error)
    return apiError('Failed to create prompt template', 500)
  }
}

/* ── Helpers ── */
function extractVariables(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g)
  if (!matches) return []
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))]
}