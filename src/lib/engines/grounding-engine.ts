/**
 * GroundingEngine — Phase B Foundation Engine #2
 * ===============================================
 *
 * Unified evidence chain builder for the engine architecture. Collects
 * evidence from multiple sources (CompanySignal, AIInsight, Evidence,
 * SignalCapabilityMatch→CapabilityAsset, ContactInteraction, news signals)
 * into a single EvidenceChain that composition engines can:
 *
 *   - Inject into LLM prompts via renderChainForPrompt()
 *   - Use to calibrate confidence (weighted by reliability × freshness)
 *   - Surface coverage gaps explicitly rather than papering over them
 *
 * DEPTH-FIRST DESIGN
 * -------------------
 * Every composition engine output cites evidence via [En] markers. The
 * GroundingEngine produces the evidence index that those markers reference.
 * When evidence is thin, gaps are explicitly returned — composition engines
 * acknowledge them in their output rather than hallucinating.
 *
 * NON-THROWING CONTRACT
 * ---------------------
 * Returns EvidenceChain with `error: string | null`. DB failures degrade
 * gracefully — empty evidences array + gap entries explaining what couldn't
 * be loaded.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { FRESHNESS_LIFECYCLE_DAYS } from '@/lib/ai-governance';
import type { SignalType } from '@prisma/client';

// ─── Types ──────────────────────────────────────────────────────────────

export type EvidenceType =
  | 'company_signal'
  | 'news_signal'
  | 'intelligence_source'
  | 'capability_match'
  | 'ai_insight'
  | 'contact_interaction'
  | 'evidence'
  | 'manual';

export interface Evidence {
  /** Stable ID for citation reference (e.g. 'signal:abc123'). */
  id: string;
  /** What kind of evidence this is. */
  type: EvidenceType;
  /** Human-readable source label (e.g. 'TechCrunch', 'LinkedIn', 'AI Insight'). */
  source: string;
  /** URL if available (for clickable citations). */
  url: string | null;
  /** ISO date string of when the evidence was observed/created. */
  date: string | null;
  /** Short snippet (1-2 sentences) for prompt injection. */
  snippet: string;
  /** Full content (may be longer — used for detailed prompts). */
  content: string;
  /** Source reliability 0-1 (how trustworthy this source is). */
  reliability: number;
  /** Evidence confidence 0-1 (how strong this specific evidence is). */
  confidence: number;
  /** Entity this evidence is attached to. */
  entityId: string | null;
  /** Entity type this evidence is attached to. */
  entityType: 'company' | 'contact' | 'opportunity' | null;
}

export interface EvidenceGap {
  /** What's missing (e.g. 'recent_funding', 'tech_stack', 'key_contacts'). */
  dimension: string;
  /** Human-readable explanation. */
  description: string;
  /** How much this gap affects confidence (0-1). */
  impact: number;
}

export interface GroundingContext {
  companyId?: string;
  contactId?: string;
  opportunityId?: string;
  /** Optional pre-loaded research context (skips DB calls). */
  researchContext?: unknown;
  /** Max evidence pieces to return (default 50). */
  maxEvidence?: number;
  /** Include older evidence (default: respects FRESHNESS_LIFECYCLE_DAYS). */
  includeStale?: boolean;
}

export interface EvidenceChain {
  evidences: Evidence[];
  /** Aggregate confidence 0-1 across all evidence. */
  aggregateConfidence: number;
  /** Coverage 0-1 — fraction of expected dimensions that have evidence. */
  coverage: number;
  /** Explicit gaps the composition engine should acknowledge. */
  gaps: EvidenceGap[];
  /** Freshness score 0-1 — how recent the evidence is overall. */
  freshnessScore: number;
  /** When this chain was built. */
  builtAt: string;
  /** Original context used to build this chain. */
  context: GroundingContext;
  /** Error message if chain construction had issues. */
  error: string | null;
}

// ─── Reliability Defaults ───────────────────────────────────────────────

const SOURCE_RELIABILITY: Record<string, number> = {
  // Premium sources
  'sec.gov': 0.95,
  'bloomberg.com': 0.92,
  'reuters.com': 0.92,
  'ft.com': 0.91,
  'wsj.com': 0.90,
  'crunchbase.com': 0.85,
  'pitchbook.com': 0.88,
  'linkedin.com': 0.75,
  // News sources
  'techcrunch.com': 0.78,
  'theverge.com': 0.75,
  'venturebeat.com': 0.72,
  // Default
  default: 0.6,
};

