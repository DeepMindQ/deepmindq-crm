/**
 * POST /api/intelligence/feedback — Record signal feedback
 * GET  /api/intelligence/feedback — Get learning insights
 *
 * Intelligence API — Feedback Endpoint
 *
 * Non-throwing: standardized error responses.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { companyIdSchema } from '@/lib/intelligence-api/validators';
import { recordSignalFeedback, computeLearningInsights } from '@/lib/intelligence-sources/learning-loop';
import { utilityGuard, RateLimitedError, utilityError, utilityCatchError, utilitySuccess } from '@/lib/intelligence-api/guard';
import { checkApiAuth } from '@/lib/api-auth';

const feedbackPostBodySchema = z.object({
  signalId: z.string().min(1, 'signalId is required'),
  companyId: companyIdSchema,
  type: z.enum(['accurate', 'inaccurate', 'relevant', 'not_relevant', 'actionable', 'not_actionable', 'surprising', 'obvious']),
  userId: z.string().optional(),
  comment: z.string().optional(),
});

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
    const parsed = feedbackPostBodySchema.safeParse(body);
    if (!parsed.success) {
      return utilityError(ctx, 400, `Validation failed: ${parsed.error.issues[0]?.message}`, 'VALIDATION_FAILED', Date.now() - startedAt);
    }
    const { signalId, companyId, type, userId, comment } = parsed.data;

    await recordSignalFeedback({ signalId, companyId, type, userId, comment });
    return utilitySuccess(ctx, { recorded: true }, 'feedback', Date.now() - startedAt);
  } catch (err) {
    return utilityCatchError(ctx, err, 502, 'INTELLIGENCE_UNAVAILABLE', 'Feedback recording failed', Date.now() - startedAt);
  }
}

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
    const companyId = request.nextUrl.searchParams.get('companyId');
    const insights = await computeLearningInsights(companyId || undefined);
    return utilitySuccess(ctx, { insights }, 'feedback', Date.now() - startedAt);
  } catch (err) {
    return utilityCatchError(ctx, err, 502, 'INTELLIGENCE_UNAVAILABLE', 'Learning insights failed', Date.now() - startedAt);
  }
}
