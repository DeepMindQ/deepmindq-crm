/**
 * WI-17C — AI Recommendation Engine
 *
 * The unified recommendation layer that transforms ALL existing intelligence
 * into prioritized, actionable account recommendations.
 *
 * Architecture Principle: DO NOT rebuild scoring.
 * This engine AGGREGATES and REASONS over existing modules:
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │                    Data Sources (read-only)                  │
 *   │                                                             │
 *   │  AccountScore          → ICP fit + priority tier            │
 *   │  OpportunityRecommendation → per-signal opportunity scores   │
 *   │  CompanySignal         → buying signals, triggers           │
 *   │  SignalCapabilityMatch → capability alignment              │
 *   │  StrategicInsight      → AI reasoning insights              │
 *   │  AIEngagementStrategy  → engagement playbooks               │
 *   │  Knowledge Graph        → similar companies, patterns         │
 *   │  Memory                → enterprise context, patterns        │
 *   │  Unified Confidence    → trust grading                       │
 *   └─────────────────────┬───────────────────────────────────────┘
 *                         │
 *                         ▼
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │              WI-17C Recommendation Engine                    │
 *   │                                                             │
 *   │  1. Aggregate all intelligence per company                   │
 *   │  2. Enrich with KG (similar companies, patterns)            │
 *   │  3. Enrich with Memory (enterprise context)                  │
 *   │  4. Build recommendation with reasoning                      │
 *   │  5. Compute unified confidence for trust grading            │
 *   │  6. Rank accounts by recommendation score                   │
 *   │  7. Generate actionable output                               │
 *   └─────────────────────────────────────────────────────────────┘
 *
 *   Output per company:
 *     - Account name + priority tier
 *     - Opportunity Score (0-100)
 *     - Why: bullet points with evidence-backed reasons
 *     - Risk: identified risk factors
 *     - Recommended Action: specific next step with timeline
 *     - Confidence Grade (A+ to F)
 *     - Evidence Summary: linked signals + patterns
 *
 * Key Design Decisions:
 *   - Pure aggregation + reasoning: NO new scoring models
 *   - Every reason is evidence-backed: signal IDs, evidence chains
 *   - Graceful degradation: missing data dims down, never errors
 *   - Knowledge Graph enrichment is optional: enhances, never blocks
 *   - Memory context is optional: provides patterns, never required
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { computeUnifiedConfidence } from '@/lib/ai-unified-confidence';
import {
  generateRecommendations as kgRecommendations,
  expandFromEntity,
  getGraphStats,
} from '@/lib/ai-knowledge-graph';
import {
  searchMemories,
  buildMemoryContext,
  type MemoryRecallResult,
} from '@/lib/ai-memory';
import {
  getCalibrationAdjustments,
  type CalibrationAdjustment,
} from '@/lib/feedback-learning-loop';
import { getSignalValidationSummary } from '@/lib/signal-validation';
import { inferSignalMeaning, type MeaningCategory } from '@/lib/research-engine/signal-meaning';
import { ContinuousLearningLoop } from '@/lib/continuous-learning-loop';
import { adjustConfidence as adjustDecisionConfidence } from '@/lib/decision-learning';
import { transferLearningsToCompany, type CrossCompanyLearning } from '@/lib/cross-company-learning';
import { computeBlendedConfidence, type BlendedConfidenceResult } from '@/lib/blended-confidence';
import { getTenantWeights } from '@/lib/tenant-scoring-config';

// ── Types ─────────────────────────────────────────────────────────────

export type RecommendationPriority = 'critical' | 'high' | 'medium' | 'low';
export type RecommendationTier = 'HOT_ACCOUNT' | 'WARM_ACCOUNT' | 'NURTURE' | 'AT_RISK';

export interface RecommendationReason {
  /** Human-readable reason statement */
  text: string;
  /** Category of the reason */
  category: 'signal' | 'capability' | 'pattern' | 'timing' | 'contact' | 'similarity' | 'icp_fit' | 'cross_company_learning';
  /** How strong this reason is (0-1) */
  strength: number;
  /** Source signal/opportunity/insight ID if available */
  sourceId?: string;
  /** Source type for traceability */
  sourceType?: string;
}

export interface RecommendationRisk {
  /** Human-readable risk description */
  text: string;
  /** Severity of the risk */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Mitigation suggestion */
  mitigation?: string;
  /** Source signal ID if this risk comes from a signal */
  sourceId?: string;
}

export interface AccountRecommendation {
  /** Company ID */
  companyId: string;
  /** Company name */
  companyName: string;
  /** Company domain */
  companyDomain: string | null;
  /** Company industry */
  companyIndustry: string | null;

  // ── Scoring ──
  /** Composite opportunity score 0-100 */
  opportunityScore: number;
  /** Priority level */
  priority: RecommendationPriority;
  /** Account tier from AccountScore */
  tier: RecommendationTier;
  /** Confidence grade (A+ to F) */
  confidenceGrade: string;
  /** Confidence score (0-100) */
  confidenceScore: number;
  /** Is this recommendation enterprise-ready (confidence ≥ 70) */
  enterpriseReady: boolean;

  // ── Intelligence Summary ──
  /** Total signals */
  signalCount: number;
  /** Total opportunities */
  opportunityCount: number;
  /** Total capability matches */
  capabilityMatchCount: number;
  /** High-severity signal count */
  highSeveritySignalCount: number;
  /** Total contacts */
  contactCount: number;

  // ── Recommendation Content ──
  /** Why this account should be pursued */
  reasons: RecommendationReason[];
  /** Identified risk factors */
  risks: RecommendationRisk[];
  /** Recommended next action */
  recommendedAction: {
    /** Action description */
    text: string;
    /** Suggested timeline */
    timeline: string;
    /** Who to engage */
    /** @deprecated Use targetRoles instead. Kept for backward compatibility. */
    targetRole?: string;
    /** Phase 1: Dynamic target roles based on company size and signals */
    targetRoles?: string[];
    /** Conversation angle */
    conversationAngle?: string;
  };
  /** "Why this account?" one-liner */
  whyThisAccount: string;

  // ── Enrichment Sources ──
  /** Knowledge Graph insights (if available) */
  graphInsights?: {
    similarCompanies: number;
    relationshipPatterns: number;
  };
  /** Memory patterns (if available) */
  memoryPatterns?: {
    relevantMemories: number;
    enterpriseContext: string;
  };
  /** Top opportunity details */
  topOpportunity?: {
    title: string;
    score: number;
    signalType: string;
    whyNow: string;
  };

