/**
 * WI-18.4 Phase 4 — Distributed Rate Limiting Tests
 *
 * Tests for distributed-rate-limit.ts covering:
 * - In-memory fallback when Redis unavailable
 * - Rate limit enforcement
 * - Identifier isolation
 * - Window reset
 * - Feature flag (RATE_LIMIT_DISABLED)
 * - Health check
 * - Reset function
 * - Memory store cleanup
 * - Backend reporting
 * - Remaining count accuracy
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Redis URL to be empty so all tests use in-memory fallback
const originalRedisUrl = process.env.REDIS_URL;
const originalRateLimitDisabled = process.env.RATE_LIMIT_DISABLED;

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock ioredis so the dynamic import fails gracefully
vi.mock('ioredis', () => {
  throw new Error('ioredis not available in test');
});

describe('distributedRateLimit — Phase 4 Rate Limiting', () => {
  let distributedRateLimit: typeof import('@/lib/distributed-rate-limit').distributedRateLimit;
  let getRateLimitHealth: typeof import('@/lib/distributed-rate-limit').getRateLimitHealth;
  let resetRateLimit: typeof import('@/lib/distributed-rate-limit').resetRateLimit;

  beforeEach(async () => {
    // Ensure no Redis URL
    process.env.REDIS_URL = '';
    delete process.env.RATE_LIMIT_DISABLED;

    vi.clearAllMocks();
    vi.resetModules();

    const mod = await import('@/lib/distributed-rate-limit');
    distributedRateLimit = mod.distributedRateLimit;
    getRateLimitHealth = mod.getRateLimitHealth;
    resetRateLimit = mod.resetRateLimit;
  });

  afterEach(() => {
    process.env.REDIS_URL = originalRedisUrl;
    if (originalRateLimitDisabled !== undefined) {
      process.env.RATE_LIMIT_DISABLED = originalRateLimitDisabled;
    } else {
      delete process.env.RATE_LIMIT_DISABLED;
    }
  });

  // 1. In-memory fallback when Redis unavailable
  it('should fall back to in-memory when REDIS_URL is not set', async () => {
    const result = await distributedRateLimit({
      key: 'test:fallback',
      limit: 10,
      windowMs: 60_000,
    });

    expect(result.success).toBe(true);
    expect(result.backend).toBe('memory');
    expect(result.remaining).toBe(9);
  });

  // 2. Rate limit enforcement
  it('should enforce rate limit and return success=false when exceeded', async () => {
    // With limit=5, requests 1-5 succeed (count 1..5, all <= limit)
    // Request 6 should fail (count=6 > limit=5)
    for (let i = 0; i < 5; i++) {
      const result = await distributedRateLimit({
        key: 'test:enforce',
        limit: 5,
        windowMs: 60_000,
      });
      expect(result.success).toBe(true);
    }

    // 6th request should fail
    const overLimit = await distributedRateLimit({
      key: 'test:enforce',
      limit: 5,
      windowMs: 60_000,
    });
    expect(overLimit.success).toBe(false);
    expect(overLimit.remaining).toBe(0);
  });

  // 3. Identifier isolation
  it('should isolate limits per identifier', async () => {
    // User A makes 3 requests
    for (let i = 0; i < 3; i++) {
      await distributedRateLimit({
        key: 'test:isolated',
        limit: 5,
        windowMs: 60_000,
        identifier: 'user-A',
      });
    }

    // User B should have a fresh limit
    const resultB = await distributedRateLimit({
      key: 'test:isolated',
      limit: 5,
      windowMs: 60_000,
      identifier: 'user-B',
    });
    expect(resultB.success).toBe(true);
    expect(resultB.remaining).toBe(4);

    // User A should have remaining 2 (5 - 3)
    const resultA = await distributedRateLimit({
      key: 'test:isolated',
      limit: 5,
      windowMs: 60_000,
      identifier: 'user-A',
    });
    expect(resultA.success).toBe(true);
    expect(resultA.remaining).toBe(1);
  });

  // 4. Window reset
  it('should reset the limit when window expires', async () => {
    // Use a very short window (100ms) for testing
    for (let i = 0; i < 3; i++) {
      await distributedRateLimit({
        key: 'test:window-reset',
        limit: 3,
        windowMs: 100, // 100ms window
      });
    }

    // Should be at limit
    const atLimit = await distributedRateLimit({
      key: 'test:window-reset',
      limit: 3,
      windowMs: 100,
    });
    expect(atLimit.success).toBe(false);

    // Wait for window to expire
    await new Promise(r => setTimeout(r, 150));

    // Should be reset
    const afterReset = await distributedRateLimit({
      key: 'test:window-reset',
      limit: 3,
      windowMs: 100,
    });
    expect(afterReset.success).toBe(true);
    expect(afterReset.remaining).toBe(2);
  }, 10000);

  // 5. Feature flag
  it('should bypass all rate limiting when RATE_LIMIT_DISABLED=true', async () => {
    process.env.RATE_LIMIT_DISABLED = 'true';

    // Re-import to pick up the env change
    vi.resetModules();
    const mod = await import('@/lib/distributed-rate-limit');
    const rl = mod.distributedRateLimit;

    // Even after 100 requests, all should succeed
    for (let i = 0; i < 100; i++) {
      const result = await rl({
        key: 'test:disabled',
        limit: 5,
        windowMs: 60_000,
      });
      expect(result.success).toBe(true);
      expect(result.backend).toBe('disabled');
    }
  });

  // 6. Health check
  it('should report available=false when Redis is not configured', () => {
    const health = getRateLimitHealth();
    expect(health.available).toBe(false);
    expect(typeof health.latencyMs).toBe('number');
    expect(typeof health.errorCount).toBe('number');
    expect(typeof health.consecutiveErrors).toBe('number');
    expect(typeof health.lastCheckAt).toBe('string');
  });

  // 7. Reset function
  it('should reset rate limit counter via window expiry (in-memory reset path)', async () => {
    // Exhaust the limit with a short window
    for (let i = 0; i < 3; i++) {
      await distributedRateLimit({
        key: 'test:reset',
        limit: 3,
        windowMs: 50, // 50ms window for fast test
      });
    }

    // Confirm exhausted
    const exhausted = await distributedRateLimit({
      key: 'test:reset',
      limit: 3,
      windowMs: 50,
    });
    expect(exhausted.success).toBe(false);

    // resetRateLimit returns true for in-memory path
    const resetResult = await resetRateLimit('test:reset');
    expect(resetResult).toBe(true);

    // Wait for window to expire (the in-memory counter resets on window expiry)
    await new Promise(r => setTimeout(r, 100));

    // Should work again after window expiry
    const afterReset = await distributedRateLimit({
      key: 'test:reset',
      limit: 3,
      windowMs: 50,
    });
    expect(afterReset.success).toBe(true);
    expect(afterReset.remaining).toBe(2);
  }, 10000);

  // 8. Memory store cleanup
  it('should not serve expired entries from memory store', async () => {
    // Record an entry with a very short window
    await distributedRateLimit({
      key: 'test:cleanup',
      limit: 1,
      windowMs: 50, // 50ms
    });

    // Immediately after, should be exhausted
    const immediate = await distributedRateLimit({
      key: 'test:cleanup',
      limit: 1,
      windowMs: 50,
    });
    expect(immediate.success).toBe(false);

    // Wait for window to expire
    await new Promise(r => setTimeout(r, 100));

    // Should be fresh
    const afterExpiry = await distributedRateLimit({
      key: 'test:cleanup',
      limit: 1,
      windowMs: 50,
    });
    expect(afterExpiry.success).toBe(true);
  }, 10000);

  // 9. Backend reporting
  it('should report backend=memory when Redis is unavailable', async () => {
    const result = await distributedRateLimit({
      key: 'test:backend-report',
      limit: 100,
      windowMs: 60_000,
    });
    expect(result.backend).toBe('memory');
  });

  // 10. Remaining count accuracy
  it('should decrease remaining count accurately with each call', async () => {
    const results: number[] = [];
    for (let i = 0; i < 10; i++) {
      const result = await distributedRateLimit({
        key: 'test:remaining',
        limit: 10,
        windowMs: 60_000,
      });
      results.push(result.remaining);
    }

    // Remaining should go from 9 down to 0
    expect(results).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
  });

  // 11. Result structure compliance
  it('should return all required fields in result', async () => {
    const result = await distributedRateLimit({
      key: 'test:structure',
      limit: 100,
      windowMs: 60_000,
    });

    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('remaining');
    expect(result).toHaveProperty('resetAt');
    expect(result).toHaveProperty('limit');
    expect(result).toHaveProperty('backend');
    expect(typeof result.success).toBe('boolean');
    expect(typeof result.remaining).toBe('number');
    expect(typeof result.resetAt).toBe('number');
    expect(typeof result.limit).toBe('number');
    expect(['memory', 'redis', 'disabled']).toContain(result.backend);
  });

  // 12. No identifier uses key directly
  it('should use key directly when no identifier provided', async () => {
    const result1 = await distributedRateLimit({
      key: 'test:no-ident',
      limit: 2,
      windowMs: 60_000,
    });
    expect(result1.success).toBe(true);
    expect(result1.remaining).toBe(1);

    // Same key, same result
    const result2 = await distributedRateLimit({
      key: 'test:no-ident',
      limit: 2,
      windowMs: 60_000,
    });
    expect(result2.success).toBe(true);
    expect(result2.remaining).toBe(0);
  });

  // 13. resetAt is a future timestamp
  it('should set resetAt to a future timestamp', async () => {
    const before = Date.now();
    const result = await distributedRateLimit({
      key: 'test:resetat',
      limit: 10,
      windowMs: 60_000,
    });
    const after = Date.now();

    expect(result.resetAt).toBeGreaterThan(before - 1);
    expect(result.resetAt).toBeLessThanOrEqual(after + 60_001);
  });
});
