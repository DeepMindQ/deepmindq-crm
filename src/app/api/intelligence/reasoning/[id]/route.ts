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
  shouldInclude,
  shouldIncludeAny,
  createResponse,
  createErrorResponse,
  computeFreshness,
  runGovernanceMetadata,
  SECURITY_HEADERS,
} from '@/lib/intelligence-api/middleware';
import { IntelligenceErrors } from '@/lib/intelligence-api/types';
import type { IntelligenceReasoningOutput, ReasoningStep } from '@/lib/intelligence-api/types';
import { scrubError } from '@/lib/intelligence-api/handler';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

const startedAt = Date.now();
  const requestedAt = new Date();

  // ── Intelligence Guard: validation + rate limiting + correlation-id ─────
  const guardResult = await intelligenceGuard(request, params, 'reasoning');
  if (guardResult instanceof Response) return guardResult;
  const { companyId, correlationId, responseHeaders } = guardResult;

  const governanceMeta = await runGovernanceMetadata(companyId, 'reasoning');

  // ── Step 2: Gate — only run engine when includes demand it ─────────────
  const shouldRunEngine =
    guardResult.includes.size === 0 ||
    shouldIncludeAny(guardResult.includes, 'steps', 'impact', 'recommendations');

  const includeSteps = guardResult.includes.size === 0 || shouldInclude(guardResult.includes, 'steps');
  const includeImpact = shouldInclude(guardResult.includes, 'impact');
  const includeRecommendations = shouldInclude(guardResult.includes, 'recommendations');

  // F2: Step pagination — respect page/limit from query params
  const pageParam = request.nextUrl.searchParams.get('page');
  const limitParam = request.nextUrl.searchParams.get('limit');
  const stepPage = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;
  const stepLimit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10) || 50)) : 50;

  logger.info('[intelligence/reasoning] Processing', {
    companyId,
    correlationId,
    includeSteps,
    includes: Array.from(guardResult.includes),
    stepPage,
    stepLimit,
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
      createErrorResponse('reasoning', companyId, `Company lookup failed: ${scrubError(rawMessage)}`, IntelligenceErrors.INTELLIGENCE_UNAVAILABLE, Date.now() - startedAt, guardResult.includes),
      { status: 500, headers: { ...responseHeaders, ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8' } },
    );
  }

  if (!company) {
    return Response.json(
      createErrorResponse('reasoning', companyId, 'Company not found', IntelligenceErrors.COMPANY_NOT_FOUND, Date.now() - startedAt, guardResult.includes),
      { status: 404, headers: { ...responseHeaders, ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8' } },
    );
  }

  if (!shouldRunEngine) {
    // No engine-produced data requested → return minimal response immediately
    const freshness = computeFreshness(company);
    const durationMs = Date.now() - startedAt;
    const minimalData: IntelligenceReasoningOutput = {
      companyId,
      reasoningContextId: '',
      overallConfidence: 0,
      winProbability: 0,
      totalSteps: 0,
      completedSteps: 0,
      failedSteps: 0,
      totalAIcalls: 0,
      totalTokensUsed: 0,
      totalCostUsd: 0,
      durationMs,
      summary: null,
      steps: [],
    };
    logger.info('[intelligence/reasoning] Skipped engine — no matching includes', { companyId, includes: Array.from(guardResult.includes) });
    return Response.json(
      createResponse('reasoning', companyId, minimalData, {
        durationMs,
        includes: guardResult.includes,
        cached: false,
        confidence: 0,
        freshness,
        requestedAt,
        respondedAt: new Date(),
      }),
      { headers: { ...responseHeaders, ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' } },
    );
  }

  // ── Step 3: Run the reasoning engine ─────────────────────────────────────
  // Engine manages its own timeout internally
  let result: ReasoningResult;
  try {
    result = await EnterpriseReasoningEngine.build(companyId);
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : String(err);
    logger.error('[intelligence/reasoning] Engine build threw', { companyId, correlationId, error: rawMessage });
    return Response.json(
      createErrorResponse('reasoning', companyId, scrubError(rawMessage), IntelligenceErrors.ENGINE_FAILED, Date.now() - startedAt, guardResult.includes),
      { status: 502, headers: { ...responseHeaders, ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8' } },
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
        IntelligenceErrors.INTELLIGENCE_UNAVAILABLE,
        Date.now() - startedAt,
        guardResult.includes,
      ),
      { status: 502, headers: { ...responseHeaders, ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8' } },
    );
  }

  // ── Step 4: Fetch reasoning steps ────────────────────────────────────────
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

      steps = dbSteps
        .slice((stepPage - 1) * stepLimit, stepPage * stepLimit)
        .map((step) => ({
          stepNumber: step.stepNumber,
          stepName: step.stepName,
          status: step.output !== null && step.output !== undefined && String(step.output).trim() !== ''
            ? 'completed' as const
            : step.aiCalls > 0
              ? 'completed' as const
              : 'pending' as const,
          output: (() => { try { return typeof step.output === 'string' ? step.output : JSON.stringify(step.output); } catch { return String(step.output ?? ''); } })(),
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

  // ── Step 5: Extract impact data from high-confidence steps ─────────────
  const impactSteps = steps.filter(s =>
    s.confidence >= 0.6 &&
    (s.stepName.toLowerCase().includes('impact') ||
     s.stepName.toLowerCase().includes('financial') ||
     s.stepName.toLowerCase().includes('risk') ||
     s.stepName.toLowerCase().includes('value') ||
     (s.output && (s.output.toLowerCase().includes('impact') || s.output.toLowerCase().includes('revenue') || s.output.toLowerCase().includes('risk'))))
  );

  // ── Step 6: Extract recommendations from action-oriented steps ───────────
  const recommendationSteps = steps.filter(s =>
    s.confidence >= 0.5 &&
    (s.stepName.toLowerCase().includes('recommend') ||
     s.stepName.toLowerCase().includes('action') ||
     s.stepName.toLowerCase().includes('next_step') ||
     s.stepName.toLowerCase().includes('strategy') ||
     (s.output && (s.output.toLowerCase().includes('recommend') || s.output.toLowerCase().includes('suggest') || s.output.toLowerCase().includes('should'))))
  );

  // ── Step 7: Build response data ─────────────────────────────────────────
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
    durationMs: Date.now() - startedAt,  // total route duration (includes engine build time)
    summary: steps.length > 0 ? `Completed ${result.completedSteps}/${result.totalSteps} reasoning steps with ${result.overallConfidence.toFixed(1)}% confidence` : null,
    steps,
    ...(includeImpact ? {
      impact: impactSteps.map(s => ({
        stepNumber: s.stepNumber,
        stepName: s.stepName,
        summary: s.summary || (s.output ? s.output.slice(0, 300) : null),
        confidence: s.confidence,
      })),
    } : {}),
    ...(includeRecommendations ? {
      recommendations: recommendationSteps.map(s => ({
        stepNumber: s.stepNumber,
        stepName: s.stepName,
        summary: s.summary || (s.output ? s.output.slice(0, 300) : null),
        confidence: s.confidence,
      })),
    } : {}),
  };

  const freshness = computeFreshness(company);
  const durationMs = Date.now() - startedAt;

  logger.info('[intelligence/reasoning] Response assembled', {
    companyId,
    correlationId,
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
      ...(governanceMeta && { governance: governanceMeta }),
    }),
    { headers: { ...responseHeaders, ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' } },
  );
}
