import { db } from '@/lib/db';
import { verifyQueueId, TRACKING_PIXEL_GIF } from '@/lib/email-tracking';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════
   GET /api/tracking/open?q=<signed_token>

   E-11: Records an "open" event and increments
   SendQueue.openCount. Returns a 1x1 transparent GIF.
   ═══════════════════════════════════════════════════ */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('q');

  if (!token) {
    return new Response(TRACKING_PIXEL_GIF, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Content-Length': String(TRACKING_PIXEL_GIF.length),
      },
    });
  }

  const queueId = verifyQueueId(token);
  if (!queueId) {
    return new Response(TRACKING_PIXEL_GIF, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Content-Length': String(TRACKING_PIXEL_GIF.length),
      },
    });
  }

  try {
    // Look up queue item to get contact/draft info
    const queueItem = await db.sendQueue.findUnique({
      where: { id: queueId },
      include: { draft: { select: { contactId: true, id: true } } },
    });

    if (queueItem) {
      const contactId = queueItem.draft?.contactId;
      const draftId = queueItem.draft?.id;

      // Get user-agent from headers
      const userAgent = request.headers.get('user-agent') || 'unknown';
      const metadata = JSON.stringify({ userAgent });

      // Record the event
      if (contactId) {
        await db.emailEvent.create({
          data: {
            queueId,
            contactId,
            draftId,
            eventType: 'open',
            metadata,
          },
        });
      }

      // Increment open count
      await db.sendQueue.update({
        where: { id: queueId },
        data: { openCount: { increment: 1 } },
      });
    }
  } catch (err) {
    console.error('Open tracking error:', err);
  }

  // Always return the pixel, even on error
  return new Response(TRACKING_PIXEL_GIF, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Content-Length': String(TRACKING_PIXEL_GIF.length),
    },
  });
}