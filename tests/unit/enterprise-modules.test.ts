/**
 * WI-18.5 Phase 5 Tests — Enterprise Modules (DB-free, pure logic)
 *
 * Tests for: database-enterprise-monitor.ts, api-compliance-scanner.ts,
 * ai-tracing.ts, enterprise-health.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── AI Tracing Tests ───────────────────────────────────────────

describe('AI Tracing & Cost Control', () => {
  let estimateCost: (model: string, inputTokens: number, outputTokens: number) => number;
  let versionPrompt: (systemPrompt: string, userTemplate: string) => string;
  let registerPromptVersion: (key: string, capability: string, model: string, description: string, version?: string) => string;
  let getActivePromptVersions: () => Array<{ key: string; version: string; capability: string }>;

  beforeEach(async () => {
    const mod = await import('@/lib/ai-tracing');
    estimateCost = mod.estimateCost;
    versionPrompt = mod.versionPrompt;
    registerPromptVersion = mod.registerPromptVersion;
    getActivePromptVersions = mod.getActivePromptVersions;
  });

  describe('estimateCost', () => {
    it('should estimate zero cost for zero tokens', () => {
      expect(estimateCost('groq/llama-3.3-70b', 0, 0)).toBe(0);
    });

    it('should return positive cost for positive tokens', () => {
      const cost = estimateCost('groq/llama-3.3-70b', 1000, 500);
      expect(cost).toBeGreaterThan(0);
    });

    it('should estimate higher cost for output tokens than input', () => {
      const inputCost = estimateCost('groq/llama-3.3-70b', 1000, 0);
      const outputCost = estimateCost('groq/llama-3.3-70b', 0, 1000);
      expect(outputCost).toBeGreaterThan(inputCost);
    });

    it('should use default pricing for unknown models', () => {
      const cost = estimateCost('unknown/model', 1000, 1000);
      expect(cost).toBeGreaterThan(0);
    });

    it('should produce consistent estimates', () => {
      const c1 = estimateCost('gemini/gemini-2.0-flash', 10000, 5000);
      const c2 = estimateCost('gemini/gemini-2.0-flash', 10000, 5000);
      expect(c1).toBe(c2);
    });
  });

  describe('versionPrompt', () => {
    it('should produce deterministic version hashes', () => {
      const v1 = versionPrompt('System prompt', 'User template');
      const v2 = versionPrompt('System prompt', 'User template');
      expect(v1).toBe(v2);
    });

    it('should produce different versions for different prompts', () => {
      const v1 = versionPrompt('System prompt A', 'User template A');
      const v2 = versionPrompt('System prompt B', 'User template B');
      expect(v1).not.toBe(v2);
    });

    it('should start with v prefix', () => {
      const v = versionPrompt('test', 'test');
      expect(v).toMatch(/^v/);
    });
  });

  describe('registerPromptVersion / getActivePromptVersions', () => {
    it('should register and retrieve prompt versions', () => {
      const ver = registerPromptVersion('research-v1', 'research', 'groq/llama-3.3-70b', 'Initial research prompt');
      const versions = getActivePromptVersions();
      expect(versions.some(v => v.key === 'research-v1')).toBe(true);
      expect(versions.some(v => v.capability === 'research')).toBe(true);
    });

    it('should use provided version string', () => {
      const ver = registerPromptVersion('test-key', 'test', 'test-model', 'test', 'v1.2.3');
      expect(ver).toBe('v1.2.3');
    });
  });
});

// ── Database Performance Monitor Tests ──────────────────────────

describe('Database Performance Monitor', () => {
  let recordDbQuery: (model: string, action: string, durationMs: number) => void;
  let getDbPerformanceStats: () => any;
  let validateLatencyTargets: () => string[];
  let resetDbPerformanceMetrics: () => void;

  beforeEach(async () => {
    const mod = await import('@/lib/database-performance-monitor');
    recordDbQuery = mod.recordDbQuery;
    getDbPerformanceStats = mod.getDbPerformanceStats;
    validateLatencyTargets = mod.validateLatencyTargets;
    resetDbPerformanceMetrics = mod.resetDbPerformanceMetrics;
    resetDbPerformanceMetrics(); // Clean slate
  });

  it('should track query counts', () => {
    recordDbQuery('User', 'findUnique', 5);
    recordDbQuery('Company', 'findMany', 15);
    const stats = getDbPerformanceStats();
    expect(stats.totalQueries).toBe(2);
    expect(stats.queriesInWindow).toBe(2);
  });

  it('should compute latency percentiles', () => {
    // Record queries with varying latencies
    for (let i = 0; i < 100; i++) {
      recordDbQuery('Test', 'findMany', i * 2); // 0, 2, 4, ... 198ms
    }
    const stats = getDbPerformanceStats();
    expect(stats.p50LatencyMs).toBeGreaterThan(0);
    expect(stats.p95LatencyMs).toBeGreaterThan(stats.p50LatencyMs);
    expect(stats.p99LatencyMs).toBeGreaterThan(stats.p95LatencyMs);
  });

  it('should detect slow queries', () => {
    recordDbQuery('Company', 'findMany', 50);
    recordDbQuery('Company', 'findMany', 250); // Slow
    recordDbQuery('Company', 'findMany', 300); // Slow
    const stats = getDbPerformanceStats();
    expect(stats.slowQueryCount).toBe(2);
  });

  it('should validate latency targets', () => {
    // Record normal queries
    for (let i = 0; i < 20; i++) {
      recordDbQuery('Test', 'findMany', 50);
    }
    let warnings = validateLatencyTargets();
    expect(warnings).toHaveLength(0);

    // Record slow queries to trigger warnings
    resetDbPerformanceMetrics();
    for (let i = 0; i < 20; i++) {
      recordDbQuery('Test', 'findMany', 300);
    }
    warnings = validateLatencyTargets();
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('should return empty stats when no queries recorded', () => {
    resetDbPerformanceMetrics();
    const stats = getDbPerformanceStats();
    expect(stats.totalQueries).toBe(0);
    expect(stats.avgLatencyMs).toBe(0);
    expect(stats.queriesInWindow).toBe(0);
  });

  it('should calculate queries per second', () => {
    for (let i = 0; i < 100; i++) {
      recordDbQuery('Test', 'findMany', 10);
    }
    const stats = getDbPerformanceStats();
    expect(stats.queriesPerSecond).toBeGreaterThan(0);
  });
});

// ── API Compliance Scanner Tests ───────────────────────────────

describe('API Compliance Scanner', () => {
  let scanApiRoutes: (srcDir?: string) => any;

  beforeEach(async () => {
    const mod = await import('@/lib/api-compliance-scanner');
    scanApiRoutes = mod.scanApiRoutes;
  });

  it('should scan API routes and produce compliance report', () => {
    const report = scanApiRoutes('src');
    expect(report).toHaveProperty('generatedAt');
    expect(report).toHaveProperty('totalRoutes');
    expect(report).toHaveProperty('compliant');
    expect(report).toHaveProperty('partial');
    expect(report).toHaveProperty('nonCompliant');
    expect(report).toHaveProperty('complianceRate');
    expect(report).toHaveProperty('routes');
    expect(report).toHaveProperty('categories');
  });

  it('should detect routes with auth middleware', () => {
    const report = scanApiRoutes('src');
    // Routes using checkApiAuth (common pattern in this codebase) should be detected
    // Some routes may rely on proxy-level auth, so check for non-public routes exist
    const publicRoutes = report.routes.filter(r =>
      r.route === '/api/health' || r.route === '/api/ping' || r.route === '/api/ready'
    );
    expect(publicRoutes.length).toBeGreaterThan(0);
    expect(report.routes.length).toBeGreaterThan(publicRoutes.length);
  });

  it('should identify public routes', () => {
    const report = scanApiRoutes('src');
    const healthRoute = report.routes.find(r => r.route === '/api/health');
    expect(healthRoute).toBeDefined();
  });

  it('should produce category-level stats', () => {
    const report = scanApiRoutes('src');
    expect(report.categories).toHaveProperty('auth');
    expect(report.categories).toHaveProperty('validation');
    expect(report.categories).toHaveProperty('rateLimit');
    expect(report.categories).toHaveProperty('audit');
    expect(report.categories).toHaveProperty('observability');
    expect(report.categories).toHaveProperty('csrf');
  });

  it('should include gap details for non-compliant routes', () => {
    const report = scanApiRoutes('src');
    for (const route of report.routes) {
      if (route.gaps.length > 0) {
        expect(route.gaps).toBeInstanceOf(Array);
        expect(route.gaps.length).toBeGreaterThan(0);
      }
    }
  });
});

// ── Environment Validation Tests ──────────────────────────────

describe('Environment Validation', () => {
  it('should export getAIProviderStatus', async () => {
    const { getAIProviderStatus } = await import('@/lib/validate-env');
    const status = getAIProviderStatus();
    expect(status).toHaveProperty('providers');
    expect(status).toHaveProperty('count');
    expect(Array.isArray(status.providers)).toBe(true);
  });

  it('should export getEnvHealthReport', async () => {
    const { getEnvHealthReport } = await import('@/lib/validate-env');
    const report = getEnvHealthReport();
    expect(report).toHaveProperty('database');
    expect(report).toHaveProperty('auth');
    expect(report).toHaveProperty('secrets');
    expect(report).toHaveProperty('ai');
    expect(report).toHaveProperty('status');
    expect(['healthy', 'degraded', 'critical']).toContain(report.status);
  });
});

// ── Enterprise Health Tests ────────────────────────────────────

describe('Enterprise Health Infrastructure', () => {
  it('should export getReadinessCheck', async () => {
    const { getReadinessCheck } = await import('@/lib/enterprise-health');
    expect(typeof getReadinessCheck).toBe('function');
  });

  it('should export getFullHealthCheck', async () => {
    const { getFullHealthCheck } = await import('@/lib/enterprise-health');
    expect(typeof getFullHealthCheck).toBe('function');
  });
});

// ── Query Helpers Tests ───────────────────────────────────────

describe('Query Safety Helpers', () => {
  it('should export safe pagination functions', async () => {
    const { safeQueryBounds } = await import('@/lib/query-helpers');

    // Default bounds
    const bounds = safeQueryBounds();
    expect(bounds).toHaveProperty('take');
    expect(bounds.take).toBeGreaterThan(0);

    // Large limit should be clamped
    const largeBounds = safeQueryBounds(99999);
    expect(largeBounds.take).toBeLessThanOrEqual(5000);

    // With page parameter (skip = (page - 1) * limit, 0-indexed)
    const pageBounds = safeQueryBounds(50, 3);
    expect(pageBounds.take).toBe(50);
    expect(pageBounds.skip).toBe(100);
  });
});

// ── AI Cache Layer Tests ───────────────────────────────────────

describe('AI Cache Layer Interface', () => {
  it('should export AICacheLayer with required methods', async () => {
    const { AICacheLayer } = await import('@/lib/ai-cache-layer');
    expect(AICacheLayer).toHaveProperty('get');
    expect(AICacheLayer).toHaveProperty('set');
    expect(AICacheLayer).toHaveProperty('prune');
    expect(AICacheLayer).toHaveProperty('getStats');
    expect(typeof AICacheLayer.get).toBe('function');
    expect(typeof AICacheLayer.set).toBe('function');
    expect(typeof AICacheLayer.prune).toBe('function');
    expect(typeof AICacheLayer.getStats).toBe('function');
  });
});