  // ── Decision Audit (Phase 3.4) ──
  /** SHA-256 hash of all input data used to produce this recommendation, for audit verification */
  decisionAuditHash: string;

  /** Data depth classification based on available intelligence dimensions (Phase 4.5.6) */
  dataDepthIndicator: 'comprehensive' | 'moderate' | 'limited' | 'minimal';

  // ── Metadata ──
  /** When this recommendation was generated */
  generatedAt: string;
  /** Confidence factors for explainability */
  confidenceFactors?: Array<{
    dimension: string;
    score: number;
    weight: number;
    explanation: string;
  }>;
}

export interface RecommendationListOptions {
  /** Maximum recommendations to return */
  limit?: number;
  /** Filter by priority tier */
  tier?: RecommendationTier;
  /** Filter by minimum score */
  minScore?: number;
  /** Include only companies with active signals */
  activeSignalsOnly?: boolean;
  /** Sort by field */
  sortBy?: 'opportunityScore' | 'confidenceScore' | 'signalCount' | 'recentActivity';
  /** Phase 1: Enable low-trust blocking. Default: true */
  enableTrustBlocking?: boolean;
  /** Phase 1: Enable dynamic target roles. Default: true */
  enableDynamicTargetRoles?: boolean;
}

export interface RecommendationListResult {
  recommendations: AccountRecommendation[];
  total: number;
  filteredBy: {
    tier?: RecommendationTier;
    minScore?: number;
    activeSignalsOnly?: boolean;
  };
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    averageScore: number;
    averageConfidence: number;
  };
  generatedAt: string;
  latencyMs: number;
}

// ── Recommendation Score Weights ──

const SCORE_WEIGHTS = {
  accountScore: 0.30,      // Existing AccountScore (ICP fit + priority)
  opportunityScore: 0.30,   // Best OpportunityRecommendation score
  signalStrength: 0.15,    // Signal recency × severity × confidence
  capabilityMatch: 0.10,   // Best capability match score
  engagementReadiness: 0.15, // Contact coverage + enrichment level
} as const;

/**
 * Apply calibration adjustments from the feedback learning loop to a raw score.
 *
 * For each matching adjustment, the score is shifted by magnitude (as a fraction of 100).
 * Company-specific adjustments take priority over reason-specific ones.
 * Returns the calibrated score clamped to [0, 100].
 */
export function applyCalibrationToScore(
  rawScore: number,
  companyId: string,
  adjustments: CalibrationAdjustment[],
): { calibratedScore: number; appliedAdjustments: CalibrationAdjustment[] } {
  if (adjustments.length === 0) {
    return { calibratedScore: rawScore, appliedAdjustments: [] };
  }

  const applied: CalibrationAdjustment[] = [];
  let totalShift = 0;

  for (const adj of adjustments) {
    // Company-specific adjustments apply directly
    if (adj.pattern === `company:${companyId}`) {
      const shift = adj.direction === 'up' ? adj.magnitude * 100 : -adj.magnitude * 100;
      totalShift += shift;
      applied.push(adj);
    }
    // Reason/signal-type/technology-detection adjustments also apply (dampened)
    else if (
      adj.pattern.startsWith('reason:') ||
      adj.pattern === 'signal_detection_accuracy' ||
      adj.pattern === 'technology_detection'
    ) {
      const shift = adj.direction === 'up' ? adj.magnitude * 100 : -adj.magnitude * 100;
      // Reason-level adjustments are dampened (they're less specific)
      totalShift += shift * 0.5;
      applied.push(adj);
    }
  }

  return {
    calibratedScore: Math.max(0, Math.min(100, Math.round(rawScore + totalShift))),
    appliedAdjustments: applied,
  };
}

// ── Core Engine ─────────────────────────────────────────────────────────

/**
 * Generate recommendations for ALL companies in the system.
 * Returns prioritized list of account recommendations.
 */
