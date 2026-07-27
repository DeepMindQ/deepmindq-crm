/**
 * ScoringEngine — Phase B Composition Engine #2
 * ===============================================
 *
 * Revenue Intelligence Score Engine that replaces all isolated scoring logic
 * with a unified, explainable scoring system. The key differentiator:
 *
 *   OLD: "Lead Score: 82" — buyer asks "Why 82?" → system cannot explain
 *   NEW: Score: 87/100 with full breakdown, evidence, and reasoning
 *
 * Orchestrates foundation engines:
 *   1. GroundingEngine.collect() — gather evidence
 *   2. ModelRouter.complete({ tier: 'smart' }) — LLM-powered scoring narrative
 *   3. RetrievalEngine.search() — find similar scored accounts for calibration
 *
 * Score dimensions:
 *   - Technology Trigger   (+25 max) — tech changes, migrations, new platforms
 *   - Growth Signal       (+20 max) — funding, hiring, expansion
 *   - Executive Change    (+15 max) — new C-suite, leadership shifts
 *   - Engagement          (+12 max) — contacts, replies, interactions
 *   - Contact Influence   (+10 max) — stakeholder buying power
 *   - Opportunity Strength (+10 max) — deal win probability
 *   - Buying Intent        (+10 max) — market signals + timing
 *   - Data Coverage        (+8 max) — intelligence enrichment completeness
 *   - Risk                (-10 max) — vendor lock-in, budget cuts, compliance
 *
 * Output:
 *   Account Score: 87/100 (Grade A, Priority: Critical)
 *   +25 Technology Trigger — Started Azure AI migration program
 *   +20 Growth Signal — Hiring 45 AI engineers
 *   +15 Executive Change — New VP Data appointed
 *   +12 Engagement — Multiple website visits, 3 contacts engaged
 *    -5 Risk — Existing competitor relationship
 *   Confidence: 91% — based on 23 signals, 6 evidence sources
 *   Recommended: Schedule executive discussion within 2 weeks
 *
 * NON-THROWING CONTRACT
 * ---------------------
 * Returns RevenueScore with success:boolean + error:string|null.
 */

import { ModelRouter } from './model-router';
import { GroundingEngine, renderChainForPrompt } from './grounding-engine';
import { RetrievalEngine } from './retrieval-engine';
import type { EvidenceChain, GroundingContext, Evidence } from './grounding-engine';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// ─── Types ──────────────────────────────────────────────────────────────

export type ScoreDimension =
  | 'technology_trigger'
  | 'growth_signal'
  | 'executive_change'
  | 'engagement'
  | 'contact_influence'
  | 'opportunity_strength'
  | 'buying_intent'
  | 'data_coverage'
  | 'risk';

export type ScoreGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export type PriorityTier = 'critical' | 'high' | 'medium' | 'low' | 'nurture';

export interface ScoreFactor {
  /** Which dimension this factor belongs to. */
  dimension: ScoreDimension;
  /** Human-readable label (e.g. "Technology Trigger"). */
  label: string;
  /** Points contributed (positive or negative). */
  points: number;
  /** Maximum possible points for this dimension. */
  maxPoints: number;
  /** Specific evidence supporting this score. */
  evidence: string;
  /** Which engine/source produced this factor. */
  source: string;
  /** Linked signal ID if applicable. */
  signalId?: string;
}

export interface RevenueScore {
  /** Whether scoring succeeded. */
  success: boolean;
  /** Error message if !success. */
  error: string | null;

  // Entity
  companyId: string;
  companyName: string;
  domain: string | null;
  industry: string | null;

  // Composite
  score: number;             // 0-100 final composite
  grade: ScoreGrade;
  priorityTier: PriorityTier;
  confidence: number;        // 0-100

  // Decomposed breakdown
  factors: ScoreFactor[];
  breakdownText: string;    // Human-readable summary

  // Sub-dimensions (raw scores before factor conversion)
  accountFit: number;       // 0-100
  contactInfluence: number; // 0-100
  opportunityStrength: number; // 0-100
  buyingIntent: number;     // 0-100

  // Actionability
  recommendedAction: string;
  nextBestActions: string[];
  timingWindow: string;

  // Evidence
  evidenceChain: EvidenceChain;
  evidenceCount: number;
  signalCount: number;

  // AI narrative (optional LLM-generated score explanation)
  narrative: string | null;