function reliabilityFor(url: string | null): number {
  if (!url) return SOURCE_RELIABILITY.default;
  const lower = url.toLowerCase();
  for (const [domain, rel] of Object.entries(SOURCE_RELIABILITY)) {
    if (domain !== 'default' && lower.includes(domain)) return rel;
  }
  return SOURCE_RELIABILITY.default;
}

// ─── Freshness Decay ────────────────────────────────────────────────────

/**
 * Returns 0-1 where 1 = today, 0 = older than FRESHNESS_LIFECYCLE_DAYS.
 * Uses an exponential decay — recent evidence is weighted much higher.
 */
function freshnessScore(isoDate: string | null): number {
  if (!isoDate) return 0.3; // unknown date — neutral-low
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return 0.3;
  const daysOld = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  const lifecycle = FRESHNESS_LIFECYCLE_DAYS?.signals ?? 90;
  if (daysOld <= 0) return 1;
  if (daysOld >= lifecycle) return 0.05;
  // Exponential decay: e^(-k*x) where k makes it hit 0.1 at lifecycle
  const k = Math.log(0.1) / lifecycle;
  return Math.max(0.05, Math.exp(k * daysOld));
}

// ─── Evidence Collectors ────────────────────────────────────────────────

/** Collect evidence from CompanySignal records. */
async function collectCompanySignals(
  ctx: GroundingContext,
  maxEvidence: number,
): Promise<{ evidences: Evidence[]; gaps: EvidenceGap[] }> {
  if (!ctx.companyId) return { evidences: [], gaps: [] };

  const evidences: Evidence[] = [];
  const gaps: EvidenceGap[] = [];

  try {
    const signals = await db.companySignal.findMany({
      where: {
        companyId: ctx.companyId,
        ...(ctx.includeStale ? {} : { status: { not: 'archived' } }),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(maxEvidence, 20),
    });

    for (const sig of signals) {
      const reliability = reliabilityFor(sig.sourceUrl);
      const freshness = freshnessScore(sig.signalDate?.toISOString() ?? sig.createdAt.toISOString());
      const confidence = (sig.confidence ?? 0.5) * 0.7 + reliability * 0.3;

      evidences.push({
        id: `signal:${sig.id}`,
        type: 'company_signal',
        source: sig.source ?? 'Company Signal',
        url: sig.sourceUrl,
        date: (sig.signalDate ?? sig.createdAt).toISOString(),
        snippet: `${sig.title}${sig.description ? ' — ' + sig.description.slice(0, 200) : ''}`,
        content: `${sig.title}\n${sig.description ?? ''}\nType: ${sig.signalType}\nSeverity: ${sig.severity}\nImpact: ${sig.impact}\nBusiness Impact: ${sig.businessImpact ?? 'unknown'}\nRecommended Action: ${sig.recommendedAction ?? 'unknown'}\nTiming Window: ${sig.timingWindow ?? 'unknown'}`,
        reliability,
        confidence,
        entityId: sig.id,
        entityType: 'company',
      });
    }

    // Detect gaps
    if (signals.length === 0) {
      gaps.push({
        dimension: 'company_signals',
        description: 'No company signals detected for this account.',
        impact: 0.3,
      });
    } else {
      const signalTypes = new Set(signals.map((s) => s.signalType));
      const expectedTypes: string[] = ['funding', 'hiring', 'leadership_change', 'tech_change', 'expansion'];
      for (const expected of expectedTypes) {
        if (!signalTypes.has(expected as SignalType)) {
          gaps.push({
            dimension: `signal_${expected}`,
            description: `No ${expected.replace(/_/g, ' ')} signals detected — gap in intelligence picture.`,
            impact: 0.1,
          });
        }
      }
    }
  } catch (err) {
    logger.error(`[grounding-engine] company signals collection failed: ${err instanceof Error ? err.message : err}`);
    gaps.push({
      dimension: 'company_signals',
      description: 'Failed to load company signals from database.',
      impact: 0.2,
    });
  }

  return { evidences, gaps };
}

/** Collect evidence from SignalCapabilityMatch → CapabilityAsset links. */
async function collectCapabilityMatches(
  ctx: GroundingContext,
  maxEvidence: number,
): Promise<{ evidences: Evidence[]; gaps: EvidenceGap[] }> {
  if (!ctx.companyId) return { evidences: [], gaps: [] };

  const evidences: Evidence[] = [];
  const gaps: EvidenceGap[] = [];

  try {
    const matches = await db.signalCapabilityMatch.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { matchScore: 'desc' },
      take: Math.min(maxEvidence, 10),
      include: { capability: true },
    });

    for (const match of matches) {
      const reliability = 0.85; // internal capability data — high reliability
      const confidence = match.matchScore;
      evidences.push({
        id: `capmatch:${match.id}`,
        type: 'capability_match',
        source: 'Capability Library',
        url: null,
        date: match.createdAt.toISOString(),
        snippet: `Signal "${match.signalId}" matches capability: ${match.capability?.title ?? 'unknown'} (score ${Math.round(match.matchScore * 100)}%)`,
        content: `Capability Match: ${match.capability?.title ?? 'unknown'}\nScore: ${match.matchScore}\nReason: ${match.reason}\nBusiness Problem: ${match.businessProblem ?? 'unknown'}\nExpected Outcome: ${match.expectedOutcome ?? 'unknown'}\nSales Angle: ${match.salesAngle ?? 'unknown'}`,
        reliability,
        confidence,
        entityId: match.id,
        entityType: 'company',
      });
    }

    if (matches.length === 0) {
      gaps.push({
        dimension: 'capability_matches',
        description: 'No capability matches detected — opportunity to map signals to our offerings.',
        impact: 0.15,
      });
    }
  } catch (err) {
    logger.error(`[grounding-engine] capability matches collection failed: ${err instanceof Error ? err.message : err}`);
    gaps.push({
      dimension: 'capability_matches',
      description: 'Failed to load capability matches from database.',
      impact: 0.1,
    });
  }

  return { evidences, gaps };
}

