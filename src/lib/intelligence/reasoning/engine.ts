// ═══════════════════════════════════════════════════════════════════════════
// DeepMindQ AI Reasoning Engine
//
// Converts signals + evidence into actionable intelligence.
// Uses LLM when available, structured templates when not.
// LLM is the reasoning layer, not the source of truth.
// ═══════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { callLLM } from '@/lib/llm-client';
import { governedAICall } from '@/lib/ai-governance';

export interface ReasoningResult {
  insight: {
    category: string;
    title: string;
    narrative: string;
    recommendation: string;
    suggestedMessage: string;
    confidence: 'very_high' | 'high' | 'medium' | 'low' | 'very_low';
    confidenceScore: number;
    evidenceIds: string[];
    reasoningMethod: string;
  };
}

interface OrganizationContext {
  name: string;
  industry: string | null;
  domain: string | null;
  employeeCount: number | null;
  revenue: string | null;
  people: Array<{ fullName: string; title: string | null; role: string }>;
  signals: Array<{
    id: string;
    signalType: string;
    severity: string;
    title: string;
    description: string;
    confidenceScore: number | null;
    impactScore: number | null;
  }>;
}

/**
 * Generate AI reasoning for an organization.
 * Uses LLM if API key is configured, falls back to template reasoning.
 */
