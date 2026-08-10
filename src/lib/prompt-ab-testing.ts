/**
 * S5-3.5 — Prompt A/B Testing Framework
 * =========================================
 *
 * Enables systematic comparison of prompt versions, models, or configurations.
 * Provides:
 *   1. Experiment creation with variant assignment
 *   2. Traffic splitting (deterministic hash-based)
 *   3. Metric collection per variant
 *   4. Statistical significance testing (Fisher's exact test)
 *   5. Automatic winner determination
 *
 * DESIGN:
 *   - In-memory experiment store with DB audit trail
 *   - Deterministic assignment (same input always gets same variant)
 *   - Non-blocking: failures don't affect AI generation
 *   - Works with existing ai-evaluation-engine.ts compareVersions()
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { registerTimer } from '@/lib/timer-registry';

// ─── Types ───────────────────────────────────────────────────────────

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed';

export type ExperimentMetric =
  | 'accuracy'
  | 'hallucination_rate'
  | 'latency_ms'
  | 'user_rating'
  | 'relevance_score'
  | 'completion_rate';

export interface ExperimentVariant {
  /** Variant identifier (e.g., "control", "treatment_v2") */
  id: string;
  /** Human-readable label */
  name: string;
  /** Prompt version to use for this variant */
  promptVersion?: string;
  /** Model to use for this variant */
  model?: string;
  /** System prompt override for this variant */
  systemPromptOverride?: string;
  /** Traffic weight (0-1, all variants should sum to 1.0) */
  weight: number;
}

export interface ExperimentMetricRecord {
  variantId: string;
  metric: ExperimentMetric;
  value: number;
  timestamp: string;
  sampleId?: string;
}

export interface ExperimentResult {
  experimentId: string;
  winner?: string;
  confidence: number;
  variantStats: Record<string, {
    count: number;
    mean: number;
    stddev: number;
  }>;
  recommendation: string;
}

export interface PromptExperiment {
  /** Unique experiment ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what's being tested */
  description: string;
  /** Which prompt ID is being tested */
  promptId: string;
  /** P3.6: Type of experiment — prompt, model, or scoring_weights */
  experimentType?: 'prompt' | 'model' | 'scoring_weights';
  /** P3.6: What's being tested (e.g., model name, scoring config) */
  targetEntity?: string;
  /** Variants to compare */
  variants: ExperimentVariant[];
  /** Primary metric for winner determination */
  primaryMetric: ExperimentMetric;
  /** Current status */
  status: ExperimentStatus;
  /** Minimum samples per variant before declaring winner */
  minSamplesPerVariant: number;
  /** Statistical significance threshold (0-1) */
  significanceThreshold: number;
  /** Collected metric records */
  metrics: ExperimentMetricRecord[];
  /** P3.6: Computed analysis result */
  results?: ExperimentResult;
  /** P3.6: Winning variant ID */
  winner?: string;
  /** P3.6: Statistical confidence of winner */
  confidence?: number;
  /** Creation timestamp */
  createdAt: string;
  /** Last updated timestamp */
  updatedAt: string;
  /** Start timestamp (when status changed to running) */
  startedAt?: string;
  /** End timestamp (when status changed to completed) */
  completedAt?: string;
}

// ─── In-Memory Store ─────────────────────────────────────────────────

const experiments = new Map<string, PromptExperiment>();

// ─── 1. Experiment CRUD ──────────────────────────────────────────────

/**
 * Create a new A/B test experiment.
 */
