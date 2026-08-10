/**
 * Slack & Microsoft Teams Notification Integration
 *
 * Provides unified notification helpers for both Slack (incoming webhook with
 * attachments) and Microsoft Teams (Adaptive Card) formats.
 * Branding is fetched from the brand-helper module.
 */

import { getBrandNameSync } from '@/lib/brand-helper';
import { tokens } from '@/lib/design-tokens';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IntegrationConfig {
  type: 'slack' | 'teams';
  webhookUrl: string;
  channel?: string;
  enabled: boolean;
}

export interface NotificationField {
  title: string;
  value: string;
  short?: boolean;
}

export interface NotificationPayload {
  title: string;
  message: string;
  level: 'info' | 'warning' | 'critical';
  url?: string;
  fields?: NotificationField[];
  timestamp?: string;
}

interface SendResult {
  success: boolean;
  status?: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Level → colour mapping
// ---------------------------------------------------------------------------

const LEVEL_COLORS: Record<NotificationPayload['level'], string> = {
  info: '#36a64f',
  warning: tokens.gold.light,
  critical: tokens.extended.pink.value,
};

const _LEVEL_THEME_COLORS: Record<NotificationPayload['level'], string> = {
  info: 'good',
  warning: 'warning',
  critical: 'attention',
};

// ---------------------------------------------------------------------------
// Slack — Incoming Webhook payload
// ---------------------------------------------------------------------------

function buildSlackPayload(
  config: IntegrationConfig,
  payload: NotificationPayload,
): Record<string, unknown> {
  const attachment: Record<string, unknown> = {
    color: LEVEL_COLORS[payload.level],
    title: payload.title,
    text: payload.message,
    fallback: `${payload.title}: ${payload.message}`,
    footer: `${getBrandNameSync()} Intelligence`,
    ts: payload.timestamp ?? Math.floor(Date.now() / 1000).toString(),
    fields: payload.fields?.map((f) => ({
      title: f.title,
      value: f.value,
      short: f.short ?? false,
    })),
  };

  if (payload.url) {
    attachment.title_link = payload.url;
  }

  const body: Record<string, unknown> = { attachments: [attachment] };
  if (config.channel) {
    body.channel = config.channel;
  }

  return body;
}

/**
 * Send a notification to Slack via an incoming webhook.
 */
export async function sendSlackNotification(
  config: IntegrationConfig,
  payload: NotificationPayload,
): Promise<SendResult> {
  if (!config.enabled || !config.webhookUrl) {
    return { success: false, error: 'Integration is disabled or webhook URL is missing' };
  }

  const body = buildSlackPayload(config, payload);

  try {
    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, status: response.status, error: text };
    }

    return { success: true, status: response.status };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Microsoft Teams — Adaptive Card payload (incoming webhook)
// ---------------------------------------------------------------------------

function buildTeamsPayload(
  _config: IntegrationConfig,
  payload: NotificationPayload,
): Record<string, unknown> {
  const themeColor = LEVEL_COLORS[payload.level];
  const potentialAction =
    payload.url
      ? [
          {
            '@type': 'OpenUri',
            name: 'View Details',
            targets: [{ os: 'default', uri: payload.url }],
          },
        ]
      : [];

  const facts = payload.fields?.map((f) => ({ name: f.title, value: f.value })) ?? [];

  const card: Record<string, unknown> = {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor,
    summary: payload.title,
    sections: [
      {
        activityTitle: `**${payload.title}**`,
        activitySubtitle: `${getBrandNameSync()} Intelligence`,
        activityImage: 'https://deepmindq.io/logo.png',
        text: payload.message,
        facts,
        potentialAction,
      },
    ],
  };

  if (payload.level === 'critical') {
    card.markdown = true;
  }

  return card;
}

/**
 * Send a notification to Microsoft Teams via an incoming webhook.
 */
export async function sendTeamsNotification(
  config: IntegrationConfig,
  payload: NotificationPayload,
): Promise<SendResult> {
  if (!config.enabled || !config.webhookUrl) {
    return { success: false, error: 'Integration is disabled or webhook URL is missing' };
  }

  const body = buildTeamsPayload(config, payload);

  try {
    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, status: response.status, error: text };
    }

    return { success: true, status: response.status };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Unified dispatch helper
// ---------------------------------------------------------------------------

/**
 * Send a notification via the configured integration (Slack or Teams).
 * Automatically selects the correct sender based on `config.type`.
 */
export async function sendIntegrationNotification(
  config: IntegrationConfig,
  payload: NotificationPayload,
): Promise<SendResult> {
  if (config.type === 'teams') {
    return sendTeamsNotification(config, payload);
  }

  return sendSlackNotification(config, payload);
}

// ---------------------------------------------------------------------------
// Quick-send convenience (no stored config)
// ---------------------------------------------------------------------------

/**
 * Send a one-off Slack notification to an arbitrary webhook URL.
 */
export async function quickSlack(
  webhookUrl: string,
  payload: NotificationPayload,
): Promise<SendResult> {
  return sendSlackNotification(
    { type: 'slack', webhookUrl, enabled: true },
    payload,
  );
}

/**
 * Send a one-off Teams notification to an arbitrary webhook URL.
 */
export async function quickTeams(
  webhookUrl: string,
  payload: NotificationPayload,
): Promise<SendResult> {
  return sendTeamsNotification(
    { type: 'teams', webhookUrl, enabled: true },
    payload,
  );
}
