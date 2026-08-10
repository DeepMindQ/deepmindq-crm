/**
 * RetrievalEngine — Phase B Foundation Engine #3
 * ===============================================
 *
 * Local semantic search using @xenova/transformers (all-MiniLM-L6-v2,
 * 384-dim, $0 cost) with a TF-IDF fallback when transformers can't load.
 *
 * Persists embeddings to the Embedding Prisma table (vector stored as JSON
 * string). Maintains an in-memory Map for O(1) lookup. Brute-force cosine
 * similarity for search — fast enough for ~10K entries.
 *
 * AUTO-BUILD BEHAVIOR
 * -------------------
 * On first search, if the DB has no embeddings, the engine auto-builds
 * from raw entities (capability assets, AI insights, company signals).
 * This means the engine is useful from day one without an explicit
 * embedding job.
 *
 * NON-THROWING CONTRACT
 * ---------------------
 * Every method returns a structured result. If transformers fail to load,
 * the engine falls back to TF-IDF (using the existing src/lib/embeddings.ts).
 * If the DB is unavailable, in-memory search still works on whatever was
 * loaded before the failure.
 */

import type { Pipeline } from '@xenova/transformers';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { cosineSimilarity } from '@/lib/embeddings';

// ─── Types ──────────────────────────────────────────────────────────────

export type EmbeddableEntityType =
  | 'capability_asset'
  | 'ai_insight'
  | 'company_signal'
  | 'company'
  | 'contact'
  | 'opportunity'
  | 'evidence'
  | 'knowledge_entry';

export interface EmbeddingResult {
  entityId: string;
  entityType: EmbeddableEntityType;
  vector: Float64Array;
  dimensions: number;
  sourceText: string;
  model: string;
  /** Whether this embedding was loaded from cache or freshly computed. */
  cached: boolean;
}

export interface RetrievalResult {
  entityId: string;
  entityType: EmbeddableEntityType;
  score: number; // 0-1 cosine similarity
  snippet: string;
}

export interface RetrievalStats {
  totalEmbeddings: number;
  uniqueEntities: number;
  byType: Record<string, number>;
  backend: 'transformer' | 'tfidf' | 'empty';
  indexSizeBytes: number;
}

// ─── Constants ──────────────────────────────────────────────────────────

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
const EMBEDDING_DIM = 384;
const MAX_INDEX_SIZE = 100_000;

// ─── Lazy-loaded Transformer Pipeline ──────────────────────────────────

type TransformerPipelineFn = (text: string) => Promise<{ data: number[] }>;

let transformerPipeline: TransformerPipelineFn | null = null;
let transformerLoadAttempted = false;
let transformerLoadError: string | null = null;

/**
 * Lazy-load the transformer pipeline on first use.
 * Cold start ~3-4 seconds; subsequent calls are fast (model stays in memory).
 */
async function getTransformerPipeline(): Promise<TransformerPipelineFn | null> {
  if (transformerPipeline) return transformerPipeline;
  if (transformerLoadAttempted) return null; // Don't retry after failure
  transformerLoadAttempted = true;

  try {
    logger.info('[retrieval-engine] loading transformer model (cold start)...');
    const transformers = await import('@xenova/transformers');
    const pipeline = (await transformers.pipeline('feature-extraction', MODEL_NAME)) as unknown as Pipeline;
    transformerPipeline = async (text: string) => {
      const output = await pipeline(text, { pooling: 'mean', normalize: true });
      return { data: Array.from(output.data as Float32Array) };
    };
    logger.info('[retrieval-engine] transformer model loaded successfully');
    return transformerPipeline;
  } catch (err) {
    transformerLoadError = err instanceof Error ? err.message : String(err);
    logger.error(`[retrieval-engine] transformer load failed, will use TF-IDF fallback: ${transformerLoadError}`);
    return null;
  }
}

// ─── In-Memory Index ────────────────────────────────────────────────────

interface IndexEntry {
  entityId: string;
  entityType: EmbeddableEntityType;
  vector: Float64Array;
  sourceText: string;
  snippet: string;
}

const inMemoryIndex = new Map<string, IndexEntry>();
const indexTimestamps = new Map<string, number>(); // tracks insertion order for eviction
let indexLoaded = false;

/** Evict the oldest entry when the index exceeds MAX_INDEX_SIZE */
function evictOldestIfNeeded(): void {
  if (inMemoryIndex.size < MAX_INDEX_SIZE) return;
  // Find and remove the oldest entry by timestamp
  let oldestKey: string | null = null;
  let oldestTime = Infinity;
  for (const [key, ts] of indexTimestamps) {
    if (ts < oldestTime) {
      oldestTime = ts;
      oldestKey = key;
    }
  }
  if (oldestKey) {
    inMemoryIndex.delete(oldestKey);
    indexTimestamps.delete(oldestKey);
  }
}