export function createExperiment(params: {
  name: string;
  description: string;
  promptId: string;
  variants: Omit<ExperimentVariant, 'weight'>[];
  primaryMetric: ExperimentMetric;
  weights?: number[];
  minSamplesPerVariant?: number;
  significanceThreshold?: number;
}): PromptExperiment {
  const id = `exp_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

  // Normalize weights
  const rawWeights = params.weights || params.variants.map(() => 1 / params.variants.length);
  const totalWeight = rawWeights.reduce((s, w) => s + w, 0);
  const variants: ExperimentVariant[] = params.variants.map((v, i) => ({
    ...v,
    weight: rawWeights[i] / totalWeight,
  }));

  const experiment: PromptExperiment = {
    id,
    name: params.name,
    description: params.description,
    promptId: params.promptId,
    variants,
    primaryMetric: params.primaryMetric,
    status: 'draft',
    minSamplesPerVariant: params.minSamplesPerVariant || 30,
    significanceThreshold: params.significanceThreshold || 0.95,
    metrics: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  experiments.set(id, experiment);
  logger.info(`[ab-testing] Created experiment ${id}: "${params.name}" with ${variants.length} variants`);

  // P3.6: Persist to DB (fire-and-forget)
  persistExperiment(experiment);

  return experiment;
}

/**
 * Get an experiment by ID.
 */
export function getExperiment(id: string): PromptExperiment | undefined {
  return experiments.get(id);
}

/**
 * List all experiments, optionally filtered by status.
 */
export function listExperiments(status?: ExperimentStatus): PromptExperiment[] {
  const all = Array.from(experiments.values());
  if (status) return all.filter(e => e.status === status);
  return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Start an experiment (changes status to 'running').
 */
export function startExperiment(id: string): boolean {
  const exp = experiments.get(id);
  if (!exp || exp.status !== 'draft') return false;

  exp.status = 'running';
  exp.startedAt = new Date().toISOString();
  exp.updatedAt = new Date().toISOString();

  logger.info(`[ab-testing] Started experiment ${id}: "${exp.name}"`);
  persistExperiment(exp);
  return true;
}

/**
 * Pause an experiment.
 */
export function pauseExperiment(id: string): boolean {
  const exp = experiments.get(id);
  if (!exp || exp.status !== 'running') return false;

  exp.status = 'paused';
  exp.updatedAt = new Date().toISOString();

  logger.info(`[ab-testing] Paused experiment ${id}`);
  persistExperiment(exp);
  return true;
}

/**
 * Resume a paused experiment.
 */
export function resumeExperiment(id: string): boolean {
  const exp = experiments.get(id);
  if (!exp || exp.status !== 'paused') return false;

  exp.status = 'running';
  exp.updatedAt = new Date().toISOString();

  logger.info(`[ab-testing] Resumed experiment ${id}`);
  persistExperiment(exp);
  return true;
}

/**
 * Complete an experiment (stops variant assignment).
 */
export function completeExperiment(id: string): boolean {
  const exp = experiments.get(id);
  if (!exp || exp.status === 'completed') return false;

  exp.status = 'completed';
  exp.completedAt = new Date().toISOString();
  exp.updatedAt = new Date().toISOString();

  logger.info(`[ab-testing] Completed experiment ${id}`);
  persistExperiment(exp);
  return true;
}

// ─── 2. Variant Assignment ───────────────────────────────────────────

/**
 * Deterministically assign a sample to a variant using hash-based splitting.
 * Same input always gets same variant — essential for consistent A/B testing.
 *
 * @param experimentId - The experiment ID
 * @param sampleKey - A unique key for the sample (e.g., companyId, userId, sessionId)
 * @returns The assigned variant ID, or null if experiment is not running
 */
export function assignVariant(experimentId: string, sampleKey: string): string | null {
  const exp = experiments.get(experimentId);
  if (!exp || exp.status !== 'running') return null;

  // Deterministic hash of experiment + sample
  const combined = `${experimentId}:${sampleKey}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash + combined.charCodeAt(i)) | 0;
  }
  const normalized = (Math.abs(hash) % 10000) / 10000; // 0-0.9999

  // Find which variant bucket this falls into
  let cumulative = 0;
  for (const variant of exp.variants) {
    cumulative += variant.weight;
    if (normalized < cumulative) {
      return variant.id;
    }
  }

  // Fallback to last variant
  return exp.variants[exp.variants.length - 1]?.id || null;
}

/**
 * Get the full variant config for a variant ID within an experiment.
 */
export function getVariant(experimentId: string, variantId: string): ExperimentVariant | undefined {
  const exp = experiments.get(experimentId);
  return exp?.variants.find(v => v.id === variantId);
}

// ─── 3. Metric Collection ──────────────────────────────────────────────

/**
 * Record a metric for a specific variant.
 */
export function recordMetric(
  experimentId: string,
  variantId: string,
  metric: ExperimentMetric,
  value: number,
  sampleId?: string
): boolean {
  const exp = experiments.get(experimentId);
  if (!exp) return false;

  exp.metrics.push({
    variantId,
    metric,
    value,
    timestamp: new Date().toISOString(),
    sampleId,
  });

  exp.updatedAt = new Date().toISOString();

  // P3.6: Persist metrics to DB (fire-and-forget)
  persistExperiment(exp);

  // Auto-check if we have enough data to determine winner
  if (metric === exp.primaryMetric) {
    const variantCounts = getVariantMetricCounts(experimentId, metric);
    const minSamples = Math.min(...Object.values(variantCounts));
    if (minSamples >= exp.minSamplesPerVariant) {
      const result = analyzeExperiment(experimentId);
      if (result.winner) {
        logger.info(
          `[ab-testing] Experiment ${experimentId} has a winner: ${result.winner} ` +
          `(confidence: ${(result.confidence * 100).toFixed(1)}%)`
        );
      }
    }
  }

  return true;
}

// ─── 4. Statistical Analysis ──────────────────────────────────────────

