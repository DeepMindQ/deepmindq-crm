/**
 * POST /api/intelligence/website-monitor — Detect website changes
 *
 * Intelligence API — External Intelligence Endpoint
 *
 * Accepts a companyId to monitor website changes using
 * web search + governedAICall for change detection.
 *
 * Non-throwing: standardized error responses.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { monitorCompanyWebsite } from '@/lib/intelligence-sources/website-monitor/engine';
import { logger } from '@/lib/logger';
import { utilityGuard, RateLimitedError, utilityError, utilityCatchError, utilitySuccess } from '@/lib/intelligence-api/guard';
import { companyIdSchema } from '@/lib/intelligence-api/validators';
import { checkApiAuth } from '@/lib/api-auth';

const websiteMonitorBodySchema = z.object({
  companyId: companyIdSchema,
});

export async function POST(req: NextRequest) {
    // ── Authentication + RBAC Guard ──
  const { errorResponse } = await checkApiAuth(req);
  if (errorResponse) return errorResponse;

let ctx: { correlationId: string; responseHeaders: Record<string, string> };
  try {
    ctx = utilityGuard(req, 'website-monitor');
  } catch (rlErr) {
    if (rlErr instanceof RateLimitedError) {
      return new Response(JSON.stringify(rlErr.errorBody), { status: 429, headers: rlErr.headers });
    }
    throw rlErr;
    }

  const startedAt = Date.now();

  try {
    const body = await req.json();
    const parsed = websiteMonitorBodySchema.safeParse(body);
    if (!parsed.success) {
      return utilityError(ctx, 400, `Validation failed: ${parsed.error.issues.map(i => i.message).join(', ')}`, 'VALIDATION_FAILED', Date.now() - startedAt);
    }
    const { companyId } = parsed.data;

    logger.info('[intelligence/website-monitor] Monitoring', { companyId });
    const results = await monitorCompanyWebsite(companyId);
    const changesDetected = results.filter(r => r.hasChanged);

    return utilitySuccess(ctx, {
      pagesMonitored: results.length,
      changesDetected: changesDetected.length,
      results,
    }, 'website-monitor', Date.now() - startedAt);
  } catch (err) {
    return utilityCatchError(ctx, err, 502, 'INTELLIGENCE_UNAVAILABLE', 'Website monitoring failed', Date.now() - startedAt);
  }
}
