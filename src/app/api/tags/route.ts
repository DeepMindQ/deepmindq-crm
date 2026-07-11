import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiSuccess, apiError, validateBody } from '@/lib/apiHelpers'
import { createTagSchema } from '@/lib/validations'
import { sanitize } from '@/lib/apiHelpers'

// GET /api/tags — list all tags, optionally filtered by entity
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const entity = searchParams.get('entity') // 'company' | 'contact'

    let tags

    if (entity === 'company') {
      tags = await db.tag.findMany({
        where: { assignments: { some: { companyId: { not: null } } } },
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { assignments: { where: { companyId: { not: null } } } },
          },
        },
      })
    } else if (entity === 'contact') {
      tags = await db.tag.findMany({
        where: { assignments: { some: { contactId: { not: null } } } },
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { assignments: { where: { contactId: { not: null } } } },
          },
        },
      })
    } else {
      tags = await db.tag.findMany({
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { assignments: true } },
        },
      })
    }

    return apiSuccess({ data: tags })
  } catch (error) {
    console.error('[GET /api/tags]', error)
    return apiError('Failed to fetch tags')
  }
}

// POST /api/tags — create a new tag
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = validateBody(createTagSchema, body)
    if (data instanceof Response) return data

    // Check uniqueness
    const existing = await db.tag.findUnique({ where: { name: data.name.trim() } })
    if (existing) {
      return apiError('A tag with this name already exists', 409)
    }

    const tag = await db.tag.create({
      data: {
        name: data.name.trim(),
        color: data.color || 'gray',
      },
    })

    return apiSuccess({ data: tag }, 201)
  } catch (error) {
    console.error('[POST /api/tags]', error)
    return apiError('Failed to create tag')
  }
}
