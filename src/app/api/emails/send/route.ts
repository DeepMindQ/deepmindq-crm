import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { checkApiAuth } from '@/lib/api-auth'
import { apiError, apiSuccess, validateBody } from '@/lib/apiHelpers'
import { sendEmail, type SendEmailResult } from '@/lib/email-provider'
import { registerTrackingEvent, signTrackingEventId } from '@/lib/email-tracking'
import { publishSSEEvent } from '@/lib/redis-pubsub'
import { logAction } from '@/lib/audit'
import { emailSendRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger';
import { withApiLogging } from '@/lib/api-logging-middleware';

// ── Validation ───────────────────────────────────────────────────────

const sendDirectSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
  contactId: z.string().optional(),
})

const sendDraftSchema = z.object({
  draftId: z.string().min(1),
})

const sendSchema = z.union([sendDirectSchema, sendDraftSchema])

// ── Helpers ──────────────────────────────────────────────────────────

/** Generate a unique event ID for email tracking. */
function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

/** Build the tracking pixel <img> tag. */
function buildTrackingPixel(eventId: string, origin: string): string {
  const url = `${origin}/api/emails/track?eid=${encodeURIComponent(eventId)}&type=open`
  return `\n<img src="${url}" width="1" height="1" alt="" style="display:none" />`
}

/**
 * Rewrite href attributes in anchor tags so clicks are routed through
 * the tracking endpoint.
 */
function injectClickTracking(html: string, eventId: string, origin: string): string {
  const trackPrefix = `${origin}/api/emails/track?eid=${encodeURIComponent(eventId)}&type=click&url=`
  return html.replace(
    /href="([^"]+)"/g,
    (_match: string, url: string) => {
      // Skip anchor links, mailto, and already-tracked links
      if (url.startsWith('#') || url.startsWith('mailto:') || url.startsWith(trackPrefix)) {
        return `href="${url}"`
      }
      return `href="${trackPrefix}${encodeURIComponent(url)}"`
    },
  )
}

// ── POST handler ─────────────────────────────────────────────────────

async function emailSendHandler(request: NextRequest) {
  // Auth gate: authenticated users only for email sending
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  // Rate limit: 50 emails per hour per user
  const rl = emailSendRateLimit(session!.id);
  if (!rl.success) {
    return apiError('Email sending rate limit exceeded. Please try again later.', 429);
  }

  try {
    const body = await request.json()
    const parsed = validateBody(sendSchema, body)
    if (parsed instanceof Response) return parsed

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || ''

    // ── Resolve email fields ───────────────────────────────────
    let to: string
    let subject: string
    let htmlBody: string
    let contactId: string | undefined
    let draftId: string | undefined

    if ('draftId' in parsed) {
      // Sending from an existing draft
      draftId = parsed.draftId
      const draft = await db.draft.findUnique({
        where: { id: draftId },
        include: { contact: true },
      })
      if (!draft) return apiError('Draft not found', 404)

      if (!draft.contact.email) {
        return apiError('Contact has no email address', 400)
      }

      to = draft.contact.email
      subject = draft.subject
      htmlBody = draft.body
      contactId = draft.contactId
    } else {
      // Direct send
      to = parsed.to
      subject = parsed.subject
      htmlBody = parsed.body
      contactId = parsed.contactId
    }

    // ── Inject tracking ────────────────────────────────────────
    const rawEventId = generateEventId()
    const signedEid = signTrackingEventId(rawEventId)
    const trackedHtml = injectClickTracking(htmlBody, signedEid, origin) + buildTrackingPixel(signedEid, origin)

    // Register the tracking event so the track endpoint can look it up
    if (contactId && draftId) {
      registerTrackingEvent(rawEventId, contactId, draftId)
    }

    // ── Send email ─────────────────────────────────────────────
    const result: SendEmailResult = await sendEmail({
      to,
      subject,
      html: trackedHtml,
    })

    if (!result.success) {
      return apiError(result.error || 'Email send failed', 500)
    }

    // ── Update draft status ────────────────────────────────────
    if (draftId) {
      await db.draft.update({
        where: { id: draftId },
        data: { status: 'sent', updatedAt: new Date() },
      })
    }

    // ── Update contact lastContactedAt ─────────────────────────
    if (contactId) {
      await db.contact.update({
        where: { id: contactId },
        data: { lastContactedAt: new Date() },
      })
    }

    // ── Create timeline entry ──────────────────────────────────
    let companyId: string | undefined
    if (contactId) {
      const contact = await db.contact.findUnique({ where: { id: contactId }, select: { companyId: true } })
      companyId = contact?.companyId ?? undefined
    }

    await db.companyTimelineEvent.create({
      data: {
        companyId: companyId ?? '',
        eventType: 'email_generated',
        title: 'Email sent',
        description: `Email sent to ${to} — Subject: "${subject}"`,
        metadata: contactId ? JSON.stringify({ contactId }) : undefined,
      },
    })

    // ── Create notification via audit log ──────────────────────
    const notificationDetails = {
      title: 'Email Sent',
      message: `Email "${subject}" was sent to ${to}`,
      type: 'success',
      link: contactId ? `/contacts/${contactId}` : null,
    }

    const auditEntry = await db.auditLog.create({
      data: {
        action: 'email_sent',
        entity: 'Email',
        userId: session!.id,
        details: JSON.stringify(notificationDetails),
      },
    })

    // Emit via Redis-backed pub/sub for cross-instance SSE delivery
    await publishSSEEvent('notification', {
      id: auditEntry.id,
      title: notificationDetails.title,
      message: notificationDetails.message,
      type: notificationDetails.type,
      link: notificationDetails.link,
      createdAt: auditEntry.createdAt.toISOString(),
    })

    await logAction('email_sent', 'Email', auditEntry.id, {
      to,
      subject,
      contactId: contactId ?? null,
      draftId: draftId ?? null,
    }, session!.id)

    return apiSuccess({
      success: true,
      messageId: result.providerId,
      eventId: signedEid,
      to,
      subject,
    })
  } catch (error) {
    logger.error('[EmailSend] Error:', { error: error })
    return apiError('Failed to send email', 500)
  }
}

export const POST = withApiLogging(emailSendHandler, '/api/emails/send');
