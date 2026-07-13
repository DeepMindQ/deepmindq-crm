/**
 * In-Memory Vector Index (C-02)
 *
 * Stores { id, vector } pairs and provides top-K search via cosine similarity.
 * Built from TF-IDF embeddings. Rebuilds on demand or on asset changes.
 */

import {
  buildVocabulary,
  textToVector,
  cosineSimilarity,
  assetToText,
} from './embeddings';

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */

export interface VectorEntry {
  id: string;
  vector: Float64Array;
}

export interface IndexBuildInfo {
  builtAt: string;
  assetCount: number;
  vocabSize: number;
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

  /**
   * Build the index from a list of capability assets.
   * Computes TF-IDF vocabulary and vectors for all assets.
   */
  build(assets: CapabilityRecord[]): IndexBuildInfo {
    // Reset
    this.entries.clear();
    this.builtAt = null;
    this.assetCount = 0;

    if (assets.length === 0) {
      return { builtAt: new Date().toISOString(), assetCount: 0, vocabSize: 0 };
    }

    // Build corpus texts
    const texts = assets.map(asset => assetToText(asset));

    // Build vocabulary and IDF
    const { vocab, idf } = buildVocabulary(texts);
    this.vocab = vocab;
    this.idf = idf;

    // Build vectors for each asset
    for (let i = 0; i < assets.length; i++) {
      const vector = textToVector(texts[i], vocab, idf);
      this.entries.set(assets[i].id, { id: assets[i].id, vector });
    }

    this.assetCount = assets.length;
    this.builtAt = new Date().toISOString();

    return {
      builtAt: this.builtAt,
      assetCount: this.assetCount,
      vocabSize: this.vocab.size,
    };
  }

  /**
   * Convert a query string to a vector using the index's vocabulary.
   * Terms not in the vocabulary are ignored (score 0).
   */
  queryToVector(query: string): Float64Array {
    if (this.vocab.size === 0) return new Float64Array(0);
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
   * Get index metadata.
   */
  getInfo(): IndexBuildInfo {
    return {
      builtAt: this.builtAt || 'never',
      assetCount: this.assetCount,
      vocabSize: this.vocab.size,
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