/**
 * Cache Manager Tests
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheManager, getAllCacheStats } from '@/lib/cache-manager';

describe('CacheManager', () => {
  let cache: CacheManager<string>;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new CacheManager<string>(3, 1000);
  });

  afterEach(() => {
    cache.destroy();
    vi.useRealTimers();
  });

  it('creates with default values', () => {
    const c = new CacheManager();
    const stats = c.getStats();
    expect(stats.maxEntries).toBe(1000);
    expect(stats.size).toBe(0);
    c.destroy();
  });

  it('stores and retrieves values', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('returns undefined for missing keys', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('tracks misses', () => {
    cache.get('nonexistent');
    expect(cache.getStats().misses).toBe(1);
  });

  it('tracks hits', () => {
    cache.set('key1', 'value1');
    cache.get('key1');
    expect(cache.getStats().hits).toBe(1);
  });

  it('tracks sets', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    expect(cache.getStats().sets).toBe(2);
  });

  it('expires entries after TTL', () => {
    cache.set('key1', 'value1', 500);
    vi.advanceTimersByTime(600);
    expect(cache.get('key1')).toBeUndefined();
  });

  it('expired entries count as misses', () => {
    cache.set('key1', 'value1', 500);
    vi.advanceTimersByTime(600);
    cache.get('key1');
    expect(cache.getStats().misses).toBe(1);
  });

  it('evicts least recently accessed when at capacity', () => {
    cache.set('a', '1');
    vi.advanceTimersByTime(1);
    cache.set('b', '2');
    vi.advanceTimersByTime(1);
    cache.set('c', '3');
    // Access 'a' to make it recently used
    cache.get('a');
    // Adding 'd' should evict 'b' (least recently accessed)
    cache.set('d', '4');
    expect(cache.get('a')).toBe('1');
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe('3');
    expect(cache.get('d')).toBe('4');
  });

  it('does not evict when updating existing key', () => {
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');
    // Update 'a' (at capacity, but key exists)
    cache.set('a', '1-updated');
    expect(cache.getStats().evictions).toBe(0);
    expect(cache.get('a')).toBe('1-updated');
  });

  it('tracks evictions', () => {
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');
    cache.set('d', '4'); // triggers eviction
    expect(cache.getStats().evictions).toBe(1);
  });

  it('deletes entries', () => {
    cache.set('key1', 'value1');
    expect(cache.delete('key1')).toBe(true);
    expect(cache.get('key1')).toBeUndefined();
  });

  it('delete returns false for missing keys', () => {
    expect(cache.delete('nonexistent')).toBe(false);
  });

  it('has() checks for key existence', () => {
    cache.set('key1', 'value1');
    expect(cache.has('key1')).toBe(true);
    expect(cache.has('nonexistent')).toBe(false);
  });

  it('has() returns false for expired keys', () => {
    cache.set('key1', 'value1', 500);
    vi.advanceTimersByTime(600);
    expect(cache.has('key1')).toBe(false);
  });

  it('clear() removes all entries', () => {
    cache.set('a', '1');
    cache.set('b', '2');
    cache.clear();
    expect(cache.getStats().size).toBe(0);
    expect(cache.get('a')).toBeUndefined();
  });

  it('getStats() returns correct snapshot', () => {
    cache.set('a', '1');
    cache.get('a');
    cache.get('missing');
    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.sets).toBe(1);
    expect(stats.size).toBe(1);
    expect(stats.maxEntries).toBe(3);
  });

  it('destroy() clears interval and data', () => {
    cache.set('a', '1');
    cache.destroy();
    expect(cache.getStats().size).toBe(0);
  });

  it('cleanup removes expired entries via interval', () => {
    cache.set('a', '1', 500);
    cache.set('b', '2', 2000);
    vi.advanceTimersByTime(601);
    // Trigger cleanup by advancing past the cleanup interval (60s)
    vi.advanceTimersByTime(60000);
    // After cleanup, expired entry 'a' should be gone
    const stats = cache.getStats();
    expect(stats.evictions).toBeGreaterThanOrEqual(1);
  });

  it('stores non-string values', () => {
    const objCache = new CacheManager<{ name: string }>();
    objCache.set('user', { name: 'test' });
    expect(objCache.get('user')).toEqual({ name: 'test' });
    objCache.destroy();
  });
});

describe('Pre-configured caches', () => {
  it('getAllCacheStats returns stats for all caches', () => {
    const stats = getAllCacheStats();
    expect(stats).toHaveProperty('dashboard');
    expect(stats).toHaveProperty('company');
    expect(stats).toHaveProperty('signal');
    expect(stats).toHaveProperty('score');
    expect(stats).toHaveProperty('notification');
  });
});
