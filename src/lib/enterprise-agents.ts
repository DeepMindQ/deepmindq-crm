/**
 * M5 Phase 4 — Enterprise Agent Experiences
 *
 * Five composition-layer agents that orchestrate existing intelligence engines
 * into unified, enterprise-ready experiences. Each agent:
 *
 *   1. Takes structured input
 *   2. Calls existing services/engines (via imports — NO new intelligence logic)
 *   3. Composes results into a structured response
 *   4. Attaches TRUST metadata via aggregateTrust()
 *   5. Returns a typed AgentResponse
 *
 * Agents:
 *   1. Account Intelligence   — Full company intelligence report
 *   2. Research               — Knowledge query with hallucination guard
 *   3. Sales Strategy          — Account scoring + buying intent + ICP
 *   4. Meeting Preparation     — Meeting brief + company context
 *   5. Executive Decision      — Knowledge + market context for decisions
 *
 * Design Principles:
 *   - NO new intelligence generation — pure composition
 *   - Every response includes TRUST, confidence, evidence, reasoning
 *   - Graceful degradation — partial results on engine failure
 *   - Typed inputs and outputs for every agent
 */

import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import {
  generateExecutiveBrief,
  type ExecutiveIntelligenceBrief,
} from '@/lib/executive-intelligence-brief';
import {
  discoverMarket,
  type MarketDiscoveryResponse,
} from '@/lib/market-discovery';
import {
  generateMeetingBrief,
  type MeetingBriefResponse,
  type MeetingBriefRequest,
} from '@/lib/meeting-intelligence-brief';
import {
  queryKnowledgeIntelligence,
  type KnowledgeIntelligenceOutput,
} from '@/lib/m5-wow4-knowledge-intelligence';
import {
  computeFinancialProfile,
  type CompanyFinancialProfile,
} from '@/lib/financial-intelligence-framework';
import {
  predictEngagement,
  type EngagementPrediction,
} from '@/lib/engagement-prediction-engine';
import {
  calculateAccountScore,
  type AccountScoreResult,
} from '@/lib/revenue-intelligence/account-scoring';
import {
  scoreBuyingIntent,
  type BuyingIntentScore,
} from '@/lib/scoring/buying-intent-engine';
import {
  getIcpProfile,
  industryMatch,
  regionMatch,
  sizeMatch,
  techMatch,
  type IcpProfile,
} from '@/lib/icp-config';
import {
  aggregateTrust,
  computeTrustScore,
  platformComputedTrust,
  type TrustMetadata,
} from '@/lib/intelligence-sources/trust-metadata';
import {
  guardAgainstHallucination,
  scoreAnswerSafety,
  type AnswerSafetyReport,
} from '@/lib/hallucination-prevention';
import { recordLineage } from '@/lib/data-lineage-service';

// ══════════════════════════════════════════════════════════════════
//  Common Types
// ══════════════════════════════════════════════════════════════════

/** Universal response envelope for all 5 enterprise agents. */
export interface AgentResponse {
  /** Unique ID for this agent invocation */
  agentId: string;
  /** Which agent produced this response */
  agentType: AgentType;
  /** Whether the agent succeeded (partial results still count as success) */
  success: boolean;
  /** Wall-clock duration in milliseconds */
  durationMs: number;
  /** Composite TRUST metadata across all composed engines */
  trust: TrustMetadata;
  /** Numeric TRUST score 0-100 */
  trustScore: number;
  /** Letter grade A+ through F */
  trustGrade: string;
  /** Agent-specific payload */
  data: Record<string, unknown>;
  /** Error message if the agent failed entirely */
  error?: string;
}

/** The five agent types */
export type AgentType =
  | 'account-intelligence'
  | 'research'
  | 'sales-strategy'
  | 'meeting-prep'
  | 'executive-decision';

// ══════════════════════════════════════════════════════════════════
//  Helper Utilities
// ══════════════════════════════════════════════════════════════════

