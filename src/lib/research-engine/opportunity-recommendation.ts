/**
 * Opportunity Recommendation Engine (Phase 4 — Track C1)
 *
 * Transforms intelligence inputs into an OpportunityRecommendation record:
 *   CompanySignal + SignalCapabilityMatch + CapabilityAsset + Evidence Quality
 *   + Research Card Freshness → Composite Opportunity Score
 *
 * SCORING BREAKDOWN (explainable to sales users):
 *   - Signal Confidence:     25%  (signal.confidence, 0-1 → 0-100)
 *   - Capability Match:      25%  (match.matchScore, 0-1 → 0-100)
 *   - Freshness Score:       20%  (evidence + research freshness, 0-100)
 *   - Evidence Quality:      15%  (5-dimension quality score, 0-100)
 *   - Business Impact:       15%  (signal.impact mapped to 0-100)
 *
 * Composite Opportunity Score = weighted sum, 0-100.
 * Priority = high (≥70), medium (≥40), low (<40).
 *
 * Uses governedAICallAggregate for LLM calls (never calls callLLM directly).
 * Only creates OpportunityRecommendation records — NEVER creates Pursuit or
 * initiates communication autonomously.
 */

import { db } from '@/lib/db';
import { governedAICallAggregate } from '@/lib/ai-governance';
import { computeEvidenceQuality, type EvidenceQualityScore } from './evidence-quality';

// ── Types ──

export interface OpportunityScoreBreakdown {
  signalConfidence: number;   // 0-100
  capabilityMatch: number;    // 0-100
  freshnessScore: number;     // 0-100
  evidenceQuality: number;    // 0-100
  businessImpact: number;     // 0-100
  compositeScore: number;     // 0-100 weighted
  priority: 'high' | 'medium' | 'low';
}

export interface OpportunityRecommendationResult {
  opportunity: {
    id: string;
    opportunityTitle: string;
    businessTrigger: string;
    whyNow: string;
    businessProblem: string;
    recommendedCapability: string;
    recommendedStakeholders: string[];
    suggestedConversation: string;
    status: 'pending_review';
  };
  scoring: OpportunityScoreBreakdown;
  evidenceQuality: EvidenceQualityScore;
  signalInfo: {
    id: string;
    signalType: string;
    title: string;
    confidence: number;
    impact: string;
  };
  capabilityInfo: {
    id: string;
    title: string;
    category: string;
    matchScore: number;
  };
  companyId: string;
  createdAt: string;
}

// ── Scoring Weights (must sum to 1.0) ──

const SCORING_WEIGHTS = {
  signalConfidence: 0.25,
  capabilityMatch: 0.25,
  freshnessScore: 0.20,
  evidenceQuality: 0.15,
  businessImpact: 0.15,
} as const;

// ── Business Impact Mapping ──

function mapBusinessImpactToScore(impact: string): number {
  switch (impact?.toLowerCase()) {
    case 'high': return 90;
    case 'medium': return 60;
    case 'low': return 30;
    default: return 50;
  }
}

// ── Composite Score Computation ──

export function computeCompositeScore(params: {
  signalConfidence: number;  // 0-1
  capabilityMatchScore: number;  // 0-1
  freshnessScore: number;  // 0-100
  evidenceQualityScore: number;  // 0-100
  businessImpact: string;
}): OpportunityScoreBreakdown {
  const signalConfidence = Math.round(params.signalConfidence * 100);
  const capabilityMatch = Math.round(params.capabilityMatchScore * 100);
  const freshnessScore = params.freshnessScore;
  const evidenceQuality = params.evidenceQualityScore;
  const businessImpact = mapBusinessImpactToScore(params.businessImpact);

  const compositeScore = Math.round(
    signalConfidence * SCORING_WEIGHTS.signalConfidence +
    capabilityMatch * SCORING_WEIGHTS.capabilityMatch +
    freshnessScore * SCORING_WEIGHTS.freshnessScore +
    evidenceQuality * SCORING_WEIGHTS.evidenceQuality +
    businessImpact * SCORING_WEIGHTS.businessImpact
  );

  let priority: 'high' | 'medium' | 'low';
  if (compositeScore >= 70) {
    priority = 'high';
  } else if (compositeScore >= 40) {
    priority = 'medium';
  } else {
    priority = 'low';
  }

  return {
    signalConfidence,
    capabilityMatch,
    freshnessScore,
    evidenceQuality,
    businessImpact,
    compositeScore,
    priority,
  };
}

// ── System Prompt for Opportunity Identification ──