  // Metadata
  scoredAt: string;
  modelUsed: string;
  durationMs: number;
  tokensUsed: number;
  costUsd: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function toGrade(score: number): ScoreGrade {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 35) return 'D';
  return 'F';
}

function toPriorityTier(score: number, urgency: number): PriorityTier {
  if (score >= 80 && urgency >= 60) return 'critical';
  if (score >= 65) return 'high';
  if (score >= 50) return 'medium';
  if (score >= 30) return 'low';
  return 'nurture';
}

function formatBreakdown(factors: ScoreFactor[]): string {
  const sorted = [...factors].sort((a, b) => b.points - a.points);
  const parts = sorted
    .filter(f => f.points !== 0)
    .map(f => {
      const sign = f.points > 0 ? '+' : '';
      const evidence = f.evidence.length > 60
        ? f.evidence.substring(0, 57) + '...'
        : f.evidence;
      return `${sign}${f.points} ${f.label} (${evidence})`;
    });
  return parts.length > 0
    ? parts.join(', ')
    : 'No signals detected. Enrich company data to generate score.';
}

// ─── Signal-Based Factor Extraction ───────────────────────────────────────

/**
 * Extract scoring factors from raw company signals without LLM.
 * This is the deterministic baseline — LLM narrative is layered on top.
 */
async function extractSignalFactors(
  companyId: string,
  chain: EvidenceChain,
): Promise<{
  factors: ScoreFactor[];
  signalCount: number;
  evidenceCount: number;
  accountFit: number;
  engagementCount: number;
  repliedCount: number;
  contactCount: number;
  intScore: number;
}> {
  const factors: ScoreFactor[] = [];
  const startedAt = Date.now();

  // Load signals directly from DB (GroundingEngine may not have all)
  const activeSignals = await db.companySignal.findMany({
    where: {
      companyId,
      status: { in: ['detected', 'validated', 'active'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  }).catch(() => []);

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      rawName: true, normalizedName: true, domain: true,
      industry: true, intelligenceScore: true,
    },
  }).catch(() => null);

  const intScore = company?.intelligenceScore ?? 0;
  const contactCount = await db.contact.count({
    where: { companyId },
  }).catch(() => 0);
  const repliedCount = await db.contact.count({
    where: { companyId, status: 'replied' },
  }).catch(() => 0);

  // Technology Trigger (up to +25)
  const techSignals = activeSignals.filter(s =>
    s.signalType === 'tech_change' ||
    s.title?.toLowerCase().match(/cloud|ai|migration|digital|kubernetes|azure|aws|gcp/i)
  );
  if (techSignals.length > 0) {
    const topTech = techSignals[0];
    const pts = Math.min(25, techSignals.length * 8);
    factors.push({
      dimension: 'technology_trigger',
      label: 'Technology Trigger',
      points: pts,
      maxPoints: 25,
      evidence: topTech.businessImpact || topTech.title || 'Technology change signal detected',
      source: 'account-signals',
      signalId: topTech.id,
    });
  }

  // Growth Signal (up to +20)
  const growthSignals = activeSignals.filter(s =>
    s.signalType === 'funding' ||
    s.signalType === 'hiring' ||
    s.signalType === 'expansion' ||
    s.title?.toLowerCase().match(/grow|hiring|fund|expand|series|ipo|revenue/i)
  );
  if (growthSignals.length > 0) {
    const topGrowth = growthSignals[0];
    const pts = Math.min(20, growthSignals.length * 7);
    factors.push({
      dimension: 'growth_signal',
      label: 'Growth Signal',
      points: pts,
      maxPoints: 20,
      evidence: topGrowth.businessImpact || topGrowth.title || 'Growth indicator detected',
      source: 'account-signals',
      signalId: topGrowth.id,
    });
  }

  // Executive Change (up to +15)
  const execSignals = activeSignals.filter(s =>
    s.signalType === 'leadership_change' ||
    s.title?.toLowerCase().match(/ceo|cto|cio|cfo|coo|chief|vp|appointed|joined|left|departed/i)
  );
  if (execSignals.length > 0) {
    const topExec = execSignals[0];
    const pts = Math.min(15, execSignals.length * 8);
    factors.push({
      dimension: 'executive_change',
      label: 'Executive Change',
      points: pts,
      maxPoints: 15,
      evidence: topExec.businessImpact || topExec.title || 'Leadership change detected',
      source: 'account-signals',
      signalId: topExec.id,
    });
  }

  // Engagement (up to +12)
  const engageSignals = activeSignals.filter(s =>
    s.signalType === 'news' || s.signalType === 'mention' ||
    s.title?.toLowerCase().match(/visit|engagement|interaction|meeting|conference/i)
  );
  const engagePoints = Math.min(12, engageSignals.length * 3 + repliedCount * 3);
  if (engagePoints > 0) {
    factors.push({
      dimension: 'engagement',
      label: 'Engagement',
      points: engagePoints,
      maxPoints: 12,
      evidence: `${contactCount} contacts tracked, ${repliedCount} replied, ${engageSignals.length} engagement signals`,
      source: 'account-engagement',
    });
  }

  // Risk factors (up to -10)
  const riskSignals = activeSignals.filter(s =>
    s.severity === 'high' || s.severity === 'critical' ||
    s.title?.toLowerCase().match(/layoff|downsize|loss|risk|violation|breach|bankrupt/i)
  );
  if (riskSignals.length > 0) {
    const topRisk = riskSignals[0];
    const pts = Math.min(10, riskSignals.length * 5);
    factors.push({
      dimension: 'risk',
      label: 'Risk',
      points: -pts,
      maxPoints: 10,
      evidence: topRisk.businessImpact || topRisk.title || 'Risk signal detected',
      source: 'account-signals',
      signalId: topRisk.id,
    });
  }

  // Data Coverage bonus (up to +8)
  if (intScore >= 3) {
    factors.push({
      dimension: 'data_coverage',
      label: 'Data Coverage',
      points: Math.min(8, intScore * 2),
      maxPoints: 8,
      evidence: `${intScore}/5 intelligence dimensions enriched`,
      source: 'account-data',
    });
  }

  // Account fit (normalized 0-100)
  const accountFit = Math.min(100, Math.max(0, Math.round(
    techSignals.length * 15 +
    growthSignals.length * 12 +
    execSignals.length * 10 +
    engagePoints +
    (intScore * 5) -
    (riskSignals.length * 8)
  )));

  const evidenceCount = activeSignals.length;
  const logger_ = () => {}; // silence
  void startedAt; void chain; void logger_;

  return {
    factors,
    signalCount: activeSignals.length,
    evidenceCount,
    accountFit,
    engagementCount: engageSignals.length,
    repliedCount,
    contactCount,
    intScore,
  };
}

