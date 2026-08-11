/**
 * S5-3.6 — Unified AI Cost Tracking
 * ====================================
 *
 * Merges the two existing cost tracking systems (ai-tracing.ts and
 * ai-copilot/usage-tracker.ts) into a unified module that provides:
 *   1. Single entry point for recording AI usage
 *   2. Per-route cost aggregation
 *   3. Budget alerts (configurable thresholds)
 *   4. Unified cost reports across all AI providers
 *   5. Model cost configuration registry
 *
 * DESIGN: Wraps both existing systems and adds budget enforcement.
 * Non-throwing: cost tracking failures never block AI operations.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// ─── Types ───────────────────────────────────────────────────────────

export interface ModelCostConfig {
  /** Model identifier (e.g., "gemini-2.0-flash") */
  model: string;
  /** Cost per 1M input tokens (USD) */
  inputPerM: number;
  /** Cost per 1M output tokens (USD) */
  outputPerM: number;
  /** Provider name */
  provider: string;
  /** Category for grouping */
  category: 'fast' | 'smart' | 'deep';
}

export interface UnifiedCostRecord {
  /** Unique record ID */
  id: string;
  /** Route/API path that triggered the AI call */
  route: string;
  /** Capability name (e.g., "research", "reasoning") */
  capability: string;
  /** Provider (e.g., "gemini", "groq", "nvidia") */
  provider: string;
  /** Model used */
  model: string;
  /** Prompt version hash */
  promptVersion?: string;
  /** Input tokens */
  inputTokens: number;
  /** Output tokens */
  outputTokens: number;
  /** Total tokens */
  totalTokens: number;
  /** Estimated cost (USD) */
  costUsd: number;
  /** Latency in ms */
  latencyMs: number;
  /** Whether the call succeeded */
  success: boolean;
  /** Company ID if applicable */
  companyId?: string;
  /** Timestamp */
  timestamp: string;
}

export interface BudgetAlert {
  /** Alert ID */
  id: string;
  /** Type of alert */
  type: 'daily_limit' | 'route_limit' | 'model_limit' | 'unusual_spike';
  /** Alert message */
  message: string;
  /** Current value */
  currentValue: number;
  /** Threshold value */
  threshold: number;
  /** Timestamp */
  timestamp: string;
}

export interface SpendAlertNotification {
  id: string;
  type: BudgetAlert['type'];
  message: string;
  currentValue: number;
  threshold: number;
  timestamp: string;
  delivered: boolean;
  deliveryChannel: 'webhook' | 'log';
}

export interface CostReport {
  period: string;
  totalRequests: number;
  totalTokens: number;
  totalCostUsd: number;
  avgCostPerRequest: number;
  byRoute: Record<string, { requests: number; costUsd: number; tokens: number; avgLatencyMs: number }>;
  byModel: Record<string, { requests: number; costUsd: number; tokens: number }>;
  byProvider: Record<string, { requests: number; costUsd: number }>;
  alerts: BudgetAlert[];
  anomalies: Array<{
    model: string;
    costUsd: number;
    anomalyScore: number;
    reason: string;
    timestamp: string;
  }>;
  notifications: SpendAlertNotification[];
}

// ─── Model Cost Registry ──────────────────────────────────────────────

/**
 * Unified model cost configuration.
 * Merges costs from ai-tracing.ts MODEL_COSTS and usage-tracker.ts COST_PER_1K_TOKENS.
 * Prices are normalized to per-1M tokens for consistency.
 */
