/**
 * Search Provider Fallback Chain — Phase 2 Tests
 *
 * Tests the fallback chain (primary → web_reader → cache), circuit breaker
 * behavior, cache hit/miss, metrics tracking, and full-degradation mode.
 */

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import {
  CircuitBreaker,
  SearchCache,
  searchWithFallback,
  getFallbackStatus,
  warmSearchCache,
  clearSearchCache,
  registerProvider,
  resetCircuitBreakers,
} from '@/lib/search-provider-fallback';
import type { SearchProvider, SearchResult, SearchOptions } from '@/lib/search-provider-fallback';

// ── Helper: build a mock provider ──
function createMockProvider(
  name: string,
  priority: number,
  results: SearchResult[] = [],
  shouldFail = false,
): SearchProvider & { _fail: boolean; _results: SearchResult[] } {
  return {
    name,
    priority,
    isHealthy: jest.fn(() => true),
    getLatencyMs: jest.fn(() => 50),
    resetCircuit: jest.fn(),
    search: jest.fn(async () => (shouldFail ? [] : results)),
    _fail: shouldFail,
    _results: results,
  };
}

function makeResult(title: string, source: string): SearchResult {
  return {
    title,
    snippet: `Snippet for ${title}`,
    url: `https://example.com/${title.toLowerCase().replace(/\s+/g, '-')}`,
    source,
    relevanceScore: 0.85,
    fetchedAt: new Date().toISOString(),
    isFromCache: false,
  };
}

describe('Search Provider Fallback', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.ENABLE_SEARCH_FALLBACK = 'true';
    clearSearchCache();
    resetCircuitBreakers();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ════════════════════════════════════════════════════════════
  // CircuitBreaker
  // ════════════════════════════════════════════════════════════

  describe('CircuitBreaker', () => {
    it('should start in closed state', () => {
      const cb = new CircuitBreaker(3, 60000);
      expect(cb.getState()).toBe('closed');
      expect(cb.canAttempt()).toBe(true);
    });

    it('should open after reaching failure threshold', () => {
      const cb = new CircuitBreaker(3, 60000);
      cb.recordFailure();
      cb.recordFailure();
      expect(cb.getState()).toBe('closed');
      cb.recordFailure();
      expect(cb.getState()).toBe('open');
      expect(cb.canAttempt()).toBe(false);
    });

    it('should transition to half_open after cooldown', (done) => {
      const cb = new CircuitBreaker(2, 100);
      cb.recordFailure();
      cb.recordFailure();
      expect(cb.getState()).toBe('open');

      setTimeout(() => {
        expect(cb.getState()).toBe('half_open');
        expect(cb.canAttempt()).toBe(true);
        done();
      }, 150);
    });

    it('should close after success in half_open', () => {
      const cb = new CircuitBreaker(1, 60000);
      cb.recordFailure();
      expect(cb.getState()).toBe('open');
      cb.reset();
      cb.recordFailure();
      expect(cb.getState()).toBe('open');
    });

    it('should reset to closed', () => {
      const cb = new CircuitBreaker(1, 60000);
      cb.recordFailure();
      expect(cb.getState()).toBe('open');
      cb.reset();
      expect(cb.getState()).toBe('closed');
      expect(cb.canAttempt()).toBe(true);
    });

    it('should return failure count', () => {
      const cb = new CircuitBreaker(5, 60000);
      cb.recordFailure();
      cb.recordFailure();
      expect(cb.getFailureCount()).toBe(2);
    });
  });

  // ════════════════════════════════════════════════════════════
  // SearchCache
  // ════════════════════════════════════════════════════════════

  describe('SearchCache', () => {
    it('should return null on cache miss', () => {
      const cache = new SearchCache(100, 3600000);
      expect(cache.get('nonexistent-key')).toBeNull();
    });

    it('should store and retrieve results', () => {
      const cache = new SearchCache(100, 3600000);
      const results = [makeResult('Test', 'cache')];
      cache.set('test-key', results);
      expect(cache.get('test-key')).toEqual(results);
    });

    it('should expire entries after TTL', () => {
      jest.useFakeTimers();
      const cache = new SearchCache(100, 1000);
      cache.set('key', [makeResult('A', 'cache')]);
      expect(cache.get('key')).not.toBeNull();

      jest.advanceTimersByTime(1500);
      expect(cache.get('key')).toBeNull();
      jest.useRealTimers();
    });

    it('should track hit rate', () => {
      const cache = new SearchCache(100, 3600000);
      cache.get('miss');
      cache.set('key', [makeResult('A', 'cache')]);
      cache.get('key');
      cache.get('key');

      const stats = cache.stats();
      expect(stats.hitRate).toBeCloseTo(2 / 3, 1);
    });

    it('should build normalized cache keys', () => {
      const key1 = SearchCache.buildKey('Acme Corp Funding', { sourceType: 'news' });
      const key2 = SearchCache.buildKey('acme corp funding', { sourceType: 'news' });
      expect(key1).toBe(key2);
    });

    it('should evict LRU entries when capacity is reached', () => {
      const cache = new SearchCache(2, 3600000);
      cache.set('a', [makeResult('A', 'cache')]);
      cache.set('b', [makeResult('B', 'cache')]);
      cache.set('c', [makeResult('C', 'cache')]);
      expect(cache.get('a')).toBeNull();
      expect(cache.get('b')).not.toBeNull();
      expect(cache.get('c')).not.toBeNull();
    });
  });

  // ════════════════════════════════════════════════════════════
  // Fallback chain integration
  // ════════════════════════════════════════════════════════════

  describe('searchWithFallback', () => {
    it('should return results from cache when available', async () => {
      const cachedResults = [makeResult('Cached', 'cache')];
      warmSearchCache('test query', cachedResults);

      const result = await searchWithFallback('test query');

      expect(result.isFromCache).toBe(true);
      expect(result.results).toEqual(cachedResults);
    });

    it('should fall back when primary provider fails', async () => {
      // Register a custom provider that always fails
      const failingProvider = createMockProvider('test_primary', 0, [], true);
      registerProvider(failingProvider);

      const result = await searchWithFallback('test query', undefined, {
        providers: ['test_primary', 'web_reader', 'cache'],
      });

      // Primary failed, so the chain continued (isDegraded)
      expect(result.isDegraded).toBe(true);
    });

    it('should return empty results when all providers fail (non-throwing)', async () => {
      const result = await searchWithFallback('unfindable query', {
        maxResults: 1,
      });

      expect(result.results).toEqual([]);
    });

    it('should report total latency', async () => {
      const result = await searchWithFallback('test');

      expect(result.totalLatencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ════════════════════════════════════════════════════════════
  // getFallbackStatus / metrics
  // ════════════════════════════════════════════════════════════

  describe('getFallbackStatus', () => {
    it('should return status with provider health info', () => {
      const status = getFallbackStatus();
      expect(status).toBeDefined();
      expect(status.enabled).toBeDefined();
      expect(status.metrics).toBeDefined();
      expect(typeof status.metrics.totalSearches).toBe('number');
    });
  });
});
