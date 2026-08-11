/**
 * In-Memory Vector Index (C-02)
 *
 * Stores { id, vector } pairs and provides top-K search via cosine similarity.
 * Supports DUAL embedding modes:
 *   1. **Primary**: Transformer embeddings via @xenova/transformers (all-MiniLM-L6-v2, 384-dim)
 *      — shared pipeline singleton from retrieval-engine.ts
 *   2. **Fallback**: TF-IDF (original behavior)
 *
 * Non-throwing design — if transformers are unavailable, silently falls back to TF-IDF.
 */

import {
  cosineSimilarity,
  assetToText,
} from './embeddings';

import { embed as transformerEmbed } from '@/lib/engines/retrieval-engine';

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */

export interface VectorEntry {
  id: string;
  vector: Float64Array;
}

export type EmbeddingMode = 'transformer' | 'tfidf';

export interface IndexBuildInfo {
  builtAt: string;
  assetCount: number;
  vocabSize: number;
  /** Which embedding mode was used to build this index. */
  embeddingMode: EmbeddingMode;
}

interface CapabilityRecord {
  id: string;
  title: string;
  summary: string;
  category: string;
  serviceLine?: string | null;
  targetIndustries?: string | null;
  targetRoles?: string | null;
  problems?: string | null;
  evidence?: string | null;
  content?: string | null;
  targetCompanySizes?: string | null;
  tags?: string | null;
  upvotes?: number;
  downvotes?: number;
  usedInEmails?: number;
}

/* ═══════════════════════════════════════════════════
   VectorIndex Class
   ═══════════════════════════════════════════════════ */

export class VectorIndex {
  private entries: Map<string, VectorEntry> = new Map();
  private vocab: Map<string, number> = new Map();
  private idf: Float64Array = new Float64Array(0);
  private builtAt: string | null = null;
  private assetCount = 0;
  /** Tracks which embedding mode was used during build. */
  private embeddingMode: EmbeddingMode = 'tfidf';

  /**
   * Build the index from a list of capability assets.
   * Tries transformer embeddings first (async); falls back to TF-IDF if unavailable.
   *
   * BREAKING CHANGE: This method is now async.
   */
  async build(assets: CapabilityRecord[]): Promise<IndexBuildInfo> {
    // Reset
    this.entries.clear();
    this.builtAt = null;
    this.assetCount = 0;
    this.embeddingMode = 'tfidf';

    if (assets.length === 0) {
      return {
        builtAt: new Date().toISOString(),
        assetCount: 0,
        vocabSize: 0,
        embeddingMode: 'tfidf',
      };
    }

    // ── Try transformer embeddings first ──
    let usedTransformer = false;
    try {
      const vectors = await this.buildWithTransformer(assets);
      if (vectors) {
        this.embeddingMode = 'transformer';
        for (let i = 0; i < assets.length; i++) {
          this.entries.set(assets[i].id, { id: assets[i].id, vector: vectors[i] });
        }
        usedTransformer = true;
      }
    } catch {
      // Transformer failed — fall through to TF-IDF
    }

    // ── Fallback: TF-IDF embeddings ──
    if (!usedTransformer) {
      const { buildVocabulary, textToVector } = await import('./embeddings');
      const texts = assets.map(asset => assetToText(asset));
      const { vocab, idf } = buildVocabulary(texts);
      this.vocab = vocab;
      this.idf = idf;

      for (let i = 0; i < assets.length; i++) {
        const vector = textToVector(texts[i], vocab, idf);
        this.entries.set(assets[i].id, { id: assets[i].id, vector });
      }
    }

    this.assetCount = assets.length;
    this.builtAt = new Date().toISOString();

    return {
      builtAt: this.builtAt,
      assetCount: this.assetCount,
      vocabSize: this.vocab.size,
      embeddingMode: this.embeddingMode,
    };
  }

  /**
   * Attempt to build vectors using the transformer pipeline from retrieval-engine.
   * Returns null on failure (non-throwing).
   */
  private async buildWithTransformer(
    assets: CapabilityRecord[],
  ): Promise<Float64Array[] | null> {
    try {
      // Probe: call embed once to see if the transformer is available.
      // The embed() function from retrieval-engine already handles lazy loading
      // and fallback internally, but we need to detect if the transformer was
      // actually used vs the TF-IDF fallback inside retrieval-engine.
      const probe = await transformerEmbed('test probe');
      if (probe.model === 'tfidf-fallback') {
        // Transformer not available — signal caller to use TF-IDF path
        return null;
      }

      // Transformer is working — embed all assets
      const vectors: Float64Array[] = [];
      for (const asset of assets) {
        const text = assetToText(asset).slice(0, 8000);
        const result = await transformerEmbed(text);
        // Use the vector even if this particular call fell back
        vectors.push(result.vector);
      }
      return vectors;
    } catch {
      return null;
    }
  }

  /**
   * Convert a query string to a vector matching the index's embedding mode.
   * For transformer mode, returns a 384-dim vector via the shared pipeline.
   * For TF-IDF mode, uses the index's vocabulary.
   *
   * BREAKING CHANGE: This method is now async (when in transformer mode).
   */
  async queryToVector(query: string): Promise<Float64Array> {
    if (this.embeddingMode === 'transformer') {
      try {
        const result = await transformerEmbed(query.slice(0, 8000));
        return result.vector;
      } catch {
        // If transformer fails at query time despite being available at build time,
        // return a zero vector of the expected dimension (384).
        return new Float64Array(384);
      }
    }

    // TF-IDF path
    if (this.vocab.size === 0) return new Float64Array(0);
    const { textToVector } = await import('./embeddings');
    return textToVector(query, this.vocab, this.idf);
  }

  /**
   * Search the index for the top-K entries most similar to the query vector.
   * Returns { id, score } pairs sorted by descending cosine similarity.
   */
  search(queryVector: Float64Array, topK: number = 10): Array<{ id: string; score: number }> {
    if (queryVector.length === 0 || this.entries.size === 0) return [];

    const results: Array<{ id: string; score: number }> = [];

    for (const entry of this.entries.values()) {
      const score = cosineSimilarity(queryVector, entry.vector);
      if (score > 0) {
        results.push({ id: entry.id, score });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, topK);
  }

  /**
   * Get the similarity score for a specific asset ID.
   * Returns 0 if not in index.
   */
  getScore(assetId: string, queryVector: Float64Array): number {
    const entry = this.entries.get(assetId);
    if (!entry || queryVector.length === 0) return 0;
    return cosineSimilarity(queryVector, entry.vector);
  }

  /**
   * Check if the index is built and ready.
   */
  isReady(): boolean {
    return this.builtAt !== null && this.entries.size > 0;
  }

  /**
   * Get the embedding mode used during the last build.
   */
  getEmbeddingMode(): EmbeddingMode {
    return this.embeddingMode;
  }

  /**
   * Get index metadata.
   */
  getInfo(): IndexBuildInfo {
    return {
      builtAt: this.builtAt || 'never',
      assetCount: this.assetCount,
      vocabSize: this.vocab.size,
      embeddingMode: this.embeddingMode,
    };
  }

  /**
   * Get the number of entries in the index.
   */
  get size(): number {
    return this.entries.size;
  }
}

/* ═══════════════════════════════════════════════════
   Singleton Instance
   ═══════════════════════════════════════════════════ */

// Global singleton for the process lifetime
let _instance: VectorIndex | null = null;

export function getVectorIndex(): VectorIndex {
  if (!_instance) {
    _instance = new VectorIndex();
  }
  return _instance;
}

export type { CapabilityRecord };
