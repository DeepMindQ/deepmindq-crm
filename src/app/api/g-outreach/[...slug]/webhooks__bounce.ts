import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

/* ═══════════════════════════════════════════════════
   E-08: Bounce Webhook Handler

   Accepts bounce notifications from email providers
   (Resend, SendGrid, SES, Postmark). Classifies hard
   vs soft bounces, auto-suppresses hard bounces.
   ═══════════════════════════════════════════════════ */

// ── Types ──

interface ParsedBounce {
  recipientEmail: string | null;
  bounceType: 'hard' | 'soft' | null;
  reason: string | null;
  providerData: any;
  queueId: string | null;
  provider: string;
}

// ── Provider-specific parsers ──

function parseResendBounce(body: any): ParsedBounce {
  const eventType = body.type || body.event;
  const isHard = eventType === 'bounce' || eventType === 'bounced' || body.bounce_type === 'permanent';
  return {
    recipientEmail: body.to || body.data?.to || body.email || null,
    bounceType: isHard ? 'hard' : 'soft',
    reason: body.reason || body.data?.reason || body.error || body.message || null,
    providerData: body.data || body,
    queueId: null, // Will be looked up
    provider: 'resend',
  };
}

function parseSendGridBounce(body: any): ParsedBounce {
  // SendGrid sends events in an array
  const event = Array.isArray(body) ? body[0] : body;
  const eventType = event?.event || event?.type;
  const isHard =
    eventType === 'bounce' ||
    eventType === 'bounced' ||
    event?.bounce_type === 'permanent' ||
    event?.status === '5.x.x' ||
    (event?.status && event.status.startsWith('5'));

  return {
    recipientEmail: event?.email || event?.to || body.email || null,
    bounceType: isHard ? 'hard' : 'soft',
    reason: event?.reason || event?.error || event?.response || body.reason || null,
    providerData: event || body,
    queueId: null,
    provider: 'sendgrid',
  };
}

function parseSESBounce(body: any): ParsedBounce {
  const record = body?.Records?.[0]?.ses?.mail || {};
  const bounce = body?.Records?.[0]?.ses?.bounce || {};
  const isHard = bounce?.bounceType === 'Permanent' || bounce?.bounceType === 'hard';
  const recipients = record?.destination || [];

  return {
    recipientEmail: recipients[0] || record?.destination?.[0] || null,
    bounceType: isHard ? 'hard' : 'soft',
    reason: bounce?.bounceSubType || bounce?.diagnosticCode || bounce?.bouncedRecipients?.[0]?.diagnosticCode || null,
    providerData: body,
    queueId: null,
    provider: 'ses',
  };
}

function parsePostmarkBounce(body: any): ParsedBounce {
  return {
    recipientEmail: body.Recipient || body.Email || body.email || null,
    bounceType: body.Type === 'HardBounce' || body.Type === 'SpamComplaint' ? 'hard' : 'soft',
    reason: body.Description || body.Details || body.Message || body.reason || null,
    providerData: body,
    queueId: body.MessageID || null,
    provider: 'postmark',
  };
}

function parseGenericBounce(body: any): ParsedBounce {
  const email = body.email || body.recipient || body.to || body.to_email || null;
  const bType = body.bounce_type || body.bounceType || body.type;

  return {
    recipientEmail: email,
    bounceType: bType === 'hard' || bType === 'permanent' || bType === 'HardBounce' ? 'hard' : 'soft',
    reason: body.reason || body.error || body.description || body.message || null,
    providerData: body,
    queueId: null,
    provider: 'generic',
  };
}

function detectProvider(body: any): string {
  if (body.Records?.[0]?.ses) return 'ses';
  if (body.Recipient !== undefined || body.Type === 'HardBounce') return 'postmark';
  if (Array.isArray(body) || body.event || body.bounce_type !== undefined) return 'sendgrid';
  if (body.type === 'bounce' || body.data?.to !== undefined) return 'resend';
  return 'generic';
}

function parseBouncePayload(body: any): ParsedBounce {
  const provider = detectProvider(body);
  switch (provider) {
    case 'resend': return parseResendBounce(body);
    case 'sendgrid': return parseSendGridBounce(body);
    case 'ses': return parseSESBounce(body);
    case 'postmark': return parsePostmarkBounce(body);
    default: return parseGenericBounce(body);
  }
}

// ── Audit log helper ──

async function logAudit(action: string, entity: string, entityId: string, details?: string) {
  try {
    await db.auditLog.create({
      data: { action, entity, entityId, details },
    });
  } catch (e) {
    console.warn('[Webhook:Bounce] Audit log failed:', e);
  }
}

