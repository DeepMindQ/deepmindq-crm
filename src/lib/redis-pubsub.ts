/**
 * Redis Pub/Sub for SSE events.
 *
 * Enables cross-instance SSE event distribution.
 * When Redis is available, events are published to a Redis channel.
 * All SSE connections subscribe to the channel and relay events.
 * Falls back to in-memory eventBus when Redis is unavailable.
 *
 * ARCHITECTURE:
 *   Producer (API route) → publishSSEEvent() → Redis PUBLISH
 *   Consumer (SSE route) → subscribeToSSEChannel() → Redis SUBSCRIBE
 *
 * For Upstash (HTTP): Uses a polling approach since HTTP-based Redis
 * cannot maintain persistent subscriptions. Polls a Redis list as a queue.
 *
 * For ioredis (TCP): Uses native Redis SUBSCRIBE/PUBLISH.
 *
 * ENVIRONMENT:
 *   SSE_PUBSUB_CHANNEL — Redis channel name (default: 'dmq:sse:events')
 *   SSE_PUBSUB_POLL_MS  — Poll interval for Upstash mode (default: 1000)
 */

import { logger } from '@/lib/logger';
import { eventBus } from '@/lib/event-bus';
import { getRedisClient, getClientType } from '@/lib/redis-client';

// ─── Configuration ────────────────────────────────────────────────────────

const CHANNEL = process.env.SSE_PUBSUB_CHANNEL || 'dmq:sse:events';
const POLL_INTERVAL_MS = parseInt(process.env.SSE_PUBSUB_POLL_MS || '1000', 10);
const QUEUE_KEY = `${CHANNEL}:queue`;
const MAX_QUEUE_LENGTH = 1000;

// ─── State ───────────────────────────────────────────────────────────────

let _pubsubActive = false;
let _subscriberReady = false;
let _pollTimer: ReturnType<typeof setInterval> | null = null;
let _lastPolledId = 0;

/** Callbacks registered by SSE connections */
const _subscribers = new Set<(eventType: string, data: unknown) => void>();

// ─── Upstash Polling (HTTP-based pub/sub) ─────────────────────────────────

/**
 * For Upstash, we use a Redis LIST as a message queue.
 * Producers LPUSH, consumers BRPOP (or poll with RPOP in our case).
 * Each message includes an auto-incrementing ID for ordering.
 */
async function startUpstashPolling(): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;

  // Get current queue length to start from the end
  try {
    const len = await client.eval(`return redis.call('LLEN', KEYS[1])`, 1, QUEUE_KEY);
    _lastPolledId = Number(len) || 0;
  } catch {
    _lastPolledId = 0;
  }

  _pollTimer = setInterval(async () => {
    try {
      // Pop messages from the right side of the list
      const result = await client.eval(
        `local msgs = {}; for i=1,10 do local m = redis.call('RPOP', KEYS[1]); if not m then break end; msgs[i] = m end; return cjson.encode(msgs)`,
        1,
        QUEUE_KEY,
      );

      if (result && typeof result === 'string') {
        const messages: string[] = JSON.parse(result);
        for (const msg of messages) {
          try {
            const parsed = JSON.parse(msg);
            _lastPolledId++;
            relayToSubscribers(parsed.type, parsed.data);
          } catch {
            // Skip malformed messages
          }
        }
      }
    } catch {
      // Polling error — non-fatal
    }
  }, POLL_INTERVAL_MS);

  if (_pollTimer && typeof _pollTimer.unref === 'function') {
    _pollTimer.unref();
  }

  logger.info(`[redis-pubsub] Upstash polling started (interval=${POLL_INTERVAL_MS}ms)`);
}

// ─── ioredis Native Pub/Sub ──────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _ioSubscriber: any = null;