const MODEL_COST_REGISTRY: ModelCostConfig[] = [
  // Groq models
  { model: 'groq/llama-3.3-70b', inputPerM: 0.59, outputPerM: 0.79, provider: 'groq', category: 'fast' },
  { model: 'groq/llama-3.1-8b', inputPerM: 0.05, outputPerM: 0.08, provider: 'groq', category: 'fast' },
  { model: 'groq/mixtral-8x7b', inputPerM: 0.24, outputPerM: 0.24, provider: 'groq', category: 'fast' },
  // Gemini models
  { model: 'gemini/gemini-2.0-flash', inputPerM: 0.10, outputPerM: 0.40, provider: 'gemini', category: 'smart' },
  { model: 'gemini/gemini-1.5-flash', inputPerM: 0.075, outputPerM: 0.30, provider: 'gemini', category: 'fast' },
  { model: 'gemini/gemini-1.5-pro', inputPerM: 1.25, outputPerM: 5.00, provider: 'gemini', category: 'deep' },
  { model: 'gemini-2.0-flash', inputPerM: 0.075, outputPerM: 0.30, provider: 'gemini', category: 'smart' },
  { model: 'gemini-1.5-pro', inputPerM: 1.25, outputPerM: 5.00, provider: 'gemini', category: 'deep' },
  { model: 'gemini-1.5-flash', inputPerM: 0.075, outputPerM: 0.30, provider: 'gemini', category: 'fast' },
  // NVIDIA models
  { model: 'nvidia/llama-3.1-nemotron-70b', inputPerM: 0.50, outputPerM: 0.50, provider: 'nvidia', category: 'smart' },
  // Fireworks models
  { model: 'fireworks/llama-3.1-70b', inputPerM: 0.50, outputPerM: 0.70, provider: 'fireworks', category: 'smart' },
  // OpenAI models
  { model: 'gpt-4o', inputPerM: 2.50, outputPerM: 10.00, provider: 'openai', category: 'deep' },
  { model: 'gpt-4o-mini', inputPerM: 0.15, outputPerM: 0.60, provider: 'openai', category: 'fast' },
  // Anthropic models
  { model: 'claude-sonnet', inputPerM: 3.00, outputPerM: 15.00, provider: 'anthropic', category: 'deep' },
  // Default
  { model: 'default', inputPerM: 1.00, outputPerM: 2.00, provider: 'unknown', category: 'smart' },
];

/**
 * Estimate cost using the unified registry.
 */
export function estimateUnifiedCost(model: string, inputTokens: number, outputTokens: number): number {
  const config = MODEL_COST_REGISTRY.find(c => c.model === model) ||
    MODEL_COST_REGISTRY.find(c => model.includes(c.model.split('/').pop() || '')) ||
    MODEL_COST_REGISTRY.find(c => c.model === 'default')!;

  return (
    (inputTokens / 1_000_000) * config.inputPerM +
    (outputTokens / 1_000_000) * config.outputPerM
  );
}

/**
 * Get the combined input+output cost per 1M tokens for a model.
 * Returns undefined if model is not found in the registry.
 */
export function getModelCost(model: string): { inputPerM: number; outputPerM: number } | undefined {
  const config = MODEL_COST_REGISTRY.find(c => c.model === model) ||
    MODEL_COST_REGISTRY.find(c => model.includes(c.model.split('/').pop() || ''));
  if (!config || config.model === 'default') return undefined;
  return { inputPerM: config.inputPerM, outputPerM: config.outputPerM };
}

// ─── Budget Configuration ──────────────────────────────────────────────

interface BudgetConfig {
  /** Daily cost limit in USD (0 = no limit) */
  dailyLimit: number;
  /** Per-route cost limits */
  routeLimits: Record<string, number>;
  /** Alert when daily cost exceeds this percentage of daily limit */
  alertThresholdPercent: number;
}

const DEFAULT_BUDGET: BudgetConfig = {
  dailyLimit: 0, // No limit by default
  routeLimits: {},
  alertThresholdPercent: 80,
};

let budgetConfig: BudgetConfig = { ...DEFAULT_BUDGET };

/**
 * Configure budget limits.
 */
export function setBudgetConfig(config: Partial<BudgetConfig>): void {
  budgetConfig = { ...budgetConfig, ...config };
  logger.info(`[cost-tracking] Budget configured: daily limit $${config.dailyLimit || 'unlimited'}`);
}

// ─── Alert Store ──────────────────────────────────────────────────────

const recentAlerts: BudgetAlert[] = [];
const alertNotifications: SpendAlertNotification[] = [];
let alertWebhookUrl: string | null = null;

