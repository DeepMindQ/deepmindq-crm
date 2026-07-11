import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiSuccess, apiError, validateBody } from '@/lib/apiHelpers'
import { createCustomFieldSchema } from '@/lib/validations'

// GET /api/custom-fields — list all custom field definitions, optionally filtered by entityType
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const entityType = searchParams.get('entityType')

    const fields = await db.customFieldDefinition.findMany({
      where: entityType ? { entityType } : undefined,
      orderBy: [{ entityType: 'asc' }, { displayName: 'asc' }],
      include: {
        _count: { select: { fieldValues: true } },
      },
    })

    return apiSuccess({ data: fields })
  } catch (error) {
    console.error('[GET /api/custom-fields]', error)
    return apiError('Failed to fetch custom fields')
  }
}

// POST /api/custom-fields — create a custom field definition
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = validateBody(createCustomFieldSchema, body)
    if (data instanceof Response) return data

    // Check uniqueness: internalKey must be unique within the same entityType
    const existing = await db.customFieldDefinition.findFirst({
      where: {
        entityType: data.entityType,
        internalKey: data.internalKey,
      },
    })
    if (existing) {
      return apiError(
        `A field with key "${data.internalKey}" already exists for ${data.entityType}`,
        409,
      )
    }

    const field = await db.customFieldDefinition.create({
      data: {
        entityType: data.entityType,
        sourceHeader: data.sourceHeader,
        internalKey: data.internalKey,
        displayName: data.displayName,
        dataType: data.dataType,
        isSearchable: data.isSearchable,
        isFilterable: data.isFilterable,
      },
    })

    return apiSuccess({ data: field }, 201)
  } catch (error) {
    console.error('[POST /api/custom-fields]', error)
    return apiError('Failed to create custom field')
  }
}
