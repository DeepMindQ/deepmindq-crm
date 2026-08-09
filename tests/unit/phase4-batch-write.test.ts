/**
 * Phase 4 — Item 6.7: Batch Write Optimization Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/persistence/persistence-failure-queue', () => ({
  getPersistenceFailureQueue: () => ({
    enqueue: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/lib/persistence/persistence-health-monitor', () => ({
  getPersistenceHealthMonitor: () => ({
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
  }),
}));

describe('Batch Write Optimization (Phase 4.6.7)', () => {
  it('should have BATCH_FLUSH_SIZE of 100', async () => {
    const { getPersistenceAdapter } = await import('@/lib/persistence/intelligence-persistence-adapter');
    const adapter = getPersistenceAdapter() as any;
    // Class static property
    const AdapterClass = Object.getPrototypeOf(adapter).constructor;
    expect(AdapterClass.BATCH_FLUSH_SIZE).toBe(100);
  });

  it('should have BATCH_FLUSH_INTERVAL_MS of 500', async () => {
    const { getPersistenceAdapter } = await import('@/lib/persistence/intelligence-persistence-adapter');
    const adapter = getPersistenceAdapter() as any;
    const AdapterClass = Object.getPrototypeOf(adapter).constructor;
    expect(AdapterClass.BATCH_FLUSH_INTERVAL_MS).toBe(500);
  });

  it('should handle empty batch gracefully', async () => {
    const { getPersistenceAdapter } = await import('@/lib/persistence/intelligence-persistence-adapter');
    const adapter = getPersistenceAdapter();
    const results = await adapter.writeBatch([]);
    expect(results).toHaveLength(0);
  });

  it('should return success results when persistence is disabled', async () => {
    const { getPersistenceAdapter } = await import('@/lib/persistence/intelligence-persistence-adapter');
    const adapter = getPersistenceAdapter();
    // When persistence is disabled, all results should be success
    const results = await adapter.writeBatch([
      { store: 'knowledge_graph_nodes', key: 'k1', operation: 'upsert', data: { label: 'test' }, timestamp: Date.now() },
      { store: 'knowledge_graph_nodes', key: 'k2', operation: 'upsert', data: { label: 'test2' }, timestamp: Date.now() },
      { store: 'ai_memory', key: 'k3', operation: 'upsert', data: { content: 'test' }, timestamp: Date.now() },
    ]);
    expect(results).toHaveLength(3);
    results.forEach(r => expect(r.success).toBe(true));
  });

  it('should support flushBatchQueue method', async () => {
    const { getPersistenceAdapter } = await import('@/lib/persistence/intelligence-persistence-adapter');
    const adapter = getPersistenceAdapter();
    // Should not throw when flushing empty queue
    await expect(adapter.flushBatchQueue()).resolves.not.toThrow();
  });

  it('should support getPoolMetrics method', async () => {
    const { getPersistenceAdapter } = await import('@/lib/persistence/intelligence-persistence-adapter');
    const adapter = getPersistenceAdapter();
    const metrics = adapter.getPoolMetrics();
    // When persistence is disabled, should return null
    expect(metrics).toBeNull();
  });
});