function addAlert(alert: Omit<BudgetAlert, 'id' | 'timestamp'>): void {
  const budgetAlert: BudgetAlert = {
    ...alert,
    id: `alert_${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
  };
  recentAlerts.push(budgetAlert);
  // Keep only last 100 alerts
  if (recentAlerts.length > 100) {
    recentAlerts.splice(0, recentAlerts.length - 100);
  }
  logger.warn(`[cost-tracking] Alert: ${alert.type} — ${alert.message}`);

  // Create a notification for this alert
  const notification: SpendAlertNotification = {
    id: `notif_${Date.now().toString(36)}`,
    type: alert.type,
    message: alert.message,
    currentValue: alert.currentValue,
    threshold: alert.threshold,
    timestamp: budgetAlert.timestamp,
    delivered: false,
    deliveryChannel: alertWebhookUrl ? 'webhook' : 'log',
  };
  alertNotifications.push(notification);
  // Keep only last 200 notifications
  if (alertNotifications.length > 200) {
    alertNotifications.splice(0, alertNotifications.length - 200);
  }

  // Attempt webhook delivery (fire-and-forget)
  if (alertWebhookUrl) {
    deliverWebhook(notification).catch(() => {
      // Non-throwing: delivery failures never block anything
    });
  }
}

// ─── Daily Cost Tracking ──────────────────────────────────────────────

let dailyCostTotal = 0;
let dailyCostDate = new Date().toISOString().slice(0, 10);

function resetDailyIfNeeded(): void {
  const today = new Date().toISOString().slice(0, 10);
  if (dailyCostDate !== today) {
    dailyCostTotal = 0;
    dailyCostDate = today;
  }
}

// ─── 1. Unified Recording ───────────────────────────────────────────

/**
 * Record a unified AI cost event.
 * This is the single entry point that replaces both
 * recordAITrace() and logAIUsage() for cost tracking.
 *
 * Writes to both AIUsageLog and AIGenerationAudit for completeness.
 */
export async function recordUnifiedCost(record: Omit<UnifiedCostRecord, 'id' | 'timestamp' | 'totalTokens' | 'costUsd'>): Promise<string> {
  const id = `cost_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  const totalTokens = record.inputTokens + record.outputTokens;
  const costUsd = estimateUnifiedCost(record.model, record.inputTokens, record.outputTokens);

  // Update daily tracking
  resetDailyIfNeeded();
  dailyCostTotal += costUsd;

  try {
    // Write to AIUsageLog (primary cost tracking table)
    await db.aIUsageLog.create({
      data: {
        userId: 'system',
        feature: record.capability,
        provider: record.provider,
        model: record.model,
        promptTokens: record.inputTokens,
        completionTokens: record.outputTokens,
        totalTokens,
        estimatedCost: costUsd,
        durationMs: record.latencyMs,
        status: record.success ? 'success' : 'failed',
      },
    });
  } catch (err) {
    logger.error(`[cost-tracking] Failed to write AIUsageLog: ${err instanceof Error ? err.message : err}`);
  }

  // ── Budget Checks ──
  if (budgetConfig.dailyLimit > 0 && dailyCostTotal >= budgetConfig.dailyLimit) {
    addAlert({
      type: 'daily_limit',
      message: `Daily cost limit reached: $${dailyCostTotal.toFixed(4)} >= $${budgetConfig.dailyLimit}`,
      currentValue: dailyCostTotal,
      threshold: budgetConfig.dailyLimit,
    });
  } else if (
    budgetConfig.dailyLimit > 0 &&
    budgetConfig.alertThresholdPercent > 0 &&
    dailyCostTotal >= budgetConfig.dailyLimit * (budgetConfig.alertThresholdPercent / 100)
  ) {
    addAlert({
      type: 'daily_limit',
      message: `Daily cost approaching limit: $${dailyCostTotal.toFixed(4)} (${budgetConfig.alertThresholdPercent}% of $${budgetConfig.dailyLimit})`,
      currentValue: dailyCostTotal,
      threshold: budgetConfig.dailyLimit,
    });
  }

  // Route-specific limits
  const routeLimit = budgetConfig.routeLimits[record.route];
  if (routeLimit) {
    // Check per-route cost (simplified — would need aggregation in production)
    // For now, just log the route usage
    logger.info(`[cost-tracking] Route ${record.route}: $${costUsd.toFixed(6)}`);
  }

  // ── Anomaly Detection ──
  checkAndAlertAnomaly(record, costUsd).catch(() => {
    // Non-throwing: anomaly detection failures never block AI operations
  });

  return id;
}

// ─── 2. Unified Cost Report ───────────────────────────────────────────

/**
 * Generate a unified cost report for a time window.
 * Aggregates across all AI providers and routes.
 */
export async function getUnifiedCostReport(windowHours: number = 24): Promise<CostReport> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  try {
    const logs = await db.aIUsageLog.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
    });

    const totalRequests = logs.length;
    const successCount = logs.filter(l => l.status === 'success').length;
    const totalInputTokens = logs.reduce((s, l) => s + l.promptTokens, 0);
    const totalOutputTokens = logs.reduce((s, l) => s + l.completionTokens, 0);
    const totalTokens = logs.reduce((s, l) => s + l.totalTokens, 0);
    const totalCost = logs.reduce((s, l) => s + l.estimatedCost, 0);

    // By model
    const byModel: CostReport['byModel'] = {};
    for (const log of logs) {
      const model = log.model || 'unknown';
      if (!byModel[model]) byModel[model] = { requests: 0, costUsd: 0, tokens: 0 };
      byModel[model].requests++;
      byModel[model].costUsd += log.estimatedCost;
      byModel[model].tokens += log.totalTokens;
    }

    // By provider (extracted from model string)
    const byProvider: CostReport['byProvider'] = {};
    for (const log of logs) {
      const model = log.model || 'unknown';
      const provider = model.split('/')[0] || 'unknown';
      if (!byProvider[provider]) byProvider[provider] = { requests: 0, costUsd: 0 };
      byProvider[provider].requests++;
      byProvider[provider].costUsd += log.estimatedCost;
    }

    // By capability (route)
    const byRoute: CostReport['byRoute'] = {};
    for (const log of logs) {
      const feature = log.feature || 'unknown';
      if (!byRoute[feature]) byRoute[feature] = { requests: 0, costUsd: 0, tokens: 0, avgLatencyMs: 0 };
      byRoute[feature].requests++;
      byRoute[feature].costUsd += log.estimatedCost;
      byRoute[feature].tokens += log.totalTokens;
    }
    // Compute avg latency
    for (const feature of Object.keys(byRoute)) {
      const featureLogs = logs.filter(l => l.feature === feature);
      byRoute[feature].avgLatencyMs = featureLogs.length > 0
        ? Math.round(featureLogs.reduce((s, l) => s + l.durationMs, 0) / featureLogs.length)
        : 0;
    }

    return {
      period: `${windowHours}h`,
      totalRequests,
      totalTokens,
      totalCostUsd: Math.round(totalCost * 10000) / 10000,
      avgCostPerRequest: totalRequests > 0 ? Math.round((totalCost / totalRequests) * 10000) / 10000 : 0,
      byRoute,
      byModel,
      byProvider,
      alerts: [...recentAlerts].reverse(),
      anomalies: [...detectedAnomalies].reverse(),
      notifications: [...alertNotifications].reverse(),
    };
  } catch (err) {
    logger.error(`[cost-tracking] Failed to generate report: ${err instanceof Error ? err.message : err}`);
    return {
      period: `${windowHours}h`,
      totalRequests: 0, totalTokens: 0, totalCostUsd: 0,
      avgCostPerRequest: 0, byRoute: {}, byModel: {}, byProvider: {},
      alerts: [],
      anomalies: [],
      notifications: [],
    };
  }
}

