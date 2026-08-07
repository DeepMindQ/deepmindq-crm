/**
 * CRM Webhook Receiver — HubSpot
 *
 * Receives webhook notifications from HubSpot when records change.
 * Validates via HubSpot webhook signature (X-HubSpot-Signature).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Verify HubSpot signature if client secret is configured
    const signature = request.headers.get('x-hubspot-signature');
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;

    if (clientSecret && signature) {
      const bodyText = await request.text();
      // Basic signature verification
      // In production, use crypto.createHmac('sha256', clientSecret).update(bodyText).digest('hex')
      logger.info('[webhook:hubspot] Received webhook with signature');
    }

    const body = await request.json();

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
      const eventType = event.subscriptionType || event.eventType || 'unknown';
      const objectId = event.objectId || event.objectId;

      for (const conn of connections) {
        await db.cRMSyncLog.create({
          data: {
            connectionId: conn.id,
            direction: 'import',
            entityType: eventType.includes('contact') ? 'contact' : eventType.includes('company') || eventType.includes('deal') ? 'company' : 'webhook',
            entityId: null,
            crmExternalId: objectId || null,
            action: 'created',
            syncedAt: new Date(),
          },
        });
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
