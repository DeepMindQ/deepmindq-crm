/**
 * Model Router — Intelligent LLM model selection with circuit breaker.
 *
 * Routes AI requests to the best model based on:
 *   1. Task type classification (analytical, creative, structured, conversational)
 *   2. Provider health (circuit breaker pattern — tracks failures per provider)
 *   3. Cost optimization (prefer cheaper models for simple tasks)
 *   4. Latency targets (use faster models for real-time features)
 *   5. Quality requirements (use premium models for critical analysis)
 *
 * Circuit Breaker States:
 *   - CLOSED: Provider is healthy, route normally
 *   - OPEN: Provider has failed too many times, skip it
 *   - HALF_OPEN: Testing if provider recovered (allow 1 probe request)
 *
 * The ESLint governance rule (no-ungoverned-llm.mjs) permits this file
 * to import callLLM directly because it IS the routing layer.
 */

import { getLLMChain } from '@/lib/ai-config';
import { logger } from '@/lib/logger';

// ─── Task Types ───────────────────────────────────────────────────────

export type TaskType =
  | 'analytical' // Complex reasoning, data analysis, insight generation
  | 'creative' // Content generation, outreach messages, narratives
  | 'structured' // JSON extraction, data parsing, classification
  | 'conversational' // Chat responses, Q&A, advisory
  | 'summarization' // Executive summaries, briefing generation
  | 'classification'; // Signal classification, priority scoring

// ─── Circuit Breaker ──────────────────────────────────────────────────

interface CircuitState {
  state: 'closed' | 'open' | 'half_open';
  failureCount: number;
  successCount: number;
  lastFailureAt: number;
  lastSuccessAt: number;
  openUntil: number; // timestamp when circuit transitions to half_open
}

const FAILURE_THRESHOLD = 5; // failures before opening circuit
const RECOVERY_TIMEOUT_MS = 60_000; // 1 minute before trying half_open
const HALF_OPEN_MAX_PROBES = 1; // only 1 request in half_open

const circuitStates = new Map<string, CircuitState>();

function getCircuit(providerLabel: string): CircuitState {
  let circuit = circuitStates.get(providerLabel);
  if (!circuit) {
    circuit = {
      state: 'closed',
      failureCount: 0,
      successCount: 0,
      lastFailureAt: 0,
      lastSuccessAt: 0,
      openUntil: 0,
    };
    circuitStates.set(providerLabel, circuit);
  }
  return circuit;
}

/**
 * Check if a provider's circuit allows requests.
 */
export function isProviderAvailable(providerLabel: string): boolean {
  const circuit = getCircuit(providerLabel);

  switch (circuit.state) {
    case 'closed':
      return true;
    case 'open':
      // Check if recovery timeout has elapsed
      if (Date.now() >= circuit.openUntil) {
        circuit.state = 'half_open';
        circuit.successCount = 0; // reset probe counter
        return true;
      }
      return false;
    case 'half_open':
      // Allow only 1 probe request
      return circuit.successCount < HALF_OPEN_MAX_PROBES;
    default:
      return true;
  }
}

/**
 * Record a provider success (for circuit breaker).
 */
export function recordSuccess(providerLabel: string): void {
  const circuit = getCircuit(providerLabel);

  if (circuit.state === 'half_open') {
    // Probe succeeded — close the circuit
    circuit.state = 'closed';
    circuit.failureCount = 0;
    logger.info(`[MODEL-ROUTER] Circuit CLOSED for "${providerLabel}" (probe succeeded)`);
  }

  circuit.successCount++;
  circuit.lastSuccessAt = Date.now();
  // Decay failure count on success (gradual recovery)
  circuit.failureCount = Math.max(0, circuit.failureCount - 1);
}

/**
 * Record a provider failure (for circuit breaker).
 */
export function recordFailure(providerLabel: string): void {
  const circuit = getCircuit(providerLabel);

  circuit.failureCount++;
  circuit.lastFailureAt = Date.now();

  if (circuit.state === 'half_open') {
    // Probe failed — reopen circuit
    circuit.state = 'open';
    circuit.openUntil = Date.now() + RECOVERY_TIMEOUT_MS;
    logger.warn(`[MODEL-ROUTER] Circuit RE-OPENED for "${providerLabel}" (probe failed)`);
  } else if (circuit.failureCount >= FAILURE_THRESHOLD) {
    circuit.state = 'open';
    circuit.openUntil = Date.now() + RECOVERY_TIMEOUT_MS;
    logger.warn(
      `[MODEL-ROUTER] Circuit OPENED for "${providerLabel}" (${circuit.failureCount} failures)`,
    );
  }
}

// ─── Model Selection Strategy ──────────────────────────────────────────

interface ModelRecommendation {
  providerLabel: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  reasoning: string;
}

/**
 * Task-to-model affinity matrix.
 * Maps each task type to a priority list of preferred providers.
 * Higher index = higher preference for that task type.
 */
const TASK_AFFINITY: Record<TaskType, string[]> = {
  analytical: ['Anthropic', 'OpenAI', 'Gemini'], // Claude excels at analysis
  creative: ['Anthropic', 'OpenAI', 'Gemini'], // Claude for nuanced writing
  structured: ['OpenAI', 'Gemini', 'Anthropic'], // GPT for JSON extraction
  conversational: ['OpenAI', 'Anthropic', 'Gemini'],
  summarization: ['Anthropic', 'OpenAI', 'Gemini'],
  classification: ['Gemini', 'OpenAI', 'Anthropic'], // Fast + cheap
};

