/**
 * Opportunity Recommendation Engine (Phase 4 — Track C1)
 *
 * Transforms intelligence into structured opportunity recommendations:
 *   Signal + Evidence + Capability Match + Freshness + Confidence → OpportunityRecommendation
 *
 * The opportunity score is a composite:
 *   - Signal Confidence: 30%
 *   - Capability Match Score: 25%
 *   - Freshness Score: 20%
 *   - Evidence Quality: 15%
 *   - Signal Impact: 10%
 *
 * Uses governedAICallAggregate for LLM calls (never calls callLLM directly).
 */

import { db } from '@/lib/db';
import { governedAICallAggregate } from '@/lib/ai-governance';
import { computeEvidenceQuality } from './evidence-quality';

// ── Types ──

export interface OpportunityRecommendationResult {
  id: string;
  companyId: string;
  signalId: string;
  capabilityMatchId: string;
  opportunityTitle: string;
  businessTrigger: string;
  whyNow: string;
  businessProblem: string;
  recommendedCapability: string;
  recommendedStakeholders: string[];
  suggestedConversation: string;
  evidenceIds: string[];
  confidenceScore: number;
  freshnessScore: number;
  matchScore: number;
  opportunityScore: number;
  priority: string;
  status: string;
  createdAt: Date;
}

interface LLMOpportunityOutput {
  opportunityTitle: string;
  businessTrigger: string;
  whyNow: string;
  businessProblem: string;
  suggestedConversation: string;
  recommendedStakeholders: string[];
}

// ── System Prompt ──

const OPPORTUNITY_SYSTEM_PROMPT = `You are a senior B2B revenue intelligence analyst at a leading technology consultancy. Your task is to create a strategic opportunity assessment based on buying signals, capability matches, and company intelligence.

## Your Output

You MUST return valid JSON with exactly these 6 fields:

1. **opportunityTitle** (string): A concise, compelling title for this opportunity (e.g., "Cloud Migration Strategy — Acme Corp Post-Funding Expansion")
2. **businessTrigger** (string): The specific business event that created this opportunity (e.g., "Series C funding of $50M earmarked for cloud infrastructure modernization")
3. **whyNow** (string): A strategic argument for why this company should be pursued NOW (urgency, timing window, competitive dynamics)
4. **businessProblem** (string): The core business problem this company faces that we can solve
5. **suggestedConversation** (string): 2-3 strategic conversation topics to initiate, formatted as bullet points
6. **recommendedStakeholders** (string[]): Array of 2-5 stakeholder titles/roles to target (e.g., ["CTO", "VP Engineering", "Head of Cloud Architecture"])

## Guidelines

- Be specific and data-driven. Reference the signal, company context, and capability match details provided.
- The businessTrigger should be a single, clear event — not a generic observation.
- whyNow should convey genuine urgency with supporting reasoning.
- The businessProblem should connect the signal to a solvable challenge our capability addresses.
- Suggested conversation topics should be strategic, not generic ("tell me about your challenges").
- Stakeholders should be role titles, not names (we don't have individual names here).
- Return ONLY valid JSON. No markdown fences, no commentary.`;

// ── Impact Weight Map ──

const IMPACT_SCORES: Record<string, number> = {
  high: 100,
  medium: 60,
  low: 30,
};

// ── Score Computation ──

/**
 * Pure function — no DB access.
 * Computes a 0-100 composite opportunity score.
 *
 * Weights:
 *   - Signal Confidence (0-1): 30% → normalized to 0-100
 *   - Capability Match Score (0-1): 25% → normalized to 0-100
 *   - Freshness Score (0-100): 20%
 *   - Evidence Quality (0-100): 15%
 *   - Signal Impact (high/medium/low): 10%
 */
