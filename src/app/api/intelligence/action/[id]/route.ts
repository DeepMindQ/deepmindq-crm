/**
 * GET /api/intelligence/action/{id}
 *
 * Intelligence API — Action Endpoint
 *
 * Returns recommended actions + learning insights for a company.
 * Composes ActionEngine + ContinuousLearningLoop data.
 *
 * Query params:
 *   ?include=recommendations — extract recommendations from ActionResult
 *   ?include=sequences      — extract action sequences from ActionResult
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
  SECURITY_HEADERS,
  runGovernanceMetadata,
} from '@/lib/intelligence-api/intelligence-middleware';
import { IntelligenceErrors } from '@/lib/intelligence-api/types';
import type { IntelligenceActionOutput } from '@/lib/intelligence-api/types';
import { scrubError } from '@/lib/intelligence-api/handler';
import { intelligenceGuard } from '@/lib/intelligence-api/guard';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

/** A9: Type-safe helper to treat an unknown value as a Record without `as unknown as` */
function asRecord(obj: unknown): Record<string, unknown> {
  return (obj && typeof obj === 'object' ? obj : {}) as Record<string, unknown>;
}

const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

const startedAt = Date.now();
  const requestedAt = new Date();

  const guardResult = await intelligenceGuard(request, params, 'action');
  if (guardResult instanceof Response) return guardResult;
  const { companyId, correlationId, responseHeaders } = guardResult;

  // E1: Use shared governance helper instead of inline 12-line block
  const governanceMeta = await runGovernanceMetadata(companyId, 'action_strategy');

  // H1: Add correlationId to processing log
  logger.info('[intelligence/action] Processing', {
    companyId,
    correlationId,
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
    logger.error('[intelligence/action] DB lookup failed', { companyId, correlationId, error: rawMessage });
    return Response.json(
      createErrorResponse('action', companyId, `Company lookup failed: ${scrubError(rawMessage)}`, IntelligenceErrors.INTELLIGENCE_UNAVAILABLE, Date.now() - startedAt, guardResult.includes),
      { status: 500, headers: { ...SECURITY_HEADERS, ...responseHeaders, 'Content-Type': JSON_CONTENT_TYPE } },
    );
  }

  if (!company) {
    return Response.json(
      createErrorResponse('action', companyId, 'Company not found', IntelligenceErrors.COMPANY_NOT_FOUND, Date.now() - startedAt, guardResult.includes),
      { status: 404, headers: { ...SECURITY_HEADERS, ...responseHeaders, 'Content-Type': JSON_CONTENT_TYPE } },
    );
  }

  // ── Step 2: Determine which includes are active ──────────────────────────
  const wantsActions = guardResult.includes.size === 0
    || shouldInclude(guardResult.includes, 'recommendations')
    || shouldInclude(guardResult.includes, 'sequences');
  // E9: Consistent with wantsActions — default when no includes specified
  const wantsLearning = guardResult.includes.size === 0
    || shouldInclude(guardResult.includes, 'learning');

  // Recommendations and sequences are extracted from ActionResult after engine runs.

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
            // B17: Log error type properly
            logger.warn('[intelligence/action] Failed to load learning insights', {
              companyId,
              correlationId,
              errorType: err instanceof Error ? err.constructor.name : typeof err,
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
    logger.warn('[intelligence/action] ActionEngine threw', { companyId, correlationId, error: rawMessage });
    return Response.json(
      createErrorResponse('action', companyId, scrubError(rawMessage), IntelligenceErrors.ENGINE_FAILED, Date.now() - startedAt, guardResult.includes),
      { status: 502, headers: { ...SECURITY_HEADERS, ...responseHeaders, 'Content-Type': JSON_CONTENT_TYPE } },
    );
  }

  if (actionResult && !actionResult.success) {
    logger.warn('[intelligence/action] ActionEngine failed', {
      companyId,
      correlationId,
      error: actionResult.error,
    });
    return Response.json(
      createErrorResponse('action', companyId, scrubError(actionResult.error || 'Action engine failed'), IntelligenceErrors.ENGINE_FAILED, Date.now() - startedAt, guardResult.includes),
      { status: 502, headers: { ...SECURITY_HEADERS, ...responseHeaders, 'Content-Type': JSON_CONTENT_TYPE } },
    );
  }

  // ── Step 4: Extract recommendations and sequences from action result ────
  let recommendations: Array<{ action: string; priority: string; rationale: string; confidence: number }> = [];
  let sequences: Array<{ step: number; action: string; dependsOn: string[] }> = [];

  if (actionResult && typeof actionResult === 'object') {
    // A9: Use type guard helper instead of `as unknown as Record<string, unknown>`
    const ar = asRecord(actionResult);

    // Extract recommendations from actions array (RecommendedAction[])
    if (Array.isArray(ar.actions)) {
      recommendations = (ar.actions as Array<Record<string, unknown>>)
        .slice(0, 10)
        .map((ra, idx) => ({
          action: String(ra.title || ra.concreteStep || `Action ${idx + 1}`),
          priority: String(ra.urgency || 'medium'),
          rationale: String(ra.reason || ''),
          // A3: ActionResult has no top-level `confidence` — only use ra.confidence
          confidence: Number(ra.confidence ?? 0),
        }));
    }

    // Extract sequences from actions (each action becomes a step)
    if (Array.isArray(ar.actions)) {
      sequences = (ar.actions as Array<Record<string, unknown>>)
        .slice(0, 10)
        .map((as, idx) => ({
          step: idx + 1,
          action: String(as.concreteStep || as.title || `Step ${idx + 1}`),
          dependsOn: [],
        }));
    }

    // D5: Fallback — derive recommendation from primaryAction with null checks
    if (recommendations.length === 0 && ar.primaryAction && typeof ar.primaryAction === 'object') {
      const pa = ar.primaryAction as Record<string, unknown>;
      recommendations = [{
        action: String(pa.title != null ? pa.title : pa.concreteStep != null ? pa.concreteStep : 'Primary Action'),
        priority: String(pa.urgency != null ? pa.urgency : 'medium'),
        rationale: String(pa.reason != null ? pa.reason : ''),
        confidence: Number(pa.confidence != null ? pa.confidence : 0),
      }];
    }
  }

  // ── Step 5: Compose response data ────────────────────────────────────────
  const data: IntelligenceActionOutput = {
    companyId,
    // G1: Expose ActionResult but suppress internal error field from API response
    ...(actionResult ? { actions: { ...actionResult, error: undefined as unknown as string | null } } : {}),
    ...(wantsLearning ? {
      learningInsights: learningEvents.map((e) => ({
        id: e.id,
        insight: e.learnedInsight,
        sourceCompany: e.companyId || 'unknown',
        applicableContext: e.applicableContext || '',
        createdAt: e.createdAt.toISOString(),
      })),
    } : {}),
    ...(shouldInclude(guardResult.includes, 'recommendations') ? { recommendations } : {}),
    ...(shouldInclude(guardResult.includes, 'sequences') ? { sequences } : {}),
  };

  // H11 FIX: Safe confidence extraction with type narrowing
  const confidence = actionResult && typeof actionResult === 'object' && 'confidence' in actionResult
    ? Number((actionResult as { confidence?: unknown }).confidence ?? 0)
    : 0;
  // A7: Type already matches — no need for `as Parameters<typeof computeFreshness>[0]`
  const freshness = computeFreshness(company);
  const durationMs = Date.now() - startedAt;

  logger.info('[intelligence/action] Response assembled', {
    companyId,
    correlationId,
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
    { headers: { ...SECURITY_HEADERS, ...responseHeaders, 'Content-Type': JSON_CONTENT_TYPE, 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' } },
  );
}
