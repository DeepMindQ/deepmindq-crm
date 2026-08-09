/**
 * Generic LRU (Least Recently Used) Cache
 * =================================================
 *
 * A bounded in-memory cache that evicts the least recently used entry
 * when capacity is reached. Uses a Map for O(1) get/set/delete.
 *
 * The Map iteration order IS the access order: most recently used at
 * the end, least recently used at the beginning. On `get`, the entry
 * is re-inserted (moved to the end). On `set`, the entry is added to
 * the end, and the first entry is evicted if over capacity.
 *
 * Usage:
 *   const cache = new LRUCache<string, MyType>(1000);
 *   cache.set('key', value);
 *   const val = cache.get('key');
 */

export class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, V>;

  constructor(capacity: number) {
    if (capacity < 1) {
      throw new Error(`LRUCache capacity must be >= 1, got ${capacity}`);
    }
    this.capacity = capacity;
    this.cache = new Map();
  }

  /** Retrieve a value. Returns undefined if not found. Access order is updated. */
  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    // Re-insert to move to most-recently-used end
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  /** Store a value. If over capacity, evicts the least recently used entry. */
  set(key: K, value: V): void {
    // If key already exists, delete first so it moves to the end
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    // Evict LRU entry if at capacity
    if (this.cache.size >= this.capacity) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  /** Remove an entry. Returns true if the entry existed and was removed. */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /** Check if a key exists (does NOT update access order). */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /** Current number of entries. */
  size(): number {
    return this.cache.size;
  }

  /** Remove all entries. */
  clear(): void {
    this.cache.clear();
  }

  /** Return all keys in access order (LRU first, MRU last). */
  keys(): K[] {
    return [...this.cache.keys()];
  }

  /** Return all values in access order (LRU first, MRU last). */
  values(): V[] {
    return [...this.cache.values()];
  }

  /** Return all [key, value] pairs in access order. */
  entries(): Array<[K, V]> {
    return [...this.cache.entries()];
  }

  /** Cache utilization stats. */
  getStats(): { size: number; capacity: number; utilization: number } {
    return {
      size: this.cache.size,
      capacity: this.capacity,
      utilization: Math.round((this.cache.size / this.capacity) * 10000) / 100,
    };
  }
}