export async function generateAllRecommendations(
  options: RecommendationListOptions = {}
): Promise<RecommendationListResult> {
  const startTime = Date.now();

  const {
    limit = 50,
    tier,
    minScore = 0,
    activeSignalsOnly = false,
    sortBy = 'opportunityScore',
  } = options;

  // ── Step 1: Fetch all companies with intelligence data ──
  const whereClause: Record<string, unknown> = {
      status: { not: 'archived' },
    };
    if (tier) whereClause.accountScore = { some: { category: tier } };
    if (activeSignalsOnly) whereClause.signals = { some: {} };

  const companies = await db.company.findMany({
    where: whereClause as any,
    select: {
      id: true,
      rawName: true,
      domain: true,
      industry: true,
      intelligenceScore: true,
      lastEnrichedAt: true,
      sizeRange: true,
      location: true,
      country: true,
      source: true,
      status: true,
      _count: {
        select: {
          contacts: true,
          signals: true,
          evidence: true,
          opportunityRecommendations: true,
          strategicInsights: true,
        },
      },
    },
    take: 200, // Reasonable batch size
  });

  if (companies.length === 0) {
    return {
      recommendations: [],
      total: 0,
      filteredBy: { tier, minScore, activeSignalsOnly },
      summary: { critical: 0, high: 0, medium: 0, low: 0, averageScore: 0, averageConfidence: 0 },
      generatedAt: new Date().toISOString(),
      latencyMs: Date.now() - startTime,
    };
  }

  // ── Step 2: Fetch intelligence data for all companies in parallel batches ──
  const companyIds = companies.map(c => c.id);

  // Batch fetch: AccountScores
  const accountScores = await db.accountScore.findMany({
    where: { companyId: { in: companyIds } },
    take: 1000,
  });
  const scoreMap = new Map(accountScores.map(s => [s.companyId, s]));

  // Batch fetch: Top opportunities per company
  const topOpportunities = await db.opportunityRecommendation.findMany({
    where: { companyId: { in: companyIds } },
    orderBy: { opportunityScore: 'desc' },
    take: 1000,
  });
  const oppMap = new Map<string, typeof topOpportunities[0][]>();
  for (const opp of topOpportunities) {
    const arr = oppMap.get(opp.companyId) || [];
    arr.push(opp);
    oppMap.set(opp.companyId, arr);
  }

  // Batch fetch: High-severity signals
  const highSignals = await db.companySignal.findMany({
    where: {
      companyId: { in: companyIds },
      severity: { in: ['critical', 'high'] },
    },
    orderBy: { signalDate: 'desc' },
    take: 1000,
  });
  const signalMap = new Map<string, typeof highSignals[0][]>();
  for (const sig of highSignals) {
    const arr = signalMap.get(sig.companyId) || [];
    arr.push(sig);
    signalMap.set(sig.companyId, arr);
  }

  // Batch fetch: Capability matches
  const capMatches = await db.signalCapabilityMatch.findMany({
    where: { companyId: { in: companyIds } },
    include: { capability: { select: { title: true, category: true } } },
    orderBy: { matchScore: 'desc' },
    take: 1000,
  });
  const capMap = new Map<string, typeof capMatches[0][]>();
  for (const cm of capMatches) {
    const arr = capMap.get(cm.companyId) || [];
    arr.push(cm);
    capMap.set(cm.companyId, arr);
  }

  // Batch fetch: Strategic insights
  const insights = await db.strategicInsight.findMany({
    where: { companyId: { in: companyIds } },
    orderBy: { confidenceScore: 'desc' },
    take: 1000,
  });
  const insightMap = new Map<string, typeof insights[0][]>();
  for (const ins of insights) {
    const arr = insightMap.get(ins.companyId) || [];
    arr.push(ins);
    insightMap.set(ins.companyId, arr);
  }

  // ── Step 3: Check Knowledge Graph availability ──
  let kgAvailable = false;
  try {
    const stats = getGraphStats();
    kgAvailable = stats.totalNodes > 0;
  } catch (_) { /* KG not seeded or unavailable */ }

  // ── Step 3.5: Fetch calibration adjustments from feedback learning loop ──
  // This is the circuit closure: feedback → calibration → score adjustment
  // Fetch both system-wide adjustments and per-company adjustments
  let calibrationAdjustments: CalibrationAdjustment[] = [];
  try {
    // System-wide adjustments (signal type accuracy, etc.)
    calibrationAdjustments = await getCalibrationAdjustments();

    // Per-company adjustments: fetch for each company and merge
    for (const company of companies) {
      const companyAdjs = await getCalibrationAdjustments(company.id);
      calibrationAdjustments.push(...companyAdjs);
    }

    if (calibrationAdjustments.length > 0) {
      logger.info(`[RecommendationEngine] Applied ${calibrationAdjustments.length} calibration adjustments from feedback loop`);
    }
  } catch (err) {
    logger.warn(`[RecommendationEngine] Calibration fetch failed, using raw scores: ${err instanceof Error ? err.message : err}`);
  }

  // ── Step 4: Generate per-company recommendations ──
  const recommendations: AccountRecommendation[] = [];

  for (const company of companies) {
    try {
      const rec = await buildCompanyRecommendation(company as unknown as Parameters<typeof buildCompanyRecommendation>[0], {
        accountScore: scoreMap.get(company.id) as any,
        opportunities: oppMap.get(company.id) || [],
        highSignals: signalMap.get(company.id) || [],
        capabilityMatches: capMap.get(company.id) || [],
        insights: insightMap.get(company.id) || [],
        kgAvailable,
        calibrationAdjustments,
        enableTrustBlocking: options.enableTrustBlocking,
      });

      if (rec.opportunityScore >= minScore) {
        recommendations.push(rec);
      }
    } catch (err) {
      logger.warn(`[RecommendationEngine] Failed for ${company.rawName}: ${err instanceof Error ? err.message : err}`);
    }
  }

  // ── Step 5: Sort ──
  switch (sortBy) {
    case 'confidenceScore':
      recommendations.sort((a, b) => b.confidenceScore - a.confidenceScore);
      break;
    case 'signalCount':
      recommendations.sort((a, b) => b.signalCount - a.signalCount);
      break;
    case 'recentActivity':
      // Use opportunityScore as proxy for recent activity (signals feed it)
      recommendations.sort((a, b) => b.opportunityScore - a.opportunityScore);
      break;
    default:
      recommendations.sort((a, b) => b.opportunityScore - a.opportunityScore);
  }

  // ── Step 6: Build summary ──
  const summary = {
    critical: recommendations.filter(r => r.priority === 'critical').length,
    high: recommendations.filter(r => r.priority === 'high').length,
    medium: recommendations.filter(r => r.priority === 'medium').length,
    low: recommendations.filter(r => r.priority === 'low').length,
    averageScore: recommendations.length > 0
      ? Math.round(recommendations.reduce((sum, r) => sum + r.opportunityScore, 0) / recommendations.length)
      : 0,
    averageConfidence: recommendations.length > 0
      ? Math.round(recommendations.reduce((sum, r) => sum + r.confidenceScore, 0) / recommendations.length)
      : 0,
  };

  return {
    recommendations: recommendations.slice(0, limit),
    total: recommendations.length,
    filteredBy: { tier, minScore, activeSignalsOnly },
    summary,
    generatedAt: new Date().toISOString(),
    latencyMs: Date.now() - startTime,
  };
}

/**
 * Compute data depth indicator based on available intelligence dimensions.
 *
 * Comprehensive: 4+ signal types available with good coverage
 * Moderate: 3 signal types with reasonable coverage
 * Limited: 2 signal types with sparse coverage
 * Minimal: 1 or fewer signal types
 *
 * (Phase 4 — Item 5.6)
 */
function computeDataDepthIndicator(
  signalCount: number,
  opportunityCount: number,
  capabilityMatchCount: number,
  contactCount: number,
): 'comprehensive' | 'moderate' | 'limited' | 'minimal' {
  const dimensionScores = [
    signalCount >= 5 ? 2 : signalCount >= 2 ? 1 : 0,
    opportunityCount >= 3 ? 2 : opportunityCount >= 1 ? 1 : 0,
    capabilityMatchCount >= 3 ? 2 : capabilityMatchCount >= 1 ? 1 : 0,
    contactCount >= 5 ? 2 : contactCount >= 1 ? 1 : 0,
  ];
  const total = dimensionScores.reduce((sum, s) => sum + s, 0);
  if (total >= 7) return 'comprehensive';
  if (total >= 4) return 'moderate';
  if (total >= 2) return 'limited';
  return 'minimal';
}

/**
 * Generate recommendation for a SINGLE company.
 * This is the detailed view — used in Company Workspace.
 */
