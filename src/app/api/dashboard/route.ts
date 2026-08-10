import { NextRequest } from 'next/server';
import { dashboardCache } from '@/lib/dashboard-cache';
import { getDashboardMetrics } from '@/lib/dashboard-queries';
import { checkApiAuth } from '@/lib/api-auth';
import {
  utilityGuard,
  utilityCatchError,
  utilitySuccess,
  RateLimitedError,
} from '@/lib/intelligence-api/guard';

export async function GET(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

const startedAt = Date.now();

  let ctx: ReturnType<typeof utilityGuard>;
  try {
    ctx = utilityGuard(request, 'dashboard');
  } catch (err) {
    if (err instanceof RateLimitedError) {
      return new Response(JSON.stringify(err.errorBody), {
        status: 429,
        headers: err.headers,
      });
    }
    throw err;
  }

  try {
    // ── Cached consolidated queries (9 DB queries → 4) ──
    const data = await dashboardCache.cached(
      'dashboard:main',
      getDashboardMetrics,
    );

    return utilitySuccess(ctx, {
      contactsByStatus: data.contactsByStatus,
      totalCompanies: data.totalCompanies,
      recentBatches: data.recentBatches,
      draftsPendingReview: data.draftsPendingReview,
      queuePending: data.queuePending,
      repliesThisWeek: data.repliesThisWeek,
      bouncesCount: data.bouncesCount,
      suppressionsCount: data.suppressionsCount,
      emailHealthDistribution: data.emailHealthDistribution,
    }, 'dashboard', Date.now() - startedAt);
  } catch (err) {
    return utilityCatchError(ctx, err, 500, 'ENGINE_ERROR', 'Dashboard fetch failed', Date.now() - startedAt);
  }
}
