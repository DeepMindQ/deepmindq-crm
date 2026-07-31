/**
 * GET /api/intelligence/conversation/{id}
 *
 * Intelligence API — Conversation Endpoint
 *
 * Returns AI-generated conversation briefing + learning insights.
 * Composes ConversationEngine + ContinuousLearningLoop data.
 *
 * Query params:
 *   ?include=learning — include past learning insights (optional)
 *
 * Non-throwing: always returns IntelligenceResponse envelope.
 * Follows the same pattern as the company route (reference implementation).
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ConversationEngine } from '@/lib/engines/conversation-engine';
import type { ConversationResult } from '@/lib/engines/conversation-engine';
import {
  shouldInclude,
  createResponse,
  createErrorResponse,
  computeFreshness,
} from '@/lib/intelligence-api/middleware';
import { IntelligenceErrors } from '@/lib/intelligence-api/types';
import { scrubError } from '@/lib/intelligence-api/handler';
import type { IntelligenceConversationOutput, IntelligenceBrief } from '@/lib/intelligence-api/types';
import { intelligenceGuard } from '@/lib/intelligence-api/guard';
import { logger } from '@/lib/logger';
import { runGovernanceChecks } from '@/lib/ai-governance';
import { getResearchContext } from '@/lib/intelligence-contract';

// ── Helper: Extract buyer profiles from conversation result ──────────────
function extractBuyerProfiles(
  conversationResult: ConversationResult | null,
): Array<{ role: string; concerns: string[]; motivation: string; confidence: number }> {
  if (!conversationResult || typeof conversationResult !== 'object') return [];

  const cr = conversationResult as unknown as Record<string, unknown>;

  // Try buyerPersonas field first
  if (Array.isArray(cr.buyerPersonas)) {
    return (cr.buyerPersonas as Array<Record<string, unknown>>).slice(0, 5).map(bp => ({
      role: String(bp.role || bp.title || bp.persona || 'Unknown'),
      concerns: Array.isArray(bp.concerns) ? (bp.concerns as string[]).map(String) : [],
      motivation: String(bp.motivation || bp.goal || bp.driver || ''),
      confidence: Number(bp.confidence ?? cr.confidenceScore ?? cr.confidence ?? 0),
    }));
  }

  // Try stakeholders field
  if (Array.isArray(cr.stakeholders)) {
    return (cr.stakeholders as Array<Record<string, unknown>>).slice(0, 5).map(s => ({
      role: String(s.role || s.title || 'Unknown'),
      concerns: Array.isArray(s.concerns) ? (s.concerns as string[]).map(String)
        : Array.isArray(s.objections) ? (s.objections as string[]).map(String)
        : [],
      motivation: String(s.motivation || s.goal || s.interest || ''),
      confidence: Number(s.confidence ?? cr.confidenceScore ?? cr.confidence ?? 0),
    }));
  }

  // Fallback: derive from key contacts and talking points
  const talkingPoints = Array.isArray(cr.talkingPoints)
    ? (cr.talkingPoints as Array<{ topic?: string; persona?: string }>)
    : [];
  const uniquePersonas = [...new Set(talkingPoints.map(tp => tp.persona).filter(Boolean))];
  if (uniquePersonas.length > 0) {
    return uniquePersonas.slice(0, 5).map(persona => ({
      role: String(persona),
      concerns: talkingPoints
        .filter(tp => tp.persona === persona)
        .map(tp => tp.topic || '')
        .filter(Boolean),
      motivation: '',
      confidence: Number(cr.confidenceScore ?? cr.confidence ?? 0) * 0.8,
    }));
  }

  return [];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const startedAt = Date.now();
  const requestedAt = new Date();

  const guardResult = await intelligenceGuard(request, params, 'conversation');
  if (guardResult instanceof Response) return guardResult;
  const { companyId, correlationId, responseHeaders } = guardResult;

  // Ticket 3: Run real governance check for response metadata (requires DB)
  let governanceMeta: { passed: boolean; generationType: string; checks: Record<string, { passed: boolean; message: string }> } | undefined;
  try {
    // Only run governance check against real PostgreSQL — skip for file-based/test DBs
    if (process.env.DATABASE_URL?.startsWith('postgres')) {
      const researchCtx = await getResearchContext(companyId);
      const govResult = await runGovernanceChecks({ companyId, generationType: 'conversation_plan', researchContext: researchCtx });
      governanceMeta = {
        passed: govResult.passed,
        generationType: 'conversation_plan',
        checks: Object.fromEntries(Object.entries(govResult.checks).map(([k, v]) => [k, { passed: v.passed, message: v.message }])),
      };
    }
  } catch {
    // Governance metadata is optional — degrade gracefully
  }

  logger.info('[intelligence/conversation] Processing', {
    companyId,
    includes: Array.from(guardResult.includes),
  });

  // ── Step 1: Load company from DB (for freshness) ────────────────────────
  let company: Record<string, unknown> | null = null;
  try {
    company = await db.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        lastEnrichedAt: true,
        lastActivityAt: true,
      },
    });
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[intelligence/conversation] DB lookup failed', { companyId, error: rawMessage });
    return Response.json(
      createErrorResponse('conversation', companyId, `Company lookup failed: ${scrubError(rawMessage)}`, IntelligenceErrors.INTELLIGENCE_UNAVAILABLE, Date.now() - startedAt, guardResult.includes),
      { status: 500, headers: responseHeaders },
    );
  }

  if (!company) {
    return Response.json(
      createErrorResponse('conversation', companyId, 'Company not found', IntelligenceErrors.COMPANY_NOT_FOUND, Date.now() - startedAt, guardResult.includes),
      { status: 404, headers: responseHeaders },
    );
  }

  // ── Step 2: Determine which includes are active ──────────────────────────
  const wantsConversation = guardResult.includes.size === 0
    || shouldInclude(guardResult.includes, 'talkingPoints')
    || shouldInclude(guardResult.includes, 'objections')
    || shouldInclude(guardResult.includes, 'buyerProfiles');
  const wantsLearning = shouldInclude(guardResult.includes, 'learning');

  // ── Step 3: Run engine + load learning insights in parallel ────────
  let conversationResult: ConversationResult | null = null;
  let learningEvents: Array<{ id: string; learnedInsight: string; companyId: string | null; applicableContext: string; createdAt: Date }> = [];

  try {
    const results = await Promise.all([
      wantsConversation
        ? ConversationEngine.brief({ companyId, skipNarrative: true })
        : Promise.resolve(null as ConversationResult | null),
      shouldInclude(guardResult.includes, 'learning')
        ? db.learningEvent.findMany({
            where: { companyId },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
              id: true,
              learnedInsight: true,
              companyId: true,
              applicableContext: true,
              createdAt: true,
            },
          }).catch(err => {
            logger.warn('[intelligence/conversation] Failed to load learning insights', {
              companyId,
              error: err instanceof Error ? err.message : String(err),
            });
            return [];
          })
        : Promise.resolve([] as Array<{ id: string; learnedInsight: string; companyId: string | null; applicableContext: string; createdAt: Date }>),
    ]);
    conversationResult = results[0];
    learningEvents = results[1];
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : String(err);
    logger.warn('[intelligence/conversation] Engine threw', { companyId, error: rawMessage });
    return Response.json(
      createErrorResponse('conversation', companyId, scrubError(rawMessage), IntelligenceErrors.ENGINE_FAILED, Date.now() - startedAt, guardResult.includes),
      { status: 502, headers: responseHeaders },
    );
  }

  if (conversationResult && !conversationResult.success) {
    logger.warn('[intelligence/conversation] ConversationEngine failed', {
      companyId,
      error: conversationResult.error,
    });
    return Response.json(
      createErrorResponse('conversation', companyId, scrubError(conversationResult.error || 'Conversation engine failed'), IntelligenceErrors.ENGINE_FAILED, Date.now() - startedAt, guardResult.includes),
      { status: 502, headers: responseHeaders },
    );
  }

  // ── Step 4: Build brief from conversation result (only when engine ran) ─────
  let brief: IntelligenceBrief | undefined;
  let keyThemes: string[] = [];
  let recommendations: string[] = [];
  let risks: string[] = [];

  if (conversationResult && conversationResult.success) {
    const cr = conversationResult as unknown as Record<string, unknown>;
    const summary = (cr.summary as string) || (cr.overallNarrative as string) || '';
    keyThemes = Array.isArray(cr.talkingPoints)
      ? ((cr.talkingPoints as Array<{ topic?: string }>).map((tp) => tp.topic || '').filter(Boolean))
      : [];
    recommendations = Array.isArray(cr.keyRecommendations)
      ? ((cr.keyRecommendations as Array<{ recommendation?: string }>).map((r) => r.recommendation || '').filter(Boolean))
      : [];
    risks = Array.isArray(cr.risks)
      ? ((cr.risks as Array<{ risk?: string }>).map((r) => r.risk || '').filter(Boolean))
      : [];

    brief = {
      briefType: 'conversation_brief',
      content: [summary, ...keyThemes.map(t => `- ${t}`), ...recommendations.map(r => `- ${r}`)].join('\n'),
      sections: [{
        heading: 'Conversation Brief',
        body: summary || 'No summary available.',
        confidence: (cr.confidenceScore as number) ?? (cr.confidence as number) ?? 0,
        citations: [],
      }],
      citations: [],
      evidenceChain: { evidences: [], aggregateConfidence: 0, coverage: 0, gaps: [], freshnessScore: 0 },
      wordCount: summary.split(/\s+/).filter(Boolean).length,
      modelUsed: 'conversation-engine',
      confidence: (cr.confidenceScore as number) ?? (cr.confidence as number) ?? 0,
      durationMs: 0,
      tokensUsed: 0,
      costUsd: 0,
      warnings: risks.length > 0 ? risks.map(r => `Risk: ${r}`) : [],
    };
  }

  // ── Step 5: Compose response data ────────────────────────────────────────
  const data: IntelligenceConversationOutput = {
    companyId,
    ...(conversationResult ? { conversation: conversationResult } : {}),
    ...(brief ? { brief } : {}),
    ...(shouldInclude(guardResult.includes, 'talkingPoints') && {
      talkingPoints: keyThemes.map(t => ({ topic: t, context: '', confidence: brief?.confidence ?? 0 })),
    }),
    ...(shouldInclude(guardResult.includes, 'objections') && {
      objections: risks.map(r => ({ objection: r, rebuttal: '', confidence: brief?.confidence ?? 0 })),
    }),
    ...(shouldInclude(guardResult.includes, 'buyerProfiles') && {
      buyerProfiles: extractBuyerProfiles(conversationResult),
    }),
    ...(wantsLearning && learningEvents.length > 0 ? {
      pastLearnings: learningEvents.map((e) => ({
        id: e.id,
        insight: e.learnedInsight,
        sourceCompany: e.companyId || 'unknown',
        applicableContext: e.applicableContext || '',
        createdAt: e.createdAt.toISOString(),
      })),
    } : {}),
  };

  const confidence = brief?.confidence ?? 0;
  const freshness = computeFreshness(company as Parameters<typeof computeFreshness>[0]);
  const durationMs = Date.now() - startedAt;

  logger.info('[intelligence/conversation] Response assembled', {
    companyId,
    durationMs,
    confidence,
    learningCount: learningEvents.length,
    freshnessLevel: freshness.level,
  });

  return Response.json(
    createResponse('conversation', companyId, data, {
      durationMs,
      includes: guardResult.includes,
      cached: false,
      confidence,
      freshness,
      requestedAt,
      respondedAt: new Date(),
      ...(governanceMeta && { governance: governanceMeta }),
    }),
    { headers: { ...responseHeaders, 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' } },
  );
}
