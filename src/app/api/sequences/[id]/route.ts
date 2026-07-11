import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiError, apiSuccess, validateBody } from '@/lib/apiHelpers'
import { updateSequenceSchema } from '@/lib/validations'

// ---------------------------------------------------------------------------
// GET /api/sequences/[id] — Single sequence with steps
// ---------------------------------------------------------------------------
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const sequence = await db.emailSequence.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { stepNumber: 'asc' } },
      },
    })
    if (!sequence) return apiError('Sequence not found', 404)
    return apiSuccess(sequence)
  } catch {
    return apiError('Failed to fetch sequence')
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/sequences/[id] — Update sequence
// ---------------------------------------------------------------------------
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json()
    const data = validateBody(updateSequenceSchema, body)
    if (data instanceof Response) return data

    const existing = await db.emailSequence.findUnique({ where: { id } })
    if (!existing) return apiError('Sequence not found', 404)

    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.status !== undefined) updateData.status = data.status
    if (data.contactId !== undefined) updateData.contactId = data.contactId
    if (data.companyId !== undefined) updateData.companyId = data.companyId

    const sequence = await db.emailSequence.update({
      where: { id },
      data: updateData,
    })

    return apiSuccess(sequence)
  } catch {
    return apiError('Failed to update sequence')
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/sequences/[id] — Delete sequence and all steps
// ---------------------------------------------------------------------------
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const existing = await db.emailSequence.findUnique({ where: { id } })
    if (!existing) return apiError('Sequence not found', 404)

    await db.emailSequence.delete({ where: { id } })
    return apiSuccess({ deleted: true })
  } catch {
    return apiError('Failed to delete sequence')
  }
}