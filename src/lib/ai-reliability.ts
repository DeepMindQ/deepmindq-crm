/**
 * AI Reliability Layer (Wave 8.3)
 *
 * Tracks and monitors AI output quality across the platform:
 * - Hallucination risk detection
 * - Freshness decay and staleness
 * - Confidence calibration accuracy
 * - Token cost tracking
 * - Failed generation monitoring
 *
 * Enterprise customers need to trust AI outputs. This layer provides
 * the transparency and monitoring required for production deployment.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// ── Types ──

export type GenerationStatus = 'success' | 'failed' | 'partial' | 'hallucination_risk' | 'timeout';
export type GenerationType = 'scoring' | 'forecast' | 'recommendation' | 'enrichment' | 'brief' | 'coaching' | 'email' | 'conversation_plan' | 'contact_intelligence' | 'relationship_map' | 'risk_analysis';

export interface AIGenerationRecord {
  id: string;
  generationType: GenerationType;
  status: GenerationStatus;
  companyId?: string;
  contactId?: string;
  sourceRoute: string;
  modelUsed: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  confidenceScore: number;
  evidenceCount: number;
  hallucinationRiskScore: number;  // 0-100
  freshnessScore: number;         // 0-100
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AIQualityMetrics {
  // Overall health
  totalGenerations: number;
  successRate: number;
  failureRate: number;
  hallucinationRiskRate: number;

  // Confidence distribution
  avgConfidence: number;
  highConfidencePct: number;     // >= 75
  lowConfidencePct: number;      // < 45

  // Freshness
  avgFreshness: number;
  staleInsightCount: number;

  // Performance
  avgLatencyMs: number;
  p95LatencyMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;

  // Per-type breakdown
  byType: Record<string, {
    count: number;
    successRate: number;
    avgConfidence: number;
    avgLatency: number;
    hallucinationRate: number;
  }>;

  // Recent failures (last 10)
  recentFailures: Array<{
    type: string;
    route: string;
    error: string;
    at: string;
  }>;

  // Health score (0-100)
  healthScore: number;
}

// ── Record a Generation ──

export async function recordGeneration(params: {
  generationType: GenerationType;
  status: GenerationStatus;
  companyId?: string;
  contactId?: string;
  sourceRoute: string;
  modelUsed?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  confidenceScore?: number;
  evidenceCount?: number;
  hallucinationRiskScore?: number;
  freshnessScore?: number;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const now = new Date().toISOString();

  const record: Omit<AIGenerationRecord, 'id'> = {
    generationType: params.generationType,
    status: params.status,
    companyId: params.companyId,
    contactId: params.contactId,
    sourceRoute: params.sourceRoute,
    modelUsed: params.modelUsed || 'unknown',
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    latencyMs: params.latencyMs,
    confidenceScore: params.confidenceScore ?? 0,
    evidenceCount: params.evidenceCount ?? 0,
    hallucinationRiskScore: params.hallucinationRiskScore ?? 0,
    freshnessScore: params.freshnessScore ?? 0,
    errorMessage: params.errorMessage,
    metadata: params.metadata,
    createdAt: now,
  };

  // Use AIInsight.metadata to store reliability data (no separate table needed for now)
  try {
    await db.aIInsight.create({
      data: {
        type: 'RECOMMENDATION',
        title: `AI Generation: ${params.generationType} — ${params.status}`,
        description: `AI reliability tracking record for ${params.generationType} generation at ${now}`,
        evidence: JSON.stringify([]),
        confidenceScore: params.confidenceScore ?? 0,
        impactScore: params.hallucinationRiskScore ?? 0,
        urgencyScore: 0,
        sourceType: 'ai_reliability',
        sourceRoute: '/api/ai/reliability',
        modelUsed: params.modelUsed || 'unknown',
        metadata: JSON.stringify({
          ...record,
          _reliabilityRecord: true,
          generationType: params.generationType,
          status: params.status,
          inputTokens: params.inputTokens,
          outputTokens: params.outputTokens,
          latencyMs: params.latencyMs,
          hallucinationRiskScore: params.hallucinationRiskScore,
          freshnessScore: params.freshnessScore,
          evidenceCount: params.evidenceCount,
          errorMessage: params.errorMessage,
        }),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30-day retention
      },
    });
  } catch (err) {
    // Don't let reliability tracking failures block AI operations
    logger.warn('[ai-reliability] Failed to persist generation record:', { error: err });
  }
}

// ── Hallucination Risk Assessment ──

/**
 * Assess hallucination risk for an AI output.
 * Returns a 0-100 score where higher = more risk.
 */
