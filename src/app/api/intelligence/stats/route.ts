/**
 * GET /api/intelligence/stats — Pipeline statistics
 *
 * Intelligence API — Stats Endpoint
 *
 * Non-throwing: standardized error responses.
 */

import { NextRequest } from 'next/server';
import { IntelligencePipeline } from '@/lib/intelligence-pipeline';
import { utilityGuard, RateLimitedError, utilityCatchError, utilitySuccess } from '@/lib/intelligence-api/guard';

export async function GET(request: NextRequest) {
  let ctx: { correlationId: string; responseHeaders: Record<string, string> };
  try {
    ctx = utilityGuard(request, 'stats');
  } catch (rlErr) {
    if (rlErr instanceof RateLimitedError) {
      return new Response(JSON.stringify(rlErr.errorBody), { status: 429, headers: rlErr.headers });
    }
    throw rlErr;
  }
  const startedAt = Date.now();

  try {
    const stats = await IntelligencePipeline.getStats();
    return utilitySuccess(ctx, stats, 'stats', Date.now() - startedAt);
  } catch (err) {
    return utilityCatchError(ctx, err, 502, 'INTELLIGENCE_UNAVAILABLE', 'Failed to get intelligence stats', Date.now() - startedAt);
  }
}