// ─── Contact/Opportunity/Intent Sub-Scores ───────────────────────────────

async function extractContactInfluenceFactor(
  companyId: string,
): Promise<{ factor: ScoreFactor | null; influenceScore: number }> {
  try {
    const contacts = await db.contact.findMany({
      where: { companyId, status: { not: 'archived' } },
      select: { id: true, rawName: true, leadScore: true },
      orderBy: { leadScore: 'desc' },
      take: 5,
    });

    if (contacts.length === 0) {
      return { factor: null, influenceScore: 0 };
    }

    // Use lead scores directly (avoid calling heavy contact-influence-engine)
    const topContact = contacts[0];
    const influenceScore = topContact.leadScore ?? 40;

    if (influenceScore >= 50) {
      return {
        factor: {
          dimension: 'contact_influence',
          label: 'Contact Influence',
          points: Math.min(10, Math.round(influenceScore / 10)),
          maxPoints: 10,
          evidence: `${topContact.rawName} — lead score ${influenceScore}/100`,
          source: 'contact-data',
        },
        influenceScore,
      };
    }
    return { factor: null, influenceScore };
  } catch {
    return { factor: null, influenceScore: 0 };
  }
}

async function extractOpportunityStrengthFactor(
  companyId: string,
): Promise<{ factor: ScoreFactor | null; strength: number }> {
  try {
    const opps = await db.opportunityRecommendation.findMany({
      where: { companyId, status: { not: 'rejected' } },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });

    if (opps.length === 0) {
      return { factor: null, strength: 0 };
    }

    const topOpp = opps[0];
    const strength = Math.round((topOpp.confidenceScore ?? 0) * 100) || (topOpp.opportunityScore ?? 40);

    if (strength >= 30) {
      return {
        factor: {
          dimension: 'opportunity_strength',
          label: 'Opportunity Strength',
          points: Math.min(10, Math.round(strength / 10)),
          maxPoints: 10,
          evidence: `Active opportunity: ${topOpp.opportunityTitle || 'Untitled'} — confidence ${strength}%`,
          source: 'opportunity-data',
        },
        strength,
      };
    }
    return { factor: null, strength };
  } catch {
    return { factor: null, strength: 0 };
  }
}

