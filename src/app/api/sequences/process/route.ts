import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { generateEmailDraft } from '@/lib/email-generation';
import { generateMessageId } from '@/lib/email-tracking';

/* ═══════════════════════════════════════════════════
   POST /api/sequences/process
   Called by cron / manual trigger. Finds enrollments
   where nextStepAt <= now and status = "active",
   generates the email for the current step, creates
   a draft, approves and queues it, then advances
   to the next step.

   Body: {} (no params needed — processes all due enrollments)
   ═══════════════════════════════════════════════════ */
export async function POST() {
  try {
    const now = new Date();

    // Find all due enrollments
    const dueEnrollments = await db.sequenceEnrollment.findMany({
      where: {
        status: 'active',
        nextStepAt: { lte: now },
      },
      include: {
        sequence: {
          include: {
            steps: { orderBy: { stepNumber: 'asc' } },
          },
        },
        contact: {
          include: { company: true },
        },
      },
    });

    if (dueEnrollments.length === 0) {
      return NextResponse.json({ success: true, processed: 0, message: 'No enrollments due' });
    }

    let processed = 0;
    let errors = 0;

    for (const enrollment of dueEnrollments) {
      try {
        const { sequence, contact, currentStep } = enrollment;
        const company = contact.company;

        // Find the current step
        const step = sequence.steps.find(s => s.stepNumber === currentStep);
        if (!step) {
          // No step found — mark completed
          await db.sequenceEnrollment.update({
            where: { id: enrollment.id },
            data: { status: 'completed', completedAt: now },
          });
          continue;
        }

        // Generate personalized email using the step template + contact info
        // Use the step's body/subject as the base, but personalize via AI
        let subject = step.subject;
        let body = step.body;
        let cta = step.cta;

        // Try AI personalization
        try {
          const draftData = await generateEmailDraft({
            name: contact.rawName,
            email: contact.email,
            title: contact.title || undefined,
            company: company?.rawName || undefined,
            industry: company?.industry || undefined,
            tone: 'professional',
            serviceLine: sequence.serviceLine || undefined,
          });
          // Use AI body/subject but keep the step's CTA if specified
          body = draftData.body;
          subject = draftData.subject;
          cta = cta || draftData.cta;
        } catch {
          // Fall back to template body with simple variable replacement
          body = step.body
            .replace(/\{\{name\}\}/g, contact.rawName?.split(' ')[0] || 'there')
            .replace(/\{\{company\}\}/g, company?.rawName || 'your company')
            .replace(/\{\{title\}\}/g, contact.title || '');
          subject = step.subject
            .replace(/\{\{name\}\}/g, contact.rawName?.split(' ')[0] || 'there')
            .replace(/\{\{company\}\}/g, company?.rawName || 'your company');
        }

        // Create a draft
        const draft = await db.draft.create({
          data: {
            contactId: contact.id,
            subject,
            body,
            cta,
            status: 'approved',
            confidenceScore: 70,
            messageId: generateMessageId(),
            sequenceId: sequence.id,
            sequenceStepId: step.id,
          },
        });

        // Create queue item immediately
        await db.sendQueue.create({
          data: {
            draftId: draft.id,
            status: 'pending',
            scheduledAt: now,
          },
        });

        // Advance to next step or mark completed
        const nextStep = sequence.steps.find(s => s.stepNumber === currentStep + 1);
        if (nextStep) {
          const nextStepAt = new Date();
          nextStepAt.setDate(nextStepAt.getDate() + nextStep.delayDays);
          await db.sequenceEnrollment.update({
            where: { id: enrollment.id },
            data: {
              currentStep: nextStep.stepNumber,
              nextStepAt,
            },
          });
        } else {
          // Last step completed
          await db.sequenceEnrollment.update({
            where: { id: enrollment.id },
            data: { status: 'completed', completedAt: now },
          });
        }

        processed++;
      } catch (err) {
        console.error(`Error processing enrollment ${enrollment.id}:`, err);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      errors,
      total: dueEnrollments.length,
    });
  } catch (error) {
    console.error('Sequence process error:', error);
    return NextResponse.json(
      { error: 'Failed to process sequences: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}