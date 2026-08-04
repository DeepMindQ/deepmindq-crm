/**
 * WI-18.2 Phase 3.5 — Evidence Pipeline Structure & Completeness Tests
 * ======================================================================
 *
 * Validates that ALL 5 evidence categories have collection infrastructure:
 *   1. Persistence Reliability — failure queue, health monitor
 *   2. Shadow Reconciliation — shadow-mode-comparator
 *   3. Real Restart Validation — restart-validation script
 *   4. Runtime Tenant Validation — tenant-validation script
 *   5. Performance Observation — performance endpoint + evidence performance section
 *
 * These tests verify file existence, export structure, interface completeness,
 * and auth pattern consistency across the evidence pipeline.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/timer-registry', () => ({
  registerTimer: vi.fn(() => {}),
}));

vi.mock('@/lib/embeddings', () => ({
  cosineSimilarity: vi.fn(() => 0.5),
  tokenize: vi.fn(() => ['test']),
  tokenizeWithBigrams: vi.fn(() => ['test']),
}));

vi.mock('@prisma/client', () => ({
  Prisma: vi.fn().mockImplementation(() => ({
    knowledgeGraphNode: {
      upsert: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue({}),
    },
    knowledgeGraphEdge: {
      upsert: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue({}),
    },
    aIMemoryEntry: {
      upsert: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue({}),
    },
    retrievalIndexEntry: {
      upsert: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue({}),
    },
    retrievalCorpusStats: {
      upsert: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    persistenceOperationLog: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    },
    persistenceHealthSnapshot: { create: vi.fn().mockResolvedValue({}) },
    shadowModeReconciliation: { create: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue([]) },
    $queryRaw: vi.fn().mockResolvedValue([{ _1: 1 }]),
    $disconnect: vi.fn().mockResolvedValue(undefined),
  })),
}));

// ── Imports ────────────────────────────────────────────────────────

import { getPersistenceHealthMonitor } from '@/lib/persistence/persistence-health-monitor';
import { getPersistenceFailureQueue } from '@/lib/persistence/persistence-failure-queue';
import { getPersistenceStartupReport } from '@/lib/persistence/cold-start-loader';
import { reconcileAllStores } from '@/lib/persistence/shadow-mode-comparator';

// ── Tests ────────────────────────────────────────────────────────

describe('Phase 3.5: Evidence Pipeline Completeness', () => {

  // ── 1. Performance Evidence Endpoint Structure ──

  it('Category 5: performance endpoint file exists', async () => {
    const fs = await import('fs');
    expect(fs.existsSync('src/app/api/cron/persistence-performance/route.ts')).toBe(true);
  });

  it('Category 5: performance endpoint exports POST and GET', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/app/api/cron/persistence-performance/route.ts', 'utf-8');
    expect(source).toContain('export async function POST(');
    expect(source).toContain('export async function GET(');
  });

  it('Category 5: performance endpoint uses CRON_SECRET auth pattern', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/app/api/cron/persistence-performance/route.ts', 'utf-8');
    expect(source).toContain('CRON_SECRET');
    expect(source).toContain('authorization');
    expect(source).toContain('Bearer');
    expect(source).toContain('Unauthorized');
  });

  it('Category 5: performance endpoint uses force-dynamic', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/app/api/cron/persistence-performance/route.ts', 'utf-8');
    expect(source).toContain("export const dynamic = 'force-dynamic'");
  });

  it('Category 5: performance endpoint has PerformanceReport interface with all fields', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/app/api/cron/persistence-performance/route.ts', 'utf-8');
    expect(source).toContain('interface PerformanceReport');
    expect(source).toContain('dbLatencyMs');
    expect(source).toContain('persistenceLatency');
    expect(source).toContain('queueDepth');
    expect(source).toContain('recoveryRate');
    expect(source).toContain('coldStart');
    expect(source).toContain('processMemory');
    expect(source).toContain('heapUsedMb');
    expect(source).toContain('heapTotalMb');
    expect(source).toContain('rssMb');
    expect(source).toContain('lastWriteLatencyMs');
  });

  it('Category 5: performance endpoint collects process.memoryUsage()', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/app/api/cron/persistence-performance/route.ts', 'utf-8');
    expect(source).toContain('process.memoryUsage()');
  });

  it('Category 5: performance endpoint measures DB latency with SELECT 1', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/app/api/cron/persistence-performance/route.ts', 'utf-8');
    expect(source).toContain('SELECT 1');
  });

  // ── 2. Evidence Cron Report Performance Section ──

  it('evidence cron report interface has performance section', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/app/api/cron/persistence-evidence/route.ts', 'utf-8');
    expect(source).toContain('performance:');
    expect(source).toContain('dbLatencyMs');
    expect(source).toContain('processMemoryMb');
    expect(source).toContain('perStoreLatency');
  });

  it('evidence cron collects DB latency via SELECT 1', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/app/api/cron/persistence-evidence/route.ts', 'utf-8');
    expect(source).toContain('$queryRaw`SELECT 1');
  });

  it('evidence cron collects process memory usage', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/app/api/cron/persistence-evidence/route.ts', 'utf-8');
    expect(source).toContain('process.memoryUsage()');
  });

  it('evidence cron collects per-store latency from health monitor', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/app/api/cron/persistence-evidence/route.ts', 'utf-8');
    // Section 5 in the evidence cron uses health monitor for per-store latency
    expect(source).toContain('lastWriteLatencyMs');
    expect(source).toContain('avgLatencyMs');
  });

  // ── 3. Evidence Report Interface Completeness (all 5 categories) ──

  it('evidence report interface has all 5 category fields', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/app/api/cron/persistence-evidence/route.ts', 'utf-8');
    // Category 1: Reliability
    expect(source).toContain('reliability:');
    expect(source).toContain('totalWrites');
    expect(source).toContain('totalFailures');
    expect(source).toContain('queueDepth');
    expect(source).toContain('deadLetterCount');
    expect(source).toContain('recoveryRate');
    // Category 2: Reconciliation
    expect(source).toContain('reconciliation:');
    expect(source).toContain('mapCount');
    expect(source).toContain('dbCount');
    // Category 3: Health
    expect(source).toContain('health:');
    expect(source).toContain('overallHealth');
    expect(source).toContain('criticalExists');
    // Category 4: Startup
    expect(source).toContain('startup:');
    expect(source).toContain('completeness');
    expect(source).toContain('durationMs');
    // Category 5: Performance
    expect(source).toContain('performance:');
    expect(source).toContain('dbLatencyMs');
    expect(source).toContain('processMemoryMb');
    expect(source).toContain('perStoreLatency');
  });

  // ── 4. All Operational Scripts Exist (Categories 3 & 4) ──

  it('all 4 operational scripts exist', async () => {
    const fs = await import('fs');
    expect(fs.existsSync('scripts/persistence-shadow-activate.ts')).toBe(true);
    expect(fs.existsSync('scripts/persistence-restart-validation.ts')).toBe(true);
    expect(fs.existsSync('scripts/persistence-tenant-validation.ts')).toBe(true);
    expect(fs.existsSync('scripts/persistence-activation-report.ts')).toBe(true);
  });

  // ── 5. All 3 API Endpoints Exist ──

  it('all 3 persistence API endpoints exist', async () => {
    const fs = await import('fs');
    expect(fs.existsSync('src/app/api/health/persistence/route.ts')).toBe(true);
    expect(fs.existsSync('src/app/api/cron/persistence-evidence/route.ts')).toBe(true);
    expect(fs.existsSync('src/app/api/cron/persistence-performance/route.ts')).toBe(true);
  });

  // ── 6. Health Endpoint Provides Per-Store Latency ──

  it('health endpoint exposes per-store lastWriteLatencyMs', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/app/api/health/persistence/route.ts', 'utf-8');
    expect(source).toContain('lastWriteLatencyMs');
  });

  // ── 7. Auth Pattern Consistency ──

  it('performance endpoint auth pattern matches evidence endpoint', async () => {
    const fs = await import('fs');
    const perfSource = fs.readFileSync('src/app/api/cron/persistence-performance/route.ts', 'utf-8');
    const evidenceSource = fs.readFileSync('src/app/api/cron/persistence-evidence/route.ts', 'utf-8');

    // Both check CRON_SECRET env var
    expect(perfSource).toContain("const CRON_SECRET = process.env.CRON_SECRET");
    expect(evidenceSource).toContain("const CRON_SECRET = process.env.CRON_SECRET");

    // Both check Bearer token
    expect(perfSource).toContain("`Bearer ${CRON_SECRET}`");
    expect(evidenceSource).toContain("`Bearer ${CRON_SECRET}`");
  });

  // ── 8. Health Monitor Provides Latency Data for Performance Collection ──

  it('health monitor tracks lastWriteLatencyMs per store', () => {
    const hm = getPersistenceHealthMonitor();
    const report = hm.generateHealthReport();

    expect(report.stores.length).toBeGreaterThan(0);
    for (const store of report.stores) {
      expect(store).toHaveProperty('lastWriteLatencyMs');
      expect(typeof store.lastWriteLatencyMs).toBe('number');
    }
  });

  it('health monitor tracks totalWrites and totalFailures per store', () => {
    const hm = getPersistenceHealthMonitor();
    const report = hm.generateHealthReport();

    for (const store of report.stores) {
      expect(store).toHaveProperty('totalWrites');
      expect(store).toHaveProperty('totalFailures');
      expect(typeof store.totalWrites).toBe('number');
      expect(typeof store.totalFailures).toBe('number');
    }
  });

  // ── 9. Failure Queue Provides Performance-Relevant Stats ──

  it('failure queue provides queueDepth for performance monitoring', async () => {
    const queue = getPersistenceFailureQueue();
    const depth = await queue.getQueueDepth();
    expect(typeof depth).toBe('number');
  });

  it('failure queue provides recovery stats', () => {
    const queue = getPersistenceFailureQueue();
    const stats = queue.getStats();
    expect(stats).toHaveProperty('totalRetried');
    expect(stats).toHaveProperty('totalRecovered');
  });

  // ── 10. Cold Start Provides Duration for Performance Evidence ──

  it('cold start report provides startupDurationMs', () => {
    const report = getPersistenceStartupReport();
    expect(report).toHaveProperty('startupDurationMs');
    expect(typeof report.startupDurationMs).toBe('number');
  });

  // ── 11. Dynamic Import Pattern Consistency ──

  it('performance endpoint uses dynamic imports for persistence modules', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/app/api/cron/persistence-performance/route.ts', 'utf-8');
    expect(source).toContain('await import(');
    expect(source).toContain('persistence-health-monitor');
    expect(source).toContain('persistence-failure-queue');
    expect(source).toContain('cold-start-loader');
  });

  // ── 12. Evidence cron collects all 5 sections ──

  it('evidence cron has section comments for all 5 collection areas', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/app/api/cron/persistence-evidence/route.ts', 'utf-8');
    expect(source).toContain('// 1. Collect health monitor evidence');
    expect(source).toContain('// 2. Collect failure queue evidence');
    expect(source).toContain('// 3. Collect startup evidence');
    expect(source).toContain('// 4. Collect shadow reconciliation evidence');
    expect(source).toContain('// 5. Collect performance observation evidence');
  });

  // ── 13. Shadow reconciliation infrastructure (Category 2) ──

  it('shadow reconciliation returns array structure when called', async () => {
    const results = await reconcileAllStores();
    expect(Array.isArray(results)).toBe(true);
  });

  // ── 14. Doc comment references all 5 categories in evidence endpoint ──

  it('evidence endpoint doc comment references 5 collection areas', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/app/api/cron/persistence-evidence/route.ts', 'utf-8');
    expect(source).toContain('1. Persistence reliability');
    expect(source).toContain('2. Shadow reconciliation');
    expect(source).toContain('3. Operational health');
    expect(source).toContain('4. Cold start');
    expect(source).toContain('5. Performance observation');
  });
});
