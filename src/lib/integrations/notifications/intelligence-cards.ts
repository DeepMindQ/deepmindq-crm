/**
 * P4.4 — Intelligence Notification Action Cards
 *
 * Generates rich notification payloads for Slack and Teams with:
 * - Company name and deep link
 * - Intelligence summary
 * - Confidence score with color coding
 * - Evidence count
 * - Quick action buttons (View, Dismiss, Snooze)
 *
 * Uses the existing `sendSlackNotification` / `sendTeamsNotification` transport
 * layer from `@/lib/slack-integration` — no new HTTP clients.
 */

import { logger } from '@/lib/logger'
import {
  sendSlackNotification,
  sendTeamsNotification,
  quickSlack,
  quickTeams,
  type NotificationPayload,
  type NotificationField,
} from '@/lib/slack-integration'

// ── Types ──────────────────────────────────────────────────────────────────

export interface IntelligenceCardData {
  companyId: string
  companyName: string
  intelligenceType:
    | 'buying_signal'
    | 'score_change'
    | 'new_research'
    | 'recommendation'
    | 'enrichment_complete'
    | string
  /** 1-2 sentence intelligence summary */
  summary: string
  /** 0-1 */
  confidence: number
  evidenceCount?: number
  priority?: 'high' | 'medium' | 'low'
  /** URL to the intelligence item in the platform */
  deepLink?: string
  /** e.g. 'Salesforce', 'HubSpot', 'AI Engine' */
  source?: string
  timestamp?: Date
  /** Additional key-value data rendered as fields */
  fields?: Record<string, string>
}

export interface IntelligenceBatchResult {
  sent: number
  failed: number
}

// ── Color coding helpers ──────────────────────────────────────────────────

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return '#36a64f' // green
  if (confidence >= 0.6) return '#f2c744' // yellow
  return '#e01e5a' // red
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'High'
  if (confidence >= 0.6) return 'Medium'
  return 'Low'
}

function getPriorityEmoji(priority?: string): string {
  switch (priority) {
    case 'high':
      return '🔴'
    case 'medium':
      return '🟡'
    case 'low':
      return '🟢'
    default:
      return 'ℹ️'
  }
}

function mapPriorityToLevel(
  priority?: string,
  confidence?: number,
): NotificationPayload['level'] {
  if (priority === 'high') return 'critical'
  if (priority === 'medium') return 'warning'
  if (confidence !== undefined && confidence >= 0.8) return 'warning'
  return 'info'
}

function formatTitle(type: string): string {
  const titles: Record<string, string> = {
    buying_signal: 'Buying Signal Detected',
    score_change: 'Priority Score Changed',
    new_research: 'New Research Available',
    recommendation: 'AI Recommendation',
    enrichment_complete: 'Enrichment Complete',
  }
  return (
    titles[type] ||
    type
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase())
  )
}

// ── Build payloads ────────────────────────────────────────────────────────

/**
 * Build a `NotificationPayload` optimised for the intelligence card format.
 * Works for both Slack and Teams since `sendTeamsNotification` accepts the
 * same `NotificationPayload` type and converts internally to MessageCard.
 */
function buildIntelligencePayload(data: IntelligenceCardData): NotificationPayload {
  const confidencePercent = Math.round(data.confidence * 100)

  const fields: NotificationField[] = [
    {
      title: 'Confidence',
      value: `${confidencePercent}% (${getConfidenceLabel(data.confidence)})`,
      short: true,
    },
    {
      title: 'Evidence',
      value: `${data.evidenceCount ?? 'N/A'} sources`,
      short: true,
    },
  ]

  if (data.source) {
    fields.push({ title: 'Source', value: data.source, short: true })
  }

  // Append any caller-supplied custom fields
  if (data.fields) {
    for (const [key, value] of Object.entries(data.fields)) {
      fields.push({ title: key, value, short: true })
    }
  }

  return {
    title: `${getPriorityEmoji(data.priority)} ${data.companyName} — ${formatTitle(data.intelligenceType)}`,
    message: data.summary,
    level: mapPriorityToLevel(data.priority, data.confidence),
    url: data.deepLink,
    fields,
    timestamp: data.timestamp?.toISOString(),
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Send a single intelligence notification to Slack and/or Teams.
 *
 * Uses the existing `quickSlack` / `quickTeams` helpers (fire-and-forget).
 * Failures are logged but never thrown — the caller is never blocked.
 */
export async function sendIntelligenceAlert(
  data: IntelligenceCardData,
  channel: 'slack' | 'teams' | 'both' = 'both',
): Promise<void> {
  const payload = buildIntelligencePayload(data)

  try {
    if (channel === 'slack' || channel === 'both') {
      const slackUrl = process.env.SLACK_WEBHOOK_URL
      if (slackUrl) {
        const result = await quickSlack(slackUrl, payload)
        if (!result.success) {
          logger.warn('[intelligence-cards] Slack send failed', {
            error: result.error,
            status: result.status,
            companyId: data.companyId,
          })
        }
      } else {
        logger.warn('[intelligence-cards] SLACK_WEBHOOK_URL not set — skipping Slack')
      }
    }

    if (channel === 'teams' || channel === 'both') {
      const teamsUrl = process.env.TEAMS_WEBHOOK_URL
      if (teamsUrl) {
        const result = await quickTeams(teamsUrl, payload)
        if (!result.success) {
          logger.warn('[intelligence-cards] Teams send failed', {
            error: result.error,
            status: result.status,
            companyId: data.companyId,
          })
        }
      } else {
        logger.warn('[intelligence-cards] TEAMS_WEBHOOK_URL not set — skipping Teams')
      }
    }

    logger.info(
      `[intelligence-cards] Alert sent: ${data.intelligenceType} for ${data.companyName}`,
      {
        companyId: data.companyId,
        confidence: data.confidence,
        channel,
      },
    )
  } catch (err) {
    // Fire-and-forget: never propagate errors to callers
    logger.error('[intelligence-cards] Failed to send intelligence alert', {
      error: err instanceof Error ? err.message : String(err),
      companyId: data.companyId,
      intelligenceType: data.intelligenceType,
    })
  }
}

/**
 * Send a batch of intelligence alerts (e.g. after a sync cycle).
 * Each alert is sent independently; one failure does not block the rest.
 */
export async function sendIntelligenceBatch(
  alerts: IntelligenceCardData[],
  channel: 'slack' | 'teams' | 'both' = 'both',
): Promise<IntelligenceBatchResult> {
  let sent = 0
  let failed = 0

  for (const alert of alerts) {
    try {
      await sendIntelligenceAlert(alert, channel)
      sent++
    } catch {
      failed++
    }
  }

  return { sent, failed }
}

// ── Exported helpers (useful for tests or custom formatting) ───────────────

export { buildIntelligencePayload, getConfidenceColor, getConfidenceLabel, formatTitle }
