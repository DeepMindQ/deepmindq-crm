// In-memory sliding window rate limiter
// Usage: const limited = rateLimit({ key: 'api-companies', limit: 100, windowMs: 60000 })
// Returns { success: boolean, remaining: number, resetAt: number }

import { registerTimer } from '@/lib/timer-registry';

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

interface RateLimitOptions {
  key: string
  limit: number      // max requests
  windowMs: number   // time window in milliseconds
}

// Store: key -> { count: number, resetAt: number }
const MAX_STORE_SIZE = 100_000
const store = new Map<string, { count: number; resetAt: number }>()

// Cleanup old entries every 5 minutes
registerTimer(setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) store.delete(key)
  }
}, 5 * 60 * 1000))

export function rateLimit(options: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  const { key, limit, windowMs } = options

  let entry = store.get(key)

  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs }
    store.set(key, entry)
  }

  // Evict oldest entries if store exceeds max size
  if (store.size > MAX_STORE_SIZE) {
    let oldestKey: string | undefined;
    let oldestReset = Infinity;
    for (const [k, e] of store.entries()) {
      if (e.resetAt < oldestReset) {
        oldestReset = e.resetAt
        oldestKey = k
      }
    }
    if (oldestKey) store.delete(oldestKey)
  }

  entry.count++

  return {
    success: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  }
}

// Pre-configured limiters for common use cases
export const apiRateLimit = (ip: string, endpoint: string) =>
  rateLimit({ key: `api:${ip}:${endpoint}`, limit: 100, windowMs: 60_000 })

export const emailSendRateLimit = (userId: string) =>
  rateLimit({ key: `email:send:${userId}`, limit: 50, windowMs: 60_000 * 60 }) // 50 per hour per user