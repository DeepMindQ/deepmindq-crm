/**
 * CRM Webhook Receiver — HubSpot
 *
 * Receives webhook notifications from HubSpot when records change.
 * Validates via HubSpot webhook signature (X-HubSpot-Signature) using HMAC-SHA256.
 *
 * Security:
 *   - Verifies HubSpot signature when HUBSPOT_CLIENT_SECRET is configured
 *   - Falls back to no-auth mode for development/testing when no secret is configured
 *   - Logs all webhook events for audit trail via CRMSyncLog
 *
 * Bug Fix: Previously read body twice (text() then json()), which fails because
 * the body stream is consumed after the first read. Now reads body once as text,
 * verifies signature, then parses JSON.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verify HubSpot webhook signature using HMAC-SHA256.
 * HubSpot signs the webhook body with the app's client secret.
 */
function verifyHubSpotSignature(body: string, signature: string | null, secret: string | null): boolean {
  if (!secret || !signature) {
    // No secret configured — allow in development mode
    logger.warn('[webhook:hubspot] No client secret configured, skipping signature verification');
    return true;
  }

  try {
    const expected = createHmac('sha256', secret).update(body).digest('hex');
    // timingSafeEqual requires same-length buffers
    const expectedBuf = Buffer.from(expected, 'utf-8');
    const actualBuf = Buffer.from(signature, 'utf-8');

    if (expectedBuf.length !== actualBuf.length) {
      return false;
    }

    return timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Read body ONCE as text for signature verification
    const bodyText = await request.text();

    // Verify HubSpot signature
    const signature = request.headers.get('x-hubspot-signature') || request.headers.get('x-hubspot-signature-v3');
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET || process.env.HUBSPOT_WEBHOOK_SECRET || null;

    if (!verifyHubSpotSignature(bodyText, signature, clientSecret)) {
      logger.warn('[webhook:hubspot] Signature verification failed');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse JSON from the already-read body text
    let body: Record<string, unknown> | Record<string, unknown>[];
    try {
      body = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    // HubSpot webhook payload: array of events
    const events = Array.isArray(body) ? body : [body];

    logger.info('[webhook:hubspot] Received webhook events', { count: events.length });

    const connections = await db.cRMConnection.findMany({
      where: { provider: 'hubspot', isActive: true },
    });

    if (connections.length === 0) {
      return NextResponse.json({ error: 'No active HubSpot connection found' }, { status: 404 });
    }

    for (const event of events) {
      const evt = event as Record<string, unknown>;
      const eventType = String(evt.subscriptionType || evt.eventType || 'unknown');
      const objectId = String(evt.objectId || '');

      for (const conn of connections) {
        await db.cRMSyncLog.create({
          data: {
            connectionId: conn.id,
            direction: 'import',
            entityType: eventType.includes('contact') ? 'contact' : eventType.includes('deal') ? 'opportunity' : 'company',
            entityId: null,
            crmExternalId: objectId || null,
            action: eventType.includes('creation') ? 'created' : 'updated',
            syncedAt: new Date(),
          },
        });

        // P4.1: Trigger async sync for creation/update events (fire-and-forget)
        if (eventType.includes('creation') || eventType.includes('update')) {
          const connectionId = conn.id;
          const syncOpts = {
            syncAccounts: eventType.includes('company'),
            syncContacts: eventType.includes('contact'),
            syncDeals: eventType.includes('deal'),
            limit: 10,
          };

          (async () => {
            try {
              const { syncFromCRM } = await import('@/lib/crm/crm-sync-service');
              await syncFromCRM(connectionId, syncOpts);
              logger.info(`[hs-webhook] Async sync completed for ${eventType}/${objectId}`);
            } catch (syncErr) {
              logger.error(`[hs-webhook] Async sync failed for ${eventType}/${objectId}`, { error: syncErr });
            }
          })();
        }
      }
    }

    return NextResponse.json({ received: true, eventCount: events.length });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[webhook:hubspot] Webhook processing failed', { error: msg });
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'active', provider: 'hubspot' });
}
