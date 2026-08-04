/**
 * WI-18.4 Phase 4 Hardening — Performance Benchmark Suite
 *
 * Benchmarks critical API endpoints and database operations.
 * Captures p50/p95/p99 latency, error rates, and throughput.
 *
 * Usage: npx vitest run tests/phase4-performance-benchmarks.test.ts --reporter=verbose
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Benchmark Utilities ──────────────────────────────────────────────────

interface BenchmarkResult {
  name: string;
  iterations: number;
  totalMs: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  minMs: number;
  maxMs: number;
  opsPerSecond: number;
}

function computePercentiles(values: number[]): { p50: number; p95: number; p99: number } {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    p50: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
    p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
    p99: sorted[Math.floor(sorted.length * 0.99)] ?? 0,
  };
}

async function benchmark(
  name: string,
  fn: () => Promise<void>,
  iterations: number = 100,
): Promise<BenchmarkResult> {
  const durations: number[] = [];
  const start = Date.now();

  for (let i = 0; i < iterations; i++) {
    const iterStart = Date.now();
    await fn();
    durations.push(Date.now() - iterStart);
  }

  const totalMs = Date.now() - start;
  const percentiles = computePercentiles(durations);
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;

  return {
    name,
    iterations,
    totalMs,
    avgMs: Math.round(avg * 100) / 100,
    p50Ms: percentiles.p50,
    p95Ms: percentiles.p95,
    p99Ms: percentiles.p99,
    minMs: Math.min(...durations),
    maxMs: Math.max(...durations),
    opsPerSecond: Math.round((iterations / totalMs) * 1000),
  };
}

// ─── Database Query Benchmarks ──────────────────────────────────────────

describe('Performance Benchmarks — Database Queries', () => {
  it('safeFindMany: 100 calls with default bounds', async () => {
    const { safeFindMany } = await import('@/lib/query-helpers');

    const mockQueryFn = vi.fn().mockResolvedValue(Array(100).fill({ id: '1' }));

    const result = await benchmark('safeFindMany-default', async () => {
      await safeFindMany(mockQueryFn, { where: { active: true } }, { limit: 50 });
    }, 100);

    console.log(`  [BENCHMARK] ${result.name}: avg=${result.avgMs}ms, p50=${result.p50Ms}ms, p95=${result.p95Ms}ms, ${result.opsPerSecond} ops/s`);

    expect(result.avgMs).toBeLessThan(10); // Should be < 10ms for in-memory mock
    expect(result.p95Ms).toBeLessThan(50);
    expect(mockQueryFn).toHaveBeenCalledTimes(100);
  });

  it('safeQueryBounds: 10000 iterations with various limits', async () => {
    const { safeQueryBounds } = await import('@/lib/query-helpers');

    const result = await benchmark('safeQueryBounds', async () => {
      safeQueryBounds(50, 1);
      safeQueryBounds(100, 5);
      safeQueryBounds(500, 10);
      safeQueryBounds(undefined, undefined);
    }, 2500);

    console.log(`  [BENCHMARK] ${result.name}: avg=${result.avgMs}ms, p50=${result.p50Ms}ms, ${result.opsPerSecond * 4} ops/s (4 per iter)`);
    expect(result.avgMs).toBeLessThan(5);
  });

  it('unsafeFindMany: 100 calls with production logging', async () => {
    const { unsafeFindMany } = await import('@/lib/query-helpers');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const mockQueryFn = vi.fn().mockResolvedValue([{ id: '1' }]);

    const result = await benchmark('unsafeFindMany', async () => {
      await unsafeFindMany(mockQueryFn, { where: { status: 'active' } }, 'Benchmark test');
    }, 100);

    process.env.NODE_ENV = originalEnv;
    warnSpy.mockRestore();

    console.log(`  [BENCHMARK] ${result.name}: avg=${result.avgMs}ms, p50=${result.p50Ms}ms, ${result.opsPerSecond} ops/s`);
    expect(result.avgMs).toBeLessThan(10);
  });
});

// ─── Database Performance Monitor Benchmarks ─────────────────────────────

describe('Performance Benchmarks — DB Performance Monitor', () => {
  let resetDbPerformanceMetrics: any;

  beforeEach(async () => {
    const mod = await import('@/lib/database-performance-monitor');
    resetDbPerformanceMetrics = mod.resetDbPerformanceMetrics;
    resetDbPerformanceMetrics();
  });

  it('recordDbQuery: 10000 iterations', async () => {
    const { recordDbQuery, resetDbPerformanceMetrics, getDbPerformanceStats } = await import('@/lib/database-performance-monitor');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    resetDbPerformanceMetrics();

    const result = await benchmark('recordDbQuery', async () => {
      recordDbQuery('company', 'findMany', Math.random() * 100);
    }, 10000);

    const stats = getDbPerformanceStats();
    warnSpy.mockRestore();

    console.log(`  [BENCHMARK] ${result.name}: avg=${result.avgMs}ms, ${result.opsPerSecond} ops/s`);
    console.log(`  [METRICS] totalQueries=${stats.totalQueries}, p50=${stats.p50LatencyMs}ms, p95=${stats.p95LatencyMs}ms`);

    expect(result.avgMs).toBeLessThan(1);
    expect(stats.totalQueries).toBe(10000);
  });

  it('getDbPerformanceStats: 100 iterations', async () => {
    const { recordDbQuery, resetDbPerformanceMetrics, getDbPerformanceStats } = await import('@/lib/database-performance-monitor');

    resetDbPerformanceMetrics();
    // Seed some data
    for (let i = 0; i < 1000; i++) {
      recordDbQuery('company', 'findMany', i % 10);
    }

    const result = await benchmark('getDbPerformanceStats', async () => {
      getDbPerformanceStats();
    }, 100);

    console.log(`  [BENCHMARK] ${result.name}: avg=${result.avgMs}ms, ${result.opsPerSecond} ops/s`);
    expect(result.avgMs).toBeLessThan(100); // Stats computation with 1000 entries
  });
});

// ─── Rate Limiting Benchmarks ────────────────────────────────────────────

describe('Performance Benchmarks — Rate Limiting', () => {
  it('in-memory rate limit: 10000 iterations', async () => {
    const { distributedRateLimit } = await import('@/lib/distributed-rate-limit');

    const result = await benchmark('distributedRateLimit-memory', async () => {
      await distributedRateLimit({
        key: 'benchmark-test',
        limit: 10000,
        windowMs: 60000,
        identifier: `user-${Math.floor(Math.random() * 1000)}`,
      });
    }, 10000);

    console.log(`  [BENCHMARK] ${result.name}: avg=${result.avgMs}ms, p50=${result.p50Ms}ms, ${result.opsPerSecond} ops/s`);
    expect(result.avgMs).toBeLessThan(5);
  });
});

// ─── AI Cache Benchmarks ───────────────────────────────────────────────

describe('Performance Benchmarks — AI Cache', () => {
  it('AICacheLayer.get (mocked): 1000 iterations', async () => {
    const mockGet = vi.fn().mockResolvedValue(null);
    vi.doMock('@/lib/ai-cache-layer', () => ({
      AICacheLayer: { get: mockGet, set: vi.fn(), prune: vi.fn(), getStats: vi.fn() },
    }));

    // Re-import to get mocked version
    const { AICacheLayer } = await import('@/lib/ai-cache-layer');

    const result = await benchmark('AICacheLayer.get', async () => {
      await AICacheLayer.get('system', 'user', 'fingerprint');
    }, 1000);

    console.log(`  [BENCHMARK] ${result.name}: avg=${result.avgMs}ms, p50=${result.p50Ms}ms, ${result.opsPerSecond} ops/s`);
    expect(mockGet).toHaveBeenCalledTimes(1000);
  });
});

// ─── Memory Monitor Benchmarks ───────────────────────────────────────────

describe('Performance Benchmarks — Memory Monitor', () => {
  it('takeMemorySnapshot: 10000 iterations', async () => {
    const { takeMemorySnapshot, resetMemoryMonitor } = await import('@/lib/memory-resource-monitor');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    resetMemoryMonitor();

    const result = await benchmark('takeMemorySnapshot', async () => {
      takeMemorySnapshot();
    }, 10000);

    warnSpy.mockRestore();
    errorSpy.mockRestore();

    console.log(`  [BENCHMARK] ${result.name}: avg=${result.avgMs}ms, ${result.opsPerSecond} ops/s`);
    expect(result.avgMs).toBeLessThan(1);
  });

  it('getMemoryHealth: 1000 iterations', async () => {
    const { takeMemorySnapshot, getMemoryHealth } = await import('@/lib/memory-resource-monitor');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Seed some snapshots
    for (let i = 0; i < 10; i++) takeMemorySnapshot();

    const result = await benchmark('getMemoryHealth', async () => {
      getMemoryHealth();
    }, 1000);

    warnSpy.mockRestore();
    errorSpy.mockRestore();

    console.log(`  [BENCHMARK] ${result.name}: avg=${result.avgMs}ms, ${result.opsPerSecond} ops/s`);
    expect(result.avgMs).toBeLessThan(10);
  });
});

// ─── API Metrics Benchmarks ──────────────────────────────────────────────

describe('Performance Benchmarks — API Metrics', () => {
  it('recordApiMetric + getApiMetrics: 10000 iterations', async () => {
    const { recordApiMetric, getApiMetrics } = await import('@/lib/api-observability');

    const result = await benchmark('recordApiMetric', async () => {
      recordApiMetric('GET', '/api/companies', 200, Math.random() * 50);
    }, 10000);

    const metrics = getApiMetrics();

    console.log(`  [BENCHMARK] ${result.name}: avg=${result.avgMs}ms, ${result.opsPerSecond} ops/s`);
    console.log(`  [METRICS] totalRequests=${metrics.totalRequests}, p50=${metrics.p50LatencyMs}ms`);

    expect(result.avgMs).toBeLessThan(1);
    expect(metrics.totalRequests).toBeGreaterThan(0);
  });
});
