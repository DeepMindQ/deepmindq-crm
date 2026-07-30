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
import { IntelligenceErrors } from '@/lib/intelligence-api/types';
import type {
  IntelligenceOpportunity,
} from '@/lib/intelligence-api/types';
import { scrubError } from '@/lib/intelligence-api/handler';
import { intelligenceGuard } from '@/lib/intelligence-api/guard';
import { logger } from '@/lib/logger';
import { runGovernanceChecks } from '@/lib/ai-governance';
import { getResearchContext } from '@/lib/intelligence-contract';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const startedAt = Date.now();
  const requestedAt = new Date();

  const guardResult = await intelligenceGuard(request, params, 'opportunity');
  if (guardResult instanceof Response) return guardResult;
  const { companyId, correlationId, responseHeaders } = guardResult;

  // Ticket 3: Run real governance check for response metadata (requires DB)
  let governanceMeta: { passed: boolean; generationType: string; checks: Record<string, { passed: boolean; message: string }> } | undefined;
  try {
    // Only run governance check against real PostgreSQL — skip for file-based/test DBs
    if (process.env.DATABASE_URL?.startsWith('postgres')) {
      const researchCtx = await getResearchContext(companyId);
      const govResult = await runGovernanceChecks({ companyId, generationType: 'opportunities', researchContext: researchCtx });
      governanceMeta = {
        passed: govResult.passed,
        generationType: 'opportunities',
        checks: Object.fromEntries(Object.entries(govResult.checks).map(([k, v]) => [k, { passed: v.passed, message: v.message }])),
      };
    }
  } catch {
    // Governance metadata is optional — degrade gracefully
  }

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
      createErrorResponse('opportunity', companyId, `Company lookup failed: ${scrubError(rawMessage)}`, IntelligenceErrors.INTELLIGENCE_UNAVAILABLE, Date.now() - startedAt, guardResult.includes),
      { status: 500, headers: responseHeaders },
    );
  }

  if (!company) {
    return Response.json(
      createErrorResponse('opportunity', companyId, 'Company not found', IntelligenceErrors.COMPANY_NOT_FOUND, Date.now() - startedAt, guardResult.includes),
      { status: 404, headers: responseHeaders },
    );
  }

  // ── Step 2: Determine which engines to run based on ?include ───────────
  const runScores = guardResult.includes.size === 0 || shouldInclude(guardResult.includes, 'scores');
  const runFusion = guardResult.includes.size === 0 || shouldInclude(guardResult.includes, 'fusion');
  const runCapabilities = shouldInclude(guardResult.includes, 'capabilities');
  // E5 FIX: Gate reasoning + actions on whether they contribute to requested includes.
  // reasoning provides summary/confidence data; actions provides recommended actions.
  // When empty includes (default), all engines run for backward compatibility.
  const runReasoning = guardResult.includes.size === 0;
  const runActions = guardResult.includes.size === 0;

  // ── Step 3: Run engines conditionally in parallel ──────────────────────
  const engineResults: { scoring: RevenueScore | null; reasoning: ReasoningResult | null; actions: ActionResult | null } = {
    scoring: null, reasoning: null, actions: null,
  };

  const enginePromises: Promise<unknown>[] = [];
  if (runScores) {
    enginePromises.push(
      ScoringEngine.score({ companyId, skipNarrative: true })
        .then(r => { engineResults.scoring = r; })
        .catch(err => {
          logger.warn('[intelligence/opportunity] ScoringEngine threw', {
            companyId, error: err instanceof Error ? err.message : String(err),
          });
        }),
    );
  }
  if (runReasoning) {
    enginePromises.push(
      EnterpriseReasoningEngine.build(companyId)
        .then(r => { engineResults.reasoning = r; })
        .catch(err => {
          logger.warn('[intelligence/opportunity] ReasoningEngine threw', {
            companyId, error: err instanceof Error ? err.message : String(err),
          });
        }),
    );
  }
  if (runActions) {
    enginePromises.push(
      ActionEngine.recommend({ companyId, skipNarrative: true })
        .then(r => { engineResults.actions = r; })
        .catch(err => {
          logger.warn('[intelligence/opportunity] ActionEngine threw', {
            companyId, error: err instanceof Error ? err.message : String(err),
          });
        }),
    );
  }

  if (enginePromises.length > 0) {
    await Promise.all(enginePromises);
  }

  const scoring = engineResults.scoring;
  const reasoning = engineResults.reasoning;
  const actions = engineResults.actions;

  // Log engine failures for observability
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

  // ── Step 4b: Load capabilities (only when ?include=capabilities) ──
  let capabilitiesData: IntelligenceOpportunity['capabilities'] = undefined;
  if (runCapabilities) {
    try {
      const fusionResults = await db.fusionResult.findMany({
        where: { companyId },
        select: { capabilityIds: true },
      });
      const capIds = new Set<string>();
      for (const fr of fusionResults) {
        const ids = fr.capabilityIds as unknown[];
        if (Array.isArray(ids)) {
          for (const id of ids) {
            if (typeof id === 'string') capIds.add(id);
          }
        }
      }
      if (capIds.size > 0) {
        const assets = await db.capabilityAsset.findMany({
          where: { id: { in: Array.from(capIds) }, isActive: true },
          select: { id: true, title: true, summary: true, category: true, serviceLine: true },
          take: 20,
        });
        capabilitiesData = assets.map(a => ({
          id: a.id, title: a.title, summary: a.summary,
          category: a.category, serviceLine: a.serviceLine,
        }));
      } else {
        capabilitiesData = [];
      }
    } catch (err) {
      logger.warn('[intelligence/opportunity] Failed to load capabilities', {
        companyId,
        error: err instanceof Error ? err.message : String(err),
      });
      capabilitiesData = [];
    }
  }

  // ── Step 5: Compute confidence ───────────────────────────────────────────
  const confidences: number[] = [];
  if (scoring?.success) confidences.push((scoring.confidence ?? 0) / 100);
  if (reasoning?.success) confidences.push((reasoning.overallConfidence ?? 0) / 1);
  const confidence = confidences.length > 0
    ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
    : 0;

  // ── Step 6: Compose IntelligenceOpportunity ──────────────────────────────
  const data: IntelligenceOpportunity = {
    companyId,
    ...(runScores && scoring?.success ? { scores: scoring as RevenueScore } : {}),
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
    ...(runCapabilities ? { capabilities: capabilitiesData } : {}),
    ...(actions?.success ? { actions: actions as ActionResult } : {}),
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
      ...(governanceMeta && { governance: governanceMeta }),
    }),
    { headers: { ...responseHeaders, 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' } },
  );
}