export async function reasonAboutOrganization(orgId: string): Promise<ReasoningResult[]> {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    include: {
      people: true,
      signals: {
        where: { status: { in: ['detected', 'validated', 'analyzed'] } },
        orderBy: { detectedAt: 'desc' },
      },
      evidence: true,
    },
  });

  if (!org) return [];

  const context: OrganizationContext = {
    name: org.name,
    industry: org.industry,
    domain: org.domain,
    employeeCount: org.employeeCount,
    revenue: org.revenue,
    people: org.people.map((p) => ({ fullName: p.fullName, title: p.title, role: p.role })),
    signals: org.signals.map((s) => ({
      id: s.id,
      signalType: s.signalType,
      severity: s.severity,
      title: s.title,
      description: s.description,
      confidenceScore: s.confidenceScore,
      impactScore: s.impactScore,
    })),
  };

  // Try LLM reasoning first
  if (process.env.OPENAI_API_KEY || process.env.LLM_API_KEY) {
    try {
      return await llmReason(context);
    } catch (error) {
      logger.warn('[REASONING] LLM failed, falling back to templates', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  // Template-based reasoning (always works, no LLM needed)
  return templateReason(context);
}

/**
 * LLM-powered reasoning.
 * Routes through the governance layer for rate limiting, caching,
 * quality gates, and audit logging. Falls back to direct callLLM
 * if governance fails (graceful degradation).
 */
async function llmReason(context: OrganizationContext): Promise<ReasoningResult[]> {
  const systemPrompt = `You are DeepMindQ, an Enterprise Intelligence OS. Your job is to analyze business intelligence about organizations and produce actionable insights. Be specific, evidence-backed, and practical. Never fabricate data. If confidence is low, say so.`;

  const userPrompt = buildReasoningPrompt(context);

  // Try governed path first (rate limiting, caching, quality gates, audit)
  try {
    const result = await governedAICall({
      feature: 'reasoning',
      systemPrompt,
      userPrompt,
      temperature: 0.3,
      maxTokens: 1500,
      runQualityGates: true,
      cacheResponse: true,
      cacheTTLSeconds: 1800, // 30 minutes — reasoning results become stale
    });

    if (result.rateLimited) {
      logger.warn('[REASONING] Rate limited — falling back to direct callLLM');
      return llmReasonDirect(systemPrompt, userPrompt, context);
    }

    if (result.text) {
      return parseLLMResponse(result.text, context);
    }
  } catch (err) {
    logger.warn('[REASONING] Governance layer failed, falling back to direct callLLM', {
      error: err instanceof Error ? err.message : 'Unknown',
    });
  }

  // Fallback: direct callLLM (still works, just without governance wrappers)
  return llmReasonDirect(systemPrompt, userPrompt, context);
}

/**
 * Direct LLM call without governance layer (fallback path).
 * Used when governance is unavailable or rate-limited.
 */
async function llmReasonDirect(
  systemPrompt: string,
  userPrompt: string,
  context: OrganizationContext,
): Promise<ReasoningResult[]> {
  const content = await callLLM(systemPrompt, userPrompt, {
    temperature: 0.3,
    maxTokens: 1500,
  });
  return parseLLMResponse(content, context);
}

/**
 * Template-based reasoning. No LLM required.
 * Uses rules to generate structured intelligence narratives.
 */
function templateReason(context: OrganizationContext): ReasoningResult[] {
  const results: ReasoningResult[] = [];

  // Generate insight from each signal cluster
  const signalsByType = groupBy(context.signals, 'signalType');

  for (const [type, signals] of Object.entries(signalsByType)) {
    const insight = generateTemplateInsight(type, signals, context);
    if (insight) results.push(insight);
  }

  // Generate an overall opportunity assessment
  if (context.people.length > 0 || context.signals.length > 0) {
    results.push(generateOpportunityInsight(context));
  }

  return results;
}

function generateTemplateInsight(
  type: string,
  signals: OrganizationContext['signals'],
  context: OrganizationContext,
): ReasoningResult | null {
  const titles: Record<string, string> = {
    financial_indicator: 'Financial capacity analysis',
    leadership_change: 'Leadership intelligence',
    market_expansion: 'Market positioning',
    technology_change: 'Technology landscape',
    customer_signal: 'Relationship coverage',
    hiring_change: 'Growth trajectory',
  };

  const title = titles[type] || `${type} analysis`;
  const avgConfidence =
    signals.reduce((sum, s) => sum + (s.confidenceScore || 50), 0) / signals.length;
  const avgImpact = signals.reduce((sum, s) => sum + (s.impactScore || 50), 0) / signals.length;

  const signalDescriptions = signals.map((s) => s.description).join(' ');
  const confidence = scoreToConfidence(avgConfidence);

  let narrative = '';
  let recommendation = '';
  let suggestedMessage = '';

  switch (type) {
    case 'financial_indicator':
      narrative = `${context.name} ${context.revenue ? `reports revenue of ${context.revenue}` : 'has financial indicators'}${context.employeeCount ? ` with ${context.employeeCount} employees` : ''}. ${signalDescriptions} This suggests ${avgImpact > 60 ? 'significant' : 'moderate'} purchasing capacity and a structured procurement process.`;
      recommendation =
        avgImpact > 60
          ? 'Prioritize high-value engagement. Prepare ROI-focused materials.'
          : 'Monitor for growth signals. Nurture relationship with current contacts.';
      suggestedMessage = `Given ${context.name}'s ${context.industry || 'market'} position${context.revenue ? ` and revenue profile` : ''}, I wanted to share some insights that may be relevant to your current initiatives.`;
      break;

    case 'leadership_change':
      narrative = `${context.name} has leadership-level contacts: ${
        context.people
          .filter((p) => p.role === 'executive' || p.role === 'vice_president')
          .map((p) => `${p.fullName} (${p.title || p.role})`)
          .join(', ') || 'See signals for details'
      }. ${signalDescriptions}`;
      recommendation = 'Multi-thread engagement across leadership. Map decision-making hierarchy.';
      suggestedMessage = `I noticed ${context.name} has been through some leadership changes. I have some intelligence that might help inform your outreach strategy.`;
      break;

    case 'customer_signal':
      narrative = `Relationship analysis for ${context.name}: ${context.people.length} known contact${context.people.length !== 1 ? 's' : ''}. ${signalDescriptions}`;
      recommendation =
        context.people.length < 2
          ? 'Expand relationship map. Identify additional stakeholders to reduce single-point-of-failure risk.'
          : 'Leverage multiple contacts for cross-verified intelligence. Schedule multi-stakeholder engagement.';
      suggestedMessage = `I have updated intelligence on ${context.name} that may impact your engagement strategy.`;
      break;

    default:
      narrative = `${context.name}: ${signalDescriptions}`;
      recommendation =
        'Monitor this signal pattern for changes. Update intelligence when new data becomes available.';
      suggestedMessage = `There are new developments at ${context.name} worth discussing.`;
  }

  return {
    insight: {
      category:
        type === 'financial_indicator'
          ? 'opportunity'
          : type === 'customer_signal'
            ? 'risk'
            : 'recommendation',
      title,
      narrative,
      recommendation,
      suggestedMessage,
      confidence,
      confidenceScore: Math.round(avgConfidence),
      evidenceIds: signals.map((s) => s.id),
      reasoningMethod: 'template',
    },
  };
}

function generateOpportunityInsight(context: OrganizationContext): ReasoningResult {
  const signalStrength = context.signals.length;
  const contactCoverage = context.people.length;
  const dataRichness =
    (context.industry ? 1 : 0) + (context.revenue ? 1 : 0) + (context.employeeCount ? 1 : 0);

  const opportunityScore = Math.min(
    100,
    (signalStrength > 3 ? 30 : signalStrength * 10) +
      (contactCoverage > 2 ? 25 : contactCoverage * 12) +
      dataRichness * 15,
  );

  const confidence = scoreToConfidence(opportunityScore);

  return {
    insight: {
      category: 'opportunity',
      title: `Opportunity assessment: ${context.name}`,
      narrative: `${context.name} has a composite opportunity score of ${opportunityScore}/100 based on ${signalStrength} active signal${signalStrength !== 1 ? 's' : ''}, ${contactCoverage} known contact${contactCoverage !== 1 ? 's' : ''}, and ${dataRichness}/3 data dimensions complete. ${opportunityScore > 70 ? 'This organization shows strong indicators for active engagement.' : opportunityScore > 40 ? 'This organization warrants continued monitoring and relationship building.' : 'More intelligence is needed before making an engagement decision.'}`,
      recommendation:
        opportunityScore > 70
          ? `Engage ${context.name} proactively. Schedule discovery conversation within 7 days.`
          : opportunityScore > 40
            ? `Continue nurturing ${context.name}. Enrich data and expand contact network before deep engagement.`
            : `Add more intelligence about ${context.name} before committing resources to engagement.`,
      suggestedMessage: `I have been tracking ${context.name} and identified some patterns that might be relevant to your business objectives.`,
      confidence,
      confidenceScore: opportunityScore,
      evidenceIds: context.signals.slice(0, 5).map((s) => s.id),
      reasoningMethod: 'template',
    },
  };
}

function buildReasoningPrompt(context: OrganizationContext): string {
  return `Analyze this organization and generate actionable intelligence:

Company: ${context.name}
Industry: ${context.industry || 'Unknown'}
Domain: ${context.domain || 'Unknown'}
Employees: ${context.employeeCount || 'Unknown'}
Revenue: ${context.revenue || 'Unknown'}

Known Contacts:
${context.people.length > 0 ? context.people.map((p) => `  - ${p.fullName} (${p.title || p.role})`).join('\n') : '  None identified'}

Active Signals:
${context.signals.length > 0 ? context.signals.map((s) => `  - [${s.severity}] ${s.title}: ${s.description}`).join('\n') : '  No signals detected'}

Provide your analysis as JSON array with these fields for each insight:
- category: "opportunity", "risk", or "recommendation"
- title: Brief insight title
- narrative: 2-3 sentence analysis (evidence-backed, no hallucination)
- recommendation: Specific next action
- suggestedMessage: Outreach message template
- confidence: "very_high", "high", "medium", "low", or "very_low"
- confidenceScore: 0-100

Return ONLY the JSON array, no markdown.`;
}

function parseLLMResponse(content: string, context: OrganizationContext): ReasoningResult[] {
  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found in response');

    const parsed = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed)) throw new Error('Expected JSON array');

    return parsed.map((item: Record<string, unknown>) => ({
      insight: {
        category: String(item.category || 'recommendation'),
        title: String(item.title || 'Intelligence insight'),
        narrative: String(item.narrative || ''),
        recommendation: String(item.recommendation || ''),
        suggestedMessage: String(item.suggestedMessage || ''),
        confidence: String(item.confidence || 'medium') as
          'very_high' | 'high' | 'medium' | 'low' | 'very_low',
        confidenceScore: Number(item.confidenceScore || 50),
        evidenceIds: context.signals.slice(0, 5).map((s) => s.id),
        reasoningMethod: 'llm',
      },
    }));
  } catch (error) {
    logger.warn('[REASONING] Failed to parse LLM response, falling back to templates', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return templateReason(context);
  }
}