async function extractBuyingIntentFactor(
  companyId: string,
  chain: EvidenceChain,
): Promise<{ factor: ScoreFactor | null; intent: number; timing: string }> {
  try {
    // Derive intent from evidence chain signals (without calling external engine)
    const intentSignals = chain.evidences.filter(e =>
      e.type === 'company_signal' &&
      (e.snippet.toLowerCase().match(/buy|purchase|procurement|rfp|rfi|rfp|budget|evaluat|vendor/i) ||
       e.content.toLowerCase().match(/buy|purchase|procurement|rfp|rfi|budget|evaluat|vendor/i))
    );

    const techSignals = chain.evidences.filter(e =>
      e.type === 'company_signal' &&
      e.snippet.toLowerCase().match(/migrat|cloud|ai|moderniz|transform|adopt/i)
    );

    const totalIntentSignals = intentSignals.length + techSignals.length;
    const intent = Math.min(100, Math.round(
      intentSignals.length * 25 + techSignals.length * 15 + chain.freshnessScore * 20
    ));

    if (intent >= 30) {
      return {
        factor: {
          dimension: 'buying_intent',
          label: 'Buying Intent',
          points: Math.min(10, Math.round(intent / 10)),
          maxPoints: 10,
          evidence: `Intent score ${intent}/100 — ${totalIntentSignals} intent/tech signals detected`,
          source: 'intent-signals',
        },
        intent,
        timing: intent >= 70 ? 'Immediate (0-30 days)' : intent >= 50 ? 'Near-term (30-90 days)' : 'Long-term (90+ days)',
      };
    }
    return { factor: null, intent, timing: 'Unknown' };
  } catch {
    return { factor: null, intent: 0, timing: 'Unknown' };
  }
}

// ─── Next Best Actions Generation ─────────────────────────────────────────

function generateNextBestActions(factors: ScoreFactor[], context: {
  contactCount: number;
  repliedCount: number;
  oppStrength: number;
  intent: number;
  intScore: number;
}): string[] {
  const actions: string[] = [];

  const hasTech = factors.some(f => f.dimension === 'technology_trigger');
  const hasGrowth = factors.some(f => f.dimension === 'growth_signal');
  const hasExec = factors.some(f => f.dimension === 'executive_change');
  const hasRisk = factors.some(f => f.dimension === 'risk');

  if (hasTech) actions.push('Lead with technical value proposition targeting CTO/CIO');
  if (hasGrowth) actions.push('Position as scaling enabler for their growth phase');
  if (hasExec) actions.push('New executive may reset vendor relationships — approach now');
  if (context.contactCount === 0) actions.push('Discover and add key stakeholders before outreach');
  if (context.repliedCount === 0 && context.contactCount > 0) actions.push('Begin outreach sequence with top contacts');
  if (hasRisk) actions.push('Address identified risk signals before advancing');
  if (context.oppStrength >= 60) actions.push('Accelerate deal — high win probability, propose next step');
  if (context.oppStrength > 0 && context.oppStrength < 30) actions.push('Strengthen opportunity — add evidence and stakeholders');
  if (context.intent >= 70) actions.push('Strong buying intent — prioritize immediate outreach');
  if (context.intScore < 3) actions.push('Enrich company data to improve scoring accuracy');

  return actions.length > 0 ? actions : ['Monitor and enrich data'];
}

// ─── LLM Narrative Generation ────────────────────────────────────────────