async function startIoRedisSubscription(): Promise<void> {
  // ioredis requires a SEPARATE connection for subscribing
  // (a client in subscriber mode cannot issue other commands)
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return;

  try {
    const { default: Redis } = await import('ioredis');
    _ioSubscriber = new Redis(redisUrl, {
      maxRetriesPerRequest: null, // Required for subscriber mode
      connectTimeout: 2000,
      lazyConnect: true,
    });

    _ioSubscriber.on('message', (ch: string, message: string) => {
      if (ch !== CHANNEL) return;
      try {
        const parsed = JSON.parse(message);
        relayToSubscribers(parsed.type, parsed.data);
      } catch {
        // Skip malformed
      }
    });

    _ioSubscriber.on('error', (err: Error) => {
      logger.warn(`[redis-pubsub] Subscriber error: ${err.message}`);
    });

    await _ioSubscriber.connect();
    await _ioSubscriber.subscribe(CHANNEL);
    _subscriberReady = true;
    logger.info(`[redis-pubsub] ioredis subscription active on channel "${CHANNEL}"`);
  } catch (err) {
    logger.warn('[redis-pubsub] Failed to start ioredis subscription', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ─── Internal Relay ───────────────────────────────────────────────────────

/**
 * Relay a received event to all local subscribers AND the in-memory eventBus.
 */
function relayToSubscribers(eventType: string, data: unknown): void {
  // Relay to in-memory eventBus (so existing listeners still work)
  eventBus.emit(eventType, data);

  // Relay to pub/sub subscribers
  for (const cb of _subscribers) {
    try {
      cb(eventType, data);
    } catch (err) {
      logger.error(`[redis-pubsub] Subscriber callback error for "${eventType}"`, { error: err });
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Publish an SSE event to the Redis channel (if available).
 * Also emits to the local in-memory eventBus as a fallback.
 *
 * @param eventType - Event type string (e.g., 'notification', 'company_update')
 * @param data - Serializable event payload
 */
export async function publishSSEEvent(eventType: string, data: unknown): Promise<void> {
  // Always emit locally first (immediate delivery for same-instance connections)
  eventBus.emit(eventType, data);

  // Try to publish to Redis for cross-instance delivery
  try {
    const client = await getRedisClient();
    if (!client) return;

    const message = JSON.stringify({ type: eventType, data });

    if (getClientType() === 'upstash') {
      // Upstash: push to a list-based queue
      await client.eval(
        `redis.call('LPUSH', KEYS[1], ARGV[1]); redis.call('LTRIM', KEYS[1], 0, ARGV[2]); return 1`,
        1,
        QUEUE_KEY,
        message,
        MAX_QUEUE_LENGTH,
      );
    } else {
      // ioredis: native PUBLISH
      await client.publish(CHANNEL, message);
    }
  } catch (err) {
    // Non-fatal — local eventBus already delivered
    logger.debug('[redis-pubsub] Failed to publish to Redis (local delivery succeeded)', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Subscribe to the SSE Redis channel.
 * Returns an unsubscribe function.
 * Falls back gracefully when Redis is unavailable.
 *
 * @param callback - Called with (eventType, data) for each event
 * @returns Unsubscribe function
 */
export function subscribeToSSEChannel(
  callback: (eventType: string, data: unknown) => void,
): () => void {
  _subscribers.add(callback);

  return () => {
    _subscribers.delete(callback);
  };
}

/**
 * Check if Redis pub/sub is active.
 */
export function isPubSubActive(): boolean {
  return _pubsubActive;
}

/**
 * Initialize the Redis pub/sub system.
 * Call once at server startup (from instrumentation.ts).
 * Idempotent — safe to call multiple times.
 */
export async function initPubSub(): Promise<void> {
  if (_pubsubActive) return;

  try {
    const client = await getRedisClient();
    if (!client) {
      logger.info('[redis-pubsub] Redis unavailable — using in-memory eventBus only');
      return;
    }

    const clientType = getClientType();

    if (clientType === 'upstash') {
      await startUpstashPolling();
      _pubsubActive = true;
    } else if (clientType === 'ioredis') {
      await startIoRedisSubscription();
      _pubsubActive = true;
    }

    if (_pubsubActive) {
      logger.info(`[redis-pubsub] Active (backend: ${clientType})`);
    }
  } catch (err) {
    logger.warn('[redis-pubsub] Initialization failed — using in-memory eventBus only', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Shut down the pub/sub system (for graceful shutdown).
 */
export async function shutdownPubSub(): Promise<void> {
  if (_pollTimer) {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }

  if (_ioSubscriber) {
    try {
      await _ioSubscriber.unsubscribe();
      await _ioSubscriber.quit();
    } catch {
      // Best-effort cleanup
    }
    _ioSubscriber = null;
  }

  _pubsubActive = false;
  _subscriberReady = false;
  _subscribers.clear();
  logger.info('[redis-pubsub] Shutdown complete');
}
