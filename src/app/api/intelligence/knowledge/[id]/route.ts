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
  parseIncludeParams,
} from '@/lib/intelligence-api/middleware';
import type {
  IntelligenceKnowledgeOutput,
  IntelligenceKnowledgeGroup,
  IntelligenceKnowledgeEntry,
  IntelligenceKnowledgeIngestionStats,
} from '@/lib/intelligence-api/types';
import { KnowledgeIngestionPipeline } from '@/lib/knowledge-ingestion-pipeline';

// ── GET ─────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const started = Date.now();
  const { id: companyId } = await params;

  try {
    // Verify company exists
    const company = await db.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      return Response.json(
        createErrorResponse('knowledge', companyId, 'Company not found', 'COMPANY_NOT_FOUND', Date.now() - started),
        { status: 404 },
      );
    }

    const { includes } = parseIncludeParams(request);

    // Fetch all knowledge entries for this company, grouped by category
    const entries = await db.knowledgeEntry.findMany({
      where: { companyId },
      orderBy: [{ category: 'asc' }, { updatedAt: 'desc' }],
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
    let ingestionStats: IntelligenceKnowledgeIngestionStats | null = null;
    if (includes.has('ingestion' as never)) {
      try {
        ingestionStats = await KnowledgeIngestionPipeline.getStats();
      } catch (err) {
        logger.warn('[intelligence/knowledge] failed to fetch ingestion stats', {
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

    return Response.json(
      createResponse('knowledge', companyId, data, {
        durationMs: Date.now() - started,
        includes,
        cached: false,
        confidence: avgConfidence,
      }),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[intelligence/knowledge] unexpected error', { error: msg, companyId });
    return Response.json(
      createErrorResponse('knowledge', companyId, msg, 'INTELLIGENCE_UNAVAILABLE', Date.now() - started),
      { status: 500 },
    );
  }
}