export function computeOpportunityScore(params: {
  signalConfidence: number;
  matchScore: number;
  freshnessScore: number;
  evidenceQuality: number;
  signalImpact: string;
}): number {
  const { signalConfidence, matchScore, freshnessScore, evidenceQuality, signalImpact } = params;

  const impactScore = IMPACT_SCORES[signalImpact] ?? IMPACT_SCORES.medium;

  const composite =
    (signalConfidence * 100) * 0.30 +
    (matchScore * 100) * 0.25 +
    freshnessScore * 0.20 +
    evidenceQuality * 0.15 +
    impactScore * 0.10;

  return Math.round(Math.min(100, Math.max(0, composite)));
}

// ── Priority Classification ──

function classifyPriority(score: number): 'high' | 'medium' | 'low' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

// ── Freshness from Research Card ──

async function computeFreshnessFromResearchCard(companyId: string): Promise<number> {
  const card = await db.companyResearchCard.findUnique({
    where: { companyId },
    select: {
      signalFreshnessAt: true,
      techFreshnessAt: true,
      contactFreshnessAt: true,
      profileFreshnessAt: true,
    },
  });

  if (!card) return 0;

  const now = Date.now();
  const toDays = (dt: Date | null) => {
    if (!dt) return 999;
    return (now - dt.getTime()) / (1000 * 60 * 60 * 24);
  };

  const FRESHNESS_LIFECYCLE_DAYS = {
    profile: 90,
    signals: 14,
    technology: 60,
    contacts: 45,
  };

  const domains = [
    { days: toDays(card.profileFreshnessAt), max: FRESHNESS_LIFECYCLE_DAYS.profile },
    { days: toDays(card.signalFreshnessAt), max: FRESHNESS_LIFECYCLE_DAYS.signals },
    { days: toDays(card.techFreshnessAt), max: FRESHNESS_LIFECYCLE_DAYS.technology },
    { days: toDays(card.contactFreshnessAt), max: FRESHNESS_LIFECYCLE_DAYS.contacts },
  ];

  let total = 0;
  for (const d of domains) {
    if (d.days >= 999) {
      total += 0;
    } else if (d.days <= 0) {
      total += 100;
    } else {
      // Linear decay: 100 at day 0, 0 at day max
      total += Math.max(0, Math.round(100 * (1 - d.days / d.max)));
    }
  }

  return Math.round(total / domains.length);
}

// ── LLM Response Parsing ──

function parseLLMResponse(raw: string): LLMOpportunityOutput {
  let cleaned = raw.trim();
  // Strip markdown code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  const parsed = JSON.parse(cleaned);

  return {
    opportunityTitle: String(parsed.opportunityTitle || 'Untitled Opportunity'),
    businessTrigger: String(parsed.businessTrigger || ''),
    whyNow: String(parsed.whyNow || ''),
    businessProblem: String(parsed.businessProblem || ''),
    suggestedConversation: String(parsed.suggestedConversation || ''),
    recommendedStakeholders: Array.isArray(parsed.recommendedStakeholders)
      ? parsed.recommendedStakeholders.map(String)
      : [],
  };
}

// ── Generate Single Recommendation ──