export function assessHallucinationRisk(params: {
  evidenceCount: number;
  confidenceScore: number;
  hasContradictions: boolean;
  sourceReliability: number;  // 0-1 average
  isNovelClaim: boolean;      // Claim not seen in source data
  hasSpecificNumbers: boolean; // Contains specific stats/figures
  reasoningDepth: number;     // 0-100 how detailed the reasoning is
}): number {
  let risk = 0;

  // Low evidence = higher risk
  if (params.evidenceCount === 0) risk += 40;
  else if (params.evidenceCount === 1) risk += 25;
  else if (params.evidenceCount === 2) risk += 10;

  // Contradictions significantly increase risk
  if (params.hasContradictions) risk += 30;

  // Novel claims without evidence
  if (params.isNovelClaim) risk += 20;

  // Low source reliability
  risk += Math.round((1 - params.sourceReliability) * 15);

  // Very high confidence with very low evidence = suspicious
  if (params.confidenceScore >= 85 && params.evidenceCount <= 1) risk += 15;

  // Low reasoning depth
  if (params.reasoningDepth < 30) risk += 10;

  // Specific numbers without evidence backing
  if (params.hasSpecificNumbers && params.evidenceCount <= 1) risk += 10;

  return Math.min(100, risk);
}

// ── Freshness Assessment ──

/**
 * Assess how fresh/recent the intelligence is.
 * Returns 0-100 where higher = more fresh.
 */
export function assessFreshness(params: {
  latestEvidenceDate?: string | Date;
  signalCount: number;
  daysSinceLastUpdate: number;
  hasCurrentData: boolean;
}): number {
  let freshness = 100;

  // Decay based on days since last update
  if (params.daysSinceLastUpdate > 90) freshness -= 50;
  else if (params.daysSinceLastUpdate > 60) freshness -= 35;
  else if (params.daysSinceLastUpdate > 30) freshness -= 20;
  else if (params.daysSinceLastUpdate > 14) freshness -= 10;
  else if (params.daysSinceLastUpdate > 7) freshness -= 5;

  // Boost for signal count
  freshness = Math.min(100, freshness + Math.min(20, params.signalCount * 3));

  // Penalize for no current data
  if (!params.hasCurrentData) freshness -= 15;

  return Math.max(0, Math.min(100, freshness));
}

// ── Confidence Calibration ──

/**
 * Calibrate confidence based on evidence quality.
 * Prevents overconfident AI outputs with weak evidence.
 */
export function calibrateConfidence(params: {
  rawConfidence: number;
  evidenceCount: number;
  evidenceQuality: 'verified' | 'corroborated' | 'inferred' | 'estimated' | 'speculative';
  sourceReliability: number;
  hallucinationRisk: number;
}): number {
  let calibrated = params.rawConfidence;

  // Scale down based on evidence count
  const evidenceFactor = Math.min(1, 0.5 + (params.evidenceCount * 0.15));
  calibrated *= evidenceFactor;

  // Scale down based on evidence quality
  const qualityFactors: Record<string, number> = {
    verified: 1.0,
    corroborated: 0.95,
    inferred: 0.85,
    estimated: 0.7,
    speculative: 0.5,
  };
  calibrated *= qualityFactors[params.evidenceQuality] || 0.7;

  // Scale down based on source reliability
  calibrated *= (0.6 + (params.sourceReliability * 0.4));

  // Scale down based on hallucination risk
  calibrated *= (1 - (params.hallucinationRisk / 200));

  return Math.max(5, Math.min(95, Math.round(calibrated)));
}

// ── Quality Metrics Aggregation ──

/**
 * Aggregate AI quality metrics from recent generation records.
 */
