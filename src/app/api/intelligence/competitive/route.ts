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
import { z } from 'zod';
import { collectCompetitiveIntel, runCompetitiveScan } from '@/lib/intelligence-sources/competitive-intel/engine';
import { logger } from '@/lib/logger';
import { utilityGuard, RateLimitedError, utilityError, utilityCatchError, utilitySuccess } from '@/lib/intelligence-api/guard';
import { checkApiAuth } from '@/lib/api-auth';

const competitiveBodySchema = z.object({
  competitorName: z.string().min(1).optional(),
  fullScan: z.boolean().optional(),
}).refine(d => d.competitorName || d.fullScan, {
  message: 'Provide competitorName or fullScan: true',
});

export async function POST(req: NextRequest) {
    // ── Authentication + RBAC Guard ──
  const { errorResponse } = await checkApiAuth(req);
  if (errorResponse) return errorResponse;

let ctx: Awaited<ReturnType<typeof utilityGuard>>;
  try {
    ctx = utilityGuard(req, 'competitive');
  } catch (rlErr) {
    if (rlErr instanceof RateLimitedError) {
      return new Response(JSON.stringify(rlErr.errorBody), { status: 429, headers: rlErr.headers });
    }
    throw rlErr;
  }

  const startedAt = Date.now();

  try {
    const body = await req.json();
    const parsed = competitiveBodySchema.safeParse(body);
    if (!parsed.success) {
      return utilityError(ctx, 400, `Validation failed: ${parsed.error.issues[0]?.message}`, 'VALIDATION_FAILED', Date.now() - startedAt);
    }
    const { competitorName, fullScan } = parsed.data;

    if (fullScan) {
      logger.info('[intelligence/competitive] Running full scan');
      const results = await runCompetitiveScan();
      return utilitySuccess(ctx, { events: results, totalEvents: results.length }, 'competitive', Date.now() - startedAt);
    }

    if (competitorName) {
      logger.info('[intelligence/competitive] Collecting for', { competitorName });
      const results = await collectCompetitiveIntel(competitorName);
      return utilitySuccess(ctx, { events: results, totalEvents: results.length }, 'competitive', Date.now() - startedAt);
    }

    return utilityError(ctx, 400, 'Provide competitorName or fullScan: true', 'INVALID_REQUEST', Date.now() - startedAt);
  } catch (err) {
    return utilityCatchError(ctx, err, 502, 'INTELLIGENCE_UNAVAILABLE', 'Competitive intelligence collection failed', Date.now() - startedAt);
  }
}
