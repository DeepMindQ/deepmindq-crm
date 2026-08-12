/**
 * AI Feedback API (Phase D)
 *
 * POST /api/ai/feedback  — Submit user feedback on an AI output
 * GET  /api/ai/feedback  — Retrieve feedback analytics
 */

import { NextRequest } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import {
  utilityGuard,
  utilityCatchError,
  utilitySuccess,
  utilityError,
  RateLimitedError,
} from '@/lib/intelligence-api/guard';
import {
  recordFeedback,
  getFeedbackAnalytics,
  type FeedbackType,
  type GenerationType,
} from '@/lib/ai-reliability';

const VALID_FEEDBACK_TYPES: FeedbackType[] = ['positive', 'negative', 'correction'];
const VALID_GENERATION_TYPES: GenerationType[] = [
  'scoring', 'forecast', 'recommendation', 'enrichment', 'brief',
  'coaching', 'email', 'conversation_plan', 'contact_intelligence',
  'relationship_map', 'risk_analysis',
];

export async function POST(request: NextRequest) {
  // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  const startedAt = Date.now();

  let ctx: ReturnType<typeof utilityGuard>;
  try {
    ctx = utilityGuard(request, 'ai-feedback');
  } catch (err) {
    if (err instanceof RateLimitedError) {
      return new Response(JSON.stringify(err.errorBody), {
        status: 429,
        headers: err.headers,
      });
    }
    throw err;
  }

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.insightId || typeof body.insightId !== 'string') {
      return utilityError(ctx, 400, 'insightId is required and must be a string', 'VALIDATION_FAILED', Date.now() - startedAt);
    }
    if (!body.generationType || !VALID_GENERATION_TYPES.includes(body.generationType)) {
      return utilityError(ctx, 400, 'generationType is required and must be one of: ' + VALID_GENERATION_TYPES.join(', '), 'VALIDATION_FAILED', Date.now() - startedAt);
    }
    if (!body.feedbackType || !VALID_FEEDBACK_TYPES.includes(body.feedbackType)) {
      return utilityError(ctx, 400, 'feedbackType is required and must be one of: positive, negative, correction', 'VALIDATION_FAILED', Date.now() - startedAt);
    }

    const feedbackId = await recordFeedback({
      insightId: body.insightId,
      generationType: body.generationType as GenerationType,
      feedbackType: body.feedbackType as FeedbackType,
      userComment: body.userComment,
      correctedAnswer: body.correctedAnswer,
    });

    return utilitySuccess(ctx, { feedbackId }, 'ai-feedback', Date.now() - startedAt);
  } catch (err) {
    return utilityCatchError(ctx, err, 500, 'ENGINE_ERROR', 'Failed to record feedback', Date.now() - startedAt);
  }
}

export async function GET(request: NextRequest) {
  // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  const startedAt = Date.now();

  let ctx: ReturnType<typeof utilityGuard>;
  try {
    ctx = utilityGuard(request, 'ai-feedback');
  } catch (err) {
    if (err instanceof RateLimitedError) {
      return new Response(JSON.stringify(err.errorBody), {
        status: 429,
        headers: err.headers,
      });
    }
    throw err;
  }

  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);

    const analytics = await getFeedbackAnalytics(days);

    return utilitySuccess(ctx, analytics, 'ai-feedback', Date.now() - startedAt);
  } catch (err) {
    return utilityCatchError(ctx, err, 502, 'ENGINE_ERROR', 'Failed to compute feedback analytics', Date.now() - startedAt);
  }
}
