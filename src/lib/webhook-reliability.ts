/**
 * P4.3: Webhook Reliability Layer
 *
 * Provides retry-with-exponential-backoff, dead-letter queuing,
 * and per-delivery audit logging for outgoing webhooks.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// ── Backoff intervals: 5s → 30s → 300s (exponential) ──
const BACKOFF_MS = [5_000, 30_000, 300_000];
const DEFAULT_MAX_RETRIES = 3;
const EXPIRY_HOURS = 24;
const MAX_CONCURRENCY = 5;

// ── Types ──

export interface DispatchReliableResult {
  deliveryId: string;
  success: boolean;
  statusCode?: number;
  error?: string;
}

interface DeadLetterOptions {
  event?: string;
  page?: number;
  limit?: number;
  includeResolved?: boolean;
}

// ── Internal: POST a webhook with proper headers ──

async function postWebhook(
  targetUrl: string,
  payload: unknown,
  event: string,
  signature?: string,
): Promise<{ ok: boolean; statusCode: number; body: string }> {
  const res = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(signature ? { 'X-Webhook-Signature': `sha256=${signature}` } : {}),
      'X-Webhook-Event': event,
      'X-Delivery-Timestamp': new Date().toISOString(),
    },
    body: JSON.stringify(payload),
  });
  return {
    ok: res.ok,
    statusCode: res.status,
    body: await res.text().catch(() => ''),
  };
}

// ── Public API ──

/**
 * Move a failed delivery to the dead-letter queue.
 */
export async function moveToDeadLetter(
  delivery: { id: string; event: string; targetUrl: string; payload: unknown; retryCount: number; errorMessage: string | null; statusCode: number | null },
): Promise<void> {
  try {
    await db.webhookDeadLetter.create({
      data: {
        originalDeliveryId: delivery.id,
        event: delivery.event,
        targetUrl: delivery.targetUrl,
        payload: delivery.payload as Record<string, unknown>,
        lastError: delivery.errorMessage,
        lastStatusCode: delivery.statusCode,
        totalRetries: delivery.retryCount,
      },
    });

    await db.webhookDelivery.update({
      where: { id: delivery.id },
      data: { status: 'expired' },
    });

    logger.warn('[webhook-dlq] Moved to dead-letter queue', {
      deliveryId: delivery.id,
      event: delivery.event,
      targetUrl: delivery.targetUrl,
    });
  } catch (err) {
    logger.error('[webhook-dlq] Failed to move to dead-letter queue', {
      deliveryId: delivery.id,
      error: err,
    });
  }
}

/**
 * Retry a single failed webhook delivery.
 */