/** Collect evidence from prior AIInsight records (with feedback weighting). */
async function collectAIInsights(
  ctx: GroundingContext,
  maxEvidence: number,
): Promise<{ evidences: Evidence[]; gaps: EvidenceGap[] }> {
  if (!ctx.companyId && !ctx.contactId) return { evidences: [], gaps: [] };

  const evidences: Evidence[] = [];

  try {
    const insights = await db.aIInsight.findMany({
      where: {
        OR: [
          { companyId: ctx.companyId ?? undefined },
          { contactId: ctx.contactId ?? undefined },
        ],
        status: { not: 'rejected' },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(maxEvidence, 10),
    });

    for (const ins of insights) {
      // Feedback-adjusted reliability: positive feedback boosts, negative lowers
      let reliability = 0.7;
      if (ins.feedback === 'positive') reliability = 0.85;
      if (ins.feedback === 'negative') reliability = 0.35;
      const freshness = freshnessScore(ins.createdAt.toISOString());
      const confidence = ((ins.confidenceScore ?? 50) / 100) * 0.7 + reliability * 0.3;

      evidences.push({
        id: `insight:${ins.id}`,
        type: 'ai_insight',
        source: 'Prior AI Insight',
        url: null,
        date: ins.createdAt.toISOString(),
        snippet: `${ins.title}${ins.description ? ' — ' + ins.description.slice(0, 200) : ''}`,
        content: `${ins.title}\n${ins.description ?? ''}\nType: ${ins.type}\nConfidence: ${ins.confidenceScore}\nImpact: ${ins.impactScore}\nReasoning: ${ins.reasoning ?? 'none'}\nRecommended: ${ins.recommendedAction ?? 'none'}`,
        reliability: reliability * freshness, // stale insights decay
        confidence,
        entityId: ins.id,
        entityType: ins.companyId ? 'company' : 'contact',
      });
    }
  } catch (err) {
    logger.error(`[grounding-engine] AI insights collection failed: ${err instanceof Error ? err.message : err}`);
  }

  return { evidences, gaps: [] };
}

/** Collect evidence from generic Evidence records (per-field source tracking). */
async function collectEvidenceRecords(
  ctx: GroundingContext,
  maxEvidence: number,
): Promise<{ evidences: Evidence[]; gaps: EvidenceGap[] }> {
  if (!ctx.companyId) return { evidences: [], gaps: [] };

  const evidences: Evidence[] = [];

  try {
    const records = await db.evidence.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(maxEvidence, 15),
    });

    for (const ev of records) {
      const reliability = reliabilityFor(ev.sourceUrl ?? null);
      const freshness = freshnessScore(ev.createdAt?.toISOString() ?? null);
      const confidence = (ev.confidence ?? 0.5) * 0.6 + reliability * 0.4;

      evidences.push({
        id: `evidence:${ev.id}`,
        type: 'evidence',
        source: ev.sourceName ?? ev.sourceTitle ?? 'Evidence Record',
        url: ev.sourceUrl ?? null,
        date: ev.createdAt?.toISOString() ?? null,
        snippet: `${ev.extractedField ?? 'Field'}: ${ev.extractedValue ?? 'unknown'}`,
        content: `Field: ${ev.extractedField ?? 'unknown'}\nValue: ${ev.extractedValue ?? 'unknown'}\nSource: ${ev.sourceName ?? ev.sourceTitle ?? 'unknown'}\nSnippet: ${ev.snippet ?? ''}\nConfidence: ${ev.confidence ?? 'unknown'}`,
        reliability: reliability * freshness,
        confidence,
        entityId: ev.id,
        entityType: 'company',
      });
    }
  } catch (err) {
    logger.error(`[grounding-engine] evidence records collection failed: ${err instanceof Error ? err.message : err}`);
  }

  return { evidences, gaps: [] };
}

