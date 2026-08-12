import { NextRequest, NextResponse } from 'next/server'
import { recordTrackingEvent, verifyTrackingEventId } from '@/lib/email-tracking'
import { publishSSEEvent } from '@/lib/redis-pubsub'
import { withApiLogging } from '@/lib/api-logging-middleware'

// ── 1×1 transparent GIF (base64) ────────────────────────────────────
const TRANSPARENT_GIF_BUFFER = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
)

// ── GET handler ──────────────────────────────────────────────────────

async function trackHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const eidToken = searchParams.get('eid')
  const type = searchParams.get('type') // 'open' | 'click'

  if (!eidToken || !type) {
    return new NextResponse('Bad request', { status: 400 })
  }

  // ── Verify HMAC signature before processing ──
  const eid = verifyTrackingEventId(eidToken);
  if (!eid) {
    // Invalid or forged token — return pixel silently to avoid info leak
    return new NextResponse(TRANSPARENT_GIF_BUFFER, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Content-Length': String(TRANSPARENT_GIF_BUFFER.length),
      },
    });
  }

  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  const ua = request.headers.get('user-agent') || 'unknown'

  // ── Open tracking ───────────────────────────────────────────
  if (type === 'open') {
    const record = recordTrackingEvent(eid, {
      type: 'open',
      timestamp: new Date(),
      ip,
      userAgent: ua,
    })

    if (record) {
      // Use Redis-backed pub/sub for cross-instance SSE delivery
      publishSSEEvent('email_opened', {
        eventId: eid,
        contactId: record.contactId,
        draftId: record.draftId,
        timestamp: new Date().toISOString(),
      })
    }

    return new NextResponse(TRANSPARENT_GIF_BUFFER, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Content-Length': String(TRANSPARENT_GIF_BUFFER.length),
      },
    })
  }

  // ── Click tracking ──────────────────────────────────────────
  if (type === 'click') {
    const targetUrl = searchParams.get('url')

    const record = recordTrackingEvent(eid, {
      type: 'click',
      timestamp: new Date(),
      ip,
      userAgent: ua,
      targetUrl: targetUrl || undefined,
    })

    if (record) {
      // Use Redis-backed pub/sub for cross-instance SSE delivery
      publishSSEEvent('email_clicked', {
        eventId: eid,
        contactId: record.contactId,
        draftId: record.draftId,
        targetUrl: targetUrl || null,
        timestamp: new Date().toISOString(),
      })
    }

    // Redirect to the original URL
    if (targetUrl) {
      try {
        const decoded = decodeURIComponent(targetUrl)
        // Basic validation — only allow http/https
        if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
          const parsed = new URL(decoded)
          if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
            return NextResponse.redirect(decoded, 302)
          }
        }
      } catch {
        // fall through to fallback
      }
    }

    // Fallback: redirect to home instead of exposing the URL
    return NextResponse.redirect('/', 302)
  }

  return new NextResponse('Unknown tracking type', { status: 400 })
}

export const GET = withApiLogging(trackHandler, '/api/emails/track');
