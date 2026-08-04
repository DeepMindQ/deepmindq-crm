/**
 * WI-18.5 Phase 5 — AI Request Tracing & Cost Control
 *
 * Production AI observability layer:
 *   - Request tracing with correlation IDs
 *   - Prompt version tracking
 *   - Token usage tracking and cost estimation
 *   - Response quality metrics
 *   - Failure fallback monitoring
 *
 * Maps to existing AIUsageLog Prisma model:
 *   feature → capability, provider → provider, model → model
 *   promptTokens → input, completionTokens → output
 *   estimatedCost → cost, durationMs → latency, status → success/failed
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// ── Types ──────────────────────────────────────────────────────

export interface AITraceEvent {
  traceId: string;
  userId: string;
  capability: string;         // research, reasoning, fusion, recommendation, etc.
  provider: string;           // groq, gemini, nvidia, fireworks
  model: string;              // llama-3.3-70b, gemini-2.0-flash, etc.
  promptVersion: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
  success: boolean;
  errorMessage?: string;
  extraMetadata?: Record<string, unknown>;
}

export interface AICostReport {
  period: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
  avgCostPerRequest: number;
  avgTokensPerRequest: number;
  avgLatencyMs: number;
  byCapability: Record<string, {
    requests: number;
    costUsd: number;
    avgLatencyMs: number;
  }>;
  byModel: Record<string, {
    requests: number;
    costUsd: number;
    totalTokens: number;
  }>;
}

// ── Cost Estimation ───────────────────────────────────────────

const MODEL_COSTS: Record<string, { inputPerM: number; outputPerM: number }> = {
  'groq/llama-3.3-70b': { inputPerM: 0.59, outputPerM: 0.79 },
  'groq/llama-3.1-8b': { inputPerM: 0.05, outputPerM: 0.08 },
  'groq/mixtral-8x7b': { inputPerM: 0.24, outputPerM: 0.24 },
  'gemini/gemini-2.0-flash': { inputPerM: 0.10, outputPerM: 0.40 },
  'gemini/gemini-1.5-flash': { inputPerM: 0.075, outputPerM: 0.30 },
  'nvidia/llama-3.1-nemotron-70b': { inputPerM: 0.50, outputPerM: 0.50 },
  'fireworks/llama-3.1-70b': { inputPerM: 0.50, outputPerM: 0.70 },
  'default': { inputPerM: 1.00, outputPerM: 2.00 },
};

/**
 * Estimate AI API cost based on model and token usage.
 */
export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const costs = MODEL_COSTS[model] || MODEL_COSTS['default'];
  return ((inputTokens / 1_000_000) * costs.inputPerM) +
         ((outputTokens / 1_000_000) * costs.outputPerM);
}

// ── Trace Recording ───────────────────────────────────────────

/**
 * Record an AI trace event to the usage log.
 * Maps to the existing AIUsageLog Prisma model fields.
 * Non-blocking — failures are logged but never throw.
 */
export async function recordAITrace(event: AITraceEvent): Promise<void> {
  try {
    await db.aIUsageLog.create({
      data: {
        userId: event.userId,
        feature: event.capability,
        provider: event.provider,
        model: event.model,
        promptTokens: event.inputTokens,
        completionTokens: event.outputTokens,
        totalTokens: event.totalTokens,
        estimatedCost: event.costUsd,
        durationMs: event.latencyMs,
        status: event.success ? 'success' : 'failed',
      },
    });

    if (!event.success && event.errorMessage) {
      logger.warn(`[AI-TRACE] Failed: ${event.traceId} — ${event.errorMessage}`);
    }
  } catch (err) {
    logger.error(`[AI-TRACE] Failed to record trace ${event.traceId}:`, { error: err });
  }
}

// ── Cost Reporting ─────────────────────────────────────────────

/**
 * Generate AI cost report for a time window.
 * @param windowHours - lookback window in hours (default: 24)
 */
