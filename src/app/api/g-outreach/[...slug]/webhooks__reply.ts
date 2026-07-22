import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

/* ═══════════════════════════════════════════════════
   E-07: Inbound Email Webhook (Replies)

   Accepts webhook payloads from email providers
   (Resend, SendGrid inbound). Parses reply metadata,
   auto-categorizes, and creates linked records.
   ═══════════════════════════════════════════════════ */

// ── Reply category patterns ──

const PATTERNS: Record<string, RegExp[]> = {
  out_of_office: [
    /\bout\s*of\s*office\b/i,
    /\boo\b/i,
    /\bauto[\s-]?reply\b/i,
    /\bauto[\s-]?responder\b/i,
    /\btravel(?:ing|ling)?\b/i,
    /\breturn(?:ing|s)?\s*(?:on|in|around)\b/i,
    /\babsent\b/i,
    /\baway\s*(?:from|on|until)\b/i,
    /\bno\s*(?:longer|access)\b.*\boffice\b/i,
    /\bwill\s*be\s*(?:back|away|out|returning)\b/i,
    /\bannual\s*leave\b/i,
    /\bpaternity\b/i,
    /\bmaternity\b/i,
    /\bvacation\b/i,
    /\bPTO\b/i,
    /\bout\s*of\s*the\s*country\b/i,
  ],
  unsubscribe: [
    /\bunsubscribe\b/i,
    /\bremove\s*me\b/i,
    /\bstop\s*email(?:ing)?\b/i,
    /\bopt\s*out\b/i,
    /\bplease\s*unsubscribe\b/i,
    /\bdo\s*not\s*send\b/i,
    /\btake\s*me\s*off\b/i,
    /\bno\s*more\s*emails?\b/i,
  ],
  positive: [
    /\binterested\b/i,
    /\blet'?s?\s*(?:schedule|set\s*up|book|chat|call|meet|connect)\b/i,
    /\byes\s*please\b/i,
    /\btell\s*me\s*more\b/i,
    /\bmore\s*info/i,
    /\bwould\s*love\s*to\b/i,
    /\bsounds\s*good\b/i,
    /\bdefinitely\s*interested\b/i,
    /\bsend\s*more\s*details?\b/i,
    /\bwhen\s*are\s*you\s*(?:free|available)\b/i,
    /\bcount\s*me\s*in\b/i,
    /\bgo\s*ahead\b/i,
    /\bwe'?d?\s*like\s*to\b/i,
  ],
  negative: [
    /\bnot\s*interested\b/i,
    /\bno\s*thanks?\b/i,
    /\bnot\s*a\s*good\s*(?:fit|time)\b/i,
    /\bdo\s*not\s*contact\b/i,
    /\bplease\s*remove\b/i,
    /\bstop\s*(?:reaching|contacting|sending)\b/i,
    /\bwe'?re?\s*(?:all\s*set|good|set|covered)\b/i,
    /\bno\s*interest\b/i,
    /\bnot\s*right\s*now\b/i,
    /\bdecline\b/i,
    /\bpass\b/i,
    /\bwe'?re?\s*not\s*looking\b/i,
  ],
};

function categorizeReply(text: string): string {
  const body = text || '';

  for (const [category, patterns] of Object.entries(PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(body)) return category;
    }
  }

  return 'other';
}

// ── Extract email from "Name <email>" or bare email ──

function extractEmail(raw: string): string | null {
  if (!raw) return null;
  const match = raw.match(/<([^>]+)>/);
  if (match) return match[1].trim().toLowerCase();
  const bare = raw.trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bare)) return bare;
  return null;
}

// ── Parse provider-specific payload formats ──

interface ParsedReply {
  fromEmail: string | null;
  subject: string | null;
  textBody: string | null;
  htmlBody: string | null;
  messageId: string | null;
  inReplyTo: string | null;
  references: string | null;
  receivedAt: Date | null;
}

function parseResendPayload(body: any): ParsedReply {
  return {
    fromEmail: extractEmail(body.from),
    subject: body.subject || null,
    textBody: body.text || null,
    htmlBody: body.html || null,
    messageId: body.message_id || null,
    inReplyTo: body.in_reply_to || null,
    references: body.references || null,
    receivedAt: body.created_at ? new Date(body.created_at) : new Date(),
  };
}