export async function getQualityMetrics(days = 30): Promise<AIQualityMetrics> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const records = await db.aIInsight.findMany({
    where: {
      sourceType: 'ai_reliability',
      createdAt: { gte: since },
    },
    select: { id: true, metadata: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  const parsed: AIGenerationRecord[] = [];
  for (const r of records) {
    try {
      const meta = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata;
      if (meta._reliabilityRecord) {
        parsed.push({
          id: r.id,
          ...meta,
          createdAt: r.createdAt.toISOString(),
        });
      }
    } catch {
      // Skip malformed records
    }
  }

  if (parsed.length === 0) {
    return {
      totalGenerations: 0,
      successRate: 100,
      failureRate: 0,
      hallucinationRiskRate: 0,
      avgConfidence: 0,
      highConfidencePct: 0,
      lowConfidencePct: 0,
      avgFreshness: 0,
      staleInsightCount: 0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      byType: {},
      recentFailures: [],
      healthScore: 100, // No data = healthy by default
    };
  }

  const total = parsed.length;
  const successes = parsed.filter(r => r.status === 'success').length;
  const failures = parsed.filter(r => r.status === 'failed' || r.status === 'timeout').length;
  const hallucinations = parsed.filter(r => r.status === 'hallucination_risk' || (r.hallucinationRiskScore || 0) >= 50).length;

  const confidences = parsed.filter(r => r.confidenceScore > 0).map(r => r.confidenceScore);
  const avgConf = confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;

  const latencies = parsed.map(r => r.latencyMs || 0).sort((a, b) => a - b);
  const p95Idx = Math.floor(latencies.length * 0.95);

  const totalInput = parsed.reduce((s, r) => s + (r.inputTokens || 0), 0);
  const totalOutput = parsed.reduce((s, r) => s + (r.outputTokens || 0), 0);

  // Per-type breakdown
  const byType: AIQualityMetrics['byType'] = {};
  for (const r of parsed) {
    if (!byType[r.generationType]) {
      byType[r.generationType] = { count: 0, successRate: 100, avgConfidence: 0, avgLatency: 0, hallucinationRate: 0 };
    }
    const bt = byType[r.generationType];
    bt.count++;
    if (r.status === 'success') {
      bt.successRate = ((bt.successRate * (bt.count - 1)) + 100) / bt.count;
    } else {
      bt.successRate = (bt.successRate * (bt.count - 1)) / bt.count;
    }
  }

  // Recent failures
  const recentFailures = parsed
    .filter(r => r.status === 'failed' || r.status === 'timeout' || r.status === 'hallucination_risk')
    .slice(0, 10)
    .map(r => ({
      type: r.generationType,
      route: r.sourceRoute,
      error: r.errorMessage || 'Unknown error',
      at: r.createdAt,
    }));

  // Health score
  const healthScore = Math.round(
    (successes / total) * 40 +
    (avgConf / 100) * 20 +
    (1 - (hallucinations / total)) * 20 +
    (latencies.length > 0 ? Math.min(1, 5000 / (latencies.reduce((a, b) => a + b, 0) / latencies.length)) * 20 : 20)
  );

  // Stale insights count
  const staleInsightCount = await db.aIInsight.count({
    where: {
      status: 'active',
      expiresAt: { lte: new Date() },
    },
  });

  return {
    totalGenerations: total,
    successRate: parseFloat(((successes / total) * 100).toFixed(1)),
    failureRate: parseFloat(((failures / total) * 100).toFixed(1)),
    hallucinationRiskRate: parseFloat(((hallucinations / total) * 100).toFixed(1)),
    avgConfidence: parseFloat(avgConf.toFixed(1)),
    highConfidencePct: parseFloat(((confidences.filter(c => c >= 75).length / confidences.length) * 100).toFixed(1)),
    lowConfidencePct: parseFloat(((confidences.filter(c => c < 45).length / confidences.length) * 100).toFixed(1)),
    avgFreshness: parseFloat((parsed.filter(r => r.freshnessScore > 0).reduce((s, r) => s + r.freshnessScore, 0) / Math.max(1, parsed.filter(r => r.freshnessScore > 0).length)).toFixed(1)),
    staleInsightCount,
    avgLatencyMs: parseFloat((latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(0)),
    p95LatencyMs: latencies[p95Idx] || 0,
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    byType,
    recentFailures,
    healthScore: Math.max(0, Math.min(100, healthScore)),
  };
}

// ── Convenience Wrapper: Track a Generation ──

/**
 * Wraps an async AI generation function with reliability tracking.
 * Usage: const result = await trackGeneration('scoring', '/api/ai/score', fn);
 */
export async function trackGeneration<T>(
  generationType: GenerationType,
  sourceRoute: string,
  fn: () => Promise<T>,
  params?: {
    companyId?: string;
    contactId?: string;
    modelUsed?: string;
  }
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    await recordGeneration({
      generationType,
      status: 'success',
      sourceRoute,
      modelUsed: params?.modelUsed,
      companyId: params?.companyId,
      contactId: params?.contactId,
      latencyMs: Date.now() - start,
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await recordGeneration({
      generationType,
      status: 'failed',
      sourceRoute,
      modelUsed: params?.modelUsed,
      companyId: params?.companyId,
      contactId: params?.contactId,
      latencyMs: Date.now() - start,
      errorMessage: message,
    });
    throw err;
  }
}
