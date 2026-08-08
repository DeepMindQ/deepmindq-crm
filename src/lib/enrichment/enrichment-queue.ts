/**
 * Task 4.7 — Enrichment Queue
 *
 * Priority queue for enrichment requests with:
 *   - Per-provider rate limiting (sliding window)
 *   - Retry logic: 3 retries with exponential backoff
 *   - Deduplication: skip same entity within 24 hours
 *   - Provider fallback: cascade through providers by priority
 *   - Batch processing support
 */

import type { EnrichmentProvider } from './enrichment-provider';
import type {
  EnrichmentResult,
  ContactEnrichmentResult,
  EnrichmentQueueConfig,
  EnrichmentEntityType,
} from './enrichment-provider';
import { DEFAULT_ENRICHMENT_QUEUE_CONFIG } from './enrichment-provider';
import { logger } from '@/lib/logger';

// ─── Queue Item ───────────────────────────────────────────────────────

export interface EnrichmentQueueItem {
  id: string;
  entityType: EnrichmentEntityType;
  entityId: string;
  lookupKey: string; // domain for company, email for contact
  priority: number;  // lower = higher priority
  providers: EnrichmentProvider[];
  providerIndex: number;
  retryCount: number;
  maxRetries: number;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'skipped';
  result?: EnrichmentResult | ContactEnrichmentResult;
  error?: string;
  enqueuedAt: number;
  startedAt?: number;
  completedAt?: number;
}

// ─── Rate Limiter (per-provider sliding window) ───────────────────────

class SlidingWindowRateLimiter {
  private timestamps: Map<string, number[]> = new Map();
  private limits: Map<string, number> = new Map();
  private windowMs = 60_000; // 1 minute

  setLimit(providerId: string, requestsPerMinute: number) {
    this.limits.set(providerId, requestsPerMinute);
  }

  async acquire(providerId: string): Promise<void> {
    const limit = this.limits.get(providerId) ?? 30;
    const now = Date.now();
    const cutoff = now - this.windowMs;

    let timestamps = this.timestamps.get(providerId);
    if (!timestamps) {
      timestamps = [];
      this.timestamps.set(providerId, timestamps);
    }

    // Prune old timestamps
    const recent = timestamps.filter(t => t > cutoff);
    this.timestamps.set(providerId, recent);

    if (recent.length >= limit) {
      // Wait until the oldest recent timestamp expires
      const oldestRecent = recent[0]!;
      const waitMs = oldestRecent + this.windowMs - now + 100; // +100ms buffer
      if (waitMs > 0) {
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
    }

    // Re-prune and record
    const pruned = (this.timestamps.get(providerId) ?? []).filter(t => t > Date.now() - this.windowMs);
    pruned.push(Date.now());
    this.timestamps.set(providerId, pruned);
  }

  getRemaining(providerId: string): number {
    const limit = this.limits.get(providerId) ?? 30;
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const timestamps = this.timestamps.get(providerId) ?? [];
    const recent = timestamps.filter(t => t > cutoff).length;
    return Math.max(0, limit - recent);
  }
}

// ─── Enrichment Queue ─────────────────────────────────────────────────

export class EnrichmentQueue {
  private queue: EnrichmentQueueItem[] = [];
  private dedupMap: Map<string, number> = new Map(); // lookupKey -> enqueuedAt
  private rateLimiter = new SlidingWindowRateLimiter();
  private config: EnrichmentQueueConfig;
  private processing = false;
  private idCounter = 0;

  constructor(config?: Partial<EnrichmentQueueConfig>) {
    this.config = { ...DEFAULT_ENRICHMENT_QUEUE_CONFIG, ...config };

    // Set rate limits for each provider type
    for (const [providerId, rpm] of Object.entries(this.config.rateLimitPerMinute)) {
      this.rateLimiter.setLimit(providerId, rpm);
    }
  }

  // ─── Public API ──────────────────────────────────────────────────

  /**
   * Enqueue a single enrichment request.
   * Returns the queue item ID, or null if deduplicated.
   */
  enqueue(item: {
    entityType: EnrichmentEntityType;
    entityId: string;
    lookupKey: string;
    priority?: number;
    providers: EnrichmentProvider[];
  }): string | null {
    // Check deduplication
    const existing = this.dedupMap.get(item.lookupKey);
    if (existing && (Date.now() - existing) < this.config.deduplicationWindowMs) {
      logger.debug('[enrichment-queue] Deduplicated', { lookupKey: item.lookupKey });
      return null;
    }

    const id = `eq-${++this.idCounter}-${Date.now()}`;

    // Sort providers by priority (lower = tried first)
    const sortedProviders = [...item.providers].sort((a, b) => a.priority - b.priority);

    const queueItem: EnrichmentQueueItem = {
      id,
      entityType: item.entityType,
      entityId: item.entityId,
      lookupKey: item.lookupKey,
      priority: item.priority ?? 10,
      providers: sortedProviders,
      providerIndex: 0,
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      status: 'queued',
      enqueuedAt: Date.now(),
    };

    this.queue.push(queueItem);
    this.dedupMap.set(item.lookupKey, Date.now());

    // Sort queue by priority (lower = first)
    this.queue.sort((a, b) => a.priority - b.priority);

    logger.info('[enrichment-queue] Enqueued', {
      id,
      entityType: item.entityType,
      entityId: item.entityId,
    });

    return id;
  }

