import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

/* ═══════════════════════════════════════════════════
   POST /api/sequences/enroll
   Enroll contacts into a sequence

   Body: { sequenceId, contactIds: string[] }
   ═══════════════════════════════════════════════════ */
export async function POST(request: Request) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

try {
    const body = await request.json();
    const { sequenceId, contactIds } = body;

    if (!sequenceId || !contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json({ error: 'sequenceId and contactIds are required' }, { status: 400 });
    }

    // Wrap the existence check + enrollment in a transaction to prevent
    // TOCTOU race conditions between the duplicate check and the createMany.
    const result = await db.$transaction(async (tx) => {
      // Verify sequence exists and is active
      const sequence = await tx.emailSequence.findUnique({
        where: { id: sequenceId, isActive: true },
        include: { steps: { orderBy: { stepNumber: 'asc' } } },
      });

      if (!sequence) {
        return { error: 'Active sequence not found', status: 404 };
      }

      if (sequence.steps.length === 0) {
        return { error: 'Sequence has no steps', status: 400 };
      }

      // Check for already-enrolled contacts
      const existing = await tx.sequenceEnrollment.findMany({
        where: {
          sequenceId,
          contactId: { in: contactIds },
          status: 'active',
        },
        select: { contactId: true },
      });

      const alreadyEnrolled = new Set(existing.map(e => e.contactId));
      const toEnroll = contactIds.filter((id: string) => !alreadyEnrolled.has(id));

      if (toEnroll.length === 0) {
        return { success: true, enrolled: 0, skipped: contactIds.length };
      }

      // Create enrollment records, set nextStepAt = now for step 1
      const enrollments = await tx.sequenceEnrollment.createMany({
        data: toEnroll.map((contactId: string) => ({
          sequenceId,
          contactId,
          currentStep: 1,
          status: 'active',
          nextStepAt: new Date(),
        })),
      });

      return { success: true, enrolled: enrollments.count, skipped: alreadyEnrolled.size };
    }, { timeout: 30000 });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: (result as { status: number }).status });
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Sequence enroll error:', { error: error });
    return NextResponse.json(
      { error: 'Failed to enroll contacts: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}