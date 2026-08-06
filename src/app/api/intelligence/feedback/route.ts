/**
 * POST /api/intelligence/feedback — Record feedback
 *   - Legacy: signal feedback (signalId + type enum)
 *   - New: recommendation feedback (agentType + rating 1-5 + outcome)
 *
 * GET /api/intelligence/feedback — Get learning insights
 *   - ?action=stats           → LearningStats + human-readable summary
 *   - ?action=history&...     → RecommendationFeedback history
 *   - ?companyId=             → (legacy) signal learning insights
 *
 * Intelligence API — Feedback Endpoint (Phase 5: Decision Intelligence Learning)
 *
 * Non-throwing: standardized error responses.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { companyIdSchema } from '@/lib/intelligence-api/validators';
import { recordSignalFeedback, computeLearningInsights } from '@/lib/intelligence-sources/learning-loop';
import {
  submitFeedback,
  getLearningStats,
  getRecommendationHistory,
  getFeedbackSummary,
} from '@/lib/decision-learning';
import { utilityGuard, RateLimitedError, utilityError, utilityCatchError, utilitySuccess } from '@/lib/intelligence-api/guard';
import { checkApiAuth } from '@/lib/api-auth';

// ─── Schemas ──────────────────────────────────────────────────────

/** Legacy signal feedback schema */
const signalFeedbackPostSchema = z.object({
  signalId: z.string().min(1, 'signalId is required'),
  companyId: companyIdSchema,
  type: z.enum([
    'accurate', 'inaccurate', 'relevant', 'not_relevant',
    'actionable', 'not_actionable', 'surprising', 'obvious',
  ]),
  userId: z.string().optional(),
  comment: z.string().optional(),
});

/** New recommendation feedback schema (Phase 5 — Decision Learning) */
const recommendationFeedbackPostSchema = z.object({
  agentType: z.string().min(1, 'agentType is required'),
  companyId: companyIdSchema,
  recommendation: z.string().min(1, 'recommendation is required'),
  rating: z.union([
    z.literal(1), z.literal(2), z.literal(3),
    z.literal(4), z.literal(5),
  ]).describe('User satisfaction rating 1-5'),
  outcome: z.enum(['positive', 'neutral', 'negative']).optional(),
  context: z.string().optional(),
  userId: z.string().optional(),
});

// ─── POST ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

  let ctx: { correlationId: string; responseHeaders: Record<string, string> };
  try {
    ctx = utilityGuard(request, 'feedback');
  } catch (rlErr) {
    if (rlErr instanceof RateLimitedError) {
      return new Response(JSON.stringify(rlErr.errorBody), { status: 429, headers: rlErr.headers });
    }
    throw rlErr;
  }

  const startedAt = Date.now();

  try {
    const body = await request.json();

    // Detect which schema to use based on presence of agentType
    if (body.agentType && body.rating !== undefined) {
      // ── New: Recommendation Feedback ──
      const parsed = recommendationFeedbackPostSchema.safeParse(body);
      if (!parsed.success) {
        return utilityError(
          ctx, 400,
          `Validation failed: ${parsed.error.issues[0]?.message}`,
          'VALIDATION_FAILED',
          Date.now() - startedAt
        );
      }

      const { agentType, companyId, recommendation, rating, outcome, context, userId } = parsed.data;
      const feedbackId = await submitFeedback({
        agentType,
        companyId,
        recommendation,
        rating,
        outcome,
        context,
        userId,
      });

      return utilitySuccess(ctx, { success: true, feedbackId }, 'feedback', Date.now() - startedAt);
    }

    // ── Legacy: Signal Feedback ──
    const parsed = signalFeedbackPostSchema.safeParse(body);
    if (!parsed.success) {
      return utilityError(
        ctx, 400,
        `Validation failed: ${parsed.error.issues[0]?.message}`,
        'VALIDATION_FAILED',
        Date.now() - startedAt
      );
    }

    const { signalId, companyId, type, userId, comment } = parsed.data;
    await recordSignalFeedback({ signalId, companyId, type, userId, comment });
    return utilitySuccess(ctx, { recorded: true }, 'feedback', Date.now() - startedAt);
  } catch (err) {
    return utilityCatchError(ctx, err, 502, 'INTELLIGENCE_UNAVAILABLE', 'Feedback recording failed', Date.now() - startedAt);
  }
}

// ─── GET ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

  let ctx: { correlationId: string; responseHeaders: Record<string, string> };
  try {
    ctx = utilityGuard(request, 'feedback');
  } catch (rlErr) {
    if (rlErr instanceof RateLimitedError) {
      return new Response(JSON.stringify(rlErr.errorBody), { status: 429, headers: rlErr.headers });
    }
    throw rlErr;
  }

  const startedAt = Date.now();

  try {
    const url = request.nextUrl;
    const action = url.searchParams.get('action');

    // ── New: Decision Learning endpoints ──

    if (action === 'stats') {
      const [stats, summary] = await Promise.all([
        getLearningStats(),
        getFeedbackSummary(),
      ]);
      return utilitySuccess(ctx, { stats, summary }, 'feedback', Date.now() - startedAt);
    }

    if (action === 'history') {
      const agentType = url.searchParams.get('agentType') || undefined;
      const companyId = url.searchParams.get('companyId') || undefined;
      const limitParam = url.searchParams.get('limit');
      const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 200) : 50;

      const feedback = await getRecommendationHistory(agentType, companyId, limit);
      return utilitySuccess(ctx, { feedback }, 'feedback', Date.now() - startedAt);
    }

    // ── Legacy: Signal Learning Insights ──
    const companyId = url.searchParams.get('companyId');
    const insights = await computeLearningInsights(companyId || undefined);
    return utilitySuccess(ctx, { insights }, 'feedback', Date.now() - startedAt);
  } catch (err) {
    return utilityCatchError(ctx, err, 502, 'INTELLIGENCE_UNAVAILABLE', 'Learning insights failed', Date.now() - startedAt);
  }
}
