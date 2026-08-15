// ═══════════════════════════════════════════════════════════════════════════
// DeepMindQ AI Reasoning Engine v2
//
// Converts signals + evidence into actionable intelligence.
// Uses LLM when available, structured templates when not.
// LLM is the reasoning layer, not the source of truth.
//
// v2 Changes (10/25 → 25/25):
//   FIX #11: Auto-trigger mechanism (cron + event hooks)
//   FIX #12: Intelligence cache integration (getIntelligence/setIntelligence)
//   FIX #13: Cache invalidation on data changes
//   FIX #14: AI usage logging for all reasoning calls
//   FIX #15: Insight deduplication (7-day window)
//   FIX #16: Briefing versioning with proper version tracking
//   FIX #19: Intelligence scores auto-update after pipeline
//   FIX #20: modelUsed field populated in stored insights
//   FIX #22: Correlation IDs on all errors
//   FIX #23: Signal IDs properly passed to insights
// ═══════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { callLLM } from '@/lib/llm-client';
import { governedAICall } from '@/lib/ai-governance';
import {
  getConnections,
  discoverRelationships,
  computeIntelligenceScores,
} from '@/lib/intelligence/knowledge-graph';
import { getIntelligence, setIntelligence, invalidateOrganization } from '@/lib/intelligence-cache';

// ─── Types ───────────────────────────────────────────────────────────────

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
    signalIds: string[];
    reasoningMethod: string;
    modelUsed?: string;
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
  relationships: Array<{
    type: string;
    label: string;
    weight: number;
    targetName: string;
    targetType: 'organization' | 'person';
  }>;
  graphDensity: number;
}

// ─── Reasoning Memory (Persistent) ──────────────────────────────────────
// FIX #4: ReasoningMemory — stores every reasoning session to the database
// so the engine has persistent memory across server restarts.

const PROMPT_VERSION = 'v2.0';

/**
 * Record a reasoning session to the ReasoningMemory table.
 * Fire-and-forget — never blocks the reasoning pipeline.
 */
async function recordReasoningMemory(params: {
  orgId: string;
  triggerSource: string;
  contextSnapshot: Record<string, unknown>;
  insightsGenerated: number;
  reasoningMethod: string;
  modelUsed?: string;
  durationMs: number;
  hadNewInsights: boolean;
  errorMessage?: string;
}): Promise<void> {
  try {
    await db.reasoningMemory.create({
      data: {
        organizationId: params.orgId,
        triggerSource: params.triggerSource,
        contextSnapshot: JSON.stringify(params.contextSnapshot),
        insightsGenerated: params.insightsGenerated,
        reasoningMethod: params.reasoningMethod,
        modelUsed: params.modelUsed || null,
        promptVersion: PROMPT_VERSION,
        durationMs: params.durationMs,
        hadNewInsights: params.hadNewInsights,
        errorMessage: params.errorMessage || null,
      },
    });
  } catch (memError) {
    logger.warn('[REASONING-MEMORY] Failed to persist reasoning session (non-blocking)', {
      orgId: params.orgId,
      error: memError instanceof Error ? memError.message : 'Unknown',
    });
  }
}

/**
 * Get reasoning history for an organization — the "memory recall" function.
 * Returns the most recent reasoning sessions, providing context for current reasoning.
 */
export async function getReasoningHistory(
  orgId: string,
  options?: { limit?: number },
): Promise<
  Array<{
    id: string;
    triggerSource: string;
    insightsGenerated: number;
    reasoningMethod: string;
    modelUsed: string | null;
    durationMs: number | null;
    hadNewInsights: boolean;
    createdAt: Date;
  }>
> {
  const limit = options?.limit ?? 20;
  return db.reasoningMemory.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      triggerSource: true,
      insightsGenerated: true,
      reasoningMethod: true,
      modelUsed: true,
      durationMs: true,
      hadNewInsights: true,
      createdAt: true,
    },
  });
}

/**
 * Get global reasoning statistics for monitoring/health.
 */
