/**
 * Tests for AI Cache Layer — LRU cache with TTL.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { get, set, getStats, clearAll } from '@/lib/ai-cache-layer';

describe('AI Cache Layer', () => {
  beforeEach(async () => {
    await clearAll();
  });

  it('returns null for cache miss', async () => {
    const result = await get('test-feature', 'system prompt', 'user prompt');
    expect(result).toBeNull();
  });

  it('stores and retrieves cached response', async () => {
    await set('test-feature', 'system prompt', 'user prompt', {
      text: 'cached response',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      quality: { score: 90, issues: [], passed: true },
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
    });

    const result = await get('test-feature', 'system prompt', 'user prompt');
    expect(result).not.toBeNull();
    expect(result!.text).toBe('cached response');
    expect(result!.usage!.totalTokens).toBe(30);
    expect(result!.provider).toBe('OpenAI');
  });

  it('returns null for expired entries', async () => {
    await set(
      'test-feature',
      'system prompt',
      'user prompt',
      {
        text: 'cached response',
        usage: null,
        quality: null,
        provider: 'OpenAI',
        model: 'gpt-4o-mini',
      },
      0,
    ); // 0 TTL = immediately expired

    const result = await get('test-feature', 'system prompt', 'user prompt');
    expect(result).toBeNull();
  });

  it('generates different keys for different inputs', async () => {
    await set('feature-a', 'sys', 'prompt-1', {
      text: 'response-1',
      usage: null,
      quality: null,
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
    });
    await set('feature-b', 'sys', 'prompt-2', {
      text: 'response-2',
      usage: null,
      quality: null,
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
    });

    const result1 = await get('feature-a', 'sys', 'prompt-1');
    const result2 = await get('feature-b', 'sys', 'prompt-2');
    expect(result1!.text).toBe('response-1');
    expect(result2!.text).toBe('response-2');
  });

  it('tracks cache hits and misses in stats', async () => {
    // Miss
    await get('test', 'sys', 'prompt');
    // Store
    await set('test', 'sys', 'prompt', {
      text: 'response',
      usage: null,
      quality: null,
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
    });
    // Hit
    await get('test', 'sys', 'prompt');

    const stats = await getStats();
    expect(stats.totalHits).toBe(1);
    expect(stats.totalMisses).toBe(1);
    expect(stats.hitRate).toBeCloseTo(0.5);
  });

  it('clears all cache entries', async () => {
    await set('test', 'sys', 'p1', {
      text: 'r1',
      usage: null,
      quality: null,
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
    });
    await set('test', 'sys', 'p2', {
      text: 'r2',
      usage: null,
      quality: null,
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
    });

    const count = await clearAll();
    expect(count).toBe(2);

    const stats = await getStats();
    expect(stats.totalEntries).toBe(0);
  });
});
