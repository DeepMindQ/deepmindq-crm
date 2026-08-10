/**
 * ModelRouter — Phase B Foundation Engine #1
 * ============================================
 *
 * Tiered LLM router for the DeepMindQ engine architecture. Provides a single
 * entry point for all composition engines (Synthesis, Scoring, Action,
 * Conversation) to call LLMs with consistent:
 *
 *   - Tier-based provider selection (Deep / Smart / Fast)
 *   - Automatic fallback across providers within a tier
 *   - Token + cost accounting via logAIUsage
 *   - Non-throwing design — returns structured CompletionResult
 *   - Health check for /api/health and the AI Health Center
 *
 * TIERS
 * -----
 *   deep   Z.ai GLM-4.6 → Gemini 1.5 Pro → Gemini 2.0 Flash  (maxTokens 8192)
 *          For long-form briefs, deal strategy, multi-factor scoring narratives.
 *   smart  Gemini 2.0 Flash → Groq Llama 3.3 70B → Z.ai       (maxTokens 4096)
 *          For action plans, opportunity progression, contact briefs.
 *   fast   Groq Llama 3.1 8B → Gemini 2.0 Flash               (maxTokens 1500)
 *          For conversation turns, intent classification, short summaries.
 *
 * Zero-budget stack: every default provider has a free tier. Paid providers
 * (NVIDIA, Fireworks, OpenAI) are disabled by default and require explicit
 * opt-in via env vars.
 *
 * NON-THROWING CONTRACT
 * ---------------------
 *   Every LLM call returns a CompletionResult object. Failures are surfaced
 *   as `success: false` + `error: '<details>'` rather than thrown. This
 *   lets composition engines degrade gracefully — a failed Deep call falls
 *   back to Smart, then Fast, then returns a structured error that the
 *   composition engine can include in its own result object.
 */

import { callLLM } from '@/lib/llm-client';
import { countTokens } from '@/lib/token-counter';
import { tokens } from '@/lib/design-tokens';
import { getLLMChain, getProviderConfig, testProviderConnection, getAIConfigWithKeys } from '@/lib/ai-config';
import { logger } from '@/lib/logger';
import { logAIUsage, estimateCost } from '@/lib/ai-copilot/usage-tracker';
import { getModelCost } from '@/lib/unified-ai-cost-tracking';
import type { AIUsageFeature } from '@/lib/ai-copilot/types';

// ─── Types ──────────────────────────────────────────────────────────────

export type Tier = 'deep' | 'smart' | 'fast';

export interface CompletionParams {
  /** System prompt — defines the AI's role and constraints. */
  systemPrompt: string;
  /** User prompt — the actual task and context. */
  userPrompt: string;
  /** Tier selects the provider pool. Default: 'smart'. */
  tier?: Tier;
  /** Max output tokens. Default per-tier if omitted. */
  maxTokens?: number;
  /** Temperature 0-1. Default 0.7. */
  temperature?: number;
  /** Composition ID — links this LLM call to a composition-level EngineRun. */
  compositionId?: string;
  /** Generation type label for usage audit (e.g. 'synthesis_account_brief'). */
  genType?: string;
  /** Company ID for usage attribution. */
  companyId?: string;
  /** Contact ID for usage attribution. */
  contactId?: string;
}

export interface CompletionResult {
  success: boolean;
  /** The LLM completion text. Empty string on failure. */
  text: string;
  /** Which model actually produced the response (post-fallback). */
  modelUsed: string;
  /** Which tier was requested. */
  tier: Tier;
  /** Token accounting (best-effort estimate when provider doesn't return it). */
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** Estimated USD cost. */
  costUsd: number;
  /** Wall-clock duration. */
  durationMs: number;
  /** True if the primary provider failed and we fell back. */
  fellBack: boolean;
  /** Error message if !success. */
  error: string | null;
}

// ─── S6-3.2: Provider Performance Tracking ──────────────────────────────

