// ═══════════════════════════════════════════════════════════════════════════
// LRU Cache — Unit Tests
//
// Tests LRUCache from @/lib/lru-cache.ts.
// Pure data structure, no mocks needed.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import { LRUCache } from '@/lib/lru-cache';

describe('LRUCache', () => {
  let cache: LRUCache<string, string>;

  beforeEach(() => {
    cache = new LRUCache<string, string>(3);
  });

  // ── Constructor ───────────────────────────────────────────────
  describe('constructor', () => {
    it('creates cache with capacity', () => {
      expect(cache.size()).toBe(0);
    });

    it('throws for capacity < 1', () => {
      expect(() => new LRUCache(0)).toThrow('capacity must be >= 1');
    });

    it('throws for negative capacity', () => {
      expect(() => new LRUCache(-5)).toThrow('capacity must be >= 1');
    });

    it('accepts capacity of 1', () => {
      const c = new LRUCache(1);
      expect(c.size()).toBe(0);
    });
  });

  // ── set / get ──────────────────────────────────────────────────
  describe('set and get', () => {
    it('stores and retrieves a value', () => {
      cache.set('a', '1');
      expect(cache.get('a')).toBe('1');
    });

    it('returns undefined for missing key', () => {
      expect(cache.get('missing')).toBeUndefined();
    });

    it('overwrites existing key', () => {
      cache.set('a', '1');
      cache.set('a', '2');
      expect(cache.get('a')).toBe('2');
      expect(cache.size()).toBe(1);
    });

    it('updating a key moves it to MRU position', () => {
      cache.set('a', '1');
      cache.set('b', '2');
      cache.set('c', '3');
      // 'a' is LRU. Update it to make it MRU.
      cache.set('a', 'new');
      // Now 'b' is LRU. Adding 'd' should evict 'b'.
      cache.set('d', '4');
      expect(cache.get('b')).toBeUndefined();
      expect(cache.get('a')).toBe('new');
      expect(cache.get('c')).toBe('3');
      expect(cache.get('d')).toBe('4');
    });
  });

  // ── Eviction ───────────────────────────────────────────────────
  describe('eviction', () => {
    it('evicts LRU entry when capacity exceeded', () => {
      cache.set('a', '1');
      cache.set('b', '2');
      cache.set('c', '3');
      cache.set('d', '4'); // evicts 'a'
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('d')).toBe('4');
    });

    it('get refreshes access order (prevents eviction)', () => {
      cache.set('a', '1');
      cache.set('b', '2');
      cache.set('c', '3');
      cache.get('a'); // 'a' becomes MRU
      cache.set('d', '4'); // evicts 'b' (now LRU)
      expect(cache.get('a')).toBe('1');
      expect(cache.get('b')).toBeUndefined();
    });

    it('capacity=1 always evicts on second set', () => {
      const c = new LRUCache(1);
      c.set('a', '1');
      c.set('b', '2');
      expect(c.get('a')).toBeUndefined();
      expect(c.get('b')).toBe('2');
    });
  });

  // ── delete ─────────────────────────────────────────────────────
  describe('delete', () => {
    it('removes existing entry', () => {
      cache.set('a', '1');
      expect(cache.delete('a')).toBe(true);
      expect(cache.get('a')).toBeUndefined();
    });

    it('returns false for missing key', () => {
      expect(cache.delete('missing')).toBe(false);
    });
  });

  // ── has ────────────────────────────────────────────────────────
  describe('has', () => {
    it('returns true for existing key', () => {
      cache.set('a', '1');
      expect(cache.has('a')).toBe(true);
    });

    it('returns false for missing key', () => {
      expect(cache.has('a')).toBe(false);
    });

    it('does NOT update access order', () => {
      cache.set('a', '1');
      cache.set('b', '2');
      cache.set('c', '3');
      cache.has('a'); // should NOT make 'a' MRU
      cache.set('d', '4'); // 'a' should still be LRU and get evicted
      expect(cache.get('a')).toBeUndefined();
    });
  });

  // ── clear ──────────────────────────────────────────────────────
  describe('clear', () => {
    it('removes all entries', () => {
      cache.set('a', '1');
      cache.set('b', '2');
      cache.clear();
      expect(cache.size()).toBe(0);
      expect(cache.get('a')).toBeUndefined();
    });
  });

  // ── keys / values / entries ────────────────────────────────────
  describe('keys, values, entries', () => {
    it('keys returns keys in LRU→MRU order', () => {
      cache.set('a', '1');
      cache.set('b', '2');
      cache.set('c', '3');
      cache.get('a'); // 'a' → MRU
      expect(cache.keys()).toEqual(['b', 'c', 'a']);
    });

    it('values returns values in LRU→MRU order', () => {
      cache.set('a', '1');
      cache.set('b', '2');
      cache.set('c', '3');
      cache.get('a');
      expect(cache.values()).toEqual(['2', '3', '1']);
    });

    it('entries returns pairs in LRU→MRU order', () => {
      cache.set('a', '1');
      cache.set('b', '2');
      expect(cache.entries()).toEqual([
        ['a', '1'],
        ['b', '2'],
      ]);
    });
  });

  // ── getStats ───────────────────────────────────────────────────
  describe('getStats', () => {
    it('returns correct stats for empty cache', () => {
      const stats = cache.getStats();
      expect(stats).toEqual({ size: 0, capacity: 3, utilization: 0 });
    });

    it('returns correct stats after adding entries', () => {
      cache.set('a', '1');
      cache.set('b', '2');
      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.capacity).toBe(3);
      // 2/3 * 100 = 66.67%
      expect(stats.utilization).toBe(66.67);
    });

    it('utilization is 100 when full', () => {
      cache.set('a', '1');
      cache.set('b', '2');
      cache.set('c', '3');
      expect(cache.getStats().utilization).toBe(100);
    });
  });

  // ── Type safety ────────────────────────────────────────────────
  describe('type safety', () => {
    it('works with number values', () => {
      const numCache = new LRUCache<string, number>(2);
      numCache.set('a', 42);
      expect(numCache.get('a')).toBe(42);
    });

    it('works with object values', () => {
      const objCache = new LRUCache<string, { x: number }>(2);
      objCache.set('a', { x: 1 });
      expect(objCache.get('a')?.x).toBe(1);
    });

    it('works with number keys', () => {
      const numKeyCache = new LRUCache<number, string>(2);
      numKeyCache.set(1, 'one');
      expect(numKeyCache.get(1)).toBe('one');
    });
  });
});
