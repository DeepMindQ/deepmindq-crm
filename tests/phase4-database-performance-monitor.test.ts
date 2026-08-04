/**
 * WI-18.4 Phase 4 — Database Performance Monitor Tests
 *
 * Tests for database-performance-monitor.ts covering:
 * - recordDbQuery basic storage
 * - Percentile calculation (p50/p95/p99)
 * - Slow query detection
 * - Window filtering
 * - Top slow queries reporting
 * - Latency target validation
 * - Request query tracking
 * - Empty stats (zero-state)
 * - Reset function
 * - Buffer trimming
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Suppress logger.warn calls from slow query alerts
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Database Performance Monitor — Phase 4', () => {
  let recordDbQuery: typeof import('@/lib/database-performance-monitor').recordDbQuery;
  let getDbPerformanceStats: typeof import('@/lib/database-performance-monitor').getDbPerformanceStats;
  let resetDbPerformanceMetrics: typeof import('@/lib/database-performance-monitor').resetDbPerformanceMetrics;
  let validateLatencyTargets: typeof import('@/lib/database-performance-monitor').validateLatencyTargets;
  let startRequestQueryTracking: typeof import('@/lib/database-performance-monitor').startRequestQueryTracking;
  let endRequestQueryTracking: typeof import('@/lib/database-performance-monitor').endRequestQueryTracking;
  let incrementRequestQueryCount: typeof import('@/lib/database-performance-monitor').incrementRequestQueryCount;
  let getCurrentRequestQueryCount: typeof import('@/lib/database-performance-monitor').getCurrentRequestQueryCount;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    const mod = await import('@/lib/database-performance-monitor');
    recordDbQuery = mod.recordDbQuery;
    getDbPerformanceStats = mod.getDbPerformanceStats;
    resetDbPerformanceMetrics = mod.resetDbPerformanceMetrics;
    validateLatencyTargets = mod.validateLatencyTargets;
    startRequestQueryTracking = mod.startRequestQueryTracking;
    endRequestQueryTracking = mod.endRequestQueryTracking;
    incrementRequestQueryCount = mod.incrementRequestQueryCount;
    getCurrentRequestQueryCount = mod.getCurrentRequestQueryCount;

    // Start clean
    resetDbPerformanceMetrics();
  });

  // 1. recordDbQuery basic
  it('should store recorded queries in the buffer', () => {
    for (let i = 0; i < 10; i++) {
      recordDbQuery('Company', 'findMany', 5 + i);
    }

    const stats = getDbPerformanceStats();
    expect(stats.totalQueries).toBe(10);
    expect(stats.queriesInWindow).toBe(10);
  });

  // 2. Percentile calculation
  it('should calculate p50, p95, and p99 percentiles correctly', () => {
    // Record 100 queries with known durations: 1ms through 100ms
    for (let i = 1; i <= 100; i++) {
      recordDbQuery('TestModel', 'findUnique', i);
    }

    const stats = getDbPerformanceStats();

    // p50: 50th percentile of 1-100 sorted = index 50 → value 50
    // Floor(100 * 0.5) = 50 → durations[50] = 51 (0-indexed)
    expect(stats.p50LatencyMs).toBeGreaterThan(40);
    expect(stats.p50LatencyMs).toBeLessThan(60);

    // p95: Floor(100 * 0.95) = 95 → durations[95] = 96
    expect(stats.p95LatencyMs).toBeGreaterThan(85);
    expect(stats.p95LatencyMs).toBeLessThan(100);

    // p99: Floor(100 * 0.99) = 99 → durations[99] = 100
    expect(stats.p99LatencyMs).toBeGreaterThan(90);
    expect(stats.p99LatencyMs).toBeLessThanOrEqual(100);
  });

  // 3. Slow query detection
  it('should count queries exceeding 200ms as slow', () => {
    // Fast queries
    for (let i = 0; i < 8; i++) {
      recordDbQuery('Company', 'findMany', 10 + i);
    }
    // Slow queries (over 200ms)
    recordDbQuery('Company', 'findMany', 250);
    recordDbQuery('Contact', 'findFirst', 300);

    const stats = getDbPerformanceStats();
    expect(stats.slowQueryCount).toBe(2);
    expect(stats.slowQueryThresholdMs).toBe(200);
  });

  // 4. Window filtering
  it('should only include recent queries within the window', () => {
    // Record a query that will be in the window
    recordDbQuery('Recent', 'findMany', 10);

    // We can't easily backdate queries since timestamp is Date.now() inside the function,
    // but we can verify that the window filtering logic works by checking queriesInWindow
    // matches totalQueries for fresh data.
    const stats = getDbPerformanceStats();
    expect(stats.queriesInWindow).toBe(stats.totalQueries);
    expect(stats.queriesInWindow).toBe(1);
    expect(stats.windowDurationMs).toBe(60_000);
  });

  // 5. Top slow queries
  it('should report top slow queries grouped by model.action', () => {
    // Multiple slow queries on different models
    recordDbQuery('Company', 'findMany', 250);
    recordDbQuery('Company', 'findMany', 350);
    recordDbQuery('Company', 'findMany', 300);
    recordDbQuery('Contact', 'findUnique', 500);
    recordDbQuery('Contact', 'findUnique', 400);

    const stats = getDbPerformanceStats();

    // Should have exactly 2 groups: Company.findMany and Contact.findUnique
    expect(stats.topSlowQueries.length).toBe(2);

    // Both should be slow (>200ms)
    for (const q of stats.topSlowQueries) {
      expect(q.avgDurationMs).toBeGreaterThan(200);
      expect(q.count).toBeGreaterThanOrEqual(1);
      expect(q.maxDurationMs).toBeGreaterThanOrEqual(q.avgDurationMs);
    }

    // Top query should be Contact.findUnique (avg 450ms) over Company.findMany (avg 300ms)
    expect(stats.topSlowQueries[0].model).toBe('Contact');
    expect(stats.topSlowQueries[0].action).toBe('findUnique');
  });

  // 6. Latency target validation
  it('should return warnings when p95 exceeds 200ms target', () => {
    // Record queries where p95 will be above 200ms
    for (let i = 1; i <= 20; i++) {
      recordDbQuery('TestModel', 'findMany', i * 10); // 10ms to 200ms
    }
    // Add some slow queries to push p95 above 200
    recordDbQuery('TestModel', 'findMany', 250);
    recordDbQuery('TestModel', 'findMany', 260);

    const warnings = validateLatencyTargets();
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    // The warning should mention p95
    expect(warnings[0]).toContain('p95');
    expect(warnings[0]).toContain('200');
  });

  // 7. Request query tracking
  it('should track query count per request', () => {
    startRequestQueryTracking('req-123');

    incrementRequestQueryCount();
    incrementRequestQueryCount();
    incrementRequestQueryCount();

    // Check live count
    expect(getCurrentRequestQueryCount()).toBe(3);

    // End tracking and get count
    const count = endRequestQueryTracking();
    expect(count).toBe(3);

    // After ending, count should be reset
    expect(getCurrentRequestQueryCount()).toBe(0);
  });

  // 8. Empty stats (zero-state)
  it('should return zero-state stats when no queries recorded', () => {
    resetDbPerformanceMetrics();

    const stats = getDbPerformanceStats();

    expect(stats.totalQueries).toBe(0);
    expect(stats.queriesInWindow).toBe(0);
    expect(stats.avgLatencyMs).toBe(0);
    expect(stats.p50LatencyMs).toBe(0);
    expect(stats.p95LatencyMs).toBe(0);
    expect(stats.p99LatencyMs).toBe(0);
    expect(stats.slowQueryCount).toBe(0);
    expect(stats.topSlowQueries).toEqual([]);
    expect(stats.queriesPerSecond).toBe(0);
    expect(stats.slowQueryThresholdMs).toBe(200);
    expect(stats.windowDurationMs).toBe(60_000);
  });

  // 9. Reset function
  it('should clear all metrics on reset', () => {
    for (let i = 0; i < 50; i++) {
      recordDbQuery('Model', 'action', i * 10);
    }

    expect(getDbPerformanceStats().totalQueries).toBe(50);

    resetDbPerformanceMetrics();

    const stats = getDbPerformanceStats();
    expect(stats.totalQueries).toBe(0);
    expect(stats.queriesInWindow).toBe(0);
    expect(stats.avgLatencyMs).toBe(0);
    expect(stats.topSlowQueries).toEqual([]);
  });

  // 10. Buffer trimming
  it('should trim buffer when it exceeds MAX_BUFFER_SIZE', () => {
    // The MAX_BUFFER_SIZE is 10,000. Record more than that.
    const ENOUGH_TO_OVERFLOW = 10_100;

    for (let i = 0; i < ENOUGH_TO_OVERFLOW; i++) {
      recordDbQuery('Model', 'action', 5);
    }

    const stats = getDbPerformanceStats();

    // Buffer should have been trimmed, so totalQueries >= ENOUGH_TO_OVERFLOW
    // (totalQueries tracks all-time, never trimmed)
    expect(stats.totalQueries).toBe(ENOUGH_TO_OVERFLOW);

    // queriesInWindow should be at most MAX_BUFFER_SIZE
    expect(stats.queriesInWindow).toBeLessThanOrEqual(10_000);
  });

  // 11. Average latency calculation
  it('should calculate average latency correctly', () => {
    recordDbQuery('Model', 'a', 100);
    recordDbQuery('Model', 'a', 200);
    recordDbQuery('Model', 'a', 300);

    const stats = getDbPerformanceStats();
    expect(stats.avgLatencyMs).toBe(200); // (100+200+300)/3
  });

  // 12. Latency target validation — no warnings for fast queries
  it('should return no warnings when all queries are fast', () => {
    for (let i = 0; i < 20; i++) {
      recordDbQuery('Model', 'a', 10 + i); // 10-29ms, all well under 200ms
    }

    const warnings = validateLatencyTargets();
    expect(warnings).toEqual([]);
  });

  // 13. Request tracking isolation between requests
  it('should isolate query counts between sequential requests', () => {
    startRequestQueryTracking('req-1');
    incrementRequestQueryCount();
    incrementRequestQueryCount();
    expect(endRequestQueryTracking()).toBe(2);

    startRequestQueryTracking('req-2');
    incrementRequestQueryCount();
    expect(endRequestQueryTracking()).toBe(1);

    expect(getCurrentRequestQueryCount()).toBe(0);
  });

  // 14. Slow query with warnings suppressed
  it('should not throw when recording a slow query', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() => {
      recordDbQuery('Model', 'a', 500); // Well above 200ms threshold
    }).not.toThrow();

    const stats = getDbPerformanceStats();
    expect(stats.slowQueryCount).toBe(1);

    warnSpy.mockRestore();
  });

  // 15. queriesPerSecond calculation
  it('should calculate queriesPerSecond from window metrics', () => {
    for (let i = 0; i < 100; i++) {
      recordDbQuery('Model', 'a', 5);
    }

    const stats = getDbPerformanceStats();
    // 100 queries in 60,000ms window → 100/60000 * 1000 ≈ 2
    expect(stats.queriesPerSecond).toBeGreaterThan(0);
    // Should be approximately 2 (rounding)
    expect(Math.abs(stats.queriesPerSecond - 2)).toBeLessThanOrEqual(1);
  });
});
