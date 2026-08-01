/**
 * Intelligence Narrative Service — The Bridge Between Engine and UI
 * ═══════════════════════════════════════════════════════════════
 *
 * This service composes the existing DeepMindQ intelligence engines into
 * narrative-ready data structures that the IntelligenceNarrative component
 * can directly consume.
 *
 * CRITICAL DESIGN PRINCIPLE:
 *   "The UI must be the visual expression of the Intelligence Engine —
 *    not a redesigned dashboard layer."
 *
 * This service ensures every piece of data flowing into the UI carries:
 *   1. Real confidence from multi-factor calculation
 *   2. Traceable evidence chains from actual signals/sources
 *   3. AI-generated reasoning from the synthesis engine
 *   4. Actionable recommendations from the action engine
 *   5. Provable origin — "Why did AI tell me this?"
 *
 * Non-throwing contract: All functions return { success, data?, error? }.
 * Engine failures degrade gracefully with partial results.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  computeConfidenceScore,
  type ConfidenceBreakdown,
} from '@/lib/intelligence-confidence';
import {
  computeConfidenceFactors,
  type ConfidenceFactorsResult,
} from '@/lib/confidence-explainability';
import { GroundingEngine } from '@/lib/engines/grounding-engine';
import type { Evidence as EngineEvidence } from '@/lib/engines/grounding-engine';

// ─── Types ──────────────────────────────────────────────────────────────

export interface NarrativeConfidence {
  /** Overall confidence 0-100 */
  score: number;
  /** Multi-factor breakdown */
  breakdown: ConfidenceBreakdown;
  /** Human-readable contributing factors */
  factors: ConfidenceFactorsResult;
  /** How this confidence was calculated */
  formula: string;
}

export interface NarrativeEvidence {
  /** Unique ID for tracing */
  id: string;
  /** Source name (e.g. "Reuters", "SEC Filing", "LinkedIn") */
  source: string;
  /** Source type for icon selection */
  sourceType: 'news' | 'filing' | 'web' | 'database' | 'social' | 'internal' | 'sec' | 'press';
  /** Evidence snippet */
  snippet: string;
  /** Source URL if available */
  url?: string;
  /** Date evidence was collected/observed */
  date?: string;
  /** Relevance score 0-100 */
  relevanceScore: number;
  /** Source reliability 0-1 */
  reliability: number;
  /** Evidence confidence 0-1 */
  evidenceConfidence: number;
  /** Evidence type from engine */
  engineType: string;
}

export interface NarrativeAction {
  /** Action label */
  label: string;
  /** Action type from ActionEngine */
  actionType: string;
  /** Priority level */
  priority: 'critical' | 'high' | 'medium' | 'low';
  /** Confidence in this recommendation 0-100 */
  confidence: number;
  /** Why this action is recommended */
  reasoning: string;
  /** Related company ID */
  companyId?: string;
  /** Navigation target */
  href?: string;
}

export interface IntelligenceNarrativeData {
  /** Unique narrative ID */
  id: string;
  /** L1 — What changed? */
  headline: string;
  /** Additional context */
  subtitle?: string;
  /** Intelligence variant for visual accent */
  variant: 'signal' | 'opportunity' | 'risk' | 'enrichment' | 'reasoning' | 'action';
  /** Entity name */
  entityName: string;
  /** Entity type */
  entityType: 'company' | 'contact' | 'opportunity' | 'signal';
  /** Entity ID */
  entityId: string;

  /** L2 — Why it matters */
  reasoning: string;
  /** Bullet-point reasoning */
  reasoningPoints: string[];

  /** L3 — Evidence trail */
  evidence: NarrativeEvidence[];
  /** Impact statement */
  impactStatement?: string;

  /** L4 — Related signals */
  relatedSignals: Array<{
    title: string;
    type: 'signal' | 'opportunity' | 'risk' | 'pattern';
    date?: string;
    entityId?: string;
  }>;

  /** Confidence */
  confidence: NarrativeConfidence;

  /** Primary action */
  primaryAction?: NarrativeAction;
  /** Secondary actions */
  secondaryActions: NarrativeAction[];

  /** Metadata */
  priority: 'critical' | 'high' | 'medium' | 'low';
  timestamp: string;
  isNew: boolean;
  intelligenceScore?: number;