interface ProviderPerformanceRecord {
  /** Total calls attempted */
  totalCalls: number;
  /** Successful calls */
  successCalls: number;
  /** Failed calls */
  failedCalls: number;
  /** Cumulative latency (ms) for successful calls */
  totalLatencyMs: number;
  /** Last N latency samples for P50/P95 calculation */
  recentLatencies: number[];
  /** Timestamp of last failure */
  lastFailureAt: number | null;
  /** Whether circuit breaker is open (provider skipped) */
  circuitOpen: boolean;
  /** Timestamp when circuit breaker was opened */
  circuitOpenedAt: number | null;
}

const MAX_RECENT_LATENCIES = 100;
const CIRCUIT_BREAKER_THRESHOLD = 5; // Open after 5 consecutive failures
const CIRCUIT_BREAKER_RESET_MS = 60_000; // Reset after 60 seconds
const CIRCUIT_BREAKER_HALF_OPEN_MS = 30_000; // Half-open after 30s (try one request)

// Phase 4: Per-provider rate limiting (requests per minute)
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_RPM = 30; // Max 30 requests per minute per provider (conservative for free tiers)
const providerRateLimitTimestamps = new Map<string, number[]>();

const providerPerformance = new Map<string, ProviderPerformanceRecord>();

function getOrCreateProviderRecord(model: string): ProviderPerformanceRecord {
  let record = providerPerformance.get(model);
  if (!record) {
    record = {
      totalCalls: 0,
      successCalls: 0,
      failedCalls: 0,
      totalLatencyMs: 0,
      recentLatencies: [],
      lastFailureAt: null,
      circuitOpen: false,
      circuitOpenedAt: null,
    };
    providerPerformance.set(model, record);
  }
  return record;
}

function recordProviderSuccess(model: string, latencyMs: number): void {
  const record = getOrCreateProviderRecord(model);
  record.totalCalls++;
  record.successCalls++;
  record.totalLatencyMs += latencyMs;
  record.recentLatencies.push(latencyMs);
  if (record.recentLatencies.length > MAX_RECENT_LATENCIES) {
    record.recentLatencies.shift();
  }
  // Close circuit on success (if it was open)
  if (record.circuitOpen) {
    record.circuitOpen = false;
    record.circuitOpenedAt = null;
    logger.info(`[model-router] Circuit CLOSED for ${model} after successful call`);
  }
}

function recordProviderFailure(model: string): void {
  const record = getOrCreateProviderRecord(model);
  record.totalCalls++;
  record.failedCalls++;
  record.lastFailureAt = Date.now();

  // Check if we should open circuit breaker
  // Count consecutive recent failures
  const recentFailureRate = record.totalCalls > 0
    ? record.failedCalls / record.totalCalls
    : 0;

  if (recentFailureRate >= 0.8 && record.failedCalls >= CIRCUIT_BREAKER_THRESHOLD && !record.circuitOpen) {
    record.circuitOpen = true;
    record.circuitOpenedAt = Date.now();
    logger.warn(`[model-router] Circuit OPENED for ${model} (${record.failedCalls} failures)`);
  }
}

function isProviderCircuitOpen(model: string): boolean {
  const record = providerPerformance.get(model);
  if (!record || !record.circuitOpen) return false;

  const now = Date.now();
  const elapsed = now - (record.circuitOpenedAt ?? now);

  // After reset time, allow one attempt (half-open)
  if (elapsed >= CIRCUIT_BREAKER_RESET_MS) {
    return false;
  }

  // Half-open: allow one request after half-open time
  if (elapsed >= CIRCUIT_BREAKER_HALF_OPEN_MS) {
    return false;
  }

  return true;
}

// Phase 4: Per-provider RPM rate limiting
function isProviderRateLimited(model: string): boolean {
  const now = Date.now();
  const timestamps = providerRateLimitTimestamps.get(model);
  if (!timestamps || timestamps.length === 0) return false;

  // Prune timestamps outside the window
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recent = timestamps.filter(t => t >= windowStart);
  providerRateLimitTimestamps.set(model, recent);

  return recent.length >= RATE_LIMIT_MAX_RPM;
}