function scoreToConfidence(score: number): 'very_high' | 'high' | 'medium' | 'low' | 'very_low' {
  if (score >= 90) return 'very_high';
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  if (score >= 25) return 'low';
  return 'very_low';
}

function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce(
    (groups, item) => {
      const k = String(item[key]);
      if (!groups[k]) groups[k] = [];
      groups[k].push(item);
      return groups;
    },
    {} as Record<string, T[]>,
  );
}

/**
 * Store reasoning results as Insights in the database.
 */
export async function storeInsights(orgId: string, results: ReasoningResult[]): Promise<number> {
  if (results.length === 0) return 0;

  let stored = 0;
  await db.$transaction(async (tx) => {
    for (const result of results) {
      await tx.insight.create({
        data: {
          organizationId: orgId,
          category: result.insight.category,
          title: result.insight.title,
          narrative: result.insight.narrative,
          recommendation: result.insight.recommendation,
          suggestedMessage: result.insight.suggestedMessage,
          confidence: result.insight.confidence,
          confidenceScore: result.insight.confidenceScore,
          evidenceIds: Array.isArray(result.insight.evidenceIds)
            ? JSON.stringify(result.insight.evidenceIds)
            : result.insight.evidenceIds || '[]',
          reasoningMethod: result.insight.reasoningMethod,
          status: 'active',
        },
      });
      stored++;
    }
  });
  return stored;
}

