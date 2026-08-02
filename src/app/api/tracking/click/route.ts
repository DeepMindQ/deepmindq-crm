import { db } from '@/lib/db';
import { verifyQueueId } from '@/lib/email-tracking';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

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

  // Validate target URL — block javascript:, data:, and non-http(s) protocols
  if (targetUrl !== '/') {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return NextResponse.redirect('/', 302); // Invalid URL, redirect to home
    }
    const safeProtocol = parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    const safePath = !parsedUrl.pathname.startsWith('//');
    if (!safeProtocol || !safePath) {
      return NextResponse.redirect('/', 302); // Unsafe URL, redirect to home
    }
  }

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
    logger.error('Click tracking error:', { error: err });
  }

  // Redirect to home — never to user-provided URL to prevent open redirects
  return NextResponse.redirect('/', 302);
}