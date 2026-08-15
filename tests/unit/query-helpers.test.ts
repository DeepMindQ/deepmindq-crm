// ═══════════════════════════════════════════════════════════════════════════
// Query Helpers — Unit Tests
//
// Tests safeQueryBounds, safeFindMany, and unsafeFindMany from
// @/lib/query-helpers.ts.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
  },
}));

import { safeQueryBounds, safeFindMany, unsafeFindMany } from '@/lib/query-helpers';
import { logger } from '@/lib/logger';

describe('query-helpers', () => {
  // ── safeQueryBounds ─────────────────────────────────────────────
  describe('safeQueryBounds', () => {
    it('returns default bounds when no args provided', () => {
      const result = safeQueryBounds();
      expect(result.take).toBe(100);
      expect(result.skip).toBe(0);
      expect(result.cursor).toBeUndefined();
    });

    it('applies requested limit when within MAX_QUERY_LIMIT', () => {
      const result = safeQueryBounds(50);
      expect(result.take).toBe(50);
    });

    it('clamps limit to MAX_QUERY_LIMIT (1000)', () => {
      const result = safeQueryBounds(2000);
      expect(result.take).toBe(1000);
    });

    it('clamps limit to ABSOLUTE_MAX (5000) even above MAX', () => {
      // safeQueryBounds first clamps to ABSOLUTE_MAX then MAX_QUERY_LIMIT
      // min(5000, max(1, min(1000, 10000))) = min(5000, 1000) = 1000
      const result = safeQueryBounds(10000);
      expect(result.take).toBe(1000);
    });

    it('clamps limit to minimum 1', () => {
      const result = safeQueryBounds(0);
      expect(result.take).toBe(1);
    });

    it('clamps negative limit to 1', () => {
      const result = safeQueryBounds(-5);
      expect(result.take).toBe(1);
    });

    it('calculates skip from page number', () => {
      const result = safeQueryBounds(10, 3);
      expect(result.take).toBe(10);
      expect(result.skip).toBe(20); // (page 3 - 1) * 10
    });

    it('clamps page to minimum 1', () => {
      const result = safeQueryBounds(10, 0);
      expect(result.skip).toBe(0);
    });

    it('uses cursor when provided, ignores page', () => {
      const result = safeQueryBounds(20, 5, 'cursor-123');
      expect(result.take).toBe(20);
      expect(result.cursor).toEqual({ id: 'cursor-123' });
      expect(result.skip).toBeUndefined();
    });

    it('page 1 has skip=0', () => {
      const result = safeQueryBounds(undefined, 1);
      expect(result.skip).toBe(0);
    });

    it('handles limit=1 correctly', () => {
      const result = safeQueryBounds(1, 1);
      expect(result.take).toBe(1);
      expect(result.skip).toBe(0);
    });
  });

  // ── safeFindMany ─────────────────────────────────────────────────
  describe('safeFindMany', () => {
    it('passes take and skip to query function', async () => {
      const queryFn = vi.fn().mockResolvedValue([{ id: '1' }]);
      const result = await safeFindMany(
        queryFn,
        { where: { active: true } },
        { limit: 10, page: 2 },
      );
      expect(queryFn).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { active: true },
          take: 10,
          skip: 10,
        }),
      );
      expect(result).toEqual([{ id: '1' }]);
    });

    it('passes cursor and skip:1 for cursor-based pagination', async () => {
      const queryFn = vi.fn().mockResolvedValue([]);
      await safeFindMany(queryFn, {}, { cursor: 'abc', limit: 5 });
      expect(queryFn).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'abc' },
          skip: 1,
          take: 5,
        }),
      );
    });

    it('merges prismaArgs with bounds', async () => {
      const queryFn = vi.fn().mockResolvedValue([]);
      await safeFindMany(queryFn, { orderBy: { name: 'asc' } }, { limit: 25 });
      expect(queryFn).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'asc' },
          take: 25,
        }),
      );
    });

    it('works with no bounds (uses defaults)', async () => {
      const queryFn = vi.fn().mockResolvedValue([]);
      await safeFindMany(queryFn, { where: {} });
      expect(queryFn).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
          skip: 0,
        }),
      );
    });
  });

  // ── unsafeFindMany ───────────────────────────────────────────────
  describe('unsafeFindMany', () => {
    it('calls queryFn with unbounded args', async () => {
      const queryFn = vi.fn().mockResolvedValue([{ id: '1' }]);
      const result = await unsafeFindMany(queryFn, { where: {} }, 'batch export');
      expect(queryFn).toHaveBeenCalledWith({ where: {} });
      expect(result).toEqual([{ id: '1' }]);
    });

    it('logs warning in production', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const queryFn = vi.fn().mockResolvedValue([]);
      await unsafeFindMany(queryFn, {}, 'cron job');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Unbounded findMany executed: cron job'),
      );
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('does not log warning in development', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      const queryFn = vi.fn().mockResolvedValue([]);
      vi.clearAllMocks();
      await unsafeFindMany(queryFn, {}, 'test');
      expect(logger.warn).not.toHaveBeenCalled();
      process.env.NODE_ENV = originalNodeEnv;
    });
  });
});