function parseSendGridPayload(body: any): ParsedReply {
  const from = body.from || body.envelope?.from;
  return {
    fromEmail: extractEmail(from),
    subject: body.subject || null,
    textBody: body.text || body.charsets?.text ? body.text : null,
    htmlBody: body.html || null,
    messageId: body.headers?.['Message-ID'] || body.message_id || null,
    inReplyTo: body.headers?.['In-Reply-To'] || null,
    references: body.headers?.References || null,
    receivedAt: body.sent_at || body.headers?.Date
      ? new Date(body.sent_at || body.headers?.Date)
      : new Date(),
  };
}

function parseGenericPayload(body: any): ParsedReply {
  // Fallback: try common field names
  return {
    fromEmail: extractEmail(body.from || body.sender || body.email),
    subject: body.subject || null,
    textBody: body.text || body.body || body.plain || null,
    htmlBody: body.html || null,
    messageId: body.message_id || body.messageId || null,
    inReplyTo: body.in_reply_to || body.inReplyTo || null,
    references: body.references || null,
    receivedAt: body.received_at || body.date || body.timestamp
      ? new Date(body.received_at || body.date || body.timestamp)
      : new Date(),
  };
}

function parsePayload(body: any): ParsedReply {
  // Detect provider by payload shape
  if (body.from && typeof body.from === 'string' && (body.text !== undefined || body.html !== undefined)) {
    if (body.message_id !== undefined || body.in_reply_to !== undefined) {
      return parseResendPayload(body);
    }
  }
  if (body.envelope !== undefined || (body.headers && typeof body.headers === 'object')) {
    return parseSendGridPayload(body);
  }
  return parseGenericPayload(body);
}

// ── Find original draft/queue by message threading headers ──

async function findOriginalItem(inReplyTo: string | null, references: string | null): Promise<{
  draftId: string | null;
  queueId: string | null;
  contactId: string | null;
}> {
  if (!inReplyTo && !references) {
    return { draftId: null, queueId: null, contactId: null };
  }

  // Collect all message IDs to search
  const messageIds: string[] = [];
  if (inReplyTo) {
    messageIds.push(inReplyTo.replace(/^<|>$/g, '').trim());
  }
  if (references) {
    const refs = references.replace(/<>/g, ' ').replace(/\s+/g, ' ').trim();
    messageIds.push(...refs.split(' ').map((r: string) => r.replace(/^<|>$/g, '').trim()).filter(Boolean));
  }

  // Search drafts by messageId
  for (const mid of messageIds) {
    if (!mid) continue;
    const draft = await db.draft.findFirst({
      where: { messageId: mid },
      include: { queueItem: true },
    });
    if (draft) {
      return {
        draftId: draft.id,
        queueId: draft.queueItem?.id || null,
        contactId: draft.contactId,
      };
    }
  }

  return { draftId: null, queueId: null, contactId: null };
}

// ── Audit log helper ──

async function logAudit(action: string, entity: string, entityId: string, details?: string) {
  try {
    await db.auditLog.create({
      data: {
        action,
        entity,
        entityId,
        details,
      },
    });
  } catch (e) {
    console.warn('[Webhook:Reply] Audit log failed:', e);
  }
}