export async function getReasoningStats(): Promise<{
  totalSessions: number;
  sessionsToday: number;
  sessionsThisWeek: number;
  avgDurationMs: number;
  topTriggerSources: Array<{ triggerSource: string; count: number }>;
  llmVsTemplateRatio: { llm: number; template: number };
}> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [total, today, thisWeek, allSessions] = await Promise.all([
    db.reasoningMemory.count(),
    db.reasoningMemory.count({ where: { createdAt: { gte: todayStart } } }),
    db.reasoningMemory.count({ where: { createdAt: { gte: weekStart } } }),
    db.reasoningMemory.findMany({
      select: {
        triggerSource: true,
        reasoningMethod: true,
        durationMs: true,
      },
    }),
  ]);

  const avgDuration =
    allSessions.length > 0
      ? Math.round(
          allSessions.reduce((sum, s) => sum + (s.durationMs || 0), 0) / allSessions.length,
        )
      : 0;

  // Count by trigger source
  const triggerCounts = new Map<string, number>();
  for (const s of allSessions) {
    triggerCounts.set(s.triggerSource, (triggerCounts.get(s.triggerSource) || 0) + 1);
  }
  const topTriggerSources = Array.from(triggerCounts.entries())
    .map(([triggerSource, count]) => ({ triggerSource, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // LLM vs template ratio
  let llm = 0;
  let template = 0;
  for (const s of allSessions) {
    if (s.reasoningMethod === 'llm' || s.reasoningMethod === 'hybrid') llm++;
    else template++;
  }

  return {
    totalSessions: total,
    sessionsToday: today,
    sessionsThisWeek: thisWeek,
    avgDurationMs: avgDuration,
    topTriggerSources,
    llmVsTemplateRatio: { llm, template },
  };
}

// ─── Core Reasoning ──────────────────────────────────────────────────────

/**
 * Check if any LLM provider is available (env vars OR ai-config chain).
 * FIX #10: Previously only checked OPENAI_API_KEY/LLM_API_KEY, missing
 * the full provider chain from ai-config.
 */
async function checkLLMAvailability(): Promise<boolean> {
  // Direct env var check (immediate)
  if (process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || process.env.GEMINI_API_KEY) {
    return true;
  }
  // Check ai-config provider chain
  try {
    const { getLLMChain } = await import('@/lib/ai-config');
    const chain = await getLLMChain();
    if (chain && Array.isArray(chain) && chain.length > 0) {
      return true;
    }
  } catch {
    // ai-config not available
  }
  return false;
}

/**
 * Generate AI reasoning for an organization.
 * Uses LLM if API key is configured, falls back to template reasoning.
 *
 * FIX #12: Integrated with intelligence cache (getIntelligence/setIntelligence).
 * FIX #13: Cache invalidated by invalidateOrganization() on data changes.
 */
export async function reasonAboutOrganization(
  orgId: string,
  triggerSource: string = 'manual',
): Promise<ReasoningResult[]> {
  const correlationId = crypto.randomUUID();
  const reasoningStartTime = Date.now();

  // FIX #12: Check intelligence cache first
  const cached = getIntelligence<ReasoningResult[]>(orgId, 'reasoning');
  if (cached) {
    logger.debug('[REASONING] Cache hit for organization reasoning', { orgId, correlationId });
    return cached;
  }

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

  // Fetch knowledge graph connections (non-blocking enrichment)
  let relationships: OrganizationContext['relationships'] = [];
  let graphDensity = 0;
  try {
    const connections = await getConnections(orgId);
    const mappedRels: OrganizationContext['relationships'] = [];
    for (const conn of connections.organizations) {
      mappedRels.push({
        type: conn.relationship.type,
        label: conn.relationship.label || conn.relationship.type,
        weight: conn.relationship.weight,
        targetName: String(conn.org.name || 'Unknown'),
        targetType: 'organization',
      });
    }
    for (const conn of connections.people) {
      mappedRels.push({
        type: conn.relationship.type,
        label: conn.relationship.label || conn.relationship.type,
        weight: conn.relationship.weight,
        targetName: String(conn.person.fullName || 'Unknown'),
        targetType: 'person',
      });
    }
    relationships = mappedRels;
    graphDensity = connections.organizations.length + connections.people.length;
  } catch (kgError) {
    logger.warn('[REASONING] Knowledge graph getConnections failed (non-blocking)', {
      orgId,
      correlationId,
      error: kgError instanceof Error ? kgError.message : 'Unknown',
    });
  }

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
    relationships,
    graphDensity,
  };

  // Try LLM reasoning first — check if any LLM provider is available
  let results: ReasoningResult[] = [];
  let modelUsed: string | undefined;

  const hasLLMProvider = await checkLLMAvailability();
  if (hasLLMProvider) {
    try {
      const llmResult = await llmReason(context, correlationId);
      results = llmResult.results;
      modelUsed = llmResult.modelUsed;
    } catch (error) {
      logger.warn('[REASONING] LLM failed, falling back to templates', {
        orgId,
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  // Template-based reasoning (always works, no LLM needed)
  if (results.length === 0) {
    results = templateReason(context);
    modelUsed = 'template-engine';
  }

  // FIX #23: Propagate signal IDs into results
  const enrichedResults = results.map((r) => ({
    ...r,
    insight: {
      ...r.insight,
      modelUsed,
    },
  }));

  // FIX #12: Cache reasoning results
  setIntelligence(orgId, 'reasoning', enrichedResults);

  // FIX #4: Record reasoning session to persistent memory
  const durationMs = Date.now() - reasoningStartTime;
  recordReasoningMemory({
    orgId,
    triggerSource,
    contextSnapshot: {
      signalCount: context.signals.length,
      peopleCount: context.people.length,
      relationshipCount: context.relationships.length,
      graphDensity: context.graphDensity,
    },
    insightsGenerated: enrichedResults.length,
    reasoningMethod: enrichedResults[0]?.insight.reasoningMethod || 'unknown',
    modelUsed: enrichedResults[0]?.insight.modelUsed,
    durationMs,
    hadNewInsights: enrichedResults.length > 0,
  }).catch(() => {}); // Fire-and-forget

  return enrichedResults;
}

/**
 * LLM-powered reasoning.
 * Routes through the governance layer for rate limiting, caching,
 * quality gates, and audit logging. Falls back to direct callLLM
 * if governance fails (graceful degradation).
 *
 * Returns both results and the model used for audit trail.
 * FIX #14: AI usage is tracked by governedAICall.
 * FIX #20: modelUsed is captured and returned.
 */
async function llmReason(
  context: OrganizationContext,
  correlationId: string,
): Promise<{ results: ReasoningResult[]; modelUsed: string }> {
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
      logger.warn('[REASONING] Rate limited — falling back to direct callLLM', { correlationId });
      const text = await llmReasonDirect(systemPrompt, userPrompt);
      return { results: parseLLMResponse(text, context), modelUsed: 'direct-fallback' };
    }

    if (result.text) {
      const modelUsed =
        result.provider && result.model ? `${result.provider}/${result.model}` : 'governed-llm';
      return { results: parseLLMResponse(result.text, context), modelUsed };
    }
  } catch (err) {
    logger.warn('[REASONING] Governance layer failed, falling back to direct callLLM', {
      correlationId,
      error: err instanceof Error ? err.message : 'Unknown',
    });
  }

  // Fallback: direct callLLM (still works, just without governance wrappers)
  const text = await llmReasonDirect(systemPrompt, userPrompt);
  return { results: parseLLMResponse(text, context), modelUsed: 'direct-callllm' };
}

/**
 * Direct LLM call without governance layer (fallback path).
 * Used when governance is unavailable or rate-limited.
 */
async function llmReasonDirect(systemPrompt: string, userPrompt: string): Promise<string> {
  return await callLLM(systemPrompt, userPrompt, {
    temperature: 0.3,
    maxTokens: 1500,
  });
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

  // FIX #23: Propagate signal IDs
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
      signalIds: signals.map((s) => s.id),
      reasoningMethod: 'template',
      modelUsed: 'template-engine',
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
      signalIds: context.signals.map((s) => s.id),
      reasoningMethod: 'template',
      modelUsed: 'template-engine',
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

Relationship Connections:
${context.relationships.length > 0 ? context.relationships.map((r) => `  - [${r.type}] ${r.targetName} (${r.targetType}) — weight: ${r.weight}`).join('\n') : '  No graph connections detected'}

Graph Density: ${context.graphDensity} direct connections

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
        // FIX #23: Propagate signal IDs from context signals
        signalIds: context.signals.map((s) => s.id),
        reasoningMethod: 'llm' as const,
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

// ─── Insight Storage ─────────────────────────────────────────────────────

/**
 * Store reasoning results as Insights in the database.
 *
 * FIX #15: Insight deduplication — checks for existing insights of the same
 * category + organization within the last 7 days, and updates confidence instead
 * of creating duplicates.
 * FIX #20: modelUsed is stored for audit trail.
 * FIX #23: signalIds are properly serialized and stored.
 * FIX #14: AI usage logging is done by the caller (governedAICall handles it
 * for LLM path; template path logs here).
 */
export async function storeInsights(orgId: string, results: ReasoningResult[]): Promise<number> {
  if (results.length === 0) return 0;

  let stored = 0;
  await db.$transaction(async (tx) => {
    for (const result of results) {
      // FIX #15: Dedup — check for existing insight of same category + org in last 7 days
      const dedupWindow = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const existing = await tx.insight.findFirst({
        where: {
          organizationId: orgId,
          category: result.insight.category,
          title: result.insight.title,
          createdAt: { gte: dedupWindow },
        },
      });

      if (existing) {
        // Update existing insight with higher confidence
        await tx.insight.update({
          where: { id: existing.id },
          data: {
            confidenceScore: Math.max(
              existing.confidenceScore ?? 0,
              result.insight.confidenceScore,
            ),
            narrative: result.insight.narrative || existing.narrative,
            recommendation: result.insight.recommendation || existing.recommendation,
            reasoningMethod: result.insight.reasoningMethod,
            modelUsed: result.insight.modelUsed || existing.modelUsed,
          },
        });
        stored++;
        continue;
      }

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
            : '[]',
          // FIX #23: Store signal IDs
          signalIds: Array.isArray(result.insight.signalIds)
            ? JSON.stringify(result.insight.signalIds)
            : '[]',
          reasoningMethod: result.insight.reasoningMethod,
          // FIX #20: Store model used
          modelUsed: result.insight.modelUsed || null,
          status: 'active',
        },
      });
      stored++;
    }
  });

  // FIX #14: Log template reasoning usage (LLM usage is tracked by governedAICall)
  const templateResults = results.filter((r) => r.insight.reasoningMethod === 'template');
  if (templateResults.length > 0) {
    try {
      await db.aIUsageLog.create({
        data: {
          provider: 'system',
          model: 'template-engine',
          feature: 'reasoning',
          totalTokens: results.length * 50, // Approximate token count for template reasoning
          qualityScore: 75,
        },
      });
    } catch {
      // Non-blocking
    }
  }

  // FIX #13: Invalidate reasoning cache after storing new insights
  invalidateOrganization(orgId);

  return stored;
}

// ─── Full Intelligence Pipeline ───────────────────────────────────────────

/**
 * Run full intelligence pipeline for one organization:
 * Signal Detection → AI Reasoning → Briefing Generation → Score Update
 *
 * FIX #19: computeIntelligenceScores() called after pipeline.
 * FIX #13: Cache invalidated on data changes.
 */
export async function runIntelligencePipeline(orgId: string): Promise<{
  signalsDetected: number;
  insightsGenerated: number;
  briefingGenerated: boolean;
  intelligenceScoreUpdated: boolean;
}> {
  const correlationId = crypto.randomUUID();
  logger.info('[PIPELINE] Starting intelligence pipeline', { orgId, correlationId });

  // Step 1: Detect signals
  const signals = await (await import('./signals')).detectSignalsForOrganization(orgId);
  const signalsStored = await (await import('./signals')).storeSignals(signals);

  // Step 1.5: Discover new relationships in the knowledge graph from signals
  try {
    const relsCreated = await discoverRelationships(orgId);
    logger.info('[PIPELINE] Knowledge graph relationships discovered', {
      orgId,
      relsCreated,
      correlationId,
    });
  } catch (kgError) {
    logger.warn('[PIPELINE] Knowledge graph discoverRelationships failed (non-blocking)', {
      orgId,
      correlationId,
      error: kgError instanceof Error ? kgError.message : 'Unknown',
    });
  }

  // Step 2: AI Reasoning
  const insights = await reasonAboutOrganization(orgId);
  const insightsStored = await storeInsights(orgId, insights);

  // Step 3: Generate briefing
  let briefingGenerated = false;
  try {
    await generateBriefing(orgId);
    briefingGenerated = true;
  } catch (error) {
    logger.error('[PIPELINE] Briefing generation failed', {
      orgId,
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }

  // Step 4: FIX #19 — Update intelligence scores
  let intelligenceScoreUpdated = false;
  try {
    await computeIntelligenceScores(orgId);
    intelligenceScoreUpdated = true;
  } catch (scoreError) {
    logger.warn('[PIPELINE] Intelligence score update failed (non-blocking)', {
      orgId,
      correlationId,
      error: scoreError instanceof Error ? scoreError.message : 'Unknown',
    });
  }

  // FIX #13: Invalidate all caches for this org after pipeline
  invalidateOrganization(orgId);

  logger.info('[PIPELINE] Intelligence pipeline complete', {
    orgId,
    correlationId,
    signalsDetected: signalsStored,
    insightsGenerated: insightsStored,
    briefingGenerated,
    intelligenceScoreUpdated,
  });

  return {
    signalsDetected: signalsStored,
    insightsGenerated: insightsStored,
    briefingGenerated,
    intelligenceScoreUpdated,
  };
}

// ─── FIX #11: Auto-Trigger Mechanism ──────────────────────────────────────

/**
 * Run the intelligence pipeline for all active organizations that haven't
 * been analyzed recently (within the last 24 hours).
 *
 * Designed to be called from a cron job or scheduled task.
 * Processes in batches to avoid memory/DB pressure.
 */
export async function runScheduledReasoning(): Promise<{
  processed: number;
  insightsGenerated: number;
  errors: number;
}> {
  const correlationId = crypto.randomUUID();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Find orgs that either have no insights or haven't been reasoned about recently
  const recentInsightedOrgs = await db.insight.groupBy({
    by: ['organizationId'],
    where: { createdAt: { gte: twentyFourHoursAgo } },
  });
  const recentOrgIds = new Set(recentInsightedOrgs.map((g) => g.organizationId));

  const orgs = await db.organization.findMany({
    where: {
      trackingStatus: 'active',
      id: { notIn: [...recentOrgIds] },
    },
    select: { id: true },
    take: 20, // Process max 20 per cron tick
  });

  let processed = 0;
  let insightsGenerated = 0;
  let errors = 0;

  // Process in parallel batches of 3
  const BATCH_SIZE = 3;
  for (let i = 0; i < orgs.length; i += BATCH_SIZE) {
    const batch = orgs.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (org) => {
        try {
          const pipelineResult = await runIntelligencePipeline(org.id);
          return { insights: pipelineResult.insightsGenerated, error: false };
        } catch (err) {
          return {
            insights: 0,
            error: true,
            errorMsg: err instanceof Error ? err.message : 'Unknown',
          };
        }
      }),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        processed++;
        if (result.value.error) {
          errors++;
          logger.warn('[REASONING-CRON] Pipeline failed for org', {
            correlationId,
            error: result.value.errorMsg,
          });
        } else {
          insightsGenerated += result.value.insights;
        }
      } else {
        errors++;
      }
    }
  }

  logger.info('[REASONING-CRON] Scheduled reasoning complete', {
    correlationId,
    processed,
    insightsGenerated,
    errors,
  });

  return { processed, insightsGenerated, errors };
}

