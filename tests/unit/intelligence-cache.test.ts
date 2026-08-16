/**
 * @vitest-environment node
 * Intelligence Cache — Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  getIntelligence,
  setIntelligence,
  invalidateOrganization,
  invalidateEngineType,
  clearAll,
  getCacheStats,
} from '@/lib/intelligence-cache';

describe('intelligence-cache', () => {
  beforeEach(() => {
    clearAll();
    vi.clearAllMocks();
  });

  // ── getIntelligence ──────────────────────────────────────────────

  describe('getIntelligence', () => {
    it('returns null for a key that was never set', () => {
      expect(getIntelligence('org-1', 'signals')).toBeNull();
    });

    it('returns cached data for a valid key', () => {
      setIntelligence('org-1', 'signals', [{ type: 'hiring' }]);
      const result = getIntelligence('org-1', 'signals');
      expect(result).toEqual([{ type: 'hiring' }]);
    });

    it('returns null for expired entries and removes them', () => {
      vi.useFakeTimers();
      setIntelligence('org-1', 'signals', 'data', undefined, 100);
      expect(getIntelligence('org-1', 'signals')).toBe('data');

      vi.advanceTimersByTime(200);
      expect(getIntelligence('org-1', 'signals')).toBeNull();
      vi.useRealTimers();
    });

    it('supports subKey for finer-grained caching', () => {
      setIntelligence('org-1', 'reasoning', 'result-a', 'query-1');
      setIntelligence('org-1', 'reasoning', 'result-b', 'query-2');

      expect(getIntelligence('org-1', 'reasoning', 'query-1')).toBe('result-a');
      expect(getIntelligence('org-1', 'reasoning', 'query-2')).toBe('result-b');
    });

    it('works with generic types', () => {
      interface BriefingData {
        summary: string;
        score: number;
      }
      const data: BriefingData = { summary: 'Growing fast', score: 90 };
      setIntelligence<BriefingData>('org-1', 'briefing', data);
      const result = getIntelligence<BriefingData>('org-1', 'briefing');
      expect(result).toEqual(data);
    });
  });

  // ── setIntelligence ──────────────────────────────────────────────

  describe('setIntelligence', () => {
    it('stores data and retrieves it', () => {
      setIntelligence('org-2', 'knowledge_graph', { nodes: 5 });
      expect(getIntelligence('org-2', 'knowledge_graph')).toEqual({ nodes: 5 });
    });

    it('uses default TTL when none specified', () => {
      vi.useFakeTimers();
      setIntelligence('org-3', 'custom_engine', 'value');
      expect(getIntelligence('org-3', 'custom_engine')).toBe('value');

      // Default TTL is 30 minutes
      vi.advanceTimersByTime(30 * 60 * 1000 - 1);
      expect(getIntelligence('org-3', 'custom_engine')).toBe('value');

      vi.advanceTimersByTime(2);
      expect(getIntelligence('org-3', 'custom_engine')).toBeNull();
      vi.useRealTimers();
    });

    it('uses engine-specific TTL from ENGINE_TTL_MS', () => {
      vi.useFakeTimers();
      // signals has 15 min TTL
      setIntelligence('org-4', 'signals', 'signal-data');

      vi.advanceTimersByTime(15 * 60 * 1000 - 1);
      expect(getIntelligence('org-4', 'signals')).toBe('signal-data');

      vi.advanceTimersByTime(2);
      expect(getIntelligence('org-4', 'signals')).toBeNull();
      vi.useRealTimers();
    });

    it('respects custom TTL override', () => {
      vi.useFakeTimers();
      setIntelligence('org-5', 'signals', 'data', undefined, 500);

      vi.advanceTimersByTime(400);
      expect(getIntelligence('org-5', 'signals')).toBe('data');

      vi.advanceTimersByTime(200);
      expect(getIntelligence('org-5', 'signals')).toBeNull();
      vi.useRealTimers();
    });

    it('evicts LRU entries when cache is at capacity', () => {
      // Fill cache up to MAX_MEMORY_ENTRIES (500) + 1
      for (let i = 0; i < 501; i++) {
        setIntelligence(`org-${i}`, 'signals', `data-${i}`);
      }
      // The first entry should have been evicted
      expect(getIntelligence('org-0', 'signals')).toBeNull();
      // The latest entry should exist
      expect(getIntelligence('org-500', 'signals')).toBe('data-500');
    });

    it('overwrites existing entry for the same key', () => {
      setIntelligence('org-1', 'signals', 'v1');
      setIntelligence('org-1', 'signals', 'v2');
      expect(getIntelligence('org-1', 'signals')).toBe('v2');
    });
  });

  // ── invalidateOrganization ───────────────────────────────────────

  describe('invalidateOrganization', () => {
    it('removes all entries for a given org', () => {
      setIntelligence('org-1', 'signals', 's');
      setIntelligence('org-1', 'reasoning', 'r');
      setIntelligence('org-1', 'briefing', 'b');
      setIntelligence('org-2', 'signals', 's2');

      const count = invalidateOrganization('org-1');
      expect(count).toBe(3);
      expect(getIntelligence('org-1', 'signals')).toBeNull();
      expect(getIntelligence('org-1', 'reasoning')).toBeNull();
      expect(getIntelligence('org-2', 'signals')).toBe('s2');
    });

    it('returns 0 when no entries exist for the org', () => {
      const count = invalidateOrganization('nonexistent-org');
      expect(count).toBe(0);
    });
  });

  // ── invalidateEngineType ─────────────────────────────────────────

  describe('invalidateEngineType', () => {
    it('removes all entries for a given engine type across orgs', () => {
      setIntelligence('org-1', 'signals', 's1');
      setIntelligence('org-2', 'signals', 's2');
      setIntelligence('org-1', 'reasoning', 'r1');

      const count = invalidateEngineType('signals');
      expect(count).toBe(2);
      expect(getIntelligence('org-1', 'signals')).toBeNull();
      expect(getIntelligence('org-2', 'signals')).toBeNull();
      expect(getIntelligence('org-1', 'reasoning')).toBe('r1');
    });

    it('returns 0 when no entries exist for the engine type', () => {
      const count = invalidateEngineType('nonexistent_engine');
      expect(count).toBe(0);
    });
  });

  // ── clearAll ─────────────────────────────────────────────────────

  describe('clearAll', () => {
    it('removes all entries and returns count', () => {
      setIntelligence('org-1', 'signals', 's');
      setIntelligence('org-2', 'reasoning', 'r');
      setIntelligence('org-3', 'briefing', 'b');

      const count = clearAll();
      expect(count).toBe(3);
      expect(getCacheStats().memoryEntries).toBe(0);
    });

    it('returns 0 when cache is already empty', () => {
      const count = clearAll();
      expect(count).toBe(0);
    });
  });

  // ── getCacheStats ────────────────────────────────────────────────

  describe('getCacheStats', () => {
    it('returns correct structure', () => {
      const stats = getCacheStats();
      expect(stats).toHaveProperty('memoryEntries');
      expect(stats).toHaveProperty('memoryMaxEntries');
      expect(stats).toHaveProperty('redisAvailable');
      expect(stats).toHaveProperty('expiredCleaned');
      expect(stats.memoryMaxEntries).toBe(500);
      expect(stats.redisAvailable).toBe(false);
    });

    it('reports expiredCleaned when entries have expired', () => {
      vi.useFakeTimers();
      setIntelligence('org-1', 'signals', 'data', undefined, 100);
      vi.advanceTimersByTime(200);

      const stats = getCacheStats();
      expect(stats.expiredCleaned).toBeGreaterThanOrEqual(1);
      expect(stats.memoryEntries).toBe(0);
      vi.useRealTimers();
    });

    it('reports 0 expiredCleaned when nothing has expired', () => {
      setIntelligence('org-1', 'signals', 'data', undefined, 60_000);
      const stats = getCacheStats();
      expect(stats.expiredCleaned).toBe(0);
      expect(stats.memoryEntries).toBe(1);
    });

    it('cleans up multiple expired entries in one call', () => {
      vi.useFakeTimers();
      setIntelligence('org-1', 'signals', 'data1', undefined, 100);
      setIntelligence('org-2', 'signals', 'data2', undefined, 100);
      setIntelligence('org-3', 'reasoning', 'data3', undefined, 100);
      vi.advanceTimersByTime(200);

      const stats = getCacheStats();
      expect(stats.expiredCleaned).toBe(3);
      expect(stats.memoryEntries).toBe(0);
      vi.useRealTimers();
    });
  });

  // ── LRU behavior ─────────────────────────────────────────────────

  describe('LRU behavior', () => {
    it('moves accessed entry to end (most recently used)', () => {
      setIntelligence('org-1', 'signals', 'a');
      setIntelligence('org-2', 'signals', 'b');
      setIntelligence('org-3', 'signals', 'c');

      // Access org-1 (moves to end)
      expect(getIntelligence('org-1', 'signals')).toBe('a');

      // Fill up to capacity — need 500 total to evict
      // We have 3 (org-1, org-2, org-3), need 497 more to reach 500
      for (let i = 4; i <= 500; i++) {
        setIntelligence(`org-${i}`, 'signals', `data-${i}`);
      }

      // Now at exactly 500. Add one more to trigger eviction of LRU (org-2)
      setIntelligence('org-501', 'signals', 'data-501');

      // org-1 was recently accessed, should still exist
      expect(getIntelligence('org-1', 'signals')).toBe('a');
      // org-2 was least recently used, should be evicted
      expect(getIntelligence('org-2', 'signals')).toBeNull();
    });

    it('evicts oldest first when at capacity', () => {
      setIntelligence('org-1', 'signals', 'first');
      setIntelligence('org-2', 'signals', 'second');

      // Need 502 total to evict both org-1 and org-2
      for (let i = 3; i <= 502; i++) {
        setIntelligence(`org-${i}`, 'signals', `data-${i}`);
      }

      // org-1 was first, should be evicted
      expect(getIntelligence('org-1', 'signals')).toBeNull();
      // org-2 should also be evicted (502 entries, capacity 500)
      expect(getIntelligence('org-2', 'signals')).toBeNull();
      // Latest should exist
      expect(getIntelligence('org-502', 'signals')).toBe('data-502');
    });
  });

  // ── Engine-specific TTLs ─────────────────────────────────────────

  describe('Engine-specific TTLs', () => {
    it('uses 15 minute TTL for signals engine', () => {
      vi.useFakeTimers();
      setIntelligence('org-1', 'signals', 'data');

      vi.advanceTimersByTime(14 * 60 * 1000);
      expect(getIntelligence('org-1', 'signals')).toBe('data');

      vi.advanceTimersByTime(2 * 60 * 1000);
      expect(getIntelligence('org-1', 'signals')).toBeNull();
      vi.useRealTimers();
    });

    it('uses 1 hour TTL for reasoning engine', () => {
      vi.useFakeTimers();
      setIntelligence('org-1', 'reasoning', 'data');

      vi.advanceTimersByTime(59 * 60 * 1000);
      expect(getIntelligence('org-1', 'reasoning')).toBe('data');

      vi.advanceTimersByTime(2 * 60 * 1000);
      expect(getIntelligence('org-1', 'reasoning')).toBeNull();
      vi.useRealTimers();
    });

    it('uses 30 minute TTL for knowledge_graph engine', () => {
      vi.useFakeTimers();
      setIntelligence('org-1', 'knowledge_graph', 'data');

      vi.advanceTimersByTime(29 * 60 * 1000);
      expect(getIntelligence('org-1', 'knowledge_graph')).toBe('data');

      vi.advanceTimersByTime(2 * 60 * 1000);
      expect(getIntelligence('org-1', 'knowledge_graph')).toBeNull();
      vi.useRealTimers();
    });

    it('uses 1 hour TTL for briefing engine', () => {
      vi.useFakeTimers();
      setIntelligence('org-1', 'briefing', 'data');

      vi.advanceTimersByTime(59 * 60 * 1000);
      expect(getIntelligence('org-1', 'briefing')).toBe('data');

      vi.advanceTimersByTime(2 * 60 * 1000);
      expect(getIntelligence('org-1', 'briefing')).toBeNull();
      vi.useRealTimers();
    });

    it('uses 24 hour TTL for ingestion engine', () => {
      vi.useFakeTimers();
      setIntelligence('org-1', 'ingestion', 'data');

      vi.advanceTimersByTime(23 * 60 * 60 * 1000);
      expect(getIntelligence('org-1', 'ingestion')).toBe('data');

      vi.advanceTimersByTime(2 * 60 * 60 * 1000);
      expect(getIntelligence('org-1', 'ingestion')).toBeNull();
      vi.useRealTimers();
    });
  });

  // ── SubKey behavior ──────────────────────────────────────────────

  describe('SubKey behavior', () => {
    it('overwrites data with same subKey', () => {
      setIntelligence('org-1', 'reasoning', 'v1', 'query-1');
      setIntelligence('org-1', 'reasoning', 'v2', 'query-1');
      expect(getIntelligence('org-1', 'reasoning', 'query-1')).toBe('v2');
    });

    it('does not affect other subKeys when overwriting', () => {
      setIntelligence('org-1', 'reasoning', 'v1', 'query-1');
      setIntelligence('org-1', 'reasoning', 'v2', 'query-2');
      setIntelligence('org-1', 'reasoning', 'v3', 'query-1');
      expect(getIntelligence('org-1', 'reasoning', 'query-1')).toBe('v3');
      expect(getIntelligence('org-1', 'reasoning', 'query-2')).toBe('v2');
    });

    it('allows mixed subKey and no-subKey entries for same org and engine', () => {
      setIntelligence('org-1', 'signals', 'no-subkey');
      setIntelligence('org-1', 'signals', 'with-subkey', 'sub-1');
      expect(getIntelligence('org-1', 'signals')).toBe('no-subkey');
      expect(getIntelligence('org-1', 'signals', 'sub-1')).toBe('with-subkey');
    });

    it('invalidates all subKeys for an organization', () => {
      setIntelligence('org-1', 'signals', 's', 'sub-1');
      setIntelligence('org-1', 'signals', 's', 'sub-2');
      setIntelligence('org-1', 'reasoning', 'r', 'sub-3');
      setIntelligence('org-2', 'signals', 's', 'sub-1');

      const count = invalidateOrganization('org-1');
      expect(count).toBe(3);
      expect(getIntelligence('org-2', 'signals', 'sub-1')).toBe('s');
    });
  });

  // ── Complex data types ───────────────────────────────────────────

  describe('Complex data types', () => {
    it('handles arrays of objects', () => {
      const data = [
        { id: 1, name: 'a' },
        { id: 2, name: 'b' },
      ];
      setIntelligence('org-1', 'signals', data);
      expect(getIntelligence('org-1', 'signals')).toEqual(data);
    });

    it('handles nested objects', () => {
      const data = { level1: { level2: { level3: 'deep' } } };
      setIntelligence('org-1', 'reasoning', data);
      expect(getIntelligence('org-1', 'reasoning')).toEqual(data);
    });

    it('handles number data', () => {
      setIntelligence('org-1', 'signals', 42);
      expect(getIntelligence<number>('org-1', 'signals')).toBe(42);
    });

    it('handles boolean data', () => {
      setIntelligence('org-1', 'signals', true);
      expect(getIntelligence<boolean>('org-1', 'signals')).toBe(true);
    });

    it('handles empty string as data', () => {
      setIntelligence('org-1', 'signals', '');
      expect(getIntelligence('org-1', 'signals')).toBe('');
    });

    it('handles zero as data', () => {
      setIntelligence('org-1', 'signals', 0);
      expect(getIntelligence('org-1', 'signals')).toBe(0);
    });
  });

  // ── Invalidation combinations ────────────────────────────────────

  describe('Invalidation combinations', () => {
    it('invalidateEngineType removes across all orgs with same engine', () => {
      setIntelligence('org-1', 'signals', 's1', 'sub-1');
      setIntelligence('org-2', 'signals', 's2', 'sub-2');
      setIntelligence('org-1', 'reasoning', 'r1');
      setIntelligence('org-2', 'reasoning', 'r2');

      const count = invalidateEngineType('signals');
      expect(count).toBe(2);
      expect(getIntelligence('org-1', 'reasoning')).toBe('r1');
      expect(getIntelligence('org-2', 'reasoning')).toBe('r2');
    });

    it('clearAll removes everything including subKeys', () => {
      setIntelligence('org-1', 'signals', 's', 'sub-1');
      setIntelligence('org-1', 'reasoning', 'r', 'sub-2');
      setIntelligence('org-2', 'signals', 's2');

      const count = clearAll();
      expect(count).toBe(3);
      expect(getIntelligence('org-1', 'signals', 'sub-1')).toBeNull();
      expect(getIntelligence('org-2', 'signals')).toBeNull();
    });

    it('returns 0 when invalidating empty engine type', () => {
      const count = invalidateEngineType('nonexistent');
      expect(count).toBe(0);
    });
  });
});
