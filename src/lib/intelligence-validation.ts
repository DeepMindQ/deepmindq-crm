/**
 * Intelligence Validation Engine (Phase 6)
 *
 * Captures human judgment against any intelligence artifact and
 * produces quality metrics. No LLM calls — pure aggregation from
 * IntelligenceValidation records.
 *
 * Answers four validation questions with real data:
 *   Q1: Are signal meanings accurate?
 *   Q2: Are capability matches commercially relevant?
 *   Q3: Do recommendations help decide "why now" and "what to position"?
 *   Q4: Does pursuit intelligence improve decision-making over time?
 *
 * Artifact types validated:
 *   - signal_meaning             (Q1)
 *   - capability_match           (Q2)
 *   - opportunity_recommendation (Q3)
 *   - pursuit_intelligence       (Q4)
 *   - evidence_quality           (evidence-focused validation)
 */

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

// ── Types ──

export const VALID_ARTIFACT_TYPES = [
  'signal_meaning',
  'capability_match',
  'opportunity_recommendation',
  'pursuit_intelligence',
  'evidence_quality',
] as const;

export type ArtifactType = (typeof VALID_ARTIFACT_TYPES)[number];

export const ACCURACY_OPTIONS = [
  'accurate',
  'partially_accurate',
  'inaccurate',
  'cannot_judge',
] as const;

export const RELEVANCE_OPTIONS = [
  'highly_relevant',
  'somewhat_relevant',
  'not_relevant',
] as const;

export const ACTIONABILITY_OPTIONS = [
  'actionable_now',
  'actionable_with_research',
  'not_actionable',
] as const;

export interface SubmitValidationParams {
  companyId: string;
  artifactType: ArtifactType;
  artifactId: string;
  rating: number;           // 1-5
  accuracy?: string | null;
  relevance?: string | null;
  actionability?: string | null;
  feedback?: string | null;
  validatorContext?: Record<string, unknown> | null;
  validatedBy?: string | null;
}

export interface ValidationRecord {
  id: string;
  companyId: string;
  validatedAt: Date;
  validatedBy: string | null;
  artifactType: string;
  artifactId: string;
  artifactSnapshot: unknown;
  rating: number;
  accuracy: string | null;
  relevance: string | null;
  actionability: string | null;
  feedback: string | null;
  validatorContext: unknown;
}

// ── Artifact Snapshot Loaders ──
// Each loader fetches the source artifact at validation time,
// returning only the fields relevant to quality assessment.

async function loadSignalMeaningSnapshot(signalId: string): Promise<Record<string, unknown> | null> {
  const signal = await db.companySignal.findUnique({
    where: { id: signalId },
    select: {
      signalType: true,
      title: true,
      description: true,
      severity: true,
      impact: true,
      confidence: true,
      meaningCategory: true,
      opportunityType: true,
    },
  });
  return signal as unknown as Record<string, unknown> | null;
}

async function loadCapabilityMatchSnapshot(matchId: string): Promise<Record<string, unknown> | null> {
  const match = await db.signalCapabilityMatch.findUnique({
    where: { id: matchId },
    select: {
      matchScore: true,
      reason: true,
      businessProblem: true,
      expectedOutcome: true,
      salesAngle: true,
      capabilityId: true,
      signalId: true,
    },
  });
  if (!match) return null;

  // Enrich with signal type and capability title
  const [signal, capability] = await Promise.all([
    db.companySignal.findUnique({ where: { id: match.signalId }, select: { signalType: true, title: true } }),
    db.capabilityAsset.findUnique({ where: { id: match.capabilityId }, select: { title: true, category: true } }),
  ]);

  return {
    ...match,
    signalType: signal?.signalType,
    signalTitle: signal?.title,
    capabilityTitle: capability?.title,
    capabilityCategory: capability?.category,
  } as unknown as Record<string, unknown>;
}

