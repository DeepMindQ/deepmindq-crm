/**
 * WI-18.4 Phase 4 — AI Cache Layer Integration
 *
 * Bridges the existing AICacheLayer (db-backed, SHA-256 keyed) with
 * arbitrary AI call functions. Non-throwing: cache failures never break
 * the underlying AI call.
 *
 * Usage:
 *   const result = await cachedAICall(
 *     systemPrompt, userPrompt, contextFingerprint,
 *     () => callMyLLM(systemPrompt, userPrompt),
 *     { ttlDays: 14 }
 *   );
 */

import { AICacheLayer } from '@/lib/ai-cache-layer';
import { logger } from '@/lib/logger';

/** Shape returned by cachedAICall — mirrors AICacheLayer.get() output. */
export interface CachedAIResponse {
  response: string;
  modelUsed: string;
  tier: string;
  tokensUsed: number;
  costUsd: number;
  cacheHit: boolean;
}

export interface CachedAICallOptions {
  /** Cache TTL in days (default: 7) */
  ttlDays?: number;
  /** Override model name stored in cache */
  modelUsed?: string;
  /** Override tier stored in cache */
  tier?: string;
}

/**
 * Execute an AI call with transparent caching.
 *
 * 1. Checks AICacheLayer.get() for a matching entry.
 * 2. On cache hit → returns cached response immediately.
 * 3. On cache miss → calls aiCallFn(), stores result via AICacheLayer.set(),
 *    then returns the fresh response.
 *
 * All cache operations are wrapped in try/catch so cache failures never
 * propagate to the caller — the AI call always succeeds independently.
 */
export async function cachedAICall(
  systemPrompt: string,
  userPrompt: string,
  contextFingerprint: string,
  aiCallFn: () => Promise<CachedAIResponse>,
  options?: CachedAICallOptions,
): Promise<CachedAIResponse> {
  const ttlDays = options?.ttlDays ?? 7;

  // --- Step 1: Check cache (non-throwing) ---
  try {
    const cached = await AICacheLayer.get(systemPrompt, userPrompt, contextFingerprint);
    if (cached) {
      return {
        ...cached,
        cacheHit: true,
      };
    }
  } catch (err) {
    logger.warn('[llm-cache-integration] Cache get failed, proceeding to AI call', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // --- Step 2: Execute the actual AI call ---
  const result = await aiCallFn();

  // --- Step 3: Store result in cache (non-throwing) ---
  try {
    await AICacheLayer.set(
      systemPrompt,
      userPrompt,
      contextFingerprint,
      result.response,
      options?.modelUsed ?? result.modelUsed,
      options?.tier ?? result.tier,
      result.tokensUsed,
      result.costUsd,
      ttlDays,
    );
  } catch (err) {
    logger.warn('[llm-cache-integration] Cache set failed, AI call succeeded', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    ...result,
    cacheHit: false,
  };
}
