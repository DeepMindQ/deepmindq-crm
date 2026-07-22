import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiSuccess, apiError, validateBody, safeInt } from '@/lib/apiHelpers'
import { updateCustomFieldSchema } from '@/lib/validations'

// PATCH /api/custom-fields/[id] — update a field definition
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json()
    const data = validateBody(updateCustomFieldSchema, body)
    if (data instanceof Response) return data

    const field = await db.customFieldDefinition.findUnique({ where: { id } })
    if (!field) return apiError('Custom field not found', 404)

    const updated = await db.customFieldDefinition.update({
      where: { id },
      data,
    })

    return apiSuccess({ data: updated })
  } catch (error) {
    console.error('[PATCH /api/custom-fields/[id]]', error)
    return apiError('Failed to update custom field')
  }
}

// DELETE /api/custom-fields/[id] — delete field and all values
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const field = await db.customFieldDefinition.findUnique({ where: { id } })
    if (!field) return apiError('Custom field not found', 404)

    // Values are deleted via cascade
    await db.customFieldDefinition.delete({ where: { id } })

    return apiSuccess({ data: { deleted: true } })
  } catch (error) {
    console.error('[DELETE /api/custom-fields/[id]]', error)
    return apiError('Failed to delete custom field')
  }
}
