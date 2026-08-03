/**
 * WI-18.2 Persistence Failure Queue
 * =================================
 *
 * Lock L2: Fire-and-forget DB writes are acceptable ONLY with:
 *   - retry mechanism (exponential backoff: 1s, 5s, 30s)
 *   - failure queue/logging (PersistenceOperationLog table)
 *   - persistence health monitoring (alerting thresholds)
 *   - dead-letter state for exhausted retries
 *
 * CRITICAL: No persistence failure can disappear silently.
 * Every failure MUST produce exactly one of:
 *   1. A 'completed' record (retried successfully)
 *   2. A 'dead_letter' record (all retries exhausted)
 *   3. An error log if queue enqueue itself fails (last resort)
 *
 * FAILURE PIPELINE:
 *   DB write failure
 *     ↓
 *   Retry queue entry created (PersistenceOperationLog)
 *     ↓
 *   Health monitor updated (consecutiveFailures++)
 *     ↓
 *   Alert generated (WARNING at 3, CRITICAL at 10)
 *     ↓
 *   Retry attempted with exponential backoff
 *     ↓
 *   Permanent failure recorded as dead_letter if retries exhausted
 *
 * Queue processing runs on a timer (every 30 seconds).
 * Retries reconstruct the original PersistenceOperation and replay through the adapter.
 */

import { logger } from '@/lib/logger';
import type { PersistenceOperation } from './types';
import { PERSISTENCE_FEATURE_FLAGS } from './types';
import { registerTimer } from '@/lib/timer-registry';

// Lazy-loaded Prisma
let _prisma: ReturnType<typeof import('@prisma/client')['Prisma']> | null = null;
/** Test-only Prisma factory override — shared with adapter's factory. */
let _prismaFactory: (() => any) | null = null;

function getPrisma() {
  if (!_prisma) {
    if (_prismaFactory) {
      _prisma = _prismaFactory();
    } else {
      const { Prisma } = require('@prisma/client');
      _prisma = new Prisma();
    }
  }
  return _prisma;
}

/** Test-only: set a Prisma factory to bypass require(). DO NOT call in production. */
export function _setPrismaFactoryForTesting(queueFactory: () => any): void {
  _prisma = null;
  _prismaFactory = queueFactory;
}

/** Retry backoff delays in ms: 1s, 5s, 30s. */
const RETRY_DELAYS_MS = [1000, 5000, 30000];
/** Maximum number of retry attempts before dead-letter. */
const MAX_RETRIES = 3;

/** Stats tracked for operational visibility. */
interface FailureQueueStats {
  totalEnqueued: number;
  totalRetried: number;
  totalRecovered: number;
  totalDeadLettered: number;
  lastProcessAt: number | null;
}

class PersistenceFailureQueue {
  private processing = false;
  private started = false;
  private stats: FailureQueueStats = {
    totalEnqueued: 0,
    totalRetried: 0,
    totalRecovered: 0,
    totalDeadLettered: 0,
    lastProcessAt: null,
  };

  /**
   * Enqueue a failed operation for retry.
   *
   * CRITICAL: If this enqueue itself fails (e.g., DB connection down),
   * the error is logged at ERROR level — this is the last-resort visibility
   * guarantee. The failure will also be visible in health monitor metrics.
   */
  async enqueue<T>(operation: PersistenceOperation<T>, errorMessage: string): Promise<void> {
    if (!PERSISTENCE_FEATURE_FLAGS.USE_DB_PERSISTENCE) return;

    try {
      const prisma = getPrisma();
      const payloadStr = JSON.stringify(operation.data);
      const summary = payloadStr.length > 500 ? payloadStr.slice(0, 500) + '...[truncated]' : payloadStr;

      await prisma.persistenceOperationLog.create({
        data: {
          store: operation.store,
          operation: operation.operation,
          mapKey: operation.key,
          companyId: operation.companyId,
          payloadSummary: summary,
          status: 'failed',
          errorMessage,
          retryCount: 0,
          maxRetries: MAX_RETRIES,
          nextRetryAt: new Date(Date.now() + RETRY_DELAYS_MS[0]),
        },
      });

      this.stats.totalEnqueued++;

      logger.info(
        `[persistence-failure-queue] Enqueued ${operation.store}/${operation.key} for retry ` +
        `(attempt 0/${MAX_RETRIES}, next in ${RETRY_DELAYS_MS[0]}ms)`
      );
    } catch (error) {
      // LAST-RESORT VISIBILITY: If we can't even enqueue, we MUST log.
      // This ensures no failure disappears silently.
      logger.error(
        `[persistence-failure-queue] CRITICAL: Failed to enqueue failed operation ` +
        `${operation.store}/${operation.key}. Error: ${error}. ` +
        `Original failure: ${errorMessage}. ` +
        `This operation may be lost — manual intervention may be required.`
      );
    }
  }

