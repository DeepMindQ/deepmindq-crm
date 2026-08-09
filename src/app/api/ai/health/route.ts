import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { checkApiAuth } from '@/lib/api-auth';
import {
  utilityGuard,
  utilityCatchError,
  utilitySuccess,
  RateLimitedError,
} from '@/lib/intelligence-api/guard';

/**
 * AI Health Center API (Wave 8.3)
 * Returns metrics about AI quality across the platform.
 */
export async function GET(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

const startedAt = Date.now();

  let ctx: ReturnType<typeof utilityGuard>;
  try {
    ctx = utilityGuard(request, 'ai-health');
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

    // Total insights generated
    const totalInsights = await db.aIInsight.count();
    const activeInsights = await db.aIInsight.count({ where: { status: 'active' } });
    const expiredInsights = await db.aIInsight.count({ where: { status: 'expired' } });

    // Average confidence
    const avgConfidenceResult = await db.aIInsight.aggregate({
      where: { status: 'active' },
      _avg: { confidenceScore: true },
    });
    const avgConfidence = avgConfidenceResult._avg.confidenceScore ?? 0;

    // Average impact
    const avgImpactResult = await db.aIInsight.aggregate({
      where: { status: 'active' },
      _avg: { impactScore: true },
    });
    const avgImpact = avgImpactResult._avg.impactScore ?? 0;

    // Insights by type
    const typeGroups = await db.aIInsight.groupBy({
      by: ['type'],
      where: { status: 'active' },
      _count: { type: true },
      _avg: { confidenceScore: true, impactScore: true },
    });

    // High urgency count (potential hallucination/alert)
    const highUrgencyCount = await db.aIInsight.count({
      where: { status: 'active', urgencyScore: { gte: 80 } },
    });

    // Insights expiring in next 24h
    const expiringSoon = await db.aIInsight.count({
      where: {
        status: 'active',
        expiresAt: { gte: now, lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
      },
    });

    // Feedback distribution
    const positiveFeedback = await db.aIInsight.count({ where: { feedback: 'positive' } });
    const negativeFeedback = await db.aIInsight.count({ where: { feedback: 'negative' } });
    const totalFeedback = positiveFeedback + negativeFeedback;
    const approvalRate = totalFeedback > 0 ? Math.round((positiveFeedback / totalFeedback) * 100) : 0;

    // Usage by route
    const routeGroups = await db.aIInsight.groupBy({
      by: ['sourceRoute'],
      where: { sourceRoute: { not: null } },
      _count: { sourceRoute: true },
    });

    // Recent insights (last 7 days)
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentInsights = await db.aIInsight.count({
      where: { createdAt: { gte: weekAgo } },
    });

    return utilitySuccess(ctx, {
      overview: {
        totalInsights,
        activeInsights,
        expiredInsights,
        recentInsights,
        approvalRate,
      },
      quality: {
        avgConfidence: Math.round(avgConfidence * 10) / 10,
        avgImpact: Math.round(avgImpact * 10) / 10,
        highUrgencyCount,
        expiringSoon,
      },
      byType: typeGroups.map((g) => ({
        type: g.type,
        count: g._count.type,
        avgConfidence: g._avg.confidenceScore ? Math.round(g._avg.confidenceScore * 10) / 10 : 0,
        avgImpact: g._avg.impactScore ? Math.round(g._avg.impactScore * 10) / 10 : 0,
      })),
      usageByRoute: routeGroups.map((g) => ({
        route: g.sourceRoute,
        count: g._count.sourceRoute,
      })),
    }, 'ai-health', Date.now() - startedAt);
  } catch (err) {
    return utilityCatchError(ctx, err, 502, 'ENGINE_ERROR', 'AI health check failed', Date.now() - startedAt);
  }
}