const OPPORTUNITY_SYSTEM_PROMPT = `You are a senior revenue intelligence analyst at a technology consultancy. Your task is to analyze intelligence inputs (buying signal, capability match, company research, evidence quality) and produce a strategic opportunity recommendation.

## Output Requirements

Return ONLY valid JSON (no markdown fences, no explanation):
{
  "opportunityTitle": "Concise title: [Company] — [Business Trigger] → [Recommended Capability]",
  "businessTrigger": "What specific business event or condition triggered this opportunity (2-3 sentences)",
  "whyNow": "Why this company should be pursued NOW — timing urgency, competitive dynamics, market conditions (2-3 sentences)",
  "businessProblem": "The specific business problem this company is facing that our capability can solve (2-3 sentences)",
  "recommendedStakeholders": ["CTO", "VP Engineering", "Head of Cloud"],
  "suggestedConversation": "The strategic conversation topics to initiate — what questions to ask, what insights to share (3-4 sentences)"
}

## Rules
- Be specific to THIS company, THIS signal, THIS capability — no generic filler
- Only reference information provided in the context
- recommendedStakeholders should be 2-4 roles based on the signal type and capability
- suggestedConversation should give the sales rep a clear starting point for discussion`;

// ── Main Function ──

export async function generateOpportunityRecommendation(params: {
  companyId: string;
  signalId: string;
  capabilityMatchId: string;
}): Promise<OpportunityRecommendationResult> {
  const { companyId, signalId, capabilityMatchId } = params;

  // ── 1. Load signal ──
  const signal = await db.companySignal.findUnique({
    where: { id: signalId },
  });
  if (!signal) throw new Error(`Signal ${signalId} not found`);

  // ── 2. Load capability match ──
  const match = await db.signalCapabilityMatch.findUnique({
    where: { id: capabilityMatchId },
  });
  if (!match) throw new Error(`Capability match ${capabilityMatchId} not found`);

  // ── 3. Load capability asset ──
  const capability = await db.capabilityAsset.findUnique({
    where: { id: match.capabilityId },
  });
  if (!capability) throw new Error(`Capability asset ${match.capabilityId} not found`);

  // ── 4. Load company + research card ──
  const [company, researchCard] = await Promise.all([
    db.company.findUnique({ where: { id: companyId } }),
    db.companyResearchCard.findUnique({ where: { companyId } }),
  ]);
  if (!company) throw new Error(`Company ${companyId} not found`);

  // ── 5. Compute evidence quality ──
  const evidenceQuality = await computeEvidenceQuality(companyId);

  // ── 6. Compute research confidence (from research card fieldConfidence or default) ──
  let researchConfidence = 0;
  if (researchCard?.fieldConfidence) {
    try {
      const fc = JSON.parse(researchCard.fieldConfidence) as Record<string, number>;
      const values = Object.values(fc);
      if (values.length > 0) {
        researchConfidence = values.reduce((a, b) => a + b, 0) / values.length;
      }
    } catch {
      researchConfidence = 0;
    }
  }

  // ── 7. Compute composite score ──
  const scoring = computeCompositeScore({
    signalConfidence: signal.confidence,
    capabilityMatchScore: match.matchScore,
    freshnessScore: evidenceQuality.freshness,
    evidenceQualityScore: evidenceQuality.overall,
    businessImpact: signal.impact,
  });

  // ── 8. Build LLM prompt ──
  const userPrompt = buildOpportunityPrompt({
    company,
    researchCard,
    signal,
    match,
    capability,
    evidenceQuality,
    scoring,
  });

  // ── 9. Call LLM via governance layer ──
  const result = await governedAICallAggregate({
    generationType: 'opportunities',
    systemPrompt: OPPORTUNITY_SYSTEM_PROMPT,
    userPrompt,
    inputParams: {
      companyId,
      signalId,
      capabilityMatchId,
      signalType: signal.signalType,
      capabilityTitle: capability.title,
      compositeScore: scoring.compositeScore,
    },
  });

  if (!result.success || !result.response) {
    throw new Error(
      result.rejectionReason || 'Failed to generate opportunity recommendation via LLM',
    );
  }

  // ── 10. Parse LLM response ──
  const parsed = parseOpportunityResponse(result.response);

  // ── 11. Gather evidence IDs ──
  const evidenceRecords = await db.evidence.findMany({
    where: { companyId, status: { in: ['active', 'aging'] } },
    select: { id: true },
  });
  const evidenceIds = JSON.stringify(evidenceRecords.map(e => e.id));

  // ── 12. Create OpportunityRecommendation record ──
  const opportunity = await db.opportunityRecommendation.create({
    data: {
      companyId,
      signalId,
      capabilityMatchId,
      opportunityTitle: parsed.opportunityTitle,
      businessTrigger: parsed.businessTrigger,
      whyNow: parsed.whyNow,
      businessProblem: parsed.businessProblem,
      recommendedCapability: capability.title,
      recommendedStakeholders: JSON.stringify(parsed.recommendedStakeholders),
      suggestedConversation: parsed.suggestedConversation,
      evidenceIds,
      confidenceScore: signal.confidence,
      freshnessScore: evidenceQuality.freshness,
      matchScore: match.matchScore,
      opportunityScore: scoring.compositeScore,
      priority: scoring.priority,
      status: 'pending_review',
    },
  });

  return {
    opportunity: {
      id: opportunity.id,
      opportunityTitle: opportunity.opportunityTitle,
      businessTrigger: opportunity.businessTrigger,
      whyNow: opportunity.whyNow,
      businessProblem: opportunity.businessProblem,
      recommendedCapability: opportunity.recommendedCapability,
      recommendedStakeholders: parsed.recommendedStakeholders,
      suggestedConversation: opportunity.suggestedConversation,
      status: 'pending_review' as const,
    },
    scoring,
    evidenceQuality,
    signalInfo: {
      id: signal.id,
      signalType: signal.signalType,
      title: signal.title,
      confidence: signal.confidence,
      impact: signal.impact,
    },
    capabilityInfo: {
      id: capability.id,
      title: capability.title,
      category: capability.category,
      matchScore: match.matchScore,
    },
    companyId,
    createdAt: opportunity.createdAt.toISOString(),
  };
}

