/**
 * ActionEngine — Phase B Composition Engine #3
 * ===============================================
 *
 * The decision and action intelligence layer that transforms information
 * into revenue outcomes. A CRM tells "What happened." DeepMindQ tells
 * "What should I do next?"
 *
 * Orchestrates foundation engines:
 *   1. GroundingEngine.collect() — gather evidence
 *   2. ScoringEngine.score() — get current revenue score
 *   3. ModelRouter.complete({ tier: 'smart' }) — LLM-powered action reasoning
 *   4. RetrievalEngine.search() — find similar accounts for pattern matching
 *
 * Action Types:
 *   - next_best_action    The single most impactful action to take now
 *   - sales_motion        Recommended sales approach (discovery/qualification/demo/proposal/negotiation)
 *   - account_strategy    High-level account engagement strategy
 *   - opportunity_accel   How to accelerate a specific deal
 *   - risk_mitigation     How to address detected risks
 *   - outreach            Specific outreach recommendation with message
 *
 * Example Output:
 *   Signal Detected: CIO hired 3 cloud architects
 *   AI Recommendation:
 *     Action: Schedule executive discussion
 *     Reason: Company entering modernization phase
 *     Message: "We noticed your cloud modernization initiative..."
 *     Timing: This week (window closing in 14 days)
 *     Confidence: 85%
 *     Evidence: 4 signals, 2 contacts, hiring pattern
 *
 * NON-THROWING CONTRACT
 * ---------------------
 * Returns ActionResult with success:boolean + error:string|null.
 */

import { ModelRouter } from './model-router';
import { GroundingEngine, renderChainForPrompt } from './grounding-engine';
import { RetrievalEngine } from './retrieval-engine';
import { ScoringEngine } from './scoring-engine';
import type { EvidenceChain, GroundingContext, Evidence } from './grounding-engine';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// ─── Types ──────────────────────────────────────────────────────────────

export type ActionType =
  | 'next_best_action'
  | 'sales_motion'
  | 'account_strategy'
  | 'opportunity_accel'
  | 'risk_mitigation'
  | 'outreach';

export type SalesMotion =
  | 'discovery'
  | 'qualification'
  | 'demo'
  | 'proposal'
  | 'negotiation'
  | 'expansion'
  | 'retention'
  | 'reactivation'
  | 'nurture';

export type UrgencyLevel = 'immediate' | 'this_week' | 'this_month' | 'this_quarter' | 'when_ready';

export interface RecommendedAction {
  /** Unique identifier for this action. */
  id: string;
  /** Action type classification. */
  type: ActionType;
  /** Human-readable action title. */
  title: string;
  /** Detailed explanation of why this action is recommended. */
  reason: string;
  /** What the rep should actually do (concrete step). */
  concreteStep: string;
  /** Recommended message/template for outreach actions. */
  suggestedMessage: string | null;
  /** Who to target (contact name or role). */
  targetContact: string | null;
  /** Target contact ID if applicable. */
  targetContactId: string | null;
  /** Which sales motion this fits into. */
  salesMotion: SalesMotion;
  /** How urgent this action is. */
  urgency: UrgencyLevel;
  /** Expected impact score 0-100. */
  impactScore: number;
  /** Evidence supporting this recommendation. */
  evidence: string[];
  /** Linked signal IDs that triggered this action. */
  signalIds: string[];
  /** Confidence in this recommendation 0-100. */
  confidence: number;
}

export interface ActionResult {
  /** Whether action generation succeeded. */
  success: boolean;
  /** Error message if !success. */
  error: string | null;

  // Entity context
  companyId: string;
  companyName: string;
  contactId: string | null;
  contactName: string | null;
  opportunityId: string | null;

  // Actions
  /** The single best action to take right now. */
  primaryAction: RecommendedAction | null;
  /** Full prioritized list of recommended actions. */
  actions: RecommendedAction[];
  /** Detected sales motion for this account. */
  detectedSalesMotion: SalesMotion;
  /** Account-level strategy summary. */
  accountStrategy: string | null;
  /** Risk mitigation actions if risks detected. */
  riskActions: RecommendedAction[];

