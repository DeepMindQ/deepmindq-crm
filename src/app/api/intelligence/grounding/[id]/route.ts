/**
 * GET /api/intelligence/grounding/{id}
 *
 * Intelligence API — Grounding Endpoint
 *
 * Returns the evidence chain for a company, built by the GroundingEngine.
 * Exposes what evidence exists, confidence scores, and coverage gaps.
 *
 * Query params:
 *   ?maxEvidence=50 — max evidence pieces to collect (default 50)
 *   ?includeStale=true — include older, archived evidence
 *
 * Non-throwing: always returns IntelligenceResponse envelope.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { GroundingEngine } from '@/lib/engines/grounding-engine';
import {
  createResponse,
  createErrorResponse,
  computeFreshness,
} from '@/lib/intelligence-api/intelligence-middleware';
import { IntelligenceErrors } from '@/lib/intelligence-api/types';
import type { IntelligenceGroundingOutput } from '@/lib/intelligence-api/types';
import { intelligenceGuard } from '@/lib/intelligence-api/guard';
import { scrubError } from '@/lib/intelligence-api/handler';
import { logger } from '@/lib/logger';
import { runGovernanceChecks } from '@/lib/ai-governance';
import { getResearchContext } from '@/lib/intelligence-contract';
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
  const guardResult = await intelligenceGuard(request, params, 'grounding');
  if (guardResult instanceof Response) return guardResult;
  const { companyId, correlationId, responseHeaders, includes } = guardResult;

  const maxEvidenceRaw = parseInt(request.nextUrl.searchParams.get('maxEvidence') || '50', 10) || 50;
  const maxEvidence = Math.min(Math.max(maxEvidenceRaw, 1), 200);
  const includeStale = request.nextUrl.searchParams.get('includeStale') === 'true';

  // Ticket 3: Run real governance check for response metadata (requires DB)
  let governanceMeta: { passed: boolean; generationType: string; checks: Record<string, { passed: boolean; message: string }> } | undefined;
  try {
    if (process.env.DATABASE_URL?.startsWith('postgres')) {
      const researchCtx = await getResearchContext(companyId);
      const govResult = await runGovernanceChecks({ companyId, generationType: 'grounding', researchContext: researchCtx });
      governanceMeta = {
        passed: govResult.passed,
        generationType: 'grounding',
        checks: Object.fromEntries(Object.entries(govResult.checks).map(([k, v]) => [k, { passed: v.passed, message: v.message }])),
      };
    }
  } catch {
    // Governance metadata is optional — degrade gracefully
  }

  logger.info('[intelligence/grounding] Processing', {
    companyId,
    correlationId,
    maxEvidence,
    includeStale,
    includes: Array.from(includes),
  });

  // ── Step 1: Load company from DB (for freshness) ────────────────────────
  let company: Record<string, unknown> | null = null;
  try {
    company = await db.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        rawName: true,
        lastEnrichedAt: true,
        lastActivityAt: true,
      },
    });
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[intelligence/grounding] DB lookup failed', { companyId, correlationId, error: rawMessage });
    return Response.json(
      createErrorResponse('grounding', companyId, `Company lookup failed: ${scrubError(rawMessage)}`, IntelligenceErrors.INTELLIGENCE_UNAVAILABLE, Date.now() - startedAt, includes),
      { status: 500, headers: responseHeaders },
    );
  }

  if (!company) {
    return Response.json(
      createErrorResponse('grounding', companyId, 'Company not found', IntelligenceErrors.COMPANY_NOT_FOUND, Date.now() - startedAt, includes),
      { status: 404, headers: responseHeaders },
    );
  }

  // ── Step 2: Run GroundingEngine ──────────────────────────────────────────
  let evidenceChain: Awaited<ReturnType<typeof GroundingEngine.collect>>;
  try {
    evidenceChain = await GroundingEngine.collect({
      companyId,
      maxEvidence,
      includeStale,
    });
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : String(err);
    logger.warn('[intelligence/grounding] GroundingEngine threw', { companyId, correlationId, error: rawMessage });
    return Response.json(
      createErrorResponse('grounding', companyId, scrubError(rawMessage), IntelligenceErrors.ENGINE_FAILED, Date.now() - startedAt, includes),
      { status: 502, headers: responseHeaders },
    );
  }

  // ── Step 3: Compose response ─────────────────────────────────────────────
  const data: IntelligenceGroundingOutput = {
    companyId,
    evidences: evidenceChain.evidences,
    aggregateConfidence: evidenceChain.aggregateConfidence,
    coverage: evidenceChain.coverage,
    gaps: evidenceChain.gaps,
    freshnessScore: evidenceChain.freshnessScore,
    evidenceCount: evidenceChain.evidences.length,
    gapCount: evidenceChain.gaps.length,
  };

  // Output validation: clamp confidence to valid range
  const validatedConfidence = Math.max(0, Math.min(1, evidenceChain.aggregateConfidence));

  const freshness = computeFreshness(company as Parameters<typeof computeFreshness>[0]);
  const durationMs = Date.now() - startedAt;

  logger.info('[intelligence/grounding] Evidence chain built', {
    companyId,
    evidenceCount: evidenceChain.evidences.length,
    gapCount: evidenceChain.gaps.length,
    coverage: evidenceChain.coverage,
    confidence: validatedConfidence,
    durationMs,
    freshnessLevel: freshness.level,
  });

  return Response.json(
    createResponse('grounding', companyId, data, {
      durationMs,
      includes,
      cached: false,
      confidence: validatedConfidence,
      freshness,
      requestedAt,
      respondedAt: new Date(),
      ...(governanceMeta && { governance: governanceMeta }),
    }),
    { headers: { ...responseHeaders, 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' } },
  );
}
