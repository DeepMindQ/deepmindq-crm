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
import { utilityGuard, RateLimitedError, utilityError, utilityCatchError, utilitySuccess } from '@/lib/intelligence-api/guard';
import { z } from 'zod';
import { companyIdSchema } from '@/lib/intelligence-api/validators';

const enrichBodySchema = z.object({
  companyId: companyIdSchema,
});

export async function POST(request: NextRequest) {
  let correlationId;
  let responseHeaders;
  try {
    const guardCtx = utilityGuard(request, 'enrich');
    correlationId = guardCtx.correlationId;
    responseHeaders = guardCtx.responseHeaders;
  } catch (rlErr) {
    if (rlErr instanceof RateLimitedError) {
      return new Response(JSON.stringify(rlErr.errorBody), { status: 429, headers: rlErr.headers });
    }
    throw rlErr;
  }

  const ctx = { correlationId, responseHeaders };
  const startedAt = Date.now();

  try {
    const body = await request.json();
    const parsed = enrichBodySchema.safeParse(body);
    if (!parsed.success) {
      return utilityError(ctx, 400, `Validation failed: ${parsed.error.issues[0]?.message}`, 'VALIDATION_FAILED', Date.now() - startedAt);
    }
    const { companyId } = parsed.data;

    logger.info('[intelligence/enrich] Enriching company', { companyId });
    const result = await IntelligencePipeline.enrichCompany(companyId);

    return utilitySuccess(ctx, { ...result, enriched: result.success }, 'enrich', Date.now() - startedAt);
  } catch (err) {
    return utilityCatchError(ctx, err, 502, 'INTELLIGENCE_UNAVAILABLE', 'Enrichment failed', Date.now() - startedAt);
  }
}