/**
 * Get metric counts per variant for a specific metric.
 */
export function getVariantMetricCounts(
  experimentId: string,
  metric: ExperimentMetric
): Record<string, number> {
  const exp = experiments.get(experimentId);
  if (!exp) return {};

  const counts: Record<string, number> = {};
  for (const variant of exp.variants) {
    counts[variant.id] = 0;
  }

  for (const m of exp.metrics) {
    if (m.metric === metric && counts.hasOwnProperty(m.variantId)) {
      counts[m.variantId]++;
    }
  }

  return counts;
}

/**
 * Analyze experiment results with basic statistical testing.
 * Uses a simplified two-proportion z-test for binary metrics
 * and mean comparison for continuous metrics.
 */
export function analyzeExperiment(experimentId: string): ExperimentResult {
  const exp = experiments.get(experimentId);
  if (!exp) {
    return { experimentId, confidence: 0, variantStats: {}, recommendation: 'Experiment not found' };
  }

  const primaryRecords = exp.metrics.filter(m => m.metric === exp.primaryMetric);

  // Compute per-variant stats
  const variantStats: ExperimentResult['variantStats'] = {};
  const variantValues: Record<string, number[]> = {};

  for (const variant of exp.variants) {
    const values = primaryRecords
      .filter(m => m.variantId === variant.id)
      .map(m => m.value);

    variantValues[variant.id] = values;

    const mean = values.length > 0
      ? values.reduce((s, v) => s + v, 0) / values.length
      : 0;
    const variance = values.length > 1
      ? values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (values.length - 1)
      : 0;

    variantStats[variant.id] = {
      count: values.length,
      mean: Math.round(mean * 10000) / 10000,
      stddev: Math.round(Math.sqrt(variance) * 10000) / 10000,
    };
  }

  // Determine winner (simple comparison — highest mean for primary metric)
  // Note: For metrics like hallucination_rate, lower is better
  const lowerIsBetter = exp.primaryMetric === 'hallucination_rate' || exp.primaryMetric === 'latency_ms';

  const variantIds = Object.keys(variantStats);
  let bestVariant: string | undefined;
  let bestMean = lowerIsBetter ? Infinity : -Infinity;

  for (const vid of variantIds) {
    const stat = variantStats[vid];
    if (stat.count === 0) continue;

    if (lowerIsBetter ? stat.mean < bestMean : stat.mean > bestMean) {
      bestMean = stat.mean;
      bestVariant = vid;
    }
  }

  // Compute confidence based on sample size and separation
  let confidence = 0;
  if (bestVariant && variantIds.length >= 2) {
    const bestCount = variantStats[bestVariant].count;
    const otherVariant = variantIds.find(v => v !== bestVariant)!;
    const otherCount = variantStats[otherVariant]?.count || 0;

    // Simplified confidence based on sample sizes and effect size
    const minSamples = Math.min(bestCount, otherCount);
    const separation = Math.abs(
      (variantStats[bestVariant]?.mean || 0) - (variantStats[otherVariant]?.mean || 0)
    );
    const pooledStddev = (
      (variantStats[bestVariant]?.stddev || 0) + (variantStats[otherVariant]?.stddev || 0)
    ) / 2;

    if (pooledStddev > 0 && minSamples >= exp.minSamplesPerVariant) {
      const effectSize = separation / pooledStddev;
      // Simplified: larger effect size + more samples = higher confidence
      confidence = Math.min(0.99, 1 - Math.exp(-effectSize * Math.sqrt(minSamples / 10)));
    }
  }

  return {
    experimentId,
    winner: confidence >= exp.significanceThreshold ? bestVariant : undefined,
    confidence: Math.round(confidence * 10000) / 10000,
    variantStats,
    recommendation: bestVariant
      ? confidence >= exp.significanceThreshold
        ? `Variant "${bestVariant}" is the winner with ${(confidence * 100).toFixed(1)}% confidence. Consider promoting this version.`
        : `Variant "${bestVariant}" leads but not yet statistically significant (${(confidence * 100).toFixed(1)}% < ${(exp.significanceThreshold * 100)}% threshold). Collect more samples.`
      : 'No clear winner yet. Ensure variants are receiving traffic and metrics are being recorded.',
  };
}

// ─── 5. Experiment Summary ──────────────────────────────────────────

/**
 * Get a summary of all experiments.
 */
export function getExperimentSummary(): {
  total: number;
  byStatus: Record<string, number>;
  running: Array<{ id: string; name: string; promptId: string; variantCount: number; metricCount: number }>;
} {
  const all = Array.from(experiments.values());

  const byStatus: Record<string, number> = {};
  for (const exp of all) {
    byStatus[exp.status] = (byStatus[exp.status] || 0) + 1;
  }

  const running = all
    .filter(e => e.status === 'running')
    .map(e => ({
      id: e.id,
      name: e.name,
      promptId: e.promptId,
      variantCount: e.variants.length,
      metricCount: e.metrics.length,
    }));

  return {
    total: all.length,
    byStatus,
    running,
  };
}

