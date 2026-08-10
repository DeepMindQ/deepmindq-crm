/**
 * Knowledge Search — RAG search with keyword + pgvector semantic search
 *
 * GET  /api/knowledge/search     — Coverage analysis (no params) or search (q param)
 * POST /api/knowledge/search     — RAG search with filters (screen sends POST)
 *
 * Query params / body fields:
 *   q / query   — search text (required for search)
 *   limit       — max results per source (default 20)
 *   mode        — 'keyword' | 'semantic' | 'hybrid' (default: 'hybrid')
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';
import { apiSuccess, apiError } from '@/lib/apiHelpers';

// ── Embedding pipeline singleton ──
let _pipeline: any = null;
let _pipelineInitPromise: Promise<any> | null = null;

type SearchMode = 'keyword' | 'semantic' | 'hybrid';

/**
 * Lazy-initialise the Xenova feature-extraction pipeline.
 * Returns null if @xenova/transformers is not available or fails to load.
 */
async function getEmbeddingPipeline() {
  if (_pipeline) return _pipeline;
  if (_pipelineInitPromise) return _pipelineInitPromise;

  _pipelineInitPromise = (async () => {
    try {
      const { pipeline } = await import('@xenova/transformers');
      _pipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      logger.info('[knowledge/search] Xenova pipeline initialised');
      return _pipeline;
    } catch (err) {
      logger.warn('[knowledge/search] @xenova/transformers not available, semantic search disabled', { error: err });
      _pipeline = null;
      _pipelineInitPromise = null;
      return null;
    }
  })();

  return _pipelineInitPromise;
}

/**
 * Generate a 384-dim embedding vector for the given text.
 * Returns a Float32Array or null if generation fails.
 */
async function generateEmbedding(text: string): Promise<Float32Array | null> {
  const pipe = await getEmbeddingPipeline();
  if (!pipe) return null;

  try {
    const output: any = await pipe(text, { pooling: 'mean', normalize: true });
    const data = output?.data ?? output;
    if (Array.isArray(data) && data.length === 384) {
      return new Float32Array(data);
    }
    // output.tolist() may also be available
    const list = output?.tolist?.();
    if (Array.isArray(list) && list.length === 384) {
      return new Float32Array(list);
    }
    logger.warn('[knowledge/search] Unexpected embedding shape', { shape: Array.isArray(data) ? data.length : 'unknown' });
    return null;
  } catch (err) {
    logger.error('[knowledge/search] Embedding generation failed', { error: err });
    return null;
  }
}

// ────────────────────────────────────────────────────────────
// Route handlers
// ────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));
    const mode = parseMode(searchParams.get('mode'));

    // If a query is provided, perform search
    if (q) {
      return performSearch(q, limit, mode);
    }

    // No query — return coverage analysis: total entries by category
    return coverageAnalysis();
  } catch (error) {
    logger.error('[knowledge/search] GET failed', { error });
    return apiError('Failed to fetch knowledge data');
  }
}

export async function POST(request: Request) {
  // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json().catch(() => ({}));
    const query = body?.query?.trim();
    const limit = Math.min(50, Math.max(1, parseInt(body?.limit, 10) || 12));
    const mode = parseMode(body?.mode);

    if (!query) {
      return coverageAnalysis();
    }

    return performSearch(query, limit, mode);
  } catch (error) {
    logger.error('[knowledge/search] POST failed', { error });
    return apiError('Failed to search knowledge entries');
  }
}

function parseMode(raw: string | undefined | null): SearchMode {
  if (raw === 'keyword' || raw === 'semantic' || raw === 'hybrid') return raw;
  return 'hybrid';
}

// ────────────────────────────────────────────────────────────
// Coverage analysis
// ────────────────────────────────────────────────────────────

/**
 * Coverage analysis — count KnowledgeEntry records by category.
 */
async function coverageAnalysis() {
  const [total, byCategory] = await Promise.all([
    db.knowledgeEntry.count(),
    db.knowledgeEntry.groupBy({
      by: ['category'],
      _count: { category: true },
    }),
  ]);

  const categoryBreakdown: Record<string, number> = {};
  for (const item of byCategory) {
    categoryBreakdown[item.category] = item._count.category;
  }

  return apiSuccess({
    total,
    byCategory: categoryBreakdown,
  });
}

