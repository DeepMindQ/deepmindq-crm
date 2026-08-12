/**
 * Redis client abstraction supporting multiple backends:
 *   1. @upstash/redis (HTTP, serverless-compatible) — preferred for Vercel/serverless
 *   2. ioredis (TCP, for Docker/self-hosted)
 *
 * Falls back gracefully between backends.
 *
 * ENVIRONMENT VARIABLES:
 *   REDIS_URL           — Full Redis URL (redis://... for ioredis)
 *   UPSTASH_REDIS_REST_URL   — Upstash REST endpoint URL
 *   UPSTASH_REDIS_REST_TOKEN — Upstash REST endpoint token
 *
 * Priority:
 *   - If UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set → Upstash
 *   - Else if REDIS_URL is set → ioredis
 *   - Else → null (no Redis)
 */

import { logger } from '@/lib/logger';
import { env } from '@/lib/env-config';

// ─── Types ────────────────────────────────────────────────────────────────

/** Minimal interface all Redis backends must satisfy. */
export interface RedisClientLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, px?: number): Promise<string | null>;
  del(key: string | string[]): Promise<number>;
  eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>;
  ping(): Promise<string>;
  keys(pattern: string): Promise<string[]>;
  incr(key: string): Promise<number>;
  pexpire(key: string, ms: number): Promise<boolean>;
  publish(channel: string, message: string): Promise<number>;
  on(event: string, handler: (...args: unknown[]) => void): void;
}

// ─── Singleton State ──────────────────────────────────────────────────────

let _client: RedisClientLike | null = null;
let _clientType: 'upstash' | 'ioredis' | 'none' = 'none';
let _loading = false;

// ─── Upstash Adapter ──────────────────────────────────────────────────────

/**
 * Wraps an @upstash/redis instance to satisfy RedisClientLike.
 * Upstash uses HTTP (REST) instead of TCP, making it serverless-compatible.
 */
function wrapUpstash(upstash: any): RedisClientLike {
  return {
    get(key: string): Promise<string | null> {
      return upstash.get(key);
    },
    set(key: string, value: string, px?: number): Promise<string | null> {
      // Upstash set returns 'OK' on success, or the value with GET option
      if (px) {
        return upstash.set(key, value, { px }) as Promise<string | null>;
      }
      return upstash.set(key, value) as Promise<string | null>;
    },
    async del(key: string | string[]): Promise<number> {
      const keys = Array.isArray(key) ? key : [key];
      // Upstash del returns the number of deleted keys
      return upstash.del(...keys) as Promise<number>;
    },
    eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown> {
      return upstash.eval(script, numKeys, ...args.map(String));
    },
    async ping(): Promise<string> {
      const result = await upstash.ping();
      return typeof result === 'string' ? result : 'PONG';
    },
    async keys(pattern: string): Promise<string[]> {
      const result = await upstash.keys(pattern);
      return Array.isArray(result) ? result : [];
    },
    incr(key: string): Promise<number> {
      return upstash.incr(key) as Promise<number>;
    },
    async pexpire(key: string, ms: number): Promise<boolean> {
      const result = await upstash.pexpire(key, ms);
      return result === 1 || result === true;
    },
    async publish(channel: string, message: string): Promise<number> {
      // Upstash pub/sub uses a different mechanism; this is best-effort
      try {
        const result = await upstash.publish(channel, message);
        return typeof result === 'number' ? result : 0;
      } catch {
        // Upstash free tier may not support pub/sub
        return 0;
      }
    },
    on(_event: string, _handler: (...args: unknown[]) => void): void {
      // Upstash HTTP client doesn't support persistent subscriptions.
      // Pub/sub via Redis channels requires a separate subscriber connection.
      // Use redis-pubsub.ts for server-side SSE pub/sub with Upstash.
      logger.debug('[redis-client] Upstash HTTP client does not support .on() — use redis-pubsub.ts');
    },
  };
}