async function loadOpportunitySnapshot(oppId: string): Promise<Record<string, unknown> | null> {
  const opp = await db.opportunityRecommendation.findUnique({
    where: { id: oppId },
    select: {
      opportunityTitle: true,
      businessTrigger: true,
      whyNow: true,
      businessProblem: true,
      recommendedCapability: true,
      suggestedConversation: true,
      opportunityScore: true,
      confidenceScore: true,
      matchScore: true,
      freshnessScore: true,
      priority: true,
    },
  });
  return opp as unknown as Record<string, unknown> | null;
}

async function loadPursuitSnapshot(pursuitId: string): Promise<Record<string, unknown> | null> {
  const pursuit = await db.pursuit.findUnique({
    where: { id: pursuitId },
    select: {
      priority: true,
      status: true,
      nextAction: true,
      nextActionAt: true,
      outcome: true,
      outcomeStage: true,
      notes: true,
    },
  });
  return pursuit as unknown as Record<string, unknown> | null;
}

async function loadEvidenceQualitySnapshot(companyId: string): Promise<Record<string, unknown> | null> {
  // Load the evidence quality data for this company
  const { computeEvidenceQuality } = await import('./research-engine/evidence-quality');
  const eq = await computeEvidenceQuality(companyId);
  return {
    overall: eq.overall,
    coverage: eq.coverage,
    freshness: eq.freshness,
    sourceQuality: eq.sourceQuality,
    corroboration: eq.corroboration,
    volume: eq.volume,
    totalEvidence: eq.totalEvidence,
    activeEvidence: eq.activeEvidence,
    fieldsCovered: eq.fieldsCovered,
    totalFields: eq.totalFields,
    premiumSourceCount: eq.premiumSourceCount,
    lowSourceCount: eq.lowSourceCount,
    avgRecencyDays: eq.avgRecencyDays,
  };
}

const SNAPSHOT_LOADERS: Record<string, (id: string, companyId: string) => Promise<Record<string, unknown> | null>> = {
  signal_meaning: (id) => loadSignalMeaningSnapshot(id),
  capability_match: (id) => loadCapabilityMatchSnapshot(id),
  opportunity_recommendation: (id) => loadOpportunitySnapshot(id),
  pursuit_intelligence: (id) => loadPursuitSnapshot(id),
  evidence_quality: (id, companyId) => loadEvidenceQualitySnapshot(companyId),
};

// ── Submit Validation ──

