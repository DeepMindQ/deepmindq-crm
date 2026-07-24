import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiError, apiSuccess, validateBody } from '@/lib/apiHelpers'
import { createSequenceStepSchema, updateSequenceStepSchema } from '@/lib/validations'

// ---------------------------------------------------------------------------
// POST /api/sequences/[id]/steps/[stepId] — Add a step
// stepId in the URL is actually not used for creation; we auto-assign the next step number.
// ---------------------------------------------------------------------------
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  try {
    const { id: sequenceId } = await params
    const body = await req.json()
    const data = validateBody(createSequenceStepSchema, body)
    if (data instanceof Response) return data

    const sequence = await db.emailSequence.findUnique({
      where: { id: sequenceId },
    })
    if (!sequence) return apiError('Sequence not found', 404)

    // Determine the next step number
    const maxStep = await db.sequenceStep.aggregate({
      where: { sequenceId },
      _max: { stepNumber: true },
    })
    const nextStepNumber = (maxStep._max.stepNumber ?? 0) + 1

    const d = data as Record<string, unknown>;
    const step = await db.sequenceStep.create({
      data: {
        sequenceId,
        stepNumber: nextStepNumber,
        subject: data.subject,
        body: data.body,
        delayMinutes: (d.delayDays ?? d.delayMinutes ?? 0) as number,
        cta: data.cta ?? null,
      } as any,
    })

    return apiSuccess(step, 201)
  } catch {
    return apiError('Failed to create step')
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/sequences/[id]/steps/[stepId] — Update a step
// ---------------------------------------------------------------------------
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  try {
    const { id: sequenceId, stepId } = await params
    const body = await req.json()
    const data = validateBody(updateSequenceStepSchema, body)
    if (data instanceof Response) return data

    const existing = await db.sequenceStep.findFirst({
      where: { id: stepId, sequenceId },
    })
    if (!existing) return apiError('Step not found', 404)

    const updateData: Record<string, unknown> = {}
    if (data.subject !== undefined) updateData.subject = data.subject
    if (data.body !== undefined) updateData.body = data.body
    const dd = data as Record<string, unknown>;
    if (dd.delayDays !== undefined || dd.delayMinutes !== undefined) updateData.delayMinutes = (dd.delayDays ?? dd.delayMinutes ?? 0) as number
    if (data.cta !== undefined) updateData.cta = data.cta
    if (data.stepNumber !== undefined) updateData.stepNumber = data.stepNumber
    if (data.status !== undefined) updateData.status = data.status
    if (data.sentAt !== undefined) updateData.sentAt = data.sentAt === '' ? null : new Date(data.sentAt!)
    if (data.openedAt !== undefined) updateData.openedAt = data.openedAt === '' ? null : new Date(data.openedAt!)
    if (data.repliedAt !== undefined) updateData.repliedAt = data.repliedAt === '' ? null : new Date(data.repliedAt!)

    const step = await db.sequenceStep.update({
      where: { id: stepId },
      data: updateData,
    })

    return apiSuccess(step)
  } catch {
    return apiError('Failed to update step')
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/sequences/[id]/steps/[stepId] — Remove a step
// ---------------------------------------------------------------------------
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  try {
    const { id: sequenceId, stepId } = await params
    const existing = await db.sequenceStep.findFirst({
      where: { id: stepId, sequenceId },
    })
    if (!existing) return apiError('Step not found', 404)

    await db.sequenceStep.delete({ where: { id: stepId } })

    // Re-number remaining steps
    const remainingSteps = await db.sequenceStep.findMany({
      where: { sequenceId },
      orderBy: { stepNumber: 'asc' },
    })
    for (let i = 0; i < remainingSteps.length; i++) {
      if (remainingSteps[i].stepNumber !== i + 1) {
        await db.sequenceStep.update({
          where: { id: remainingSteps[i].id },
          data: { stepNumber: i + 1 },
        })
      }
    }

    return apiSuccess({ deleted: true })
  } catch {
    return apiError('Failed to delete step')
  }
}