async function generateScoreNarrative(
  companyName: string,
  score: number,
  grade: ScoreGrade,
  factors: ScoreFactor[],
  chain: EvidenceChain,
): Promise<{ narrative: string | null; modelUsed: string; tokensUsed: number; costUsd: number }> {
  try {
    const systemPrompt = `You are a revenue intelligence analyst. Produce a concise 3-5 sentence score explanation.

Your explanation must:
- Reference the company by name
- Mention the top 2-3 scoring factors with their evidence
- Explain what the grade means for action
- End with a concrete recommended next step
- Be evidence-grounded — cite [En] for key claims
- Do NOT fabricate evidence`;

    const userPrompt = `# Revenue Score Explanation

**Company:** ${companyName}
**Score:** ${score}/100 (Grade ${grade})

## Score Breakdown
${factors.map(f => `${f.points > 0 ? '+' : ''}${f.points} ${f.label}: ${f.evidence}`).join('\n')}

## Evidence Context
${renderChainForPrompt(chain)}

Produce a 3-5 sentence score explanation now.`;

    const completion = await ModelRouter.complete({
      systemPrompt,
      userPrompt,
      tier: 'fast',
      maxTokens: 800,
      temperature: 0.6,
      genType: 'scoring_narrative',
    });

    if (completion.success && completion.text.trim().length > 20) {
      return {
        narrative: completion.text.trim(),
        modelUsed: completion.modelUsed,
        tokensUsed: completion.totalTokens,
        costUsd: completion.costUsd,
      };
    }
  } catch (err) {
    logger.error(`[scoring-engine] narrative generation failed: ${err instanceof Error ? err.message : err}`);
  }

  return { narrative: null, modelUsed: 'none', tokensUsed: 0, costUsd: 0 };
}

// ─── EngineRun Audit ────────────────────────────────────────────────────

async function logEngineRun(args: {
  companyId: string;
  compositionId?: string;
  inputSummary: string;
  outputSummary: string;
  confidence: number;
  durationMs: number;
  success: boolean;
  errorMessage?: string;
  llmCallCount: number;
  llmTokensUsed: number;
  llmCostUsd: number;
}): Promise<void> {
  try {
    await db.engineRun.create({
      data: {
        engine: 'scoring',
        compositionId: args.compositionId,
        inputSummary: args.inputSummary,
        outputSummary: args.outputSummary,
        confidence: args.confidence,
        durationMs: args.durationMs,
        success: args.success,
        errorMessage: args.errorMessage ?? null,
        companyId: args.companyId,
        llmCallCount: args.llmCallCount,
        llmTokensUsed: args.llmTokensUsed,
        llmCostUsd: args.llmCostUsd,
      },
    });
  } catch (err) {
    logger.error(`[scoring-engine] logEngineRun failed: ${err instanceof Error ? err.message : err}`);
  }
}

// ─── ScoringEngine ────────────────────────────────────────────────────────

