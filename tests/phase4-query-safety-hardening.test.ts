/**
 * WI-18.4 Phase 4 — Query Safety Hardening Tests
 *
 * Tests the query safety infrastructure:
 * - safeFindMany applies bounds correctly
 * - safeQueryBounds defaults, max clamping, and cursor handling
 * - unsafeFindMany logs warnings in production
 * - Query safety middleware detects unbounded findMany
 * - Non-findMany actions pass through unchanged
 * - unsafeFindMany import exists in key dedup files
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeFindMany, safeQueryBounds, unsafeFindMany } from '@/lib/query-helpers';
import { createQuerySafetyMiddleware } from '@/lib/query-safety-middleware';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 4 — Query Safety Hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── 1. safeFindMany with bounds ─────────────────────────────────────

  it('safeFindMany applies take from bounds to the query function', async () => {
    const mockQueryFn = vi.fn().mockResolvedValue([{ id: '1' }]);

    await safeFindMany(mockQueryFn, { where: { active: true } }, { limit: 25 });

    expect(mockQueryFn).toHaveBeenCalledTimes(1);
    const callArgs = mockQueryFn.mock.calls[0][0];
    expect(callArgs.take).toBe(25);
    expect(callArgs.where).toEqual({ active: true });
  });

  it('safeFindMany applies skip for page-based pagination', async () => {
    const mockQueryFn = vi.fn().mockResolvedValue([]);

    await safeFindMany(mockQueryFn, {}, { limit: 50, page: 3 });

    const callArgs = mockQueryFn.mock.calls[0][0];
    expect(callArgs.take).toBe(50);
    expect(callArgs.skip).toBe(100); // (page-1) * limit = 2*50
  });

  it('safeFindMany applies cursor and skip:1 for cursor-based pagination', async () => {
    const mockQueryFn = vi.fn().mockResolvedValue([]);

    await safeFindMany(mockQueryFn, {}, { cursor: 'cursor-xyz' });

    const callArgs = mockQueryFn.mock.calls[0][0];
    expect(callArgs.take).toBe(100); // default limit
    expect(callArgs.cursor).toEqual({ id: 'cursor-xyz' });
    expect(callArgs.skip).toBe(1);
  });

  // ─── 2. safeQueryBounds defaults ─────────────────────────────────────

  it('safeQueryBounds returns take=100, skip=0 with no arguments', () => {
    const bounds = safeQueryBounds();
    expect(bounds.take).toBe(100);
    expect(bounds.skip).toBe(0);
    expect(bounds.cursor).toBeUndefined();
  });

  // ─── 3. safeQueryBounds max clamp ────────────────────────────────────

  it('safeQueryBounds clamps limit=99999 to at most ABSOLUTE_MAX (5000)', () => {
    const bounds = safeQueryBounds(99999);
    // The logic first clamps to MAX_QUERY_LIMIT (1000), then to ABSOLUTE_MAX (5000)
    // So result is min(5000, min(1000, 99999)) = 1000
    expect(bounds.take).toBeLessThanOrEqual(5000);
    expect(bounds.take).toBe(1000);
  });

  it('safeQueryBounds respects ABSOLUTE_MAX even above MAX_QUERY_LIMIT', () => {
    const bounds = safeQueryBounds(10000);
    expect(bounds.take).toBeLessThanOrEqual(5000);
  });

  // ─── 4. safeQueryBounds cursor ───────────────────────────────────────

  it('safeQueryBounds with cursor sets take and cursor, no skip', () => {
    const bounds = safeQueryBounds(50, undefined, 'abc');
    expect(bounds.take).toBe(50);
    expect(bounds.cursor).toEqual({ id: 'abc' });
    expect(bounds.skip).toBeUndefined();
  });

  // ─── 5. unsafeFindMany logging ──────────────────────────────────────

  it('unsafeFindMany logs console.warn in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mockQueryFn = vi.fn().mockResolvedValue([]);

    await unsafeFindMany(mockQueryFn, {}, 'batch export for nightly sync');

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[QUERY-SAFETY] Unbounded findMany executed: batch export for nightly sync'),
    );
    expect(mockQueryFn).toHaveBeenCalledWith({});

    process.env.NODE_ENV = originalEnv;
    warnSpy.mockRestore();
  });

  it('unsafeFindMany does NOT log console.warn in development', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mockQueryFn = vi.fn().mockResolvedValue([]);

    await unsafeFindMany(mockQueryFn, {}, 'dev test query');

    expect(warnSpy).not.toHaveBeenCalled();
    expect(mockQueryFn).toHaveBeenCalledWith({});

    process.env.NODE_ENV = originalEnv;
    warnSpy.mockRestore();
  });

  // ─── 6. Query safety middleware ──────────────────────────────────────

  it('createQuerySafetyMiddleware logs warning for findMany without take', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mockNext = vi.fn().mockResolvedValue([{ id: '1' }]);

    const middleware = createQuerySafetyMiddleware();
    await middleware(
      { action: 'findMany', model: 'Company', args: { where: { active: true } } },
      mockNext,
    );

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[QUERY-SAFETY] Unbounded findMany on Company'),
    );
    expect(mockNext).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });

  it('createQuerySafetyMiddleware does NOT warn when take is set', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mockNext = vi.fn().mockResolvedValue([]);

    const middleware = createQuerySafetyMiddleware();
    await middleware(
      { action: 'findMany', model: 'Lead', args: { take: 50, where: {} } },
      mockNext,
    );

    expect(warnSpy).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });

  // ─── 7. Query safety middleware passes through non-findMany ──────────

  it('middleware passes through non-findMany actions unchanged', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mockNext = vi.fn().mockResolvedValue({ id: '1', name: 'Test' });

    const middleware = createQuerySafetyMiddleware();

    const params = { action: 'findUnique', model: 'Company', args: { where: { id: '1' } } };
    const result = await middleware(params, mockNext);

    expect(warnSpy).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalledWith(params);
    expect(result).toEqual({ id: '1', name: 'Test' });

    warnSpy.mockRestore();
  });

  it('middleware passes through create action unchanged', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mockNext = vi.fn().mockResolvedValue({ id: 'new' });

    const middleware = createQuerySafetyMiddleware();

    const params = { action: 'create', model: 'Lead', args: { data: { email: 'a@b.com' } } };
    await middleware(params, mockNext);

    expect(warnSpy).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalledWith(params);

    warnSpy.mockRestore();
  });

  // ─── 8. FindMany migration coverage ──────────────────────────────────

  it('unsafeFindMany import exists in key dedup files', () => {
    // Check that the key dedup files have the unsafeFindMany import
    const dedupFiles = [
      'src/lib/data-intelligence/deduplicator.ts',
      'src/app/api/capabilities/dedup-check/route.ts',
      'src/app/api/leads/dedup/route.ts',
    ];

    for (const relPath of dedupFiles) {
      const filePath = path.resolve('/home/z/my-project', relPath);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('unsafeFindMany');
      // Also verify it's imported from the correct module
      expect(content).toContain("from '@/lib/query-helpers'");
    }
  });

  it('unsafeFindMany import exists in other key files (scoring, persistence)', () => {
    const keyFiles = [
      'src/lib/revenue-intelligence/account-scoring.ts',
      'src/lib/lead-scoring.ts',
      'src/lib/persistence/intelligence-persistence-adapter.ts',
    ];

    for (const relPath of keyFiles) {
      const filePath = path.resolve('/home/z/my-project', relPath);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('unsafeFindMany');
      expect(content).toContain("from '@/lib/query-helpers'");
    }
  });
});
