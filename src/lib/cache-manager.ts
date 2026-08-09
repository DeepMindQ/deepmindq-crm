/**
 * DeepMindQ — Cache Manager
 * 
 * Simple in-memory LRU cache with TTL support.
 * Suitable for single-instance deployments.
 * For multi-instance, replace with Redis.
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
  accessCount: number
  lastAccessed: number
}

interface CacheStats {
  hits: number
  misses: number
  sets: number
  evictions: number
  size: number
  maxEntries: number
}

export class CacheManager<T = unknown> {
  private store = new Map<string, CacheEntry<T>>()
  private stats = { hits: 0, misses: 0, sets: 0, evictions: 0 }
  private readonly maxEntries: number
  private cleanupInterval: NodeJS.Timeout

  constructor(maxEntries = 1000, ttlMs = 300000) {
    this.maxEntries = maxEntries
    // Periodic cleanup of expired entries
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000)
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) {
      this.stats.misses++
      return undefined
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      this.stats.misses++
      return undefined
    }
    entry.accessCount++
    entry.lastAccessed = Date.now()
    this.stats.hits++
    return entry.value
  }

  set(key: string, value: T, ttlMs = 300000): void {
    // Evict if at capacity (remove least recently accessed)
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      let oldest: string | undefined
      let oldestTime = Infinity
      for (const [k, v] of this.store) {
        if (v.lastAccessed < oldestTime) {
          oldestTime = v.lastAccessed
          oldest = k
        }
      }
      if (oldest) {
        this.store.delete(oldest)
        this.stats.evictions++
      }
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      accessCount: 0,
      lastAccessed: Date.now(),
    })
    this.stats.sets++
  }

  delete(key: string): boolean {
    return this.store.delete(key)
  }

  has(key: string): boolean {
    return this.get(key) !== undefined
  }

  clear(): void {
    this.store.clear()
  }

  getStats(): CacheStats {
    return { ...this.stats, size: this.store.size, maxEntries: this.maxEntries }
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key)
        this.stats.evictions++
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval)
    this.store.clear()
  }
}

// ── Pre-configured caches ──
export const dashboardCache = new CacheManager(50, 30000)     // 50 entries, 30s TTL
export const companyCache = new CacheManager(200, 60000)     // 200 entries, 1m TTL
export const signalCache = new CacheManager(100, 15000)      // 100 entries, 15s TTL
export const scoreCache = new CacheManager(200, 60000)       // 200 entries, 1m TTL
export const notificationCache = new CacheManager(50, 10000)  // 50 entries, 10s TTL

export function getAllCacheStats() {
  return {
    dashboard: dashboardCache.getStats(),
    company: companyCache.getStats(),
    signal: signalCache.getStats(),
    score: scoreCache.getStats(),
    notification: notificationCache.getStats(),
  }
}