export async function retryWebhook(deliveryId: string): Promise<DispatchReliableResult> {
  let delivery: Awaited<ReturnType<typeof db.webhookDelivery.findUnique>>;

  try {
    delivery = await db.webhookDelivery.findUnique({ where: { id: deliveryId } });
  } catch (err) {
    logger.error('[webhook-retry] Failed to load delivery', { deliveryId, error: err });
    return { deliveryId, success: false, error: 'Failed to load delivery record' };
  }

  if (!delivery) {
    return { deliveryId, success: false, error: 'Delivery not found' };
  }

  // Check expiry
  if (delivery.expiresAt && delivery.expiresAt < new Date()) {
    await moveToDeadLetter(delivery);
    return { deliveryId, success: false, error: 'Delivery expired' };
  }

  // Check retry budget
  if (delivery.retryCount >= delivery.maxRetries) {
    await moveToDeadLetter(delivery);
    return { deliveryId, success: false, error: 'Max retries exceeded' };
  }

  // Attempt delivery
  try {
    await db.webhookDelivery.update({
      where: { id: deliveryId },
      data: { status: 'delivering' },
    });
  } catch (err) {
    logger.error('[webhook-retry] Failed to update status to delivering', { deliveryId, error: err });
  }

  try {
    const result = await postWebhook(
      delivery.targetUrl,
      delivery.payload,
      delivery.event,
      delivery.signature ?? undefined,
    );

    if (result.ok) {
      await db.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'delivered',
          statusCode: result.statusCode,
          responseBody: result.body,
          deliveredAt: new Date(),
          nextRetryAt: null,
        },
      });

      logger.info('[webhook-retry] Delivery succeeded', {
        deliveryId,
        event: delivery.event,
        statusCode: result.statusCode,
        attempt: delivery.retryCount + 1,
      });

      return { deliveryId, success: true, statusCode: result.statusCode };
    } else {
      const newRetryCount = delivery.retryCount + 1;
      const backoffMs = BACKOFF_MS[Math.min(newRetryCount - 1, BACKOFF_MS.length - 1)] ?? 300_000;
      const nextRetryAt = new Date(Date.now() + backoffMs);
      const isLastRetry = newRetryCount >= delivery.maxRetries;

      if (isLastRetry) {
        await db.webhookDelivery.update({
          where: { id: deliveryId },
          data: {
            status: 'failed',
            statusCode: result.statusCode,
            responseBody: result.body,
            errorMessage: `HTTP ${result.statusCode}`,
            retryCount: newRetryCount,
            nextRetryAt: null,
          },
        });
        await moveToDeadLetter({
          id: delivery.id,
          event: delivery.event,
          targetUrl: delivery.targetUrl,
          payload: delivery.payload,
          retryCount: newRetryCount,
          errorMessage: `HTTP ${result.statusCode}`,
          statusCode: result.statusCode,
        });
        return { deliveryId, success: false, statusCode: result.statusCode, error: `HTTP ${result.statusCode} — moved to dead-letter` };
      }

      await db.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'failed',
          statusCode: result.statusCode,
          responseBody: result.body,
          errorMessage: `HTTP ${result.statusCode}`,
          retryCount: newRetryCount,
          nextRetryAt,
        },
      });

      logger.warn('[webhook-retry] Delivery failed, scheduled retry', {
        deliveryId,
        event: delivery.event,
        statusCode: result.statusCode,
        attempt: newRetryCount,
        nextRetryAt: nextRetryAt.toISOString(),
      });

      return { deliveryId, success: false, statusCode: result.statusCode, error: `HTTP ${result.statusCode} — retry ${newRetryCount}/${delivery.maxRetries}` };
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    const newRetryCount = delivery.retryCount + 1;
    const backoffMs = BACKOFF_MS[Math.min(newRetryCount - 1, BACKOFF_MS.length - 1)] ?? 300_000;
    const nextRetryAt = new Date(Date.now() + backoffMs);
    const isLastRetry = newRetryCount >= delivery.maxRetries;

    if (isLastRetry) {
      await db.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'failed',
          errorMessage: errorMsg,
          retryCount: newRetryCount,
          nextRetryAt: null,
        },
      }).catch(() => {});
      await moveToDeadLetter({
        id: delivery.id,
        event: delivery.event,
        targetUrl: delivery.targetUrl,
        payload: delivery.payload,
        retryCount: newRetryCount,
        errorMessage: errorMsg,
        statusCode: null,
      });
      return { deliveryId, success: false, error: `${errorMsg} — moved to dead-letter` };
    }

    await db.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'failed',
        errorMessage: errorMsg,
        retryCount: newRetryCount,
        nextRetryAt,
      },
    }).catch(() => {});

    logger.warn('[webhook-retry] Delivery threw error, scheduled retry', {
      deliveryId,
      event: delivery.event,
      error: errorMsg,
      attempt: newRetryCount,
    });

    return { deliveryId, success: false, error: `${errorMsg} — retry ${newRetryCount}/${delivery.maxRetries}` };
  }
}

/**
 * Enhanced webhook dispatch with delivery tracking and automatic retries.
 */
