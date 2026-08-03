/**
 * Intelligence API — Knowledge Endpoint
 *
 * GET /api/intelligence/knowledge/{id}
 *
 * Returns all knowledge for a company through the Intelligence API contract.
 * Wires KnowledgeFabric (structured entries) + KnowledgeIngestionPipeline (stats).
 *
 * Query params:
 *   ?include=ingestion  — include ingestion pipeline statistics
 *
 * Non-throwing: always returns IntelligenceResponse envelope.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  createResponse,
  createErrorResponse,
  computeFreshness,
} from '@/lib/intelligence-api/intelligence-middleware';
import { IntelligenceErrors } from '@/lib/intelligence-api/types';
import type {
  IntelligenceKnowledgeOutput,
  IntelligenceKnowledgeGroup,
  IntelligenceKnowledgeEntry,
  IntelligenceKnowledgeIngestionStats,
} from '@/lib/intelligence-api/types';
import { intelligenceGuard } from '@/lib/intelligence-api/guard';
import { scrubError } from '@/lib/intelligence-api/handler';
import { KnowledgeIngestionPipeline } from '@/lib/knowledge-ingestion-pipeline';
import { runGovernanceChecks } from '@/lib/ai-governance';
import { getResearchContext } from '@/lib/intelligence-contract';
import { checkApiAuth } from '@/lib/api-auth';

// ── GET ─────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

const started = Date.now();
  const requestedAt = new Date();

  // ── Intelligence Guard: validation + rate limiting + correlation-id ─────
  const guardResult = await intelligenceGuard(request, params, 'knowledge');
  if (guardResult instanceof Response) return guardResult;
  const { companyId, correlationId, responseHeaders, includes } = guardResult;

  logger.info('[intelligence/knowledge] Processing', { companyId, correlationId });

  // Ticket 3: Run real governance check for response metadata (requires DB)
  let governanceMeta: { passed: boolean; generationType: string; checks: Record<string, { passed: boolean; message: string }> } | undefined;
  try {
    if (process.env.DATABASE_URL?.startsWith('postgres')) {
      const researchCtx = await getResearchContext(companyId);
      const govResult = await runGovernanceChecks({ companyId, generationType: 'knowledge_retrieval', researchContext: researchCtx });
      governanceMeta = {
        passed: govResult.passed,
        generationType: 'knowledge_retrieval',
        checks: Object.fromEntries(Object.entries(govResult.checks).map(([k, v]) => [k, { passed: v.passed, message: v.message }])),
      };
    }
  } catch {
    // Governance metadata is optional — degrade gracefully
  }

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
    logger.error('[intelligence/knowledge] DB lookup failed', { companyId, correlationId, error: rawMessage });
    return Response.json(
      createErrorResponse('knowledge', companyId, `Company lookup failed: ${scrubError(rawMessage)}`, IntelligenceErrors.INTELLIGENCE_UNAVAILABLE, Date.now() - started, includes),
      { status: 500, headers: responseHeaders },
    );
  }

  if (!company) {
    return Response.json(
      createErrorResponse('knowledge', companyId, 'Company not found', IntelligenceErrors.COMPANY_NOT_FOUND, Date.now() - started, includes),
      { status: 404, headers: responseHeaders },
    );
  }

  try {

    // Fetch all knowledge entries for this company — using typed select
    const entries = await db.knowledgeEntry.findMany({
      where: { companyId },
      orderBy: [{ category: 'asc' }, { updatedAt: 'desc' }],
      take: 100,
      select: {
        id: true,
        category: true,
        subCategory: true,
        content: true,
        source: true,
        confidence: true,
        version: true,
        updatedAt: true,
      },
    });

    // Build groups
    const groupMap = new Map<string, IntelligenceKnowledgeEntry[]>();
    for (const entry of entries) {
      const mapped: IntelligenceKnowledgeEntry = {
        id: entry.id,
        category: entry.category,
        subCategory: entry.subCategory,
        content: entry.content,
        source: entry.source,
        confidence: entry.confidence,
        version: entry.version,
        updatedAt: entry.updatedAt.toISOString(),
      };

      if (!groupMap.has(entry.category)) {
        groupMap.set(entry.category, []);
      }
      groupMap.get(entry.category)!.push(mapped);
    }

    const groups: IntelligenceKnowledgeGroup[] = Array.from(groupMap.entries())
      .map(([category, groupEntries]) => ({
        category,
        entryCount: groupEntries.length,
        entries: groupEntries,
      }))
      .sort((a, b) => b.entryCount - a.entryCount);

    // Compute top categories (top 5)
    const topCategories = groups.slice(0, 5).map(g => ({
      category: g.category,
      count: g.entryCount,
    }));

    // Compute average confidence
    const avgConfidence = entries.length > 0
      ? entries.reduce((sum, e) => sum + e.confidence, 0) / entries.length
      : 0;

    // Ingestion stats (optional — ?include=ingestion)
    let ingestionStats: IntelligenceKnowledgeIngestionStats | undefined = undefined;
    if (includes.has('ingestion')) {
      try {
        ingestionStats = await KnowledgeIngestionPipeline.getStats() ?? undefined;
      } catch (err) {
        logger.warn('[intelligence/knowledge] failed to fetch ingestion stats', {
          correlationId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const data: IntelligenceKnowledgeOutput = {
      companyId,
      groups,
      totalEntries: entries.length,
      topCategories,
      averageConfidence: Math.round(avgConfidence * 1000) / 1000,
      ingestionStats,
    };

    const freshness = computeFreshness(company as Parameters<typeof computeFreshness>[0]);
    const durationMs = Date.now() - started;

    return Response.json(
      createResponse('knowledge', companyId, data, {
        durationMs,
        includes,
        cached: false,
        confidence: avgConfidence,
        freshness,
        requestedAt,
        respondedAt: new Date(),
        ...(governanceMeta && { governance: governanceMeta }),
      }),
      { headers: { ...responseHeaders, 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' } },
    );
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    logger.error('[intelligence/knowledge] unexpected error', { error: rawMsg, companyId, correlationId });
    return Response.json(
      createErrorResponse('knowledge', companyId, scrubError(rawMsg), IntelligenceErrors.INTELLIGENCE_UNAVAILABLE, Date.now() - started, includes),
      { status: 500, headers: responseHeaders },
    );
  }
}
