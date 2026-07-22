import { NextRequest, NextResponse } from 'next/server'
import { recordTrackingEvent } from '@/lib/email-tracking'
import { eventBus } from '@/lib/event-bus'

// ── 1×1 transparent GIF (base64) ────────────────────────────────────
const TRANSPARENT_GIF_BUFFER = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
)

// ── GET handler ──────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const eid = searchParams.get('eid')
  const type = searchParams.get('type') // 'open' | 'click'

  if (!eid || !type) {
    return new NextResponse('Bad request', { status: 400 })
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
      eventBus.emit('email_opened', {
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
      eventBus.emit('email_clicked', {
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
          return NextResponse.redirect(decoded, 302)
        }
      } catch {
        // fall through to error
      }
    }

    return new NextResponse('Invalid or missing redirect URL', { status: 400 })
  }

  return new NextResponse('Unknown tracking type', { status: 400 })
}