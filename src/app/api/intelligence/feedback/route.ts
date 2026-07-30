/**
 * POST /api/intelligence/feedback — Record signal feedback
 * GET  /api/intelligence/feedback — Get learning insights
 *
 * Intelligence API — Feedback Endpoint
 *
 * Non-throwing: standardized error responses.
 */

import { NextRequest } from 'next/server';
import { recordSignalFeedback, computeLearningInsights } from '@/lib/intelligence-sources/learning-loop';
import { logger } from '@/lib/logger';
import { utilityGuard, RateLimitedError } from '@/lib/intelligence-api/guard';
import { scrubError } from '@/lib/intelligence-api/handler';

export async function POST(request: NextRequest) {
  let correlationId;
  let responseHeaders;
  try {
    const ctx = utilityGuard(request, 'feedback');
    correlationId = ctx.correlationId;
    responseHeaders = ctx.responseHeaders;
  } catch (rlErr) {
    if (rlErr instanceof RateLimitedError) {
      return new Response(JSON.stringify(rlErr.errorBody), { status: 429, headers: rlErr.headers });
    }
    throw rlErr;
  }

  const startedAt = Date.now();

  try {
    const body = await request.json();
    const { signalId, companyId, type, userId, comment } = body;

    if (!signalId || !companyId || !type) {
      return Response.json(
        { success: false, error: 'signalId, companyId, and type are required', meta: { endpoint: 'feedback', durationMs: Date.now() - startedAt } },
        { status: 400 },
      );
    }

    await recordSignalFeedback({ signalId, companyId, type, userId, comment });
    return Response.json({
      success: true,
      data: { recorded: true },
      meta: { endpoint: 'feedback', durationMs: Date.now() - startedAt },
    });
  } catch (err) {
    const message = scrubError(err instanceof Error ? err.message : String(err));
    logger.error('[intelligence/feedback] POST Error', { error: message });
    return Response.json(
      { success: false, error: 'Feedback recording failed', details: message, meta: { endpoint: 'feedback', durationMs: Date.now() - startedAt } },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest) {
  let correlationId;
  let responseHeaders;
  try {
    const ctx = utilityGuard(request, 'feedback');
    correlationId = ctx.correlationId;
    responseHeaders = ctx.responseHeaders;
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
    return Response.json({
      success: true,
      data: { insights },
      meta: { endpoint: 'feedback', durationMs: Date.now() - startedAt },
    });
  } catch (err) {
    const message = scrubError(err instanceof Error ? err.message : String(err));
    logger.error('[intelligence/feedback] GET Error', { error: message });
    return Response.json(
      { success: false, error: 'Learning insights failed', details: message, meta: { endpoint: 'feedback', durationMs: Date.now() - startedAt } },
      { status: 502 },
    );
  }
}
