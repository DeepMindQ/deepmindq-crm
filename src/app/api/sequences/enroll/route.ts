import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════
   POST /api/sequences/enroll
   Enroll contacts into a sequence

   Body: { sequenceId, contactIds: string[] }
   ═══════════════════════════════════════════════════ */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sequenceId, contactIds } = body;

    if (!sequenceId || !contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json({ error: 'sequenceId and contactIds are required' }, { status: 400 });
    }

    // Verify sequence exists and is active
    const sequence = await db.emailSequence.findUnique({
      where: { id: sequenceId, isActive: true },
      include: { steps: { orderBy: { stepNumber: 'asc' } } },
    });

    if (!sequence) {
      return NextResponse.json({ error: 'Active sequence not found' }, { status: 404 });
    }

    if (sequence.steps.length === 0) {
      return NextResponse.json({ error: 'Sequence has no steps' }, { status: 400 });
    }

    // Check for already-enrolled contacts
    const existing = await db.sequenceEnrollment.findMany({
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
      return NextResponse.json({ success: true, enrolled: 0, skipped: contactIds.length });
    }

    // Create enrollment records, set nextStepAt = now for step 1
    const enrollments = await db.sequenceEnrollment.createMany({
      data: toEnroll.map((contactId: string) => ({
        sequenceId,
        contactId,
        currentStep: 1,
        status: 'active',
        nextStepAt: new Date(),
      })),
    });

    return NextResponse.json({
      success: true,
      enrolled: enrollments.count,
      skipped: alreadyEnrolled.size,
    });
  } catch (error) {
    console.error('Sequence enroll error:', error);
    return NextResponse.json(
      { error: 'Failed to enroll contacts: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}