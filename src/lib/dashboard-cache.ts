/**
 * Dashboard Cache — TTL-based in-memory cache for dashboard API routes.
 *
 * Uses a Map with automatic expiry cleanup on access.
 * NOTE: This is a process-level cache. In a multi-server deployment, each
 * server maintains its own cache. For distributed caching, consider Redis.
 *
 * Runtime: Node.js only (relies on in-process Map, not suitable for Edge Runtime
 * where each request may hit a different isolate).
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const DEFAULT_TTL = 30_000; // 30 seconds

/**
 * Run a cached function. If the cache key hits, return the cached result.
 * On miss, execute `fn`, store the result, and return it.
 *
 * Usage:
 * ```ts
 * const data = await dashboardCache.cached('dashboard:main', () => fetchDashboardData());
 * ```
 */
class DashboardCache {
  private store = new Map<string, CacheEntry<unknown>>();

  /** Retrieve a cached value. Returns null on miss or expiry. */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  /** Store a value with an optional TTL (defaults to 30s). */
  set<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
    this.cleanup();
  }

  /** Invalidate a specific key, or clear the entire cache if no key is provided. */
  invalidate(key?: string): void {
    if (key) {
      this.store.delete(key);
    } else {
      this.store.clear();
    }
  }

  /** Remove all entries matching a prefix. */
  invalidateByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  /** Get-or-compute helper with built-in TTL. */
  async cached<T>(key: string, fn: () => Promise<T>, ttlMs: number = DEFAULT_TTL): Promise<T> {
    const existing = this.get<T>(key);
    if (existing !== null) return existing;
    const data = await fn();
    this.set(key, data, ttlMs);
    return data;
  }

  /** Get cache stats for monitoring / debugging. */
  stats() {
    let valid = 0;
    let expired = 0;
    const now = Date.now();
    for (const [, entry] of this.store) {
      if (now > entry.expiresAt) expired++;
      else valid++;
    }
    return { total: this.store.size, valid, expired };
  }

  /** Cleanup expired entries (called automatically on set). */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}

export const dashboardCache = new DashboardCache();
export const DASHBOARD_CACHE_TTL = DEFAULT_TTL;
export type { CacheEntry };
