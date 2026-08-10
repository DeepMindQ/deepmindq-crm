/**
 * Phase 9.4 — Knowledge Retrieval Index API
 *
 * GET /api/knowledge/index  — Query retrieval index entries
 *                              ?entityType=company_signal
 *                              &companyId=<id>
 *                              &sourceTier=premium
 *                              &limit=50&offset=0
 *                              &include=corpusStats
 *
 * Provides visibility into the retrieval index for debugging and admin oversight.
 * Actual search uses raw SQL ($queryRaw) with pgvector — this route is for
 * inspection and corpus statistics only.
 *
 * Auth: Authenticated users
 */

import { NextResponse } from 'next/server';
import { checkApiAuth, requireAdminRole } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const VALID_SOURCE_TIERS = ['premium', 'standard', 'low', 'unknown'];
const MAX_LIMIT = 100;

// ═══════════════════════════════════════════════════════════════
// GET /api/knowledge/index — Query retrieval index entries
// ═══════════════════════════════════════════════════════════════
export async function GET(request: Request) {
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');
    const companyId = searchParams.get('companyId');
    const sourceTier = searchParams.get('sourceTier');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), MAX_LIMIT);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);
    const include = searchParams.get('include');

    // Build where clause
    const where: Record<string, unknown> = {};
    if (entityType) {
      where.entityType = entityType;
    }
    if (companyId) {
      where.companyId = companyId;
    }
    if (sourceTier && VALID_SOURCE_TIERS.includes(sourceTier)) {
      where.sourceTier = sourceTier;
    }

    // Fetch index entries (omit heavy fields: content, vector, termFrequencies)
    const [entries, total] = await Promise.all([
      db.retrievalIndexEntry.findMany({
        where,
        orderBy: { indexedAtMs: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          entityId: true,
          entityType: true,
          snippet: true,
          source: true,
          sourceDate: true,
          sourceTier: true,
          companyId: true,
          isGlobal: true,
          createdBy: true,
          sourceAttribution: true,
          indexedAtMs: true,
          createdAtMs: true,
          updatedAtMs: true,
          // Intentionally omit: content, vector, termFrequencies, entities, metadata
        },
      }),
      db.retrievalIndexEntry.count({ where }),
    ]);

    const response: Record<string, unknown> = {
      success: true,
      data: entries,
      meta: { total, limit, offset },
      timestamp: new Date().toISOString(),
    };

    // Include corpus stats if requested
    if (include === 'corpusStats') {
      try {
        const corpusStats = await db.retrievalCorpusStats.findUnique({
          where: { id: 'singleton_corpus' },
        });

        let parsedDocFreq: Record<string, number> = {};
        if (corpusStats?.documentFrequency) {
          try {
            parsedDocFreq = JSON.parse(corpusStats.documentFrequency);
          } catch {
            // If parsing fails, return raw value
          }
        }

        response.corpusStats = {
          totalDocuments: corpusStats?.totalDocuments ?? 0,
          lastUpdatedAtMs: corpusStats?.lastUpdatedAtMs ?? 0,
          vocabularySize: Object.keys(parsedDocFreq).length,
          topTermsByFrequency: Object.entries(parsedDocFreq)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 20)
            .map(([term, count]) => ({ term, docFrequency: count })),
        };
      } catch (err) {
        logger.warn('[api/knowledge/index] Failed to fetch corpus stats:', { error: err });
        response.corpusStats = null;
      }
    }

    return NextResponse.json(response);
  } catch (err) {
    logger.error('[api/knowledge/index] GET error:', { error: err });
    return NextResponse.json(
      { success: false, error: 'Failed to query retrieval index', timestamp: new Date().toISOString() },
      { status: 500 },
    );
  }
}
