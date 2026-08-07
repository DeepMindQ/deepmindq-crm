/**
 * S6-3.3 — AI Cache Intelligence API
 *
 * GET    /api/ai/cache               — Get cache stats (hit rate, entries, cost saved, top models)
 * GET    /api/ai/cache?prune=true    — Prune expired entries and return stats
 * DELETE /api/ai/cache               — Invalidate cache (with optional context prefix)
 */

import { NextRequest } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { apiError, apiSuccess } from '@/lib/apiHelpers';
import { AICacheLayer } from '@/lib/ai-cache-layer';

export async function GET(req: NextRequest) {
  const { errorResponse } = await checkApiAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const prune = searchParams.get('prune') === 'true';

    let pruned = 0;
    if (prune) {
      pruned = await AICacheLayer.prune();
    }

    const stats = await AICacheLayer.getStats();

    return apiSuccess({
      ...stats,
      pruned,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return apiError(msg, 500);
  }
}

export async function DELETE(req: NextRequest) {
  const { errorResponse } = await checkApiAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const contextPrefix = searchParams.get('context');

    let invalidated = 0;
    if (contextPrefix) {
      invalidated = await AICacheLayer.invalidateByContextPrefix(contextPrefix);
    } else {
      // Full cache clear via prune (expired only) — safety measure
      invalidated = await AICacheLayer.prune();
    }

    return apiSuccess({
      message: contextPrefix
        ? `Invalidated ${invalidated} cache entries for context prefix`
        : `Pruned ${invalidated} expired cache entries`,
      invalidated,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return apiError(msg, 500);
  }
}