function generateAgentId(agentType: string): string {
  return `agent_${agentType}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Build a successful AgentResponse envelope. */
function buildAgentResponse(
  agentType: AgentType,
  agentId: string,
  durationMs: number,
  trustItems: TrustMetadata[],
  data: Record<string, unknown>,
): AgentResponse {
  const trust = aggregateTrust(trustItems);
  const { score, grade } = computeTrustScore(trust);

  return {
    agentId,
    agentType,
    success: true,
    durationMs,
    trust,
    trustScore: score,
    trustGrade: grade,
    data,
  };
}

/** Build a failed AgentResponse envelope. */
function buildErrorResponse(
  agentType: AgentType,
  agentId: string,
  durationMs: number,
  error: string,
): AgentResponse {
  const trust = platformComputedTrust(
    agentType,
    `Agent execution failed: ${error}`,
    0,
    'low',
  );
  const { score, grade } = computeTrustScore(trust);

  return {
    agentId,
    agentType,
    success: false,
    durationMs,
    trust,
    trustScore: score,
    trustGrade: grade,
    data: {},
    error,
  };
}

/** Safely run an async engine call, returning [result, error, trustMetadata]. */
async function safeEngineCall<T>(
  engineName: string,
  fn: () => Promise<T>,
): Promise<{ result: T | null; error: string | null; trust: TrustMetadata }> {
  const startTime = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    return {
      result,
      error: null,
      trust: platformComputedTrust(
        engineName,
        `${engineName} completed in ${duration}ms`,
        1,
        'medium',
      ),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`[enterprise-agent] Engine ${engineName} failed`, { error: message });
    return {
      result: null,
      error: message,
      trust: platformComputedTrust(
        engineName,
        `${engineName} failed: ${message}`,
        0,
        'low',
      ),
    };
  }
}

// ══════════════════════════════════════════════════════════════════
//  Agent 1: Account Intelligence Agent
// ══════════════════════════════════════════════════════════════════

export interface AccountIntelligenceInput {
  companyId: string;
}

export interface AccountIntelligenceData {
  summary: string;
  financialProfile: CompanyFinancialProfile | null;
  marketPosition: {
    industry: string | null;
    sizeRange: string | null;
    location: string | null;
    signals: Array<{ title: string; type: string; severity: string; date: string }>;
  };
  keyContacts: Array<{
    name: string;
    title: string | null;
    leadScore: number;
    influenceLevel: string;
    engagementPrediction: EngagementPrediction | null;
  }>;
  recommendations: Array<{ action: string; priority: string; reasoning: string }>;
  executiveBrief: ExecutiveIntelligenceBrief | null;
}

/**
 * Agent 1: Account Intelligence Agent
 *
 * Composes: executive-intelligence-brief + financial-intelligence-framework
 *          + engagement-prediction-engine
 *
 * Produces a unified account intelligence report with TRUST metadata.
 */
export async function accountIntelligenceAgent(
  input: AccountIntelligenceInput,
): Promise<AgentResponse> {
  const agentId = generateAgentId('account-intelligence');
  const startTime = Date.now();
  const trustItems: TrustMetadata[] = [];

  logger.info('[enterprise-agent:account-intelligence] Invoked', { companyId: input.companyId, agentId });

  // ── Fetch company base data (needed for financial profile) ──
  const companyResult = await safeEngineCall('company_lookup', () =>
    db.company.findUnique({
      where: { id: input.companyId },
      include: {
        researchCard: true,
        _count: { select: { contacts: true } },
      },
    })
  );

  if (!companyResult.result) {
    return buildErrorResponse('account-intelligence', agentId, Date.now() - startTime,
      `Company not found: ${input.companyId}. ${companyResult.error || ''}`);
  }

  const company = companyResult.result;
  trustItems.push(companyResult.trust);

  // ── Engine 1: Executive Intelligence Brief ──
  const briefResult = await safeEngineCall('executive_intelligence_brief', () =>
    generateExecutiveBrief(input.companyId)
  );

  if (briefResult.result) {
    trustItems.push(platformComputedTrust('executive_brief', 'Executive brief composed successfully', 3, 'medium'));
  }

  // ── Engine 2: Financial Intelligence Framework ──
  let financialProfile: CompanyFinancialProfile | null = null;
  try {
    const rc = company.researchCard as any;
    financialProfile = computeFinancialProfile({
      companyId: company.id,
      companyName: company.rawName,
      clearbitRevenue: rc?.metrics?.annualRevenue ?? null,
      clearbitEmployees: rc?.metrics?.employees ?? null,
      clearbitFunding: rc?.metrics?.raised ?? null,
      clearbitMarketCap: rc?.metrics?.marketCap ?? null,
      customerRevenue: rc?.revenue ?? null,
      customerEmployees: rc?.employeeCount ?? null,
      customerFundingStage: rc?.fundingStage ?? null,
      aiEstimatedRevenue: rc?.revenue ?? null,
      aiEstimatedEmployees: rc?.employeeCount ?? null,
      aiEstimatedFundingStage: rc?.fundingStage ?? null,
    });
    trustItems.push(platformComputedTrust(
      'financial_profile',
      `Financial profile computed with ${financialProfile.knownDataCoverage}% known data coverage`,
      financialProfile.knownDataCoverage > 50 ? 4 : 1,
      financialProfile.knownDataCoverage > 50 ? 'medium' : 'low',
    ));
  } catch (err) {
    logger.warn('[enterprise-agent:account-intelligence] Financial profile failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // ── Engine 3: Engagement Prediction for top contacts ──
  const contacts = await db.contact.findMany({
    where: { companyId: input.companyId, status: { not: 'archived' } },
    select: { id: true, rawName: true, title: true, leadScore: true },
    orderBy: { leadScore: 'desc' },
    take: 5,
  });

  const keyContacts: AccountIntelligenceData['keyContacts'] = [];
  for (const contact of contacts) {
    const influenceLevel = contact.leadScore >= 80 ? 'Decision Maker'
      : contact.leadScore >= 60 ? 'Influencer'
      : contact.leadScore >= 40 ? 'Stakeholder'
      : 'Contributor';

    let engagementPrediction: EngagementPrediction | null = null;
    try {
      engagementPrediction = await predictEngagement(contact.id);
      trustItems.push(platformComputedTrust(
        'engagement_prediction',
        `Engagement predicted for ${contact.rawName}: ${engagementPrediction.responseProbability}%`,
        2,
        engagementPrediction.responseProbability >= 50 ? 'medium' : 'low',
      ));
    } catch {
      // Graceful degradation — continue without prediction
    }

    keyContacts.push({
      name: contact.rawName,
      title: contact.title,
      leadScore: contact.leadScore,
      influenceLevel,
      engagementPrediction,
    });
  }

  // ── Compose the response ──
  const brief = briefResult.result;
  const data: AccountIntelligenceData = {
    summary: brief?.executiveSummary || `${company.rawName} operates in the ${company.industry || 'technology'} sector.`,
    financialProfile,
    marketPosition: {
      industry: company.industry,
      sizeRange: company.sizeRange,
      location: company.location,
      signals: brief?.marketSignals?.signals?.slice(0, 8).map(s => ({
        title: s.title,
        type: s.type,
        severity: s.severity,
        date: s.date,
      })) || [],
    },
    keyContacts,
    recommendations: brief?.recommendedActions?.actions?.slice(0, 6).map(a => ({
      action: a.action,
      priority: a.priority,
      reasoning: a.reasoning,
    })) || [],
    executiveBrief: brief,
  };

  // ── Record lineage ──
  try {
    const trustScore = computeTrustScore(aggregateTrust(trustItems));
    await recordLineage({
      companyId: input.companyId,
      field: 'account_intelligence_agent',
      event: 'computed',
      source: 'platform_computed',
      provider: 'enterprise_agent_account_intelligence',
      newValue: trustScore.score,
      description: `Account intelligence agent composed brief + financial + engagement for ${company.rawName} (trust: ${trustScore.score}/100)`,
      triggeredBy: 'enterprise_agent:account-intelligence',
    });
  } catch { /* non-blocking */ }

  return buildAgentResponse('account-intelligence', agentId, Date.now() - startTime, trustItems, data as unknown as Record<string, unknown>);
}

// ══════════════════════════════════════════════════════════════════
//  Agent 2: Research Agent
// ══════════════════════════════════════════════════════════════════

export interface ResearchAgentInput {
  query: string;
  maxResults?: number;
}

export interface ResearchAgentData {
  researchFindings: string;
  sources: Array<{ name: string; tier: string; evidenceCount: number; mostRecentDate: string | null }>;
  knowledgeGraphEntities: Array<{ id: string; label: string; type: string }>;
  hallucinationRisk: 'negligible' | 'low' | 'medium' | 'high';
  safetyReport: AnswerSafetyReport | null;
  evidenceCount: number;
  confidence: number;
  confidenceGrade: string;
}

/**
 * Agent 2: Research Agent
 *
 * Composes: m5-wow4-knowledge-intelligence + hallucination-prevention
 *
 * Provides research briefings with hallucination guard applied.
 */
export async function researchAgent(
  input: ResearchAgentInput,
): Promise<AgentResponse> {
  const agentId = generateAgentId('research');
  const startTime = Date.now();
  const trustItems: TrustMetadata[] = [];

  logger.info('[enterprise-agent:research] Invoked', {
    query: input.query.slice(0, 100),
    maxResults: input.maxResults,
    agentId,
  });

  // ── Engine 1: Knowledge Intelligence Query ──
  const knowledgeResult = await safeEngineCall('knowledge_intelligence', async () => {
    return await queryKnowledgeIntelligence({
      query: input.query,
      maxResults: input.maxResults || 10,
    });
  });

  if (!knowledgeResult.result) {
    return buildErrorResponse('research', agentId, Date.now() - startTime,
      `Knowledge intelligence query failed: ${knowledgeResult.error || 'Unknown error'}`);
  }

  const knowledge = knowledgeResult.result;
  trustItems.push(knowledge.trust);

  // ── Engine 2: Hallucination Prevention (already applied inside knowledge engine,
  //     but we re-score the final output for additional safety) ──
  const safetyReport = scoreAnswerSafety({
    knowledgeFound: knowledge.answer.knowledgeFound,
    evidence: knowledge.answer.evidence,
    confidence: { score: knowledge.answer.confidence.score },
    answer: knowledge.answer.answer,
  });

  trustItems.push(platformComputedTrust(
    'hallucination_guard',
    `Safety score: ${safetyReport.safetyScore}/100, risk level: ${safetyReport.riskLevel}, ` +
    `verified: ${safetyReport.verifiedClaims}, unsupported: ${safetyReport.unsupportedClaims}`,
    safetyReport.verifiedClaims,
    safetyReport.riskLevel === 'safe' ? 'high' : safetyReport.riskLevel === 'caution' ? 'medium' : 'low',
  ));

  // ── Compose the response ──
  const data: ResearchAgentData = {
    researchFindings: knowledge.answer.answer,
    sources: knowledge.answer.sources.map(s => ({
      name: s.name,
      tier: s.tier,
      evidenceCount: s.evidenceCount,
      mostRecentDate: s.mostRecentDate,
    })),
    knowledgeGraphEntities: knowledge.answer.graphEntities,
    hallucinationRisk: knowledge.answer.hallucinationRisk,
    safetyReport,
    evidenceCount: knowledge.answer.evidence.length,
    confidence: knowledge.answer.confidence.score,
    confidenceGrade: knowledge.answer.confidence.grade,
  };

  return buildAgentResponse('research', agentId, Date.now() - startTime, trustItems, data as unknown as Record<string, unknown>);
}

// ══════════════════════════════════════════════════════════════════
//  Agent 3: Sales Strategy Agent
// ══════════════════════════════════════════════════════════════════

export interface SalesStrategyInput {
  companyId: string;
}

export interface SalesStrategyData {
  accountScore: AccountScoreResult | null;
  buyingIntent: BuyingIntentScore | null;
  icpAlignment: {
    matchesIcp: boolean;
    industryMatch: boolean;
    regionMatch: boolean;
    sizeMatch: boolean;
    techFit: number;
    icpDetails: { targetIndustries: string[]; targetRegions: string[] };
  };
  strategy: string;
  recommendedActions: string[];
  companyContext: {
    companyName: string;
    industry: string | null;
    executiveSummary: string;
  } | null;
}

/**
 * Agent 3: Sales Strategy Agent
 *
 * Composes: account-scoring + buying-intent-engine + icp-config + executive-brief
 *
 * Produces a comprehensive sales strategy recommendation.
 */
export async function salesStrategyAgent(
  input: SalesStrategyInput,
): Promise<AgentResponse> {
  const agentId = generateAgentId('sales-strategy');
  const startTime = Date.now();
  const trustItems: TrustMetadata[] = [];

  logger.info('[enterprise-agent:sales-strategy] Invoked', { companyId: input.companyId, agentId });

  // ── Fetch company base data ──
  const companyResult = await safeEngineCall('company_lookup', () =>
    db.company.findUnique({
      where: { id: input.companyId },
      select: {
        id: true, rawName: true, industry: true, country: true,
        location: true, sizeRange: true, domain: true,
        researchCard: { select: { techStack: true } },
      },
    })
  );

  if (!companyResult.result) {
    return buildErrorResponse('sales-strategy', agentId, Date.now() - startTime,
      `Company not found: ${input.companyId}. ${companyResult.error || ''}`);
  }

  const company = companyResult.result;
  trustItems.push(companyResult.trust);

  // ── Engine 1: Account Scoring ──
  const accountScoreResult = await safeEngineCall('account_scoring', () =>
    calculateAccountScore(input.companyId)
  );

  let accountScore: AccountScoreResult | null = null;
  if (accountScoreResult.result) {
    accountScore = accountScoreResult.result;
    trustItems.push(platformComputedTrust(
      'account_score',
      `Account score: ${accountScore.score}/100 (${accountScore.category})`,
      3,
      accountScore.score >= 60 ? 'medium' : 'low',
    ));
  }

  // ── Engine 2: Buying Intent ──
  const buyingIntentResult = await safeEngineCall('buying_intent', () =>
    scoreBuyingIntent(input.companyId)
  );

  let buyingIntent: BuyingIntentScore | null = null;
  if (buyingIntentResult.result) {
    buyingIntent = buyingIntentResult.result;
    trustItems.push(platformComputedTrust(
      'buying_intent',
      `Buying intent: ${buyingIntent.overallIntentScore}/100 (${buyingIntent.intentStrength}), ` +
      `${buyingIntent.topSignals.length} signals, window: ${buyingIntent.timingWindow}`,
      buyingIntent.topSignals.length,
      buyingIntent.overallIntentScore >= 50 ? 'medium' : 'low',
    ));
  }

  // ── Engine 3: ICP Alignment ──
  const icpResult = await safeEngineCall('icp_config', () => getIcpProfile());

  let icpAlignment: SalesStrategyData['icpAlignment'] = {
    matchesIcp: false,
    industryMatch: false,
    regionMatch: false,
    sizeMatch: false,
    techFit: 0,
    icpDetails: { targetIndustries: [], targetRegions: [] },
  };

  if (icpResult.result) {
    const icp = icpResult.result;
    const indMatch = industryMatch(company.industry, icp);
    const regMatch = regionMatch(company.country, company.location, icp);
    const szMatch = sizeMatch(company.sizeRange, icp);
    const tFit = techMatch(
      (company.researchCard as any)?.techStack || null,
      icp,
    );

    icpAlignment = {
      matchesIcp: indMatch || regMatch || szMatch || tFit > 0.3,
      industryMatch: indMatch,
      regionMatch: regMatch,
      sizeMatch: szMatch,
      techFit: tFit,
      icpDetails: {
        targetIndustries: icp.targetIndustries,
        targetRegions: icp.targetRegions,
      },
    };

    trustItems.push(platformComputedTrust(
      'icp_alignment',
      `ICP alignment: industry=${indMatch}, region=${regMatch}, size=${szMatch}, tech=${tFit.toFixed(2)}`,
      2,
      icpAlignment.matchesIcp ? 'medium' : 'low',
    ));
  }

  // ── Engine 4: Executive Brief (for company context) ──
  const briefResult = await safeEngineCall('executive_intelligence_brief', () =>
    generateExecutiveBrief(input.companyId)
  );

  let companyContext: SalesStrategyData['companyContext'] = null;
  if (briefResult.result) {
    companyContext = {
      companyName: briefResult.result.meta.companyName,
      industry: briefResult.result.meta.industry,
      executiveSummary: briefResult.result.executiveSummary,
    };
    trustItems.push(platformComputedTrust(
      'executive_context',
      'Executive brief used for company context in sales strategy',
      3,
      'medium',
    ));
  }

  // ── Compose strategy narrative ──
  const parts: string[] = [];
  const actions: string[] = [];

  // Account score contribution
  if (accountScore) {
    if (accountScore.category === 'HOT_ACCOUNT') {
      parts.push(`${company.rawName} is a HOT account (score: ${accountScore.score}/100) with strong signal strength (${accountScore.breakdown.signalStrength}/100).`);
      actions.push('Prioritize immediate outreach — account shows hot signals across multiple dimensions.');
    } else if (accountScore.category === 'WARM_ACCOUNT') {
      parts.push(`${company.rawName} is a WARM account (score: ${accountScore.score}/100).`);
      actions.push('Continue nurturing with targeted content and multi-touch engagement.');
    } else {
      parts.push(`${company.rawName} scores ${accountScore.score}/100 (category: ${accountScore.category}).`);
      actions.push('Focus on enriching intelligence data to improve account scoring.');
    }
  }

  // Buying intent contribution
  if (buyingIntent) {
    parts.push(`Buying intent is ${buyingIntent.intentStrength.replace(/_/g, ' ')} (${buyingIntent.overallIntentScore}/100) with a ${buyingIntent.timingWindow.toLowerCase()} window.`);
    actions.push(buyingIntent.recommendedApproach);
  }

  // ICP contribution
  if (icpAlignment.matchesIcp) {
    const matches: string[] = [];
    if (icpAlignment.industryMatch) matches.push('industry');
    if (icpAlignment.regionMatch) matches.push('region');
    if (icpAlignment.sizeMatch) matches.push('size');
    if (icpAlignment.techFit > 0.3) matches.push('technology');
    parts.push(`ICP alignment confirmed on ${matches.join(', ')} dimensions.`);
    actions.push('Leverage ICP alignment in messaging — emphasize fit with their profile.');
  } else {
    parts.push('This account does not strongly match the current ICP. Consider whether the ICP needs updating or if this is an expansion opportunity.');
    actions.push('Review ICP criteria — this account may represent an untapped market segment.');
  }

  const data: SalesStrategyData = {
    accountScore,
    buyingIntent,
    icpAlignment,
    strategy: parts.join(' '),
    recommendedActions: actions,
    companyContext,
  };

  // ── Record lineage ──
  try {
    const trustScore = computeTrustScore(aggregateTrust(trustItems));
    await recordLineage({
      companyId: input.companyId,
      field: 'sales_strategy_agent',
      event: 'computed',
      source: 'platform_computed',
      provider: 'enterprise_agent_sales_strategy',
      newValue: trustScore.score,
      description: `Sales strategy agent composed account(${accountScore?.score}) + intent(${buyingIntent?.overallIntentScore}) + ICP(${icpAlignment.matchesIcp}) for ${company.rawName}`,
      triggeredBy: 'enterprise-agent:sales-strategy',
    });
  } catch { /* non-blocking */ }

  return buildAgentResponse('sales-strategy', agentId, Date.now() - startTime, trustItems, data as unknown as Record<string, unknown>);
}

// ══════════════════════════════════════════════════════════════════
//  Agent 4: Meeting Preparation Agent
// ══════════════════════════════════════════════════════════════════

export interface MeetingPrepInput {
  companyId: string;
  contactId?: string;
  meetingType?: string;
}

export interface MeetingPrepData {
  brief: MeetingBriefResponse['brief'] | null;
  companyContext: {
    companyName: string;
    industry: string | null;
    sizeRange: string | null;
    location: string | null;
    domain: string | null;
    executiveSummary: string;
    opportunityScore: number;
    priorityTier: string;
  };
  buyingCommittee: Array<{
    name: string;
    title: string | null;
    influenceLevel: string;
    leadScore: number;
    buyingRole: string | null;
  }>;
  talkingPoints: string[];
}

/**
 * Agent 4: Meeting Preparation Agent
 *
 * Composes: meeting-intelligence-brief + executive-intelligence-brief
 *
 * Produces a comprehensive meeting preparation package.
 */
export async function meetingPrepAgent(
  input: MeetingPrepInput,
): Promise<AgentResponse> {
  const agentId = generateAgentId('meeting-prep');
  const startTime = Date.now();
  const trustItems: TrustMetadata[] = [];

  logger.info('[enterprise-agent:meeting-prep] Invoked', {
    companyId: input.companyId,
    contactId: input.contactId,
    meetingType: input.meetingType,
    agentId,
  });

  // ── Engine 1: Meeting Intelligence Brief ──
  const meetingRequest: MeetingBriefRequest = {
    companyId: input.companyId,
    contactId: input.contactId,
    meetingType: (input.meetingType as any) || undefined,
    briefingType: 'meeting_prep',
  };

  const meetingResult = await safeEngineCall('meeting_intelligence_brief', () =>
    generateMeetingBrief(meetingRequest)
  );

  let meetingBrief = meetingResult.result?.brief || null;
  trustItems.push(meetingResult.trust);

  // ── Engine 2: Executive Intelligence Brief (for broader company context) ──
  const briefResult = await safeEngineCall('executive_intelligence_brief', () =>
    generateExecutiveBrief(input.companyId)
  );

  let companyContext: MeetingPrepData['companyContext'] = {
    companyName: 'Unknown',
    industry: null,
    sizeRange: null,
    location: null,
    domain: null,
    executiveSummary: 'No executive brief available.',
    opportunityScore: 0,
    priorityTier: 'low',
  };

  if (briefResult.result) {
    const brief = briefResult.result;
    companyContext = {
      companyName: brief.meta.companyName,
      industry: brief.meta.industry,
      sizeRange: brief.companyOverview.sizeRange,
      location: brief.companyOverview.location,
      domain: brief.companyOverview.website,
      executiveSummary: brief.executiveSummary,
      opportunityScore: brief.opportunityIndicators.opportunityScore,
      priorityTier: brief.opportunityIndicators.priorityTier,
    };
    trustItems.push(platformComputedTrust(
      'executive_context',
      'Executive brief composed for meeting preparation context',
      4,
      'medium',
    ));
  }

  // ── Extract buying committee from executive brief ──
  const buyingCommittee: MeetingPrepData['buyingCommittee'] = [];
  if (briefResult.result) {
    for (const contact of briefResult.result.contactIntelligence.keyContacts) {
      buyingCommittee.push({
        name: contact.name,
        title: contact.title,
        influenceLevel: contact.influenceLevel,
        leadScore: contact.leadScore,
        buyingRole: contact.buyingRole,
      });
    }
  }

  // ── Generate talking points from available intelligence ──
  const talkingPoints: string[] = [];

  if (briefResult.result) {
    // From executive summary
    if (briefResult.result.executiveSummary) {
      talkingPoints.push(`Company Overview: ${briefResult.result.executiveSummary.slice(0, 200)}${briefResult.result.executiveSummary.length > 200 ? '...' : ''}`);
    }

    // From market signals
    const criticalSignals = briefResult.result.marketSignals.signals
      .filter(s => s.severity === 'critical' || s.severity === 'high')
      .slice(0, 3);
    for (const signal of criticalSignals) {
      talkingPoints.push(`Market Signal: ${signal.title} (${signal.severity} severity, ${signal.confidence}% confidence)`);
    }

    // From recommended actions
    const topActions = briefResult.result.recommendedActions.actions.slice(0, 3);
    for (const action of topActions) {
      talkingPoints.push(`Recommended Action: ${action.action} — ${action.reasoning}`);
    }

    // From strategic priorities
    if (briefResult.result.companyOverview.strategicPriorities.length > 0) {
      talkingPoints.push(`Strategic Priorities: ${briefResult.result.companyOverview.strategicPriorities.join(', ')}`);
    }
  }

  // If meeting brief has conversation result, extract talking points from it
  if (meetingBrief?.conversationResult) {
    const cr = meetingBrief.conversationResult as unknown as Record<string, unknown>;
    const keyPoints = Array.isArray(cr.keyPoints) ? cr.keyPoints : [];
    for (const point of keyPoints.slice(0, 3)) {
      if (typeof point === 'string' && !talkingPoints.includes(point)) {
        talkingPoints.push(`Meeting Insight: ${point}`);
      }
    }
  }

  const data: MeetingPrepData = {
    brief: meetingBrief,
    companyContext,
    buyingCommittee,
    talkingPoints,
  };

  // ── Record lineage ──
  try {
    const trustScore = computeTrustScore(aggregateTrust(trustItems));
    await recordLineage({
      companyId: input.companyId,
      field: 'meeting_prep_agent',
      event: 'computed',
      source: 'platform_computed',
      provider: 'enterprise_agent_meeting_prep',
      newValue: trustScore.score,
      description: `Meeting prep agent composed meeting brief + executive brief for ${companyContext.companyName}`,
      triggeredBy: 'enterprise-agent:meeting-prep',
    });
  } catch { /* non-blocking */ }

  return buildAgentResponse('meeting-prep', agentId, Date.now() - startTime, trustItems, data as unknown as Record<string, unknown>);
}

// ══════════════════════════════════════════════════════════════════
//  Agent 5: Executive Decision Agent
// ══════════════════════════════════════════════════════════════════

export interface ExecutiveDecisionInput {
  question: string;
  context?: {
    companyId?: string;
    industry?: string;
  };
}

export interface ExecutiveDecisionData {
  answer: string;
  reasoning: string;
  evidence: Array<{
    claim: string;
    snippet: string;
    source: string | null;
    relevanceScore: number;
  }>;
  trust: {
    trustScore: number;
    trustGrade: string;
    hallucinationRisk: 'negligible' | 'low' | 'medium' | 'high';
    safetyScore: number;
    riskLevel: string;
  };
  confidence: number;
  confidenceGrade: string;
  recommendations: string[];
  marketContext: Array<{
    companyName: string;
    industry: string | null;
    matchScore: number;
    buyingIntentScore: number;
  }>;
}

/**
 * Agent 5: Executive Decision Agent
 *
 * Composes: knowledge-intelligence + market-discovery + hallucination-prevention
 *
 * Produces executive decision support briefs with full evidence chain.
 */
export async function executiveDecisionAgent(
  input: ExecutiveDecisionInput,
): Promise<AgentResponse> {
  const agentId = generateAgentId('executive-decision');
  const startTime = Date.now();
  const trustItems: TrustMetadata[] = [];

  logger.info('[enterprise-agent:executive-decision] Invoked', {
    question: input.question.slice(0, 100),
    context: input.context,
    agentId,
  });

  // ── Engine 1: Knowledge Intelligence Query (factual foundation) ──
  const knowledgeResult = await safeEngineCall('knowledge_intelligence', async () => {
    return await queryKnowledgeIntelligence({
      query: input.question,
      companyId: input.context?.companyId,
      maxResults: 15,
    });
  });

  if (!knowledgeResult.result) {
    return buildErrorResponse('executive-decision', agentId, Date.now() - startTime,
      `Knowledge intelligence query failed: ${knowledgeResult.error || 'Unknown error'}`);
  }

  const knowledge = knowledgeResult.result;
  trustItems.push(knowledge.trust);

  // ── Engine 2: Market Discovery (if question seems market-related) ──
  const marketKeywords = ['market', 'landscape', 'competitor', 'companies', 'vendors', 'players', 'industry'];
  const questionLower = input.question.toLowerCase();
  const isMarketRelevant = marketKeywords.some(kw => questionLower.includes(kw));

  let marketContext: ExecutiveDecisionData['marketContext'] = [];
  if (isMarketRelevant) {
    const marketResult = await safeEngineCall('market_discovery', () =>
      discoverMarket(input.question, 5)
    );

    if (marketResult.result) {
      marketContext = marketResult.result.results.map(r => ({
        companyName: r.companyName,
        industry: r.industry,
        matchScore: r.matchScore,
        buyingIntentScore: r.buyingIntentScore,
      }));
      trustItems.push(marketResult.result.trust);
    }
  }

  // ── Engine 3: Hallucination Prevention (already applied, but re-verify for decision support) ──
  const safetyReport = scoreAnswerSafety({
    knowledgeFound: knowledge.answer.knowledgeFound,
    evidence: knowledge.answer.evidence,
    confidence: { score: knowledge.answer.confidence.score },
    answer: knowledge.answer.answer,
  });

  trustItems.push(platformComputedTrust(
    'hallucination_guard_executive',
    `Executive decision safety: score ${safetyReport.safetyScore}/100, risk ${safetyReport.riskLevel}`,
    safetyReport.verifiedClaims,
    safetyReport.riskLevel === 'safe' ? 'high' : safetyReport.riskLevel === 'caution' ? 'medium' : 'low',
  ));

  // ── Compose recommendations from safety report + market context ──
  const recommendations: string[] = [];

  // Safety-based recommendations
  if (safetyReport.riskLevel === 'danger') {
    recommendations.push('⚠️ INSUFFICIENT DATA: This question cannot be reliably answered from available knowledge. Do not base decisions on this output.');
  } else if (safetyReport.riskLevel === 'warning') {
    recommendations.push('⚠️ LOW CONFIDENCE: Verify all claims independently before making decisions.');
  }
  if (safetyReport.unsupportedClaims > 0) {
    recommendations.push(`${safetyReport.unsupportedClaims} claim(s) lack supporting evidence — seek independent corroboration.`);
  }
  if (safetyReport.contradictedClaims > 0) {
    recommendations.push(`${safetyReport.contradictedClaims} claim(s) contradicted by evidence — investigate discrepancies.`);
  }

  // Market-based recommendations
  if (marketContext.length > 0) {
    const topCompanies = marketContext.slice(0, 3);
    recommendations.push(`Consider ${topCompanies.map(c => c.companyName).join(', ')} as relevant market comparables.`);
  }

  // Confidence-based recommendations
  if (knowledge.answer.confidence.score >= 70) {
    recommendations.push('High-confidence intelligence — suitable for strategic planning.');
  } else if (knowledge.answer.confidence.score >= 40) {
    recommendations.push('Moderate confidence — use as one input among multiple data sources.');
  }

  if (recommendations.length === 0) {
    recommendations.push('Answer passes safety checks. Use alongside other intelligence sources for comprehensive decision-making.');
  }

  // ── Build the composed answer ──
  const answerParts: string[] = [];
  answerParts.push(knowledge.answer.answer);
  if (marketContext.length > 0) {
    answerParts.push(`\n\nMarket Context: ${marketContext.length} relevant companies identified. Top match: ${marketContext[0]!.companyName} (${marketContext[0]!.matchScore}/100 match score).`);
  }

  const trustScoreResult = computeTrustScore(aggregateTrust(trustItems));

  const data: ExecutiveDecisionData = {
    answer: answerParts.join(''),
    reasoning: knowledge.answer.reasoning,
    evidence: knowledge.answer.evidence.map(e => ({
      claim: e.claim,
      snippet: e.snippet,
      source: e.source,
      relevanceScore: e.relevanceScore,
    })),
    trust: {
      trustScore: trustScoreResult.score,
      trustGrade: trustScoreResult.grade,
      hallucinationRisk: knowledge.answer.hallucinationRisk,
      safetyScore: safetyReport.safetyScore,
      riskLevel: safetyReport.riskLevel,
    },
    confidence: knowledge.answer.confidence.score,
    confidenceGrade: knowledge.answer.confidence.grade,
    recommendations,
    marketContext,
  };

  // ── Record lineage if companyId present ──
  if (input.context?.companyId) {
    try {
      await recordLineage({
        companyId: input.context.companyId,
        field: 'executive_decision_agent',
        event: 'computed',
        source: 'platform_computed',
        provider: 'enterprise_agent_executive_decision',
        newValue: trustScoreResult.score,
        description: `Executive decision agent answered: "${input.question.slice(0, 80)}" (trust: ${trustScoreResult.score}/100)`,
        triggeredBy: 'enterprise-agent:executive-decision',
      });
    } catch { /* non-blocking */ }
  }

  return buildAgentResponse('executive-decision', agentId, Date.now() - startTime, trustItems, data as unknown as Record<string, unknown>);
}

// ══════════════════════════════════════════════════════════════════
//  Agent Router (used by API route)
// ══════════════════════════════════════════════════════════════════

/** Map of agent type string → handler function */
export const AGENT_REGISTRY: Record<AgentType, (params: Record<string, unknown>) => Promise<AgentResponse>> = {
  'account-intelligence': (params) => accountIntelligenceAgent({
    companyId: params.companyId as string,
  }),
  'research': (params) => researchAgent({
    query: params.query as string,
    maxResults: params.maxResults as number | undefined,
  }),
  'sales-strategy': (params) => salesStrategyAgent({
    companyId: params.companyId as string,
  }),
  'meeting-prep': (params) => meetingPrepAgent({
    companyId: params.companyId as string,
    contactId: params.contactId as string | undefined,
    meetingType: params.meetingType as string | undefined,
  }),
  'executive-decision': (params) => executiveDecisionAgent({
    question: params.question as string,
    context: params.context as ExecutiveDecisionInput['context'] | undefined,
  }),
};

/** All valid agent type strings. */
export const VALID_AGENT_TYPES: AgentType[] = [
  'account-intelligence',
  'research',
  'sales-strategy',
  'meeting-prep',
  'executive-decision',
];
