/**
 * Webhook Management API — CRUD for outgoing webhook configurations
 *
 * GET    /api/webhooks/manage — List all webhook configs
 * POST   /api/webhooks/manage — Register a new webhook
 * DELETE /api/webhooks/manage?id=<id> — Delete a webhook
 *
 * Security:
 *   - Requires authenticated session (enforced by middleware for /api/* routes)
 *   - Requires admin or manager role for POST/DELETE operations
 *   - GET is available to any authenticated user (read-only)
 *   - Zod validation on all inputs
 *   - Removed from PUBLIC_PATH_PREFIXES — no longer accessible without auth
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getWebhookConfigs,
  registerWebhook,
  deleteWebhook,
} from '@/lib/webhook-manager';
import { z } from 'zod';

// ── Validation Schemas ──────────────────────────────────────

const RegisterWebhookSchema = z.object({
  url: z.string()
    .url('Invalid URL format')
    .refine(
      (url) => url.startsWith('https://'),
      'Only HTTPS webhook URLs are allowed',
    ),
  events: z.array(z.string().min(1)).min(1, 'At least one event is required'),
  secret: z.string().min(16, 'Secret must be at least 16 characters').optional(),
  active: z.boolean().optional().default(true),
  retryCount: z.number().int().min(0).max(10).optional().default(3),
});

const DeleteWebhookSchema = z.object({
  id: z.string().min(1, 'Webhook ID is required'),
});

// ── Auth Helpers ────────────────────────────────────────────

function getUserRole(request: NextRequest): string | null {
  return request.headers.get('x-user-role');
}

function getUserId(request: NextRequest): string | null {
  return request.headers.get('x-user-id');
}

// ── GET: List all webhooks (any authenticated user) ─────────

export async function GET(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const webhooks = await getWebhookConfigs();
    // Sanitize: Don't expose full secrets in list responses
    const sanitized = webhooks.map((wh) => ({
      ...wh,
      secret: wh.secret ? `${wh.secret.slice(0, 8)}...` : undefined,
    }));
    return NextResponse.json({ webhooks: sanitized });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Failed to fetch webhooks: ${msg}` }, { status: 500 });
  }
}

// ── POST: Register new webhook (admin/manager only) ─────────

export async function POST(request: NextRequest) {
  const userId = getUserId(request);
  const role = getUserRole(request);

  if (!userId || !role) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  if (role !== 'admin' && role !== 'manager') {
    return NextResponse.json(
      { error: 'Forbidden. Only admin or manager can register webhooks.' },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const parsed = RegisterWebhookSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 },
      );
    }

    const { url, events, secret, active, retryCount } = parsed.data;

    const webhook = await registerWebhook({
      url,
      events,
      secret: secret || `whsec_${crypto.getRandomValues(new Uint8Array(16)).reduce((s, b) => s + b.toString(16).padStart(2, '0'), '')}`,
      active,
      retryCount,
    });

    return NextResponse.json({ webhook }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Failed to register webhook: ${msg}` }, { status: 500 });
  }
}

// ── DELETE: Remove webhook (admin only) ────────────────────

export async function DELETE(request: NextRequest) {
  const userId = getUserId(request);
  const role = getUserRole(request);

  if (!userId || !role) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  if (role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden. Only admin can delete webhooks.' },
      { status: 403 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    const parsed = DeleteWebhookSchema.safeParse({ id });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid webhook ID' },
        { status: 400 },
      );
    }

    const deleted = await deleteWebhook(parsed.data.id);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Webhook not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Failed to delete webhook: ${msg}` }, { status: 500 });
  }
}
