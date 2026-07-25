/**
 * AI Evidence Framework (Wave 8.1)
 *
 * Every AI output in DeepMindQ MUST pass through this framework.
 * Ensures: Signal → Evidence → Source → Date → Confidence → Impact → Action
 *
 * This is the single source of truth for how AI intelligence is structured,
 * validated, and tracked for reliability.
 */

import { createInsight, createInsights } from './ai-insight-service';
import type { AIInsightOutput } from './ai-insight-types';
import type { AIInsightEvidence } from './ai-insight-types';

// ── Evidence Quality Levels ──

export type EvidenceQuality = 'verified' | 'corroborated' | 'inferred' | 'estimated' | 'speculative';

export const EVIDENCE_QUALITY_SCORES: Record<EvidenceQuality, number> = {
  verified: 1.0,      // Multiple independent sources confirm
  corroborated: 0.8,  // At least 2 sources agree
  inferred: 0.6,       // Single source, logically consistent
  estimated: 0.4,     // AI estimation based on patterns
  speculative: 0.2,    // Low confidence, needs validation
};

// ── Signal Categories ──

export type AISignalCategory =
  | 'technology_trigger'
  | 'growth_signal'
  | 'executive_change'
  | 'engagement'
  | 'risk'
  | 'competitive'
  | 'market_trend'
  | 'pain_point'
  | 'intent_signal'
  | 'relationship'
  | 'financial';

// ── Unified AI Output Envelope ──

export interface AIEvidenceOutput {
  // What happened
  signal: string;
  signalCategory: AISignalCategory;

  // Evidence chain
  evidence: AIEvidenceItem[];

  // Confidence & scoring
  confidenceScore: number;       // 0-100
  confidenceLevel: 'high' | 'medium' | 'low';
  confidenceRationale: string;  // Why this confidence level

  // Impact assessment
  impactScore: number;          // 0-100
  impactLevel: 'critical' | 'high' | 'medium' | 'low';
  urgencyScore: number;        // 0-100

  // Actionability
  recommendedAction: string;
  nextBestActions: string[];

  // Traceability
  sourceRoute: string;
  modelUsed: string;
  generatedAt: string;

  // Evidence quality summary
  evidenceQuality: EvidenceQuality;
  evidenceCount: number;
  verifiedCount: number;
}

export interface AIEvidenceItem {
  signal: string;               // What we observed
  evidence: string;             // Specific evidence snippet
  source: string;               // Where it came from
  sourceUrl?: string;
  detectedAt: string;           // ISO date
  quality: EvidenceQuality;
  reliability: number;          // 0-1
}

// ── Score Breakdown Format ──

export interface AIScoreBreakdown {
  totalScore: number;           // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  confidence: number;           // 0-100

  // Decomposed factors (the "+25 Technology Trigger" format)
  factors: AIScoreFactor[];

  // Human-readable breakdown string
  breakdown: string;

  // Actionability
  priorityTier: 'critical' | 'high' | 'medium' | 'low' | 'nurture';
  recommendedAction: string;
  nextBestActions: string[];
}

export interface AIScoreFactor {
  category: string;
  label: string;
  points: number;       // positive or negative
  maxPoints: number;
  evidence: string;
  source: string;
  weight: number;       // How much this factor contributes (0-1)
}

// ── Helpers ──

function toGrade(score: number): AIScoreBreakdown['grade'] {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 35) return 'D';
  return 'F';
}

function toConfidenceLevel(score: number): AIEvidenceOutput['confidenceLevel'] {
  if (score >= 75) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
}