// ─── ioredis Adapter ──────────────────────────────────────────────────────

/**
 * Wraps an ioredis instance to satisfy RedisClientLike.
 * ioredis uses TCP connections — suitable for Docker/self-hosted deployments.
 */
function wrapIoRedis(redis: any): RedisClientLike {
  return {
    get(key: string): Promise<string | null> {
      return redis.get(key);
    },
    set(key: string, value: string, px?: number): Promise<string | null> {
      if (px) {
        return redis.set(key, value, 'PX', px);
      }
      return redis.set(key, value);
    },
    del(key: string | string[]): Promise<number> {
      return redis.del(key);
    },
    eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown> {
      return redis.eval(script, numKeys, ...args);
    },
    ping(): Promise<string> {
      return redis.ping();
    },
    keys(pattern: string): Promise<string[]> {
      return redis.keys(pattern);
    },
    incr(key: string): Promise<number> {
      return redis.incr(key);
    },
    async pexpire(key: string, ms: number): Promise<boolean> {
      const result = await redis.pexpire(key, ms);
      return result === 1;
    },
    publish(channel: string, message: string): Promise<number> {
      return redis.publish(channel, message);
    },
    on(event: string, handler: (...args: unknown[]) => void): void {
      redis.on(event, handler);
    },
  };
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Get the Redis client, initializing lazily on first call.
 *
 * Resolution order:
 *   1. @upstash/redis (if UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN set)
 *   2. ioredis (if REDIS_URL set)
 *   3. null (no Redis configured)
 *
 * Thread-safe: concurrent calls during initialization get null.
 */
export async function getRedisClient(): Promise<RedisClientLike | null> {
  if (_client) return _client;
  if (_loading) return null;

  const upstashUrl = env.redisUrl ? undefined : process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const redisUrl = env.redisUrl;

  // No Redis configuration at all
  if (!upstashUrl && !upstashToken && !redisUrl) {
    _clientType = 'none';
    return null;
  }

  _loading = true;

  try {
    // ── Try Upstash first (serverless-compatible) ──
    if (upstashUrl && upstashToken) {
      try {
        const { Redis: UpstashRedis } = await import('@upstash/redis');
        const upstash = new UpstashRedis({
          url: upstashUrl,
          token: upstashToken,
        });

        // Verify connectivity
        await upstash.ping();
        _client = wrapUpstash(upstash);
        _clientType = 'upstash';
        logger.info('[redis-client] Connected via @upstash/redis (HTTP)');
        return _client;
      } catch (err) {
        logger.warn(
          '[redis-client] @upstash/redis failed, trying ioredis fallback',
          { error: err instanceof Error ? err.message : String(err) },
        );
      }
    }

    // ── Try ioredis (TCP, Docker/self-hosted) ──
    if (redisUrl) {
      try {
        const { default: Redis } = await import('ioredis');
        const redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 1,
          connectTimeout: 2000,
          lazyConnect: true,
          retryStrategy: (times: number) => {
            if (times > 2) return null;
            return Math.min(times * 200, 1000);
          },
        });

        redis.on('error', (err: Error) => {
          logger.warn(`[redis-client] ioredis error: ${err.message}`);
        });

        await redis.ping();
        _client = wrapIoRedis(redis);
        _clientType = 'ioredis';
        logger.info('[redis-client] Connected via ioredis (TCP)');
        return _client;
      } catch (err) {
        logger.warn(
          '[redis-client] ioredis failed, Redis unavailable',
          { error: err instanceof Error ? err.message : String(err) },
        );
      }
    }

    // Both backends failed
    _clientType = 'none';
    return null;
  } finally {
    _loading = false;
  }
}

/**
 * Get the type of the currently active Redis backend.
 */
export function getClientType(): string {
  return _clientType;
}

/**
 * Reset the singleton client (useful for testing or reconnection).
 */
export function resetClient(): void {
  _client = null;
  _clientType = 'none';
}