export async function generateCompanyRecommendation(
  companyId: string,
  tenantId?: string,
): Promise<AccountRecommendation | null> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      rawName: true,
      domain: true,
      industry: true,
      intelligenceScore: true,
      lastEnrichedAt: true,
      sizeRange: true,
      location: true,
      country: true,
      source: true,
      status: true,
      _count: {
        select: {
          contacts: true,
          signals: true,
          evidence: true,
          opportunityRecommendations: true,
          strategicInsights: true,
        },
      },
    },
  });

  if (!company) return null;

  // Fetch all intelligence data for this company
  const [accountScore, opportunities, signals, capabilityMatches, insights] = await Promise.all([
    db.accountScore.findFirst({ where: { companyId } }),
    db.opportunityRecommendation.findMany({
      where: { companyId },
      orderBy: { opportunityScore: 'desc' },
      take: 10,
    }),
    db.companySignal.findMany({
      where: { companyId },
      orderBy: { signalDate: 'desc' },
      take: 20,
    }),
    db.signalCapabilityMatch.findMany({
      where: { companyId },
      include: { capability: { select: { title: true, category: true } } },
      orderBy: { matchScore: 'desc' },
      take: 10,
    }),
    db.strategicInsight.findMany({
      where: { companyId },
      orderBy: { confidenceScore: 'desc' },
      take: 5,
    }),
  ]);

  const highSignals = signals.filter(s => ['critical', 'high'].includes(s.severity));

  let kgAvailable = false;
  try {
    const stats = getGraphStats();
    kgAvailable = stats.totalNodes > 0;
  } catch (_) { /* KG not available */ }

  return buildCompanyRecommendation(company, {
    accountScore: accountScore as any,
    opportunities,
    highSignals,
    capabilityMatches,
    insights,
    kgAvailable,
    tenantId,
  });
}

// ── Internal: Count open contradictions for a company ─────────────────

async function getOpenConflictCount(companyId: string): Promise<number> {
  try {
    const count = await db.intelligenceConflict.count({
      where: { companyId, status: 'open' },
    });
    return count;
  } catch {
    return 0; // Graceful degradation — table may not exist in early deployments
  }
}

// ── Internal: Build a single company recommendation ─────────────────────

