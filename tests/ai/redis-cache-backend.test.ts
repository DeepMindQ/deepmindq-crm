/**
 * Tests for Redis Cache Backend.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock redis-client
vi.mock('@/lib/redis-client', () => ({
  getRedisClient: vi.fn().mockResolvedValue(null), // Redis unavailable by default
  getClientType: vi.fn().mockReturnValue('none'),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  isRedisAvailable,
  redisCacheGet,
  redisCacheSet,
  redisIntelGet,
  redisIntelSet,
  redisIntelInvalidate,
  getRedisCacheStats,
} from '@/lib/redis-cache-backend';

describe('Redis Cache Backend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isRedisAvailable', () => {
    it('returns false when Redis not configured', async () => {
      const result = await isRedisAvailable();
      expect(result).toBe(false);
    });
  });

  describe('redisCacheGet', () => {
    it('returns null when Redis unavailable', async () => {
      const result = await redisCacheGet('feature', 'key');
      expect(result).toBeNull();
    });
  });

  describe('redisCacheSet', () => {
    it('does not throw when Redis unavailable', async () => {
      await expect(
        redisCacheSet('feature', 'key', { data: 'test' }, 3600000),
      ).resolves.not.toThrow();
    });
  });

  describe('redisIntelGet', () => {
    it('returns null when Redis unavailable', async () => {
      const result = await redisIntelGet('org-1', 'signals');
      expect(result).toBeNull();
    });
  });

  describe('redisIntelSet', () => {
    it('does not throw when Redis unavailable', async () => {
      await expect(
        redisIntelSet('org-1', 'signals', [{ type: 'test' }], 600000),
      ).resolves.not.toThrow();
    });
  });

  describe('redisIntelInvalidate', () => {
    it('returns 0 when Redis unavailable', async () => {
      const result = await redisIntelInvalidate('org-1');
      expect(result).toBe(0);
    });
  });

  describe('getRedisCacheStats', () => {
    it('returns stats with redisAvailable false', () => {
      const stats = getRedisCacheStats();
      expect(stats.redisAvailable).toBe(false);
      expect(stats).toHaveProperty('redisHits');
      expect(stats).toHaveProperty('redisMisses');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('backend');
    });
  });
});