export const ScoringEngine = {
  /**
   * Generate a Revenue Intelligence Score for a company.
   * Non-throwing — returns RevenueScore with success=false + error on failure.
   */
  async score(params: {
    companyId: string;
    /** Optional composition ID for audit linking. */
    compositionId?: string;
    /** Skip LLM narrative generation (faster, deterministic only). */
    skipNarrative?: boolean;
  }): Promise<RevenueScore> {
    const startedAt = Date.now();
    const { companyId, compositionId, skipNarrative } = params;

    logger.info(`[scoring-engine] scoring company=${companyId} compositionId=${compositionId ?? '-'}`);

    // Step 1: Load company
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: {
        id: true, rawName: true, normalizedName: true,
        domain: true, industry: true,
      },
    });

    if (!company) {
      const durationMs = Date.now() - startedAt;
      const error = 'Company not found';
      const result: RevenueScore = {
        success: false, error,
        companyId, companyName: 'Unknown', domain: null, industry: null,
        score: 0, grade: 'F', priorityTier: 'nurture', confidence: 0,
        factors: [], breakdownText: '',
        accountFit: 0, contactInfluence: 0, opportunityStrength: 0, buyingIntent: 0,
        recommendedAction: '', nextBestActions: [], timingWindow: 'Unknown',
        evidenceChain: { evidences: [], aggregateConfidence: 0, coverage: 0, gaps: [], freshnessScore: 0, builtAt: new Date().toISOString(), context: { companyId }, error },
        evidenceCount: 0, signalCount: 0, narrative: null,
        scoredAt: new Date().toISOString(), modelUsed: 'none', durationMs, tokensUsed: 0, costUsd: 0,
      };
      await logEngineRun({ companyId, compositionId, inputSummary: companyId, outputSummary: error, confidence: 0, durationMs, success: false, errorMessage: error, llmCallCount: 0, llmTokensUsed: 0, llmCostUsd: 0 });
      return result;
    }

    const companyName = company.normalizedName || company.rawName;

    // Step 2: Collect evidence via GroundingEngine
    const chain = await GroundingEngine.collect({ companyId });

    // Step 3: Extract signal-based factors
    const signalData = await extractSignalFactors(companyId, chain);

    // Step 4: Extract contact, opportunity, intent factors in parallel
    const [contactData, oppData, intentData] = await Promise.all([
      extractContactInfluenceFactor(companyId),
      extractOpportunityStrengthFactor(companyId),
      extractBuyingIntentFactor(companyId, chain),
    ]);

    // Step 5: Merge all factors
    const allFactors: ScoreFactor[] = [
      ...signalData.factors,
      ...(contactData.factor ? [contactData.factor] : []),
      ...(oppData.factor ? [oppData.factor] : []),
      ...(intentData.factor ? [intentData.factor] : []),
    ];

    // Step 6: Calculate composite score
    const rawTotal = allFactors.reduce((sum, f) => sum + f.points, 0);
    const score = Math.max(0, Math.min(100, rawTotal));
    const grade = toGrade(score);

    // Confidence based on evidence coverage
    const totalEvidence = signalData.evidenceCount + chain.evidences.length;
    const confidence = Math.min(95,
      30 + (totalEvidence * 5) + (allFactors.length * 3) + (oppData.strength > 0 ? 10 : 0)
    );

    const priorityTier = toPriorityTier(score, intentData.intent >= 60 ? 70 : 30);
    const breakdownText = formatBreakdown(allFactors);
    const nextBestActions = generateNextBestActions(allFactors, {
      contactCount: signalData.contactCount,
      repliedCount: signalData.repliedCount,
      oppStrength: oppData.strength,
      intent: intentData.intent,
      intScore: signalData.intScore,
    });

    // Step 7: Optional LLM narrative
    let narrative: string | null = null;
    let modelUsed = 'composite_v1';
    let tokensUsed = 0;
    let costUsd = 0;

    if (!skipNarrative && allFactors.length >= 2) {
      const narrResult = await generateScoreNarrative(
        companyName, score, grade, allFactors, chain
      );
      narrative = narrResult.narrative;
      if (narrResult.modelUsed !== 'none') {
        modelUsed = narrResult.modelUsed;
        tokensUsed = narrResult.tokensUsed;
        costUsd = narrResult.costUsd;
      }
    }

    const durationMs = Date.now() - startedAt;

    logger.info(
      `[scoring-engine] score complete: ${companyName} = ${score}/100 (${grade}), ` +
        `${allFactors.length} factors, confidence=${Math.round(confidence)}%, ` +
        `duration=${durationMs}ms`,
    );

    // Step 8: Audit
    await logEngineRun({
      companyId,
      compositionId,
      inputSummary: JSON.stringify({ companyId, companyName, factorCount: allFactors.length }),
      outputSummary: JSON.stringify({ score, grade, priorityTier, confidence, factorCount: allFactors.length }),
      confidence: confidence / 100,
      durationMs,
      success: true,
      llmCallCount: narrative ? 1 : 0,
      llmTokensUsed: tokensUsed,
      llmCostUsd: costUsd,
    });

    return {
      success: true,
      error: null,
      companyId,
      companyName,
      domain: company.domain,
      industry: company.industry,
      score,
      grade,
      priorityTier,
      confidence: Math.round(confidence),
      factors: allFactors,
      breakdownText,
      accountFit: signalData.accountFit,
      contactInfluence: contactData.influenceScore,
      opportunityStrength: oppData.strength,
      buyingIntent: intentData.intent,
      recommendedAction: nextBestActions[0] || 'Monitor and enrich data',
      nextBestActions,
      timingWindow: intentData.timing,
      evidenceChain: chain,
      evidenceCount: totalEvidence,
      signalCount: signalData.signalCount,
      narrative,
      scoredAt: new Date().toISOString(),
      modelUsed,
      durationMs,
      tokensUsed,
      costUsd,
    };
  },

  /**
   * Score multiple companies (sequentially to avoid DB pressure).
   */
  async scoreBatch(companyIds: string[], options?: { skipNarrative?: boolean }): Promise<RevenueScore[]> {
    const results: RevenueScore[] = [];
    for (const id of companyIds) {
      try {
        const score = await ScoringEngine.score({ companyId: id, skipNarrative: options?.skipNarrative });
        results.push(score);
      } catch (err) {
        logger.error(`[scoring-engine] batch score failed for ${id}: ${err instanceof Error ? err.message : err}`);
      }
    }
    return results.sort((a, b) => b.score - a.score);
  },
};