async function buildCompanyRecommendation(
  company: {
    id: string;
    rawName: string;
    domain: string | null;
    industry: string | null;
    intelligenceScore: number | null;
    lastEnrichedAt: Date | null;
    sizeRange: string | null;
    location: string | null;
    country: string | null;
    source: string | null;
    status: string | null;
    _count: { contacts: number; signals: number; evidence: number; opportunityRecommendations: number; strategicInsights: number };
  },
  data: {
    accountScore: { score: number; scoreBreakdown: any; category: string } | null;
    opportunities: Array<{
      id: string;
      opportunityTitle: string;
      opportunityScore: number;
      priority: string;
      signalId: string;
      whyNow: string;
      businessProblem: string;
      recommendedCapability: string;
      confidenceScore: number;
      status: string;
    }>;
    highSignals: Array<{
      id: string;
      signalType: string;
      title: string;
      severity: string;
      confidence: number;
      impact: string;
      signalDate: Date | null;
      recommendedAction: string | null;
      timingWindow: string | null;
    }>;
    capabilityMatches: Array<{
      id: string;
      matchScore: number;
      capability: { title: string; category: string | null } | null;
    }>;
    insights: Array<{
      id: string;
      insightType: string;
      summary: string;
      confidenceScore: number;
    }>;
    kgAvailable: boolean;
    calibrationAdjustments?: CalibrationAdjustment[];
    /** Tenant ID for tenant-specific weight overrides. */
    tenantId?: string;
    /** Phase 1 Item 4.6: Disable trust blocking. Default: true (blocking enabled). */
    enableTrustBlocking?: boolean;
  }
): Promise<AccountRecommendation> {
  // ── Step 1: Build recommendation reasons ──
  const reasons: RecommendationReason[] = [];

  // Reason: High-severity signals
  for (const signal of data.highSignals.slice(0, 5)) {
    const daysAgo = signal.signalDate
      ? Math.floor((Date.now() - signal.signalDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    let timingText = '';
    if (daysAgo !== null) {
      if (daysAgo <= 7) timingText = ` (${daysAgo} days ago)`;
      else if (daysAgo <= 30) timingText = ` (${Math.floor(daysAgo / 7)} weeks ago)`;
      else timingText = ` (${Math.floor(daysAgo / 30)} months ago)`;
    }

    reasons.push({
      text: `${signal.title}${timingText}`,
      category: 'signal',
      strength: signal.confidence,
      sourceId: signal.id,
      sourceType: 'CompanySignal',
    });
  }

  // Reason: Strong opportunity exists
  const bestOpp = data.opportunities[0];
  if (bestOpp && bestOpp.opportunityScore >= 60) {
    reasons.push({
      text: `Strong opportunity: ${bestOpp.opportunityTitle} (${bestOpp.opportunityScore}/100)`,
      category: 'capability',
      strength: bestOpp.opportunityScore / 100,
      sourceId: bestOpp.id,
      sourceType: 'OpportunityRecommendation',
    });
  }

  // Reason: Capability matches
  if (data.capabilityMatches.length > 0) {
    const topCap = data.capabilityMatches[0];
    reasons.push({
      text: `${data.capabilityMatches.length} capability match${data.capabilityMatches.length > 1 ? 'es' : ''} detected — best fit: ${topCap.capability?.title || 'Unknown'} (${Math.round(topCap.matchScore * 100)}%)`,
      category: 'capability',
      strength: topCap.matchScore,
      sourceId: topCap.id,
      sourceType: 'SignalCapabilityMatch',
    });
  }

  // Reason: Strategic insights
  for (const insight of data.insights.slice(0, 2)) {
    if (insight.insightType === 'OPPORTUNITY' || insight.insightType === 'STRATEGIC_SHIFT') {
      reasons.push({
        text: insight.summary,
        category: 'pattern',
        strength: insight.confidenceScore / 100,
        sourceId: insight.id,
        sourceType: 'StrategicInsight',
      });
    }
  }

  // Reason: ICP fit (from AccountScore)
  if (data.accountScore) {
    const breakdown = typeof data.accountScore.scoreBreakdown === 'string'
      ? JSON.parse(data.accountScore.scoreBreakdown)
      : data.accountScore.scoreBreakdown;

    if (breakdown?.staticFit?.score >= 60) {
      reasons.push({
        text: `Strong ICP fit (fit score: ${Math.round(breakdown.staticFit.score)})`,
        category: 'icp_fit',
        strength: breakdown.staticFit.score / 100,
        sourceType: 'AccountScore',
      });
    }
  }

  // Reason: Timing — recent high-confidence signal
  const recentHighSignal = data.highSignals.find(s =>
    s.signalDate && (Date.now() - s.signalDate.getTime()) < 30 * 24 * 60 * 60 * 1000
  );
  if (recentHighSignal) {
    reasons.push({
      text: `Active buying signal within 30 days: ${recentHighSignal.title}`,
      category: 'timing',
      strength: 0.9,
      sourceId: recentHighSignal.id,
      sourceType: 'CompanySignal',
    });
  }

  // Reason: Contact coverage
  if (company._count.contacts >= 3) {
    reasons.push({
      text: `${company._count.contacts} contacts identified — good coverage for multi-threaded outreach`,
      category: 'contact',
      strength: Math.min(1.0, company._count.contacts / 5),
      sourceType: 'Contact',
    });
  }

  // ── Step 2: Enrich with Knowledge Graph ──
  let graphInsights: AccountRecommendation['graphInsights'];

  if (data.kgAvailable) {
    try {
      // Try to find similar companies via KG
      const kgRecs = kgRecommendations({
        entityId: company.id,
        type: 'similar_companies',
        maxHops: 2,
        minWeight: 0.3,
        limit: 5,
      });

      if (kgRecs.length > 0) {
        graphInsights = {
          similarCompanies: kgRecs.length,
          relationshipPatterns: kgRecs.filter(r => r.signals.length > 0).length,
        };

        // Add similarity-based reason
        const topSimilar = kgRecs[0];
        if (topSimilar.confidence > 0.5) {
          reasons.push({
            text: `Similar to ${topSimilar.entity.label} — ${topSimilar.reason}`,
            category: 'similarity',
            strength: topSimilar.confidence,
            sourceType: 'KnowledgeGraph',
          });
        }
      }
    } catch (_) {
      // KG enrichment failed — non-blocking
    }
  }

  // ── Step 3: Enrich with Memory ──
  let memoryPatterns: AccountRecommendation['memoryPatterns'];

  try {
    const memories = searchMemories({
      query: company.rawName,
      category: ['company_intelligence'] as any,
      minConfidence: 0.5,
      limit: 5,
    });

    if (memories.length > 0) {
      const topMemory = memories[0];
      memoryPatterns = {
        relevantMemories: memories.length,
        enterpriseContext: topMemory.memory.summary || topMemory.matchReason,
      };
    }
  } catch (_) {
    // Memory enrichment failed — non-blocking
  }

  // ── Step 3b: Enrich with Reusable Learnings ──
  try {
    const reusableLearnings = await ContinuousLearningLoop.findReusableLearnings({
      industry: company.industry || undefined,
      companySize: company.sizeRange || undefined,
      technology: undefined, // TODO: extract from signals or research card when available
    });

    if (reusableLearnings.length > 0) {
      // Mark learnings as reused and boost recommendation confidence
      const topInsights = reusableLearnings.slice(0, 3);
      for (const learning of topInsights) {
        ContinuousLearningLoop.markReused(learning.id).catch(() => {});
      }

      if (memoryPatterns) {
        memoryPatterns.enterpriseContext += `\n\nReusable Learnings:\n${topInsights.map(l => `- ${l.insight} (source: ${l.source}, reused ${l.reuseCount}x)`).join('\n')}`;
      } else {
        memoryPatterns = {
          relevantMemories: 0,
          enterpriseContext: `Reusable Learnings:\n${topInsights.map(l => `- ${l.insight} (source: ${l.source}, reused ${l.reuseCount}x)`).join('\n')}`,
        };
      }
    }
  } catch (_) {
    // Learning enrichment failed — non-blocking
  }

  // ── Step 3c: Cross-Company Learning Transfer (S4-2.3) ──
  // Find learnings from similar companies via KG and transfer them.
  try {
    const crossCompanyResult = await transferLearningsToCompany(company.id, {
      industry: company.industry || undefined,
      companySize: company.sizeRange || undefined,
      maxLearnings: 3,
    });

    if (crossCompanyResult.transferCount > 0) {
      const crossInsights = crossCompanyResult.learnings.slice(0, 3);
      const crossInsightText = crossInsights.map(l =>
        `- [${l.sourceCompanyName}] ${l.insight} (confidence: ${l.transferConfidence})`
      ).join('\n');

      if (memoryPatterns) {
        memoryPatterns.enterpriseContext += `\n\nCross-Company Learnings (${crossCompanyResult.similarCompaniesScanned} companies scanned):\n${crossInsightText}`;
      } else {
        memoryPatterns = {
          relevantMemories: 0,
          enterpriseContext: `Cross-Company Learnings (${crossCompanyResult.similarCompaniesScanned} companies scanned):\n${crossInsightText}`,
        };
      }

      // Add a reason for cross-company learning boost
      reasons.push({
        text: `${crossCompanyResult.transferCount} learnings transferred from ${crossCompanyResult.similarCompaniesScanned} similar companies`,
        category: 'cross_company_learning',
        strength: Math.min(0.8, crossCompanyResult.transferCount * 0.25),
        sourceType: 'CrossCompanyLearning',
      });
    }
  } catch (_) {
    // Cross-company learning failed — non-blocking
  }

  // ── Step 4: Build risks ──
  const risks: RecommendationRisk[] = [];

  // Risk: No contacts
  if (company._count.contacts === 0) {
    risks.push({
      text: 'No contacts identified — no clear path to decision makers',
      severity: 'high',
      mitigation: 'Enrich contacts via research or manual entry before outreach',
    });
  }

  // Risk: Low enrichment
  if (!company.lastEnrichedAt) {
    risks.push({
      text: 'Never enriched — intelligence data may be incomplete',
      severity: 'medium',
      mitigation: 'Run intelligence enrichment to validate and expand data',
    });
  }

  // Risk: Stale data
  if (company.lastEnrichedAt) {
    const daysSinceEnrichment = Math.floor(
      (Date.now() - company.lastEnrichedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceEnrichment > 60) {
      risks.push({
        text: `Data is ${daysSinceEnrichment} days old — signals may be outdated`,
        severity: daysSinceEnrichment > 90 ? 'high' : 'medium',
        mitigation: 'Re-run intelligence enrichment to refresh signals',
      });
    }
  }

  // Risk: No evidence backing
  if (company._count.evidence === 0 && company._count.signals > 0) {
    risks.push({
      text: 'Signals exist without corroborating evidence',
      severity: 'medium',
      mitigation: 'Verify signal accuracy through additional research',
    });
  }

  // Risk: Competition signals
  const competitionSignals = data.highSignals.filter(s =>
    s.signalType === 'competitive' || s.title.toLowerCase().includes('compet') || s.title.toLowerCase().includes('vendor')
  );
  for (const compSig of competitionSignals.slice(0, 2)) {
    risks.push({
      text: compSig.title,
      severity: compSig.severity === 'critical' ? 'critical' : 'high',
      sourceId: compSig.id,
    });
  }

  // Risk: Low confidence signals
  if (data.highSignals.length > 0) {
    const lowConfSignals = data.highSignals.filter(s => s.confidence < 0.5);
    if (lowConfSignals.length > 0) {
      risks.push({
        text: `${lowConfSignals.length} signal${lowConfSignals.length > 1 ? 's' : ''} with low confidence (<50%) — verify before acting`,
        severity: 'low',
        mitigation: 'Cross-reference with external sources before outreach',
      });
    }
  }

  // ── Step 5: Compute composite recommendation score ──
  // Load tenant-specific weights if available
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let activeWeights: any = { ...SCORE_WEIGHTS };
  if (data.tenantId) {
    try {
      const tenantRecWeights = await getTenantWeights(data.tenantId, 'recommendation');
      if (tenantRecWeights) {
        activeWeights = {
          accountScore: tenantRecWeights.accountScore ?? SCORE_WEIGHTS.accountScore,
          opportunityScore: tenantRecWeights.opportunityScore ?? SCORE_WEIGHTS.opportunityScore,
          signalStrength: tenantRecWeights.signalStrength ?? SCORE_WEIGHTS.signalStrength,
          capabilityMatch: tenantRecWeights.capabilityMatch ?? SCORE_WEIGHTS.capabilityMatch,
          engagementReadiness: tenantRecWeights.engagementReadiness ?? SCORE_WEIGHTS.engagementReadiness,
        };
      }
    } catch {
      // Non-blocking — use default weights
    }
  }

  const accountScoreVal = data.accountScore?.score ?? company.intelligenceScore ?? 0;
  const bestOppScore = bestOpp?.opportunityScore ?? 0;
  const signalStrength = data.highSignals.length > 0
    ? Math.max(...data.highSignals.slice(0, 3).map(s => s.confidence * 100))
    : 0;
  const bestCapScore = data.capabilityMatches.length > 0
    ? data.capabilityMatches[0].matchScore * 100
    : 0;
  const engagementReadiness = Math.min(100, company._count.contacts * 20 + (company.lastEnrichedAt ? 30 : 0) + (company._count.evidence > 0 ? 20 : 0));

  // ── Phase 3.4: Compute decision audit hash BEFORE any calibration/adjustment ──
  const generatedAt = new Date().toISOString();
  const sortedSignalIds = data.highSignals.map(s => s.id).sort();
  const sortedEvidenceIds: string[] = []; // evidence IDs from opportunities/capabilities
  for (const opp of data.opportunities) sortedEvidenceIds.push(opp.id);
  for (const cap of data.capabilityMatches) sortedEvidenceIds.push(cap.id);
  sortedEvidenceIds.sort();

  const rawOpportunityScore = Math.round(
    accountScoreVal * activeWeights.accountScore +
    bestOppScore * activeWeights.opportunityScore +
    signalStrength * activeWeights.signalStrength +
    bestCapScore * activeWeights.capabilityMatch +
    engagementReadiness * activeWeights.engagementReadiness
  );

  // ── Step 5.5: Apply calibration adjustments from feedback learning loop ──
  // THIS IS THE CIRCUIT CLOSURE: feedback → stored → calibrated → score adjusted
  const { calibratedScore, appliedAdjustments } = applyCalibrationToScore(
    rawOpportunityScore,
    company.id,
    data.calibrationAdjustments || [],
  );

  // Add calibration as a visible reason so users can see why scores shifted
  for (const adj of appliedAdjustments) {
    reasons.push({
      text: adj.reason,
      category: 'pattern',
      strength: adj.magnitude,
      sourceId: `calibration:${adj.pattern}`,
    });
  }

  const opportunityScore = calibratedScore;

  // ── Step 5b: Multi-source confidence blending (S4-2.4) ──
  // Blends: base score, calibration delta, decision-learning effectiveness,
  // KG evidence chain confidence, memory match quality, and evidence quality.
  let decisionAdjustedScore = opportunityScore;
  let blendedConfidenceBreakdown: BlendedConfidenceResult | null = null;
  try {
    if (data.opportunities.length > 0) {
      const agentType = data.opportunities[0].recommendedCapability || 'recommendation';
      const calibrationDelta = opportunityScore - rawOpportunityScore;

      blendedConfidenceBreakdown = await computeBlendedConfidence({
        baseScore: opportunityScore,
        calibrationDelta,
        agentType,
        companyId: company.id,
        kgConfidence: graphInsights && graphInsights.similarCompanies > 0
          ? Math.min(95, 50 + graphInsights.similarCompanies * 10) : undefined,
        memoryConfidence: memoryPatterns && memoryPatterns.relevantMemories > 0
          ? Math.min(90, 50 + memoryPatterns.relevantMemories * 8) : undefined,
        evidenceQuality: company._count.evidence > 0
          ? Math.min(90, 50 + company._count.evidence * 5) : undefined,
      });

      decisionAdjustedScore = blendedConfidenceBreakdown.blendedScore;
    }
  } catch (_) { /* non-blocking: blended confidence unavailable, fall back to base */ }

  // ── Step 6: Determine priority ──
  let priority: RecommendationPriority;
  if (decisionAdjustedScore >= 80) {
    priority = 'critical';
  } else if (decisionAdjustedScore >= 60) {
    priority = 'high';
  } else if (decisionAdjustedScore >= 35) {
    priority = 'medium';
  } else {
    priority = 'low';
  }

  // ── Step 7: Compute unified confidence ──
  const daysSinceEnrichment = company.lastEnrichedAt
    ? Math.floor((Date.now() - company.lastEnrichedAt.getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  let confidenceResult = null;
  try {
    confidenceResult = computeUnifiedConfidence({
      entityId: company.id,
      entityType: 'company',
      fieldConfidence: {
        name: 1.0,
        domain: company.domain ? 0.9 : 0.2,
        industry: company.industry ? 0.8 : 0.1,
        size: company.sizeRange ? 0.7 : 0.1,
        location: company.location ? 0.8 : 0.1,
        contacts: Math.min(1.0, company._count.contacts / 5),
      },
      dataCompleteness: [
        company.rawName ? 1 : 0,
        company.domain ? 1 : 0,
        company.industry ? 1 : 0,
        company.location ? 1 : 0,
        company._count.contacts > 0 ? 1 : 0,
        company.lastEnrichedAt ? 1 : 0,
        company._count.signals > 0 ? 1 : 0,
      ].reduce((a, b) => a + b, 0) / 7,
      sources: company.source === 'manual'
        ? [{ name: 'manual_entry', reliability: 0.95, type: 'internal' }]
        : [{ name: 'data_import', reliability: 0.75, type: 'csv_import' }],
      averageSourceReliability: company.source === 'manual' ? 0.95 : 0.75,
      daysSinceResearch: daysSinceEnrichment,
      freshnessScore: company.lastEnrichedAt ? Math.max(0, 100 - daysSinceEnrichment * 2) : 0,
      crossValidatedFacts: company._count.evidence,
      totalFacts: company._count.signals + company._count.evidence,
      contradictions: await getOpenConflictCount(company.id),
      evidenceCount: company._count.evidence,
      evidenceCoverage: company._count.signals > 0
        ? Math.min(1.0, company._count.evidence / 5)
        : 0,
      coveredDimensions: [
        company.rawName ? 1 : 0,
        company.domain ? 1 : 0,
        company.industry ? 1 : 0,
        company.sizeRange ? 1 : 0,
        company.location ? 1 : 0,
        company._count.contacts > 0 ? 1 : 0,
        company._count.signals > 0 ? 1 : 0,
      ].reduce((a, b) => a + b, 0),
      expectedDimensions: 7,
      evidenceGaps: [
        !company.domain ? 1 : 0,
        !company.industry ? 1 : 0,
        company._count.signals === 0 ? 1 : 0,
      ].reduce((a, b) => a + b, 0),
      aiOutputConfidence: company._count.signals > 0 ? 0.8 : 0.5,
      hallucinationRiskScore: company._count.signals > 0 ? 15 : 40,
      qualityGateScore: company._count.signals > 0 ? 85 : 50,
    });
  } catch (err) {
    logger.warn(`[RecommendationEngine] Confidence failed for ${company.rawName}: ${err instanceof Error ? err.message : err}`);
  }

  const confidenceScore = confidenceResult?.score ?? 50;
  const confidenceGrade = confidenceResult?.grade ?? 'C';
  let enterpriseReady = confidenceResult?.enterpriseReady ?? false;
  const confidenceInConfidence = confidenceResult?.confidenceInConfidence ?? 50;

  // Phase 1 Item 4.6: Block enterprise-ready on low trust (confidence-in-confidence < 50)
  // Applied by default; set enableTrustBlocking: false to skip.
  if (data.enableTrustBlocking !== false && enterpriseReady && confidenceInConfidence < 50) {
    enterpriseReady = false;
  }

  // ── Step 8: Build recommended action ──
  const recommendedAction = buildRecommendedAction({
    companyName: company.rawName,
    priority,
    bestOpp,
    highSignals: data.highSignals,
    contactCount: company._count.contacts,
    capabilityMatches: data.capabilityMatches,
    insights: data.insights,
  });

  // ── Step 9: Build "Why this account?" ──
  const whyThisAccount = buildWhyThisAccount(company.rawName, reasons, priority);

  // ── Step 10: Determine tier ──
  const tier = (data.accountScore?.category as RecommendationTier)
    || (priority === 'critical' ? 'HOT_ACCOUNT'
      : priority === 'high' ? 'WARM_ACCOUNT'
        : priority === 'medium' ? 'NURTURE' : 'AT_RISK');

  return {
    companyId: company.id,
    companyName: company.rawName,
    companyDomain: company.domain,
    companyIndustry: company.industry,

    opportunityScore,
    priority,
    tier,
    confidenceGrade,
    confidenceScore,
    enterpriseReady,

    signalCount: company._count.signals,
    opportunityCount: data.opportunities.length,
    capabilityMatchCount: data.capabilityMatches.length,
    highSeveritySignalCount: data.highSignals.length,
    contactCount: company._count.contacts,

    reasons: reasons.sort((a, b) => b.strength - a.strength),
    risks,
    recommendedAction,
    whyThisAccount,

    graphInsights,
    memoryPatterns,

    topOpportunity: bestOpp ? {
      title: bestOpp.opportunityTitle,
      score: bestOpp.opportunityScore,
      signalType: 'detected',
      whyNow: bestOpp.whyNow || '',
    } : undefined,

    generatedAt,
    decisionAuditHash: await computeDecisionAuditHash({
      companyId: company.id,
      signals: sortedSignalIds,
      evidence: sortedEvidenceIds,
      scores: { opportunityScore, confidenceScore, signalStrength, capabilityMatch: bestCapScore },
      timestamp: generatedAt,
    }),
    dataDepthIndicator: computeDataDepthIndicator(
      company._count.signals,
      data.opportunities.length,
      data.capabilityMatches.length,
      company._count.contacts,
    ),
    confidenceFactors: confidenceResult?.factors.map(f => ({
      dimension: f.dimension,
      score: f.score,
      weight: f.weight,
      explanation: f.explanation,
    })),
  };
}

// ── Phase 3.4: Decision Audit Hash ───────────────────────────────────────────

interface AuditHashInput {
  companyId: string;
  signals: string[];
  evidence: string[];
  scores: { opportunityScore: number; confidenceScore: number; signalStrength: number; capabilityMatch: number };
  timestamp: string;
}

/**
 * Compute SHA-256 hash of all input data used for a recommendation.
 * This provides tamper-evident audit verification of decision inputs.
 */
async function computeDecisionAuditHash(input: AuditHashInput): Promise<string> {
  const auditInput = JSON.stringify({
    companyId: input.companyId,
    signals: input.signals,
    evidence: input.evidence,
    scores: input.scores,
    timestamp: input.timestamp,
  });
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(auditInput)
  );
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Recompute the decision audit hash for an existing recommendation.
 * Used for verification: recompute and compare to stored hash.
 */
export async function recomputeAuditHash(rec: AccountRecommendation): Promise<string> {
  // Reconstruct the audit input from the recommendation's stored data
  const signalIds = rec.reasons
    .filter(r => r.sourceId && r.sourceType === 'CompanySignal')
    .map(r => r.sourceId!)
    .sort();

  const evidenceIds = rec.reasons
    .filter(r => r.sourceId && r.sourceType !== 'CompanySignal' && !r.sourceId.startsWith('calibration:'))
    .map(r => r.sourceId!)
    .sort();

  return computeDecisionAuditHash({
    companyId: rec.companyId,
    signals: signalIds,
    evidence: evidenceIds,
    scores: {
      opportunityScore: rec.opportunityScore,
      confidenceScore: rec.confidenceScore,
      signalStrength: 0, // Cannot reconstruct exactly from stored rec
      capabilityMatch: 0,
    },
    timestamp: rec.generatedAt,
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────

function buildRecommendedAction(params: {
  companyName: string;
  priority: RecommendationPriority;
  bestOpp: { opportunityTitle: string; whyNow: string; recommendedCapability: string; businessProblem: string } | undefined;
  highSignals: Array<{ title: string; timingWindow: string | null; signalType: string }>;
  contactCount: number;
  capabilityMatches: Array<{ capability: { title: string; category: string | null } | null; matchScore: number }>;
  insights: Array<{ insightType: string; summary: string }>;
  /** Phase 1: Employee count for dynamic target roles */
  employeeCount?: number | null;
  /** Phase 1: Company type for dynamic target roles */
  companyType?: string | null;
  /** Phase 1: Known contacts for role resolution */
  knownContacts?: Array<{ role?: string | null; level?: string | null }>;
  /** Phase 1: Signals for role resolution */
  signals?: Array<{ signalType: string }>;
}): AccountRecommendation['recommendedAction'] {
  // Phase 1: Resolve dynamic target roles based on company data
  let dynamicTargetRoles: string[] | undefined;
  try {
    const { resolveTargetRoles } = require('@/lib/company-size-profiles');
    dynamicTargetRoles = resolveTargetRoles({
      employeeCount: params.employeeCount,
      companyType: params.companyType,
      knownContacts: params.knownContacts,
      signals: params.signals,
    });
  } catch {
    // Fallback to static logic below
  }

  // Critical: urgent action needed
  if (params.priority === 'critical') {
    const primaryRole = dynamicTargetRoles?.[0] || 'Decision maker';
    return {
      text: `Schedule executive discovery call with ${params.companyName} — ${params.highSignals[0]?.title || 'active opportunity detected'}`,
      timeline: 'Within 7 days',
      targetRole: primaryRole, // Backward compat
      targetRoles: dynamicTargetRoles,
      conversationAngle: params.bestOpp?.businessProblem
        ? `Address their ${params.bestOpp.businessProblem.split(' ').slice(0, 6).join(' ')}...`
        : 'Focus on recent business changes and strategic priorities',
    };
  }

  // High: engage proactively
  if (params.priority === 'high') {
    if (params.bestOpp) {
      const primaryRole = dynamicTargetRoles?.[0] || 'Decision maker';
      return {
        text: `Initiate technical discovery — ${params.bestOpp.opportunityTitle}`,
        timeline: 'Within 14 days',
        targetRole: params.contactCount > 0 ? undefined : primaryRole,
        targetRoles: dynamicTargetRoles,
        conversationAngle: params.bestOpp.whyNow
          ? params.bestOpp.whyNow.split('.').slice(0, 2).join('.') + '.'
          : 'Leverage capability alignment and recent signals',
      };
    }
    return {
      text: `Engage ${params.companyName} — strong signal activity and capability fit`,
      timeline: 'Within 14 days',
      targetRole: dynamicTargetRoles?.[0] || 'Decision maker',
      targetRoles: dynamicTargetRoles,
      conversationAngle: params.capabilityMatches[0]
        ? `Explore ${params.capabilityMatches[0].capability?.title || 'capability'} alignment`
        : 'Multi-threaded outreach based on signal intelligence',
    };
  }

  // Medium: nurture
  if (params.priority === 'medium') {
    return {
      text: 'Add to nurture sequence — monitor for signal escalation',
      timeline: 'Within 30 days',
      targetRole: dynamicTargetRoles?.[0],
      targetRoles: dynamicTargetRoles,
      conversationAngle: 'Educational content about relevant capabilities and industry trends',
    };
  }

  // Low: monitor
  return {
    text: 'Monitor — insufficient signals for active outreach',
    timeline: 'Review quarterly',
    targetRole: dynamicTargetRoles?.[0],
    targetRoles: dynamicTargetRoles,
    conversationAngle: undefined,
  };
}

function buildWhyThisAccount(
  companyName: string,
  reasons: RecommendationReason[],
  priority: RecommendationPriority
): string {
  if (reasons.length === 0) {
    return `${companyName} has basic data. Enrichment recommended to unlock full intelligence.`;
  }

  const topReasons = reasons.slice(0, 3);
  const parts = topReasons.map(r => r.text);

  switch (priority) {
    case 'critical':
      return `${companyName} requires immediate attention: ${parts.join('; ')}.`;
    case 'high':
      return `${companyName} is a strong opportunity: ${parts.join('; ')}.`;
    case 'medium':
      return `${companyName} shows potential: ${parts.join('; ')}.`;
    default:
      return `${companyName} has limited signals: ${parts.join('; ')}.`;
  }
}

/**
 * Get recommendation engine health/stats.
 */
export async function getRecommendationStats(): Promise<{
  totalCompanies: number;
  companiesWithSignals: number;
  companiesWithOpportunities: number;
  companiesWithCapabilityMatches: number;
  averageAccountScore: number;
  tierDistribution: Record<string, number>;
  topSignalsByType: Array<{ type: string; count: number }>;
}> {
  const [
    totalCompanies,
    companiesWithSignals,
    companiesWithOpportunities,
    companiesWithCapabilityMatches,
    accountScores,
    tierCounts,
  ] = await Promise.all([
    db.company.count({ where: { status: { not: 'archived' } } }),
    db.company.count({ where: { status: { not: 'archived' }, signals: { some: {} } } }),
    db.company.count({ where: { status: { not: 'archived' }, opportunityRecommendations: { some: {} } } }),
    db.company.count({ where: { status: { not: 'archived' }, signalCapabilityMatches: { some: {} } } }),
    db.accountScore.findMany({ select: { score: true }, take: 1000 }),
    db.accountScore.groupBy({ by: ['category'], _count: { category: true } }),
  ]);

  const signalTypeCounts = await db.companySignal.groupBy({
    by: ['signalType'],
    _count: { signalType: true },
    orderBy: { _count: { signalType: 'desc' } },
    take: 10,
  });

  return {
    totalCompanies,
    companiesWithSignals,
    companiesWithOpportunities,
    companiesWithCapabilityMatches,
    averageAccountScore: accountScores.length > 0
      ? Math.round(accountScores.reduce((s, a) => s + a.score, 0) / accountScores.length)
      : 0,
    tierDistribution: Object.fromEntries(
      tierCounts.map(t => [t.category, t._count.category])
    ),
    topSignalsByType: signalTypeCounts.map(s => ({
      type: s.signalType,
      count: s._count.signalType,
    })),
  };
}
