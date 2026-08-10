/**
 * CRM Webhook Receiver — Salesforce
 *
 * Receives webhook notifications from Salesforce when records are created/updated/deleted.
 * Verifies webhook signatures using the CRMConnection's HMAC secret.
 *
 * Security:
 *   - Validates Salesforce webhook signature (X-SF-Signature header) when CRMConnection.hmacSecret is set
 *   - Falls back to no-auth mode for development/testing when no secret is configured
 *   - Logs all webhook events for audit trail via CRMSyncLog
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { createHash, timingSafeEqual } from 'crypto';

/**
 * Verify Salesforce webhook signature using HMAC-SHA256.
 * Salesforce signs the webhook body with the connected app's consumer secret.
 */
function verifySalesforceSignature(body: string, signature: string | null, secret: string | null): boolean {
  // FAIL-CLOSED: If no secret is configured, REJECT the webhook.
  // Previously this returned true (allowing unauthenticated access). Fixed in Phase A.
  if (!secret) {
    logger.error('[webhook:salesforce] No HMAC secret configured — rejecting webhook (fail-closed)');
    return false;
  }
  if (!signature) {
    logger.warn('[webhook:salesforce] Missing signature header — rejecting webhook');
    return false;
  }

  try {
    const expected = createHash('sha256').update(body).update(secret).digest('hex');
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
    // Read body once as text for signature verification
    const bodyText = await request.text();
    let body: Record<string, unknown>;

    try {
      body = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    // ── SECURITY: Verify signature BEFORE any DB query (timing attack prevention) ──
    // Previously the code queried CRMConnection BEFORE verifying the signature,
    // leaking information about whether connections exist (timing side-channel).
    // Fixed in Phase A: signature verification is now the FIRST operation.
    const signature = request.headers.get('x-sf-signature') || request.headers.get('signature');

    // Try env var first for immediate rejection if not configured
    const envSecret = process.env.SALESFORCE_WEBHOOK_SECRET || null;

    if (!envSecret) {
      // SECURITY: No env secret configured — fail-closed in production.
      // In development, fall back to DB-stored secret (with timing caveat).
      if (process.env.NODE_ENV === 'production') {
        logger.error('[webhook:salesforce] SALESFORCE_WEBHOOK_SECRET not configured in production — rejecting webhook (fail-closed)');
        return NextResponse.json({ error: 'Webhook secret not configured. Set SALESFORCE_WEBHOOK_SECRET env var.' }, { status: 401 });
      }

      // Dev-only: Check DB for connection-level secret
      const connections = await db.cRMConnection.findMany({
        where: { provider: 'salesforce', isActive: true },
      });

      if (connections.length === 0) {
        return NextResponse.json({ error: 'No active Salesforce connection found' }, { status: 404 });
      }

      const hmacSecret = (connections[0] as Record<string, unknown>).hmacSecret as string | null;
      if (!hmacSecret) {
        logger.error('[webhook:salesforce] CRMConnection has no hmacSecret — rejecting webhook (fail-closed)');
        return NextResponse.json({ error: 'Signature verification required but no secret configured' }, { status: 401 });
      }

      if (!verifySalesforceSignature(bodyText, signature, hmacSecret)) {
        logger.warn('[webhook:salesforce] Signature verification failed');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } else {
      // Env var secret available — verify immediately, skip DB query
      if (!verifySalesforceSignature(bodyText, signature, envSecret)) {
        logger.warn('[webhook:salesforce] Signature verification failed (env secret)');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    // ── Signature verified — now safe to query DB ──
    // Find the Salesforce connection for this org (for sync context)
    const connections = await db.cRMConnection.findMany({
      where: { provider: 'salesforce', isActive: true },
    });

    // Salesforce webhook payload structure
    const eventType = (body?.event as Record<string, unknown>)?.type || (body?.sobject as Record<string, unknown>)?.type || 'unknown';
    const entityId = (body?.sobject as Record<string, unknown>)?.Id || body?.id;

    logger.info('[webhook:salesforce] Received webhook', { eventType, entityId });

    // Create a sync log entry indicating webhook received
    for (const conn of connections) {
      await db.cRMSyncLog.create({
        data: {
          connectionId: conn.id,
          direction: 'import',
          entityType: 'webhook',
          entityId: (entityId as string) || null,
          crmExternalId: (entityId as string) || null,
          action: eventType === 'deleted' ? 'failed' : 'created',
          errorMessage: eventType === 'deleted' ? 'Entity deleted in Salesforce' : null,
          syncedAt: new Date(),
        },
      });
    }

    // For non-delete events, trigger async sync for the changed entity
    if (eventType !== 'deleted' && connections.length > 0) {
      // P4.1: Map Salesforce entity to sync options
      const entity = String(
        (body?.sobject as Record<string, unknown>)?.type ||
        (body?.ChangeEventHeader as Record<string, unknown>)?.entityName ||
        'unknown'
      );
      const connectionId = connections[0].id;

      const syncOptions: Record<string, boolean> = {
        syncAccounts: entity === 'Account',
        syncContacts: entity === 'Contact',
        syncDeals: entity === 'Opportunity',
      };

      // Fire-and-forget async sync
      (async () => {
        try {
          const { syncFromCRM } = await import('@/lib/crm/crm-sync-service');
          await syncFromCRM(connectionId, {
            ...syncOptions,
            limit: 10,
          });
          logger.info(`[sf-webhook] Async sync completed for ${entity}/${entityId}`);
        } catch (syncErr) {
          logger.error(`[sf-webhook] Async sync failed for ${entity}/${entityId}`, { error: syncErr });
        }
      })();
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
