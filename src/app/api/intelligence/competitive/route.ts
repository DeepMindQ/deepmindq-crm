/**
 * POST /api/intelligence/competitive — Collect competitive intelligence
 *
 * Intelligence API — External Intelligence Endpoint
 *
 * Accepts a competitor name or triggers a full competitive scan.
 * Uses web search + governedAICall for competitive intelligence extraction.
 *
 * Non-throwing: standardized error responses.
 */

import { NextRequest } from 'next/server';
import { collectCompetitiveIntel, runCompetitiveScan } from '@/lib/intelligence-sources/competitive-intel/engine';
import { logger } from '@/lib/logger';
import { utilityGuard, RateLimitedError } from '@/lib/intelligence-api/guard';
import { scrubError } from '@/lib/intelligence-api/handler';

export async function POST(req: NextRequest) {
  let correlationId;
  let responseHeaders;
  try {
    const ctx = utilityGuard(req, 'competitive');
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
    const body = await req.json();
    const { competitorName, fullScan } = body;

    if (fullScan) {
      logger.info('[intelligence/competitive] Running full scan');
      const results = await runCompetitiveScan();
      return Response.json({
        success: true,
        data: { events: results, totalEvents: results.length },
        meta: { endpoint: 'competitive', durationMs: Date.now() - startedAt },
      });
    }

    if (competitorName) {
      logger.info('[intelligence/competitive] Collecting for', { competitorName });
      const results = await collectCompetitiveIntel(competitorName);
      return Response.json({
        success: true,
        data: { events: results, totalEvents: results.length },
        meta: { endpoint: 'competitive', durationMs: Date.now() - startedAt },
      });
    }

    return Response.json(
      { success: false, error: 'Provide competitorName or fullScan: true', meta: { endpoint: 'competitive', durationMs: Date.now() - startedAt } },
      { status: 400 },
    );
  } catch (err) {
    const message = scrubError(err instanceof Error ? err.message : String(err));
    logger.error('[intelligence/competitive] Error', { error: message });
    return Response.json(
      { success: false, error: 'Competitive intelligence collection failed', details: message, meta: { endpoint: 'competitive', durationMs: Date.now() - startedAt } },
      { status: 502 },
    );
  }
}