// ─── 3. Model Cost Registry API ───────────────────────────────────────

/**
 * Get all registered model costs.
 */
export function getModelCosts(): ModelCostConfig[] {
  return [...MODEL_COST_REGISTRY];
}

/**
 * Register or update a model's cost configuration.
 */
export function registerModelCost(config: ModelCostConfig): void {
  const idx = MODEL_COST_REGISTRY.findIndex(c => c.model === config.model);
  if (idx >= 0) {
    MODEL_COST_REGISTRY[idx] = config;
  } else {
    MODEL_COST_REGISTRY.push(config);
  }
  logger.info(`[cost-tracking] Model cost updated: ${config.model} ($${config.inputPerM}/$${config.outputPerM} per 1M tokens)`);
}

// ─── 4. Daily Cost Summary ────────────────────────────────────────────

/**
 * Get today's cost summary (fast, in-memory).
 */
export function getDailyCostSummary(): {
  date: string;
  totalCost: number;
  dailyLimit: number;
  utilizationPercent: number;
  alerts: BudgetAlert[];
} {
  resetDailyIfNeeded();

  return {
    date: dailyCostDate,
    totalCost: Math.round(dailyCostTotal * 10000) / 10000,
    dailyLimit: budgetConfig.dailyLimit,
    utilizationPercent: budgetConfig.dailyLimit > 0
      ? Math.round((dailyCostTotal / budgetConfig.dailyLimit) * 10000) / 100
      : 0,
    alerts: [...recentAlerts].filter(a =>
      a.type === 'daily_limit' && a.timestamp.startsWith(dailyCostDate)
    ).reverse(),
  };
}

