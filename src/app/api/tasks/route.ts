import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiError, apiSuccess, validateBody, sanitize, safeInt } from '@/lib/apiHelpers'
import { createTaskSchema } from '@/lib/validations'

// Dev mode: use the first user in the DB
async function getDevUserId(): Promise<string> {
  const user = await db.user.findFirst({ select: { id: true } })
  if (!user) return '1'
  return user.id
}

async function enrichTasks(tasks: any[]): Promise<any[]> {
  const companyIds = [...new Set(tasks.filter((t: any) => t.companyId).map((t: any) => t.companyId))] as string[]
  const contactIds = [...new Set(tasks.filter((t: any) => t.contactId).map((t: any) => t.contactId))] as string[]

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

export async function GET(request: NextRequest) {
  try {
    const userId = await getDevUserId()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || ''
    const priority = searchParams.get('priority') || ''
    const companyId = searchParams.get('companyId') || ''
    const limit = Math.min(100, Math.max(1, safeInt(searchParams.get('limit'), 20)))
    const offset = Math.max(0, safeInt(searchParams.get('offset'), 0))

    const where: Record<string, unknown> = { createdBy: userId }

    if (status) {
      where.status = status
    }
    if (priority) {
      where.priority = priority
    }
    if (companyId) {
      where.companyId = companyId
    }

    const [tasks, total] = await Promise.all([
      db.task.findMany({
        where,
        orderBy: [
          { dueDate: { sort: 'asc', nulls: 'first' } },
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
        take: limit,
        skip: offset,
      }),
      db.task.count({ where }),
    ])

    const enriched = await enrichTasks(tasks)
    return apiSuccess({ data: enriched, total })
  } catch (error) {
    console.error('Failed to fetch tasks:', error)
    return apiError('Failed to fetch tasks', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getDevUserId()
    const body = await request.json()
    const data = validateBody(createTaskSchema, body)
    if (data instanceof Response) return data

    // Validate company exists if provided
    if (data.companyId) {
      const company = await db.company.findUnique({ where: { id: data.companyId } })
      if (!company) {
        return apiError('Company not found', 404)
      }
    }

    // Validate contact exists if provided
    if (data.contactId) {
      const contact = await db.contact.findUnique({ where: { id: data.contactId } })
      if (!contact) {
        return apiError('Contact not found', 404)
      }
    }

    const taskData: Record<string, unknown> = {
      title: sanitize(data.title),
      description: data.description ? sanitize(data.description) : null,
      status: data.status,
      priority: data.priority,
      companyId: data.companyId || null,
      contactId: data.contactId || null,
      assignedTo: userId,
      createdBy: userId,
    }

    // Parse dueDate if provided
    if (data.dueDate && data.dueDate !== '') {
      taskData.dueDate = new Date(data.dueDate)
    }

    const task = await db.task.create({
      data: taskData as any,
    })

    // Create timeline entry if linked to a company
    if (data.companyId) {
      await db.timelineEntry.create({
        data: {
          companyId: data.companyId,
          action: 'note_added',
          details: `Task created: "${data.title}"`,
        },
      })
    }

    const enriched = await enrichTasks([task])
    return apiSuccess(enriched[0], 201)
  } catch (error) {
    console.error('Failed to create task:', error)
    return apiError('Failed to create task', 500)
  }
}