import { NextRequest } from 'next/server';
import { dashboardCache } from '@/lib/dashboard-cache';
import { getDashboardStats } from '@/lib/dashboard-queries';
import { checkApiAuth } from '@/lib/api-auth';
import {
  utilityGuard,
  utilityCatchError,
  utilitySuccess,
  RateLimitedError,
} from '@/lib/intelligence-api/guard';

/**
 * GET /api/dashboard/stats
 *
 * Aggregated command-center stats — companies, contacts, signals,
 * insights, opportunities, risks, and recommended actions, plus
 * "today" deltas and avgIntelligenceScore used by metric cards.
 *
 * Optimized: 15 DB queries → 4 consolidated queries with 30s TTL cache.
 * Uses utilityGuard for rate limiting, correlation-id, scrubError.
 * Returns proper error responses instead of masking 500 as 200.
 */
export async function GET(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

const startedAt = Date.now();

  // ── Guard ──
  let ctx: ReturnType<typeof utilityGuard>;
  try {
    ctx = utilityGuard(request, 'dashboard-stats');
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
    // ── Cached consolidated queries (15 DB queries → 4) ──
    const data = await dashboardCache.cached(
      'dashboard:stats',
      getDashboardStats,
    );

    return utilitySuccess(ctx, {
      companies: data.companies,
      contacts: data.contacts,
      signals: data.signals,
      insights: data.insights,
      opportunities: data.opportunities,
      risks: data.risks,
      recommendations: data.recommendations,
      avgIntelligenceScore: data.avgIntelligenceScore,
      today: data.today,
      breakdown: data.breakdown,
    }, 'dashboard-stats', Date.now() - startedAt);
  } catch (err) {
    return utilityCatchError(
      ctx,
      err,
      502,
      'INTELLIGENCE_UNAVAILABLE',
      'Dashboard stats fetch failed',
      Date.now() - startedAt,
    );
  }
}
