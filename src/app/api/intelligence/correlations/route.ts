/**
 * GET /api/intelligence/correlations — Detect signal correlations for a company
 *
 * Intelligence API — Analytical Endpoint
 *
 * Non-throwing: standardized error responses.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { detectCorrelations } from '@/lib/intelligence-sources/cross-signal-correlation';
import { logger } from '@/lib/logger';
import { utilityGuard, RateLimitedError } from '@/lib/intelligence-api/guard';
import { scrubError } from '@/lib/intelligence-api/handler';

export async function GET(request: NextRequest) {
  let correlationId;
  let responseHeaders;
  try {
    const ctx = utilityGuard(request, 'correlations');
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
    if (!companyId) {
      return Response.json(
        { success: false, error: 'companyId is required' },
        { status: 400 },
      );
    }

    const signals = await db.companySignal.findMany({
      where: { companyId, status: { notIn: ['archived', 'expired'] } },
      orderBy: { createdAt: 'desc' }, take: 50,
    });

    const correlations = detectCorrelations(signals);
    return Response.json({
      success: true,
      data: { companyId, correlations, signalCount: signals.length },
      meta: { endpoint: 'correlations', durationMs: Date.now() - startedAt },
    });
  } catch (err) {
    const message = scrubError(err instanceof Error ? err.message : String(err));
    logger.error('[intelligence/correlations] Error', { error: message });
    return Response.json(
      { success: false, error: 'Correlation analysis failed', details: message, meta: { endpoint: 'correlations', durationMs: Date.now() - startedAt } },
      { status: 502 },
    );
  }
}