  /**
   * Enqueue multiple items at once.
   */
  enqueueBatch(items: Array<{
    entityType: EnrichmentEntityType;
    entityId: string;
    lookupKey: string;
    priority?: number;
    providers: EnrichmentProvider[];
  }>): string[] {
    const ids: string[] = [];
    for (const item of items) {
      const id = this.enqueue(item);
      if (id) ids.push(id);
    }
    return ids;
  }

  /**
   * Get current queue length.
   */
  getQueueLength(): number {
    return this.queue.filter(i => i.status === 'queued').length;
  }

  /**
   * Get a queue item by ID.
   */
  getItem(id: string): EnrichmentQueueItem | undefined {
    return this.queue.find(i => i.id === id);
  }

  /**
   * Process the next item in the queue.
   * Returns the item or undefined if queue is empty.
   */
  async processNext(): Promise<EnrichmentQueueItem | undefined> {
    const item = this.queue.find(i => i.status === 'queued');
    if (!item) return undefined;

    return this.processItem(item);
  }

  /**
   * Process all items in the queue (batch).
   * Returns results for all processed items.
   */
  async processAll(): Promise<EnrichmentQueueItem[]> {
    if (this.processing) {
      logger.warn('[enrichment-queue] Already processing, skipping');
      return [];
    }

    this.processing = true;
    const results: EnrichmentQueueItem[] = [];

    try {
      while (true) {
        const item = this.queue.find(i => i.status === 'queued');
        if (!item) break;

        const result = await this.processItem(item);
        results.push(result);

        // Throttle between items in a batch
        if (this.config.batchIntervalMs > 0) {
          await new Promise(resolve => setTimeout(resolve, this.config.batchIntervalMs));
        }
      }
    } finally {
      this.processing = false;
    }

    return results;
  }

  /**
   * Get remaining rate limit for a provider.
   */
  getProviderRateLimitRemaining(providerId: string): number {
    return this.rateLimiter.getRemaining(providerId);
  }

  /**
   * Clear completed/failed items from the queue.
   */
  prune(): number {
    const before = this.queue.length;
    this.queue = this.queue.filter(i => i.status === 'queued');
    return before - this.queue.length;
  }

  // ─── Internal: Process Single Item ─────────────────────────────────

  private async processItem(item: EnrichmentQueueItem): Promise<EnrichmentQueueItem> {
    item.status = 'processing';
    item.startedAt = Date.now();

    // Try each provider in order (fallback chain)
    for (let pi = item.providerIndex; pi < item.providers.length; pi++) {
      const provider = item.providers[pi]!;

      try {
        // Check provider availability
        const available = await provider.isAvailable();
        if (!available) {
          logger.debug('[enrichment-queue] Provider unavailable, trying next', {
            provider: provider.id,
            itemId: item.id,
          });
          continue;
        }

        // Rate limit
        await this.rateLimiter.acquire(provider.id);

        // Execute enrichment
        let result: EnrichmentResult | ContactEnrichmentResult;

        if (item.entityType === 'company') {
          result = await provider.enrichCompany(item.lookupKey);
        } else {
          result = await provider.enrichContact(item.lookupKey);
        }

        // Check if result has any data (confidence > 0 or has data fields)
        const hasData = result.confidence > 0 || Object.values(result.data).some(Boolean);

        if (hasData) {
          item.result = result;
          item.status = 'completed';
          item.completedAt = Date.now();
          item.providerIndex = pi; // record which provider succeeded

          logger.info('[enrichment-queue] Item completed', {
            id: item.id,
            provider: provider.id,
            confidence: result.confidence,
            entityType: item.entityType,
          });

          return item;
        }

        // Provider returned empty data, try next
        logger.debug('[enrichment-queue] Provider returned no data, trying next', {
          provider: provider.id,
          itemId: item.id,
        });
        continue;

      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn('[enrichment-queue] Provider failed, trying next', {
          provider: provider.id,
          itemId: item.id,
          error: message,
        });
        continue;
      }
    }

    // All providers failed or returned empty
    item.retryCount++;

    if (item.retryCount <= item.maxRetries) {
      // Retry with exponential backoff
      const delay = Math.min(
        this.config.baseRetryDelayMs * Math.pow(2, item.retryCount - 1),
        this.config.maxRetryDelayMs,
      );
      item.status = 'queued';
      item.providerIndex = 0; // reset to first provider

      logger.info('[enrichment-queue] Scheduling retry', {
        id: item.id,
        retryCount: item.retryCount,
        delayMs: delay,
      });

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));

      // Re-queue the item by processing again
      return this.processItem(item);
    }

    // Exhausted all retries
    item.status = 'failed';
    item.error = `All providers failed after ${item.maxRetries} retries`;
    item.completedAt = Date.now();

    logger.error('[enrichment-queue] Item failed', {
      id: item.id,
      entityType: item.entityType,
      entityId: item.entityId,
    });

    return item;
  }
}

/**
 * Singleton enrichment queue instance.
 */
export const enrichmentQueue = new EnrichmentQueue();