// ────────────────────────────────────────────────────────────
// Unified search dispatcher
// ────────────────────────────────────────────────────────────

interface SearchResultItem {
  id: string;
  title: string;
  content: string;
  snippet: string;
  relevanceScore: number;
  category: string | null;
  updatedAt: Date | null;
  source?: string;
}

async function performSearch(query: string, limit: number, mode: SearchMode) {
  const keywordResults: SearchResultItem[] =
    mode === 'semantic' ? [] : await keywordSearch(query, limit);

  const semanticResults: SearchResultItem[] =
    mode === 'keyword' ? [] : await semanticSearch(query, limit);

  let allResults: SearchResultItem[];

  if (mode === 'hybrid') {
    // Merge and deduplicate by id, keeping the higher relevanceScore
    const map = new Map<string, SearchResultItem>();
    for (const r of keywordResults) {
      const existing = map.get(r.id);
      if (!existing || r.relevanceScore > existing.relevanceScore) {
        map.set(r.id, r);
      }
    }
    for (const r of semanticResults) {
      const existing = map.get(r.id);
      if (!existing) {
        map.set(r.id, r);
      } else {
        // Boost relevance if found by both methods
        existing.relevanceScore = Math.min(100, Math.round(existing.relevanceScore * 1.1 + r.relevanceScore * 0.3));
        existing.source = 'hybrid';
      }
    }
    allResults = Array.from(map.values());
  } else {
    allResults = [...keywordResults, ...semanticResults];
  }

  // Sort by relevance descending
  allResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return apiSuccess({
    results: allResults,
    totalMatches: allResults.length,
    mode,
    breakdown: {
      keyword: keywordResults.length,
      semantic: semanticResults.length,
    },
  });
}

// ────────────────────────────────────────────────────────────
// Keyword search (existing logic, extracted)
// ────────────────────────────────────────────────────────────

/**
 * Simple text-based search across KnowledgeEntry title and content.
 */
async function keywordSearch(query: string, limit: number): Promise<SearchResultItem[]> {
  const results = await db.knowledgeEntry.findMany({
    where: {
      OR: [
        { content: { contains: query, mode: 'insensitive' } },
      ],
    },
    take: limit,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      category: true,
      content: true,
      confidence: true,
      updatedAt: true,
    },
  });

  const formatted = results.map((entry) => {
    // Extract a ~150-char snippet around the first match
    const lowerContent = entry.content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const idx = lowerContent.indexOf(lowerQuery);
    let snippet = entry.content.slice(0, 200);
    if (idx >= 0) {
      const start = Math.max(0, idx - 60);
      const end = Math.min(entry.content.length, idx + query.length + 100);
      snippet =
        (start > 0 ? '...' : '') +
        entry.content.slice(start, end) +
        (end < entry.content.length ? '...' : '');
    }

    return {
      id: entry.id,
      title: `${entry.category} — Knowledge Entry`,
      content: snippet,
      snippet,
      relevanceScore: Math.round(entry.confidence * 100),
      category: entry.category,
      updatedAt: entry.updatedAt,
      source: 'keyword' as const,
    };
  });

  // Also search CapabilityAssets for broader knowledge search
  const capResults = await db.capabilityAsset.findMany({
    where: {
      AND: [
        { isActive: true },
        {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { summary: { contains: query, mode: 'insensitive' } },
            { content: { contains: query, mode: 'insensitive' } },
          ],
        },
      ],
    },
    take: limit,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      summary: true,
      content: true,
      category: true,
      updatedAt: true,
    },
  });

  const capFormatted: SearchResultItem[] = capResults.map((cap) => {
    let snippet = cap.summary || (cap.content?.slice(0, 200) ?? '');
    return {
      id: cap.id,
      title: cap.title,
      content: snippet,
      snippet,
      relevanceScore: 75, // base relevance for text match
      category: cap.category,
      updatedAt: cap.updatedAt,
      source: 'keyword' as const,
    };
  });

  return [...formatted, ...capFormatted];
}