  /**
   * Process the retry queue — called periodically.
   *
   * For each failed operation due for retry:
   *   1. Reconstruct the original operation from the log record
   *   2. Replay through the adapter's executeWrite
   *   3. On success: mark 'completed'
   *   4. On failure: schedule next retry or move to dead_letter
   */
  async processRetryQueue(): Promise<number> {
    if (this.processing || !PERSISTENCE_FEATURE_FLAGS.USE_DB_PERSISTENCE) return 0;
    this.processing = true;

    let recovered = 0;
    let deadLettered = 0;

    try {
      const prisma = getPrisma();

      // Fetch operations due for retry
      const pending = await prisma.persistenceOperationLog.findMany({
        where: {
          status: 'failed',
          nextRetryAt: { lte: new Date() },
          retryCount: { lt: MAX_RETRIES },
        },
        orderBy: { createdAt: 'asc' },
        take: 50, // Batch size
      });

      this.stats.totalRetried += pending.length;

      for (const op of pending) {
        try {
          // Reconstruct and replay the original operation.
          // NOTE: payloadSummary may be truncated (500 chars). If JSON.parse fails,
          // log the corruption and move to dead_letter — the original payload is lost.
          let parsedData: Record<string, unknown>;
          try {
            parsedData = JSON.parse(op.payloadSummary);
          } catch (parseError) {
            logger.error(
              `[persistence-failure-queue] FATAL: Cannot reconstruct payload for ${op.id} ` +
              `(${op.store}/${op.mapKey}). payloadSummary is corrupted or truncated ` +
              `(retryCount=${op.retryCount}). Moving to dead_letter. ` +
              `Error: ${parseError}`
            );
            // Move directly to dead_letter — unrecoverable
            await prisma.persistenceOperationLog.update({
              where: { id: op.id },
              data: {
                status: 'dead_letter',
                retryCount: op.maxRetries,
                resolvedAt: new Date(),
                errorMessage: `Payload reconstruction failed: ${parseError}`,
              },
            });
            deadLettered++;
            this.stats.totalDeadLettered++;
            continue;
          }

          const reconstructedOp: PersistenceOperation = {
            store: op.store as any,
            operation: op.operation as any,
            key: op.mapKey,
            data: parsedData,
            companyId: op.companyId,
            timestamp: op.createdAt.getTime(),
          };

          // Replay through adapter's executeWrite
          // We import the adapter lazily to avoid circular deps
          const { getPersistenceAdapter } = require('./intelligence-persistence-adapter');
          const adapter = getPersistenceAdapter();
          const result = await adapter.write(reconstructedOp);

          if (result.success) {
            await prisma.persistenceOperationLog.update({
              where: { id: op.id },
              data: {
                status: 'completed',
                retryCount: { increment: 1 },
                resolvedAt: new Date(),
              },
            });
            recovered++;
            this.stats.totalRecovered++;
            logger.info(`[persistence-failure-queue] Recovered ${op.store}/${op.mapKey} on retry ${op.retryCount + 1}`);
          } else {
            throw new Error(result.failureReason || 'Retry write failed');
          }
        } catch (retryError) {
          const nextRetry = op.retryCount + 1;
          const delay = RETRY_DELAYS_MS[Math.min(nextRetry, RETRY_DELAYS_MS.length - 1)];

          if (nextRetry >= op.maxRetries) {
            // Move to dead letter — this is permanent failure
            await prisma.persistenceOperationLog.update({
              where: { id: op.id },
              data: {
                status: 'dead_letter',
                retryCount: nextRetry,
                resolvedAt: new Date(),
              },
            });
            deadLettered++;
            this.stats.totalDeadLettered++;
            logger.error(
              `[persistence-failure-queue] DEAD LETTER: Operation ${op.id} (${op.store}/${op.mapKey}) ` +
              `exhausted ${nextRetry} retries. Last error: ${retryError}. ` +
              `Manual intervention required.`
            );
          } else {
            // Schedule next retry with exponential backoff
            await prisma.persistenceOperationLog.update({
              where: { id: op.id },
              data: {
                retryCount: nextRetry,
                nextRetryAt: new Date(Date.now() + delay),
              },
            });
            logger.warn(
              `[persistence-failure-queue] Retry ${nextRetry}/${op.maxRetries} failed for ` +
              `${op.store}/${op.mapKey}, next attempt in ${delay}ms. Error: ${retryError}`
            );
          }
        }
      }

      this.stats.lastProcessAt = Date.now();

      if (recovered > 0 || deadLettered > 0) {
        logger.info(
          `[persistence-failure-queue] Batch complete: ${recovered} recovered, ${deadLettered} dead-lettered, ` +
          `${pending.length - recovered - deadLettered} rescheduled`
        );
      }
    } catch (error) {
      logger.error(`[persistence-failure-queue] Retry processor fatal error: ${error}`);
    } finally {
      this.processing = false;
    }

    return recovered;
  }

