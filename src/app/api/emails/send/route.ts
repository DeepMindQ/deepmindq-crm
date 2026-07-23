// @ts-nocheck
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { apiError, apiSuccess, validateBody } from '@/lib/apiHelpers'
import { sendEmail, type SendResult } from '@/lib/email-sender'
import { registerTrackingEvent } from '@/lib/email-tracking'
import { eventBus } from '@/lib/event-bus'

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
    (_, url: string) => {
      // Skip anchor links, mailto, and already-tracked links
      if (url.startsWith('#') || url.startsWith('mailto:') || url.startsWith(trackPrefix)) {
        return `href="${url}"`
      }
      return `href="${trackPrefix}${encodeURIComponent(url)}"`
    },
  )
}

// ── POST handler ─────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
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
    const eventId = generateEventId()
    const trackedHtml = injectClickTracking(htmlBody, eventId, origin) + buildTrackingPixel(eventId, origin)

    // Register the tracking event so the track endpoint can look it up
    if (contactId && draftId) {
      registerTrackingEvent(eventId, contactId, draftId)
    }

    // ── Send email ─────────────────────────────────────────────
    const result: SendResult = await sendEmail({
      to,
      subject,
      html: trackedHtml,
      text: htmlBody.replace(/<[^>]*>/g, ''),
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
        contactId: contactId ?? null,
        companyId: companyId ?? null,
        action: 'email_generated',
        details: `Email sent to ${to} — Subject: "${subject}"`,
      },
    })

    // ── Create notification ────────────────────────────────────
    // Find the first user to notify (single-user app)
    const user = await db.user.findFirst({ select: { id: true } })
    if (user) {
      const notification = await db.auditLog.create({
        data: {
          userId: user.id,
          title: 'Email Sent',
          message: `Email "${subject}" was sent to ${to}`,
          type: 'success',
          link: contactId ? `/contacts/${contactId}` : null,
        },
      })

      // Emit via event bus so SSE picks it up
      eventBus.emit('notification', {
        id: notification.id,
        userId: notification.userId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        read: notification.read,
        link: notification.link,
        createdAt: notification.createdAt.toISOString(),
      })
    }

    return apiSuccess({
      success: true,
      messageId: result.messageId,
      eventId,
      to,
      subject,
    })
  } catch (error) {
    console.error('[EmailSend] Error:', error)
    return apiError('Failed to send email', 500)
  }
}