// ────────────────────────────────────────────────────────────
// Semantic search via pgvector
// ────────────────────────────────────────────────────────────

/**
 * pgvector cosine similarity search — PRIMARY search method (P1.4).
 *
 * Queries RetrievalIndexEntry.embedding_vector first (richer schema with
 * content, snippet, source, metadata, entityType, entityId). Falls back to
 * the Embedding table if RetrievalIndexEntry has no vectors.
 *
 * Uses parameterized queries (following retrieval-engine.ts pattern) for
 * safety — the vector itself is generated, not user-supplied, but we
 * parameterize for consistency.
 *
 * Gracefully degrades to empty results if the pipeline or pgvector is unavailable.
 */
async function semanticSearch(query: string, limit: number): Promise<SearchResultItem[]> {
  const embedding = await generateEmbedding(query);
  if (!embedding) {
    logger.info('[knowledge/search] Skipping semantic search — no embedding generated');
    return [];
  }

  const vectorStr = `[${Array.from(embedding).map((v) => v.toFixed(6)).join(',')}]`;

  // Validate dimensions
  const components = vectorStr.split(',');
  if (components.length !== 384) {
    logger.warn('[knowledge/search] Unexpected vector dimensions', { dims: components.length });
    return [];
  }

  const safeLimit = Math.max(1, Math.min(limit, 50));

  // ── Primary: RetrievalIndexEntry (richer schema) ──
  try {
    const rows: any[] = await db.$queryRawUnsafe(
      `SELECT id, "entityId", "entityType", content, snippet, source, metadata,
              1 - ("embedding_vector" <=> $1::vector) AS similarity
       FROM "RetrievalIndexEntry"
       WHERE "embedding_vector" IS NOT NULL
       ORDER BY "embedding_vector" <=> $1::vector
       LIMIT $2`,
      vectorStr,
      safeLimit,
    );

    if (rows.length > 0) {
      logger.info('[knowledge/search] Semantic search hit RetrievalIndexEntry', { count: rows.length });
      const results: SearchResultItem[] = rows.map((row) => ({
        id: row.entityId || row.id,
        title: `${row.entityType || 'entry'} — Semantic Match`,
        content: (row.content || row.snippet || '')?.slice(0, 500) ?? '',
        snippet: (row.snippet || row.content || '')?.slice(0, 200) ?? '',
        relevanceScore: Math.round(Math.max(0, Math.min(1, row.similarity ?? 0)) * 100),
        category: row.entityType ?? null,
        updatedAt: null,
        source: 'semantic' as const,
      }));
      return results;
    }

    // RetrievalIndexEntry returned 0 rows — fall through to Embedding table
    logger.info('[knowledge/search] RetrievalIndexEntry had no vectors, falling back to Embedding table');
  } catch (err) {
    logger.warn('[knowledge/search] RetrievalIndexEntry pgvector query failed, trying Embedding table', { error: err });
  }

  // ── Fallback: Embedding table ──
  try {
    const rows: any[] = await db.$queryRawUnsafe(
      `SELECT id, "entityType" AS "entityType", "entityId" AS "entityId",
             "sourceText" AS "sourceText",
             1 - ("embedding_vector" <=> $1::vector) AS similarity
       FROM "Embedding"
       WHERE "embedding_vector" IS NOT NULL
       ORDER BY "embedding_vector" <=> $1::vector
       LIMIT $2`,
      vectorStr,
      safeLimit,
    );

    const results: SearchResultItem[] = rows.map((row) => ({
      id: row.entityId || row.id,
      title: `${row.entityType} — Semantic Match`,
      content: row.sourceText?.slice(0, 500) ?? '',
      snippet: row.sourceText?.slice(0, 200) ?? '',
      relevanceScore: Math.round(Math.max(0, Math.min(1, row.similarity ?? 0)) * 100),
      category: row.entityType ?? null,
      updatedAt: null,
      source: 'semantic' as const,
    }));

    return results;
  } catch (err) {
    logger.warn('[knowledge/search] pgvector query failed (pgvector may not be enabled)', { error: err });
    return [];
  }
}
