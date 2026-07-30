/**
 * POST /api/intelligence/collect-external
 *
 * Intelligence API — External Intelligence Endpoint
 *
 * Triggers external intelligence collection for one or many companies.
 * Uses web search → evidence extraction → signal creation pipeline.
 * Returns collection results with counts.
 *
 * Non-throwing: standardized error responses.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { companyIdSchema } from '@/lib/intelligence-api/validators';
import { collectIntelligenceForCompany, collectIntelligenceBatch } from '@/lib/intelligence-sources/external-intelligence-collector';
import { logger } from '@/lib/logger';
import { utilityGuard, RateLimitedError, utilityError, utilityCatchError, utilitySuccess } from '@/lib/intelligence-api/guard';

const collectExternalBodySchema = z.object({
  companyId: companyIdSchema.optional(),
  companyIds: z.array(companyIdSchema).min(1).optional(),
  maxResultsPerQuery: z.number().int().min(1).max(50).optional(),
}).refine(d => d.companyId || d.companyIds, {
  message: 'Provide "companyId" (string) or "companyIds" (array)',
});

export async function POST(request: NextRequest) {
  let ctx: Awaited<ReturnType<typeof utilityGuard>>;
  try {
    ctx = utilityGuard(request, 'collect-external');
  } catch (rlErr) {
    if (rlErr instanceof RateLimitedError) {
      return new Response(JSON.stringify(rlErr.errorBody), { status: 429, headers: rlErr.headers });
    }
    throw rlErr;
  }

  const startedAt = Date.now();

  try {
    const body = await request.json();
    const parsed = collectExternalBodySchema.safeParse(body);
    if (!parsed.success) {
      return utilityError(ctx, 400, `Validation failed: ${parsed.error.issues[0]?.message}`, 'VALIDATION_FAILED', Date.now() - startedAt);
    }
    const { companyId, companyIds, maxResultsPerQuery = 5 } = parsed.data;

    // Single company
    if (companyId) {
      logger.info('[intelligence/collect-external] Single collection', { companyId });
      const result = await collectIntelligenceForCompany(companyId, maxResultsPerQuery);
      return utilitySuccess(ctx, result, 'collect-external', Date.now() - startedAt);
    }

    // Batch
    const ids = companyIds!;
    logger.info('[intelligence/collect-external] Batch collection', { count: ids.length });
    const results = await collectIntelligenceBatch(ids, maxResultsPerQuery);
    const summary = {
      totalCompanies: results.length,
      totalEvidenceCollected: results.reduce((s, r) => s + r.evidenceCollected, 0),
      totalSignalsCreated: results.reduce((s, r) => s + r.signalsCreated, 0),
      totalSignalsSkipped: results.reduce((s, r) => s + r.signalsSkipped, 0),
      totalErrors: results.reduce((s, r) => s + r.errors.length, 0),
      totalDuration: results.reduce((s, r) => s + r.duration, 0),
    };

    return utilitySuccess(ctx, { results, summary }, 'collect-external', Date.now() - startedAt);
  } catch (err) {
    return utilityCatchError(ctx, err, 502, 'INTELLIGENCE_UNAVAILABLE', 'Intelligence collection failed', Date.now() - startedAt);
  }
}
