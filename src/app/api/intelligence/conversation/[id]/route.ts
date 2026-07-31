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

  // Try buyerProfile field (singular object — ConversationResult.buyerProfile)
  if (cr.buyerProfile && typeof cr.buyerProfile === 'object') {
    const bp = cr.buyerProfile as Record<string, unknown>;
    return [{
      role: String(bp.role || bp.name || 'Unknown'),
      concerns: Array.isArray(bp.detectedPriorities) ? (bp.detectedPriorities as string[]).map(String) : [],
      motivation: String(bp.buyerRole || ''),
      confidence: Number(bp.influenceScore ?? cr.confidenceScore ?? cr.confidence ?? 0) / 100,
    }];
  }

  // Try keyStakeholders (string[] of stakeholder names)
  if (Array.isArray(cr.keyStakeholders)) {
    return (cr.keyStakeholders as string[]).slice(0, 5).map(s => ({
      role: String(s),
      concerns: [],
      motivation: '',
      confidence: Number(cr.confidenceScore ?? cr.confidence ?? 0) / 100,
    }));
  }

  // Fallback: derive from talking points (TalkingPoint has `point` field, not `topic`)
  const talkingPoints = Array.isArray(cr.talkingPoints)
    ? (cr.talkingPoints as Array<Record<string, unknown>>)
    : [];
  if (talkingPoints.length > 0) {
    return [{
      role: 'General Contact',
      concerns: talkingPoints.map(tp => String(tp.point || '')).filter(Boolean),
      motivation: '',
      confidence: Number(cr.confidenceScore ?? cr.confidence ?? 0) / 100 * 0.8,
    }];
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
    const summary = (cr.briefingNarrative as string) || (cr.companyContext as string) || (cr.meetingObjective as string) || '';
    keyThemes = Array.isArray(cr.talkingPoints)
      ? ((cr.talkingPoints as Array<{ point?: string }>).map((tp) => tp.point || '').filter(Boolean))
      : [];
    recommendations = Array.isArray(cr.postMeetingActions)
      ? ((cr.postMeetingActions as string[]).map(String).filter(Boolean))
      : [];
    risks = Array.isArray(cr.objectionsToPrepare)
      ? ((cr.objectionsToPrepare as Array<{ objection?: string }>).map((o) => o.objection || '').filter(Boolean))
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
    ...(shouldInclude(guardResult.includes, 'objections') && conversationResult && typeof conversationResult === 'object' ? {
      objections: ((conversationResult as unknown as Record<string, unknown>).objectionsToPrepare as Array<Record<string, unknown>> || []).map((o) => ({
        objection: String(o.objection || ''),
        rebuttal: String(o.preparedResponse || ''),
        confidence: Number(
          o.probability === 'high' ? 0.9 :
          o.probability === 'medium' ? 0.6 :
          o.probability === 'low' ? 0.3 :
          brief?.confidence ?? 0
        ),
      })),
    } : {}),
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