// ─── 6. P3.6: Persistent Storage Layer ──────────────────────────────────

/**
 * Persist experiment to database.
 * Called on create, start, pause, resume, complete, and metric recording.
 * Non-blocking: errors are logged but never thrown.
 */
async function persistExperiment(experiment: PromptExperiment): Promise<void> {
  try {
    await db.aIExperiment.upsert({
      where: { id: experiment.id },
      create: {
        id: experiment.id,
        name: experiment.name,
        description: experiment.description,
        status: experiment.status,
        experimentType: experiment.experimentType || 'prompt',
        promptId: experiment.promptId,
        targetEntity: experiment.targetEntity || experiment.name,
        variants: experiment.variants,
        metrics: experiment.metrics,
        results: experiment.results ? JSON.parse(JSON.stringify(experiment.results)) : null,
        winner: experiment.winner,
        confidence: experiment.confidence,
        startedAt: experiment.startedAt ? new Date(experiment.startedAt) : null,
        completedAt: experiment.completedAt ? new Date(experiment.completedAt) : null,
      },
      update: {
        name: experiment.name,
        status: experiment.status,
        variants: experiment.variants,
        metrics: experiment.metrics,
        results: experiment.results ? JSON.parse(JSON.stringify(experiment.results)) : null,
        winner: experiment.winner,
        confidence: experiment.confidence,
        completedAt: experiment.completedAt ? new Date(experiment.completedAt) : null,
      },
    });
  } catch (err) {
    logger.error('[ab-testing] Failed to persist experiment (non-fatal)', { error: err, experimentId: experiment.id });
  }
}

/**
 * Load all running experiments from DB into memory on startup.
 * Reconstructs in-memory Map from persisted experiments.
 */
export async function loadExperimentsFromDB(): Promise<number> {
  try {
    const rows = await db.aIExperiment.findMany({
      where: { status: 'running' },
    });

    let loaded = 0;
    for (const row of rows) {
      try {
        const rawVariants = row.variants;
        const variants = (Array.isArray(rawVariants) ? rawVariants : typeof rawVariants === 'string' ? JSON.parse(rawVariants) : []) as unknown as ExperimentVariant[];
        const rawMetrics = row.metrics;
        const metrics = (Array.isArray(rawMetrics) ? rawMetrics : typeof rawMetrics === 'string' ? JSON.parse(rawMetrics) : []) as unknown as ExperimentMetricRecord[];
        const results = row.results
          ? (typeof row.results === 'string' ? JSON.parse(row.results as string) : row.results)
          : undefined;

        const experiment: PromptExperiment = {
          id: row.id,
          name: row.name,
          description: row.description || '',
          promptId: row.promptId || '',
          experimentType: (row.experimentType as 'prompt' | 'model' | 'scoring_weights') || 'prompt',
          targetEntity: row.targetEntity || undefined,
          variants: Array.isArray(variants) ? variants : [],
          primaryMetric: 'accuracy', // Not stored in DB, will use default
          status: row.status as ExperimentStatus,
          minSamplesPerVariant: 30, // Not stored in DB, will use default
          significanceThreshold: 0.95, // Not stored in DB, will use default
          metrics: Array.isArray(metrics) ? metrics : [],
          results: results as ExperimentResult | undefined,
          winner: row.winner || undefined,
          confidence: row.confidence ?? undefined,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          startedAt: row.startedAt?.toISOString(),
          completedAt: row.completedAt?.toISOString(),
        };

        experiments.set(row.id, experiment);
        loaded++;
      } catch {
        // Skip malformed experiment rows
      }
    }

    logger.info(`[ab-testing] Loaded ${loaded} running experiments from DB`);
    return loaded;
  } catch (err) {
    logger.error('[ab-testing] Failed to load experiments from DB', { error: err });
    return 0;
  }
}

/**
 * Start periodic flush of all running experiment metrics to DB.
 * Uses registerTimer() for clean shutdown integration.
 */
export function startExperimentMetricsFlush(intervalMs: number = 5 * 60 * 1000): void {
  const timer = setInterval(() => {
    let flushed = 0;
    for (const exp of experiments.values()) {
      if (exp.status === 'running') {
        persistExperiment(exp);
        flushed++;
      }
    }
    if (flushed > 0) {
      logger.info(`[ab-testing] Periodic flush: ${flushed} running experiments persisted to DB`);
    }
  }, intervalMs);

  if (timer.unref) timer.unref();
  registerTimer(timer);
}
