/**
 * GET /api/intelligence/retrieval/{id}
 *
 * Intelligence API — Retrieval Endpoint
 *
 * Performs semantic search across the knowledge index for a company context.
 * Uses RetrievalEngine with transformer embeddings + TF-IDF fallback.
 *
 * Query params:
 *   ?q=search+query — the search query (required)
 *   ?topK=5 — number of results (default 5)
 *   ?filter=capability_asset|ai_insight|company_signal — filter by entity type
 *
 * Non-throwing: always returns IntelligenceResponse envelope.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { RetrievalEngine } from '@/lib/engines/retrieval-engine';
import type { EmbeddableEntityType } from '@/lib/engines/retrieval-engine';
import {
  createResponse,
  createErrorResponse,
  computeFreshness,
} from '@/lib/intelligence-api/middleware';
import { IntelligenceErrors } from '@/lib/intelligence-api/types';
import type { IntelligenceRetrievalOutput } from '@/lib/intelligence-api/types';
import { intelligenceGuard } from '@/lib/intelligence-api/guard';
import { scrubError } from '@/lib/intelligence-api/handler';
import { logger } from '@/lib/logger';
import { runGovernanceChecks } from '@/lib/ai-governance';
import { getResearchContext } from '@/lib/intelligence-contract';

const VALID_FILTER_TYPES = new Set<EmbeddableEntityType>([
  'capability_asset',
  'ai_insight',
  'company_signal',
  'company',
  'contact',
  'opportunity',
  'evidence',
  'knowledge_entry',
]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const startedAt = Date.now();
  const requestedAt = new Date();

  // ── Intelligence Guard: validation + rate limiting + correlation-id ─────
  const guardResult = await intelligenceGuard(request, params, 'retrieval');
  if (guardResult instanceof Response) return guardResult;
  const { companyId, correlationId, responseHeaders, includes } = guardResult;

  // Parse retrieval-specific query params with validation
  const query = request.nextUrl.searchParams.get('q');
  // Output validation: sanitize query (max 500 chars, strip control chars)
  const sanitizedQuery = query ? query.slice(0, 500).replace(/[\x00-\x1F\x7F]/g, '').trim() : null;
  if (!sanitizedQuery || !sanitizedQuery.trim()) {
    return Response.json(
      createErrorResponse('retrieval', companyId, 'Query parameter ?q= is required', IntelligenceErrors.VALIDATION_FAILED, Date.now() - startedAt, includes),
      { status: 400, headers: responseHeaders },
    );
  }
  const topKRaw = parseInt(request.nextUrl.searchParams.get('topK') || '5', 10) || 5;
  const topK = Math.min(Math.max(topKRaw, 1), 50);
  const filterRaw = request.nextUrl.searchParams.get('filter');
  const filter = filterRaw && VALID_FILTER_TYPES.has(filterRaw as EmbeddableEntityType)
    ? { type: filterRaw as EmbeddableEntityType }
    : undefined;

  if (!query || !query.trim()) {
    return Response.json(
      createErrorResponse('retrieval', companyId, 'Query parameter ?q= is required', IntelligenceErrors.VALIDATION_FAILED, Date.now() - startedAt, includes),
      { status: 400, headers: responseHeaders },
    );
  }

  // Ticket 3: Run real governance check for response metadata (requires DB)
  let governanceMeta: { passed: boolean; generationType: string; checks: Record<string, { passed: boolean; message: string }> } | undefined;
  try {
    if (process.env.DATABASE_URL?.startsWith('postgres')) {
      const researchCtx = await getResearchContext(companyId);
      const govResult = await runGovernanceChecks({ companyId, generationType: 'retrieval', researchContext: researchCtx });
      governanceMeta = {
        passed: govResult.passed,
        generationType: 'retrieval',
        checks: Object.fromEntries(Object.entries(govResult.checks).map(([k, v]) => [k, { passed: v.passed, message: v.message }])),
      };
    }
  } catch {
    // Governance metadata is optional — degrade gracefully
  }

  logger.info('[intelligence/retrieval] Processing', {
    companyId,
    correlationId,
    query: sanitizedQuery.slice(0, 100),
    topK,
    filter: filter?.type,
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
    logger.error('[intelligence/retrieval] DB lookup failed', { companyId, correlationId, error: rawMessage });
    return Response.json(
      createErrorResponse('retrieval', companyId, `Company lookup failed: ${scrubError(rawMessage)}`, IntelligenceErrors.INTELLIGENCE_UNAVAILABLE, Date.now() - startedAt, includes),
      { status: 500, headers: responseHeaders },
    );
  }

  if (!company) {
    return Response.json(
      createErrorResponse('retrieval', companyId, 'Company not found', IntelligenceErrors.COMPANY_NOT_FOUND, Date.now() - startedAt, includes),
      { status: 404, headers: responseHeaders },
    );
  }

  // ── Step 2: Run RetrievalEngine.search() + getStats() in parallel ──────
  let results: Awaited<ReturnType<typeof RetrievalEngine.search>>;
  let stats: Awaited<ReturnType<typeof RetrievalEngine.getStats>>;
  try {
    const [searchResult, statsResult] = await Promise.all([
      RetrievalEngine.search(sanitizedQuery, topK, filter),
      RetrievalEngine.getStats().catch(() => ({ totalEmbeddings: 0, uniqueEntities: 0, byType: {}, backend: 'empty' as const, indexSizeBytes: 0 })),
    ]);
    results = searchResult;
    stats = statsResult;
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : String(err);
    logger.warn('[intelligence/retrieval] RetrievalEngine threw', { companyId, correlationId, error: rawMessage });
    return Response.json(
      createErrorResponse('retrieval', companyId, scrubError(rawMessage), IntelligenceErrors.ENGINE_FAILED, Date.now() - startedAt, includes),
      { status: 502, headers: responseHeaders },
    );
  }

  // ── Step 3: Output validation — clamp scores to valid range ──────
  const validatedResults = results.map(r => ({
    ...r,
    score: Math.max(0, Math.min(1, r.score)),
  }));

  // ── Step 4: Compose response ─────────────────────────────────────────────
  const data: IntelligenceRetrievalOutput = {
    companyId,
    results: validatedResults,
    query: sanitizedQuery,
    resultCount: results.length,
    stats: {
      totalEmbeddings: stats.totalEmbeddings,
      uniqueEntities: stats.uniqueEntities,
      backend: stats.backend,
    },
  };

  const freshness = computeFreshness(company as Parameters<typeof computeFreshness>[0]);
  const durationMs = Date.now() - startedAt;

  // Confidence = best result's score, or 0 if no results
  const confidence = validatedResults.length > 0 ? validatedResults[0].score : 0;

  logger.info('[intelligence/retrieval] Search complete', {
    companyId,
    query: sanitizedQuery.slice(0, 100),
    resultCount: validatedResults.length,
    topScore: confidence,
    backend: stats.backend,
    durationMs,
  });

  return Response.json(
    createResponse('retrieval', companyId, data, {
      durationMs,
      includes,
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