/* ═══════════════════════════════════════════════════
   POST /api/webhooks/reply
   ═══════════════════════════════════════════════════ */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    // Verify webhook signature — REQUIRED in production
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('[Webhook:Reply] RESEND_WEBHOOK_SECRET not configured');
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
        console.warn('[Webhook:Reply] Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } catch {
      // Fallback: constant-time comparison
      if (signature !== expected) {
        console.warn('[Webhook:Reply] Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      // Some providers send URL-encoded form data
      const params = new URLSearchParams(rawBody);
      const parsed = Object.fromEntries(params);
      if (Object.keys(parsed).length > 0) {
        body = parsed;
        // Try to parse nested JSON fields
        for (const key of Object.keys(body)) {
          if (typeof body[key] === 'string' && (body[key].startsWith('{') || body[key].startsWith('['))) {
            try { body[key] = JSON.parse(body[key]); } catch { /* keep string */ }
          }
        }
      } else {
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
      }
    }

    const parsed = parsePayload(body);

    if (!parsed.fromEmail) {
      console.warn('[Webhook:Reply] No from email found in payload');
      return NextResponse.json({ received: true, warning: 'No from email' });
    }

    // Find contact by email
    const contact = await db.contact.findFirst({
      where: { email: parsed.fromEmail },
    });

    if (!contact) {
      console.warn(`[Webhook:Reply] Contact not found for email: ${parsed.fromEmail}`);
      return NextResponse.json({ received: true, warning: 'Contact not found' });
    }

    // Try to find original draft via threading headers
    const original = await findOriginalItem(parsed.inReplyTo, parsed.references);

    // Use plain text for categorization, fall back to HTML stripped
    const categorizationText = parsed.textBody || (parsed.htmlBody ? parsed.htmlBody.replace(/<[^>]*>/g, ' ') : '');
    const category = categorizeReply(categorizationText);

    // Create Reply record
    const reply = await db.reply.create({
      data: {
        contactId: contact.id,
        draftId: original.draftId,
        subject: parsed.subject,
        body: parsed.textBody || parsed.htmlBody || '',
        category,
        receivedAt: parsed.receivedAt || new Date(),
      },
    });

    // Update Contact status to "replied"
    await db.contact.update({
      where: { id: contact.id },
      data: {
        status: 'replied',
        lastContactedAt: new Date(),
      },
    });

    // Create EmailEvent
    await db.emailEvent.create({
      data: {
        contactId: contact.id,
        draftId: original.draftId,
        queueId: original.queueId,
        eventType: 'reply',
        metadata: JSON.stringify({
          category,
          messageId: parsed.messageId,
          inReplyTo: parsed.inReplyTo,
          webhookProvider: detectProvider(body),
        }),
      },
    });

    // Update SendQueue.replied = true if linked
    if (original.queueId) {
      await db.sendQueue.update({
        where: { id: original.queueId },
        data: { replied: true },
      });
    }

    // Auto-suppress if unsubscribe or negative
    if (category === 'unsubscribe' || category === 'negative') {
      const shouldSuppress =
        (category === 'unsubscribe') ||
        (category === 'negative' && await isAutoSuppressNegativeReplies());

      if (shouldSuppress) {
        await db.contact.update({
          where: { id: contact.id },
          data: { consentStatus: 'opted_out', isSuppressed: true, suppressionReason: `auto_suppressed: ${category}` },
        });

        // Upsert suppression record
        await db.suppression.upsert({
          where: { contactId: contact.id },
          create: {
            contactId: contact.id,
            reason: category === 'unsubscribe' ? 'unsubscribe' : 'negative_reply',
            method: 'auto_webhook',
          },
          update: {
            reason: category === 'unsubscribe' ? 'unsubscribe' : 'negative_reply',
            method: 'auto_webhook',
          },
        });

        await logAudit(
          'auto_suppress',
          'Contact',
          contact.id,
          `Auto-suppressed via reply webhook, category: ${category}`
        );
      }
    }

    await logAudit(
      'reply_received',
      'Reply',
      reply.id,
      `From ${contact.email}, category: ${category}${original.draftId ? `, draft: ${original.draftId}` : ''}`
    );

    return NextResponse.json({
      received: true,
      replyId: reply.id,
      contactId: contact.id,
      category,
    });
  } catch (error) {
    console.error('[Webhook:Reply] Error processing reply webhook:', error);
    // Always return 200 to acknowledge webhook
    return NextResponse.json({ received: true, error: 'Processing failed' });
  }
}

// ── Helpers ──

function detectProvider(body: any): string {
  if (body.envelope !== undefined) return 'sendgrid';
  if (body.message_id !== undefined || body.in_reply_to !== undefined) return 'resend';
  return 'generic';
}

async function isAutoSuppressNegativeReplies(): Promise<boolean> {
  try {
    const settingsRes = await fetch('http://internal/api/settings');
    if (!settingsRes.ok) return false;
    const data = await settingsRes.json();
    return data.settings?.suppressionRules?.autoSuppressNegativeReplies ?? false;
  } catch {
    return false;
  }
}

// Health check for webhook endpoint
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/webhooks/reply',
    status: 'active',
    supportedProviders: ['resend', 'sendgrid', 'generic'],
  });
}