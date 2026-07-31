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
  runGovernanceMetadata,
  SECURITY_HEADERS,
} from '@/lib/intelligence-api/middleware';
import { IntelligenceErrors } from '@/lib/intelligence-api/types';
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

  // E1: Use shared governance helper from middleware
  const governanceMeta = await runGovernanceMetadata(companyId, 'opportunities');

  logger.info('[intelligence/opportunity] Processing', {
    companyId,
    correlationId,
    includes: Array.from(guardResult.includes),
  });

  // ── Step 1: Load company from DB (for freshness) ────────────────────────
  let company: {
    id: string;
    lastEnrichedAt?: Date | null;
    lastActivityAt?: Date | null;
    accountPriorityScore?: number | null;
    priorityTier?: string | null;
  } | null = null;
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
  // E5 FIX: Reasoning and actions run when: empty includes (default), scores requested
  // (composite opportunity view needs context), or explicitly via company-level includes.
  const runReasoning = guardResult.includes.size === 0 || runScores;
  const runActions = guardResult.includes.size === 0 || runScores;

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
    try {
      await Promise.all(enginePromises);
    } catch {
      // Individual engine .catch() handlers above should swallow errors,
      // but guard against unexpected rejections (e.g. Promise construction failure).
      logger.warn('[intelligence/opportunity] Unexpected engine promise rejection', { companyId, correlationId });
    }
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
        // Present signal IDs as comma-separated list for readability
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
      // Don't set capabilitiesData — leave undefined to indicate "not loaded"
    }
  }

  // ── Step 5: Compute confidence ───────────────────────────────────────────
  const confidences: number[] = [];
  if (scoring?.success) confidences.push(Math.min(1, (scoring.confidence ?? 0) / 100));
  if (reasoning?.success) confidences.push((reasoning.overallConfidence ?? 0) / 1);
  const confidence = confidences.length > 0
    ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
    : 0;

  // ── Step 6: Compose IntelligenceOpportunity ──────────────────────────────
  const data: IntelligenceOpportunity = {
    companyId,
    ...(runScores && scoring && typeof scoring === 'object' && 'success' in scoring && scoring.success ? { scores: scoring as RevenueScore } : {}),
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
  const freshness = computeFreshness(company);
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
    {
      headers: {
        'Content-Type': 'application/json',
        ...SECURITY_HEADERS,
        ...responseHeaders,
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      },
    },
  );
}