  /**
   * Get the full queue stats for operational visibility.
   * This is the data source for the Persistence Health Report.
   */
  getStats(): FailureQueueStats {
    return { ...this.stats };
  }

  /** Get current queue depth (operations awaiting retry). */
  async getQueueDepth(): Promise<number> {
    if (!PERSISTENCE_FEATURE_FLAGS.USE_DB_PERSISTENCE) return 0;

    try {
      const prisma = getPrisma();
      return await prisma.persistenceOperationLog.count({
        where: { status: 'failed' },
      });
    } catch {
      return -1; // Error retrieving depth
    }
  }

  /** Get dead letter count (permanently failed operations). */
  async getDeadLetterCount(): Promise<number> {
    if (!PERSISTENCE_FEATURE_FLAGS.USE_DB_PERSISTENCE) return 0;

    try {
      const prisma = getPrisma();
      return await prisma.persistenceOperationLog.count({
        where: { status: 'dead_letter' },
      });
    } catch {
      return -1;
    }
  }

  /**
   * Generate a comprehensive failure pipeline report.
   * Used for the Phase 2 completion artifact: Persistence Health Report.
   */
  async generateReport(): Promise<{
    queueDepth: number;
    deadLetterCount: number;
    stats: FailureQueueStats;
    recentFailures: Array<{ id: string; store: string; mapKey: string; retryCount: number; errorMessage: string; createdAt: Date }>;
  }> {
    const [queueDepth, deadLetterCount] = await Promise.all([
      this.getQueueDepth(),
      this.getDeadLetterCount(),
    ]);

    // Fetch recent failures for visibility
    let recentFailures: Array<{ id: string; store: string; mapKey: string; retryCount: number; errorMessage: string; createdAt: Date }> = [];
    try {
      const prisma = getPrisma();
      const recent = await prisma.persistenceOperationLog.findMany({
        where: { status: { in: ['failed', 'dead_letter'] } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, store: true, mapKey: true, retryCount: true, errorMessage: true, createdAt: true },
      });
      recentFailures = recent;
    } catch {
      // Non-critical
    }

    return {
      queueDepth,
      deadLetterCount,
      stats: this.stats,
      recentFailures,
    };
  }

  /** Start the periodic retry processor. */
  start(): void {
    if (this.started) return;
    this.started = true;

    if (typeof setInterval !== 'undefined') {
      registerTimer(setInterval(async () => {
        try {
          const recovered = await this.processRetryQueue();
          if (recovered > 0) {
            logger.info(`[persistence-failure-queue] Retried ${recovered} operations successfully`);
          }
        } catch (error) {
          logger.error(`[persistence-failure-queue] Retry processor error: ${error}`);
        }
      }, 30_000)); // Every 30 seconds
    }

    logger.info('[persistence-failure-queue] Started — retry interval: 30s, max retries: 3, backoff: 1s/5s/30s');
  }
}

// ── Singleton ──────────────────────────────────────────────────────────

let _queue: PersistenceFailureQueue | null = null;

export function getPersistenceFailureQueue(): PersistenceFailureQueue {
  if (!_queue) {
    _queue = new PersistenceFailureQueue();
    _queue.start();
  }
  return _queue;
}