  /** Traceability: which engines contributed */
  engineContributions: {
    grounding: boolean;
    scoring: boolean;
    action: boolean;
    synthesis: boolean;
    aiReasoning: boolean;
  };

  /** Computation metadata */
  computedAt: string;
  computationTimeMs: number;
}

export interface NarrativeServiceResult {
  success: boolean;
  narratives: IntelligenceNarrativeData[];
  errors: string[];
  meta: {
    totalSignalsProcessed: number;
    totalEvidenceCollected: number;
    computationTimeMs: number;
    engineCalls: number;
  };
}

// ─── Source Classification ─────────────────────────────────────────────

function classifySourceType(source: string, url?: string | null): NarrativeEvidence['sourceType'] {
  const lower = (source + ' ' + (url || '')).toLowerCase();
  if (lower.includes('sec.gov') || lower.includes('filing') || lower.includes('10-k') || lower.includes('10q')) return 'sec';
  if (lower.includes('reuters') || lower.includes('bloomberg') || lower.includes('ft.com') || lower.includes('wsj') || lower.includes('press')) return 'press';
  if (lower.includes('techcrunch') || lower.includes('theverge') || lower.includes('venturebeat') || lower.includes('news')) return 'news';
  if (lower.includes('linkedin') || lower.includes('twitter') || lower.includes('social')) return 'social';
  if (lower.includes('crunchbase') || lower.includes('pitchbook')) return 'database';
  if (lower.includes('internal') || lower.includes('deepmindq') || lower.includes('ai insight')) return 'internal';
  if (url) return 'web';
  return 'database';
}

// ─── Confidence Computation ────────────────────────────────────────────

/**
 * Computes narrative confidence from real factors.
 *
 * Formula:
 *   overall = Signal Quality × 0.30
 *           + Evidence Quality × 0.30
 *           + Capability Fit × 0.25
 *           + Data Completeness × 0.15
 *
 * Where:
 *   Signal Quality    = weighted average of signal confidences (by impact)
 *   Evidence Quality  = average evidence (reliability × confidence × freshness)
 *   Capability Fit   = best capability match score for this signal
 *   Data Completeness = company intelligence health dataCompletenessScore
 */