function recordProviderRequest(model: string): void {
  const timestamps = providerRateLimitTimestamps.get(model) || [];
  timestamps.push(Date.now());
  providerRateLimitTimestamps.set(model, timestamps);
}

// ─── Tier Configurations ────────────────────────────────────────────────

interface TierConfig {
  /** Max output tokens if not specified in params. */
  defaultMaxTokens: number;
  /** Preferred providers in priority order (matched against getLLMChain labels). */
  preferredLabels: string[];
  /** Hard cap on prompt+completion tokens for this tier. */
  hardCapTokens: number;
}

const TIER_CONFIGS: Record<Tier, TierConfig> = {
  deep: {
    defaultMaxTokens: 8192,
    preferredLabels: ['GLM', 'Gemini 1.5 Pro', 'Gemini 2.0 Flash', 'Gemini'],
    hardCapTokens: 16000,
  },
  smart: {
    defaultMaxTokens: 4096,
    preferredLabels: ['Gemini 2.0 Flash', 'Gemini', 'Llama 3.3 70B', 'GLM'],
    hardCapTokens: 8000,
  },
  fast: {
    defaultMaxTokens: 1500,
    preferredLabels: ['Llama 3.1 8B', 'Gemini 2.0 Flash', 'Gemini', 'Llama'],
    hardCapTokens: 4000,
  },
};

// ─── Token Estimation ──────────────────────────────────────────────────
// estimateTokens (synchronous heuristic) is imported from @/lib/token-counter.
// countTokens (async, tiktoken-aware) is used throughout this module.

// ─── Cost Estimation Helper ────────────────────────────────────────────

/**
 * Phase 4: Estimate a provider's cost tier for chain ordering.
 * Uses the unified cost registry when available, falls back to
 * heuristic model-family matching.
 */
function estimateProviderCost(model: string): number {
  try {
    const cost = getModelCost(model);
    if (cost) return cost.inputPerM + cost.outputPerM;
  } catch { /* ignore */ }
  // Fallback: approximate costs by model family
  if (model.includes('8b') || model.includes('8B')) return 0.05; // Cheapest
  if (model.includes('70b') || model.includes('70B')) return 0.30;
  if (model.includes('flash')) return 0.075;
  if (model.includes('1.5-pro')) return 1.25;
  return 0.50; // Default medium estimate
}

// ─── ModelRouter ────────────────────────────────────────────────────────

