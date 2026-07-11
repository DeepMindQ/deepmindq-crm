import { db } from '@/lib/db'
import { apiError, apiSuccess, validateBody } from '@/lib/apiHelpers'
import { z } from 'zod'

const BUILTIN_IDS = new Set([
  'builtin-cold-outreach-v1',
  'builtin-casual-outreach',
  'builtin-follow-up-v1',
  'builtin-meeting-ask',
  'builtin-research-v1',
  'builtin-competitor-analysis',
])

/* ── GET: Single template ── */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    // Check built-in first
    if (BUILTIN_IDS.has(id)) {
      const { BUILTIN_PROMPTS } = await import('../route')
      const builtin = (BUILTIN_PROMPTS as any[]).find((p: any) => p.id === id)
      if (builtin) {
        return apiSuccess({
          id: builtin.id,
          name: builtin.name,
          category: builtin.category,
          description: builtin.description,
          systemPrompt: builtin.systemPrompt,
          userPromptTemplate: builtin.userPromptTemplate,
          variables: builtin.variables,
          isBuiltIn: true,
          createdAt: null,
          updatedAt: null,
        })
      }
      return apiError('Template not found', 404)
    }

    const template = await db.promptTemplate.findUnique({ where: { id } })
    if (!template) return apiError('Template not found', 404)

    return apiSuccess({
      id: template.id,
      name: template.name,
      category: template.category,
      description: template.description,
      systemPrompt: template.systemPrompt,
      userPromptTemplate: template.userPromptTemplate,
      variables: JSON.parse(template.variables) as string[],
      isBuiltIn: false,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Failed to get prompt template:', error)
    return apiError('Failed to get prompt template', 500)
  }
}

/* ── PATCH: Update custom template ── */
const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  category: z.string().min(1).optional(),
  description: z.string().max(1000).nullable().optional(),
  systemPrompt: z.string().min(1).max(10000).optional(),
  userPromptTemplate: z.string().min(1).max(10000).optional(),
  variables: z.array(z.string()).optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    if (BUILTIN_IDS.has(id)) {
      return apiError('Cannot modify built-in templates', 403)
    }

    const existing = await db.promptTemplate.findUnique({ where: { id } })
    if (!existing) return apiError('Template not found', 404)

    const body = await request.json()
    const data = validateBody(updateSchema, body)
    if (data instanceof Response) return data

    // Re-extract variables if userPromptTemplate changed
    let variables = data.variables
    if (!variables && data.userPromptTemplate) {
      variables = extractVariables(data.userPromptTemplate)
    }

    const updateData: Record<string, any> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.category !== undefined) updateData.category = data.category
    if (data.description !== undefined) updateData.description = data.description
    if (data.systemPrompt !== undefined) updateData.systemPrompt = data.systemPrompt
    if (data.userPromptTemplate !== undefined) {
      updateData.userPromptTemplate = data.userPromptTemplate
      updateData.variables = JSON.stringify(variables ?? extractVariables(data.userPromptTemplate))
    }
    if (data.variables !== undefined) {
      updateData.variables = JSON.stringify(data.variables)
    }

    const updated = await db.promptTemplate.update({
      where: { id },
      data: updateData,
    })

    return apiSuccess({
      ...updated,
      variables: JSON.parse(updated.variables) as string[],
    })
  } catch (error) {
    console.error('Failed to update prompt template:', error)
    return apiError('Failed to update prompt template', 500)
  }
}

/* ── DELETE: Delete custom template ── */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    if (BUILTIN_IDS.has(id)) {
      return apiError('Cannot delete built-in templates', 403)
    }

    const existing = await db.promptTemplate.findUnique({ where: { id } })
    if (!existing) return apiError('Template not found', 404)

    await db.promptTemplate.delete({ where: { id } })
    return apiSuccess({ deleted: true })
  } catch (error) {
    console.error('Failed to delete prompt template:', error)
    return apiError('Failed to delete prompt template', 500)
  }
}

/* ── Helpers ── */
function extractVariables(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g)
  if (!matches) return []
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))]
}