// ─── Aggregate Confidence ───────────────────────────────────────────────

/**
 * Compute aggregate confidence from a list of evidences.
 * Weighted average of (reliability × confidence × freshness), penalized
 * for coverage gaps, rewarded for type diversity.
 */
function computeAggregateConfidence(
  evidences: Evidence[],
  gaps: EvidenceGap[],
): { confidence: number; coverage: number; freshness: number } {
  if (evidences.length === 0) {
    return { confidence: 0, coverage: 0, freshness: 0 };
  }

  // Weighted average
  let totalWeight = 0;
  let weightedSum = 0;
  let freshnessSum = 0;
  let freshnessWeight = 0;

  for (const ev of evidences) {
    const weight = ev.reliability;
    const score = ev.confidence;
    weightedSum += weight * score;
    totalWeight += weight;

    const evFreshness = ev.date ? freshnessScore(ev.date) : 0.3;
    freshnessSum += evFreshness * weight;
    freshnessWeight += weight;
  }

  const baseConfidence = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const freshness = freshnessWeight > 0 ? freshnessSum / freshnessWeight : 0;

  // Type diversity bonus (0-1, where 1 = many different evidence types)
  const types = new Set(evidences.map((e) => e.type));
  const diversityBonus = Math.min(0.15, types.size * 0.03);

  // Gap penalty
  const gapPenalty = gaps.reduce((sum, g) => sum + g.impact, 0);

  // Coverage = 1 - normalized gap penalty
  const coverage = Math.max(0, 1 - gapPenalty);

  const confidence = Math.max(0, Math.min(1, baseConfidence + diversityBonus - gapPenalty * 0.5));

  return { confidence, coverage, freshness };
}

// ─── GroundingEngine ────────────────────────────────────────────────────

