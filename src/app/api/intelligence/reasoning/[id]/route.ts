/**
 * GET /api/intelligence/reasoning/{id}
 *
 * Intelligence API — Reasoning Endpoint
 *
 * Runs the EnterpriseReasoningEngine for a company and returns
 * the full reasoning context with all 30 steps, confidence scores,
 * win probability, and cost metrics.
 *
 * Query params:
 *   ?include=steps — include individual step details (default: included when no include specified)
 *
 * Non-throwing: always returns IntelligenceResponse envelope.
 * Follows the same pattern as the company route (reference implementation).
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { EnterpriseReasoningEngine } from '@/lib/enterprise-reasoning-engine';
import type { ReasoningResult } from '@/lib/enterprise-reasoning-engine';
import { intelligenceGuard } from '@/lib/intelligence-api/guard';
import {
  createResponse,
  createErrorResponse,
  computeFreshness,
} from '@/lib/intelligence-api/middleware';
import type { IntelligenceReasoningOutput, ReasoningStep } from '@/lib/intelligence-api/types';
import { scrubError } from '@/lib/intelligence-api/handler';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const startedAt = Date.now();
  const requestedAt = new Date();

  // ── Intelligence Guard: validation + rate limiting + correlation-id ─────
  const guardResult = await intelligenceGuard(request, params, 'reasoning');
  if (guardResult instanceof Response) return guardResult;
  const { companyId, correlationId, responseHeaders } = guardResult;

  // Parse include params — "steps" is included by default when no include is specified
  const includeSteps = guardResult.includes.size === 0 || guardResult.includes.has('steps');

  logger.info('[intelligence/reasoning] Processing', {
    companyId,
    includeSteps,
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
    logger.error('[intelligence/reasoning] DB lookup failed', { companyId, error: rawMessage });
    return Response.json(
      createErrorResponse('reasoning', companyId, `Company lookup failed: ${scrubError(rawMessage)}`, 'INTELLIGENCE_UNAVAILABLE', Date.now() - startedAt, guardResult.includes),
      { status: 500, headers: responseHeaders },
    );
  }

  if (!company) {
    return Response.json(
      createErrorResponse('reasoning', companyId, 'Company not found', 'COMPANY_NOT_FOUND', Date.now() - startedAt, guardResult.includes),
      { status: 404, headers: responseHeaders },
    );
  }

  // ── Step 2: Run the reasoning engine ─────────────────────────────────────
  let result: ReasoningResult;
  try {
    result = await EnterpriseReasoningEngine.build(companyId);
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : String(err);
    logger.error('[intelligence/reasoning] Engine build threw', { companyId, error: rawMessage });
    return Response.json(
      createErrorResponse('reasoning', companyId, scrubError(rawMessage), 'ENGINE_TIMEOUT', Date.now() - startedAt, guardResult.includes),
      { status: 502, headers: responseHeaders },
    );
  }

  if (!result.success || !result.reasoningContextId) {
    logger.error('[intelligence/reasoning] Engine build failed', {
      companyId,
      error: result.error,
      durationMs: Date.now() - startedAt,
    });

    return Response.json(
      createErrorResponse(
        'reasoning',
        companyId,
        scrubError(result.error || 'Reasoning engine failed'),
        'INTELLIGENCE_UNAVAILABLE',
        Date.now() - startedAt,
        guardResult.includes,
      ),
      { status: 502, headers: responseHeaders },
    );
  }

  // ── Step 3: Fetch reasoning steps ────────────────────────────────────────
  let steps: ReasoningStep[] = [];

  if (includeSteps) {
    try {
      const dbSteps = await db.reasoningStep.findMany({
        where: { reasoningContextId: result.reasoningContextId },
        orderBy: { stepNumber: 'asc' },
        select: {
          stepNumber: true,
          stepName: true,
          output: true,
          summary: true,
          confidence: true,
          aiCalls: true,
          tokensUsed: true,
          costUsd: true,
          durationMs: true,
        },
      });

      steps = dbSteps.map((step) => ({
        stepNumber: step.stepNumber,
        stepName: step.stepName,
        status: step.confidence > 0.15 ? 'completed' as const : 'failed' as const,
        output: typeof step.output === 'string' ? step.output : JSON.stringify(step.output),
        summary: step.summary,
        confidence: step.confidence,
        durationMs: step.durationMs,
        aiCalls: step.aiCalls,
        tokensUsed: step.tokensUsed,
        costUsd: step.costUsd,
      }));
    } catch (err) {
      logger.warn('[intelligence/reasoning] Failed to fetch reasoning steps', {
        companyId,
        contextId: result.reasoningContextId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── Step 4: Build response data ─────────────────────────────────────────
  const data: IntelligenceReasoningOutput = {
    companyId: result.companyId,
    reasoningContextId: result.reasoningContextId,
    overallConfidence: result.overallConfidence,
    winProbability: result.winProbability ?? 0,
    totalSteps: result.totalSteps,
    completedSteps: result.completedSteps,
    failedSteps: result.failedSteps,
    totalAIcalls: result.totalAIcalls,
    totalTokensUsed: result.totalTokensUsed,
    totalCostUsd: result.totalCostUsd,
    durationMs: result.durationMs + (Date.now() - startedAt),
    summary: steps.length > 0
      ? `Completed ${result.completedSteps}/${result.totalSteps} reasoning steps with ${result.overallConfidence.toFixed(1)}% confidence`
      : null,
    steps,
  };

  const freshness = computeFreshness(company as Parameters<typeof computeFreshness>[0]);
  const durationMs = Date.now() - startedAt;

  logger.info('[intelligence/reasoning] Response assembled', {
    companyId,
    durationMs,
    stepsCount: steps.length,
    confidence: result.overallConfidence,
    freshnessLevel: freshness.level,
  });

  return Response.json(
    createResponse('reasoning', companyId, data, {
      durationMs,
      includes: guardResult.includes,
      cached: result.durationMs === 0, // engine skipped rebuild → cached
      confidence: result.overallConfidence,
      freshness,
      requestedAt,
      respondedAt: new Date(),
    }),
    { headers: { ...responseHeaders, 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' } },
  );
}