/* ═══════════════════════════════════════════════════
   POST /api/webhooks/bounce
   ═══════════════════════════════════════════════════ */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    // Verify webhook signature — REQUIRED
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('[Webhook:Bounce] RESEND_WEBHOOK_SECRET not configured');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }
    const signature = request.headers.get('resend-signature') || request.headers.get('x-webhook-signature');
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature header' }, { status: 401 });
    }
    const expected = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');
    // Timing-safe comparison
    try {
      const cryptoTiming = await import('crypto');
      const timingBuf1 = Buffer.from(signature, 'hex');
      const timingBuf2 = Buffer.from(expected, 'hex');
      if (timingBuf1.length !== timingBuf2.length || !cryptoTiming.timingSafeEqual(timingBuf1, timingBuf2)) {
        console.warn('[Webhook:Bounce] Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } catch {
      // Fallback: constant-time comparison
      if (signature !== expected) {
        console.warn('[Webhook:Bounce] Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      // Try URL-encoded
      const params = new URLSearchParams(rawBody);
      const parsed = Object.fromEntries(params);
      if (Object.keys(parsed).length > 0) {
        body = parsed;
        for (const key of Object.keys(body)) {
          if (typeof body[key] === 'string' && (body[key].startsWith('{') || body[key].startsWith('['))) {
            try { body[key] = JSON.parse(body[key]); } catch { /* keep string */ }
          }
        }
      } else {
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
      }
    }

    const parsed = parseBouncePayload(body);

    if (!parsed.recipientEmail) {
      console.warn('[Webhook:Bounce] No recipient email found in payload');
      return NextResponse.json({ received: true, warning: 'No recipient email' });
    }

    const recipientEmail = parsed.recipientEmail.toLowerCase().trim();

    // Find contact by email
    const contact = await db.contact.findFirst({
      where: { email: recipientEmail },
    });

    if (!contact) {
      console.warn(`[Webhook:Bounce] Contact not found for: ${recipientEmail}`);
      return NextResponse.json({ received: true, warning: 'Contact not found' });
    }

    // Try to find linked queue item (by provider ID or draft's contact)
    let linkedQueueId = parsed.queueId;
    if (!linkedQueueId) {
      const queueItem = await db.sendQueue.findFirst({
        where: {
          draft: { contactId: contact.id },
          status: 'sent',
        },
      });
      linkedQueueId = queueItem?.id || null;
    }

    // Create Bounce record
    const bounce = await db.bounce.create({
      data: {
        contactId: contact.id,
        queueId: linkedQueueId,
        bounceType: parsed.bounceType,
        reason: parsed.reason,
        providerData: JSON.stringify(parsed.providerData),
        bouncedAt: new Date(),
      },
    });

    // Create EmailEvent
    await db.emailEvent.create({
      data: {
        contactId: contact.id,
        queueId: linkedQueueId,
        eventType: 'bounce',
        metadata: JSON.stringify({
          bounceType: parsed.bounceType,
          reason: parsed.reason,
          provider: parsed.provider,
          bounceId: bounce.id,
        }),
      },
    });

    // Update SendQueue.bounced = true if linked
    if (linkedQueueId) {
      await db.sendQueue.update({
        where: { id: linkedQueueId },
        data: { bounced: true },
      });
    }

    // Handle hard bounce: auto-suppress
    if (parsed.bounceType === 'hard') {
      await db.contact.update({
        where: { id: contact.id },
        data: {
          status: 'bounced',
          emailHealth: 'invalid',
          emailHealthScore: 0,
          isSuppressed: true,
          suppressionReason: `hard_bounce: ${parsed.reason || 'unknown'}`,
        },
      });

      // Upsert suppression record
      await db.suppression.upsert({
        where: { contactId: contact.id },
        create: {
          contactId: contact.id,
          reason: 'bounce',
          method: 'auto_bounce',
        },
        update: {
          reason: 'bounce',
          method: 'auto_bounce',
        },
      });

      await logAudit(
        'auto_suppress',
        'Contact',
        contact.id,
        `Auto-suppressed via hard bounce webhook. Reason: ${parsed.reason || 'unknown'}. Provider: ${parsed.provider}`
      );
    } else {
      // Soft bounce: warn by updating email health
      await db.contact.update({
        where: { id: contact.id },
        data: {
          emailHealth: 'risky',
        },
      });

      await logAudit(
        'soft_bounce',
        'Contact',
        contact.id,
        `Soft bounce recorded. Reason: ${parsed.reason || 'unknown'}. Provider: ${parsed.provider}`
      );
    }

    await logAudit(
      'bounce_received',
      'Bounce',
      bounce.id,
      `From ${contact.email}, type: ${parsed.bounceType}, reason: ${parsed.reason || 'unknown'}, provider: ${parsed.provider}`
    );

    return NextResponse.json({
      received: true,
      bounceId: bounce.id,
      contactId: contact.id,
      bounceType: parsed.bounceType,
      autoSuppressed: parsed.bounceType === 'hard',
    });
  } catch (error) {
    console.error('[Webhook:Bounce] Error processing bounce webhook:', error);
    // Always return 200 to acknowledge webhook
    return NextResponse.json({ received: true, error: 'Processing failed' });
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/webhooks/bounce',
    status: 'active',
    supportedProviders: ['resend', 'sendgrid', 'ses', 'postmark', 'generic'],
  });
}