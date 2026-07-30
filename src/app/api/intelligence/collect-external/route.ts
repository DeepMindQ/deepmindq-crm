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
import { collectIntelligenceForCompany, collectIntelligenceBatch } from '@/lib/intelligence-sources/external-intelligence-collector';
import { logger } from '@/lib/logger';
import { utilityGuard, RateLimitedError } from '@/lib/intelligence-api/guard';
import { scrubError } from '@/lib/intelligence-api/handler';

export async function POST(request: NextRequest) {
  let correlationId;
  let responseHeaders;
  try {
    const ctx = utilityGuard(request, 'collect-external');
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
    const { companyId, companyIds, maxResultsPerQuery = 5 } = body;

    if (!companyId && (!companyIds || !Array.isArray(companyIds) || companyIds.length === 0)) {
      return Response.json(
        { success: false, error: 'Provide "companyId" (string) or "companyIds" (array)', meta: { endpoint: 'collect-external', durationMs: Date.now() - startedAt } },
        { status: 400 },
      );
    }

    // Single company
    if (companyId) {
      logger.info('[intelligence/collect-external] Single collection', { companyId });
      const result = await collectIntelligenceForCompany(companyId, maxResultsPerQuery);
      return Response.json({
        success: true,
        data: result,
        meta: { endpoint: 'collect-external', durationMs: Date.now() - startedAt },
      });
    }

    // Batch
    logger.info('[intelligence/collect-external] Batch collection', { count: companyIds.length });
    const results = await collectIntelligenceBatch(companyIds, maxResultsPerQuery);
    const summary = {
      totalCompanies: results.length,
      totalEvidenceCollected: results.reduce((s, r) => s + r.evidenceCollected, 0),
      totalSignalsCreated: results.reduce((s, r) => s + r.signalsCreated, 0),
      totalSignalsSkipped: results.reduce((s, r) => s + r.signalsSkipped, 0),
      totalErrors: results.reduce((s, r) => s + r.errors.length, 0),
      totalDuration: results.reduce((s, r) => s + r.duration, 0),
    };

    return Response.json({
      success: true,
      data: { results, summary },
      meta: { endpoint: 'collect-external', durationMs: Date.now() - startedAt },
    });
  } catch (err) {
    const message = scrubError(err instanceof Error ? err.message : String(err));
    logger.error('[intelligence/collect-external] Error', { error: message });
    return Response.json(
      { success: false, error: 'Intelligence collection failed', details: message, meta: { endpoint: 'collect-external', durationMs: Date.now() - startedAt } },
      { status: 502 },
    );
  }
}
