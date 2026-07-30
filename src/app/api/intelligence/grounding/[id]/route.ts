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
  parseIncludeParams,
  createResponse,
  createErrorResponse,
  computeFreshness,
} from '@/lib/intelligence-api/middleware';
import type { IntelligenceGroundingOutput } from '@/lib/intelligence-api/types';
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
      createErrorResponse('grounding', '', 'Company ID is required', 'MISSING_COMPANY_ID'),
      { status: 400 },
    );
  }

  const { includes } = parseIncludeParams(request);
  const maxEvidence = parseInt(request.nextUrl.searchParams.get('maxEvidence') || '50', 10);
  const includeStale = request.nextUrl.searchParams.get('includeStale') === 'true';

  logger.info('[intelligence/grounding] Processing', {
    companyId,
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
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[intelligence/grounding] DB lookup failed', { companyId, error: message });
    return Response.json(
      createErrorResponse('grounding', companyId, `Company lookup failed: ${message}`, 'INTELLIGENCE_UNAVAILABLE', Date.now() - startedAt, includes),
      { status: 500 },
    );
  }

  if (!company) {
    return Response.json(
      createErrorResponse('grounding', companyId, 'Company not found', 'COMPANY_NOT_FOUND', Date.now() - startedAt, includes),
      { status: 404 },
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
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('[intelligence/grounding] GroundingEngine threw', { companyId, error: message });
    return Response.json(
      createErrorResponse('grounding', companyId, message, 'ENGINE_TIMEOUT', Date.now() - startedAt, includes),
      { status: 502 },
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
  );
}
