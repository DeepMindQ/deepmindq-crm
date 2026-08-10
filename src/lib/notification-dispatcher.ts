/**
 * Notification Dispatcher — P2.1
 *
 * Centralised dispatcher that routes alert events to real notification
 * channels (log, Slack, email via Resend, PagerDuty).  Each channel is
 * independently try/caught so a failure in one never blocks the others.
 */

import { quickSlack } from '@/lib/slack-integration'
import { sendEmail } from '@/lib/email-provider'
import { logger } from '@/lib/logger'

// ── Types ──

export interface NotificationEvent {
  alertId: string
  ruleName: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  metric: string
  value: number
  threshold: number
  timestamp: string
}

// ── Channel Handlers ──

async function sendToLog(event: NotificationEvent): Promise<void> {
  logger.info(
    `[ALERT] [${event.severity.toUpperCase()}] ${event.message}`,
    {
      alertId: event.alertId,
      ruleName: event.ruleName,
      metric: event.metric,
      value: event.value,
      threshold: event.threshold,
      timestamp: event.timestamp,
    },
  )
}

async function sendToSlack(event: NotificationEvent): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) {
    logger.warn('[notification-dispatcher] SLACK_WEBHOOK_URL not set — skipping Slack notification')
    return
  }

  const result = await quickSlack(webhookUrl, {
    title: `[${event.severity.toUpperCase()}] ${event.ruleName}`,
    message: event.message,
    level: event.severity,
    timestamp: event.timestamp,
    fields: [
      { title: 'Metric', value: event.metric, short: true },
      { title: 'Value', value: String(event.value), short: true },
      { title: 'Threshold', value: String(event.threshold), short: true },
      { title: 'Alert ID', value: event.alertId, short: false },
    ],
  })

  if (!result.success) {
    logger.error(`[notification-dispatcher] Slack send failed: ${result.error} (status ${result.status ?? 'N/A'})`)
  }
}

async function sendToEmail(event: NotificationEvent): Promise<void> {
  const to = process.env.ONCALL_EMAIL

  if (!to) {
    logger.warn('[notification-dispatcher] ONCALL_EMAIL not set — skipping email notification')
    return
  }

  const severityLabel = event.severity.toUpperCase()

  const result = await sendEmail({
    to,
    subject: `[${severityLabel}] ${event.ruleName} — DeepMindQ Alert`,
    html: `
      <h2>[${severityLabel}] ${event.ruleName}</h2>
      <p><strong>Message:</strong> ${event.message}</p>
      <table style="border-collapse:collapse;margin-top:12px">
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Metric</td><td>${event.metric}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Value</td><td>${event.value}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Threshold</td><td>${event.threshold}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Timestamp</td><td>${event.timestamp}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Alert ID</td><td>${event.alertId}</td></tr>
      </table>
    `,
  })

  if (!result.success) {
    logger.error(`[notification-dispatcher] Email send failed (${result.provider}): ${result.error}`)
  }
}

async function sendToPagerDuty(event: NotificationEvent): Promise<void> {
  const routingKey = process.env.PAGERDUTY_KEY
  if (!routingKey) {
    logger.warn('[notification-dispatcher] PAGERDUTY_KEY not set — skipping PagerDuty notification')
    return
  }

  const severityMap: Record<NotificationEvent['severity'], 'info' | 'warning' | 'critical'> = {
    info: 'info',
    warning: 'warning',
    critical: 'critical',
  }

  const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      routing_key: routingKey,
      event_action: 'trigger',
      dedup_key: event.alertId,
      payload: {
        summary: `${event.ruleName}: ${event.message}`,
        severity: severityMap[event.severity],
        source: 'deepmindq',
        component: event.metric,
        custom_details: {
          alertId: event.alertId,
          ruleName: event.ruleName,
          metric: event.metric,
          value: event.value,
          threshold: event.threshold,
          timestamp: event.timestamp,
        },
      },
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    logger.error(`[notification-dispatcher] PagerDuty send failed (${response.status}): ${text}`)
  }
}

// ── Channel Registry ──

const CHANNEL_HANDLERS: Record<string, (event: NotificationEvent) => Promise<void>> = {
  log: sendToLog,
  slack: sendToSlack,
  email: sendToEmail,
  pagerduty: sendToPagerDuty,
}

// ── Main Dispatch ──

/**
 * Dispatch an alert event to one or more notification channels.
 * Each channel is independently try/caught — failures are logged but never propagated.
 */
export async function dispatchAlert(
  event: NotificationEvent,
  channels: string[] = ['log'],
): Promise<void> {
  const results = await Promise.allSettled(
    channels.map(async (channel) => {
      const handler = CHANNEL_HANDLERS[channel]
      if (!handler) {
        logger.warn(`[notification-dispatcher] Unknown channel: ${channel}`)
        return
      }
      await handler(event)
    }),
  )

  // Log any rejected channel sends (shouldn't happen due to try/catch, but be safe)
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'rejected') {
      logger.error(
        `[notification-dispatcher] Unexpected failure on channel "${channels[i]}"`,
        { error: (results[i] as PromiseRejectedResult).reason }
      )
    }
  }
}
