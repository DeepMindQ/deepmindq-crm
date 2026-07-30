/**
 * POST /api/intelligence/enrich
 *
 * Intelligence API — External Intelligence Endpoint
 *
 * Enrich a single company with AI intelligence:
 * Web search → Signal extraction → Evidence → Research Card
 *
 * Non-throwing: standardized error responses.
 */

import { NextRequest } from 'next/server';
import { IntelligencePipeline } from '@/lib/intelligence-pipeline';
import { logger } from '@/lib/logger';
import { utilityGuard, RateLimitedError } from '@/lib/intelligence-api/guard';
import { scrubError } from '@/lib/intelligence-api/handler';

export async function POST(request: NextRequest) {
  let correlationId;
  let responseHeaders;
  try {
    const ctx = utilityGuard(request, 'enrich');
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
    const { companyId } = await request.json();

    if (!companyId || typeof companyId !== 'string') {
      return Response.json(
        { success: false, error: 'companyId is required', meta: { endpoint: 'enrich', durationMs: Date.now() - startedAt } },
        { status: 400 },
      );
    }

    logger.info('[intelligence/enrich] Enriching company', { companyId });
    const result = await IntelligencePipeline.enrichCompany(companyId);

    return Response.json({
      success: result.success,
      data: { ...result, enriched: result.success },
      meta: { endpoint: 'enrich', durationMs: Date.now() - startedAt },
    });
  } catch (err) {
    const message = scrubError(err instanceof Error ? err.message : 'Enrichment failed');
    logger.error('[intelligence/enrich]', { detail: message });
    return Response.json(
      { success: false, error: message, meta: { endpoint: 'enrich', durationMs: Date.now() - startedAt } },
      { status: 502 },
    );
  }
}