// ── Batch Generation: Generate recommendations for all signal-capability matches ──

export async function generateOpportunityRecommendationsBatch(params: {
  companyId: string;
  minMatchScore?: number;
}): Promise<{ generated: number; results: OpportunityRecommendationResult[] }> {
  const { companyId, minMatchScore = 0.25 } = params;

  // Get all active matches for this company that don't already have recommendations
  const existingRecs = await db.opportunityRecommendation.findMany({
    where: { companyId },
    select: { signalId: true, capabilityMatchId: true },
  });
  const existingKeys = new Set(
    existingRecs.map(r => `${r.signalId}:${r.capabilityMatchId}`)
  );

  const matches = await db.signalCapabilityMatch.findMany({
    where: {
      companyId,
      matchScore: { gte: minMatchScore },
    },
    orderBy: { matchScore: 'desc' },
    take: 20, // Cap to prevent runaway generation
  });

  // Filter to only include matches whose signals are active/validated/aging
  const signalIds = matches.map(m => m.signalId);
  const activeSignals = signalIds.length > 0
    ? await db.companySignal.findMany({
        where: { id: { in: signalIds }, status: { in: ['active', 'validated', 'aging'] } },
        select: { id: true },
      })
    : [];
  const activeSignalIds = new Set(activeSignals.map(s => s.id));

  const filteredMatches = matches.filter(m => activeSignalIds.has(m.signalId));

  const results: OpportunityRecommendationResult[] = [];
  let generated = 0;

  for (const match of filteredMatches) {
    const key = `${match.signalId}:${match.id}`;
    if (existingKeys.has(key)) continue;

    try {
      const result = await generateOpportunityRecommendation({
        companyId,
        signalId: match.signalId,
        capabilityMatchId: match.id,
      });
      results.push(result);
      generated++;
    } catch (err: any) {
      console.error(
        `[opportunity-engine] Failed to generate recommendation for signal=${match.signalId}, match=${match.id}:`,
        err.message,
      );
    }
  }

  return { generated, results };
}

// ── Helpers ──

