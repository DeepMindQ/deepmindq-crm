// In-memory sliding window rate limiter
// Usage: const limited = rateLimit({ key: 'api-companies', limit: 100, windowMs: 60000 })
// Returns { success: boolean, remaining: number, resetAt: number }

interface RateLimitResult {
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
const store = new Map<string, { count: number; resetAt: number }>()

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) store.delete(key)
  }
}, 5 * 60 * 1000)

export function rateLimit(options: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  const { key, limit, windowMs } = options

  let entry = store.get(key)

  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs }
    store.set(key, entry)
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

export const authRateLimit = (ip: string) =>
  rateLimit({ key: `auth:${ip}`, limit: 5, windowMs: 60_000 })

export const aiRateLimit = (userId: string) =>
  rateLimit({ key: `ai:${userId}`, limit: 20, windowMs: 60_000 })

export const importRateLimit = (userId: string) =>
  rateLimit({ key: `import:${userId}`, limit: 3, windowMs: 60_000 * 60 }) // 3 per hour