/**
 * Run full intelligence pipeline for one organization:
 * Signal Detection → AI Reasoning → Briefing Generation
 */
export async function runIntelligencePipeline(orgId: string): Promise<{
  signalsDetected: number;
  insightsGenerated: number;
  briefingGenerated: boolean;
}> {
  // Step 1: Detect signals
  const signals = await (await import('./signals')).detectSignalsForOrganization(orgId);
  const signalsStored = await (await import('./signals')).storeSignals(signals);

  // Step 2: AI Reasoning
  const insights = await reasonAboutOrganization(orgId);
  const insightsStored = await storeInsights(orgId, insights);

  // Step 3: Generate briefing
  let briefingGenerated = false;
  try {
    await generateBriefing(orgId);
    briefingGenerated = true;
  } catch (error) {
    logger.error(`[PIPELINE] Briefing generation failed for ${orgId}`, {
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }

  return {
    signalsDetected: signalsStored,
    insightsGenerated: insightsStored,
    briefingGenerated,
  };
}

/**
 * Generate a briefing for an organization.
 * Summarizes all intelligence into a single document.
 */
async function generateBriefing(orgId: string): Promise<void> {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    include: {
      signals: { where: { status: { in: ['detected', 'validated', 'analyzed'] } } },
      insights: { where: { status: 'active' } },
      evidence: true,
      people: true,
    },
  });

  if (!org) throw new Error(`Organization ${orgId} not found`);

  const keyFindings = org.insights.slice(0, 5).map((i) => i.title);
  const riskFactors = org.signals
    .filter((s) => s.severity === 'critical' || s.severity === 'high')
    .map((s) => s.title);
  const recommendedActions = org.insights
    .filter((i) => i.recommendation)
    .slice(0, 5)
    .map((i) => i.recommendation);

  // Calculate opportunity score from signals and insights
  const avgSignalImpact =
    org.signals.length > 0
      ? org.signals.reduce((sum, s) => sum + (s.impactScore || 0), 0) / org.signals.length
      : 0;
  const avgInsightConfidence =
    org.insights.length > 0
      ? org.insights.reduce((sum, i) => sum + (i.confidenceScore || 0), 0) / org.insights.length
      : 0;
  const opportunityScore = Math.round((avgSignalImpact + avgInsightConfidence) / 2);

  const overallConfidence =
    org.insights.length > 0
      ? org.insights.reduce((sum, i) => sum + (i.confidenceScore || 0), 0) / org.insights.length
      : 0;

  const executiveSummary = buildExecutiveSummary(org, opportunityScore);

  // Deactivate old briefings
  await db.briefing.updateMany({
    where: { organizationId: orgId },
    data: { version: 0 },
  });

  await db.briefing.create({
    data: {
      organizationId: orgId,
      executiveSummary,
      keyFindings: JSON.stringify(keyFindings),
      opportunityScore,
      riskFactors: JSON.stringify(riskFactors),
      recommendedActions: JSON.stringify(recommendedActions.filter((a): a is string => a !== null)),
      signalCount: org.signals.length,
      activeSignals: org.signals.filter((s) => s.status !== 'expired' && s.status !== 'dismissed')
        .length,
      insightCount: org.insights.length,
      evidenceCount: org.evidence.length,
      overallConfidence: scoreToConfidence(overallConfidence),
    },
  });
}

function buildExecutiveSummary(
  org: {
    name: string;
    industry: string | null;
    employeeCount: number | null;
    revenue: string | null;
    signals: unknown[];
    people: unknown[];
  },
  opportunityScore: number,
): string {
  const parts: string[] = [];

  parts.push(
    `${org.name}${org.industry ? ` operates in the ${org.industry} sector` : ''}${org.employeeCount ? ` with approximately ${org.employeeCount} employees` : ''}.`,
  );

  if (org.signals.length > 0) {
    parts.push(
      `${org.signals.length} active intelligence signal${org.signals.length !== 1 ? 's' : ''} detected.`,
    );
  }

  if (opportunityScore > 70) {
    parts.push('Strong engagement opportunity indicators present.');
  } else if (opportunityScore > 40) {
    parts.push('Moderate opportunity — continued monitoring recommended.');
  } else {
    parts.push('Limited intelligence — enrichment needed before engagement decision.');
  }

  if (org.people.length > 0) {
    parts.push(
      `${org.people.length} known contact${org.people.length !== 1 ? 's' : ''} available for engagement.`,
    );
  }

  return parts.join(' ');
}
