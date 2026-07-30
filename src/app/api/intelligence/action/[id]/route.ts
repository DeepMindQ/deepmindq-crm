/**
 * GET /api/intelligence/action/{id}
 *
 * Intelligence API — Action Endpoint
 *
 * Returns recommended actions + learning insights for a company.
 * Composes ActionEngine + ContinuousLearningLoop data.
 *
 * Query params:
 *   ?include=recommendations — include action recommendations (placeholder, not yet implemented)
 *   ?include=sequences      — include action sequences (placeholder, not yet implemented)
 *   ?include=learning       — include learning insights (optional)
 *   Multiple includes via comma-separation: ?include=recommendations,sequences,learning
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
import { IntelligenceErrors } from '@/lib/intelligence-api/types';
import type { IntelligenceActionOutput } from '@/lib/intelligence-api/types';
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

  const guardResult = await intelligenceGuard(request, params, 'action');
  if (guardResult instanceof Response) return guardResult;
  const { companyId, correlationId, responseHeaders } = guardResult;

  // Ticket 3: Run real governance check for response metadata (requires DB)
  let governanceMeta: { passed: boolean; generationType: string; checks: Record<string, { passed: boolean; message: string }> } | undefined;
  try {
    // Only run governance check against real PostgreSQL — skip for file-based/test DBs
    if (process.env.DATABASE_URL?.startsWith('postgres')) {
      const researchCtx = await getResearchContext(companyId);
      const govResult = await runGovernanceChecks({ companyId, generationType: 'action_strategy', researchContext: researchCtx });
      governanceMeta = {
        passed: govResult.passed,
        generationType: 'action_strategy',
        checks: Object.fromEntries(Object.entries(govResult.checks).map(([k, v]) => [k, { passed: v.passed, message: v.message }])),
      };
    }
  } catch {
    // Governance metadata is optional — degrade gracefully
  }

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
    const rawMessage = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[intelligence/action] DB lookup failed', { companyId, error: rawMessage });
    return Response.json(
      createErrorResponse('action', companyId, `Company lookup failed: ${scrubError(rawMessage)}`, IntelligenceErrors.INTELLIGENCE_UNAVAILABLE, Date.now() - startedAt, guardResult.includes),
      { status: 500, headers: responseHeaders },
    );
  }

  if (!company) {
    return Response.json(
      createErrorResponse('action', companyId, 'Company not found', IntelligenceErrors.COMPANY_NOT_FOUND, Date.now() - startedAt, guardResult.includes),
      { status: 404, headers: responseHeaders },
    );
  }

  // ── Step 2: Determine which includes are active ──────────────────────────
  const wantsActions = guardResult.includes.size === 0
    || shouldInclude(guardResult.includes, 'recommendations')
    || shouldInclude(guardResult.includes, 'sequences');
  const wantsLearning = guardResult.includes.size === 0
    || shouldInclude(guardResult.includes, 'learning');

  // TODO (A7): Add selective loading for `recommendations` include when engine supports it
  // TODO (A8): Add selective loading for `sequences` include when engine supports it

  // ── Step 3: Run engine + load learning insights in parallel ────────
  let actionResult: ActionResult | null = null;
  let learningEvents: Array<{ id: string; learnedInsight: string; companyId: string | null; applicableContext: string; createdAt: Date }> = [];

  try {
    const results = await Promise.all([
      // N13: Only run ActionEngine when includes requested or empty (default)
      wantsActions
        ? ActionEngine.recommend({ companyId, skipNarrative: true })
        : Promise.resolve(null as ActionResult | null),
      wantsLearning
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
            logger.warn('[intelligence/action] Failed to load learning insights', {
              companyId,
              error: err instanceof Error ? err.message : String(err),
            });
            return [];
          })
        : Promise.resolve([] as Array<{ id: string; learnedInsight: string; companyId: string | null; applicableContext: string; createdAt: Date }>),
    ]);
    actionResult = results[0];
    learningEvents = results[1];
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : String(err);
    logger.warn('[intelligence/action] ActionEngine threw', { companyId, error: rawMessage });
    return Response.json(
      createErrorResponse('action', companyId, scrubError(rawMessage), IntelligenceErrors.ENGINE_FAILED, Date.now() - startedAt, guardResult.includes),
      { status: 502, headers: responseHeaders },
    );
  }

  if (actionResult && !actionResult.success) {
    logger.warn('[intelligence/action] ActionEngine failed', {
      companyId,
      error: actionResult.error,
    });
    return Response.json(
      createErrorResponse('action', companyId, scrubError(actionResult.error || 'Action engine failed'), IntelligenceErrors.ENGINE_FAILED, Date.now() - startedAt, guardResult.includes),
      { status: 502, headers: responseHeaders },
    );
  }

  // ── Step 4: Compose response data ────────────────────────────────────────
  const data: IntelligenceActionOutput = {
    companyId,
    ...(actionResult ? { actions: actionResult } : {}),
    ...(wantsLearning ? {
      learningInsights: learningEvents.map((e) => ({
        id: e.id,
        insight: e.learnedInsight,
        sourceCompany: e.companyId || 'unknown',
        applicableContext: e.applicableContext || '',
        createdAt: e.createdAt.toISOString(),
      })),
    } : {}),
  };

  // H11 FIX: Safe confidence extraction with type narrowing
  const confidence = actionResult && typeof actionResult === 'object' && 'confidence' in actionResult
    ? Number((actionResult as { confidence?: unknown }).confidence ?? 0)
    : 0;
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
      ...(governanceMeta && { governance: governanceMeta }),
    }),
    { headers: { ...responseHeaders, 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' } },
  );
}