export async function generateOpportunityRecommendation(
  params: { companyId: string; signalId: string; capabilityMatchId: string },
): Promise<OpportunityRecommendationResult> {
  const { companyId, signalId, capabilityMatchId } = params;

  // 1. Load signal
  const signal = await db.companySignal.findUnique({
    where: { id: signalId },
  });
  if (!signal) throw new Error(`Signal ${signalId} not found`);

  // 2. Load capability match
  const match = await db.signalCapabilityMatch.findUnique({
    where: { id: capabilityMatchId },
  });
  if (!match) throw new Error(`Capability match ${capabilityMatchId} not found`);

  // 3. Load capability asset
  const capability = await db.capabilityAsset.findUnique({
    where: { id: match.capabilityId },
  });

  // 4. Load company + research card
  const company = await db.company.findUnique({
    where: { id: companyId },
  });
  if (!company) throw new Error(`Company ${companyId} not found`);

  const researchCard = await db.companyResearchCard.findUnique({
    where: { companyId },
  });

  // 5. Load evidence for this company
  const evidenceRecords = await db.evidence.findMany({
    where: { companyId, status: { in: ['active', 'aging'] } },
    select: { id: true },
  });
  const evidenceIds = evidenceRecords.map(e => e.id);

  // 6. Compute scores
  const evidenceQuality = await computeEvidenceQuality(companyId);
  const freshnessScore = await computeFreshnessFromResearchCard(companyId);
  const opportunityScore = computeOpportunityScore({
    signalConfidence: signal.confidence,
    matchScore: match.matchScore,
    freshnessScore,
    evidenceQuality: evidenceQuality.overall,
    signalImpact: signal.impact,
  });
  const priority = classifyPriority(opportunityScore);

  // 7. Build user prompt for LLM
  let businessOverview = '';
  let techLandscape = '';
  let strategicPriorities: unknown[] = [];
  let businessProblemsList: unknown[] = [];

  if (researchCard) {
    businessOverview = researchCard.businessOverview || '';
    techLandscape = researchCard.techLandscape || '';
    try { strategicPriorities = JSON.parse(researchCard.strategicPriorities || '[]'); } catch { /* empty */ }
    try { businessProblemsList = JSON.parse(researchCard.businessProblems || '[]'); } catch { /* empty */ }
  }

  const userPrompt = `## Signal Information
- **Type**: ${signal.signalType}
- **Title**: ${signal.title}
- **Description**: ${signal.description || 'N/A'}
- **Impact**: ${signal.impact}
- **Confidence**: ${signal.confidence}
- **Signal Date**: ${signal.signalDate || 'N/A'}
- **Source**: ${signal.source || 'N/A'}
${signal.opportunityType ? `- **Opportunity Type**: ${signal.opportunityType}` : ''}
${signal.buyingArea ? `- **Buying Area**: ${signal.buyingArea}` : ''}
${signal.techRequirement ? `- **Tech Requirement**: ${signal.techRequirement}` : ''}

## Capability Match
- **Match Score**: ${match.matchScore}
- **Reason**: ${match.reason}
- **Business Problem**: ${match.businessProblem || 'N/A'}
- **Expected Outcome**: ${match.expectedOutcome || 'N/A'}
- **Sales Angle**: ${match.salesAngle || 'N/A'}
- **Capability Title**: ${capability?.title || 'Unknown'}
- **Capability Summary**: ${capability?.summary || 'N/A'}

## Company Intelligence
- **Name**: ${company.rawName || company.normalizedName}
- **Industry**: ${company.industry || 'N/A'}
- **Size Range**: ${company.sizeRange || 'N/A'}
- **Location**: ${company.location || 'N/A'}
- **Website**: ${company.website || 'N/A'}
- **Business Overview**: ${businessOverview || 'N/A'}
- **Technology Landscape**: ${techLandscape || 'N/A'}
- **Strategic Priorities**: ${JSON.stringify(strategicPriorities)}
- **Known Business Problems**: ${JSON.stringify(businessProblemsList)}

## Scores (pre-computed)
- Signal Confidence: ${(signal.confidence * 100).toFixed(0)}%
- Capability Match: ${(match.matchScore * 100).toFixed(0)}%
- Freshness: ${freshnessScore}/100
- Evidence Quality: ${evidenceQuality.overall}/100
- Evidence Count: ${evidenceRecords.length}

Generate the strategic opportunity assessment as JSON.`;

  // 8. Call LLM via governance layer
  const result = await governedAICallAggregate({
    generationType: 'opportunity_recommendation',
    systemPrompt: OPPORTUNITY_SYSTEM_PROMPT,
    userPrompt,
    inputParams: {
      companyId,
      signalId,
      capabilityMatchId,
      signalType: signal.signalType,
      capabilityTitle: capability?.title,
    },
  });

  if (!result.success || !result.response) {
    throw new Error(
      result.rejectionReason || 'Failed to generate opportunity recommendation via LLM',
    );
  }

  // 9. Parse LLM response
  const llmOutput = parseLLMResponse(result.response);

  // 10. Create the OpportunityRecommendation record
  const recommendation = await db.opportunityRecommendation.create({
    data: {
      companyId,
      signalId,
      capabilityMatchId,
      opportunityTitle: llmOutput.opportunityTitle,
      businessTrigger: llmOutput.businessTrigger,
      whyNow: llmOutput.whyNow,
      businessProblem: llmOutput.businessProblem,
      recommendedCapability: capability?.title || 'Unknown',
      recommendedStakeholders: JSON.stringify(llmOutput.recommendedStakeholders),
      suggestedConversation: llmOutput.suggestedConversation,
      evidenceIds: JSON.stringify(evidenceIds),
      confidenceScore: signal.confidence,
      freshnessScore,
      matchScore: match.matchScore,
      opportunityScore,
      priority,
      status: 'pending_review',
    },
  });

  return {
    id: recommendation.id,
    companyId: recommendation.companyId,
    signalId: recommendation.signalId,
    capabilityMatchId: recommendation.capabilityMatchId,
    opportunityTitle: recommendation.opportunityTitle,
    businessTrigger: recommendation.businessTrigger,
    whyNow: recommendation.whyNow,
    businessProblem: recommendation.businessProblem,
    recommendedCapability: recommendation.recommendedCapability,
    recommendedStakeholders: llmOutput.recommendedStakeholders,
    suggestedConversation: recommendation.suggestedConversation,
    evidenceIds,
    confidenceScore: recommendation.confidenceScore,
    freshnessScore: recommendation.freshnessScore,
    matchScore: recommendation.matchScore,
    opportunityScore: recommendation.opportunityScore,
    priority: recommendation.priority,
    status: recommendation.status,
    createdAt: recommendation.createdAt,
  };
}

