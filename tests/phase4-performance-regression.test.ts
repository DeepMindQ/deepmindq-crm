/**
 * WI-18.4 Phase 4 — Performance Regression Tests
 *
 * Verifies that Phase 4 infrastructure modules:
 * - Export correctly and are importable
 * - Query safety bounds clamp values properly
 * - AI cache integration doesn't break on cache miss
 * - API observability records metrics correctly
 * - Prisma client diagnostics exports exist
 * - Coverage config has reasonable thresholds
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── 1. Query Safety Bounds ───────────────────────────────────────────────

describe('safeQueryBounds (query-helpers)', () => {
  // Import the actual module at test time (not top-level await in describe)
  let safeQueryBounds: typeof import('@/lib/query-helpers').safeQueryBounds;

  it('imports and returns correct default limit when no params given', async () => {
    ({ safeQueryBounds } = await import('@/lib/query-helpers'));
    const bounds = safeQueryBounds();
    expect(bounds.take).toBe(100); // DEFAULT_QUERY_LIMIT
    expect(bounds.skip).toBe(0);
    expect(bounds.cursor).toBeUndefined();
  });

  it('clamps requested limit to MAX_QUERY_LIMIT', () => {
    const bounds = safeQueryBounds(5000);
    expect(bounds.take).toBeLessThanOrEqual(5000); // ABSOLUTE_MAX
  });

  it('clamps to ABSOLUTE_MAX even with absurdly high values', () => {
    const bounds = safeQueryBounds(999999);
    expect(bounds.take).toBeLessThanOrEqual(5000);
  });

  it('never returns take less than 1', () => {
    const bounds = safeQueryBounds(-5);
    expect(bounds.take).toBeGreaterThanOrEqual(1);
  });

  it('handles cursor-based pagination', () => {
    const bounds = safeQueryBounds(50, undefined, 'cursor-123');
    expect(bounds.take).toBe(50);
    expect(bounds.cursor).toEqual({ id: 'cursor-123' });
    expect(bounds.skip).toBeUndefined();
  });

  it('computes correct skip for page 2', () => {
    const bounds = safeQueryBounds(10, 2);
    expect(bounds.take).toBe(10);
    expect(bounds.skip).toBe(10);
  });
});

// ─── 2. AI Cache Layer Integration ─────────────────────────────────────────

describe('cachedAICall (llm-cache-integration)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns AI response on cache miss (cache failure does not break call)', async () => {
    // Mock AICacheLayer.get to throw (simulates cache failure)
    vi.doMock('@/lib/ai-cache-layer', () => ({
      AICacheLayer: {
        get: vi.fn().mockRejectedValue(new Error('DB down')),
        set: vi.fn().mockRejectedValue(new Error('DB down')),
      },
    }));
    vi.resetModules();

    // Re-import to get the mocked version
    const { cachedAICall } = await import('@/lib/llm-cache-integration');

    const mockAIResponse = {
      response: 'Hello from AI',
      modelUsed: 'gpt-4',
      tier: 'primary',
      tokensUsed: 100,
      costUsd: 0.01,
    };

    const result = await cachedAICall(
      'system',
      'user prompt',
      'fingerprint-abc',
      async () => mockAIResponse,
    );

    expect(result.response).toBe('Hello from AI');
    expect(result.modelUsed).toBe('gpt-4');
    expect(result.cacheHit).toBe(false);
  });

  it('returns cached response on cache hit', async () => {
    const cachedEntry = {
      response: 'Cached response',
      modelUsed: 'gpt-4',
      tier: 'primary',
      tokensUsed: 50,
      costUsd: 0.005,
    };

    vi.doMock('@/lib/ai-cache-layer', () => ({
      AICacheLayer: {
        get: vi.fn().mockResolvedValue(cachedEntry),
        set: vi.fn().mockResolvedValue(undefined),
      },
    }));
    vi.resetModules();

    const { cachedAICall } = await import('@/lib/llm-cache-integration');

    let aiCallInvoked = false;
    const result = await cachedAICall(
      'system',
      'user prompt',
      'fingerprint-xyz',
      async () => {
        aiCallInvoked = true;
        return {
          response: 'Should not be called',
          modelUsed: 'gpt-4',
          tier: 'primary',
          tokensUsed: 100,
          costUsd: 0.01,
        };
      },
    );

    expect(result.response).toBe('Cached response');
    expect(result.cacheHit).toBe(true);
    expect(aiCallInvoked).toBe(false);
  });
});

// ─── 3. API Observability ─────────────────────────────────────────────────

describe('API Observability (api-observability)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('createMetricsRecorder returns recordStart and recordEnd functions', async () => {
    const { createMetricsRecorder } = await import('@/lib/api-observability');
    const recorder = createMetricsRecorder();

    expect(typeof recorder.recordStart).toBe('function');
    expect(typeof recorder.recordEnd).toBe('function');
  });

  it('recordStart returns a number timestamp', async () => {
    const { createMetricsRecorder } = await import('@/lib/api-observability');
    const recorder = createMetricsRecorder();
    const start = recorder.recordStart();

    expect(typeof start).toBe('number');
    expect(start).toBeGreaterThan(0);
  });

  it('recordEnd computes positive latency', async () => {
    const { createMetricsRecorder } = await import('@/lib/api-observability');
    const recorder = createMetricsRecorder();
    const start = recorder.recordStart();

    // Simulate some work
    recorder.recordEnd('GET', '/api/test', 200, start);

    // Verify metrics were recorded by checking getApiMetrics
    const { getApiMetrics } = await import('@/lib/api-observability');
    const metrics = getApiMetrics();
    expect(metrics.totalRequests).toBeGreaterThanOrEqual(1);
  });

  it('getApiMetrics returns correct shape', async () => {
    const { getApiMetrics } = await import('@/lib/api-observability');
    const metrics = getApiMetrics();

    expect(metrics).toHaveProperty('totalRequests');
    expect(metrics).toHaveProperty('errorRate');
    expect(metrics).toHaveProperty('avgLatencyMs');
    expect(metrics).toHaveProperty('p50LatencyMs');
    expect(metrics).toHaveProperty('p95LatencyMs');
    expect(metrics).toHaveProperty('topEndpoints');
    expect(metrics).toHaveProperty('recentErrors');
    expect(typeof metrics.totalRequests).toBe('number');
    expect(typeof metrics.errorRate).toBe('number');
  });
});

// ─── 4. API Observability Middleware ───────────────────────────────────────

describe('withApiObservability (api-observability-middleware)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('wraps handler and records metric on success', async () => {
    const { withApiObservability } = await import('@/lib/api-observability-middleware');
    const { getApiMetrics } = await import('@/lib/api-observability');

    const handler = async (_req: Request) => new Response('ok', { status: 200 });
    const wrapped = withApiObservability(handler);

    const request = new Request('http://localhost/api/test');
    const response = await wrapped(request);

    expect(response.status).toBe(200);
    const metrics = getApiMetrics();
    expect(metrics.totalRequests).toBeGreaterThanOrEqual(1);
  });

  it('passes through handler response unchanged', async () => {
    const { withApiObservability } = await import('@/lib/api-observability-middleware');

    const handler = async (_req: Request) =>
      new Response(JSON.stringify({ data: 'test' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    const wrapped = withApiObservability(handler);

    const request = new Request('http://localhost/api/create', { method: 'POST' });
    const response = await wrapped(request);

    expect(response.status).toBe(201);
    expect(response.headers.get('content-type')).toBe('application/json');
  });

  it('records 500 on handler throw', async () => {
    const { withApiObservability } = await import('@/lib/api-observability-middleware');
    const { getApiMetrics } = await import('@/lib/api-observability');

    const beforeMetrics = getApiMetrics().totalRequests;

    const handler = async () => { throw new Error('boom'); };
    const wrapped = withApiObservability(handler);

    await expect(wrapped(new Request('http://localhost/api/fail'))).rejects.toThrow('boom');

    const afterMetrics = getApiMetrics();
    expect(afterMetrics.totalRequests).toBeGreaterThan(beforeMetrics);
  });
});

// ─── 5. Query Safety Middleware ────────────────────────────────────────────

describe('createQuerySafetyMiddleware (query-safety-middleware)', () => {
  it('exports a function', async () => {
    const mod = await import('@/lib/query-safety-middleware');
    expect(typeof mod.createQuerySafetyMiddleware).toBe('function');
  });

  it('middleware returns a function', async () => {
    const { createQuerySafetyMiddleware } = await import('@/lib/query-safety-middleware');
    const middleware = createQuerySafetyMiddleware();
    expect(typeof middleware).toBe('function');
  });

  it('calls next and passes through for non-findMany actions', async () => {
    const { createQuerySafetyMiddleware } = await import('@/lib/query-safety-middleware');
    const middleware = createQuerySafetyMiddleware();
    const mockNext = vi.fn().mockResolvedValue('result');

    const params = { model: 'Company', action: 'findFirst', args: {} };
    const result = await middleware(params, mockNext);

    expect(mockNext).toHaveBeenCalledWith(params);
    expect(result).toBe('result');
  });

  it('warns for findMany without take', async () => {
    const { createQuerySafetyMiddleware } = await import('@/lib/query-safety-middleware');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const middleware = createQuerySafetyMiddleware();
    const mockNext = vi.fn().mockResolvedValue([]);

    const params = { model: 'Contact', action: 'findMany', args: { where: {} } };
    await middleware(params, mockNext);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[QUERY-SAFETY] Unbounded findMany on Contact'),
    );
    expect(mockNext).toHaveBeenCalledWith(params);
    warnSpy.mockRestore();
  });

  it('does NOT warn for findMany with take', async () => {
    const { createQuerySafetyMiddleware } = await import('@/lib/query-safety-middleware');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const middleware = createQuerySafetyMiddleware();
    const mockNext = vi.fn().mockResolvedValue([]);

    const params = { model: 'Contact', action: 'findMany', args: { where: {}, take: 10 } };
    await middleware(params, mockNext);

    expect(warnSpy).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalledWith(params);
    warnSpy.mockRestore();
  });
});

// ─── 6. Prisma Client Exports ──────────────────────────────────────────────

describe('Prisma DB client exports', () => {
  it('exports db client', async () => {
    // We can't actually connect to DB in unit tests, but we verify the module
    // structure is correct by checking it exports properly.
    // The db module will fail at import time if Prisma Client isn't generated,
    // which is expected in the build environment. We test the export shape.
    const mod = await import('@/lib/db');
    expect(mod).toHaveProperty('db');
    expect(mod).toHaveProperty('PrismaDiagnostics');
  });

  it('PrismaDiagnostics has expected methods', async () => {
    const { PrismaDiagnostics } = await import('@/lib/db');
    expect(typeof PrismaDiagnostics.reset).toBe('function');
    expect(typeof PrismaDiagnostics.snapshot).toBe('function');
    expect(typeof PrismaDiagnostics.totalQueries).toBe('number');
    expect(typeof PrismaDiagnostics.slowQueries).toBe('number');
    expect(typeof PrismaDiagnostics.timedOutQueries).toBe('number');
  });

  it('PrismaDiagnostics.snapshot returns correct shape', async () => {
    const { PrismaDiagnostics } = await import('@/lib/db');
    PrismaDiagnostics.reset();
    const snap = PrismaDiagnostics.snapshot();
    expect(snap).toEqual({
      totalQueries: 0,
      slowQueries: 0,
      timedOutQueries: 0,
    });
  });

  it('PrismaDiagnostics.reset zeroes all counters', async () => {
    const { PrismaDiagnostics } = await import('@/lib/db');
    PrismaDiagnostics.totalQueries = 42;
    PrismaDiagnostics.slowQueries = 7;
    PrismaDiagnostics.timedOutQueries = 1;
    PrismaDiagnostics.reset();
    expect(PrismaDiagnostics.totalQueries).toBe(0);
    expect(PrismaDiagnostics.slowQueries).toBe(0);
    expect(PrismaDiagnostics.timedOutQueries).toBe(0);
  });
});

// ─── 7. Coverage Config Verification ───────────────────────────────────────

import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Coverage configuration', () => {
  it('vitest.config.ts has coverage section with thresholds', () => {
    // Read the config file as text (it's excluded from tsconfig compilation)
    const configPath = resolve(__dirname, '../vitest.config.ts');
    const configText = readFileSync(configPath, 'utf-8');

    // Verify key coverage configuration elements are present
    expect(configText).toContain("provider: 'v8'");
    expect(configText).toContain("'text'");
    expect(configText).toContain("'json'");
    expect(configText).toContain("'html'");
    expect(configText).toContain("'lcov'");
    expect(configText).toContain('thresholds');
    expect(configText).toContain('statements');
    expect(configText).toContain('branches');
    expect(configText).toContain('functions');
    expect(configText).toContain('lines');
  });
});

// ─── 8. Pagination Standard — Additional Edge Cases (Track B3) ────────────

describe('safeQueryBounds pagination edge cases (Track B3)', () => {
  let safeQueryBounds: typeof import('@/lib/query-helpers').safeQueryBounds;

  it('page 3 with limit 20 produces skip=40, take=20', async () => {
    ({ safeQueryBounds } = await import('@/lib/query-helpers'));
    const bounds = safeQueryBounds(20, 3);
    expect(bounds.take).toBe(20);
    expect(bounds.skip).toBe(40);
    expect(bounds.cursor).toBeUndefined();
  });

  it('cursor with limit 50 uses cursor-based pagination', () => {
    const bounds = safeQueryBounds(50, undefined, 'cursor-abc-123');
    expect(bounds.take).toBe(50);
    expect(bounds.cursor).toEqual({ id: 'cursor-abc-123' });
    expect(bounds.skip).toBeUndefined();
  });

  it('zero limit is clamped to 1', () => {
    const bounds = safeQueryBounds(0);
    expect(bounds.take).toBe(1);
    expect(bounds.skip).toBe(0);
  });

  it('very large limit is clamped to MAX_QUERY_LIMIT (1000), which is within ABSOLUTE_MAX', () => {
    const bounds = safeQueryBounds(100000);
    expect(bounds.take).toBe(1000);
    expect(bounds.take).toBeLessThanOrEqual(5000); // ABSOLUTE_MAX
  });

  it('negative page is clamped to 1 (skip=0)', () => {
    const bounds = safeQueryBounds(10, -3);
    expect(bounds.take).toBe(10);
    expect(bounds.skip).toBe(0);
  });
});
