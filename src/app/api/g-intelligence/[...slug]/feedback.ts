import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { submitFeedback, applyFeedbackToSources } from '@/lib/recommendation-feedback';

type UserDecision = 'confirmed_accurate' | 'partially_accurate' | 'incorrect' | 'needs_more_evidence';

const VALID_DECISIONS = new Set<string>(['confirmed_accurate', 'partially_accurate', 'incorrect', 'needs_more_evidence']);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: companyId } = await params;
  try {
    const body = await req.json();
    const { recommendationId, userDecision, feedbackReason } = body;

    if (!recommendationId || !userDecision || !VALID_DECISIONS.has(userDecision)) {
      return NextResponse.json(
        { error: 'Invalid input. Provide recommendationId and userDecision (confirmed_accurate | partially_accurate | incorrect | needs_more_evidence)' },
        { status: 400 },
      );
    }

    const feedback = await submitFeedback({
      recommendationId,
      companyId,
      userDecision: userDecision as UserDecision,
      feedbackReason,
    });

    // Apply feedback to source reliability in background
    const isCorrect = userDecision === 'confirmed_accurate';
    applyFeedbackToSources(recommendationId, isCorrect).catch(err =>
      console.error('[feedback] Failed to update source reliability:', err),
    );

    return NextResponse.json({ success: true, feedback });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: companyId } = await params;
  try {
    // TODO: Re-enable once recommendationFeedback table is added to Prisma schema
    // const feedbacks = await (db as any).recommendationFeedback.findMany({
    //   where: { companyId },
    //   orderBy: { createdAt: 'desc' },
    //   take: 50,
    //   include: {
    //     recommendation: {
    //       select: { opportunityTitle: true, confidenceScore: true },
    //     },
    //   },
    // });
    const feedbacks: unknown[] = [];

    return NextResponse.json({ companyId, feedbacks });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}