function toImpactLevel(score: number): AIEvidenceOutput['impactLevel'] {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

function determineEvidenceQuality(items: AIEvidenceItem[]): EvidenceQuality {
  if (items.length === 0) return 'speculative';
  const avgReliability = items.reduce((s, i) => s + i.reliability, 0) / items.length;
  const verified = items.filter(i => i.quality === 'verified' || i.quality === 'corroborated').length;

  if (verified >= 3 && avgReliability >= 0.8) return 'verified';
  if (verified >= 2) return 'corroborated';
  if (avgReliability >= 0.5) return 'inferred';
  if (avgReliability >= 0.3) return 'estimated';
  return 'speculative';
}

function formatBreakdown(factors: AIScoreFactor[]): string {
  const sorted = [...factors].sort((a, b) => b.points - a.points);
  const parts = sorted
    .filter(f => f.points !== 0)
    .map(f => {
      const sign = f.points > 0 ? '+' : '';
      const evidence = f.evidence.length > 50 ? f.evidence.substring(0, 47) + '...' : f.evidence;
      return `${sign}${f.points} ${f.label} (${evidence})`;
    });
  return parts.length > 0 ? parts.join(', ') : 'No signals detected';
}

// ── Main Builder Functions ──

/**
 * Build a standard AI Evidence Output from collected evidence items.
 * All AI routes should use this to ensure consistent output format.
 */
export function buildEvidenceOutput(params: {
  signal: string;
  signalCategory: AISignalCategory;
  evidence: AIEvidenceItem[];
  confidenceScore: number;
  confidenceRationale?: string;
  impactScore: number;
  urgencyScore?: number;
  recommendedAction: string;
  nextBestActions?: string[];
  sourceRoute: string;
  modelUsed?: string;
}): AIEvidenceOutput {
  const {
    signal, signalCategory, evidence, confidenceScore, confidenceRationale,
    impactScore, urgencyScore = 50, recommendedAction, nextBestActions = [],
    sourceRoute, modelUsed = 'composite_v1',
  } = params;

  const evidenceQuality = determineEvidenceQuality(evidence);

  return {
    signal,
    signalCategory,
    evidence: evidence.sort((a, b) => b.reliability - a.reliability),
    confidenceScore: Math.max(0, Math.min(100, confidenceScore)),
    confidenceLevel: toConfidenceLevel(confidenceScore),
    confidenceRationale: confidenceRationale || `${evidence.length} evidence sources, quality: ${evidenceQuality}`,
    impactScore: Math.max(0, Math.min(100, impactScore)),
    impactLevel: toImpactLevel(impactScore),
    urgencyScore: Math.max(0, Math.min(100, urgencyScore)),
    recommendedAction,
    nextBestActions,
    sourceRoute,
    modelUsed,
    generatedAt: new Date().toISOString(),
    evidenceQuality,
    evidenceCount: evidence.length,
    verifiedCount: evidence.filter(e => e.quality === 'verified' || e.quality === 'corroborated').length,
  };
}

/**
 * Build a standard Score Breakdown.
 * All scoring engines should produce output in this format.
 */
export function buildScoreBreakdown(params: {
  factors: AIScoreFactor[];
  confidence?: number;
  recommendedAction?: string;
  nextBestActions?: string[];
  urgencyOverride?: number;
}): AIScoreBreakdown {
  const { factors, confidence, recommendedAction, nextBestActions = [], urgencyOverride } = params;

  const totalScore = Math.max(0, Math.min(100, factors.reduce((sum, f) => sum + f.points, 0)));
  const confidenceScore = confidence || Math.min(95, 30 + (factors.length * 5) + (factors.filter(f => Math.abs(f.points) > 0).length * 3));

  const grade = toGrade(totalScore);

  let priorityTier: AIScoreBreakdown['priorityTier'];
  if (totalScore >= 80 && (urgencyOverride || totalScore) >= 60) priorityTier = 'critical';
  else if (totalScore >= 65) priorityTier = 'high';
  else if (totalScore >= 50) priorityTier = 'medium';
  else if (totalScore >= 30) priorityTier = 'low';
  else priorityTier = 'nurture';

  return {
    totalScore,
    grade,
    confidence: Math.round(confidenceScore),
    factors: factors.sort((a, b) => b.points - a.points),
    breakdown: formatBreakdown(factors),
    priorityTier,
    recommendedAction: recommendedAction || nextBestActions[0] || 'Monitor and enrich data',
    nextBestActions,
  };
}

/**
 * Persist an AIEvidenceOutput as an AIInsight record.
 * Bridges the Evidence Framework to the existing Insight persistence layer.
 */
export async function persistEvidenceAsInsight(
  output: AIEvidenceOutput,
  params: {
    companyId?: string;
    contactId?: string;
    opportunityId?: string;
    type: 'SIGNAL' | 'RISK' | 'OPPORTUNITY' | 'RECOMMENDATION' | 'SCORING' | 'FORECAST';
    title?: string;
    description?: string;
    reasoning?: string;
    metadata?: Record<string, unknown>;
    expiresAt?: Date;
  }
): Promise<AIInsightOutput> {
  const {
    companyId, contactId, opportunityId, type,
    title, description, reasoning, metadata, expiresAt,
  } = params;

  return createInsight({
    companyId,
    contactId,
    opportunityId,
    type,
    title: title || output.signal,
    description: description || `${output.signal}. Confidence: ${output.confidenceScore}%. Evidence quality: ${output.evidenceQuality}. ${output.evidenceCount} sources.`,
    evidence: output.evidence.map(e => ({
      source: e.source,
      url: e.sourceUrl,
      date: e.detectedAt,
      snippet: `${e.signal}: ${e.evidence}`,
      reliability: e.reliability,
    })),
    confidenceScore: output.confidenceScore,
    impactScore: output.impactScore,
    urgencyScore: output.urgencyScore,
    reasoning: reasoning || `Evidence rationale: ${output.confidenceRationale}. Quality: ${output.evidenceQuality}. Verified sources: ${output.verifiedCount}/${output.evidenceCount}`,
    recommendedAction: output.recommendedAction,
    sourceType: 'ai_evidence_framework',
    sourceRoute: output.sourceRoute,
    modelUsed: output.modelUsed,
    metadata: {
      ...metadata,
      evidenceQuality: output.evidenceQuality,
      evidenceCount: output.evidenceCount,
      verifiedCount: output.verifiedCount,
      signalCategory: output.signalCategory,
    },
    expiresAt: expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
}

/**
 * Persist a Score Breakdown as an AIInsight record.
 */
export async function persistScoreAsInsight(
  breakdown: AIScoreBreakdown,
  params: {
    companyId?: string;
    contactId?: string;
    opportunityId?: string;
    entityName: string;
    scoreType: string;
    metadata?: Record<string, unknown>;
  }
): Promise<AIInsightOutput> {
  const { companyId, contactId, opportunityId, entityName, scoreType, metadata } = params;

  return createInsight({
    companyId,
    contactId,
    opportunityId,
    type: breakdown.totalScore >= 70 ? 'OPPORTUNITY' : breakdown.totalScore >= 45 ? 'SIGNAL' : 'RECOMMENDATION',
    title: `${scoreType}: ${entityName} — ${breakdown.totalScore}/100 (${breakdown.grade})`,
    description: `${entityName} scored ${breakdown.totalScore}/100 (grade ${breakdown.grade}) with ${breakdown.factors.length} factors. Confidence: ${breakdown.confidence}%. Priority: ${breakdown.priorityTier}.`,
    evidence: breakdown.factors.slice(0, 6).map(f => ({
      source: f.source,
      snippet: `${f.label}: ${f.evidence}`,
      reliability: Math.min(1, Math.max(0, Math.abs(f.points) / f.maxPoints)),
    })),
    confidenceScore: breakdown.confidence,
    impactScore: breakdown.totalScore,
    urgencyScore: breakdown.totalScore >= 70 ? 75 : breakdown.totalScore >= 50 ? 50 : 25,
    recommendedAction: breakdown.recommendedAction,
    reasoning: `Score breakdown: ${breakdown.breakdown}`,
    sourceType: scoreType.toLowerCase().replace(/\s+/g, '_'),
    sourceRoute: `/api/ai/${scoreType.toLowerCase().replace(/\s+/g, '-')}`,
    metadata: {
      grade: breakdown.grade,
      priorityTier: breakdown.priorityTier,
      factorCount: breakdown.factors.length,
      ...metadata,
    },
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
}

// ── Quick Evidence Item Builder ──

/**
 * Helper to create an evidence item quickly.
 */
export function evidence(
  signal: string,
  evidence: string,
  source: string,
  options?: {
    sourceUrl?: string;
    detectedAt?: string | Date;
    quality?: EvidenceQuality;
  }
): AIEvidenceItem {
  return {
    signal,
    evidence,
    source,
    sourceUrl: options?.sourceUrl,
    detectedAt: typeof options?.detectedAt === 'string'
      ? options.detectedAt
      : (options?.detectedAt instanceof Date
          ? options.detectedAt.toISOString()
          : new Date().toISOString()),
    quality: options?.quality || 'inferred',
    reliability: EVIDENCE_QUALITY_SCORES[options?.quality || 'inferred'],
  };
}

/**
 * Helper to create a score factor quickly.
 */
export function factor(
  category: string,
  label: string,
  points: number,
  maxPoints: number,
  evidence: string,
  source: string,
  weight?: number
): AIScoreFactor {
  return {
    category,
    label,
    points,
    maxPoints,
    evidence,
    source,
    weight: weight || Math.abs(points) / maxPoints,
  };
}
