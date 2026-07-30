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
import type { IntelligenceRetrievalOutput } from '@/lib/intelligence-api/types';
import { intelligenceGuard } from '@/lib/intelligence-api/guard';
import { scrubError } from '@/lib/intelligence-api/handler';
import { logger } from '@/lib/logger';

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

  // Parse retrieval-specific query params
  const query = request.nextUrl.searchParams.get('q');
  const topK = parseInt(request.nextUrl.searchParams.get('topK') || '5', 10);
  const filterRaw = request.nextUrl.searchParams.get('filter');
  const filter = filterRaw && VALID_FILTER_TYPES.has(filterRaw as EmbeddableEntityType)
    ? { type: filterRaw as EmbeddableEntityType }
    : undefined;

  if (!query || !query.trim()) {
    return Response.json(
      createErrorResponse('retrieval', companyId, 'Query parameter ?q= is required', 'INVALID_INCLUDE', Date.now() - startedAt, includes),
      { status: 400, headers: responseHeaders },
    );
  }

  logger.info('[intelligence/retrieval] Processing', {
    companyId,
    correlationId,
    query: query.slice(0, 100),
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
      createErrorResponse('retrieval', companyId, `Company lookup failed: ${scrubError(rawMessage)}`, 'INTELLIGENCE_UNAVAILABLE', Date.now() - startedAt, includes),
      { status: 500, headers: responseHeaders },
    );
  }

  if (!company) {
    return Response.json(
      createErrorResponse('retrieval', companyId, 'Company not found', 'COMPANY_NOT_FOUND', Date.now() - startedAt, includes),
      { status: 404, headers: responseHeaders },
    );
  }

  // ── Step 2: Run RetrievalEngine.search() ───────────────────────────────
  let results: Awaited<ReturnType<typeof RetrievalEngine.search>>;
  try {
    results = await RetrievalEngine.search(query, topK, filter);
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : String(err);
    logger.warn('[intelligence/retrieval] RetrievalEngine threw', { companyId, correlationId, error: rawMessage });
    return Response.json(
      createErrorResponse('retrieval', companyId, scrubError(rawMessage), 'ENGINE_TIMEOUT', Date.now() - startedAt, includes),
      { status: 502, headers: responseHeaders },
    );
  }

  // ── Step 3: Get index stats ─────────────────────────────────────────────
  let stats: Awaited<ReturnType<typeof RetrievalEngine.getStats>>;
  try {
    stats = await RetrievalEngine.getStats();
  } catch {
    stats = { totalEmbeddings: 0, uniqueEntities: 0, byType: {}, backend: 'empty', indexSizeBytes: 0 };
  }

  // ── Step 4: Compose response ─────────────────────────────────────────────
  const data: IntelligenceRetrievalOutput = {
    companyId,
    results,
    query,
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
  const confidence = results.length > 0 ? results[0].score : 0;

  logger.info('[intelligence/retrieval] Search complete', {
    companyId,
    query: query.slice(0, 100),
    resultCount: results.length,
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
    }),
    { headers: responseHeaders },
  );
}