export async function submitValidation(params: SubmitValidationParams): Promise<ValidationRecord> {
  const { companyId, artifactType, artifactId, rating, accuracy, relevance, actionability, feedback, validatorContext, validatedBy } = params;

  // Validate rating range
  const clampedRating = Math.max(1, Math.min(5, Math.round(rating)));

  // Load artifact snapshot at validation time
  const loader = SNAPSHOT_LOADERS[artifactType];
  let snapshot: Record<string, unknown> | null = null;
  if (loader) {
    try {
      snapshot = await loader(artifactId, companyId);
    } catch (err) {
      console.warn(
        `[validation] Failed to load snapshot for ${artifactType}/${artifactId}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  const record = await db.intelligenceValidation.create({
    data: {
      companyId,
      artifactType,
      artifactId,
      artifactSnapshot: (snapshot ?? Prisma.JsonNull) as any,
      artifactSnapshot: (snapshot ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
      rating: clampedRating,
      accuracy: accuracy || null,
      relevance: relevance || null,
      actionability: actionability || null,
      feedback: feedback || null,
      validatorContext: (validatorContext ?? Prisma.JsonNull) as any,
      validatorContext: (validatorContext ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
      validatedBy: validatedBy || null,
    },
  });

  return {
    id: record.id,
    companyId: record.companyId,
    validatedAt: record.validatedAt,
    validatedBy: record.validatedBy,
    artifactType: record.artifactType,
    artifactId: record.artifactId,
    artifactSnapshot: record.artifactSnapshot,
    rating: record.rating,
    accuracy: record.accuracy,
    relevance: record.relevance,
    actionability: record.actionability,
    feedback: record.feedback,
    validatorContext: record.validatorContext,
  };
}

// ── Get Company Validations ──

export interface CompanyValidationsOptions {
  artifactType?: ArtifactType;
  limit?: number;
  offset?: number;
}

export async function getCompanyValidations(
  companyId: string,
  options?: CompanyValidationsOptions,
): Promise<{ total: number; validations: ValidationRecord[] }> {
  const where: Prisma.IntelligenceValidationWhereInput = { companyId };
  if (options?.artifactType) {
    where.artifactType = options.artifactType;
  }

  const [total, validations] = await Promise.all([
    db.intelligenceValidation.count({ where }),
    db.intelligenceValidation.findMany({
      where,
      orderBy: { validatedAt: 'desc' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    }),
  ]);

  return {
    total,
    validations: validations.map((v) => ({
      id: v.id,
      companyId: v.companyId,
      validatedAt: v.validatedAt,
      validatedBy: v.validatedBy,
      artifactType: v.artifactType,
      artifactId: v.artifactId,
      artifactSnapshot: v.artifactSnapshot,
      rating: v.rating,
      accuracy: v.accuracy,
      relevance: v.relevance,
      actionability: v.actionability,
      feedback: v.feedback,
      validatorContext: v.validatorContext,
    })),
  };
}

// ── Quality Report ──

export interface QualityReport {
  totalValidations: number;
  overallAverageRating: number;
  byArtifactType: Record<string, ArtifactTypeMetrics>;
  accuracyDistribution: Record<string, { count: number; avgRating: number }>;
  relevanceDistribution: Record<string, { count: number; avgRating: number }>;
  actionabilityDistribution: Record<string, { count: number; avgRating: number }>;
  // Q1: Meaning accuracy by signal type
  meaningAccuracyBySignalType: Record<string, { count: number; avgRating: number; accuracyPct: Record<string, number> }>;
  // Q2: Match quality by capability
  matchQualityByCapability: Array<{ capabilityTitle: string; avgRating: number; count: number; relevancePct: Record<string, number> }>;
  // Q3: Recommendation actionability
  recommendationActionability: { actionableNow: number; actionableWithResearch: number; notActionable: number };
  // Q4: Pursuit intelligence trend
  pursuitTrend: Array<{ week: string; avgRating: number; count: number }>;
  // Evidence quality validation
  evidenceValidationSummary: { avgRating: number; count: number; accuracyPct: Record<string, number> } | null;
  // Low-rated patterns
  lowRatedPatterns: Array<{
    artifactType: string;
    artifactId: string;
    rating: number;
    accuracy: string | null;
    feedback: string | null;
  }>;
}

export async function getQualityReport(): Promise<QualityReport> {
  const allValidations = await db.intelligenceValidation.findMany({
    orderBy: { validatedAt: 'desc' },
  });

  if (allValidations.length === 0) {
    return {
      totalValidations: 0,
      overallAverageRating: 0,
      byArtifactType: {},
      accuracyDistribution: {},
      relevanceDistribution: {},
      actionabilityDistribution: {},
      meaningAccuracyBySignalType: {},
      matchQualityByCapability: [],
      recommendationActionability: { actionableNow: 0, actionableWithResearch: 0, notActionable: 0 },
      pursuitTrend: [],
      evidenceValidationSummary: null,
      lowRatedPatterns: [],
    };
  }

  // ── Overall metrics ──
  const overallAverageRating = Math.round(
    (allValidations.reduce((sum, v) => sum + v.rating, 0) / allValidations.length) * 10,
  ) / 10;

  // ── By artifact type (using accumulator) ──
  const byArtifactTypeRaw: Record<string, ArtifactTypeAccumulator> = {};
  for (const v of allValidations) {
    if (!byArtifactTypeRaw[v.artifactType]) {
      byArtifactTypeRaw[v.artifactType] = { count: 0, totalRating: 0, accuracyCounts: {}, relevanceCounts: {}, actionabilityCounts: {} };
    }
    const m = byArtifactTypeRaw[v.artifactType];
    m.count++;
    m.totalRating += v.rating;
    if (v.accuracy) m.accuracyCounts[v.accuracy] = (m.accuracyCounts[v.accuracy] || 0) + 1;
    if (v.relevance) m.relevanceCounts[v.relevance] = (m.relevanceCounts[v.relevance] || 0) + 1;
    if (v.actionability) m.actionabilityCounts[v.actionability] = (m.actionabilityCounts[v.actionability] || 0) + 1;
  }

  // Helper: convert accumulator to distribution output
  function toDistribution(buckets: Record<string, DistributionAccumulator>): Record<string, { count: number; avgRating: number }> {
    const out: Record<string, { count: number; avgRating: number }> = {};
    for (const [key, acc] of Object.entries(buckets)) {
      out[key] = {
        count: acc.count,
        avgRating: Math.round((acc.totalRating / acc.count) * 10) / 10,
      };
    }
    return out;
  }

  // ── Accuracy distribution ──
  const accBuckets: Record<string, DistributionAccumulator> = {};
  for (const v of allValidations) {
    const key = v.accuracy || 'unrated';
    if (!accBuckets[key]) accBuckets[key] = { count: 0, totalRating: 0 };
    accBuckets[key].count++;
    accBuckets[key].totalRating += v.rating;
  }
  const accuracyDistribution = toDistribution(accBuckets);

  // ── Relevance distribution ──
  const relBuckets: Record<string, DistributionAccumulator> = {};
  for (const v of allValidations) {
    const key = v.relevance || 'unrated';
    if (!relBuckets[key]) relBuckets[key] = { count: 0, totalRating: 0 };
    relBuckets[key].count++;
    relBuckets[key].totalRating += v.rating;
  }
  const relevanceDistribution = toDistribution(relBuckets);

  // ── Actionability distribution ──
  const actBuckets: Record<string, DistributionAccumulator> = {};
  for (const v of allValidations) {
    const key = v.actionability || 'unrated';
    if (!actBuckets[key]) actBuckets[key] = { count: 0, totalRating: 0 };
    actBuckets[key].count++;
    actBuckets[key].totalRating += v.rating;
  }
  const actionabilityDistribution = toDistribution(actBuckets);

  // ── Q1: Meaning accuracy by signal type ──
  const meaningValidations = allValidations.filter((v) => v.artifactType === 'signal_meaning');
  const meaningAccuracyBySignalType: QualityReport['meaningAccuracyBySignalType'] = {};

  if (meaningValidations.length > 0) {
    const signalIds = [...new Set(meaningValidations.map((v) => v.artifactId))];
    const signals = await db.companySignal.findMany({
      where: { id: { in: signalIds } },
      select: { id: true, signalType: true },
    });
    const signalTypeMap = new Map(signals.map((s) => [s.id, s.signalType]));

    const meaningRaw: Record<string, { count: number; totalRating: number; accuracyCounts: Record<string, number> }> = {};
    for (const v of meaningValidations) {
      const st = signalTypeMap.get(v.artifactId) || 'unknown';
      if (!meaningRaw[st]) {
        meaningRaw[st] = { count: 0, totalRating: 0, accuracyCounts: {} };
      }
      const m = meaningRaw[st];
      m.count++;
      m.totalRating += v.rating;
      if (v.accuracy) m.accuracyCounts[v.accuracy] = (m.accuracyCounts[v.accuracy] || 0) + 1;
    }

    for (const [key, m] of Object.entries(meaningRaw)) {
      const accuracyPct: Record<string, number> = {};
      for (const [acc, cnt] of Object.entries(m.accuracyCounts)) {
        accuracyPct[acc] = Math.round((cnt / m.count) * 100);
      }
      meaningAccuracyBySignalType[key] = {
        count: m.count,
        avgRating: Math.round((m.totalRating / m.count) * 10) / 10,
        accuracyPct,
      };
    }
  }

  // ── Q2: Match quality by capability ──
  const matchValidations = allValidations.filter((v) => v.artifactType === 'capability_match');
  const matchQualityByCapability: QualityReport['matchQualityByCapability'] = [];

  if (matchValidations.length > 0) {
    const matchIds = [...new Set(matchValidations.map((v) => v.artifactId))];
    const matches = await db.signalCapabilityMatch.findMany({
      where: { id: { in: matchIds } },
      select: { id: true, capabilityId: true },
    });
    const capIds = [...new Set(matches.map((m) => m.capabilityId).filter(Boolean))];
    const capabilities = capIds.length > 0
      ? await db.capabilityAsset.findMany({ where: { id: { in: capIds } }, select: { id: true, title: true } })
      : [];
    const capTitleMap = new Map(capabilities.map((c) => [c.id, c.title]));
    const matchCapMap = new Map(matches.map((m) => [m.id, capTitleMap.get(m.capabilityId) || 'Unknown']));

    const capStats: Record<string, { totalRating: number; count: number; relevanceCounts: Record<string, number> }> = {};
    for (const v of matchValidations) {
      const capTitle = matchCapMap.get(v.artifactId) || 'Unknown';
      if (!capStats[capTitle]) capStats[capTitle] = { totalRating: 0, count: 0, relevanceCounts: {} };
      capStats[capTitle].totalRating += v.rating;
      capStats[capTitle].count++;
      if (v.relevance) {
        capStats[capTitle].relevanceCounts[v.relevance] = (capStats[capTitle].relevanceCounts[v.relevance] || 0) + 1;
      }
    }

    for (const [title, stats] of Object.entries(capStats)) {
      const relevancePct: Record<string, number> = {};
      for (const [rel, cnt] of Object.entries(stats.relevanceCounts)) {
        relevancePct[rel] = Math.round((cnt / stats.count) * 100);
      }
      matchQualityByCapability.push({
        capabilityTitle: title,
        avgRating: Math.round((stats.totalRating / stats.count) * 10) / 10,
        count: stats.count,
        relevancePct,
      });
    }

    matchQualityByCapability.sort((a, b) => b.count - a.count);
  }

  // ── Q3: Recommendation actionability ──
  const recValidations = allValidations.filter((v) => v.artifactType === 'opportunity_recommendation');
  const recommendationActionability = { actionableNow: 0, actionableWithResearch: 0, notActionable: 0 };
  for (const v of recValidations) {
    if (v.actionability === 'actionable_now') recommendationActionability.actionableNow++;
    else if (v.actionability === 'actionable_with_research') recommendationActionability.actionableWithResearch++;
    else if (v.actionability === 'not_actionable') recommendationActionability.notActionable++;
  }

  // ── Q4: Pursuit intelligence trend (weekly) ──
  const pursuitValidations = allValidations.filter((v) => v.artifactType === 'pursuit_intelligence');
  const pursuitTrend: QualityReport['pursuitTrend'] = [];
  if (pursuitValidations.length > 0) {
    const weekBuckets: Record<string, { totalRating: number; count: number }> = {};
    for (const v of pursuitValidations) {
      const d = new Date(v.validatedAt);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      if (!weekBuckets[weekKey]) weekBuckets[weekKey] = { totalRating: 0, count: 0 };
      weekBuckets[weekKey].totalRating += v.rating;
      weekBuckets[weekKey].count++;
    }
    for (const [week, stats] of Object.entries(weekBuckets).sort()) {
      pursuitTrend.push({
        week,
        avgRating: Math.round((stats.totalRating / stats.count) * 10) / 10,
        count: stats.count,
      });
    }
  }

  // ── Evidence validation summary ──
  const evidenceValidations = allValidations.filter((v) => v.artifactType === 'evidence_quality');
  let evidenceValidationSummary: QualityReport['evidenceValidationSummary'] = null;
  if (evidenceValidations.length > 0) {
    const totalRating = evidenceValidations.reduce((sum, v) => sum + v.rating, 0);
    const accuracyCounts: Record<string, number> = {};
    for (const v of evidenceValidations) {
      if (v.accuracy) accuracyCounts[v.accuracy] = (accuracyCounts[v.accuracy] || 0) + 1;
    }
    const accuracyPct: Record<string, number> = {};
    for (const [acc, cnt] of Object.entries(accuracyCounts)) {
      accuracyPct[acc] = Math.round((cnt / evidenceValidations.length) * 100);
    }
    evidenceValidationSummary = {
      avgRating: Math.round((totalRating / evidenceValidations.length) * 10) / 10,
      count: evidenceValidations.length,
      accuracyPct,
    };
  }

  // ── Low-rated patterns (rating <= 2) ──
  const lowRated = allValidations
    .filter((v) => v.rating <= 2)
    .sort((a, b) => a.rating - b.rating)
    .slice(0, 20);

  const lowRatedPatterns = lowRated.map((v) => ({
    artifactType: v.artifactType,
    artifactId: v.artifactId,
    rating: v.rating,
    accuracy: v.accuracy,
    feedback: v.feedback,
  }));

  // ── Finalize byArtifactType ──
  const byArtifactType: Record<string, ArtifactTypeMetrics> = {};
  for (const [type, m] of Object.entries(byArtifactTypeRaw)) {
    byArtifactType[type] = {
      count: m.count,
      averageRating: Math.round((m.totalRating / m.count) * 10) / 10,
      accuracyPct: Object.fromEntries(
        Object.entries(m.accuracyCounts).map(([k, v]) => [k, Math.round((v / m.count) * 100)]),
      ),
      relevancePct: Object.fromEntries(
        Object.entries(m.relevanceCounts).map(([k, v]) => [k, Math.round((v / m.count) * 100)]),
      ),
      actionabilityPct: Object.fromEntries(
        Object.entries(m.actionabilityCounts).map(([k, v]) => [k, Math.round((v / m.count) * 100)]),
      ),
    };
  }

  return {
    totalValidations: allValidations.length,
    overallAverageRating,
    byArtifactType,
    accuracyDistribution,
    relevanceDistribution,
    actionabilityDistribution,
    meaningAccuracyBySignalType,
    matchQualityByCapability,
    recommendationActionability,
    pursuitTrend,
    evidenceValidationSummary,
    lowRatedPatterns,
  };
}

// ── Validation Trend (per artifact type) ──

export interface ValidationTrendPoint {
  week: string;
  avgRating: number;
  count: number;
}

export async function getValidationTrend(
  artifactType: ArtifactType,
  days: number = 90,
): Promise<ValidationTrendPoint[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const validations = await db.intelligenceValidation.findMany({
    where: {
      artifactType,
      validatedAt: { gte: since },
    },
    orderBy: { validatedAt: 'asc' },
  });

  if (validations.length === 0) return [];

  const weekBuckets: Record<string, { totalRating: number; count: number }> = {};
  for (const v of validations) {
    const d = new Date(v.validatedAt);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];
    if (!weekBuckets[weekKey]) weekBuckets[weekKey] = { totalRating: 0, count: 0 };
    weekBuckets[weekKey].totalRating += v.rating;
    weekBuckets[weekKey].count++;
  }

  return Object.entries(weekBuckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, stats]) => ({
      week,
      avgRating: Math.round((stats.totalRating / stats.count) * 10) / 10,
      count: stats.count,
    }));
}

// ── Internal type for aggregation ──

interface ArtifactTypeMetrics {
  count: number;
  averageRating: number;
  accuracyPct: Record<string, number>;
  relevancePct: Record<string, number>;
  actionabilityPct: Record<string, number>;
}

// Internal accumulator type (not exposed)
interface ArtifactTypeAccumulator {
  count: number;
  totalRating: number;
  accuracyCounts: Record<string, number>;
  relevanceCounts: Record<string, number>;
  actionabilityCounts: Record<string, number>;
}

interface DistributionAccumulator {
  count: number;
  totalRating: number;
}