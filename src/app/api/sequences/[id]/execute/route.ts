import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiError, apiSuccess } from '@/lib/apiHelpers'

// ---------------------------------------------------------------------------
// POST /api/sequences/[id]/execute — Execute a sequence
// Creates a draft for the first pending step using the generate-email logic.
// ---------------------------------------------------------------------------
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: sequenceId } = await params
    const body = await req.json().catch(() => ({}))
    const contactId = body.contactId as string | undefined

    // 1. Fetch sequence with steps
    const sequence = await db.emailSequence.findUnique({
      where: { id: sequenceId },
      include: {
        steps: { orderBy: { stepNumber: 'asc' } },
      },
    })
    if (!sequence) return apiError('Sequence not found', 404)

    // 2. Validate the sequence has steps
    if (sequence.steps.length === 0) {
      return apiError('Sequence has no steps', 400)
    }

    // 3. Determine contact — from body, from sequence, or error
    const targetContactId = contactId || (sequence as any).contactId
    if (!targetContactId) {
      return apiError('No contact specified. Provide a contactId or set one on the sequence.', 400)
    }

    // 4. Fetch contact with company
    const contact = await db.contact.findUnique({
      where: { id: targetContactId },
      include: { company: true },
    })
    if (!contact) return apiError('Contact not found', 404)

    // 5. Find first pending step
    const firstPendingStep = (sequence as any).steps?.find((s: any) => s.status === 'pending')
    if (!firstPendingStep) {
      return apiError('No pending steps to execute', 400)
    }

    // 6. Create a draft from the first step content (personalized with contact info)
    const companyName = (contact.company as any)?.rawName || 'your company'
    const firstName = contact.rawName?.split(' ')[0] || 'there'
    const jobTitle = contact.title || contact.role || 'your role'

    const personalizedSubject = firstPendingStep.subject
      .replace(/\{\{firstName\}\}/g, firstName)
      .replace(/\{\{company\}\}/g, companyName)
      .replace(/\{\{jobTitle\}\}/g, jobTitle)

    const personalizedBody = firstPendingStep.body
      .replace(/\{\{firstName\}\}/g, firstName)
      .replace(/\{\{company\}\}/g, companyName)
      .replace(/\{\{jobTitle\}\}/g, jobTitle)
      .replace(/\{\{cta\}\}/g, firstPendingStep.cta || 'Would you be open to a quick chat?')

    // 7. Save as Draft
    const draft = await db.draft.create({
      data: {
        contactId: targetContactId,
        subject: personalizedSubject,
        body: personalizedBody,
        cta: firstPendingStep.cta || 'soft',
        status: 'draft',
      },
    })

    // 8. Update sequence status to active if draft
    if ((sequence as any).status === 'draft') {
      await db.emailSequence.update({
        where: { id: sequenceId },
        data: { isActive: true } as any,
      })
    }

    // 9. Return success
    return apiSuccess({
      success: true,
      firstDraftId: draft.id,
      totalSteps: sequence.steps.length,
      currentStep: firstPendingStep.stepNumber,
      subject: personalizedSubject,
      body: personalizedBody,
    })
  } catch {
    return apiError('Failed to execute sequence')
  }
}