// ─── Hashing ────────────────────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback for environments without crypto.subtle
    let h = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      h = (h << 5) - h + char;
      h |= 0;
    }
    return `fallback_${Math.abs(h).toString(16)}`;
  }
}

// ─── TF-IDF Fallback ────────────────────────────────────────────────────

/**
 * Simple TF-IDF fallback when transformers can't load.
 * Reuses the existing src/lib/embeddings.ts cosineSimilarity function.
 */
function tfidfEmbed(text: string): Float64Array {
  // Very simple: tokenize, hash to fixed dim, normalize
  const vec = new Float64Array(EMBEDDING_DIM);
  const tokens = text.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
  for (const token of tokens) {
    let h = 0;
    for (let i = 0; i < token.length; i++) {
      h = (h << 5) - h + token.charCodeAt(i);
      h |= 0;
    }
    const idx = Math.abs(h) % EMBEDDING_DIM;
    vec[idx] += 1;
  }
  // L2 normalize
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  }
  return vec;
}

// ─── Embedding Function ─────────────────────────────────────────────────

/**
 * Embed a single text. Uses transformers if available, falls back to TF-IDF.
 * Non-throwing — returns a result with vector (possibly zero-vector on failure).
 */
export async function embed(text: string): Promise<EmbeddingResult> {
  const sourceText = text.slice(0, 8000); // cap input length
  const pipeline = await getTransformerPipeline();

  let vector: Float64Array;
  let model: string;

  if (pipeline) {
    try {
      const { data } = await pipeline(sourceText);
      vector = Float64Array.from(data);
      model = MODEL_NAME;
    } catch (err) {
      logger.error(`[retrieval-engine] transformer call failed, falling back to TF-IDF: ${err instanceof Error ? err.message : err}`);
      vector = tfidfEmbed(sourceText);
      model = 'tfidf-fallback';
    }
  } else {
    vector = tfidfEmbed(sourceText);
    model = 'tfidf-fallback';
  }

  return {
    entityId: '', // caller sets this
    entityType: 'knowledge_entry', // caller sets this
    vector,
    dimensions: vector.length,
    sourceText,
    model,
    cached: false,
  };
}

// ─── Entity Embedding (with persistence) ────────────────────────────────

/**
 * Embed an entity and persist to DB. If a cached embedding exists with
 * the same text hash, returns the cached version (saves compute).
 */
