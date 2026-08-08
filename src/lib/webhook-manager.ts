import { db } from '@/lib/db';

// Types
export interface WebhookConfig {
  id: string
  url: string
  events: string[]
  secret: string
  active: boolean
  retryCount: number
  createdAt: string
  lastTriggeredAt: string | null
  successCount: number
  failureCount: number
}

export interface WebhookEvent {
  event: string
  timestamp: string
  payload: Record<string, unknown>
  companyId?: string
  contactId?: string
}

export interface WebhookDeliveryResult {
  success: boolean
  statusCode: number
  response: string
  duration: number
}

const WEBHOOK_DB_KEY = 'webhook_configs';

// In-memory cache backed by SystemSetting table
const webhookConfigs: Map<string, WebhookConfig> = new Map();
let webhooksLoaded = false;

/** Load webhook configs from DB into the in-memory Map (called lazily on first access). */
async function ensureWebhooksLoaded(): Promise<void> {
  if (webhooksLoaded) return;
  try {
    const row = await db.systemSetting.findUnique({
      where: { key: WEBHOOK_DB_KEY },
    });
    if (row) {
      const parsed = JSON.parse(row.value || '[]') as WebhookConfig[];
      for (const cfg of parsed) {
        webhookConfigs.set(cfg.id, cfg);
      }
    }
  } catch {
    // DB unavailable — start with empty in-memory map
  }
  webhooksLoaded = true;
}

/** Persist the current in-memory webhook configs to the DB. */
async function persistWebhooks(): Promise<void> {
  const all = Array.from(webhookConfigs.values());
  await db.systemSetting.upsert({
    where: { key: WEBHOOK_DB_KEY },
    create: { key: WEBHOOK_DB_KEY, value: JSON.stringify(all) },
    update: { value: JSON.stringify(all) },
  });
}

// Supported events
export const WEBHOOK_EVENTS = [
  'company.created',
  'company.updated',
  'company.score_changed',
  'contact.added',
  'contact.updated',
  'opportunity.created',
  'opportunity.updated',
  'opportunity.won',
  'opportunity.lost',
  'signal.detected',
  'recommendation.created',
  'data.import_completed',
  'data.quality_alert',
] as const

export type WebhookEventName = (typeof WEBHOOK_EVENTS)[number]

// HMAC-SHA256 signature generation
import { createHmac } from 'crypto'

function generateSignature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

// Dispatch webhook to all matching configs
export async function dispatchWebhook(
  event: WebhookEventName,
  payload: WebhookEvent['payload'],
  meta?: Partial<Pick<WebhookEvent, 'companyId' | 'contactId'>>,
): Promise<WebhookDeliveryResult[]> {
  await ensureWebhooksLoaded();

  const results: WebhookDeliveryResult[] = []
  const fullEvent: WebhookEvent = {
    event,
    timestamp: new Date().toISOString(),
    payload,
    ...meta,
  }
  const body = JSON.stringify(fullEvent)

  for (const [, config] of webhookConfigs) {
    if (!config.active || !config.events.includes(event)) continue

    const start = Date.now()
    try {
      const signature = generateSignature(body, config.secret)
      const res = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${signature}`,
          'X-Webhook-Event': event,
          'X-Webhook-ID': config.id,
          'X-Delivery-Timestamp': fullEvent.timestamp,
        },
        body,
      })

      config.lastTriggeredAt = fullEvent.timestamp
      if (res.ok) {
        config.successCount++
      } else {
        config.failureCount++
      }

      results.push({
        success: res.ok,
        statusCode: res.status,
        response: await res.text(),
        duration: Date.now() - start,
      })
    } catch (error) {
      config.failureCount++
      results.push({
        success: false,
        statusCode: 0,
        response: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - start,
      })
    }
  }

  // Persist updated counters/timestamps (fire-and-forget)
  persistWebhooks().catch(() => {})

  return results
}

// Dispatch a one-shot webhook to a specific URL (for testing)
export async function dispatchSingleWebhook(
  event: WebhookEventName,
  payload: WebhookEvent['payload'],
  url: string,
  secret: string,
  meta?: Partial<Pick<WebhookEvent, 'companyId' | 'contactId'>>,
): Promise<WebhookDeliveryResult> {
  const fullEvent: WebhookEvent = {
    event,
    timestamp: new Date().toISOString(),
    payload,
    ...meta,
  }
  const body = JSON.stringify(fullEvent)
  const start = Date.now()

  try {
    const signature = generateSignature(body, secret)
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Webhook-Event': event,
        'X-Delivery-Timestamp': fullEvent.timestamp,
      },
      body,
    })
    return {
      success: res.ok,
      statusCode: res.status,
      response: await res.text(),
      duration: Date.now() - start,
    }
  } catch (error) {
    return {
      success: false,
      statusCode: 0,
      response: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - start,
    }
  }
}

// CRUD for webhook configs (async — DB-backed)

export async function getWebhookConfigs(): Promise<WebhookConfig[]> {
  await ensureWebhooksLoaded();
  return Array.from(webhookConfigs.values());
}

export async function registerWebhook(
  config: Omit<
    WebhookConfig,
    'id' | 'createdAt' | 'lastTriggeredAt' | 'successCount' | 'failureCount'
  >,
): Promise<WebhookConfig> {
  await ensureWebhooksLoaded();
  const id = `wh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const webhook: WebhookConfig = {
    ...config,
    id,
    createdAt: new Date().toISOString(),
    lastTriggeredAt: null,
    successCount: 0,
    failureCount: 0,
  };
  webhookConfigs.set(id, webhook);
  await persistWebhooks();
  return webhook;
}

export async function deleteWebhook(id: string): Promise<boolean> {
  await ensureWebhooksLoaded();
  const deleted = webhookConfigs.delete(id);
  if (deleted) await persistWebhooks();
  return deleted;
}

export async function getWebhookDeliveryHistory(webhookId: string) {
  await ensureWebhooksLoaded();
  const config = webhookConfigs.get(webhookId);
  if (!config) return null;
  return {
    webhookId: config.id,
    url: config.url,
    lastTriggeredAt: config.lastTriggeredAt,
    successCount: config.successCount,
    failureCount: config.failureCount,
  };
}
