import { db } from '@/lib/db';
import { verifyQueueId } from '@/lib/email-tracking';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════
   GET /api/tracking/click?q=<signed_token>&url=<encoded_url>

   E-11: Records a "click" event, increments
   SendQueue.clickCount, then redirects (302) to
   the original URL.
   ═══════════════════════════════════════════════════ */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('q');
  const encodedUrl = searchParams.get('url');

  // If no token, just return error
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const queueId = verifyQueueId(token);
  const targetUrl = encodedUrl ? decodeURIComponent(encodedUrl) : '/';

  if (!queueId) {
    // Invalid token — still redirect but don't record
    return NextResponse.redirect(targetUrl, 302);
  }

  try {
    const queueItem = await db.sendQueue.findUnique({
      where: { id: queueId },
      include: { draft: { select: { contactId: true, id: true } } },
    });

    if (queueItem) {
      const contactId = queueItem.draft?.contactId;
      const draftId = queueItem.draft?.id;
      const userAgent = request.headers.get('user-agent') || 'unknown';

      const metadata = JSON.stringify({ url: targetUrl, userAgent });

      if (contactId) {
        await db.emailEvent.create({
          data: {
            queueId,
            contactId,
            draftId,
            eventType: 'click',
            metadata,
          },
        });
      }

      await db.sendQueue.update({
        where: { id: queueId },
        data: { clickCount: { increment: 1 } },
      });
    }
  } catch (err) {
    console.error('Click tracking error:', err);
  }

  // Always redirect to the target URL
  return NextResponse.redirect(targetUrl, 302);
}