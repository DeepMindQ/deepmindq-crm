import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiError, apiSuccess, validateBody, sanitize } from '@/lib/apiHelpers'
import { updateTaskSchema } from '@/lib/validations'

type TaskWithNames = Record<string, unknown> & {
  companyName?: string | null
  contactName?: string | null
}

async function enrichTasks(tasks: any[]): Promise<TaskWithNames[]> {
  const companyIds = [...new Set(tasks.filter(t => t.companyId).map(t => t.companyId))] as string[]
  const contactIds = [...new Set(tasks.filter(t => t.contactId).map(t => t.contactId))] as string[]

  const [companies, contacts] = await Promise.all([
    companyIds.length > 0
      ? db.company.findMany({ where: { id: { in: companyIds } }, select: { id: true, name: true } })
      : [],
    contactIds.length > 0
      ? db.contact.findMany({ where: { id: { in: contactIds } }, select: { id: true, name: true } })
      : [],
  ])

  const companyMap = new Map(companies.map((c): [string, string] => [c.id, c.name]))
  const contactMap = new Map(contacts.map((c): [string, string] => [c.id, c.name]))

  return tasks.map(task => ({
    ...task,
    companyName: task.companyId ? (companyMap.get(task.companyId) ?? null) : null,
    contactName: task.contactId ? (contactMap.get(task.contactId) ?? null) : null,
  }))
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const task = await db.task.findUnique({ where: { id } })
    if (!task) {
      return apiError('Task not found', 404)
    }

    const enriched = await enrichTasks([task])
    return apiSuccess(enriched[0])
  } catch (error) {
    console.error('Failed to fetch task:', error)
    return apiError('Failed to fetch task', 500)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const raw = await request.json()
    const parsed = validateBody(updateTaskSchema, raw)
    if (parsed instanceof Response) return parsed

    const existing = await db.task.findUnique({ where: { id } })
    if (!existing) {
      return apiError('Task not found', 404)
    }

    const data: Record<string, unknown> = {}

    if (parsed.title !== undefined) data.title = sanitize(parsed.title)
    if (parsed.description !== undefined) {
      data.description = parsed.description ? sanitize(parsed.description) : null
    }
    if (parsed.priority !== undefined) data.priority = parsed.priority
    if (parsed.companyId !== undefined) {
      if (parsed.companyId !== null) {
        const company = await db.company.findUnique({ where: { id: parsed.companyId } })
        if (!company) return apiError('Company not found', 404)
      }
      data.companyId = parsed.companyId
    }
    if (parsed.contactId !== undefined) {
      if (parsed.contactId !== null) {
        const contact = await db.contact.findUnique({ where: { id: parsed.contactId } })
        if (!contact) return apiError('Contact not found', 404)
      }
      data.contactId = parsed.contactId
    }
    if (parsed.dueDate !== undefined) {
      data.dueDate = parsed.dueDate && parsed.dueDate !== '' ? new Date(parsed.dueDate) : null
    }

    // Handle status change — set completedAt when moving to completed
    if (parsed.status !== undefined) {
      data.status = parsed.status
      if (parsed.status === 'completed' && existing.status !== 'completed') {
        data.completedAt = new Date()
      } else if (parsed.status !== 'completed') {
        data.completedAt = null
      }
    }

    const updated = await db.task.update({
      where: { id },
      data,
    })

    // Create timeline entry on status change if linked to a company
    if (parsed.status !== undefined && parsed.status !== existing.status && existing.companyId) {
      await db.timelineEntry.create({
        data: {
          companyId: existing.companyId,
          action: 'status_changed',
          details: `Task "${existing.title}" status changed from "${existing.status}" to "${parsed.status}"`,
        },
      })
    }

    const enriched = await enrichTasks([updated])
    return apiSuccess(enriched[0])
  } catch (error) {
    console.error('Failed to update task:', error)
    return apiError('Failed to update task', 500)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.task.findUnique({ where: { id } })
    if (!existing) {
      return apiError('Task not found', 404)
    }

    await db.task.delete({ where: { id } })

    // Create timeline entry if linked to a company
    if (existing.companyId) {
      await db.timelineEntry.create({
        data: {
          companyId: existing.companyId,
          action: 'deleted',
          details: `Task "${existing.title}" was deleted`,
        },
      })
    }

    return apiSuccess({ success: true })
  } catch (error) {
    console.error('Failed to delete task:', error)
    return apiError('Failed to delete task', 500)
  }
}