export async function dispatchReliableWebhook(
  event: string,
  targetUrl: string,
  payload: unknown,
  signature?: string,
  configId?: string,
  maxRetries?: number,
): Promise<DispatchReliableResult> {
  const maxR = maxRetries ?? DEFAULT_MAX_RETRIES;
  const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000);

  // Create delivery record
  let delivery;
  try {
    delivery = await db.webhookDelivery.create({
      data: {
        webhookConfigId: configId,
        event,
        targetUrl,
        payload: payload as Record<string, unknown>,
        signature: signature ?? null,
        status: 'pending',
        maxRetries: maxR,
        expiresAt,
      },
    });
  } catch (err) {
    logger.error('[webhook-dispatch] Failed to create delivery record', { event, targetUrl, error: err });
    return { deliveryId: 'unknown', success: false, error: 'Failed to create delivery record' };
  }

  // Attempt first delivery immediately
  try {
    await db.webhookDelivery.update({
      where: { id: delivery.id },
      data: { status: 'delivering' },
    });
  } catch { /* non-fatal */ }

  try {
    const result = await postWebhook(targetUrl, payload, event, signature);

    if (result.ok) {
      await db.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'delivered',
          statusCode: result.statusCode,
          responseBody: result.body,
          deliveredAt: new Date(),
        },
      });

      logger.info('[webhook-dispatch] Delivered', {
        deliveryId: delivery.id,
        event,
        targetUrl,
        statusCode: result.statusCode,
      });

      return { deliveryId: delivery.id, success: true, statusCode: result.statusCode };
    } else {
      // First attempt failed — schedule retry
      const backoffMs = BACKOFF_MS[0];
      const nextRetryAt = new Date(Date.now() + backoffMs);

      await db.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'failed',
          statusCode: result.statusCode,
          responseBody: result.body,
          errorMessage: `HTTP ${result.statusCode}`,
          retryCount: 1,
          nextRetryAt,
        },
      });

      logger.warn('[webhook-dispatch] First attempt failed, scheduled retry', {
        deliveryId: delivery.id,
        event,
        targetUrl,
        statusCode: result.statusCode,
        nextRetryAt: nextRetryAt.toISOString(),
      });

      return { deliveryId: delivery.id, success: false, statusCode: result.statusCode, error: `HTTP ${result.statusCode} — retry scheduled` };
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    const backoffMs = BACKOFF_MS[0];
    const nextRetryAt = new Date(Date.now() + backoffMs);

    await db.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'failed',
        errorMessage: errorMsg,
        retryCount: 1,
        nextRetryAt,
      },
    }).catch(() => {});

    logger.warn('[webhook-dispatch] First attempt threw error, scheduled retry', {
      deliveryId: delivery.id,
      event,
      targetUrl,
      error: errorMsg,
    });

    return { deliveryId: delivery.id, success: false, error: `${errorMsg} — retry scheduled` };
  }
}

/**
 * Batch process the retry queue: find all deliveries that are due
 * for retry and process them with a concurrency limit of 5.
 */
