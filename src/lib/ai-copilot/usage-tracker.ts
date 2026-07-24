/**
 * AI Revenue Copilot — Usage Tracker
 *
 * Tracks every AI generation call for cost visibility, model usage analytics,
 * and budget enforcement. Essential for enterprise cost management at scale.
 *
 * Provides:
 *   - Per-call logging to AIUsageLog table.
 *   - Cost estimation using configurable per-model pricing.
 *   - Aggregated usage statistics (by feature, by model, daily trend).
 *
 * Cost estimates are approximate — actual costs depend on token counting
 * implementation (tiktoken vs. character-based estimation).
 */

import { db } from '@/lib/db';
import type { AIUsageFeature, AIUsageRecord } from './types';

// ═══════════════════════════════════════════════════════════════════════════════
//  COST CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Cost per 1,000 tokens (USD) for known models.
 * Update these when new models are added or pricing changes.
 */
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

/**
 * Default cost per 1K tokens for unknown models (conservative estimate).
 */
const DEFAULT_COST_PER_1K = { prompt: 0.001, completion: 0.005 };

// ═══════════════════════════════════════════════════════════════════════════════
//  PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Estimates the cost of an AI generation call based on model and token counts.
 *
 * @param model - Model identifier (e.g. "gemini-2.0-flash")
 * @param promptTokens - Number of tokens in the prompt
 * @param completionTokens - Number of tokens in the completion
 * @returns Estimated cost in USD
 */
export function estimateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = COST_PER_1K_TOKENS[model] ?? DEFAULT_COST_PER_1K;

  const promptCost = (promptTokens / 1000) * pricing.prompt;
  const completionCost = (completionTokens / 1000) * pricing.completion;

  // Round to 6 decimal places for precision
  return Math.round((promptCost + completionCost) * 1_000_000) / 1_000_000;
}

/**
 * Persists an AI usage record to the AIUsageLog table.
 *
 * Wraps in try/catch to never throw — usage logging is best-effort
 * and should not block the main operation.
 *
 * @param record - Usage record to persist (without id and generatedAt)
 */
export async function logAIUsage(
  record: Omit<AIUsageRecord, 'id' | 'generatedAt'>
): Promise<void> {
  try {
    console.log(
      `[ai-copilot:usage-tracker] Logging usage: feature=${record.feature}, model=${record.model}, ` +
        `tokens=${record.totalTokens}, cost=$${record.estimatedCost}, status=${record.status}`
    );

    await db.aIGenerationAudit.create({
      data: {
        companyId: record.companyId,
        feature: record.feature,
        model: record.model,
        promptTokens: record.promptTokens,
        completionTokens: record.completionTokens,
        totalTokens: record.totalTokens,
        estimatedCost: record.estimatedCost,
        status: record.status,
        errorMessage: record.errorMessage ?? null,
      } as any,
    });

    console.log('[ai-copilot:usage-tracker] Usage record persisted successfully');
  } catch (err) {
    // Never throw from usage logging — log and continue
    console.error(
      '[ai-copilot:usage-tracker] Failed to persist usage record:',
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * Retrieves aggregated usage statistics over a time window.
 *
 * @param days - Number of days to look back (default: 30)
 * @returns Aggregated statistics by feature, model, and daily trend
 */
export async function getUsageStats(days: number = 30): Promise<{
  totalCalls: number;
  totalCost: number;
  totalTokens: number;
  byFeature: Record<string, { calls: number; cost: number; tokens: number }>;
  byModel: Record<string, { calls: number; cost: number; tokens: number }>;
  dailyTrend: Array<{ date: string; calls: number; cost: number }>;
}> {
  try {
    console.log(`[ai-copilot:usage-tracker] Fetching usage stats (last ${days} days)`);

    const since = new Date();
    since.setDate(since.getDate() - days);

    const records = await db.aIGenerationAudit.findMany({
      where: {
        generatedAt: { gte: since },
      } as any,
      orderBy: { generatedAt: 'asc' } as any,
    });

    // Aggregate totals
    let totalCalls = 0;
    let totalCost = 0;
    let totalTokens = 0;
    const byFeature: Record<string, { calls: number; cost: number; tokens: number }> = {};
    const byModel: Record<string, { calls: number; cost: number; tokens: number }> = {};
    const dailyMap = new Map<string, { calls: number; cost: number }>();

    for (const record of records as any[]) {
      totalCalls++;
      totalCost += record.estimatedCost ?? 0;
      totalTokens += record.totalTokens ?? 0;

      // By feature
      const feature = record.feature ?? 'unknown';
      if (!byFeature[feature]) {
        byFeature[feature] = { calls: 0, cost: 0, tokens: 0 };
      }
      byFeature[feature].calls++;
      byFeature[feature].cost += record.estimatedCost ?? 0;
      byFeature[feature].tokens += record.totalTokens ?? 0;

      // By model
      const model = record.model ?? 'unknown';
      if (!byModel[model]) {
        byModel[model] = { calls: 0, cost: 0, tokens: 0 };
      }
      byModel[model].calls++;
      byModel[model].cost += record.estimatedCost ?? 0;
      byModel[model].tokens += record.totalTokens ?? 0;

      // Daily trend
      const dateKey = (record.generatedAt ?? record.createdAt ?? new Date()).toISOString().slice(0, 10); // YYYY-MM-DD
      const daily = dailyMap.get(dateKey) ?? { calls: 0, cost: 0 };
      daily.calls++;
      daily.cost += record.estimatedCost ?? 0;
      dailyMap.set(dateKey, daily);
    }

    // Convert daily map to sorted array
    const dailyTrend = Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        calls: data.calls,
        cost: Math.round(data.cost * 1_000_000) / 1_000_000,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Round cost values
    totalCost = Math.round(totalCost * 1_000_000) / 1_000_000;
    for (const feature of Object.values(byFeature)) {
      feature.cost = Math.round(feature.cost * 1_000_000) / 1_000_000;
    }
    for (const model of Object.values(byModel)) {
      model.cost = Math.round(model.cost * 1_000_000) / 1_000_000;
    }

    console.log(
      `[ai-copilot:usage-tracker] Stats: ${totalCalls} calls, $${totalCost} cost, ${totalTokens} tokens`
    );

    return {
      totalCalls,
      totalCost,
      totalTokens,
      byFeature,
      byModel,
      dailyTrend,
    };
  } catch (err) {
    console.error(
      '[ai-copilot:usage-tracker] Failed to fetch usage stats:',
      err instanceof Error ? err.message : err
    );
    return {
      totalCalls: 0,
      totalCost: 0,
      totalTokens: 0,
      byFeature: {},
      byModel: {},
      dailyTrend: [],
    };
  }
}
