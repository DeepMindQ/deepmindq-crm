import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
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
 * Uses utilityGuard for rate limiting, correlation-id, scrubError.
 * Returns proper error responses instead of masking 500 as 200.
 */
export async function GET(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
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
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const [
      companies,
      contacts,
      signals,
      insights,
      opportunities,
      risks,
      recommendations,
      avgScoreResult,
      newSignalsToday,
      newOpportunitiesToday,
      newRisksToday,
      newRecommendationsToday,
      signalsByImpact,
      signalsByType,
      insightsByType,
    ] = await Promise.all([
      db.company.count({ where: { status: { not: 'archived' } } }),
      db.contact.count({ where: { status: { not: 'archived' } } }),
      db.companySignal.count({ where: { status: { notIn: ['archived', 'expired'] } } }),
      db.aIInsight.count({ where: { status: 'active' } }),
      db.opportunityRecommendation.count({ where: { status: { notIn: ['rejected'] } } }),
      db.companySignal.count({
        where: {
          severity: { in: ['high', 'critical'] },
          status: { notIn: ['archived', 'expired'] },
        },
      }),
      db.aIInsight.count({ where: { status: 'active', type: 'RECOMMENDATION' } }),
      db.company.aggregate({
        where: { status: { not: 'archived' }, intelligenceScore: { gte: 0 } },
        _avg: { intelligenceScore: true },
      }),
      db.companySignal.count({ where: { createdAt: { gte: startOfToday } } }),
      db.opportunityRecommendation.count({ where: { createdAt: { gte: startOfToday } } }),
      db.companySignal.count({
        where: {
          severity: { in: ['high', 'critical'] },
          createdAt: { gte: startOfToday },
        },
      }),
      db.aIInsight.count({
        where: { status: 'active', type: 'RECOMMENDATION', createdAt: { gte: startOfToday } },
      }),
      db.companySignal.groupBy({
        by: ['impact'],
        where: { status: { notIn: ['archived', 'expired'] } },
        _count: { impact: true },
      }),
      db.companySignal.groupBy({
        by: ['signalType'],
        where: { status: { notIn: ['archived', 'expired'] } },
        _count: { signalType: true },
      }),
      db.aIInsight.groupBy({
        by: ['type'],
        where: { status: 'active' },
        _count: { type: true },
      }),
    ]);

    const byImpact: Record<string, number> = {};
    for (const g of signalsByImpact) byImpact[g.impact as string] = g._count.impact;

    const bySignalType: Record<string, number> = {};
    for (const g of signalsByType) bySignalType[g.signalType as string] = g._count.signalType;

    const byInsightType: Record<string, number> = {};
    for (const g of insightsByType) byInsightType[g.type as string] = g._count.type;

    return utilitySuccess(ctx, {
      companies,
      contacts,
      signals,
      insights,
      opportunities,
      risks,
      recommendations,
      avgIntelligenceScore: Math.round(avgScoreResult._avg?.intelligenceScore ?? 0),
      today: {
        newSignals: newSignalsToday,
        newOpportunities: newOpportunitiesToday,
        newRisks: newRisksToday,
        newRecommendations: newRecommendationsToday,
      },
      breakdown: {
        signalsByImpact: byImpact,
        signalsByType: bySignalType,
        insightsByType: byInsightType,
      },
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
