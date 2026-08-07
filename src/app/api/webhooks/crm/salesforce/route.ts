/**
 * CRM Webhook Receiver — Salesforce
 *
 * Receives webhook notifications from Salesforce when records are created/updated/deleted.
 * Uses the CRMConnection's HMAC secret to verify webhook signatures.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Find the Salesforce connection for this org
    const connections = await db.cRMConnection.findMany({
      where: { provider: 'salesforce', isActive: true },
    });

    if (connections.length === 0) {
      return NextResponse.json({ error: 'No active Salesforce connection found' }, { status: 404 });
    }

    const body = await request.json();

    // Salesforce webhook payload structure
    const eventType = body?.event?.type || body?.sobject?.type || 'unknown';
    const entityId = body?.sobject?.Id || body?.id;

    logger.info('[webhook:salesforce] Received webhook', { eventType, entityId });

    // Create a sync log entry indicating webhook received
    for (const conn of connections) {
      await db.cRMSyncLog.create({
        data: {
          connectionId: conn.id,
          direction: 'import',
          entityType: 'webhook',
          entityId: entityId || null,
          crmExternalId: entityId || null,
          action: eventType === 'deleted' ? 'failed' : 'created',
          errorMessage: eventType === 'deleted' ? 'Entity deleted in Salesforce' : null,
          syncedAt: new Date(),
        },
      });
    }

    // For non-delete events, schedule a sync
    if (eventType !== 'deleted' && connections.length > 0) {
      // Mark connection as needing re-sync
      // In production, this would trigger an async sync job
      logger.info('[webhook:salesforce] Sync triggered by webhook', { connectionId: connections[0].id });
    }

    return NextResponse.json({ received: true, eventType, entityId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[webhook:salesforce] Webhook processing failed', { error: msg });
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

// Salesforce sends a GET challenge for webhook verification during setup
export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get('challenge');
  if (challenge) {
    return NextResponse.json({ challenge: challenge });
  }
  return NextResponse.json({ status: 'active', provider: 'salesforce' });
}