// ── Generate All Opportunities for a Company ──

export async function generateCompanyOpportunities(
  companyId: string,
): Promise<{ created: number; results: OpportunityRecommendationResult[] }> {
  // Verify company exists
  const company = await db.company.findUnique({ where: { id: companyId } });
  if (!company) throw new Error(`Company ${companyId} not found`);

  // Find all active/validated signal IDs for this company
  const activeSignals = await db.companySignal.findMany({
    where: {
      companyId,
      status: { in: ['active', 'validated'] },
    },
    select: { id: true },
  });
  const activeSignalIds = new Set(activeSignals.map(s => s.id));

  // Find high-confidence capability matches for active signals
  const allMatches = await db.signalCapabilityMatch.findMany({
    where: {
      companyId,
      matchScore: { gte: 0.4 }, // Minimum 40% match score threshold
    },
    select: {
      id: true,
      signalId: true,
      matchScore: true,
    },
    orderBy: { matchScore: 'desc' },
  });

  // Filter to only matches for active/validated signals
  const matches = allMatches.filter(m => activeSignalIds.has(m.signalId));

  if (matches.length === 0) {
    return { created: 0, results: [] };
  }

  // Check for existing recommendations to avoid duplicates
  const existing = await db.opportunityRecommendation.findMany({
    where: {
      companyId,
      status: { in: ['pending_review', 'accepted', 'monitored'] },
    },
    select: {
      signalId: true,
      capabilityMatchId: true,
    },
  });

  const existingKeys = new Set(
    existing.map(e => `${e.signalId}::${e.capabilityMatchId}`),
  );

  const results: OpportunityRecommendationResult[] = [];

  for (const m of matches) {
    const key = `${m.signalId}::${m.id}`;
    if (existingKeys.has(key)) continue;

    try {
      const result = await generateOpportunityRecommendation({
        companyId,
        signalId: m.signalId,
        capabilityMatchId: m.id,
      });
      results.push(result);
    } catch (err) {
      console.error(
        `[opportunity-engine] Failed to generate recommendation for signal ${m.signalId}, match ${m.id}:`,
        err instanceof Error ? err.message : err,
      );
      // Continue with next match — don't fail the whole batch
    }
  }

  return { created: results.length, results };
}