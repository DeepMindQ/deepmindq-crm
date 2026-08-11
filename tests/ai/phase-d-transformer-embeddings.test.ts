/**
 * PHASE D — Transformer Embedding Tests for VectorIndex
 *
 * Tests the upgraded vector-index.ts dual embedding mode:
 *   1. Primary: Transformer embeddings (384-dim) via retrieval-engine
 *   2. Fallback: TF-IDF when transformer unavailable
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to create mock functions accessible both inside and outside vi.mock factories
const { mockEmbed } = vi.hoisted(() => ({
  mockEmbed: vi.fn(),
}));

vi.mock('@/lib/engines/retrieval-engine', () => ({
  embed: (...args: any[]) => mockEmbed(...args),
}));

vi.mock('@/lib/embeddings', () => ({
  buildVocabulary: vi.fn(),
  textToVector: vi.fn(),
  cosineSimilarity: vi.fn((a: any, b: any) => 0.5),
  assetToText: vi.fn((asset: any) => `${asset.title} ${asset.summary}`),
}));

import { VectorIndex } from '@/lib/vector-index';
import { buildVocabulary, textToVector, cosineSimilarity } from '@/lib/embeddings';

const mockedBuildVocab = vi.mocked(buildVocabulary);
const mockedTextToVector = vi.mocked(textToVector);
const mockedCosineSim = vi.mocked(cosineSimilarity);

describe('PHASE D: VectorIndex Transformer Embeddings', () => {
  let index: VectorIndex;

  const sampleAssets = [
    {
      id: 'cap-1',
      title: 'Cloud Migration',
      summary: 'Helps companies migrate to cloud infrastructure',
      category: 'consulting',
    },
    {
      id: 'cap-2',
      title: 'Data Analytics',
      summary: 'Provides business intelligence and data analytics',
      category: 'technology',
    },
    {
      id: 'cap-3',
      title: 'Cybersecurity',
      summary: 'Enterprise security assessment and compliance',
      category: 'security',
    },
  ];

  function make384Vector(): Float64Array {
    const v = new Float64Array(384);
    for (let i = 0; i < 384; i++) v[i] = Math.random() * 0.2 - 0.1;
    return v;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    index = new VectorIndex();
  });

  // ── Test 1: Transformer embeddings when available ──
  it('build() uses transformer embeddings when available', async () => {
    mockEmbed.mockResolvedValue({
      vector: make384Vector(),
      model: 'all-MiniLM-L6-v2',
    });

    const result = await index.build(sampleAssets);

    expect(result.embeddingMode).toBe('transformer');
    expect(result.assetCount).toBe(3);
    // embed should be called: 1 probe + 3 assets = 4 calls
    expect(mockEmbed).toHaveBeenCalledTimes(4);
    // The TF-IDF path should NOT be used
    expect(mockedBuildVocab).not.toHaveBeenCalled();
    expect(mockedTextToVector).not.toHaveBeenCalled();
  });

  // ── Test 2: Falls back to TF-IDF when transformer fails ──
  it('build() falls back to TF-IDF when transformer fails', async () => {
    mockEmbed.mockRejectedValue(new Error('Transformer unavailable'));
    mockedBuildVocab.mockReturnValue({
      vocab: new Map([['cloud', 0], ['migration', 1]]),
      idf: new Float64Array([1.5, 1.2]),
    });
    mockedTextToVector.mockReturnValue(new Float64Array([0.5, 0.7]));

    const result = await index.build(sampleAssets);

    expect(result.embeddingMode).toBe('tfidf');
    expect(result.assetCount).toBe(3);
    // TF-IDF functions should have been called
    expect(mockedBuildVocab).toHaveBeenCalled();
    expect(mockedTextToVector).toHaveBeenCalledTimes(3);
  });

  // ── Test 3: Search returns results sorted by score descending ──
  it('search() returns results sorted by score descending', async () => {
    mockEmbed.mockResolvedValue({ vector: make384Vector(), model: 'all-MiniLM-L6-v2' });
    await index.build(sampleAssets);

    // Make cosineSimilarity return different scores for each entry
    const callCount = { value: 0 };
    mockedCosineSim.mockImplementation(() => {
      callCount.value++;
      const scores = [0.9, 0.7, 0.5];
      return scores[(callCount.value - 1) % scores.length];
    });

    const queryVec = make384Vector();
    const results = index.search(queryVec, 3);

    expect(results.length).toBeGreaterThan(0);
    // Verify descending order
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  // ── Test 4: queryToVector uses transformer mode ──
  it('queryToVector() uses transformer mode when built with transformer', async () => {
    mockEmbed.mockResolvedValue({ vector: make384Vector(), model: 'all-MiniLM-L6-v2' });
    await index.build([sampleAssets[0]]);
    expect(index.getEmbeddingMode()).toBe('transformer');

    // For the query, provide a specific vector
    const queryVec384 = make384Vector();
    mockEmbed.mockResolvedValueOnce({ vector: queryVec384, model: 'all-MiniLM-L6-v2' });

    const queryVec = await index.queryToVector('test query');
    expect(queryVec).toBeInstanceOf(Float64Array);
    expect(queryVec.length).toBe(384);
    // embed should have been called for the query too
    expect(mockEmbed).toHaveBeenCalled(); // called for query
  });

  // ── Test 5: getEmbeddingMode returns correct mode after build ──
  it('getEmbeddingMode() returns correct mode after build', async () => {
    // Before build, default is 'tfidf'
    expect(index.getEmbeddingMode()).toBe('tfidf');

    // After transformer build
    mockEmbed.mockResolvedValue({ vector: make384Vector(), model: 'all-MiniLM-L6-v2' });
    await index.build(sampleAssets);
    expect(index.getEmbeddingMode()).toBe('transformer');

    // New index, fallback build
    const index2 = new VectorIndex();
    mockEmbed.mockRejectedValue(new Error('fail'));
    mockedBuildVocab.mockReturnValue({ vocab: new Map(), idf: new Float64Array(0) });
    mockedTextToVector.mockReturnValue(new Float64Array(0));
    await index2.build(sampleAssets);
    expect(index2.getEmbeddingMode()).toBe('tfidf');
  });

  // ── Test 6: Empty asset list handled gracefully ──
  it('build() handles empty asset list gracefully', async () => {
    const result = await index.build([]);

    expect(result.assetCount).toBe(0);
    expect(result.vocabSize).toBe(0);
    expect(result.embeddingMode).toBe('tfidf');
    expect(result.builtAt).toBeTruthy();
    expect(index.isReady()).toBe(false); // no entries
    expect(mockEmbed).not.toHaveBeenCalled();
    expect(mockedBuildVocab).not.toHaveBeenCalled();
  });

  // ── Test 7: isReady returns false before build, true after ──
  it('isReady() returns false before build, true after', async () => {
    expect(index.isReady()).toBe(false);

    mockEmbed.mockResolvedValue({ vector: make384Vector(), model: 'all-MiniLM-L6-v2' });
    await index.build(sampleAssets);

    expect(index.isReady()).toBe(true);
  });

  // ── Additional: transformer probe returning tfidf-fallback triggers TF-IDF ──
  it('build() falls back to TF-IDF when transformer probe returns tfidf-fallback model', async () => {
    mockEmbed.mockResolvedValue({
      vector: new Float64Array(384),
      model: 'tfidf-fallback',
    });
    mockedBuildVocab.mockReturnValue({
      vocab: new Map([['test', 0]]),
      idf: new Float64Array([1.0]),
    });
    mockedTextToVector.mockReturnValue(new Float64Array([0.3]));

    const result = await index.build(sampleAssets);

    expect(result.embeddingMode).toBe('tfidf');
    expect(mockedBuildVocab).toHaveBeenCalled();
  });

  // ── Additional: search with empty vector returns empty ──
  it('search() returns empty for empty query vector', async () => {
    mockEmbed.mockResolvedValue({ vector: make384Vector(), model: 'all-MiniLM-L6-v2' });
    await index.build(sampleAssets);

    const results = index.search(new Float64Array(0));
    expect(results).toEqual([]);
  });

  // ── Additional: queryToVector returns zero vector when transformer fails at query time ──
  it('queryToVector() returns 384-dim zero vector when transformer fails at query time', async () => {
    mockEmbed.mockResolvedValue({ vector: make384Vector(), model: 'all-MiniLM-L6-v2' });
    await index.build([sampleAssets[0]]);

    // Now make embed reject for the query
    mockEmbed.mockRejectedValueOnce(new Error('Query-time failure'));

    const queryVec = await index.queryToVector('test');
    expect(queryVec.length).toBe(384);
    expect(queryVec.every(v => v === 0)).toBe(true);
  });
});
