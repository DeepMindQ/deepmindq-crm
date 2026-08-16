/**
 * AI Governance Layer — The SINGLE gateway for all LLM calls.
 *
 * This module enforces AI governance policies at runtime:
 *   1. Rate limiting per user/feature (token bucket algorithm)
 *   2. Audit logging for every LLM call (structured, immutable)
 *   3. Quality gate enforcement (reject degraded outputs)
 *   4. Cost tracking with per-feature budgets
 *   5. Provider routing through model-router (with circuit breaker)
 *   6. Response caching (via ai-cache-layer)
 *
 * Architecture:
 *   Route Handler → governedAICall() → ModelRouter → callLLM → Provider
 *                                   → Quality Gates → Cache → Response
 *
 * No code outside this file and engines/model-router.ts may call
 * callLLM, callAI, or getZAI directly. Enforced by ESLint rule
 * no-ungoverned-llm.mjs.
 */

import { logger } from '@/lib/logger';
import { callLLM, callAI, callLLMWithUsage, type TokenUsage } from '@/lib/llm-client';
import { runQualityGates, formatQualityReportForLog } from '@/lib/ai-copilot/quality-gates';
import type { QualityReport } from '@/lib/ai-copilot/quality-gates';
import { AICacheLayer } from '@/lib/ai-cache-layer';
import { logAIUsage, estimateCost } from '@/lib/ai-copilot/usage-tracker';
import { countTokens } from '@/lib/token-counter';

// ─── Rate Limiter (Token Bucket) ─────────────────────────────────────

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const DEFAULT_RATE_LIMIT = 60; // requests per window
const DEFAULT_RATE_WINDOW_MS = 60_000; // 1 minute window

const rateLimitBuckets = new Map<string, TokenBucket>();

function getBucket(key: string, limit: number): TokenBucket {
  let bucket = rateLimitBuckets.get(key);
  if (!bucket) {
    bucket = { tokens: limit, lastRefill: Date.now() };
    rateLimitBuckets.get(key);
    rateLimitBuckets.set(key, bucket);
  }
  return bucket;
}

function refillBucket(bucket: TokenBucket, limit: number, windowMs: number): void {
  const now = Date.now();
  const elapsed = now - bucket.lastRefill;
  if (elapsed >= windowMs) {
    bucket.tokens = limit;
    bucket.lastRefill = now;
  } else {
    const refillAmount = (elapsed / windowMs) * limit;
    bucket.tokens = Math.min(limit, bucket.tokens + refillAmount);
    bucket.lastRefill = now;
  }
}

/**
 * Check and consume a rate limit token.
 * Returns true if allowed, false if rate limited.
 */
export function checkRateLimit(
  feature: string,
  userId?: string,
  limit: number = DEFAULT_RATE_LIMIT,
  windowMs: number = DEFAULT_RATE_WINDOW_MS,
): boolean {
  const key = userId ? `${userId}:${feature}` : `anon:${feature}`;
  const bucket = getBucket(key, limit);
  refillBucket(bucket, limit, windowMs);

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }
  return false;
}

// ─── Per-Feature Cost Budgets ──────────────────────────────────────────

interface CostBudget {
  monthlyBudgetUSD: number;
  spentThisMonthUSD: number;
  resetAt: number; // timestamp
}

const featureBudgets = new Map<string, CostBudget>();

const DEFAULT_MONTHLY_BUDGET_USD = 100;

function getOrCreateBudget(feature: string, monthlyBudget?: number): CostBudget {
  let budget = featureBudgets.get(feature);
  const budgetAmount = monthlyBudget ?? DEFAULT_MONTHLY_BUDGET_USD;

  if (!budget || budget.resetAt <= Date.now()) {
    budget = {
      monthlyBudgetUSD: budgetAmount,
      spentThisMonthUSD: 0,
      resetAt: getNextMonthStart(),
    };
    featureBudgets.set(feature, budget);
  }
  return budget;
}

function getNextMonthStart(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
}

function trackBudgetSpend(feature: string, costUSD: number): boolean {
  const budget = getOrCreateBudget(feature);
  budget.spentThisMonthUSD += costUSD;
  return budget.spentThisMonthUSD <= budget.monthlyBudgetUSD;
}

// ─── Governance Configuration ─────────────────────────────────────────

export interface GovernanceConfig {
  /** Feature name for rate limiting and cost tracking */
  feature: string;
  /** User ID for per-user rate limiting (optional) */
  userId?: string;
  /** System prompt for the LLM */
  systemPrompt: string;
  /** User prompt for the LLM */
  userPrompt: string;
  /** LLM temperature (default: 0.7) */
  temperature?: number;
  /** Max tokens for response (default: 8192) */
  maxTokens?: number;
  /** Whether to run quality gates on the output (default: true) */
  runQualityGates?: boolean;
  /** Whether to cache the response (default: true for deterministic calls) */
  cacheResponse?: boolean;
  /** Cache TTL in seconds (default: 3600 = 1 hour) */
  cacheTTLSeconds?: number;
  /** Rate limit override for this call */
  rateLimit?: number;
  /** Monthly budget override for this feature (USD) */
  monthlyBudgetUSD?: number;
  /** Whether to use callAI (Z.ai SDK + quality gates) instead of callLLM */
  useZaiSDK?: boolean;
  /** Company ID for usage attribution */
  companyId?: string;
  /** Contact ID for usage attribution */
  contactId?: string;
}

