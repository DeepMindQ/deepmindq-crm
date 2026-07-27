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

import { callLLM } from '@/lib/zai-helpers';
import { getLLMChain, getProviderConfig } from '@/lib/ai-config';
import { logger } from '@/lib/logger';
import { logAIUsage, estimateCost } from '@/lib/ai-copilot/usage-tracker';
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

/**
 * Rough token estimate — 4 chars/token average for English text.
 * Used for cost estimation when the provider doesn't return token counts.
 */
function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
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
        const promptTokens = estimateTokens(params.systemPrompt + params.userPrompt);
        const completionTokens = estimateTokens(text);
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

      try {
        logger.info(`[model-router] trying provider: ${provider.label}`);
        // Use callLLM with this provider's config — it handles Gemini variants
        // and provider-specific quirks. We pass system+user prompts and let
        // zai-helpers manage the actual HTTP call.
        const text = await callLLM(params.systemPrompt, params.userPrompt);

        if (!text || text.trim().length === 0) {
          throw new Error('Empty response from provider');
        }

        const promptTokens = estimateTokens(params.systemPrompt + params.userPrompt);
        const completionTokens = estimateTokens(text);
        const cost = estimateCost(provider.model, promptTokens, completionTokens);
        const durationMs = Date.now() - startedAt;

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

    // Sort preferred by their position in preferredLabels (priority order)
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
      return aIdx - bIdx;
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
};
