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
} from '@/lib/intelligence-api/middleware';
import type { IntelligenceGroundingOutput } from '@/lib/intelligence-api/types';
import { intelligenceGuard } from '@/lib/intelligence-api/guard';
import { scrubError } from '@/lib/intelligence-api/handler';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const startedAt = Date.now();
  const requestedAt = new Date();

  // ── Intelligence Guard: validation + rate limiting + correlation-id ─────
  const guardResult = await intelligenceGuard(request, params, 'grounding');
  if (guardResult instanceof Response) return guardResult;
  const { companyId, correlationId, responseHeaders, includes } = guardResult;

  const maxEvidence = parseInt(request.nextUrl.searchParams.get('maxEvidence') || '50', 10);
  const includeStale = request.nextUrl.searchParams.get('includeStale') === 'true';

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
      createErrorResponse('grounding', companyId, `Company lookup failed: ${scrubError(rawMessage)}`, 'INTELLIGENCE_UNAVAILABLE', Date.now() - startedAt, includes),
      { status: 500, headers: responseHeaders },
    );
  }

  if (!company) {
    return Response.json(
      createErrorResponse('grounding', companyId, 'Company not found', 'COMPANY_NOT_FOUND', Date.now() - startedAt, includes),
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
      createErrorResponse('grounding', companyId, scrubError(rawMessage), 'ENGINE_TIMEOUT', Date.now() - startedAt, includes),
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

  const freshness = computeFreshness(company as Parameters<typeof computeFreshness>[0]);
  const durationMs = Date.now() - startedAt;

  logger.info('[intelligence/grounding] Evidence chain built', {
    companyId,
    evidenceCount: evidenceChain.evidences.length,
    gapCount: evidenceChain.gaps.length,
    coverage: evidenceChain.coverage,
    confidence: evidenceChain.aggregateConfidence,
    durationMs,
    freshnessLevel: freshness.level,
  });

  return Response.json(
    createResponse('grounding', companyId, data, {
      durationMs,
      includes,
      cached: false,
      confidence: evidenceChain.aggregateConfidence,
      freshness,
      requestedAt,
      respondedAt: new Date(),
    }),
    { headers: { ...responseHeaders, 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' } },
  );
}
