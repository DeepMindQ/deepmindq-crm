import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiSuccess, apiError, validateBody } from '@/lib/apiHelpers'
import { upsertCustomFieldValuesSchema } from '@/lib/validations'

// GET /api/custom-fields/values — get custom field values for an entity
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')

    if (!entityType || !entityId) {
      return apiError('entityType and entityId are required', 400)
    }

    const whereField =
      entityType === 'Company' ? 'companyId' : 'contactId'

    const values = await db.customFieldValue.findMany({
      where: { [whereField]: entityId },
      include: { field: true },
      orderBy: { createdAt: 'asc' },
    })

    return apiSuccess({ data: values })
  } catch (error) {
    console.error('[GET /api/custom-fields/values]', error)
    return apiError('Failed to fetch custom field values')
  }
}

// POST /api/custom-fields/values — upsert custom field values for an entity
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = validateBody(upsertCustomFieldValuesSchema, body)
    if (data instanceof Response) return data

    const { entityType, entityId, values } = data
    const whereField =
      entityType === 'Company' ? 'companyId' : 'contactId'

    // Validate entity exists
    if (entityType === 'Company') {
      const company = await db.company.findUnique({ where: { id: entityId } })
      if (!company) return apiError('Company not found', 404)
    } else {
      const contact = await db.contact.findUnique({ where: { id: entityId } })
      if (!contact) return apiError('Contact not found', 404)
    }

    // Upsert each value
    for (const item of values) {
      // Validate field exists and matches entity type
      const field = await db.customFieldDefinition.findUnique({
        where: { id: item.fieldId },
      })
      if (!field || field.entityType !== entityType) continue

      const rawValue = item.value == null ? null : String(item.value)

      // Upsert: find existing or create new
      const existing = await db.customFieldValue.findFirst({
        where: {
          fieldId: item.fieldId,
          [whereField]: entityId,
        },
      })

      if (existing) {
        await db.customFieldValue.update({
          where: { id: existing.id },
          data: { rawValue },
        })
      } else {
        await db.customFieldValue.create({
          data: {
            fieldId: item.fieldId,
            [whereField]: entityId,
            rawValue,
          },
        })
      }
    }

    // Return updated values
    const updatedValues = await db.customFieldValue.findMany({
      where: { [whereField]: entityId },
      include: { field: true },
      orderBy: { createdAt: 'asc' },
    })

    return apiSuccess({ data: updatedValues })
  } catch (error) {
    console.error('[POST /api/custom-fields/values]', error)
    return apiError('Failed to upsert custom field values')
  }
}
