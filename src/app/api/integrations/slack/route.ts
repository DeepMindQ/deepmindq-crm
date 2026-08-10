/**
 * DeepMindQ Intelligence OS — Slack / Teams Integration API Route
 *
 * POST /api/integrations/slack
 *
 * Accepts a notification payload and dispatches it to either Slack or
 * Microsoft Teams based on the `type` field.
 *
 * Security:
 *   - SSRF Protection: webhookUrl is validated against domain allowlist
 *     and private IP blocking before any outbound request is made.
 *   - Only system-stored webhook URLs should be used. Accepting arbitrary
 *     URLs from the request body is blocked unless the caller is authenticated
 *     as an admin.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  sendSlackNotification,
  sendTeamsNotification,
  type IntegrationConfig,
  type NotificationPayload,
} from '@/lib/slack-integration';
import { validateOutboundUrl } from '@/lib/ssrf-protection';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      type: 'slack' | 'teams';
      webhookUrl?: string;
      channel?: string;
      payload?: Partial<NotificationPayload>;
    };

    // --- Validate required fields ---
    if (!body.type || (body.type !== 'slack' && body.type !== 'teams')) {
      return NextResponse.json(
        { error: 'Invalid or missing "type". Must be "slack" or "teams".' },
        { status: 400 },
      );
    }

    if (!body.payload) {
      return NextResponse.json(
        { error: 'Missing "payload" object.' },
        { status: 400 },
      );
    }

    if (!body.payload.title || !body.payload.message) {
      return NextResponse.json(
        { error: 'payload must include "title" and "message".' },
        { status: 400 },
      );
    }

    // --- Determine webhook URL ---
    // Security: Prefer system-configured webhook URL from env vars.
    // Only allow request-supplied URL if user is authenticated (checked via
    // middleware x-user-role header set for /api/* routes).
    const systemWebhookUrl =
      body.type === 'slack'
        ? process.env.SLACK_WEBHOOK_URL
        : process.env.TEAMS_WEBHOOK_URL;

    const userRole = request.headers.get('x-user-role');
    const callerSuppliedUrl = body.webhookUrl;

    let finalWebhookUrl: string;

    if (systemWebhookUrl) {
      // System URL takes precedence — ignore any caller-supplied URL
      finalWebhookUrl = systemWebhookUrl;
    } else if (callerSuppliedUrl && userRole === 'admin') {
      // Admin can supply a URL, but it must pass SSRF validation
      finalWebhookUrl = callerSuppliedUrl;
    } else if (callerSuppliedUrl) {
      // Non-admin trying to supply a custom URL — block
      logger.warn('[integrations/slack] Non-admin attempted to supply custom webhook URL', {
        type: body.type,
        role: userRole,
      });
      return NextResponse.json(
        { error: 'Custom webhook URLs require admin role. Use system-configured webhook instead.' },
        { status: 403 },
      );
    } else {
      return NextResponse.json(
        { error: `No webhook URL configured for ${body.type}. Set ${body.type === 'slack' ? 'SLACK_WEBHOOK_URL' : 'TEAMS_WEBHOOK_URL'} env var.` },
        { status: 400 },
      );
    }

    // --- SSRF Protection: Validate the final URL ---
    const urlCheck = validateOutboundUrl(finalWebhookUrl);
    if (!urlCheck.safe) {
      logger.error('[integrations/slack] SSRF protection blocked request', {
        url: finalWebhookUrl,
        reason: urlCheck.error,
      });
      return NextResponse.json(
        { error: `Webhook URL blocked by security policy: ${urlCheck.error}` },
        { status: 400 },
      );
    }

    // --- Build config ---
    const config: IntegrationConfig = {
      type: body.type,
      webhookUrl: urlCheck.url!,
      channel: body.channel,
      enabled: true,
    };

    // --- Build payload with defaults ---
    const payload: NotificationPayload = {
      title: body.payload.title,
      message: body.payload.message,
      level: body.payload.level ?? 'info',
      url: body.payload.url,
      fields: body.payload.fields,
      timestamp: body.payload.timestamp ?? new Date().toISOString(),
    };

    // --- Dispatch ---
    const result =
      config.type === 'teams'
        ? await sendTeamsNotification(config, payload)
        : await sendSlackNotification(config, payload);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? 'Unknown error', status: result.status },
        { status: result.status ?? 502 },
      );
    }

    return NextResponse.json({
      success: true,
      message: `Notification sent via ${config.type}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
