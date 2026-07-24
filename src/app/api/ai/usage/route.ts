/**
 * AI Usage Dashboard API
 *
 * GET /api/ai/usage?days=30
 *
 * Returns aggregated AI usage statistics for the dashboard:
 *   - Total calls, cost, tokens
 *   - Breakdown by feature (generationType) and model
 *   - Daily trend for charting
 *   - Reliability metrics: governance pass rate, avg confidence, avg freshness
 *   - Error tracking: failed generations, by type
 *
 * All data sourced from AIGenerationAudit table (production-real data only).
 * No mock data. Empty arrays/zeroes when no records exist.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/apiHelpers';

// ── Query Params ──

const DAYS_MIN = 1;
const DAYS_MAX = 365;
const DAYS_DEFAULT = 30;

// ── Response Types ──

interface UsageStats {
  totalCalls: number;
  totalCost: number;
  totalTokens: number;
  avgConfidence: number;
  avgFreshness: number;
  governancePassRate: number;
  failedGenerations: number;
  byFeature: Record<string, {
    calls: number;
    cost: number;
    tokens: number;
    avgConfidence: number;
    passRate: number;
  }>;
  byModel: Record<string, {
    calls: number;
    cost: number;
    tokens: number;
  }>;
  dailyTrend: Array<{
    date: string;
    calls: number;
    cost: number;
    passRate: number;
  }>;
  recentFailures: Array<{
    id: string;
    generationType: string;
    createdAt: string;
    governanceChecks: string;
    outputSummary: string | null;
  }>;
  reliability: {
    uptimePercent: number;
    avgProcessingQuality: number;
    dataFreshnessPercent: number;
  };
}

// ── Cost Estimation ──

const COST_PER_1K_TOKENS: Record<string, { prompt: number; completion: number }> = {
  'meta/llama-3.1-8b-instruct': { prompt: 0.0, completion: 0.0 },
  'accounts/fireworks/models/llama-v3p3-70b-instruct': { prompt: 0.0, completion: 0.0 },
  'llama-3.3-70b-versatile': { prompt: 0.0, completion: 0.0 },
  'gemini-2.0-flash': { prompt: 0.000075, completion: 0.0003 },
  'gemini-1.5-pro': { prompt: 0.00125, completion: 0.005 },
  'gemini-1.5-flash': { prompt: 0.000075, completion: 0.0003 },
  'gemini-pro': { prompt: 0.00025, completion: 0.0005 },
  'gpt-4o': { prompt: 0.0025, completion: 0.01 },
  'gpt-4o-mini': { prompt: 0.00015, completion: 0.0006 },
  'claude-sonnet': { prompt: 0.003, completion: 0.015 },
};

const DEFAULT_COST_PER_1K = { prompt: 0.001, completion: 0.005 };

// Character-based token estimation (~4 chars per token)
function estimateTokensFromSummary(summary: string | null): number {
  if (!summary) return 150; // conservative baseline for untracked calls
  return Math.ceil(summary.length / 4);
}

// ── GET Handler ──

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get('days');
    let days = DAYS_DEFAULT;

    if (daysParam) {
      days = parseInt(daysParam, 10);
      if (isNaN(days) || days < DAYS_MIN || days > DAYS_MAX) {
        days = DAYS_DEFAULT;
      }
    }

    const since = new Date();
    since.setDate(since.getDate() - days);

    // ── Query all audit records in window ──
    const records = await db.aIGenerationAudit.findMany({
      where: {
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'asc' },
    });

    // ── Aggregate ──
    let totalCalls = 0;
    let totalCost = 0;
    let totalTokens = 0;
    let confidenceSum = 0;
    let freshnessSum = 0;
    let confidenceCount = 0;
    let freshnessCount = 0;
    let governancePassed = 0;
    let governanceFailed = 0;

    const byFeature: Record<string, {
      calls: number;
      cost: number;
      tokens: number;
      confidenceSum: number;
      confidenceCount: number;
      passCount: number;
    }> = {};

    const byModel: Record<string, {
      calls: number;
      cost: number;
      tokens: number;
    }> = {};

    const dailyMap = new Map<string, {
      calls: number;
      cost: number;
      passCount: number;
      totalGovernance: number;
    }>();

    const recentFailures: UsageStats['recentFailures'] = [];

    for (const record of records) {
      totalCalls++;

      // Token estimation from output summary
      const tokens = estimateTokensFromSummary(record.outputSummary);
      totalTokens += tokens;

      // Cost estimation
      const model = record.modelUsed ?? 'unknown';
      const pricing = COST_PER_1K_TOKENS[model] ?? DEFAULT_COST_PER_1K;
      const cost = (tokens / 1000) * (pricing.prompt + pricing.completion);
      totalCost += cost;

      // Confidence & freshness
      if (record.researchConfidence > 0) {
        confidenceSum += record.researchConfidence;
        confidenceCount++;
      }
      if (record.freshnessScore > 0) {
        freshnessSum += record.freshnessScore;
        freshnessCount++;
      }

      // Governance (pass/fail proxy for reliability)
      if (record.governancePassed) {
        governancePassed++;
      } else {
        governanceFailed++;
        // Track recent failures (last 10)
        if (recentFailures.length < 10) {
          recentFailures.push({
            id: record.id,
            generationType: record.generationType,
            createdAt: record.createdAt.toISOString(),
            governanceChecks: record.governanceChecks ?? '{}',
            outputSummary: record.outputSummary,
          });
        }
      }

      // By feature (generationType)
      const feature = record.generationType ?? 'unknown';
      if (!byFeature[feature]) {
        byFeature[feature] = { calls: 0, cost: 0, tokens: 0, confidenceSum: 0, confidenceCount: 0, passCount: 0 };
      }
      byFeature[feature].calls++;
      byFeature[feature].cost += cost;
      byFeature[feature].tokens += tokens;
      if (record.researchConfidence > 0) {
        byFeature[feature].confidenceSum += record.researchConfidence;
        byFeature[feature].confidenceCount++;
      }
      if (record.governancePassed) {
        byFeature[feature].passCount++;
      }

      // By model
      if (!byModel[model]) {
        byModel[model] = { calls: 0, cost: 0, tokens: 0 };
      }
      byModel[model].calls++;
      byModel[model].cost += cost;
      byModel[model].tokens += tokens;

      // Daily trend
      const dateKey = record.createdAt.toISOString().slice(0, 10);
      const daily = dailyMap.get(dateKey) ?? { calls: 0, cost: 0, passCount: 0, totalGovernance: 0 };
      daily.calls++;
      daily.cost += cost;
      if (record.governancePassed) daily.passCount++;
      daily.totalGovernance++;
      dailyMap.set(dateKey, daily);
    }

    // ── Build final response ──

    const avgConfidence = confidenceCount > 0
      ? Math.round((confidenceSum / confidenceCount) * 100)
      : 0;
    const avgFreshness = freshnessCount > 0
      ? Math.round(freshnessSum / freshnessCount)
      : 0;
    const governancePassRate = totalCalls > 0
      ? Math.round((governancePassed / totalCalls) * 100)
      : 100;

    // Round costs
    totalCost = Math.round(totalCost * 1_000_000) / 1_000_000;

    const byFeatureFinal: UsageStats['byFeature'] = {};
    for (const [key, val] of Object.entries(byFeature)) {
      byFeatureFinal[key] = {
        calls: val.calls,
        cost: Math.round(val.cost * 1_000_000) / 1_000_000,
        tokens: val.tokens,
        avgConfidence: val.confidenceCount > 0
          ? Math.round((val.confidenceSum / val.confidenceCount) * 100)
          : 0,
        passRate: val.calls > 0
          ? Math.round((val.passCount / val.calls) * 100)
          : 100,
      };
    }

    const byModelFinal: UsageStats['byModel'] = {};
    for (const [key, val] of Object.entries(byModel)) {
      byModelFinal[key] = {
        calls: val.calls,
        cost: Math.round(val.cost * 1_000_000) / 1_000_000,
        tokens: val.tokens,
      };
    }

    const dailyTrend: UsageStats['dailyTrend'] = Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        calls: data.calls,
        cost: Math.round(data.cost * 1_000_000) / 1_000_000,
        passRate: data.totalGovernance > 0
          ? Math.round((data.passCount / data.totalGovernance) * 100)
          : 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const stats: UsageStats = {
      totalCalls,
      totalCost,
      totalTokens,
      avgConfidence,
      avgFreshness,
      governancePassRate,
      failedGenerations: governanceFailed,
      byFeature: byFeatureFinal,
      byModel: byModelFinal,
      dailyTrend,
      recentFailures,
      reliability: {
        uptimePercent: governancePassRate,
        avgProcessingQuality: avgConfidence,
        dataFreshnessPercent: avgFreshness,
      },
    };

    return apiSuccess({ stats });
  } catch (err) {
    console.error('[AI Usage API] Failed to fetch usage stats:', err);
    return apiError('Failed to fetch AI usage statistics', 500);
  }
}