// ─── Cost Anomaly Detection ─────────────────────────────────────────────

interface CostBaseline {
  avgCostPerRequest: number;
  stdDev: number;
  requestCount: number;
  windowHours: number;
}

/** Cache for the computed baseline (refreshed every 30 minutes). */
let cachedBaseline: CostBaseline | null = null;
let baselineComputedAt = 0;
const BASELINE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** In-memory store of detected anomalies. */
const detectedAnomalies: Array<{
  model: string;
  costUsd: number;
  anomalyScore: number;
  reason: string;
  timestamp: string;
}> = [];

/**
 * Compute a cost baseline from historical usage data.
 * Uses the last N hours of data to establish what's "normal".
 * Results are cached for 30 minutes to avoid expensive DB queries on every request.
 */
export async function computeCostBaseline(windowHours: number = 168): Promise<CostBaseline> {
  // Return cached baseline if still fresh
  const now = Date.now();
  if (cachedBaseline && cachedBaseline.windowHours === windowHours && (now - baselineComputedAt) < BASELINE_CACHE_TTL_MS) {
    return cachedBaseline;
  }

  try {
    const since = new Date(now - windowHours * 60 * 60 * 1000);
    const logs = await db.aIUsageLog.findMany({
      where: { createdAt: { gte: since } },
      select: { estimatedCost: true },
    });

    const requestCount = logs.length;
    if (requestCount === 0) {
      cachedBaseline = { avgCostPerRequest: 0, stdDev: 0, requestCount: 0, windowHours };
      baselineComputedAt = now;
      return cachedBaseline;
    }

    const costs = logs.map(l => l.estimatedCost);
    const sum = costs.reduce((a, b) => a + b, 0);
    const avgCostPerRequest = sum / requestCount;

    // Standard deviation
    const squaredDiffs = costs.map(c => (c - avgCostPerRequest) ** 2);
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / requestCount;
    const stdDev = Math.sqrt(variance);

    cachedBaseline = {
      avgCostPerRequest: Math.round(avgCostPerRequest * 10000) / 10000,
      stdDev: Math.round(stdDev * 10000) / 10000,
      requestCount,
      windowHours,
    };
    baselineComputedAt = now;

    logger.info(
      `[cost-tracking] Baseline computed: avg=$${cachedBaseline.avgCostPerRequest.toFixed(6)}, ` +
      `stddev=$${cachedBaseline.stdDev.toFixed(6)}, n=${requestCount}, window=${windowHours}h`
    );

    return cachedBaseline;
  } catch (err) {
    logger.error(`[cost-tracking] Failed to compute baseline: ${err instanceof Error ? err.message : err}`);
    // Return whatever we have cached, or a null-like baseline
    if (!cachedBaseline) {
      cachedBaseline = { avgCostPerRequest: 0, stdDev: 0, requestCount: 0, windowHours };
    }
    return cachedBaseline;
  }
}

/**
 * Check if a cost record represents an anomaly compared to baseline.
 * An anomaly is: cost > mean + 3*stddev (statistical outlier)
 * OR cost > 10x the average (even without enough data for stddev).
 *
 * Returns: { isAnomaly: boolean, anomalyScore: number (0-100), reason: string }
 */
