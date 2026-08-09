/**
 * DeepMindQ Intelligence OS — Slack / Teams Integration API Route
 *
 * POST /api/integrations/slack
 *
 * Accepts a notification payload and dispatches it to either Slack or
 * Microsoft Teams based on the `type` field.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  sendSlackNotification,
  sendTeamsNotification,
  type IntegrationConfig,
  type NotificationPayload,
} from '@/lib/slack-integration';

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

    // --- Build config ---
    const config: IntegrationConfig = {
      type: body.type,
      webhookUrl: body.webhookUrl ?? '',
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
