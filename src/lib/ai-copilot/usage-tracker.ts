/**
 * AI Usage Tracker — Log and estimate LLM usage/costs.
 *
 * Persists AI usage records for visibility into spending,
 * feature usage patterns, and cost attribution.
 *
 * Cost estimates use public pricing (as of 2025):
 *   - OpenAI gpt-4o-mini:  $0.15 / 1M input, $0.60 / 1M output
 *   - OpenAI gpt-4o:      $2.50 / 1M input, $10.00 / 1M output
 *   - Claude 3.5 Sonnet:   $3.00 / 1M input, $15.00 / 1M output
 *   - Gemini 2.0 Flash:    $0.10 / 1M input, $0.40 / 1M output
 *   - Default/fallback:     $1.00 / 1M tokens (conservative estimate)
 */

import { logger } from '@/lib/logger';

// ─── Per-model pricing (cost per 1M tokens) ───────────────────────────

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-3-5-sonnet': { input: 3.0, output: 15.0 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'gemini-1.5-pro': { input: 1.25, output: 5.0 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
  // Z.ai SDK — conservative estimate
  'zai-sdk': { input: 1.0, output: 4.0 },
};

const DEFAULT_PRICING = { input: 1.0, output: 4.0 };

/**
 * Estimate cost for a given provider/model/token usage.
 *
 * @param provider - Provider name (e.g., 'OpenAI', 'Anthropic', 'Gemini')
 * @param model - Model name (e.g., 'gpt-4o-mini')
 * @param promptTokens - Number of input/prompt tokens
 * @param completionTokens - Number of output/completion tokens
 * @returns Estimated cost in USD
 */
export function estimateCost(
  provider: string,
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const pricing = MODEL_PRICING[model.toLowerCase()] || DEFAULT_PRICING;
  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

/**
 * Log AI usage to the structured logger.
 *
 * In production, this should write to a database table (e.g., AIUsageLog).
 * For now, logs to the structured logger for observability.
 *
 * @param params - Usage record details
 */
export async function logAIUsage(params: {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  quality?: unknown;
  errorMessage?: string;
}): Promise<void> {
  const cost = estimateCost(
    params.provider,
    params.model,
    params.promptTokens,
    params.completionTokens,
  );

  const record = {
    provider: params.provider,
    model: params.model,
    promptTokens: params.promptTokens,
    completionTokens: params.completionTokens,
    totalTokens: params.promptTokens + params.completionTokens,
    latencyMs: params.latencyMs,
    estimatedCostUSD: cost,
    quality: params.quality ?? null,
    error: params.errorMessage ?? null,
    timestamp: new Date().toISOString(),
  };

  // Log to structured logger (in production, also write to DB)
  if (params.errorMessage) {
    logger.warn('[AI-USAGE] LLM call failed', record);
  } else {
    logger.info('[AI-USAGE] LLM call completed', record);
  }

  // DB persistence — write to AIUsageLog table
  try {
    const { db } = await import('@/lib/db');
    await db.aIUsageLog
      .create({
        data: {
          provider: params.provider,
          model: params.model,
          promptTokens: params.promptTokens,
          completionTokens: params.completionTokens,
          totalTokens: params.promptTokens + params.completionTokens,
          latencyMs: params.latencyMs,
          costUSD: cost,
          qualityScore:
            params.quality && typeof params.quality === 'object' && 'score' in params.quality
              ? (params.quality as { score: number }).score
              : null,
          error: params.errorMessage ?? null,
        },
      })
      .catch(() => {
        // DB write failed — logger output is sufficient
      });
  } catch {
    // DB not available — logger output is sufficient
  }
}
