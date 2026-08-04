/**
 * WI-18.4 Phase 4 — AI Latency Budget Configuration (Track C3)
 *
 * Defines latency budget constants for all AI operations in DeepMindQ.
 * These budgets are used by observability tooling to detect when AI calls
 * exceed acceptable response times and trigger alerts or fallback behavior.
 */

// ─── Latency Budget Constants (in milliseconds) ──────────────────────────

/** Retrieval: vector search / hybrid retrieval calls */
const RETRIEVAL_BUDGET_MS = 500;

/** Embedding: text embedding generation */
const EMBEDDING_BUDGET_MS = 1000;

/** Reasoning: single-turn LLM reasoning call */
const REASONING_BUDGET_MS = 30000;

/** Chat response: time-to-first-token for streaming chat */
const CHAT_FIRST_TOKEN_BUDGET_MS = 5000;

/** Full response: complete non-streaming AI response */
const FULL_RESPONSE_BUDGET_MS = 60000;

/** Batch processing: background batch AI operations */
const BATCH_PROCESSING_BUDGET_MS = 300000;

// ─── Operation Key Type ───────────────────────────────────────────────────

export type AIOperationKey =
  | 'retrieval'
  | 'embedding'
  | 'reasoning'
  | 'chat_first_token'
  | 'full_response'
  | 'batch_processing';

// ─── Latency Budget Result ────────────────────────────────────────────────

export interface LatencyBudgetResult {
  withinBudget: boolean;
  budget: number;
  elapsed: number;
  operation: string;
  overtimeMs: number;
}

// ─── AI Latency Budgets Object ─────────────────────────────────────────────

/**
 * Central registry of all AI operation latency budgets.
 * Each key maps to its maximum acceptable latency in milliseconds.
 */
export const AI_LATENCY_BUDGETS: Record<AIOperationKey, number> = {
  retrieval: RETRIEVAL_BUDGET_MS,
  embedding: EMBEDDING_BUDGET_MS,
  reasoning: REASONING_BUDGET_MS,
  chat_first_token: CHAT_FIRST_TOKEN_BUDGET_MS,
  full_response: FULL_RESPONSE_BUDGET_MS,
  batch_processing: BATCH_PROCESSING_BUDGET_MS,
} as const;

// ─── Budget Check Function ────────────────────────────────────────────────

/**
 * Check whether an AI operation completed within its latency budget.
 *
 * @param operation - The AI operation key (must exist in AI_LATENCY_BUDGETS)
 * @param elapsedMs - The actual elapsed time in milliseconds
 * @returns An object with budget check results
 *
 * @example
 * ```ts
 * const start = performance.now();
 * const result = await llmCall(prompt);
 * const elapsed = performance.now() - start;
 * const check = checkLatencyBudget('reasoning', elapsed);
 * if (!check.withinBudget) {
 *   // trigger alert or fallback
 * }
 * ```
 */
export function checkLatencyBudget(
  operation: AIOperationKey,
  elapsedMs: number,
): LatencyBudgetResult {
  const budget = AI_LATENCY_BUDGETS[operation];
  const withinBudget = elapsedMs <= budget;
  const overtimeMs = withinBudget ? 0 : elapsedMs - budget;

  if (!withinBudget) {
    console.warn(
      `[AI-LATENCY] Budget exceeded for "${operation}": ${elapsedMs.toFixed(0)}ms (budget: ${budget}ms, overtime: ${overtimeMs.toFixed(0)}ms)`,
    );
  }

  return {
    withinBudget,
    budget,
    elapsed: elapsedMs,
    operation,
    overtimeMs,
  };
}
