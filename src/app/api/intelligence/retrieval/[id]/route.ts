/**
 * GET /api/intelligence/retrieval/{id}
 *
 * Intelligence API — Hybrid Retrieval Endpoint
 *
 * WI-16F: Migrated from single-signal RetrievalEngine to multi-signal
 * Hybrid Retrieval Engine. Provides:
 *   - Multi-signal retrieval (vector + keyword + entity + knowledge graph)
 *   - RRF score fusion + re-ranking
 *   - Evidence quality scoring per result
 *   - Graceful degradation with fallback strategies
 *   - Retrieval metrics recording for quality dashboard
 *
 * Query params:
 *   ?q=search+query — the search query (required)
 *   ?topK=5 — number of results (default 5)
 *   ?filter=capability_asset|ai_insight|company_signal — filter by entity type
 *   ?mode=hybrid|legacy — retrieval mode (default hybrid)
 *
 * Non-throwing: always returns IntelligenceResponse envelope.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { RetrievalEngine } from '@/lib/engines/retrieval-engine';
import type { EmbeddableEntityType } from '@/lib/engines/retrieval-engine';
import {
  quickSearch,
  getHybridStats,
  type HybridResult,
  type HybridIndexEntry,
  addToIndex,
} from '@/lib/ai-hybrid-retrieval';
import {
  recordRetrievalMetrics,
  calculateEvidenceQuality,
  type EvidenceQualityBreakdown,
} from '@/lib/ai-retrieval-validation';
import {
  createResponse,
  createErrorResponse,
  computeFreshness,
} from '@/lib/intelligence-api/middleware';
import { IntelligenceErrors } from '@/lib/intelligence-api/types';
import { intelligenceGuard } from '@/lib/intelligence-api/guard';
import { scrubError } from '@/lib/intelligence-api/handler';
import { logger } from '@/lib/logger';
import { runGovernanceChecks } from '@/lib/ai-governance';
import { getResearchContext } from '@/lib/intelligence-contract';
import { checkApiAuth } from '@/lib/api-auth';

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
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

const startedAt = Date.now();
  const requestedAt = new Date();

  // ── Intelligence Guard: validation + rate limiting + correlation-id ─────
  const guardResult = await intelligenceGuard(request, params, 'retrieval');
  if (guardResult instanceof Response) return guardResult;
  const { companyId, correlationId, responseHeaders, includes } = guardResult;

  // Parse retrieval-specific query params with validation
  const query = request.nextUrl.searchParams.get('q');
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
  const filterType = filterRaw || undefined;
  const mode = request.nextUrl.searchParams.get('mode') || 'hybrid';

  // ── Governance check (optional, requires DB) ──
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
    filter: filterType,
    mode,
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

  // ── Step 2: Execute Retrieval ──
  // WI-16F: Default to hybrid retrieval, with legacy fallback
  let hybridResults: HybridResult[] | null = null;
  let legacyResults: Awaited<ReturnType<typeof RetrievalEngine.search>> | null = null;
  let usedMode: string = mode;
  let stats: Awaited<ReturnType<typeof getHybridStats>> | Awaited<ReturnType<typeof RetrievalEngine.getStats>>;

  try {
    if (mode === 'legacy') {
      // Legacy mode: use original single-signal RetrievalEngine
      const [searchResult, statsResult] = await Promise.all([
        RetrievalEngine.search(sanitizedQuery, topK, filterRaw && VALID_FILTER_TYPES.has(filterRaw as EmbeddableEntityType) ? { type: filterRaw as EmbeddableEntityType } : undefined),
        RetrievalEngine.getStats().catch(() => ({ totalEmbeddings: 0, uniqueEntities: 0, byType: {}, backend: 'empty' as const, indexSizeBytes: 0 })),
      ]);
      legacyResults = searchResult;
      stats = statsResult;
      usedMode = 'legacy';
    } else {
      // Hybrid mode: WI-16F multi-signal retrieval
      const hybridStart = Date.now();
      hybridResults = quickSearch(sanitizedQuery, topK, filterType);

      // Get hybrid stats
      stats = getHybridStats();

      // Record metrics for quality dashboard
      try {
        const { hybridSearch } = require('@/lib/ai-hybrid-retrieval');
        const pkg = hybridSearch({ query: sanitizedQuery, topK, filterType });
        recordRetrievalMetrics(sanitizedQuery, pkg);
      } catch {
        // Metrics recording is non-critical
      }

      logger.info('[intelligence/retrieval] Hybrid search completed', {
        companyId,
        resultCount: hybridResults.length,
        latencyMs: Date.now() - hybridStart,
        mode: 'hybrid',
      });
    }
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : String(err);
    logger.warn('[intelligence/retrieval] Search threw, attempting fallback', { companyId, correlationId, error: rawMessage, mode });

    // Graceful degradation: try legacy if hybrid fails
    if (mode === 'hybrid') {
      try {
        legacyResults = await RetrievalEngine.search(sanitizedQuery, topK, filterRaw && VALID_FILTER_TYPES.has(filterRaw as EmbeddableEntityType) ? { type: filterRaw as EmbeddableEntityType } : undefined);
        stats = await RetrievalEngine.getStats().catch(() => ({ totalEmbeddings: 0, uniqueEntities: 0, byType: {}, backend: 'empty' as const, indexSizeBytes: 0 }));
        usedMode = 'legacy_fallback';
        logger.warn('[intelligence/retrieval] Fell back to legacy mode', { companyId, correlationId });
      } catch (fallbackErr) {
        const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        return Response.json(
          createErrorResponse('retrieval', companyId, `All retrieval methods failed: ${scrubError(fallbackMsg)}`, IntelligenceErrors.ENGINE_FAILED, Date.now() - startedAt, includes),
          { status: 502, headers: responseHeaders },
        );
      }
    } else {
      return Response.json(
        createErrorResponse('retrieval', companyId, scrubError(rawMessage), IntelligenceErrors.ENGINE_FAILED, Date.now() - startedAt, includes),
        { status: 502, headers: responseHeaders },
      );
    }
  }

  // ── Step 3: Compose response (hybrid or legacy) ──
  const durationMs = Date.now() - startedAt;
  const freshness = computeFreshness(company as Parameters<typeof computeFreshness>[0]);

  if (hybridResults) {
    // Hybrid response: includes evidence quality per result
    const { understandQuery } = require('@/lib/ai-hybrid-retrieval');
    const qu = understandQuery(sanitizedQuery);

    const enrichedResults = hybridResults.map(r => ({
      entityId: r.entityId,
      entityType: r.entityType,
      score: Math.max(0, Math.min(1, r.finalScore)),
      snippet: r.snippet,
      // WI-16F.1: Evidence quality breakdown
      evidenceQuality: calculateEvidenceQuality(r, sanitizedQuery, qu),
      // Signal provenance
      activeSignals: r.activeSignals,
      sourceTier: r.sourceTier,
      source: r.source,
      rerankExplanation: r.rerankExplanation,
    }));

    const confidence = enrichedResults.length > 0 ? enrichedResults[0].score : 0;
    const avgEvidenceQuality = enrichedResults.length > 0
      ? enrichedResults.reduce((sum, r) => sum + r.evidenceQuality.overall, 0) / enrichedResults.length
      : 0;

    const hybridStats = stats as Awaited<ReturnType<typeof getHybridStats>>;

    logger.info('[intelligence/retrieval] Hybrid response', {
      companyId,
      query: sanitizedQuery.slice(0, 100),
      resultCount: enrichedResults.length,
      topScore: confidence,
      avgEvidenceQuality,
      mode: usedMode,
      durationMs,
    });

    return Response.json(
      createResponse('retrieval', companyId, {
        companyId,
        results: enrichedResults,
        query: sanitizedQuery,
        resultCount: enrichedResults.length,
        retrievalMode: usedMode,
        stats: {
          totalEntries: hybridStats.totalEntries,
          vocabularySize: hybridStats.vocabularySize,
          byEntityType: hybridStats.byEntityType,
          bySourceTier: hybridStats.bySourceTier,
        },
        quality: {
          averageConfidence: Math.round(confidence * 1000) / 1000,
          averageEvidenceQuality: Math.round(avgEvidenceQuality * 1000) / 1000,
        },
      }, {
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
  } else {
    // Legacy response format (backward compatible)
    const validatedResults = (legacyResults || []).map(r => ({
      ...r,
      score: Math.max(0, Math.min(1, r.score)),
    }));

    const confidence = validatedResults.length > 0 ? validatedResults[0].score : 0;
    const legacyStats = stats as Awaited<ReturnType<typeof RetrievalEngine.getStats>>;

    logger.info('[intelligence/retrieval] Legacy response', {
      companyId,
      query: sanitizedQuery.slice(0, 100),
      resultCount: validatedResults.length,
      topScore: confidence,
      mode: usedMode,
      durationMs,
    });

    return Response.json(
      createResponse('retrieval', companyId, {
        companyId,
        results: validatedResults,
        query: sanitizedQuery,
        resultCount: validatedResults.length,
        retrievalMode: usedMode,
        stats: {
          totalEmbeddings: legacyStats.totalEmbeddings,
          uniqueEntities: legacyStats.uniqueEntities,
          backend: legacyStats.backend,
        },
      }, {
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
}