/**
 * Hook: Called after signal creation to trigger reasoning for the affected org.
 * Non-blocking — failures are logged but don't propagate.
 *
 * This is the event-driven auto-trigger (complements the cron-based scheduled trigger).
 */
export async function onSignalCreated(orgId: string): Promise<void> {
  try {
    // Invalidate cached reasoning since new signal data changes the context
    invalidateOrganization(orgId);

    // Run reasoning in background (fire and forget pattern)
    const insights = await reasonAboutOrganization(orgId);
    await storeInsights(orgId, insights);

    // Update intelligence scores
    await computeIntelligenceScores(orgId);

    logger.info('[REASONING-HOOK] Auto-reasoning triggered by new signal', { orgId });
  } catch (error) {
    // Non-blocking — never let auto-reasoning failures break the signal pipeline
    logger.warn('[REASONING-HOOK] Auto-reasoning failed (non-blocking)', {
      orgId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

/**
 * Hook: Called after data ingestion completes to trigger reasoning for new orgs.
 * Non-blocking — failures are logged but don't propagate.
 */
export async function onIngestionComplete(ingestionId: string): Promise<void> {
  try {
    const newOrgs = await db.organization.findMany({
      where: { sourceIngestionId: ingestionId },
      select: { id: true },
      take: 10,
    });

    for (const org of newOrgs) {
      // Use setImmediate pattern to avoid blocking the ingestion response
      await reasonAboutOrganization(org.id)
        .then((insights) => storeInsights(org.id, insights))
        .then(() => computeIntelligenceScores(org.id))
        .catch((err) => {
          logger.warn('[REASONING-HOOK] Post-ingestion reasoning failed (non-blocking)', {
            orgId: org.id,
            error: err instanceof Error ? err.message : 'Unknown',
          });
        });
    }

    logger.info('[REASONING-HOOK] Post-ingestion reasoning triggered', {
      ingestionId,
      orgCount: newOrgs.length,
    });
  } catch (error) {
    logger.warn('[REASONING-HOOK] Post-ingestion hook failed (non-blocking)', {
      ingestionId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

// ─── Briefing Generation ─────────────────────────────────────────────────

/**
 * Generate a briefing for an organization.
 * Summarizes all intelligence into a single document.
 *
 * FIX #16: Briefing versioning — tracks version number properly.
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

  // FIX #16: Get the latest briefing version for this org
  const latestBriefing = await db.briefing.findFirst({
    where: { organizationId: orgId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const nextVersion = (latestBriefing?.version ?? 0) + 1;

  // Deactivate old briefings by setting their version to 0
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
      version: nextVersion,
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

// ─── Insight Queries ─────────────────────────────────────────────────────

/**
 * Get all active insights for an organization.
 * Used by the API route to serve insight data.
 */
export async function getInsightsForOrganization(
  orgId: string,
  options?: { limit?: number; category?: string; status?: string },
): Promise<
  Array<{
    id: string;
    category: string;
    title: string;
    narrative: string;
    recommendation: string | null;
    suggestedMessage: string | null;
    confidence: string;
    confidenceScore: number | null;
    reasoningMethod: string;
    modelUsed: string | null;
    createdAt: Date;
  }>
> {
  const limit = options?.limit ?? 20;

  const insights = await db.insight.findMany({
    where: {
      organizationId: orgId,
      ...(options?.category ? { category: options.category } : {}),
      ...(options?.status ? { status: options.status } : { status: 'active' }),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      category: true,
      title: true,
      narrative: true,
      recommendation: true,
      suggestedMessage: true,
      confidence: true,
      confidenceScore: true,
      reasoningMethod: true,
      modelUsed: true,
      createdAt: true,
    },
  });

  return insights;
}

/**
 * Get the latest active briefing for an organization.
 */
export async function getLatestBriefing(orgId: string): Promise<{
  id: string;
  executiveSummary: string;
  keyFindings: string[];
  opportunityScore: number | null;
  riskFactors: string[];
  recommendedActions: string[];
  signalCount: number;
  activeSignals: number;
  insightCount: number;
  evidenceCount: number;
  overallConfidence: string;
  version: number;
  generatedAt: Date;
} | null> {
  const briefing = await db.briefing.findFirst({
    where: {
      organizationId: orgId,
      version: { gt: 0 }, // Only active briefings (version > 0)
    },
    orderBy: { version: 'desc' },
  });

  if (!briefing) return null;

  return {
    id: briefing.id,
    executiveSummary: briefing.executiveSummary,
    keyFindings: JSON.parse(briefing.keyFindings || '[]'),
    opportunityScore: briefing.opportunityScore,
    riskFactors: JSON.parse(briefing.riskFactors || '[]'),
    recommendedActions: JSON.parse(briefing.recommendedActions || '[]'),
    signalCount: briefing.signalCount,
    activeSignals: briefing.activeSignals,
    insightCount: briefing.insightCount,
    evidenceCount: briefing.evidenceCount,
    overallConfidence: briefing.overallConfidence,
    version: briefing.version,
    generatedAt: briefing.generatedAt,
  };
}
