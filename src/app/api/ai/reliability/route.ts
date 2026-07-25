/**
 * AI Reliability API (Wave 8.3)
 *
 * GET /api/ai/reliability — AI engine health, quality metrics, generation stats
 *
 * Returns the AI Reliability Layer metrics for the Platform Operations Center.
 */

import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/apiHelpers';
import { getQualityMetrics } from '@/lib/ai-reliability';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);

    const metrics = await getQualityMetrics(days);

    return apiSuccess({
      aiEngine: {
        status: metrics.healthScore >= 80 ? 'healthy' : metrics.healthScore >= 60 ? 'degraded' : 'unhealthy',
        healthScore: metrics.healthScore,
        monitored: true,
      },
      generation: {
        total: metrics.totalGenerations,
        successRate: metrics.successRate,
        failureRate: metrics.failureRate,
        hallucinationRiskRate: metrics.hallucinationRiskRate,
        avgLatencyMs: metrics.avgLatencyMs,
        p95LatencyMs: metrics.p95LatencyMs,
      },
      confidence: {
        average: metrics.avgConfidence,
        highQualityPct: metrics.highConfidencePct,
        lowQualityPct: metrics.lowConfidencePct,
      },
      freshness: {
        average: metrics.avgFreshness,
        staleInsights: metrics.staleInsightCount,
      },
      tokens: {
        totalInput: metrics.totalInputTokens,
        totalOutput: metrics.totalOutputTokens,
        totalCombined: metrics.totalInputTokens + metrics.totalOutputTokens,
      },
      byType: metrics.byType,
      recentFailures: metrics.recentFailures,
    });
  } catch (error) {
    console.error('[ai/reliability] Error:', error);
    return apiError('Failed to compute AI reliability metrics', 500);
  }
}