export async function getAICostReport(windowHours: number = 24): Promise<AICostReport> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  try {
    const logs = await db.aIUsageLog.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
    });

    const totalRequests = logs.length;
    const successfulRequests = logs.filter(l => l.status === 'success').length;
    const failedRequests = logs.filter(l => l.status === 'failed').length;

    const totalInputTokens = logs.reduce((s, l) => s + l.promptTokens, 0);
    const totalOutputTokens = logs.reduce((s, l) => s + l.completionTokens, 0);
    const totalTokens = logs.reduce((s, l) => s + l.totalTokens, 0);
    const totalCost = logs.reduce((s, l) => s + l.estimatedCost, 0);
    const totalLatency = logs.reduce((s, l) => s + l.durationMs, 0);

    // By capability (feature) breakdown
    const byCapability: AICostReport['byCapability'] = {};
    for (const log of logs) {
      const cap = log.feature || 'unknown';
      if (!byCapability[cap]) {
        byCapability[cap] = { requests: 0, costUsd: 0, avgLatencyMs: 0 };
      }
      byCapability[cap].requests++;
      byCapability[cap].costUsd += log.estimatedCost;
    }
    // Calculate averages
    for (const cap of Object.keys(byCapability)) {
      const capLogs = logs.filter(l => l.feature === cap);
      byCapability[cap].avgLatencyMs = capLogs.length > 0
        ? Math.round(capLogs.reduce((s, l) => s + l.durationMs, 0) / capLogs.length) : 0;
    }

    // By model breakdown
    const byModel: AICostReport['byModel'] = {};
    for (const log of logs) {
      const model = log.model || 'unknown';
      if (!byModel[model]) {
        byModel[model] = { requests: 0, costUsd: 0, totalTokens: 0 };
      }
      byModel[model].requests++;
      byModel[model].costUsd += log.estimatedCost;
      byModel[model].totalTokens += log.totalTokens;
    }

    return {
      period: `${windowHours}h`,
      totalRequests,
      successfulRequests,
      failedRequests,
      totalTokens,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      totalCostUsd: Math.round(totalCost * 10000) / 10000,
      avgCostPerRequest: totalRequests > 0 ? Math.round((totalCost / totalRequests) * 10000) / 10000 : 0,
      avgTokensPerRequest: totalRequests > 0 ? Math.round(totalTokens / totalRequests) : 0,
      avgLatencyMs: totalRequests > 0 ? Math.round(totalLatency / totalRequests) : 0,
      byCapability,
      byModel,
    };
  } catch (err) {
    logger.error(`[AI-COST] Failed to generate cost report:`, { error: err });
    return {
      period: `${windowHours}h`,
      totalRequests: 0, successfulRequests: 0, failedRequests: 0,
      totalTokens: 0, inputTokens: 0, outputTokens: 0,
      totalCostUsd: 0, avgCostPerRequest: 0, avgTokensPerRequest: 0,
      avgLatencyMs: 0, byCapability: {}, byModel: {},
    };
  }
}

// ── Prompt Versioning ───────────────────────────────────────────

/**
 * Generate deterministic version hash for a prompt.
 */
export function versionPrompt(systemPrompt: string, userTemplate: string): string {
  const combined = `${systemPrompt}||${userTemplate}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash + combined.charCodeAt(i)) | 0;
  }
  return `v${Math.abs(hash).toString(36).slice(0, 8)}`;
}

/**
 * Active prompt versions registry for tracking which versions
 * are in production use.
 */
export const activePromptVersions: Map<string, {
  version: string;
  capability: string;
  model: string;
  activatedAt: number;
  description: string;
}> = new Map();

/**
 * Register an active prompt version.
 */
export function registerPromptVersion(
  key: string,
  capability: string,
  model: string,
  description: string,
  version?: string,
): string {
  const ver = version || `auto_${Date.now().toString(36)}`;
  activePromptVersions.set(key, {
    version: ver,
    capability,
    model,
    activatedAt: Date.now(),
    description,
  });
  return ver;
}

/**
 * Get all active prompt versions.
 */
export function getActivePromptVersions(): Array<{
  key: string;
  version: string;
  capability: string;
  model: string;
  activatedAt: number;
  description: string;
}> {
  return [...activePromptVersions.entries()].map(([key, val]) => ({ key, ...val }));
}
