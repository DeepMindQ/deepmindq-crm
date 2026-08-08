/**
 * Task 4.7 — Enrichment Orchestrator Tests
 *
 * Tests for: queue, provider fallback, retry, dedup,
 * rate limiting, and the orchestrator flow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnrichmentQueue } from '@/lib/enrichment/enrichment-queue';
import type {
  EnrichmentProvider,
  EnrichmentResult,
  ContactEnrichmentResult,
} from '@/lib/enrichment/enrichment-provider';

// ─── Mock Provider Factory ───────────────────────────────────────────

function createMockProvider(opts: {
  id: string;
  name: string;
  type: 'clearbit' | 'apollo';
  priority: number;
  companyResult?: EnrichmentResult;
  contactResult?: ContactEnrichmentResult;
  available?: boolean;
  error?: Error;
}): EnrichmentProvider {
  return {
    id: opts.id,
    name: opts.name,
    type: opts.type,
    priority: opts.priority,
    enrichCompany: vi.fn(async () => {
      if (opts.error) throw opts.error;
      return opts.companyResult ?? {
        provider: opts.id,
        confidence: 0.8,
        data: { name: 'Test Corp', domain: 'test.com', industry: 'SaaS' },
        creditsUsed: 1,
      };
    }),
    enrichContact: vi.fn(async () => {
      if (opts.error) throw opts.error;
      return opts.contactResult ?? {
        provider: opts.id,
        confidence: 0.7,
        data: { fullName: 'Jane Doe', email: 'jane@test.com', title: 'CEO' },
        creditsUsed: 1,
      };
    }),
    isAvailable: vi.fn(async () => opts.available ?? true),
    getRemainingCredits: vi.fn(async () => 100),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('EnrichmentQueue', () => {
  let queue: EnrichmentQueue;

  beforeEach(() => {
    queue = new EnrichmentQueue({
      maxRetries: 2,
      baseRetryDelayMs: 50,
      maxRetryDelayMs: 200,
      deduplicationWindowMs: 60_000,
      rateLimitPerMinute: { clearbit: 100, apollo: 100 },
      batchIntervalMs: 0,
    });
  });

  // ─── Enqueue & Dedup ────────────────────────────────────────────

  describe('enqueue', () => {
    it('should enqueue an item and return its ID', () => {
      const provider = createMockProvider({
        id: 'clearbit', name: 'Clearbit', type: 'clearbit', priority: 1,
      });
      const id = queue.enqueue({
        entityType: 'company',
        entityId: 'c1',
        lookupKey: 'test.com',
        providers: [provider],
      });
      expect(id).toBeTruthy();
      expect(queue.getQueueLength()).toBe(1);
    });

    it('should deduplicate items within the dedup window', () => {
      const provider = createMockProvider({
        id: 'clearbit', name: 'Clearbit', type: 'clearbit', priority: 1,
      });
      const id1 = queue.enqueue({
        entityType: 'company',
        entityId: 'c1',
        lookupKey: 'test.com',
        providers: [provider],
      });
      const id2 = queue.enqueue({
        entityType: 'company',
        entityId: 'c2',
        lookupKey: 'test.com', // same key
        providers: [provider],
      });
      expect(id1).toBeTruthy();
      expect(id2).toBeNull(); // deduplicated
      expect(queue.getQueueLength()).toBe(1);
    });

    it('should sort providers by priority', () => {
      const lowPri = createMockProvider({
        id: 'apollo', name: 'Apollo', type: 'apollo', priority: 5,
      });
      const highPri = createMockProvider({
        id: 'clearbit', name: 'Clearbit', type: 'clearbit', priority: 1,
      });
      const id = queue.enqueue({
        entityType: 'company',
        entityId: 'c1',
        lookupKey: 'test.com',
        providers: [lowPri, highPri], // passed out of order
      });
      expect(id).toBeTruthy();
      const item = queue.getItem(id!);
      // First provider should be highest priority (lowest number)
      expect(item!.providers[0]!.id).toBe('clearbit');
    });
  });

  // ─── Processing ────────────────────────────────────────────────

  describe('processNext', () => {
    it('should process a queued company enrichment', async () => {
      const provider = createMockProvider({
        id: 'clearbit', name: 'Clearbit', type: 'clearbit', priority: 1,
      });
      queue.enqueue({
        entityType: 'company',
        entityId: 'c1',
        lookupKey: 'test.com',
        providers: [provider],
      });
      const result = await queue.processNext();
      expect(result!.status).toBe('completed');
      expect(result!.result).toBeDefined();
      expect((result!.result as EnrichmentResult).data.name).toBe('Test Corp');
      expect(provider.enrichCompany).toHaveBeenCalledWith('test.com');
    });

    it('should process a queued contact enrichment', async () => {
      const provider = createMockProvider({
        id: 'apollo', name: 'Apollo', type: 'apollo', priority: 1,
      });
      queue.enqueue({
        entityType: 'contact',
        entityId: 'ct1',
        lookupKey: 'jane@test.com',
        providers: [provider],
      });
      const result = await queue.processNext();
      expect(result!.status).toBe('completed');
      expect((result!.result as ContactEnrichmentResult).data.fullName).toBe('Jane Doe');
      expect(provider.enrichContact).toHaveBeenCalledWith('jane@test.com');
    });
  });

  // ─── Provider Fallback ─────────────────────────────────────────

  describe('provider fallback', () => {
    it('should fall back to next provider when first fails', async () => {
      const failing = createMockProvider({
        id: 'clearbit', name: 'Clearbit', type: 'clearbit', priority: 1,
        error: new Error('API down'),
      });
      const fallback = createMockProvider({
        id: 'apollo', name: 'Apollo', type: 'apollo', priority: 2,
        companyResult: {
          provider: 'apollo',
          confidence: 0.6,
          data: { name: 'Test Corp (Apollo)', domain: 'test.com' },
          creditsUsed: 1,
        },
      });
      queue.enqueue({
        entityType: 'company',
        entityId: 'c1',
        lookupKey: 'test.com',
        providers: [failing, fallback],
      });
      const result = await queue.processNext();
      expect(result!.status).toBe('completed');
      expect((result!.result as EnrichmentResult).provider).toBe('apollo');
      expect((result!.result as EnrichmentResult).data.name).toBe('Test Corp (Apollo)');
    });

    it('should fail when all providers fail', async () => {
      const failing1 = createMockProvider({
        id: 'clearbit', name: 'Clearbit', type: 'clearbit', priority: 1,
        error: new Error('API down'),
      });
      const failing2 = createMockProvider({
        id: 'apollo', name: 'Apollo', type: 'apollo', priority: 2,
        error: new Error('API key invalid'),
      });
      queue.enqueue({
        entityType: 'company',
        entityId: 'c1',
        lookupKey: 'test.com',
        providers: [failing1, failing2],
      });
      const result = await queue.processNext();
      expect(result!.status).toBe('failed');
      expect(result!.error).toContain('All providers failed');
    });
  });

  // ─── Unavailable Provider ──────────────────────────────────────

  describe('unavailable provider', () => {
    it('should skip unavailable providers', async () => {
      const unavailable = createMockProvider({
        id: 'clearbit', name: 'Clearbit', type: 'clearbit', priority: 1,
        available: false,
      });
      const available = createMockProvider({
        id: 'apollo', name: 'Apollo', type: 'apollo', priority: 2,
      });
      queue.enqueue({
        entityType: 'company',
        entityId: 'c1',
        lookupKey: 'test.com',
        providers: [unavailable, available],
      });
      const result = await queue.processNext();
      expect(result!.status).toBe('completed');
      expect((result!.result as EnrichmentResult).provider).toBe('apollo');
      expect(unavailable.enrichCompany).not.toHaveBeenCalled();
    });
  });

  // ─── Empty Result Handling ─────────────────────────────────────

  describe('empty results', () => {
    it('should try next provider when first returns zero confidence', async () => {
      const emptyResult = createMockProvider({
        id: 'clearbit', name: 'Clearbit', type: 'clearbit', priority: 1,
        companyResult: { provider: 'clearbit', confidence: 0, data: {}, creditsUsed: 1 },
      });
      const goodResult = createMockProvider({
        id: 'apollo', name: 'Apollo', type: 'apollo', priority: 2,
      });
      queue.enqueue({
        entityType: 'company',
        entityId: 'c1',
        lookupKey: 'test.com',
        providers: [emptyResult, goodResult],
      });
      const result = await queue.processNext();
      expect(result!.status).toBe('completed');
      expect((result!.result as EnrichmentResult).provider).toBe('apollo');
    });
  });

  // ─── Batch Processing ──────────────────────────────────────────

  describe('processAll', () => {
    it('should process all queued items', async () => {
      const provider = createMockProvider({
        id: 'clearbit', name: 'Clearbit', type: 'clearbit', priority: 1,
      });
      queue.enqueue({
        entityType: 'company', entityId: 'c1', lookupKey: 'a.com', providers: [provider],
      });
      queue.enqueue({
        entityType: 'company', entityId: 'c2', lookupKey: 'b.com', providers: [provider],
      });
      queue.enqueue({
        entityType: 'company', entityId: 'c3', lookupKey: 'c.com', providers: [provider],
      });

      const results = await queue.processAll();
      expect(results.length).toBe(3);
      expect(results.every(r => r.status === 'completed')).toBe(true);
      expect(queue.getQueueLength()).toBe(0);
    });
  });

  // ─── Rate Limiting ─────────────────────────────────────────────

  describe('rate limiting', () => {
    it('should track rate limit remaining', () => {
      const provider = createMockProvider({
        id: 'clearbit', name: 'Clearbit', type: 'clearbit', priority: 1,
      });
      queue.enqueue({
        entityType: 'company', entityId: 'c1', lookupKey: 'test.com', providers: [provider],
      });
      // Before processing, full rate limit available
      expect(queue.getProviderRateLimitRemaining('clearbit')).toBe(100);
    });
  });

  // ─── Prune ─────────────────────────────────────────────────────

  describe('prune', () => {
    it('should remove non-queued items', async () => {
      const provider = createMockProvider({
        id: 'clearbit', name: 'Clearbit', type: 'clearbit', priority: 1,
      });
      queue.enqueue({
        entityType: 'company', entityId: 'c1', lookupKey: 'test.com', providers: [provider],
      });
      await queue.processNext();
      expect(queue.getQueueLength()).toBe(0);
      const pruned = queue.prune();
      expect(pruned).toBe(1); // completed item removed by prune
    });
  });
});