function buildOpportunityPrompt(ctx: {
  company: { normalizedName: string; industry: string | null; sizeRange: string | null; domain: string | null };
  researchCard: {
    businessOverview: string | null;
    strategicPriorities: string | null;
    businessProblems: string | null;
    transformationAreas: string | null;
    technologyThemes: string | null;
    revenue: string | null;
    employeeCount: string | null;
    fundingStage: string | null;
  } | null;
  signal: {
    signalType: string;
    title: string;
    description: string | null;
    impact: string;
    severity: string;
    confidence: number;
    source: string | null;
    buyingArea: string | null;
    techRequirement: string | null;
    serviceRequirement: string | null;
  };
  match: {
    matchScore: number;
    reason: string;
    businessProblem: string | null;
    expectedOutcome: string | null;
    salesAngle: string | null;
  };
  capability: {
    title: string;
    summary: string;
    category: string;
    businessProblem: string | null;
    customerOutcome: string | null;
    differentiator: string | null;
  };
  evidenceQuality: EvidenceQualityScore;
  scoring: OpportunityScoreBreakdown;
}): string {
  const { company, researchCard, signal, match, capability, evidenceQuality, scoring } = ctx;

  let strategicPriorities: string[] = [];
  let businessProblems: string[] = [];
  let transformationAreas: string[] = [];
  let technologyThemes: string[] = [];

  if (researchCard) {
    try { strategicPriorities = JSON.parse(researchCard.strategicPriorities || '[]'); } catch { /* empty */ }
    try { businessProblems = JSON.parse(researchCard.businessProblems || '[]'); } catch { /* empty */ }
    try { transformationAreas = JSON.parse(researchCard.transformationAreas || '[]'); } catch { /* empty */ }
    try { technologyThemes = JSON.parse(researchCard.technologyThemes || '[]'); } catch { /* empty */ }
  }

  return `Analyze the following intelligence and generate an opportunity recommendation:

## COMPANY INTELLIGENCE
- Company: ${company.normalizedName}
- Industry: ${company.industry || 'Unknown'}
- Company Size: ${company.sizeRange || 'Unknown'}
- Business Overview: ${researchCard?.businessOverview || 'Not available'}
- Revenue: ${researchCard?.revenue || 'Unknown'}
- Employees: ${researchCard?.employeeCount || 'Unknown'}
- Funding Stage: ${researchCard?.fundingStage || 'Unknown'}
- Strategic Priorities: ${strategicPriorities.length > 0 ? strategicPriorities.map(p => typeof p === 'object' ? (p as any).description || (p as any).priority : p).join('; ') : 'Not identified'}
- Known Business Problems: ${businessProblems.join('; ') || 'Not identified'}
- Transformation Areas: ${transformationAreas.join('; ') || 'Not identified'}
- Technology Themes: ${technologyThemes.join('; ') || 'Not available'}

## BUYING SIGNAL
- Signal Type: ${signal.signalType}
- Signal Title: ${signal.title}
- Signal Description: ${signal.description || 'No description'}
- Impact Level: ${signal.impact}
- Severity: ${signal.severity}
- Signal Confidence: ${(signal.confidence * 100).toFixed(0)}%
- Source: ${signal.source || 'Unknown'}
- Buying Area: ${signal.buyingArea || 'Not specified'}
- Tech Requirement: ${signal.techRequirement || 'Not specified'}
- Service Requirement: ${signal.serviceRequirement || 'Not specified'}

## CAPABILITY MATCH
- Capability: ${capability.title}
- Summary: ${capability.summary}
- Category: ${capability.category}
- Core Business Problem: ${capability.businessProblem || match.businessProblem || 'Not specified'}
- Expected Outcome: ${capability.customerOutcome || match.expectedOutcome || 'Not specified'}
- Differentiator: ${capability.differentiator || 'Not specified'}
- Match Score: ${(match.matchScore * 100).toFixed(0)}%
- Match Reason: ${match.reason}
- Sales Angle: ${match.salesAngle || 'Not specified'}

## INTELLIGENCE QUALITY
- Evidence Quality Score: ${evidenceQuality.overall}/100
  - Coverage: ${evidenceQuality.coverage}/100 (${evidenceQuality.fieldsCovered}/${evidenceQuality.totalFields} fields backed)
  - Freshness: ${evidenceQuality.freshness}/100 (avg ${evidenceQuality.avgRecencyDays} days old)
  - Source Quality: ${evidenceQuality.sourceQuality}/100
  - Corroboration: ${evidenceQuality.corroboration}/100
  - Volume: ${evidenceQuality.volume}/100 (${evidenceQuality.activeEvidence} active evidence records)

## COMPOSITE OPPORTUNITY SCORE: ${scoring.compositeScore}/100
- Signal Confidence: ${scoring.signalConfidence}/100 (weight 25%)
- Capability Match: ${scoring.capabilityMatch}/100 (weight 25%)
- Freshness: ${scoring.freshnessScore}/100 (weight 20%)
- Evidence Quality: ${scoring.evidenceQuality}/100 (weight 15%)
- Business Impact: ${scoring.businessImpact}/100 (weight 15%)
- Priority: ${scoring.priority}

Generate the opportunity recommendation as JSON.`;
}

function parseOpportunityResponse(response: string): {
  opportunityTitle: string;
  businessTrigger: string;
  whyNow: string;
  businessProblem: string;
  recommendedStakeholders: string[];
  suggestedConversation: string;
} {
  let cleaned = response.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  const parsed = JSON.parse(cleaned);

  if (!parsed.opportunityTitle || !parsed.whyNow || !parsed.businessProblem) {
    throw new Error('LLM response missing required fields (opportunityTitle, whyNow, businessProblem)');
  }

  return {
    opportunityTitle: parsed.opportunityTitle,
    businessTrigger: parsed.businessTrigger || '',
    whyNow: parsed.whyNow,
    businessProblem: parsed.businessProblem,
    recommendedStakeholders: Array.isArray(parsed.recommendedStakeholders)
      ? parsed.recommendedStakeholders
      : [],
    suggestedConversation: parsed.suggestedConversation || '',
  };
}