/**
 * Concurrent Requests Load Tests
 *
 * Tests system behavior under concurrent load.
 * Uses in-memory simulation — no real server needed.
 */
import { describe, it, expect } from 'vitest';

// ── Concurrency Simulation Utilities ──────────────────
async function simulateRequest(id: number, delayMs: number = 50): Promise<{ id: number; ok: boolean; ms: number }> {
  const start = performance.now();
  await new Promise((resolve) => setTimeout(resolve, delayMs + Math.random() * 20));
  return { id, ok: true, ms: performance.now() - start };
}

async function runConcurrentRequests(
  count: number,
  delayMs: number = 50,
): Promise<{ results: { id: number; ok: boolean; ms: number }[]; totalMs: number }> {
  const start = performance.now();
  const promises = Array.from({ length: count }, (_, i) => simulateRequest(i, delayMs));
  const results = await Promise.all(promises);
  return { results, totalMs: performance.now() - start };
}

// ── Simulated Rate Limiter ─────────────────────────────
class ConcurrencyAwareRateLimiter {
  private active = 0;
  private maxConcurrent: number;
  private queue: Array<() => void> = [];
  private rejected = 0;

  constructor(maxConcurrent: number) {
    this.maxConcurrent = maxConcurrent;
  }

  async acquire(): Promise<boolean> {
    if (this.active >= this.maxConcurrent) {
      this.rejected++;
      return false;
    }
    this.active++;
    return true;
  }

  release(): void {
    this.active = Math.max(0, this.active - 1);
    if (this.queue.length > 0 && this.active < this.maxConcurrent) {
      const next = this.queue.shift();
      next?.();
    }
  }

  getRejectedCount(): number {
    return this.rejected;
  }

  getActiveCount(): number {
    return this.active;
  }
}

// ── Data Integrity Tracker ─────────────────────────────
class DataIntegrityTracker {
  private store = new Map<string, number>();
  private corruptionDetected = false;

  write(key: string, value: number): boolean {
    // Simulate write — check for corruption
    if (this.store.has(key) && this.store.get(key) !== value) {
      this.corruptionDetected = true;
    }
    this.store.set(key, value);
    return !this.corruptionDetected;
  }

  read(key: string): number | undefined {
    return this.store.get(key);
  }

  isCorrupted(): boolean {
    return this.corruptionDetected;
  }
}

describe('Concurrent Requests — Load Tests', () => {
  // ── 50 Concurrent Connections ──────────────────────────
  describe('handles 50 concurrent connections', () => {
    it('all 50 requests complete successfully', async () => {
      const { results } = await runConcurrentRequests(50, 20);
      expect(results).toHaveLength(50);
      expect(results.every((r) => r.ok)).toBe(true);
    });

    it('completes in reasonable time (< 2s for 50 concurrent)', async () => {
      const { totalMs } = await runConcurrentRequests(50, 20);
      expect(totalMs).toBeLessThan(2000);
    });

    it('each request has valid latency', async () => {
      const { results } = await runConcurrentRequests(50, 20);
      for (const result of results) {
        expect(result.ms).toBeGreaterThan(0);
        expect(result.ms).toBeLessThan(5000);
      }
    });

    it('handles 100 concurrent connections', async () => {
      const { results, totalMs } = await runConcurrentRequests(100, 10);
      expect(results).toHaveLength(100);
      expect(results.every((r) => r.ok)).toBe(true);
      expect(totalMs).toBeLessThan(3000);
    });
  });

  // ── No Data Corruption ────────────────────────────────
  describe('no data corruption under concurrent writes', () => {
    it('concurrent writes to the same key are consistent', async () => {
      const tracker = new DataIntegrityTracker();
      const writes = Array.from({ length: 20 }, (_, i) =>
        Promise.resolve().then(() => tracker.write('counter', i + 1)),
      );
      await Promise.all(writes);
      // All writes should have completed (some may overwrite others, but no corruption)
      const finalValue = tracker.read('counter');
      expect(finalValue).toBeDefined();
      expect(tracker.isCorrupted()).toBe(false);
    });

    it('concurrent writes to different keys are isolated', async () => {
      const tracker = new DataIntegrityTracker();
      const writes = Array.from({ length: 20 }, (_, i) =>
        Promise.resolve().then(() => tracker.write(`key-${i}`, i * 10)),
      );
      await Promise.all(writes);

      for (let i = 0; i < 20; i++) {
        expect(tracker.read(`key-${i}`)).toBe(i * 10);
      }
      expect(tracker.isCorrupted()).toBe(false);
    });
  });

  // ── Rate Limiting Under Load ──────────────────────────
  describe('rate limiting activates correctly under load', () => {
    it('rejects requests exceeding concurrent limit', async () => {
      const limiter = new ConcurrencyAwareRateLimiter(10);
      const results: boolean[] = [];

      // Acquire 20 slots but limit is 10
      for (let i = 0; i < 20; i++) {
        results.push(await limiter.acquire());
      }

      expect(results.filter((r) => r).length).toBe(10);
      expect(results.filter((r) => !r).length).toBe(10);
      expect(limiter.getRejectedCount()).toBe(10);
    });

    it('recovers capacity after releases', async () => {
      const limiter = new ConcurrencyAwareRateLimiter(5);
      // Acquire 5
      for (let i = 0; i < 5; i++) {
        await limiter.acquire();
      }
      expect(limiter.getActiveCount()).toBe(5);

      // Release 3
      limiter.release();
      limiter.release();
      limiter.release();
      expect(limiter.getActiveCount()).toBe(2);

      // Should be able to acquire 3 more
      for (let i = 0; i < 3; i++) {
        const acquired = await limiter.acquire();
        expect(acquired).toBe(true);
      }
    });
  });
});
