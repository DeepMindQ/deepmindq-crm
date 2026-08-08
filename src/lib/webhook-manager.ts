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

// In-memory store (would be Prisma in production)
const webhookConfigs: Map<string, WebhookConfig> = new Map()

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

// CRUD for webhook configs
export function getWebhookConfigs(): WebhookConfig[] {
  return Array.from(webhookConfigs.values())
}

export function registerWebhook(
  config: Omit<
    WebhookConfig,
    'id' | 'createdAt' | 'lastTriggeredAt' | 'successCount' | 'failureCount'
  >,
): WebhookConfig {
  const id = `wh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const webhook: WebhookConfig = {
    ...config,
    id,
    createdAt: new Date().toISOString(),
    lastTriggeredAt: null,
    successCount: 0,
    failureCount: 0,
  }
  webhookConfigs.set(id, webhook)
  return webhook
}

export function deleteWebhook(id: string): boolean {
  return webhookConfigs.delete(id)
}

export function getWebhookDeliveryHistory(webhookId: string) {
  const config = webhookConfigs.get(webhookId)
  if (!config) return null
  return {
    webhookId: config.id,
    url: config.url,
    lastTriggeredAt: config.lastTriggeredAt,
    successCount: config.successCount,
    failureCount: config.failureCount,
  }
}