/**
 * Classify the task type from system/user prompts.
 */
export function classifyTask(systemPrompt: string, userPrompt: string): TaskType {
  const combined = (systemPrompt + ' ' + userPrompt).toLowerCase();

  if (
    combined.includes('json') ||
    combined.includes('extract') ||
    combined.includes('parse') ||
    combined.includes('classify') ||
    combined.includes('categorize') ||
    combined.includes('structured output')
  ) {
    if (
      combined.includes('classify') ||
      combined.includes('categorize') ||
      combined.includes('priority')
    ) {
      return 'classification';
    }
    return 'structured';
  }

  if (
    combined.includes('summarize') ||
    combined.includes('brief') ||
    combined.includes('executive summary') ||
    combined.includes('tldr')
  ) {
    return 'summarization';
  }

  if (
    combined.includes('analyze') ||
    combined.includes('reason') ||
    combined.includes('insight') ||
    combined.includes('intelligence') ||
    combined.includes('assess')
  ) {
    return 'analytical';
  }

  if (
    combined.includes('write') ||
    combined.includes('draft') ||
    combined.includes('generate message') ||
    combined.includes('outreach') ||
    combined.includes('engagement') ||
    combined.includes('narrative')
  ) {
    return 'creative';
  }

  return 'conversational';
}

/**
 * Select the best available provider/model for a given task.
 * Applies circuit breaker, task affinity, and cost optimization.
 */
export async function selectModel(taskType: TaskType): Promise<ModelRecommendation | null> {
  const chain = await getLLMChain();
  if (!chain || chain.length === 0) {
    logger.info('[MODEL-ROUTER] No external providers — using Z.ai SDK fallback');
    return null;
  }

  // Get affinity list for this task type
  const affinityList = TASK_AFFINITY[taskType] || TASK_AFFINITY.conversational;

  // Sort chain by affinity (most preferred first) + circuit breaker health
  const ranked = chain
    .filter((p) => isProviderAvailable(p.label))
    .sort((a, b) => {
      const aIdx = affinityList.indexOf(a.label);
      const bIdx = affinityList.indexOf(b.label);
      // Unknown providers go to end
      const aRank = aIdx === -1 ? 999 : aIdx;
      const bRank = bIdx === -1 ? 999 : bIdx;
      return aRank - bRank;
    });

  if (ranked.length === 0) {
    logger.warn(
      `[MODEL-ROUTER] All providers have open circuits for task="${taskType}" — falling back to Z.ai SDK`,
    );
    return null;
  }

  const selected = ranked[0];
  return {
    providerLabel: selected.label,
    model: selected.model,
    baseUrl: selected.baseUrl,
    apiKey: selected.apiKey,
    reasoning: `Selected ${selected.label} (${selected.model}) for task="${taskType}" based on affinity ranking and circuit breaker health.`,
  };
}

// ─── Performance Monitoring ───────────────────────────────────────────

interface ProviderPerformance {
  provider: string;
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
  circuitState: string;
  failureRate: number;
  lastFailureAt: number | null;
  lastSuccessAt: number | null;
}

/**
 * Get performance statistics for all providers.
 */
export function getPerformanceStats(): ProviderPerformance[] {
  const stats: ProviderPerformance[] = [];

  for (const [label, circuit] of circuitStates) {
    const total = circuit.successCount + circuit.failureCount;
    stats.push({
      provider: label,
      totalCalls: total,
      successCalls: circuit.successCount,
      failedCalls: circuit.failureCount,
      circuitState: circuit.state,
      failureRate: total > 0 ? circuit.failureCount / total : 0,
      lastFailureAt: circuit.lastFailureAt > 0 ? circuit.lastFailureAt : null,
      lastSuccessAt: circuit.lastSuccessAt > 0 ? circuit.lastSuccessAt : null,
    });
  }

  return stats.sort((a, b) => b.totalCalls - a.totalCalls);
}

/**
 * Reset a provider's circuit breaker. Useful for admin override.
 */
export function resetCircuit(providerLabel: string): void {
  circuitStates.delete(providerLabel);
  logger.info(`[MODEL-ROUTER] Circuit reset for "${providerLabel}"`);
}

/**
 * Reset all circuit breakers.
 */
export function resetAllCircuits(): void {
  circuitStates.clear();
  logger.info('[MODEL-ROUTER] All circuits reset');
}

// ─── Backward-Compatible Static Interface ─────────────────────────────

export class ModelRouter {
  /**
   * Get performance stats for all providers.
   * Legacy interface used by /api/health/ai endpoint.
   */
  static getPerformanceStats(): Array<{
    provider: string;
    totalCalls: number;
    failedCalls: number;
    circuitOpen: boolean;
  }> {
    return getPerformanceStats().map((p) => ({
      provider: p.provider,
      totalCalls: p.totalCalls,
      failedCalls: p.failedCalls,
      circuitOpen: p.circuitState === 'open',
    }));
  }
}
