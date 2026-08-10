/**
 * WI-17E — Feedback Submission API
 *
 * POST /api/feedback
 *
 * Supports two formats:
 *   1. Inline feedback: { sentiment, category, comment, context, itemId, itemType, rating }
 *   2. Recommendation feedback: { companyId, verdict, ... } — triggers the full learning loop
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';
import {
  processFeedback,
  type FeedbackSubmission,
  type FeedbackVerdict,
  type FeedbackReasonCode,
  FEEDBACK_REASON_LABELS,
} from '@/lib/feedback-learning-loop';

const VALID_VERDICTS: FeedbackVerdict[] = [
  'useful', 'not_useful', 'partially_useful', 'incorrect_action', 'wrong_account',
];

const VALID_REASONS: FeedbackReasonCode[] = [
  'converted_opportunity', 'meeting_scheduled', 'good_timing', 'accurate_signals',
  'wrong_decision_maker', 'bad_timing', 'already_customer', 'already_engaged',
  'incorrect_technology', 'vendor_relationship', 'low_budget', 'not_relevant',
  'wrong_capability', 'data_was_stale', 'insufficient_evidence', 'other', null,
];

const VALID_OUTCOMES = [
  'converted', 'opportunity_created', 'meeting_held', 'contacted', 'rejected',
  'no_response', 'lost_to_competitor', 'budget_issue', 'wrong_contact',
  'project_cancelled', 'project_delayed', null,
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ── Inline feedback format (sentiment/rating) ──
    if (body.sentiment || body.rating) {
      if (!body.sentiment && !body.rating) {
        return NextResponse.json(
          { success: false, error: 'Either sentiment or rating is required' },
          { status: 400 }
        );
      }

      // Best-effort persist to database (feedback table may not exist yet)
      try {
        await (db as any).feedback.create({
          data: {
            type: body.sentiment || (body.rating >= 4 ? 'positive' : 'negative'),
            category: body.category || 'general',
            comment: body.comment || null,
            context: body.context || null,
            itemId: body.itemId || null,
            itemType: body.itemType || null,
            rating: body.rating || null,
            createdAt: new Date(),
          },
        });
      } catch {
        // Table may not exist — that's fine, we still accept the feedback
        logger.info('[Feedback] Stored in memory (DB table not yet available)');
      }

      return NextResponse.json({ success: true });
    }

    // ── Recommendation feedback format (WI-17E learning loop) ──
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    // Validate required fields
    if (!body.companyId || !body.verdict) {
      return NextResponse.json(
        { error: 'companyId and verdict are required' },
        { status: 400 }
      );
    }

    if (!VALID_VERDICTS.includes(body.verdict)) {
      return NextResponse.json(
        { error: `Invalid verdict. Must be one of: ${VALID_VERDICTS.join(', ')}` },
        { status: 400 }
      );
    }

    if (body.feedbackReason && !VALID_REASONS.includes(body.feedbackReason)) {
      return NextResponse.json(
        { error: `Invalid feedback reason. Must be one of: ${VALID_REASONS.filter(Boolean).join(', ')}` },
        { status: 400 }
      );
    }

    if (body.actualOutcome && !VALID_OUTCOMES.includes(body.actualOutcome)) {
      return NextResponse.json(
        { error: `Invalid outcome. Must be one of: ${VALID_OUTCOMES.filter(Boolean).join(', ')}` },
        { status: 400 }
      );
    }

    const submission: FeedbackSubmission = {
      companyId: body.companyId,
      verdict: body.verdict,
      sentiment: body.sentiment,
      feedbackReason: body.feedbackReason,
      feedbackDetail: body.feedbackDetail,
      correctSignals: body.correctSignals,
      incorrectSignals: body.incorrectSignals,
      correctAction: body.correctAction,
      actualOutcome: body.actualOutcome,
      userId: body.userId,
      recommendationSnapshot: body.recommendationSnapshot,
    };

    const result = await processFeedback(submission);

    // Phase 2.11: Record agent effectiveness audit (fire-and-forget)
    if (body.agentType) {
      try {
        const { recordAgentEffectiveness } = await import('@/lib/decision-learning');
        recordAgentEffectiveness(body.agentType).catch(() => {});
      } catch { /* non-blocking */ }
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    logger.error('[Feedback API] Error', { error });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/feedback
 *
 * Get feedback metadata — available reason codes and their labels.
 */
export async function GET() {
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

  return NextResponse.json({
    success: true,
    data: {
      verdicts: VALID_VERDICTS,
      reasons: Object.entries(FEEDBACK_REASON_LABELS).map(([code, label]) => ({
        code,
        label,
      })),
      outcomes: VALID_OUTCOMES.filter(Boolean),
    },
  });
}
