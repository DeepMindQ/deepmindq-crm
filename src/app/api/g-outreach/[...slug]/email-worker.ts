/* ═══════════════════════════════════════════════════
   POST /api/email-worker — Human-Approved Send Worker

   ARCHITECTURE PRINCIPLE — HUMAN-CONTROLLED SELLING:
   This worker ONLY sends emails that were explicitly approved
   by a human operator. It processes the SendQueue which is
   populated ONLY when a human clicks "Approve" on a draft.

   The system MUST NOT autonomously:
     - Send emails without human approval
     - Contact prospects automatically
     - Execute sales sequences without human enrollment

   The AI system only: researches, recommends, drafts, and
   assists human decision-making. All outreach execution
   requires explicit human action.

   Logic:
     1. Query SendQueue where status="pending" OR
        (status="scheduled" AND scheduledAt <= now)
     2. For each item: load draft → load contact → send
     3. On success: status="sent", sentAt=now, providerId
     4. On failure: increment retryCount
        - < 3 retries → status="pending" (backoff)
        - >= 3 retries → status="failed" (permanent)
     5. Return summary: { processed, sent, failed, skipped }
   ═══════════════════════════════════════════════════ */

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { sendEmail, getProviderInfo } from '@/lib/email-provider';

const MAX_RETRIES = 3;

export async function POST() {
  const summary = { processed: 0, sent: 0, failed: 0, skipped: 0 };

  try {
    const providerInfo = getProviderInfo();

    // 1. Fetch items ready to send
    const items = await db.sendQueue.findMany({
      where: {
        OR: [
          { status: 'pending' },
          {
            status: 'scheduled',
            scheduledAt: { lte: new Date() },
          },
        ],
      },
      include: {
        draft: {
          include: {
            contact: {
              include: { company: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 50, // Process in batches
    });

    if (!items || items.length === 0) {
      return NextResponse.json(summary);
    }

    for (const item of items) {
      summary.processed++;

      // Skip if no draft or contact
      if (!item.draft || !item.draft.contact?.email) {
        summary.skipped++;
        continue;
      }

      // Skip suppressed contacts
      if (item.draft.contact.isSuppressed) {
        await db.sendQueue.update({
          where: { id: item.id },
          data: {
            status: 'failed',
            failureReason: 'Contact is suppressed',
          },
        });
        summary.skipped++;
        continue;
      }

      // Exponential backoff check (E-04)
      // Wait 2^retryCount minutes between retries
      if (item.retryCount > 0 && item.updatedAt) {
        const backoffMinutes = Math.pow(2, item.retryCount) * 60 * 1000;
        const nextRetryAt = new Date(item.updatedAt.getTime() + backoffMinutes);
        if (new Date() < nextRetryAt) {
          summary.skipped++;
          continue;
        }
      }

      // Build HTML email from draft
      const contact = item.draft.contact;
      const signature = process.env.EMAIL_SIGNATURE || '';
      const html = buildEmailHtml({
        body: item.draft.body,
        cta: item.draft.cta,
        firstName: contact.rawName?.split(' ')[0] || '',
        signature,
      });

      // Send via provider
      const result = await sendEmail({
        to: contact.email,
        subject: item.draft.subject,
        html,
        replyTo: process.env.EMAIL_REPLY_TO || undefined,
        messageId: item.draft.messageId || undefined,
        references: item.draft.references || undefined,
      });

      if (result.success) {
        // Success
        await db.sendQueue.update({
          where: { id: item.id },
          data: {
            status: 'sent',
            sentAt: new Date(),
            providerId: result.providerId || null,
            provider: result.provider,
          },
        });
        await db.draft.update({
          where: { id: item.draftId },
          data: { status: 'sent' },
        });
        await db.contact.update({
          where: { id: contact.id },
          data: { status: 'sent', lastContactedAt: new Date() },
        });
        summary.sent++;
      } else {
        // Failure — apply retry logic (E-04)
        const newRetryCount = item.retryCount + 1;
        const isPermanent = newRetryCount >= MAX_RETRIES;

        await db.sendQueue.update({
          where: { id: item.id },
          data: {
            retryCount: newRetryCount,
            status: isPermanent ? 'failed' : 'pending',
            failureReason: result.error || 'Unknown error',
            ...(isPermanent ? {} : {}),
          },
        });

        summary.failed++;
      }
    }

    return NextResponse.json({
      ...summary,
      provider: providerInfo.provider,
      configured: providerInfo.configured,
    });
  } catch (error) {
    console.error('Email worker error:', error);
    return NextResponse.json(
      {
        ...summary,
        error: error instanceof Error ? error.message : 'Worker failed',
      },
      { status: 500 }
    );
  }
}

/* ── Simple HTML builder ── */
function buildEmailHtml(params: {
  body: string;
  cta?: string | null;
  firstName: string;
  signature: string;
}): string {
  const { body, cta, firstName, signature } = params;
  const greeting = firstName ? `Hi ${firstName},` : 'Hello,';
  const ctaBlock = cta
    ? `\n<p style="margin-top: 24px; font-size: 14px; color: #374151;">${cta}</p>`
    : '';
  const sigBlock = signature
    ? `\n<div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 13px; white-space: pre-line;">${signature}</div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 16px; color: #1f2937; background: #ffffff; line-height: 1.7; font-size: 14px;">
  <p style="font-size: 14px; color: #1f2937;">${greeting}</p>
  <div style="font-size: 14px; color: #1f2937; white-space: pre-line; margin-top: 16px;">${escapeHtml(body)}</div>${ctaBlock}${sigBlock}
  <div style="margin-top: 40px; text-align: center; font-size: 11px; color: #9ca3af;">
    <span style="color: #D4AF37;">DeepMindQ</span> &middot; AI-Powered Outreach
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}