  // Intelligence context
  currentScore: number | null;
  evidenceChain: EvidenceChain;
  triggerSignals: string[];

  // AI narrative
  strategyNarrative: string | null;

  // Metadata
  generatedAt: string;
  modelUsed: string;
  durationMs: number;
  tokensUsed: number;
  costUsd: number;
}

// ─── Trigger Signal Detection ────────────────────────────────────────────

interface TriggerSignal {
  id: string;
  title: string;
  signalType: string;
  severity: string;
  businessImpact: string | null;
  createdAt: Date;
}

async function detectTriggerSignals(
  companyId: string,
  daysBack = 30,
): Promise<TriggerSignal[]> {
  const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  try {
    const signals = await db.companySignal.findMany({
      where: {
        companyId,
        createdAt: { gte: cutoff },
        status: { in: ['detected', 'validated', 'active'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });
    return signals.map(s => ({
      id: s.id,
      title: s.title || s.signalType,
      signalType: s.signalType,
      severity: s.severity || 'medium',
      businessImpact: s.businessImpact,
      createdAt: s.createdAt,
    }));
  } catch {
    return [];
  }
}

// ─── Deterministic Action Generation ────────────────────────────────────

function generateDeterministicActions(
  companyName: string,
  signals: TriggerSignal[],
  chain: EvidenceChain,
  contactCount: number,
  repliedCount: number,
  score: number | null,
): RecommendedAction[] {
  const actions: RecommendedAction[] = [];
  let actionId = 0;

  const makeId = () => `action_${++actionId}_${Date.now()}`;

  // Technology Trigger → Outreach to technical buyer
  const techSignals = signals.filter(s =>
    s.signalType === 'tech_change' ||
    s.title.toLowerCase().match(/cloud|ai|migration|digital|kubernetes|azure|aws|gcp/i)
  );
  if (techSignals.length > 0) {
    const topTech = techSignals[0];
    actions.push({
      id: makeId(),
      type: 'outreach',
      title: `Schedule technical discussion with ${companyName}`,
      reason: `Detected ${topTech.title.toLowerCase()} — company is actively investing in technology transformation. This is a prime window to position your solution.`,
      concreteStep: 'Research their current tech stack, prepare a technical value prop, and reach out to the CTO or VP Engineering.',
      suggestedMessage: `Hi, I noticed ${companyName} is ${topTech.title.toLowerCase()}. We've helped similar organizations navigate this transition and achieve 40% faster time-to-value. Would a 15-minute technical discussion be useful?`,
      targetContact: 'CTO / VP Engineering',
      targetContactId: null,
      salesMotion: 'discovery',
      urgency: 'this_week',
      impactScore: 85,
      evidence: [topTech.title, topTech.businessImpact || 'Technology change detected'],
      signalIds: [topTech.id],
      confidence: 80,
    });
  }

  // Hiring Signal → Outreach for scaling solutions
  const hiringSignals = signals.filter(s =>
    s.signalType === 'hiring' ||
    s.title.toLowerCase().match(/hir|recruit|job|position|talent/i)
  );
  if (hiringSignals.length > 0) {
    const topHire = hiringSignals[0];
    actions.push({
      id: makeId(),
      type: 'next_best_action',
      title: `Position scaling solution for ${companyName}'s growth`,
      reason: `${topHire.title} indicates the team is expanding. Growing teams need tools that scale with them — this is a natural entry point.`,
      concreteStep: 'Identify the hiring manager or department head, research their growth plans, and propose a scaling-oriented conversation.',
      suggestedMessage: `Congratulations on the team expansion at ${companyName}. As teams grow, visibility and efficiency often become challenges. We specialize in helping scaling organizations maintain momentum — would love to share how.`,
      targetContact: 'Hiring Manager / Department Head',
      targetContactId: null,
      salesMotion: 'discovery',
      urgency: 'this_month',
      impactScore: 70,
      evidence: [topHire.title],
      signalIds: [topHire.id],
      confidence: 70,
    });
  }

  // Executive Change → Reset opportunity
  const execSignals = signals.filter(s =>
    s.signalType === 'leadership_change' ||
    s.title.toLowerCase().match(/ceo|cto|cio|cfo|coo|chief|vp|appointed|joined|left|departed/i)
  );
  if (execSignals.length > 0) {
    const topExec = execSignals[0];
    actions.push({
      id: makeId(),
      type: 'account_strategy',
      title: `Engage new leadership at ${companyName}`,
      reason: `Leadership change detected: ${topExec.title}. New executives often reassess vendor relationships and strategic priorities within the first 90 days.`,
      concreteStep: 'Research the new executive\'s background, identify shared connections, and craft a personalized introduction highlighting relevant case studies.',
      suggestedMessage: `Welcome to ${companyName}. Given your background, I thought you might be interested in how we've helped similar organizations in the ${''}space achieve measurable outcomes. Would a brief introduction call be valuable?`,
      targetContact: topExec.title.includes('CTO') || topExec.title.includes('CIO')
        ? 'New Technology Executive'
        : topExec.title.includes('CFO') ? 'New Finance Executive'
        : 'New Executive',
      targetContactId: null,
      salesMotion: 'discovery',
      urgency: 'this_week',
      impactScore: 90,
      evidence: [topExec.title, topExec.businessImpact || 'Leadership change creates vendor reassessment window'],
      signalIds: [topExec.id],
      confidence: 75,
    });
  }

  // Funding Signal → Budget availability
  const fundingSignals = signals.filter(s =>
    s.signalType === 'funding' ||
    s.title.toLowerCase().match(/fund|series|investment|capital|raise|ipo/i)
  );
  if (fundingSignals.length > 0) {
    const topFund = fundingSignals[0];
    actions.push({
      id: makeId(),
      type: 'opportunity_accel',
      title: `Approach ${companyName} with funded initiative proposal`,
      reason: `${topFund.title} indicates available capital. Newly funded companies are actively looking for solutions that help them deploy capital effectively.`,
      concreteStep: 'Research their funding round details (amount, investors, stated goals), and prepare a proposal that aligns with their growth mandate.',
      suggestedMessage: `Congratulations on the recent funding. Organizations at your stage often need to quickly demonstrate ROI on new investments. We've helped funded companies achieve measurable outcomes within 90 days — happy to share specifics.`,
      targetContact: 'CEO / COO',
      targetContactId: null,
      salesMotion: 'qualification',
      urgency: 'this_week',
      impactScore: 85,
      evidence: [topFund.title],
      signalIds: [topFund.id],
      confidence: 80,
    });
  }

  // No contacts → Discovery first
  if (contactCount === 0) {
    actions.push({
      id: makeId(),
      type: 'next_best_action',
      title: `Map stakeholders at ${companyName}`,
      reason: `No contacts tracked for ${companyName}. Cannot execute outreach or account strategy without identified decision-makers.`,
      concreteStep: 'Use LinkedIn, company website, and press releases to identify key stakeholders (CIO, CTO, VP Sales, VP Marketing). Add them as contacts.',
      suggestedMessage: null,
      targetContact: null,
      targetContactId: null,
      salesMotion: 'discovery',
      urgency: 'immediate',
      impactScore: 95,
      evidence: ['Zero contacts in database'],
      signalIds: [],
      confidence: 95,
    });
  }

  // No replies → Begin outreach
  if (contactCount > 0 && repliedCount === 0) {
    actions.push({
      id: makeId(),
      type: 'outreach',
      title: `Initiate outreach sequence for ${companyName}`,
      reason: `${contactCount} contacts tracked but zero replies. The outreach sequence has not been started or needs optimization.`,
      concreteStep: 'Review contact profiles, select the most influential contact, and begin a personalized outreach sequence.',
      suggestedMessage: null, // Will be personalized per contact
      targetContact: 'Top contact by influence score',
      targetContactId: null,
      salesMotion: 'discovery',
      urgency: 'this_week',
      impactScore: 75,
      evidence: [`${contactCount} contacts, 0 replies`],
      signalIds: [],
      confidence: 70,
    });
  }

  // High risk signals
  const riskSignals = signals.filter(s =>
    s.severity === 'high' || s.severity === 'critical' ||
    s.title.toLowerCase().match(/layoff|downsize|loss|risk|violation|breach/i)
  );
  if (riskSignals.length > 0) {
    for (const risk of riskSignals.slice(0, 2)) {
      actions.push({
        id: makeId(),
        type: 'risk_mitigation',
        title: `Address risk: ${risk.title}`,
        reason: `High-severity risk detected at ${companyName}: ${risk.title}. This may affect deal viability or relationship health.`,
        concreteStep: 'Research the risk context, prepare a risk mitigation plan, and communicate proactively with the account contact.',
        suggestedMessage: `I wanted to check in regarding recent developments at ${companyName}. We're committed to supporting you through transitions and would like to discuss how we can help maintain continuity.`,
        targetContact: 'Primary account contact',
        targetContactId: null,
        salesMotion: 'retention',
        urgency: 'immediate',
        impactScore: 80,
        evidence: [risk.title, risk.businessImpact || 'High-severity risk'],
        signalIds: [risk.id],
        confidence: 70,
      });
    }
  }

  // Score-based actions
  if (score !== null) {
    if (score >= 80) {
      actions.push({
        id: makeId(),
        type: 'opportunity_accel',
        title: `Accelerate ${companyName} deal — score ${score}/100`,
        reason: `Revenue score of ${score}/100 indicates strong buying signals and high opportunity fit. This account should be prioritized for immediate advancement.`,
        concreteStep: 'Schedule executive meeting, prepare tailored proposal, and propose concrete next steps with timeline.',
        suggestedMessage: null,
        targetContact: 'Economic buyer / Decision maker',
        targetContactId: null,
        salesMotion: score >= 85 ? 'negotiation' : 'proposal',
        urgency: 'immediate',
        impactScore: 90,
        evidence: [`Revenue score: ${score}/100`],
        signalIds: [],
        confidence: 80,
      });
    } else if (score >= 50 && score < 70) {
      actions.push({
        id: makeId(),
        type: 'next_best_action',
        title: `Strengthen ${companyName} engagement — score ${score}/100`,
        reason: `Revenue score of ${score}/100 shows moderate interest. Focus on adding more evidence and stakeholder engagement to move the needle.`,
        concreteStep: 'Identify additional stakeholders, create engagement touchpoints, and enrich company intelligence.',
        suggestedMessage: null,
        targetContact: null,
        targetContactId: null,
        salesMotion: 'qualification',
        urgency: 'this_month',
        impactScore: 60,
        evidence: [`Revenue score: ${score}/100`],
        signalIds: [],
        confidence: 65,
      });
    }
  }

  // Sort by impactScore descending
  actions.sort((a, b) => b.impactScore - a.impactScore);

  return actions;
}

// ─── Sales Motion Detection ──────────────────────────────────────────────

function detectSalesMotion(
  signals: TriggerSignal[],
  score: number | null,
  contactCount: number,
  repliedCount: number,
): SalesMotion {
  const hasTechTrigger = signals.some(s =>
    s.signalType === 'tech_change' ||
    s.title.toLowerCase().match(/cloud|ai|migration|digital/i)
  );
  const hasFunding = signals.some(s =>
    s.signalType === 'funding' ||
    s.title.toLowerCase().match(/fund|series|investment/i)
  );
  const hasExecChange = signals.some(s =>
    s.signalType === 'leadership_change'
  );
  const hasHiring = signals.some(s =>
    s.signalType === 'hiring' ||
    s.title.toLowerCase().match(/hir/i)
  );

  if (contactCount === 0) return 'discovery';
  if (repliedCount === 0 && contactCount > 0) return 'discovery';
  if (hasExecChange) return 'discovery'; // New exec = reset to discovery
  if (score !== null && score >= 85) return 'negotiation';
  if (score !== null && score >= 70) return 'proposal';
  if (hasTechTrigger || hasFunding || hasHiring) return 'qualification';
  if (signals.length > 3) return 'demo';
  if (signals.length === 0) return 'nurture';
  return 'discovery';
}

// ─── LLM Strategy Narrative ──────────────────────────────────────────────

async function generateStrategyNarrative(
  companyName: string,
  actions: RecommendedAction[],
  chain: EvidenceChain,
  score: number | null,
  salesMotion: SalesMotion,
): Promise<{ narrative: string | null; modelUsed: string; tokensUsed: number; costUsd: number }> {
  try {
    const systemPrompt = `You are a senior account strategist producing a concise account strategy.

Your strategy must be:
- 4-6 sentences maximum
- Reference the company name
- Mention the detected sales motion phase
- Cite the top 2 recommended actions with reasoning
- Include a concrete timeline recommendation
- Evidence-grounded: cite [En] for key claims

Do NOT fabricate evidence. Keep it actionable and specific.`;

    const userPrompt = `# Account Strategy Request

**Company:** ${companyName}
**Current Score:** ${score !== null ? `${score}/100` : 'Not yet scored'}
**Sales Motion:** ${salesMotion}
**Actions Identified:** ${actions.length}

## Top Recommended Actions
${actions.slice(0, 5).map((a, i) => `${i + 1}. **${a.title}** (impact: ${a.impactScore}/100, urgency: ${a.urgency})\n   Reason: ${a.reason}`).join('\n')}

## Evidence
${renderChainForPrompt(chain)}

Produce a 4-6 sentence account strategy now.`;

    const completion = await ModelRouter.complete({
      systemPrompt,
      userPrompt,
      tier: 'smart',
      maxTokens: 1500,
      temperature: 0.7,
      genType: 'action_strategy',
      companyId: undefined,
    });

    if (completion.success && completion.text.trim().length > 30) {
      return {
        narrative: completion.text.trim(),
        modelUsed: completion.modelUsed,
        tokensUsed: completion.totalTokens,
        costUsd: completion.costUsd,
      };
    }
  } catch (err) {
    logger.error(`[action-engine] strategy narrative failed: ${err instanceof Error ? err.message : err}`);
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
        engine: 'action',
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
    logger.error(`[action-engine] logEngineRun failed: ${err instanceof Error ? err.message : err}`);
  }
}

// ─── ActionEngine ────────────────────────────────────────────────────────

export const ActionEngine = {
  /**
   * Generate recommended actions for a company/account.
   * Non-throwing — returns ActionResult with success=false + error on failure.
   */
  async recommend(params: {
    companyId: string;
    contactId?: string;
    opportunityId?: string;
    compositionId?: string;
    /** Skip LLM narrative generation. */
    skipNarrative?: boolean;
  }): Promise<ActionResult> {
    const startedAt = Date.now();
    const { companyId, contactId, opportunityId, compositionId, skipNarrative } = params;

    logger.info(`[action-engine] recommending for company=${companyId} contact=${contactId ?? '-'} opp=${opportunityId ?? '-'}`);

    // Step 1: Load company
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { id: true, rawName: true, normalizedName: true },
    });

    if (!company) {
      const durationMs = Date.now() - startedAt;
      const error = 'Company not found';
      await logEngineRun({ companyId, compositionId, inputSummary: companyId, outputSummary: error, confidence: 0, durationMs, success: false, errorMessage: error, llmCallCount: 0, llmTokensUsed: 0, llmCostUsd: 0 });
      return {
        success: false, error,
        companyId, companyName: 'Unknown', contactId: contactId ?? null, contactName: null, opportunityId: opportunityId ?? null,
        primaryAction: null, actions: [], detectedSalesMotion: 'discovery', accountStrategy: null, riskActions: [],
        currentScore: null, evidenceChain: { evidences: [], aggregateConfidence: 0, coverage: 0, gaps: [], freshnessScore: 0, builtAt: new Date().toISOString(), context: { companyId }, error },
        triggerSignals: [], strategyNarrative: null,
        generatedAt: new Date().toISOString(), modelUsed: 'none', durationMs, tokensUsed: 0, costUsd: 0,
      };
    }

    const companyName = company.normalizedName || company.rawName;

    // Step 2: Collect evidence + detect signals in parallel
    const [chain, triggerSignals] = await Promise.all([
      GroundingEngine.collect({ companyId, contactId, opportunityId }),
      detectTriggerSignals(companyId),
    ]);

    // Step 3: Get contact counts
    const contactCount = await db.contact.count({ where: { companyId } }).catch(() => 0);
    const repliedCount = await db.contact.count({ where: { companyId, status: 'replied' } }).catch(() => 0);

    // Step 4: Get current score (try cached, don't block)
    let currentScore: number | null = null;
    try {
      const scoreResult = await ScoringEngine.score({ companyId, skipNarrative: true });
      if (scoreResult.success) currentScore = scoreResult.score;
    } catch {
      // Score unavailable — continue with actions
    }

    // Step 5: Generate deterministic actions
    const actions = generateDeterministicActions(
      companyName, triggerSignals, chain,
      contactCount, repliedCount, currentScore,
    );

    // Step 6: Detect sales motion
    const detectedSalesMotion = detectSalesMotion(triggerSignals, currentScore, contactCount, repliedCount);

    // Step 7: Separate risk actions
    const riskActions = actions.filter(a => a.type === 'risk_mitigation');
    const primaryAction = actions.length > 0 ? actions[0] : null;

    // Step 8: Generate LLM strategy narrative
    let strategyNarrative: string | null = null;
    let modelUsed = 'deterministic_v1';
    let tokensUsed = 0;
    let costUsd = 0;

    if (!skipNarrative && actions.length >= 2) {
      const narrResult = await generateStrategyNarrative(
        companyName, actions, chain, currentScore, detectedSalesMotion
      );
      strategyNarrative = narrResult.narrative;
      if (narrResult.modelUsed !== 'none') {
        modelUsed = narrResult.modelUsed;
        tokensUsed = narrResult.tokensUsed;
        costUsd = narrResult.costUsd;
      }
    }

    const durationMs = Date.now() - startedAt;
    const avgConfidence = actions.length > 0
      ? Math.round(actions.reduce((s, a) => s + a.confidence, 0) / actions.length)
      : 0;

    logger.info(
      `[action-engine] recommendations complete: ${companyName}, ` +
        `${actions.length} actions, motion=${detectedSalesMotion}, ` +
        `primary="${primaryAction?.title ?? 'none'}", duration=${durationMs}ms`,
    );

    // Step 9: Audit
    await logEngineRun({
      companyId,
      compositionId,
      inputSummary: JSON.stringify({ companyId, companyName, signalCount: triggerSignals.length }),
      outputSummary: JSON.stringify({ actionCount: actions.length, salesMotion: detectedSalesMotion, primaryAction: primaryAction?.title }),
      confidence: avgConfidence / 100,
      durationMs,
      success: true,
      llmCallCount: strategyNarrative ? 2 : (currentScore !== null ? 1 : 0), // scoring + narrative
      llmTokensUsed: tokensUsed,
      llmCostUsd: costUsd,
    });

    return {
      success: true,
      error: null,
      companyId,
      companyName,
      contactId: contactId ?? null,
      contactName: null, // Would need additional lookup
      opportunityId: opportunityId ?? null,
      primaryAction,
      actions,
      detectedSalesMotion,
      accountStrategy: strategyNarrative,
      riskActions,
      currentScore,
      evidenceChain: chain,
      triggerSignals: triggerSignals.map(s => s.title),
      strategyNarrative,
      generatedAt: new Date().toISOString(),
      modelUsed,
      durationMs,
      tokensUsed,
      costUsd,
    };
  },
};