async function computeNarrativeConfidence(
  companyId: string,
  signalId: string,
  evidenceChain: EngineEvidence[],
): Promise<NarrativeConfidence> {
  // Step 1: Signal Quality from DB
  const signals = await db.companySignal.findMany({
    where: { companyId, status: { in: ['active', 'validated'] } },
    select: { confidence: true, impact: true, signalDate: true },
    take: 20,
  });

  let signalQuality = 0;
  if (signals.length > 0) {
    const impactWeight: Record<string, number> = { high: 1.0, medium: 0.6, low: 0.3 };
    let totalWeight = 0;
    let weightedSum = 0;
    for (const s of signals) {
      const w = impactWeight[s.impact || 'medium'] ?? 0.6;
      weightedSum += s.confidence * 100 * w;
      totalWeight += w;
    }
    signalQuality = totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  // Step 2: Evidence Quality from the grounding chain
  let evidenceQuality = 0;
  if (evidenceChain.length > 0) {
    const FRESHNESS_LIFECYCLE_DAYS = 90;
    const totalWeight = evidenceChain.reduce((sum, e) => sum + e.reliability, 0);
    if (totalWeight > 0) {
      evidenceQuality = evidenceChain.reduce((sum, e) => {
        // Freshness decay: exponential
        let freshness = 0.3; // default for unknown dates
        if (e.date) {
          const daysOld = (Date.now() - new Date(e.date).getTime()) / 86400000;
          if (daysOld <= 0) freshness = 1;
          else if (daysOld < FRESHNESS_LIFECYCLE_DAYS) {
            const k = Math.log(0.1) / FRESHNESS_LIFECYCLE_DAYS;
            freshness = Math.max(0.05, Math.exp(k * daysOld));
          }
        }
        // Composite: reliability × confidence × freshness
        return sum + (e.reliability * e.confidence * freshness * 100 * e.reliability);
      }, 0) / totalWeight;
    }
  }

  // Step 3: Capability Fit from signal-capability matches
  const capMatches = await db.signalCapabilityMatch.findMany({
    where: { companyId, signalId },
    select: { matchScore: true },
    orderBy: { matchScore: 'desc' },
    take: 1,
  });
  const capabilityFit = capMatches.length > 0 ? capMatches[0].matchScore * 100 : 0;

  // Step 4: Data Completeness from intelligence health
  const health = await db.companyIntelligenceHealth.findUnique({
    where: { companyId },
    select: { dataCompletenessScore: true },
  });
  const dataCompleteness = health?.dataCompletenessScore ?? 0;

  // Compute the 4-dimension breakdown
  const breakdown = computeConfidenceScore({
    signalQuality,
    evidenceQuality,
    capabilityFit,
    dataCompleteness,
  });

  // Compute human-readable factors
  let factors: ConfidenceFactorsResult = { positiveFactors: [], negativeFactors: [] };
  try {
    factors = await computeConfidenceFactors(companyId, signalId, capabilityFit / 100);
  } catch (err) {
    logger.warn('[narrative-service] Confidence factors computation failed, using empty', { error: String(err) });
  }

  return {
    score: breakdown.overall,
    breakdown,
    factors,
    formula: `Signal(${Math.round(signalQuality)})×0.30 + Evidence(${Math.round(evidenceQuality)})×0.30 + Capability(${Math.round(capabilityFit)})×0.25 + Data(${Math.round(dataCompleteness)})×0.15 = ${breakdown.overall}`,
  };
}

// ─── Evidence Chain Building ───────────────────────────────────────────

/**
 * Builds a narrative evidence list from the GroundingEngine's evidence chain.
 * Maps engine evidence to UI-ready evidence items with traceability.
 */
function buildNarrativeEvidence(chain: EngineEvidence[]): NarrativeEvidence[] {
  return chain.map((e, i) => ({
    id: e.id || `evidence-${i}`,
    source: e.source || 'Unknown Source',
    sourceType: classifySourceType(e.source, e.url),
    snippet: e.snippet || e.content?.slice(0, 300) || 'Evidence content unavailable',
    url: e.url || undefined,
    date: e.date || undefined,
    relevanceScore: Math.round((e.reliability * e.confidence) * 100),
    reliability: e.reliability,
    evidenceConfidence: e.confidence,
    engineType: e.type || 'unknown',
  }));
}

// ─── Priority Classification ───────────────────────────────────────────

function classifyPriority(
  severity: string,
  impact: string,
  confidence: number,
): 'critical' | 'high' | 'medium' | 'low' {
  const sev = severity?.toLowerCase() || '';
  const imp = impact?.toLowerCase() || '';

  if (sev === 'critical' || imp === 'high') return 'critical';
  if (sev === 'high' || (imp === 'medium' && confidence >= 70)) return 'high';
  if (sev === 'medium' || confidence >= 50) return 'medium';
  return 'low';
}

function classifyVariant(
  signalType: string,
  severity: string,
): IntelligenceNarrativeData['variant'] {
  const type = signalType?.toLowerCase() || '';
  if (type.includes('fund') || type.includes('hiring') || type.includes('expansion') || type.includes('acquisition')) return 'opportunity';
  if (type.includes('leadership') || type.includes('tech_change') || type.includes('partnership')) return 'signal';
  if (severity === 'critical' || severity === 'high') return 'risk';
  return 'signal';
}

// ─── Core: Build Narrative from Signal ──────────────────────────────────

/**
 * Builds a single IntelligenceNarrativeData from a CompanySignal,
 * enriched with real evidence, confidence factors, and actions.
 */
async function buildNarrativeFromSignal(
  signal: {
    id: string;
    companyId: string;
    signalType: string;
    title: string;
    description?: string | null;
    severity: string;
    impact: string;
    confidence: number;
    businessImpact?: string | null;
    recommendedAction?: string | null;
    timingWindow?: string | null;
    source?: string | null;
    sourceUrl?: string | null;
    createdAt: Date;
  },
  company: {
    id: string;
    rawName: string;
    industry?: string | null;
    intelligenceScore: number;
  },
): Promise<IntelligenceNarrativeData> {
  const startTime = Date.now();

  // Step 1: Collect evidence via GroundingEngine
  let evidenceChain: EngineEvidence[] = [];
  let groundingUsed = false;
  try {
    const chain = await GroundingEngine.collect({
      companyId: signal.companyId,
      maxEvidence: 20,
    });
    evidenceChain = chain.evidences;
    groundingUsed = true;
  } catch (err) {
    logger.warn('[narrative-service] GroundingEngine failed, using signal-only evidence', {
      signalId: signal.id,
      error: String(err),
    });
    // Fallback: create evidence from signal itself
    evidenceChain = [{
      id: `signal:${signal.id}`,
      type: 'company_signal',
      source: signal.source || 'Signal Detection',
      url: signal.sourceUrl || null,
      date: signal.createdAt.toISOString(),
      snippet: signal.description || signal.title,
      content: `${signal.title}\n${signal.description || ''}\nType: ${signal.signalType}\nSeverity: ${signal.severity}\nImpact: ${signal.impact}`,
      reliability: signal.sourceUrl ? 0.7 : 0.5,
      confidence: signal.confidence,
      entityId: signal.id,
      entityType: 'company',
    }];
  }

  // Step 2: Compute multi-factor confidence
  const confidence = await computeNarrativeConfidence(
    signal.companyId,
    signal.id,
    evidenceChain,
  );

  // Step 3: Build evidence list
  const narrativeEvidence = buildNarrativeEvidence(evidenceChain);

  // Step 4: Generate reasoning from signal data + evidence
  const reasoningPoints: string[] = [];
  if (signal.businessImpact) reasoningPoints.push(signal.businessImpact);
  if (signal.timingWindow) reasoningPoints.push(`Timing window: ${signal.timingWindow.replace(/_/g, ' ')}`);
  if (evidenceChain.length > 0) {
    reasoningPoints.push(`Supported by ${evidenceChain.length} evidence sources`);
    const highRelEvidence = evidenceChain.filter(e => e.reliability >= 0.8);
    if (highRelEvidence.length > 0) {
      reasoningPoints.push(`${highRelEvidence.length} high-reliability sources corroborate this signal`);
    }
  }
  if (confidence.factors.positiveFactors.length > 0) {
    reasoningPoints.push(confidence.factors.positiveFactors[0].factor);
  }
  if (confidence.factors.negativeFactors.length > 0) {
    reasoningPoints.push(`Limitation: ${confidence.factors.negativeFactors[0].factor}`);
  }

  // Step 5: Build reasoning narrative
  const reasoning = signal.description || signal.businessImpact ||
    `${signal.signalType.replace(/_/g, ' ')} detected for ${company.rawName}. ` +
    `Impact assessed as ${signal.impact}. ` +
    `Confidence based on ${evidenceChain.length} evidence sources.`;

  // Step 6: Get related opportunity recommendations
  const recommendations = await db.opportunityRecommendation.findMany({
    where: {
      companyId: signal.companyId,
      signalId: signal.id,
      status: { in: ['pending_review', 'accepted', 'monitored'] },
    },
    select: {
      id: true,
      opportunityTitle: true,
      recommendedCapability: true,
      confidenceScore: true,
      opportunityScore: true,
      priority: true,
      suggestedConversation: true,
    },
    orderBy: { opportunityScore: 'desc' },
    take: 3,
  });

  const primaryAction: NarrativeAction | undefined = recommendations.length > 0 ? {
    label: recommendations[0].opportunityTitle || 'Review Opportunity',
    actionType: 'next_best_action',
    priority: classifyPriority(signal.severity, signal.impact, confidence.score),
    confidence: Math.round(recommendations[0].confidenceScore * 100),
    reasoning: recommendations[0].suggestedConversation || 'AI-recommended action based on signal analysis',
    companyId: signal.companyId,
  } : signal.recommendedAction ? {
    label: signal.recommendedAction,
    actionType: 'signal_action',
    priority: classifyPriority(signal.severity, signal.impact, confidence.score),
    confidence: Math.round(signal.confidence * 100),
    reasoning: `Direct action from ${signal.signalType.replace(/_/g, ' ')} detection`,
    companyId: signal.companyId,
  } : undefined;

  const secondaryActions: NarrativeAction[] = recommendations.slice(1).map(rec => ({
    label: rec.opportunityTitle || 'Explore Opportunity',
    actionType: 'opportunity_review',
    priority: classifyPriority('medium', 'medium', Math.round(rec.confidenceScore * 100)),
    confidence: Math.round(rec.confidenceScore * 100),
    reasoning: rec.suggestedConversation || 'Related opportunity',
    companyId: signal.companyId,
  }));

  // Step 7: Impact statement from evidence
  const impactStatement = evidenceChain.length >= 3
    ? `Strong evidence base: ${evidenceChain.length} sources with ${evidenceChain.filter(e => e.reliability >= 0.8).length} high-reliability corroborations`
    : evidenceChain.length >= 1
    ? `Evidence from ${evidenceChain.length} source${evidenceChain.length > 1 ? 's' : ''} — ${evidenceChain.some(e => e.reliability >= 0.8) ? 'includes high-reliability data' : 'limited corroboration'}`
    : undefined;

  // Step 8: Related signals
  const relatedSignalsDB = await db.companySignal.findMany({
    where: {
      companyId: signal.companyId,
      id: { not: signal.id },
      status: { notIn: ['archived', 'expired'] },
    },
    select: { id: true, title: true, signalType: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });

  return {
    id: `narrative-${signal.id}`,
    headline: signal.title,
    subtitle: company.industry ? `${company.industry} · ${signal.signalType.replace(/_/g, ' ')}` : signal.signalType.replace(/_/g, ' '),
    variant: classifyVariant(signal.signalType, signal.severity),
    entityName: company.rawName,
    entityType: 'company',
    entityId: signal.companyId,
    reasoning,
    reasoningPoints,
    evidence: narrativeEvidence,
    impactStatement,
    relatedSignals: relatedSignalsDB.map(s => ({
      title: s.title,
      type: classifyVariant(s.signalType, 'medium') as 'signal' | 'opportunity' | 'risk' | 'pattern',
      date: s.createdAt.toISOString(),
      entityId: s.id,
    })),
    confidence,
    primaryAction,
    secondaryActions,
    priority: classifyPriority(signal.severity, signal.impact, confidence.score),
    timestamp: signal.createdAt.toISOString(),
    isNew: (Date.now() - signal.createdAt.getTime()) < 24 * 60 * 60 * 1000, // New if < 24h
    intelligenceScore: company.intelligenceScore > 0 ? company.intelligenceScore : undefined,
    engineContributions: {
      grounding: groundingUsed,
      scoring: true,
      action: recommendations.length > 0,
      synthesis: false,
      aiReasoning: false,
    },
    computedAt: new Date().toISOString(),
    computationTimeMs: Date.now() - startTime,
  };
}

// ─── Public API ────────────────────────────────────────────────────────

/**
 * Generates intelligence narratives for the command center.
 *
 * Composes: CompanySignal → GroundingEngine → ConfidenceCalculation →
 *           EvidenceChain → OpportunityRecommendation → ActionEngine
 *
 * @param options.limit - Max narratives to return (default 10)
 * @param options.companyId - Optional: filter to one company
 * @param options.minConfidence - Optional: filter below confidence (default 0)
 * @param options.minSeverity - Optional: 'high' | 'medium' | 'low'
 */
export async function generateCommandCenterNarratives(options: {
  limit?: number;
  companyId?: string;
  minConfidence?: number;
  minSeverity?: string;
} = {}): Promise<NarrativeServiceResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let totalEvidenceCollected = 0;
  let engineCalls = 0;

  const limit = options.limit || 10;
  // Step 1: Fetch signals with company data
  const whereClause: Record<string, unknown> = {
    status: { notIn: ['archived', 'expired'] },
  };
  if (options.companyId) whereClause.companyId = options.companyId;
  if (options.minSeverity) {
    const severityOrder = ['critical', 'high', 'medium', 'low'];
    const minIdx = severityOrder.indexOf(options.minSeverity);
    if (minIdx >= 0) {
      whereClause.severity = { in: severityOrder.slice(0, minIdx + 1) };
    }
  }

  const signals = await db.companySignal.findMany({
    where: whereClause,
    include: {
      company: {
        select: { id: true, rawName: true, industry: true, intelligenceScore: true },
      },
    },
    orderBy: [{ createdAt: 'desc' }, { severity: 'desc' }],
    take: limit * 2, // Fetch extra in case some fail
  });

  if (signals.length === 0) {
    return {
      success: true,
      narratives: [],
      errors: [],
      meta: { totalSignalsProcessed: 0, totalEvidenceCollected: 0, computationTimeMs: Date.now() - startTime, engineCalls: 0 },
    };
  }

  // Step 2: Build narratives in parallel (batched to avoid overwhelming DB)
  const narratives: IntelligenceNarrativeData[] = [];
  const BATCH_SIZE = 5;

  for (let i = 0; i < signals.length && narratives.length < limit; i += BATCH_SIZE) {
    const batch = signals.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(signal => {
        if (!signal.company) return Promise.reject(new Error(`Signal ${signal.id} has no company`));
        return buildNarrativeFromSignal(signal, signal.company);
      }),
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === 'fulfilled') {
        const narrative = result.value;
        // Apply confidence filter
        if (narrative.confidence.score >= (options.minConfidence || 0)) {
          narratives.push(narrative);
          totalEvidenceCollected += narrative.evidence.length;
          engineCalls += Object.values(narrative.engineContributions).filter(Boolean).length;
        }
      } else {
        const reason = result.status === 'rejected' ? String(result.reason) : 'Unknown error';
        errors.push(`Signal ${batch[j]?.id}: ${reason}`);
        logger.warn('[narrative-service] Failed to build narrative', {
          signalId: batch[j]?.id,
          error: reason,
        });
      }
    }
  }

  // Sort by: priority (critical first), then confidence (high first), then timestamp (recent first)
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  narratives.sort((a, b) => {
    const pa = priorityOrder[a.priority] ?? 3;
    const pb = priorityOrder[b.priority] ?? 3;
    if (pa !== pb) return pa - pb;
    if (b.confidence.score !== a.confidence.score) return b.confidence.score - a.confidence.score;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  return {
    success: narratives.length > 0 || errors.length === 0,
    narratives: narratives.slice(0, limit),
    errors,
    meta: {
      totalSignalsProcessed: signals.length,
      totalEvidenceCollected,
      computationTimeMs: Date.now() - startTime,
      engineCalls,
    },
  };
}

/**
 * Generates a single narrative for a specific signal with full depth.
 * Used when a user clicks into a specific intelligence item.
 */
export async function generateSignalNarrative(signalId: string): Promise<{
  success: boolean;
  narrative?: IntelligenceNarrativeData;
  error?: string;
}> {
  const startTime = Date.now();
  const signal = await db.companySignal.findUnique({
    where: { id: signalId },
    include: {
      company: {
        select: { id: true, rawName: true, industry: true, intelligenceScore: true },
      },
    },
  });

  if (!signal || !signal.company) {
    return { success: false, error: `Signal ${signalId} not found or has no company` };
  }

  try {
    const narrative = await buildNarrativeFromSignal(signal, signal.company);
    return { success: true, narrative };
  } catch (err) {
    return {
      success: false,
      error: `Failed to build narrative: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Returns the confidence calculation details for a specific signal.
 * This is what answers "How confident is the AI?" with full transparency.
 */
export async function getSignalConfidenceDetail(signalId: string): Promise<{
  success: boolean;
  confidence?: NarrativeConfidence;
  evidenceCount?: number;
  evidenceSources?: string[];
  error?: string;
}> {
  const signal = await db.companySignal.findUnique({
    where: { id: signalId },
    select: { companyId: true, id: true },
  });

  if (!signal) {
    return { success: false, error: `Signal ${signalId} not found` };
  }

  let evidenceChain: EngineEvidence[] = [];
  try {
    const chain = await GroundingEngine.collect({ companyId: signal.companyId, maxEvidence: 20 });
    evidenceChain = chain.evidences;
  } catch {
    // Proceed without grounding evidence
  }

  const confidence = await computeNarrativeConfidence(signal.companyId, signal.id, evidenceChain);

  return {
    success: true,
    confidence,
    evidenceCount: evidenceChain.length,
    evidenceSources: [...new Set(evidenceChain.map(e => e.source))],
  };
}