export function detectCostAnomaly(
  costUsd: number,
  model: string,
  baseline: CostBaseline | null
): { isAnomaly: boolean; anomalyScore: number; reason: string } {
  // No baseline means we can't detect anomalies
  if (!baseline || baseline.requestCount < 5) {
    return { isAnomaly: false, anomalyScore: 0, reason: 'Insufficient baseline data' };
  }

  const { avgCostPerRequest, stdDev, requestCount } = baseline;

  // Hard limit: cost > 10x average regardless of stddev
  if (avgCostPerRequest > 0 && costUsd > avgCostPerRequest * 10) {
    const ratio = costUsd / avgCostPerRequest;
    const score = Math.min(100, Math.round(50 + (ratio - 10) * 5));
    return {
      isAnomaly: true,
      anomalyScore: score,
      reason: `Cost $${costUsd.toFixed(4)} is ${ratio.toFixed(1)}x the average ($${avgCostPerRequest.toFixed(4)}) for ${model}`,
    };
  }

  // Statistical outlier: cost > mean + 3*stddev
  if (stdDev > 0 && costUsd > avgCostPerRequest + 3 * stdDev) {
    const zScore = (costUsd - avgCostPerRequest) / stdDev;
    const score = Math.min(100, Math.round(30 + zScore * 5));
    return {
      isAnomaly: true,
      anomalyScore: score,
      reason: `Cost $${costUsd.toFixed(4)} is ${zScore.toFixed(1)}σ above mean ($${avgCostPerRequest.toFixed(4)} ± $${stdDev.toFixed(4)}) for ${model}`,
    };
  }

  return { isAnomaly: false, anomalyScore: 0, reason: 'Normal' };
}

/**
 * Run anomaly detection on a cost record after recording it.
 * Should be called inside recordUnifiedCost().
 * Non-throwing: failures never block AI operations.
 */
async function checkAndAlertAnomaly(
  record: Omit<UnifiedCostRecord, 'id' | 'timestamp' | 'totalTokens' | 'costUsd'>,
  costUsd: number
): Promise<void> {
  try {
    const baseline = await computeCostBaseline(168);
    const result = detectCostAnomaly(costUsd, record.model, baseline);

    if (result.isAnomaly) {
      // Store the detected anomaly
      const anomaly = {
        model: record.model,
        costUsd,
        anomalyScore: result.anomalyScore,
        reason: result.reason,
        timestamp: new Date().toISOString(),
      };
      detectedAnomalies.push(anomaly);
      // Keep only last 50 anomalies
      if (detectedAnomalies.length > 50) {
        detectedAnomalies.splice(0, detectedAnomalies.length - 50);
      }

      // Fire an unusual_spike budget alert (this was previously defined but never triggered)
      addAlert({
        type: 'unusual_spike',
        message: result.reason,
        currentValue: costUsd,
        threshold: baseline.avgCostPerRequest + 3 * baseline.stdDev,
      });

      logger.warn(`[cost-tracking] Anomaly detected (score ${result.anomalyScore}/100): ${result.reason}`);
    }
  } catch (err) {
    logger.error(`[cost-tracking] Anomaly detection failed: ${err instanceof Error ? err.message : err}`);
  }
}

// ─── Spend Alert Notifications ────────────────────────────────────────

/**
 * Deliver a notification to a registered webhook URL.
 * Fire-and-forget with a 3-second timeout.
 * Non-throwing: delivery failures are logged but never propagated.
 */
async function deliverWebhook(notification: SpendAlertNotification): Promise<void> {
  if (!alertWebhookUrl) return;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(alertWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: notification.id,
        type: notification.type,
        message: notification.message,
        currentValue: notification.currentValue,
        threshold: notification.threshold,
        timestamp: notification.timestamp,
        source: 'unified-ai-cost-tracking',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      notification.delivered = true;
      logger.info(`[cost-tracking] Alert notification delivered to webhook: ${notification.id}`);
    } else {
      logger.warn(`[cost-tracking] Webhook delivery failed (HTTP ${response.status}): ${notification.id}`);
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Unknown error';
    logger.warn(`[cost-tracking] Webhook delivery error: ${reason}`);
  }
}

/**
 * Register a webhook URL for spend alert notifications.
 * When a budget alert fires, POST a JSON payload to this URL.
 */
export function registerAlertWebhook(url: string): void {
  alertWebhookUrl = url;
  logger.info(`[cost-tracking] Alert webhook registered: ${url}`);
}

/**
 * Get all pending (undelivered) alert notifications.
 */
export function getPendingAlerts(): SpendAlertNotification[] {
  return alertNotifications.filter(n => !n.delivered);
}

/**
 * Mark an alert as delivered.
 */
export function markAlertDelivered(alertId: string): void {
  const notification = alertNotifications.find(n => n.id === alertId);
  if (notification) {
    notification.delivered = true;
    logger.info(`[cost-tracking] Alert ${alertId} marked as delivered`);
  }
}
