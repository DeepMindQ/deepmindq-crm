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
import type { IntelligenceConversationOutput, IntelligenceBrief } from '@/lib/intelligence-api/types';
import { intelligenceGuard } from '@/lib/intelligence-api/guard';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const startedAt = Date.now();
  const requestedAt = new Date();

  const { id: companyId } = await params;

  if (!companyId) {
    return Response.json(
      createErrorResponse('conversation', '', 'Company ID is required', 'MISSING_COMPANY_ID'),
      { status: 400 },
    );
  }

  const guardResult = await intelligenceGuard(request, params, 'conversation');
  if (guardResult instanceof Response) return guardResult;
  const { correlationId, responseHeaders } = guardResult;

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
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[intelligence/conversation] DB lookup failed', { companyId, error: message });
    return Response.json(
      createErrorResponse('conversation', companyId, `Company lookup failed: ${message}`, 'INTELLIGENCE_UNAVAILABLE', Date.now() - startedAt, guardResult.includes),
      { status: 500, headers: responseHeaders },
    );
  }

  if (!company) {
    return Response.json(
      createErrorResponse('conversation', companyId, 'Company not found', 'COMPANY_NOT_FOUND', Date.now() - startedAt, guardResult.includes),
      { status: 404, headers: responseHeaders },
    );
  }

  // ── Step 2: Run engine (try/catch for clean typing) ─────────────────────
  let conversationResult: ConversationResult;
  try {
    conversationResult = await ConversationEngine.brief({ companyId, skipNarrative: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('[intelligence/conversation] ConversationEngine threw', { companyId, error: message });
    return Response.json(
      createErrorResponse('conversation', companyId, message, 'ENGINE_TIMEOUT', Date.now() - startedAt, guardResult.includes),
      { status: 502, headers: responseHeaders },
    );
  }

  if (!conversationResult.success) {
    logger.warn('[intelligence/conversation] ConversationEngine failed', {
      companyId,
      error: conversationResult.error,
    });
    return Response.json(
      createErrorResponse('conversation', companyId, conversationResult.error || 'Conversation engine failed', 'ENGINE_TIMEOUT', Date.now() - startedAt, guardResult.includes),
      { status: 502, headers: responseHeaders },
    );
  }

  // ── Step 3: Load learning insights (best-effort, parallel-safe) ──────────
  let learningEvents: Array<{ id: string; learnedInsight: string; companyId: string | null; applicableContext: string; createdAt: Date }> = [];
  if (shouldInclude(guardResult.includes, 'learning')) {
    try {
      learningEvents = await db.learningEvent.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    } catch (err) {
      logger.warn('[intelligence/conversation] Failed to load learning insights', {
        companyId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── Step 4: Build brief from conversation result ────────────────────────
  const cr = conversationResult as unknown as Record<string, unknown>;
  const summary = (cr.summary as string) || (cr.overallNarrative as string) || '';
  const keyThemes = Array.isArray(cr.talkingPoints)
    ? ((cr.talkingPoints as Array<{ topic?: string }>).map((tp) => tp.topic || '').filter(Boolean))
    : [];
  const recommendations = Array.isArray(cr.keyRecommendations)
    ? ((cr.keyRecommendations as Array<{ recommendation?: string }>).map((r) => r.recommendation || '').filter(Boolean))
    : [];
  const risks = Array.isArray(cr.risks)
    ? ((cr.risks as Array<{ risk?: string }>).map((r) => r.risk || '').filter(Boolean))
    : [];

  const brief: IntelligenceBrief = {
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

  // ── Step 5: Compose response data ────────────────────────────────────────
  const data: IntelligenceConversationOutput = {
    companyId,
    conversation: conversationResult,
    brief,
    pastLearnings: learningEvents.map((e) => ({
      id: e.id,
      insight: e.learnedInsight,
      sourceCompany: e.companyId || 'unknown',
      applicableContext: e.applicableContext || '',
      createdAt: e.createdAt.toISOString(),
    })),
  };

  const confidence = brief.confidence;
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
    }),
    { headers: responseHeaders },
  );
}
