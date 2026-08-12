/**
 * P4.5 — Distributed Rate Limiting (Redis-backed)
 *
 * Implements sliding-window rate limiting using Redis INCR+EXPIRE via an
 * atomic Lua script. Falls back to in-memory limiting when Redis is
 * unavailable, ensuring zero downtime.
 * Satisfies multi-instance rate limit state sharing (Phase 4.5).
 *
 * FEATURES:
 *   - Endpoint-level rate limits (inherited from rate-limit-registry.ts)
 *   - User/tenant-level rate limits
 *   - Atomic Redis INCR + EXPIRE via Lua script (no race conditions)
 *   - Graceful fallback to in-memory if Redis unavailable
 *   - Fixed-window counter with TTL-based expiry
 *   - Health monitoring for Redis connection
 *   - Supports both Upstash (HTTP/serverless) and ioredis (TCP/Docker)
 *
 * USAGE:
 *   import { distributedRateLimit } from '@/lib/distributed-rate-limit';
 *   const result = await distributedRateLimit({
 *     key: 'api:ai:chat',
 *     limit: 30,
 *     windowMs: 60_000,
 *     identifier: userId,  // optional per-user limiting
 *   });
 *   if (!result.success) return new Response('Rate limited', { status: 429 });
 */

import { logger } from '@/lib/logger';
import { getRedisClient } from '@/lib/redis-client';

// ─── Types ────────────────────────────────────────────────────────────────

export interface DistributedRateLimitOptions {
  /** Base key for the rate limit (e.g., 'api:ai:chat') */
  key: string;
  /** Maximum requests allowed in the window */
  limit: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Optional user/tenant identifier for per-user limiting */
  identifier?: string;
}

export interface DistributedRateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
  backend: 'redis' | 'memory' | 'disabled';
}

export interface RedisHealthStatus {
  available: boolean;
  latencyMs: number;
  lastCheckAt: string;
  errorCount: number;
  consecutiveErrors: number;
}

// ─── Redis Configuration ───────────────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL;
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_ENABLED = !!(REDIS_URL || UPSTASH_URL);
const REDIS_KEY_PREFIX = 'dmq:ratelimit:';
const HEALTH_CHECK_INTERVAL_MS = 30_000;
const MAX_CONSECUTIVE_ERRORS = 3;
const FALLBACK_COOLDOWN_MS = 60_000;

// ─── Redis Client ────────────────────────────────────────────────────────
// Uses the shared redis-client.ts abstraction that supports both
// Upstash (HTTP/serverless) and ioredis (TCP/Docker) backends.

/**
 * Get the shared Redis client (supports both Upstash and ioredis backends).
 * See src/lib/redis-client.ts for backend selection logic.
 */
async function getRedis() {
  if (!REDIS_ENABLED) return null;
  return getRedisClient();
}

// ─── Health Status ─────────────────────────────────────────────────────────

const healthStatus: RedisHealthStatus = {
  available: false,
  latencyMs: 0,
  lastCheckAt: new Date().toISOString(),
  errorCount: 0,
  consecutiveErrors: 0,
};

let lastHealthCheck = 0;

/**
 * Check Redis health. Only checks once per interval to avoid overhead.
 */
async function checkHealth(): Promise<boolean> {
  const now = Date.now();

  // Throttle health checks
  if (now - lastHealthCheck < HEALTH_CHECK_INTERVAL_MS) {
    return healthStatus.available;
  }

  lastHealthCheck = now;
  healthStatus.lastCheckAt = new Date().toISOString();

  // If we've had too many consecutive errors, enter cooldown
  if (healthStatus.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
    healthStatus.available = false;
    return false;
  }

  try {
    const client = await getRedis();
    if (!client) {
      healthStatus.available = false;
      return false;
    }

    const start = Date.now();
    await client.ping();
    healthStatus.latencyMs = Date.now() - start;
    healthStatus.available = true;
    healthStatus.consecutiveErrors = 0;
    return true;
  } catch {
    healthStatus.available = false;
    healthStatus.consecutiveErrors++;
    return false;
  }
}

