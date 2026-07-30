/**
 * GET /api/intelligence/action/{id}
 *
 * Intelligence API — Action Endpoint
 *
 * Returns recommended actions + learning insights for a company.
 * Composes ActionEngine + ContinuousLearningLoop data.
 *
 * Query params:
 *   ?include=learning — include learning insights (optional)
 *
 * Non-throwing: always returns IntelligenceResponse envelope.
 * Follows the same pattern as the company route (reference implementation).
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ActionEngine } from '@/lib/engines/action-engine';
import type { ActionResult } from '@/lib/engines/action-engine';
import {
  shouldInclude,
  createResponse,
  createErrorResponse,
  computeFreshness,
} from '@/lib/intelligence-api/middleware';
import type { IntelligenceActionOutput } from '@/lib/intelligence-api/types';
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
      createErrorResponse('action', '', 'Company ID is required', 'MISSING_COMPANY_ID'),
      { status: 400 },
    );
  }

  const guardResult = await intelligenceGuard(request, params, 'action');
  if (guardResult instanceof Response) return guardResult;
  const { correlationId, responseHeaders } = guardResult;

  logger.info('[intelligence/action] Processing', {
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
    logger.error('[intelligence/action] DB lookup failed', { companyId, error: message });
    return Response.json(
      createErrorResponse('action', companyId, `Company lookup failed: ${message}`, 'INTELLIGENCE_UNAVAILABLE', Date.now() - startedAt, guardResult.includes),
      { status: 500, headers: responseHeaders },
    );
  }

  if (!company) {
    return Response.json(
      createErrorResponse('action', companyId, 'Company not found', 'COMPANY_NOT_FOUND', Date.now() - startedAt, guardResult.includes),
      { status: 404, headers: responseHeaders },
    );
  }

  // ── Step 2: Run engine (try/catch for clean typing) ─────────────────────
  let actionResult: ActionResult;
  try {
    actionResult = await ActionEngine.recommend({ companyId, skipNarrative: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('[intelligence/action] ActionEngine threw', { companyId, error: message });
    return Response.json(
      createErrorResponse('action', companyId, message, 'ENGINE_TIMEOUT', Date.now() - startedAt, guardResult.includes),
      { status: 502, headers: responseHeaders },
    );
  }

  if (!actionResult.success) {
    logger.warn('[intelligence/action] ActionEngine failed', {
      companyId,
      error: actionResult.error,
    });
    return Response.json(
      createErrorResponse('action', companyId, actionResult.error || 'Action engine failed', 'ENGINE_TIMEOUT', Date.now() - startedAt, guardResult.includes),
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
      logger.warn('[intelligence/action] Failed to load learning insights', {
        companyId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── Step 4: Compose response data ────────────────────────────────────────
  const data: IntelligenceActionOutput = {
    companyId,
    actions: actionResult,
    learningInsights: learningEvents.map((e) => ({
      id: e.id,
      insight: e.learnedInsight,
      sourceCompany: e.companyId || 'unknown',
      applicableContext: e.applicableContext || '',
      createdAt: e.createdAt.toISOString(),
    })),
  };

  const confidence = (actionResult as unknown as Record<string, unknown>).confidence as number ?? 0;
  const freshness = computeFreshness(company as Parameters<typeof computeFreshness>[0]);
  const durationMs = Date.now() - startedAt;

  logger.info('[intelligence/action] Response assembled', {
    companyId,
    durationMs,
    confidence,
    learningCount: learningEvents.length,
    freshnessLevel: freshness.level,
  });

  return Response.json(
    createResponse('action', companyId, data, {
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
