/**
 * GET /api/intelligence/opportunity/{id}
 *
 * Intelligence API — Opportunity Endpoint
 *
 * Composes ScoringEngine + EnterpriseReasoningEngine + ActionEngine + FusionResults
 * into a unified IntelligenceOpportunity response with scores, win probability,
 * fusion matches, and recommended actions.
 *
 * Query params:
 *   ?include=scores   — include scoring data (default when no includes)
 *   ?include=fusion   — include fusion matches (default when no includes)
 *   ?include=capabilities — include capabilities (not yet implemented)
 *
 * Non-throwing: always returns IntelligenceResponse envelope.
 * Follows the same pattern as the company route (reference implementation).
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ScoringEngine } from '@/lib/engines/scoring-engine';
import type { RevenueScore } from '@/lib/engines/scoring-engine';
import { ActionEngine } from '@/lib/engines/action-engine';
import type { ActionResult } from '@/lib/engines/action-engine';
import { EnterpriseReasoningEngine } from '@/lib/enterprise-reasoning-engine';
import type { ReasoningResult } from '@/lib/enterprise-reasoning-engine';
import {
  createResponse,
  createErrorResponse,
  computeFreshness,
  shouldInclude,
} from '@/lib/intelligence-api/middleware';
import type {
  IntelligenceOpportunity,
} from '@/lib/intelligence-api/types';
import { scrubError } from '@/lib/intelligence-api/handler';
import { intelligenceGuard } from '@/lib/intelligence-api/guard';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const startedAt = Date.now();
  const requestedAt = new Date();

  const guardResult = await intelligenceGuard(request, params, 'opportunity');
  if (guardResult instanceof Response) return guardResult;
  const { companyId, correlationId, responseHeaders } = guardResult;

  logger.info('[intelligence/opportunity] Processing', {
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
        accountPriorityScore: true,
        priorityTier: true,
      },
    });
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[intelligence/opportunity] DB lookup failed', { companyId, error: rawMessage });
    return Response.json(
      createErrorResponse('opportunity', companyId, `Company lookup failed: ${scrubError(rawMessage)}`, 'INTELLIGENCE_UNAVAILABLE', Date.now() - startedAt, guardResult.includes),
      { status: 500, headers: responseHeaders },
    );
  }

  if (!company) {
    return Response.json(
      createErrorResponse('opportunity', companyId, 'Company not found', 'COMPANY_NOT_FOUND', Date.now() - startedAt, guardResult.includes),
      { status: 404, headers: responseHeaders },
    );
  }

  // ── Step 2: Determine which engines to run based on ?include ───────────
  const runScores = guardResult.includes.size === 0 || shouldInclude(guardResult.includes, 'scores');
  const runFusion = guardResult.includes.size === 0 || shouldInclude(guardResult.includes, 'fusion');

  // ── Step 3: Run engines in parallel (non-throwing) ──────────────────────
  // ScoringEngine runs conditionally; reasoning + actions always run.
  const [reasoningResult, actionResult] = await Promise.allSettled<[
    Promise<ReasoningResult>,
    Promise<ActionResult>,
  ]>([
    EnterpriseReasoningEngine.build(companyId),
    ActionEngine.recommend({ companyId, skipNarrative: true }),
  ]);

  let scoring: RevenueScore | null = null;
  if (runScores) {
    try {
      scoring = await ScoringEngine.score({ companyId, skipNarrative: true });
    } catch (err) {
      logger.warn('[intelligence/opportunity] ScoringEngine threw', {
        companyId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Extract results safely
  const reasoning = reasoningResult.status === 'fulfilled' ? reasoningResult.value : null;
  const actions = actionResult.status === 'fulfilled' ? actionResult.value : null;

  if (scoring && !scoring.success) {
    logger.warn('[intelligence/opportunity] ScoringEngine failed', {
      companyId,
      error: scoring.error,
    });
  }
  if (reasoning && !reasoning.success) {
    logger.warn('[intelligence/opportunity] ReasoningEngine failed', {
      companyId,
      error: reasoning.error,
    });
  }
  if (actions && !actions.success) {
    logger.warn('[intelligence/opportunity] ActionEngine failed', {
      companyId,
      error: actions.error,
    });
  }

  // ── Step 4: Load fusion results (only when ?include=fusion or empty includes) ──
  let fusionData: IntelligenceOpportunity['fusion'] = undefined;
  if (runFusion) {
    try {
      const fusionResults = await db.fusionResult.findMany({
        where: { companyId },
        orderBy: { fusionScore: 'desc' },
        take: 10,
        select: {
          signalIds: true,
          capabilityIds: true,
          fusionScore: true,
          businessProblem: true,
          recommendedCapability: true,
          relevantCaseStudy: true,
          proofPoints: true,
          confidenceScore: true,
        },
      });

      fusionData = fusionResults.map((fr) => ({
        externalSignal: Array.isArray(fr.signalIds) ? (fr.signalIds as string[]).join(', ') : '',
        internalCapability: Array.isArray(fr.capabilityIds) ? (fr.capabilityIds as string[]).join(', ') : '',
        fusionScore: fr.fusionScore,
        businessProblem: fr.businessProblem ?? '',
        recommendedCapability: fr.recommendedCapability ?? '',
        relevantCaseStudy: fr.relevantCaseStudy,
        proofPoints: Array.isArray(fr.proofPoints) ? (fr.proofPoints as string[]) : [],
        confidenceScore: fr.confidenceScore,
      }));
    } catch (err) {
      logger.warn('[intelligence/opportunity] Failed to load fusion results', {
        companyId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── Step 5: Compute confidence ───────────────────────────────────────────
  const confidences: number[] = [];
  if (scoring?.success) confidences.push((scoring.confidence ?? 0) / 100);
  if (reasoning?.success) confidences.push(reasoning.overallConfidence ?? 0);
  const confidence = confidences.length > 0
    ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
    : 0;

  // ── Step 6: Compose IntelligenceOpportunity ──────────────────────────────
  // When engines fail, the actual result is the full interface (since engines are non-throwing
  // and return complete objects with success=false). Promise.allSettled wrapping preserves types.
  const data: IntelligenceOpportunity = {
    companyId,
    ...(runScores && scoring?.success ? { scores: scoring } : {}),
    ...(reasoning
      ? {
          reasoning: {
            summary: reasoning.success
              ? `Completed ${reasoning.completedSteps}/${reasoning.totalSteps} reasoning steps with ${(reasoning.overallConfidence ?? 0).toFixed(1)}% confidence`
              : reasoning.error ?? 'Reasoning unavailable',
            overallConfidence: reasoning.overallConfidence ?? 0,
            winProbability: reasoning.winProbability ?? 0,
          },
        }
      : {}),
    ...(runFusion ? { fusion: fusionData } : {}),
    ...(actions?.success ? { actions } : {}),
  };

  // ── Step 7: Build & return envelope ─────────────────────────────────────
  const freshness = computeFreshness(company as Parameters<typeof computeFreshness>[0]);
  const durationMs = Date.now() - startedAt;

  logger.info('[intelligence/opportunity] Response assembled', {
    companyId,
    durationMs,
    confidence,
    fusionCount: fusionData?.length ?? 0,
    freshnessLevel: freshness.level,
  });

  return Response.json(
    createResponse('opportunity', companyId, data, {
      durationMs,
      includes: guardResult.includes,
      cached: false,
      confidence,
      freshness,
      requestedAt,
      respondedAt: new Date(),
    }),
    { headers: { ...responseHeaders, 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' } },
  );
}