export async function embedEntity(
  entityType: EmbeddableEntityType,
  entityId: string,
  sourceText: string,
  forceRefresh = false,
): Promise<EmbeddingResult> {
  const textHash = await sha256(sourceText);

  // Check cache unless forceRefresh
  if (!forceRefresh) {
    try {
      const existing = await db.embedding.findUnique({ where: { entityId } });
      if (existing && existing.textHash === textHash) {
        const vector = Float64Array.from(JSON.parse(existing.vector) as number[]);
        // Cache in memory
        evictOldestIfNeeded();
        inMemoryIndex.set(entityId, {
          entityId,
          entityType,
          vector,
          sourceText,
          snippet: sourceText.slice(0, 200),
        });
        indexTimestamps.set(entityId, Date.now());
        return {
          entityId,
          entityType,
          vector,
          dimensions: existing.dimensions,
          sourceText,
          model: existing.model,
          cached: true,
        };
      }
    } catch (err) {
      logger.error(`[retrieval-engine] cache check failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Compute fresh
  const result = await embed(sourceText);
  result.entityId = entityId;
  result.entityType = entityType;

  // Persist (dual-write: JSON for backward compat + pgvector for native search)
  try {
    const vectorJson = JSON.stringify(Array.from(result.vector));
    await db.embedding.upsert({
      where: { entityId },
      create: {
        entityType,
        entityId,
        sourceText,
        textHash,
        vector: vectorJson,
        model: result.model,
        dimensions: result.dimensions,
      },
      update: {
        entityType,
        sourceText,
        textHash,
        vector: vectorJson,
        model: result.model,
        dimensions: result.dimensions,
      },
    });

    // Phase 0.4: Native pgvector dual-write (non-blocking — fails gracefully)
    // UPDATE existing row (Prisma upsert already handles the INSERT with all NOT NULL columns above)
    try {
      await db.$executeRawUnsafe(
        `UPDATE "Embedding" SET "embedding_vector" = $1::vector WHERE "entityId" = $2 AND "embedding_vector" IS DISTINCT FROM $1::vector`,
        `[${Array.from(result.vector).join(',')}]`,
        entityId
      );
    } catch (pgvectorErr) {
      // pgvector column may not exist yet — non-blocking
      logger.warn(`[retrieval-engine] pgvector write skipped: ${pgvectorErr instanceof Error ? pgvectorErr.message : pgvectorErr}`);
    }
  } catch (err) {
    logger.error(`[retrieval-engine] persist failed: ${err instanceof Error ? err.message : err}`);
  }

  // Cache in memory
  evictOldestIfNeeded();
  inMemoryIndex.set(entityId, {
    entityId,
    entityType,
    vector: result.vector,
    sourceText,
    snippet: sourceText.slice(0, 200),
  });
  indexTimestamps.set(entityId, Date.now());

  return result;
}

// ─── Search ─────────────────────────────────────────────────────────────

/**
 * Semantic search across all indexed entities.
 * Returns top-K results sorted by cosine similarity (highest first).
 *
 * Phase 0.4: Tries native pgvector search first (fast, scalable).
 * Falls back to in-memory brute-force cosine similarity if pgvector is unavailable.
 */
export async function search(
  query: string,
  topK = 5,
  filter?: { type?: EmbeddableEntityType },
): Promise<RetrievalResult[]> {
  if (!query || !query.trim()) return [];

  // Phase 0.4: Try pgvector native search first (scalable, indexed)
  try {
    const pgResults = await searchPgVector(query, topK, filter);
    if (pgResults.length > 0) return pgResults;
  } catch {
    // pgvector unavailable — fall through to in-memory search
  }

  // Fallback: in-memory brute-force cosine similarity
  if (inMemoryIndex.size === 0) {
    await loadIndexFromDB();
  }
  if (inMemoryIndex.size === 0) {
    await buildIndexFromRawEntities();
  }
  if (inMemoryIndex.size === 0) return [];

  const queryEmbedding = await embed(query);
  const results: RetrievalResult[] = [];

  for (const entry of inMemoryIndex.values()) {
    if (filter?.type && entry.entityType !== filter.type) continue;
    const score = cosineSimilarity(
      Array.from(queryEmbedding.vector) as unknown as Float64Array,
      entry.vector,
    );
    results.push({
      entityId: entry.entityId,
      entityType: entry.entityType,
      score: Math.max(0, Math.min(1, score)),
      snippet: entry.snippet,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}

// ─── Index Loading / Building ───────────────────────────────────────────

/**
 * Load all embeddings from DB into the in-memory index.
 * Called once on first search if index is empty.
 */
export async function loadIndexFromDB(): Promise<void> {
  if (indexLoaded) return;
  indexLoaded = true;

  try {
    const embeddings = await db.embedding.findMany({ take: MAX_INDEX_SIZE });
    for (const emb of embeddings) {
      try {
        const vector = Float64Array.from(JSON.parse(emb.vector) as number[]);
        inMemoryIndex.set(emb.entityId, {
          entityId: emb.entityId,
          entityType: emb.entityType as EmbeddableEntityType,
          vector,
          sourceText: emb.sourceText,
          snippet: emb.sourceText.slice(0, 200),
        });
        indexTimestamps.set(emb.entityId, Date.now());
      } catch (err) {
        logger.error(`[retrieval-engine] failed to parse embedding for ${emb.entityId}`);
      }
    }
    logger.info(`[retrieval-engine] loaded ${inMemoryIndex.size} embeddings from DB`);
  } catch (err) {
    logger.error(`[retrieval-engine] loadIndexFromDB failed: ${err instanceof Error ? err.message : err}`);
  }
}

/**
 * Build the index from raw entities when DB has no embeddings.
 * Pulls capability assets, AI insights, and company signals.
 */
export async function buildIndexFromRawEntities(): Promise<void> {
  logger.info('[retrieval-engine] building index from raw entities...');

  // Pull capability assets
  try {
    const assets = await db.capabilityAsset.findMany({ take: 500 });
    for (const asset of assets) {
      const text = [
        asset.title,
        asset.summary,
        asset.category ?? '',
        asset.businessProblem ?? '',
        asset.keywords ?? '',
      ].filter(Boolean).join('\n');
      if (text.trim()) {
        await embedEntity('capability_asset', asset.id, text).catch(() => {});
      }
    }
  } catch (err) {
    logger.error(`[retrieval-engine] capability asset embedding failed: ${err instanceof Error ? err.message : err}`);
  }

  // Pull recent AI insights
  try {
    const insights = await db.aIInsight.findMany({
      take: 200,
      orderBy: { createdAt: 'desc' },
    });
    for (const ins of insights) {
      const text = [ins.title, ins.description, ins.reasoning].filter(Boolean).join('\n');
      if (text.trim()) {
        await embedEntity('ai_insight', ins.id, text).catch(() => {});
      }
    }
  } catch (err) {
    logger.error(`[retrieval-engine] AI insight embedding failed: ${err instanceof Error ? err.message : err}`);
  }

  // Pull recent company signals
  try {
    const signals = await db.companySignal.findMany({
      take: 200,
      orderBy: { createdAt: 'desc' },
    });
    for (const sig of signals) {
      const text = [sig.title, sig.description, sig.signalType, sig.businessImpact].filter(Boolean).join('\n');
      if (text.trim()) {
        await embedEntity('company_signal', sig.id, text).catch(() => {});
      }
    }
  } catch (err) {
    logger.error(`[retrieval-engine] company signal embedding failed: ${err instanceof Error ? err.message : err}`);
  }

  logger.info(`[retrieval-engine] index build complete: ${inMemoryIndex.size} entries`);
}

/**
 * Force a full rebuild of the index from DB + raw entities.
 * Useful after schema changes or batch imports.
 */
export async function rebuildIndex(): Promise<RetrievalStats> {
  inMemoryIndex.clear();
  indexTimestamps.clear();
  indexLoaded = false;
  transformerLoadAttempted = false; // retry transformer load

  await loadIndexFromDB();
  if (inMemoryIndex.size === 0) {
    await buildIndexFromRawEntities();
  }

  return getStats();
}

/**
 * Return current index statistics.
 */
export async function getStats(): Promise<RetrievalStats> {
  const byType: Record<string, number> = {};
  let totalBytes = 0;
  for (const entry of inMemoryIndex.values()) {
    byType[entry.entityType] = (byType[entry.entityType] ?? 0) + 1;
    totalBytes += entry.vector.byteLength + entry.sourceText.length;
  }

  let backend: 'transformer' | 'tfidf' | 'empty' = 'empty';
  if (inMemoryIndex.size === 0) backend = 'empty';
  else if (transformerPipeline) backend = 'transformer';
  else backend = 'tfidf';

  return {
    totalEmbeddings: inMemoryIndex.size,
    uniqueEntities: inMemoryIndex.size,
    byType,
    backend,
    indexSizeBytes: totalBytes,
  };
}

// ─── Phase 0.4: pgvector Search (native cosine distance) ──────────────

/**
 * Search using native pgvector cosine distance operator.
 * Falls back to in-memory search if pgvector is not available.
 * Uses HNSW index for approximate nearest neighbor with high recall.
 */
export async function searchPgVector(
  query: string,
  topK = 5,
  filter?: { type?: EmbeddableEntityType },
): Promise<RetrievalResult[]> {
  const queryEmbedding = await embed(query);
  const vectorStr = `[${Array.from(queryEmbedding.vector).join(',')}]`;

  try {
    // Parameterized query to prevent SQL injection (filter.type is user-facing)
    const typeFilter = filter?.type ? `AND "entityType" = $3` : '';
    const params: unknown[] = [vectorStr, topK];
    if (filter?.type) params.push(filter.type);

    const results = await db.$queryRawUnsafe<Array<{
      entityId: string;
      entityType: string;
      score: number;
      snippet: string;
    }>>(
      `SELECT "entityId", "entityType",
              1 - ("embedding_vector" <=> $1::vector) as score,
              SUBSTR("sourceText", 1, 200) as snippet
       FROM "Embedding"
       WHERE "embedding_vector" IS NOT NULL ${typeFilter}
       ORDER BY "embedding_vector" <=> $1::vector
       LIMIT $2`,
      ...params
    );

    return results.map((r) => ({
      entityId: r.entityId,
      entityType: r.entityType as EmbeddableEntityType,
      score: Math.max(0, Math.min(1, r.score)),
      snippet: r.snippet,
    }));
  } catch (err) {
    logger.warn(`[retrieval-engine] pgvector search failed, falling back to in-memory: ${err instanceof Error ? err.message : err}`);
    return []; // let caller (search()) fall through to in-memory brute-force
  }
}

// ─── RetrievalEngine Object (for barrel export) ─────────────────────────

export const RetrievalEngine = {
  embed,
  embedEntity,
  search,
  searchPgVector,
  loadIndexFromDB,
  buildIndexFromRawEntities,
  rebuildIndex,
  getStats,
};