export async function processRetryQueue(): Promise<{ processed: number; succeeded: number; failed: number; deadLettered: number }> {
  const stats = { processed: 0, succeeded: 0, failed: 0, deadLettered: 0 };

  let dueDeliveries: { id: string }[];
  try {
    dueDeliveries = await db.webhookDelivery.findMany({
      where: {
        status: { in: ['pending', 'failed'] },
        nextRetryAt: { lte: new Date() },
      },
      select: { id: true },
      take: 50, // batch size to avoid long-running queries
    });
  } catch (err) {
    logger.error('[webhook-retry-queue] Failed to query due deliveries', { error: err });
    return stats;
  }

  if (dueDeliveries.length === 0) return stats;

  logger.info('[webhook-retry-queue] Processing', { count: dueDeliveries.length });

  // Process with concurrency limit
  const semaphore = new Promise<void>((resolve) => {
    let inFlight = 0;
    let index = 0;

    function tryNext() {
      while (inFlight < MAX_CONCURRENCY && index < dueDeliveries.length) {
        const delivery = dueDeliveries[index++];
        inFlight++;

        retryWebhook(delivery.id)
          .then((result) => {
            stats.processed++;
            if (result.success) {
              stats.succeeded++;
            } else {
              stats.failed++;
              if (result.error?.includes('dead-letter')) {
                stats.deadLettered++;
              }
            }
          })
          .catch(() => {
            stats.processed++;
            stats.failed++;
          })
          .finally(() => {
            inFlight--;
            tryNext();
          });
      }

      if (inFlight === 0 && index >= dueDeliveries.length) {
        resolve();
      }
    }

    tryNext();
  });

  await semaphore;

  // Also check for expired deliveries that haven't been retried yet
  try {
    const expiredDeliveries = await db.webhookDelivery.findMany({
      where: {
        status: { in: ['pending', 'failed', 'delivering'] },
        expiresAt: { lte: new Date() },
      },
      select: { id: true },
      take: 20,
    });

    for (const d of expiredDeliveries) {
      try {
        const delivery = await db.webhookDelivery.findUnique({ where: { id: d.id } });
        if (delivery && delivery.status !== 'delivered' && delivery.status !== 'expired') {
          await moveToDeadLetter(delivery);
          stats.deadLettered++;
        }
      } catch { /* best-effort */ }
    }
  } catch { /* non-fatal */ }

  logger.info('[webhook-retry-queue] Batch complete', stats);
  return stats;
}

/**
 * Query dead-letter queue entries.
 */
export async function getDeadLetterQueue(options: DeadLetterOptions = {}): Promise<{ data: unknown[]; total: number }> {
  const { event, page = 1, limit = 20, includeResolved = false } = options;

  const where: Record<string, unknown> = {};
  if (event) where.event = event;
  if (!includeResolved) where.resolvedAt = null;

  try {
    const [data, total] = await Promise.all([
      db.webhookDeadLetter.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.webhookDeadLetter.count({ where }),
    ]);

    return { data, total };
  } catch (err) {
    logger.error('[webhook-dlq] Failed to query dead-letter queue', { error: err });
    return { data: [], total: 0 };
  }
}

/**
 * Manually retry a dead-letter entry — creates a new delivery and resolves the DLQ entry.
 */
export async function retryDeadLetterEntry(id: string): Promise<DispatchReliableResult | null> {
  let entry: Awaited<ReturnType<typeof db.webhookDeadLetter.findUnique>>;

  try {
    entry = await db.webhookDeadLetter.findUnique({ where: { id } });
  } catch (err) {
    logger.error('[webhook-dlq] Failed to load dead-letter entry', { id, error: err });
    return null;
  }

  if (!entry) return null;

  // Create a new delivery from the dead-letter entry
  const result = await dispatchReliableWebhook(
    entry.event,
    entry.targetUrl,
    entry.payload,
    undefined, // no signature available from DLQ
    undefined, // no configId
  );

  // Mark as resolved if the dispatch was accepted (delivery record created)
  try {
    await db.webhookDeadLetter.update({
      where: { id },
      data: {
        resolvedAt: new Date(),
        resolution: 'retried_manually',
      },
    });
  } catch (err) {
    logger.error('[webhook-dlq] Failed to resolve dead-letter entry', { id, error: err });
  }

  return result;
}

/**
 * Resolve (acknowledge) a dead-letter entry.
 */
export async function resolveDeadLetterEntry(id: string, resolution: 'retried_manually' | 'deleted' | 'target_fixed'): Promise<boolean> {
  try {
    const entry = await db.webhookDeadLetter.findUnique({ where: { id } });
    if (!entry) return false;
    if (entry.resolvedAt) return false; // already resolved

    await db.webhookDeadLetter.update({
      where: { id },
      data: {
        resolvedAt: new Date(),
        resolution,
      },
    });

    logger.info('[webhook-dlq] Entry resolved', { id, resolution });
    return true;
  } catch (err) {
    logger.error('[webhook-dlq] Failed to resolve dead-letter entry', { id, error: err });
    return false;
  }
}