export const GroundingEngine = {
  /**
   * Build an EvidenceChain for the given context. Non-throwing.
   */
  async collect(context: GroundingContext): Promise<EvidenceChain> {
    const builtAt = new Date().toISOString();
    const maxEvidence = context.maxEvidence ?? 50;
    const errors: string[] = [];

    logger.info(`[grounding-engine] collecting for company=${context.companyId ?? '-'} ` +
        `contact=${context.contactId ?? '-'} opp=${context.opportunityId ?? '-'}`);

    const allEvidences: Evidence[] = [];
    const allGaps: EvidenceGap[] = [];

    // Run all collectors in parallel for speed
    const [signals, capMatches, insights, evidenceRecs] = await Promise.all([
      collectCompanySignals(context, maxEvidence).catch((err) => {
        errors.push(`signals: ${err.message}`);
        return { evidences: [], gaps: [] };
      }),
      collectCapabilityMatches(context, maxEvidence).catch((err) => {
        errors.push(`capMatches: ${err.message}`);
        return { evidences: [], gaps: [] };
      }),
      collectAIInsights(context, maxEvidence).catch((err) => {
        errors.push(`insights: ${err.message}`);
        return { evidences: [], gaps: [] };
      }),
      collectEvidenceRecords(context, maxEvidence).catch((err) => {
        errors.push(`evidenceRecs: ${err.message}`);
        return { evidences: [], gaps: [] };
      }),
    ]);

    allEvidences.push(...signals.evidences, ...capMatches.evidences, ...insights.evidences, ...evidenceRecs.evidences);
    allGaps.push(...signals.gaps, ...capMatches.gaps, ...insights.gaps, ...evidenceRecs.gaps);

    // If no context provided, add gap
    if (!context.companyId && !context.contactId && !context.opportunityId) {
      allGaps.push({
        dimension: 'context',
        description: 'No company, contact, or opportunity context provided — cannot collect entity-specific evidence.',
        impact: 0.5,
      });
    }

    // Sort evidences by confidence × reliability (highest first)
    allEvidences.sort((a, b) => b.confidence * b.reliability - a.confidence * a.reliability);

    // Cap at maxEvidence
    const cappedEvidences = allEvidences.slice(0, maxEvidence);

    const { confidence, coverage, freshness } = computeAggregateConfidence(cappedEvidences, allGaps);

    logger.info(
      `[grounding-engine] chain built: ${cappedEvidences.length} evidences, ` +
        `confidence=${confidence.toFixed(2)}, coverage=${coverage.toFixed(2)}, ` +
        `freshness=${freshness.toFixed(2)}, gaps=${allGaps.length}`,
    );

    return {
      evidences: cappedEvidences,
      aggregateConfidence: confidence,
      coverage,
      gaps: allGaps,
      freshnessScore: freshness,
      builtAt,
      context,
      error: errors.length > 0 ? errors.join('; ') : null,
    };
  },

  /**
   * Get a specific evidence by ID from a chain.
   */
  getEvidenceById(chain: EvidenceChain, id: string): Evidence | undefined {
    return chain.evidences.find((e) => e.id === id);
  },

  /**
   * Filter evidence by minimum confidence threshold.
   */
  filterByConfidence(chain: EvidenceChain, minConfidence: number): Evidence[] {
    return chain.evidences.filter((e) => e.confidence >= minConfidence);
  },
};

// ─── Prompt Rendering ───────────────────────────────────────────────────

/**
 * Render an EvidenceChain as a markdown-formatted prompt section with
 * numbered citations [E1], [E2], etc. for LLM injection.
 *
 * Composition engines include this in their system or user prompt to
 * ground the LLM in concrete evidence. The LLM is then instructed to cite
 * [En] markers when making factual claims.
 */
export function renderChainForPrompt(chain: EvidenceChain): string {
  if (chain.evidences.length === 0) {
    return `## Evidence Chain\n\nNo evidence available. Acknowledge this gap explicitly in your response — do NOT fabricate sources or claim evidence you don't have.`;
  }

  const lines: string[] = ['## Evidence Chain', ''];
  lines.push(
    `Aggregate confidence: ${Math.round(chain.aggregateConfidence * 100)}% · ` +
      `Coverage: ${Math.round(chain.coverage * 100)}% · ` +
      `Freshness: ${Math.round(chain.freshnessScore * 100)}% · ` +
      `${chain.evidences.length} sources`,
    '',
  );

  chain.evidences.forEach((ev, i) => {
    const n = i + 1;
    const confPct = Math.round(ev.confidence * 100);
    lines.push(`### [E${n}] ${ev.source} — ${ev.type.replace(/_/g, ' ')}`);
    lines.push(`- **Confidence:** ${confPct}%`);
    if (ev.date) lines.push(`- **Date:** ${ev.date.split('T')[0]}`);
    if (ev.url) lines.push(`- **URL:** ${ev.url}`);
    lines.push(`- **Snippet:** ${ev.snippet}`);
    if (ev.content && ev.content.length > ev.snippet.length) {
      lines.push(`- **Full content:**`);
      lines.push('  ```');
      ev.content.split('\n').forEach((line) => lines.push(`  ${line}`));
      lines.push('  ```');
    }
    lines.push('');
  });

  if (chain.gaps.length > 0) {
    lines.push('### Acknowledged Gaps');
    lines.push('');
    chain.gaps.forEach((gap) => {
      lines.push(
        `- **${gap.dimension}** (impact ${Math.round(gap.impact * 100)}%): ${gap.description}`,
      );
    });
    lines.push('');
  }

  lines.push(
    '**Citation rule:** When making any factual claim, cite the evidence using [En] markers ' +
      '(e.g. "The company raised Series B [E3]"). Do NOT fabricate evidence markers — ' +
      'if a claim isn\'t supported by the evidence above, either find supporting evidence ' +
      'or explicitly state it as an inference.',
  );

  return lines.join('\n');
}