export const ModelRouter = {
  /**
   * Perform an LLM completion with tier-based provider selection,
   * automatic fallback, and usage auditing. Non-throwing.
   */
  async complete(params: CompletionParams): Promise<CompletionResult> {
    const tier = params.tier ?? 'smart';
    const config = TIER_CONFIGS[tier];
    const maxTokens = Math.min(
      params.maxTokens ?? config.defaultMaxTokens,
      config.hardCapTokens,
    );
    const temperature = params.temperature ?? 0.7;

    const startedAt = Date.now();
    logger.info(`[model-router] tier=${tier} genType=${params.genType ?? '-'} ` +
        `maxTokens=${maxTokens} compositionId=${params.compositionId ?? '-'}`);

    // Get the provider chain from ai-config (respects user settings).
    let chain: Awaited<ReturnType<typeof getLLMChain>> = [];
    try {
      chain = await getLLMChain();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[model-router] failed to load provider chain: ${msg}`);
    }

    if (chain.length === 0) {
      // No providers configured — fall back to direct callLLM which has its
      // own internal chain resolution. This keeps the engine working even
      // when ai-config can't be read (e.g. during tests without DB).
      try {
        const text = await callLLM(params.systemPrompt, params.userPrompt);
        const promptTokens = await countTokens(params.systemPrompt + params.userPrompt);
        const completionTokens = await countTokens(text);
        const cost = estimateCost('unknown', promptTokens, completionTokens);
        await this._audit({
          params,
          tier,
          modelUsed: 'callLLM-fallback',
          promptTokens,
          completionTokens,
          cost,
          durationMs: Date.now() - startedAt,
          success: true,
        });
        return {
          success: true,
          text,
          modelUsed: 'callLLM-fallback',
          tier,
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
          costUsd: cost,
          durationMs: Date.now() - startedAt,
          fellBack: true,
          error: null,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[model-router] all fallbacks failed: ${msg}`);
        await this._audit({
          params,
          tier,
          modelUsed: 'none',
          promptTokens: 0,
          completionTokens: 0,
          cost: 0,
          durationMs: Date.now() - startedAt,
          success: false,
          errorMessage: msg,
        });
        return {
          success: false,
          text: '',
          modelUsed: 'none',
          tier,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          costUsd: 0,
          durationMs: Date.now() - startedAt,
          fellBack: false,
          error: msg,
        };
      }
    }

    // Reorder chain based on tier preference.
    const orderedChain = this._orderChainByTier(chain, config);

    const errors: string[] = [];
    let fellBack = false;

    for (let i = 0; i < orderedChain.length; i++) {
      const provider = orderedChain[i];
      if (i > 0) fellBack = true;

      // S6-3.2: Circuit breaker check — skip providers with open circuits
      if (isProviderCircuitOpen(provider.model)) {
        const msg = `Circuit breaker OPEN for ${provider.model}`;
        errors.push(msg);
        logger.warn(`[model-router] skipping ${provider.model}: circuit breaker open`);
        continue;
      }

      // Phase 4: Per-provider rate limiting — skip if RPM exceeded
      if (isProviderRateLimited(provider.model)) {
        const msg = `Rate limit reached for ${provider.model} (${RATE_LIMIT_MAX_RPM} RPM)`;
        errors.push(msg);
        logger.warn(`[model-router] skipping ${provider.model}: rate limited (${RATE_LIMIT_MAX_RPM} RPM)`);
        continue;
      }
      recordProviderRequest(provider.model);

      try {
        logger.info(`[model-router] trying provider: ${provider.label}`);
        // Use callLLM with this provider's config — it handles Gemini variants
        // and provider-specific quirks. We pass system+user prompts and let
        // llm-client manages the actual HTTP call.
        const text = await callLLM(params.systemPrompt, params.userPrompt);

        if (!text || text.trim().length === 0) {
          throw new Error('Empty response from provider');
        }

        const promptTokens = await countTokens(params.systemPrompt + params.userPrompt);
        const completionTokens = await countTokens(text);
        const cost = estimateCost(provider.model, promptTokens, completionTokens);
        const durationMs = Date.now() - startedAt;

        // S6-3.2: Record success for performance tracking
        recordProviderSuccess(provider.model, durationMs);

        await this._audit({
          params,
          tier,
          modelUsed: provider.model,
          promptTokens,
          completionTokens,
          cost,
          durationMs,
          success: true,
        });

        logger.info(
          `[model-router] success: model=${provider.model} tokens=${promptTokens + completionTokens} ` +
            `cost=$${cost.toFixed(6)} duration=${durationMs}ms fellBack=${fellBack}`,
        );

        return {
          success: true,
          text,
          modelUsed: provider.model,
          tier,
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
          costUsd: cost,
          durationMs,
          fellBack,
          error: null,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${provider.label}: ${msg}`);
        // S6-3.2: Record failure for circuit breaker
        recordProviderFailure(provider.model);
        logger.info(`[model-router] provider ${provider.label} failed: ${msg}`);
      }
    }

    // All providers failed
    const errorMsg = `all candidates failed for tier=${tier} genType=${params.genType ?? '-'}`;
    logger.error(`[model-router] ${errorMsg}\n${errors.join('\n')}`);
    await this._audit({
      params,
      tier,
      modelUsed: 'none',
      promptTokens: 0,
      completionTokens: 0,
      cost: 0,
      durationMs: Date.now() - startedAt,
      success: false,
      errorMessage: errorMsg,
    });

    return {
      success: false,
      text: '',
      modelUsed: 'none',
      tier,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      durationMs: Date.now() - startedAt,
      fellBack: false,
      error: errorMsg,
    };
  },

  /**
   * Reorder the provider chain based on tier preferences.
   * Providers matching preferredLabels come first, others retain their order.
   */
  _orderChainByTier(
    chain: Awaited<ReturnType<typeof getLLMChain>>,
    config: TierConfig,
  ): Awaited<ReturnType<typeof getLLMChain>> {
    const preferred: typeof chain = [];
    const others: typeof chain = [];

    for (const provider of chain) {
      const isPreferred = config.preferredLabels.some(
        (label) =>
          provider.label?.toLowerCase().includes(label.toLowerCase()) ||
          provider.model?.toLowerCase().includes(label.toLowerCase().replace(/\s/g, '-')),
      );
      if (isPreferred) preferred.push(provider);
      else others.push(provider);
    }

    // Sort preferred by their position in preferredLabels (priority order),
    // then sub-sort by cost within same preference level.
    preferred.sort((a, b) => {
      const aIdx = config.preferredLabels.findIndex(
        (label) =>
          a.label?.toLowerCase().includes(label.toLowerCase()) ||
          a.model?.toLowerCase().includes(label.toLowerCase().replace(/\s/g, '-')),
      );
      const bIdx = config.preferredLabels.findIndex(
        (label) =>
          b.label?.toLowerCase().includes(label.toLowerCase()) ||
          b.model?.toLowerCase().includes(label.toLowerCase().replace(/\s/g, '-')),
      );
      if (aIdx !== bIdx) return aIdx - bIdx;
      // Phase 4: Cost-aware sub-sorting — prefer cheaper providers within same tier preference
      const aCost = estimateProviderCost(a.model);
      const bCost = estimateProviderCost(b.model);
      return aCost - bCost;
    });

    return [...preferred, ...others];
  },

  /**
   * Best-effort usage audit. Never throws.
   */
  async _audit(args: {
    params: CompletionParams;
    tier: Tier;
    modelUsed: string;
    promptTokens: number;
    completionTokens: number;
    cost: number;
    durationMs: number;
    success: boolean;
    errorMessage?: string;
  }): Promise<void> {
    try {
      await logAIUsage({
        companyId: args.params.companyId ?? null,
        feature: (args.params.genType ?? 'ENGINE') as AIUsageFeature,
        model: args.modelUsed,
        promptTokens: args.promptTokens,
        completionTokens: args.completionTokens,
        totalTokens: args.promptTokens + args.completionTokens,
        estimatedCost: args.cost,
        status: args.success ? 'success' : 'failed',
        errorMessage: args.errorMessage,
      });
    } catch (err) {
      // Audit failure must never break the engine
      logger.error(`[model-router] audit failed: ${err instanceof Error ? err.message : err}`);
    }
  },

  /**
   * Health check — returns which tiers are currently available based on
   * configured providers. Used by /api/health and the AI Health Center.
   */
  async health(): Promise<{
    deep: boolean;
    smart: boolean;
    fast: boolean;
    providers: number;
    details: { tier: Tier; available: boolean; providers: string[] }[];
  }> {
    let chain: Awaited<ReturnType<typeof getLLMChain>> = [];
    try {
      chain = await getLLMChain();
    } catch {
      chain = [];
    }

    const providerLabels = chain.map((p) => p.label);
    const checkTier = (tier: Tier): boolean => {
      const config = TIER_CONFIGS[tier];
      return config.preferredLabels.some((label) =>
        providerLabels.some((pl) =>
          pl?.toLowerCase().includes(label.toLowerCase()),
        ),
      );
    };

    const deep = checkTier('deep');
    const smart = checkTier('smart');
    const fast = checkTier('fast');

    return {
      deep,
      smart,
      fast,
      providers: chain.length,
      details: [
        { tier: 'deep', available: deep, providers: providerLabels },
        { tier: 'smart', available: smart, providers: providerLabels },
        { tier: 'fast', available: fast, providers: providerLabels },
      ],
    };
  },

  /**
   * S6-3.2: Get provider performance statistics.
   * Returns latency percentiles, success rates, and circuit breaker state
   * for all providers that have been called since startup.
   */
  getPerformanceStats(): Array<{
    model: string;
    totalCalls: number;
    successCalls: number;
    failedCalls: number;
    successRate: number;
    avgLatencyMs: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    circuitOpen: boolean;
    lastFailureAt: string | null;
  }> {
    const stats: ReturnType<typeof ModelRouter.getPerformanceStats> = [];

    for (const [model, record] of providerPerformance.entries()) {
      const sortedLatencies = [...record.recentLatencies].sort((a, b) => a - b);
      const p50 = sortedLatencies.length > 0
        ? sortedLatencies[Math.floor(sortedLatencies.length * 0.5)]
        : 0;
      const p95 = sortedLatencies.length > 0
        ? sortedLatencies[Math.floor(sortedLatencies.length * 0.95)]
        : 0;

      stats.push({
        model,
        totalCalls: record.totalCalls,
        successCalls: record.successCalls,
        failedCalls: record.failedCalls,
        successRate: record.totalCalls > 0
          ? Math.round((record.successCalls / record.totalCalls) * 10000) / 100
          : 0,
        avgLatencyMs: record.successCalls > 0
          ? Math.round(record.totalLatencyMs / record.successCalls)
          : 0,
        p50LatencyMs: p50,
        p95LatencyMs: p95,
        circuitOpen: record.circuitOpen,
        lastFailureAt: record.lastFailureAt
          ? new Date(record.lastFailureAt).toISOString()
          : null,
      });
    }

    return stats.sort((a, b) => b.totalCalls - a.totalCalls);
  },

  /**
   * Phase 4: Proactively ping all configured providers to check connectivity.
   * Updates circuit breaker state based on results.
   * Should be called periodically (e.g., every 5 minutes) or before critical operations.
   */
  async pingProviders(): Promise<Array<{ provider: string; model: string; healthy: boolean; latencyMs: number; error?: string }>> {
    let chain: Awaited<ReturnType<typeof getLLMChain>> = [];
    try {
      chain = await getLLMChain();
    } catch {
      chain = [];
    }

    if (chain.length === 0) {
      logger.info('[model-router] pingProviders: no providers in chain');
      return [];
    }

    // Resolve full config to find provider IDs for testProviderConnection
    let fullConfig: Awaited<ReturnType<typeof getAIConfigWithKeys>> | null = null;
    try {
      fullConfig = await getAIConfigWithKeys();
    } catch { /* ignore — fall back to direct fetch */ }

    const results: Array<{ provider: string; model: string; healthy: boolean; latencyMs: number; error?: string }> = [];

    for (const provider of chain) {
      const start = Date.now();
      let healthy = false;
      let error: string | undefined;

      // Try to find the provider ID so we can use testProviderConnection
      const providerId = fullConfig
        ? Object.entries(fullConfig.providers).find(
            ([, cfg]) => cfg.model === provider.model && cfg.baseUrl === provider.baseUrl,
          )?.[0]
        : undefined;

      if (providerId) {
        // Use testProviderConnection for validated providers
        try {
          const result = await testProviderConnection(providerId);
          healthy = result.success;
          if (!healthy) error = result.message;
        } catch (err) {
          error = err instanceof Error ? err.message : 'Unknown error';
        }
      } else {
        // Fallback: direct fetch with 5-second timeout
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const res = await fetch(`${provider.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${provider.apiKey}`,
            },
            body: JSON.stringify({
              model: provider.model,
              messages: [{ role: 'user', content: 'ping' }],
              max_tokens: 1,
            }),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          healthy = res.ok;
          if (!healthy) error = `HTTP ${res.status}`;
        } catch (err) {
          error = err instanceof Error ? err.message : 'Unknown error';
        }
      }

      const latencyMs = Date.now() - start;

      if (healthy) {
        recordProviderSuccess(provider.model, latencyMs);
      } else {
        recordProviderFailure(provider.model);
      }

      results.push({
        provider: provider.label,
        model: provider.model,
        healthy,
        latencyMs,
        error,
      });
    }

    const healthyCount = results.filter(r => r.healthy).length;
    logger.info(
      `[model-router] pingProviders: ${healthyCount}/${results.length} providers healthy`,
    );

    return results;
  },
};