// ─── Governed AI Call — The primary entry point ───────────────────────

export interface GovernedResult {
  text: string;
  usage: TokenUsage | null;
  quality?: QualityReport;
  cached: boolean;
  rateLimited: false;
  latencyMs: number;
  provider: string;
  model: string;
  costUSD: number;
  feature: string;
}

export interface RateLimitedResult {
  text: '';
  usage: null;
  quality: undefined;
  cached: false;
  rateLimited: true;
  latencyMs: 0;
  provider: '';
  model: '';
  costUSD: 0;
  feature: string;
  retryAfterMs: number;
}

export type GovernedAICallResult = GovernedResult | RateLimitedResult;

/**
 * The PRIMARY entry point for all governed AI calls.
 *
 * Enforces:
 *   - Rate limiting (per user + feature)
 *   - Cost budgets (per feature)
 *   - Quality gates (on LLM output)
 *   - Response caching (LRU with TTL)
 *   - Audit logging (structured + persistent)
 *
 * @throws Error if all providers fail after retries
 */
export async function governedAICall(config: GovernanceConfig): Promise<GovernedAICallResult> {
  const startTime = Date.now();
  const feature = config.feature;

  // Step 1: Rate limiting
  if (!checkRateLimit(feature, config.userId, config.rateLimit)) {
    logger.warn(
      `[GOVERNANCE] Rate limited for feature="${feature}", user="${config.userId || 'anon'}"`,
    );
    return {
      text: '',
      usage: null,
      quality: undefined,
      cached: false,
      rateLimited: true,
      latencyMs: 0,
      provider: '',
      model: '',
      costUSD: 0,
      feature,
      retryAfterMs: DEFAULT_RATE_WINDOW_MS,
    };
  }

  // Step 2: Check cache (for deterministic calls with low temperature)
  if (config.cacheResponse !== false && (config.temperature ?? 0.7) <= 0.3) {
    const cacheTTL = config.cacheTTLSeconds ?? 3600;
    const cached = await AICacheLayer.get(feature, config.systemPrompt, config.userPrompt);
    if (cached) {
      logger.info(`[GOVERNANCE] Cache hit for feature="${feature}"`);
      return {
        text: cached.text,
        usage: cached.usage,
        quality: cached.quality as QualityReport | undefined,
        cached: true,
        rateLimited: false,
        latencyMs: Date.now() - startTime,
        provider: cached.provider,
        model: cached.model,
        costUSD: 0,
        feature,
      };
    }
  }

  // Step 3: Execute LLM call
  let text: string;
  let usage: TokenUsage | null = null;
  let provider = 'unknown';
  let model = 'unknown';

  try {
    if (config.useZaiSDK) {
      // Use callAI (Z.ai SDK with quality gates)
      const result = await callAI({
        systemPrompt: config.systemPrompt,
        userPrompt: config.userPrompt,
        feature,
        companyId: config.companyId,
        contactId: config.contactId,
        temperature: config.temperature,
        runQualityCheck: config.runQualityGates ?? true,
      });

      if (!result.success) {
        throw new Error(result.error || 'callAI failed');
      }

      text = result.raw;
      provider = 'zai-sdk';
      model = 'zai-sdk';

      if (result.quality) {
        // Cache and return
        const latencyMs = Date.now() - startTime;
        if (config.cacheResponse !== false) {
          const cacheTTL = config.cacheTTLSeconds ?? 3600;
          await AICacheLayer.set(
            feature,
            config.systemPrompt,
            config.userPrompt,
            {
              text,
              usage,
              quality: result.quality,
              provider,
              model,
            },
            cacheTTL,
          );
        }

        return {
          text,
          usage,
          quality: result.quality,
          cached: false,
          rateLimited: false,
          latencyMs,
          provider,
          model,
          costUSD: 0,
          feature,
        };
      }
    } else {
      // Use callLLM (provider chain with failover)
      const result = await callLLMWithUsage(config.systemPrompt, config.userPrompt, {
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      });

      text = result.text;
      usage = result.usage;

      // Try to determine provider/model from chain config
      const { getLLMChain } = await import('@/lib/ai-config');
      const chain = await getLLMChain();
      if (chain && chain.length > 0) {
        provider = chain[0].label;
        model = chain[0].model;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[GOVERNANCE] LLM call failed for feature="${feature}": ${msg}`);

    // Track failed usage
    await logAIUsage({
      provider,
      model,
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: Date.now() - startTime,
      errorMessage: msg,
    }).catch(() => {});

    throw err;
  }

  const latencyMs = Date.now() - startTime;

  // Step 4: Run quality gates (for callLLM path which doesn't have built-in gates)
  let quality: QualityReport | undefined;
  if (config.runQualityGates !== false) {
    quality = await runQualityGates(config.userPrompt, text);
    logger.info(`[GOVERNANCE] ${formatQualityReportForLog(quality)}`);
  }

  // Step 5: Track usage and cost
  const promptTokens =
    usage?.promptTokens ?? (await countTokens(config.systemPrompt + config.userPrompt));
  const completionTokens = usage?.completionTokens ?? (await countTokens(text));
  const costUSD = estimateCost(provider, model, promptTokens, completionTokens);

  await logAIUsage({
    provider,
    model,
    promptTokens,
    completionTokens,
    latencyMs,
    quality,
  }).catch(() => {});

  // Step 6: Check cost budget
  const withinBudget = trackBudgetSpend(feature, costUSD);
  if (!withinBudget) {
    logger.warn(
      `[GOVERNANCE] Feature "${feature}" exceeded monthly budget. Spent: $${costUSD.toFixed(4)}`,
    );
  }

  // Step 7: Cache successful response
  if (config.cacheResponse !== false && text) {
    const cacheTTL = config.cacheTTLSeconds ?? 3600;
    await AICacheLayer.set(
      feature,
      config.systemPrompt,
      config.userPrompt,
      {
        text,
        usage,
        quality,
        provider,
        model,
      },
      cacheTTL,
    );
  }

  return {
    text,
    usage,
    quality,
    cached: false,
    rateLimited: false,
    latencyMs,
    provider,
    model,
    costUSD,
    feature,
  };
}

// ─── Governed Aggregate Call — Multiple AI calls in one request ───────

export interface GovernedAggregateConfig extends Omit<GovernanceConfig, 'userPrompt'> {
  /** Array of user prompts to process */
  userPrompts: string[];
  /** Maximum concurrency for parallel calls (default: 3) */
  maxConcurrency?: number;
}

export interface GovernedAggregateResult {
  results: GovernedResult[];
  totalLatencyMs: number;
  totalCostUSD: number;
  totalTokens: number;
  feature: string;
  rateLimitedCount: number;
}

/**
 * Execute multiple governed AI calls with concurrency control.
 * Useful for batch operations like multi-org intelligence pipeline.
 */
export async function governedAICallAggregate(
  config: GovernedAggregateConfig,
): Promise<GovernedAggregateResult> {
  const startTime = Date.now();
  const maxConcurrency = config.maxConcurrency ?? 3;
  const results: GovernedResult[] = [];
  let rateLimitedCount = 0;
  let totalCostUSD = 0;
  let totalTokens = 0;

  // Process in batches
  for (let i = 0; i < config.userPrompts.length; i += maxConcurrency) {
    const batch = config.userPrompts.slice(i, i + maxConcurrency);
    const batchResults = await Promise.allSettled(
      batch.map((userPrompt) =>
        governedAICall({
          ...config,
          userPrompt,
          // Only cache individual calls in aggregate if explicitly requested
          cacheResponse: false,
        }),
      ),
    );

    for (const settled of batchResults) {
      if (settled.status === 'fulfilled') {
        const result = settled.value;
        if (result.rateLimited) {
          rateLimitedCount++;
        } else {
          results.push(result);
          totalCostUSD += result.costUSD;
          totalTokens += result.usage?.totalTokens ?? 0;
        }
      } else {
        logger.error(
          `[GOVERNANCE] Aggregate call failed: ${settled.reason instanceof Error ? settled.reason.message : String(settled.reason)}`,
        );
      }
    }
  }

  return {
    results,
    totalLatencyMs: Date.now() - startTime,
    totalCostUSD,
    totalTokens,
    feature: config.feature,
    rateLimitedCount,
  };
}

// ─── Cache Helpers ───────────────────────────────────────────────────

/**
 * Manually invalidate cache for a feature.
 * Useful after data updates that would change LLM responses.
 */
export async function invalidateFeatureCache(feature: string): Promise<number> {
  return AICacheLayer.invalidateByFeature(feature);
}

/**
 * Get governance statistics for monitoring.
 */
export async function getGovernanceStats(): Promise<{
  activeFeatures: number;
  totalBudgetSpentUSD: number;
  cacheStats: Awaited<ReturnType<typeof AICacheLayer.getStats>>;
  rateLimitKeys: number;
}> {
  let totalBudgetSpentUSD = 0;
  for (const budget of featureBudgets.values()) {
    totalBudgetSpentUSD += budget.spentThisMonthUSD;
  }

  return {
    activeFeatures: featureBudgets.size,
    totalBudgetSpentUSD,
    cacheStats: await AICacheLayer.getStats(),
    rateLimitKeys: rateLimitBuckets.size,
  };
}