// ─── Redis Rate Limiting (Atomic INCR + EXPIRE via Lua) ───────────────────

// Atomic Lua script: INCR + conditional EXPIRE in a single round-trip.
// Eliminates the race condition where a process could crash between
// INCR and EXPIRE, leaving an immortal key that leaks memory.
const RATE_LIMIT_LUA = `
  local key = KEYS[1]
  local window_ms = tonumber(ARGV[1])
  local current = redis.call('INCR', key)
  if current == 1 then
    redis.call('PSETEX', key, window_ms, '1')
  end
  return current
`;

async function redisRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<DistributedRateLimitResult | null> {
  const client = await getRedis();
  if (!client) return null;

  const fullKey = `${REDIS_KEY_PREFIX}${key}`;

  try {
    // Atomic INCR + PSETEX via Lua script (single round-trip)
    const count = await (client as any).eval(
      RATE_LIMIT_LUA,
      1,
      fullKey,
      windowMs,
    );

    return {
      success: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt: Date.now() + windowMs,
      limit,
      backend: 'redis',
    };
  } catch (err) {
    logger.warn(
      `[distributed-rate-limit] Redis rate limit failed for ${key}`,
      { error: err instanceof Error ? err.message : String(err) },
    );
    return null;
  }
}

// ─── In-Memory Fallback ────────────────────────────────────────────────────

const memoryStore = new Map<string, { count: number; resetAt: number }>();
const MAX_MEMORY_STORE_SIZE = 100_000;

// Cleanup timer
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.resetAt <= now) memoryStore.delete(key);
  }
}, 5 * 60 * 1000);

function memoryRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): DistributedRateLimitResult {
  const now = Date.now();

  let entry = memoryStore.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    memoryStore.set(key, entry);
  }

  entry.count++;

  // Evict oldest entries if store exceeds max size
  if (memoryStore.size > MAX_MEMORY_STORE_SIZE) {
    let oldestKey: string | undefined;
    let oldestReset = Infinity;
    for (const [k, e] of memoryStore.entries()) {
      if (e.resetAt < oldestReset) {
        oldestReset = e.resetAt;
        oldestKey = k;
      }
    }
    if (oldestKey) memoryStore.delete(oldestKey);
  }

  return {
    success: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
    limit,
    backend: 'memory',
  };
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Perform a distributed rate limit check.
 *
 * Resolution order:
 *   1. If Redis is available and healthy → use Redis (atomic INCR + EXPIRE)
 *   2. If Redis is down or unavailable → fall back to in-memory
 *   3. If rate limiting is disabled → return success
 *
 * @param options - Rate limit configuration
 * @returns Result with success status and rate limit metadata
 */
export async function distributedRateLimit(
  options: DistributedRateLimitOptions,
): Promise<DistributedRateLimitResult> {
  const { key, limit, windowMs, identifier } = options;

  // Feature flag: disable rate limiting entirely
  if (process.env.RATE_LIMIT_DISABLED === 'true') {
    return { success: true, remaining: limit, resetAt: Date.now() + windowMs, limit, backend: 'disabled' };
  }

  // Build the full key with optional identifier
  const fullKey = identifier ? `${key}:${identifier}` : key;

  // Try Redis first
  const isHealthy = await checkHealth();
  if (isHealthy) {
    const result = await redisRateLimit(fullKey, limit, windowMs);
    if (result) return result;
  }

  // Fallback to in-memory
  return memoryRateLimit(fullKey, limit, windowMs);
}

/**
 * Get the health status of the distributed rate limiter.
 */
export function getRateLimitHealth(): RedisHealthStatus {
  return { ...healthStatus };
}

/**
 * Reset the rate limit for a specific key (admin use).
 */
export async function resetRateLimit(key: string): Promise<boolean> {
  if (!REDIS_ENABLED) {
    memoryStore.delete(key);
    return true;
  }

  try {
    const client = await getRedis();
    if (client) {
      await client.del(`${REDIS_KEY_PREFIX}${key}`);
    }
    // Memory store keys do NOT include the REDIS_KEY_PREFIX
    memoryStore.delete(key);
    return true;
  } catch {
    return false;
  }
}
