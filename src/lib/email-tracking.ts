import crypto from 'crypto';

/* ═══════════════════════════════════════════════════
   Email Tracking — Open & Click tracking utilities

   E-06: Message-ID generation
   E-11: Open pixel URLs, click link wrapping, HMAC signing
   ═══════════════════════════════════════════════════ */

const TRACKING_SECRET = process.env.TRACKING_SECRET || 'deepmindq-tracking-hmac-secret-2024';

/* ── E-06: Generate a unique Message-ID ── */
export function generateMessageId(): string {
  const uuid = crypto.randomUUID();
  const ts = Date.now().toString(36);
  return `<${uuid}-${ts}@deepmindq.com>`;
}

/* ── E-11: HMAC sign a queueId to prevent abuse ── */
export function signQueueId(queueId: string): string {
  const payload = `${queueId}:${Date.now()}`;
  const signature = crypto
    .createHmac('sha256', TRACKING_SECRET)
    .update(payload)
    .digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64url');
}

/* ── E-11: Verify and decode a signed token, returns queueId or null ── */
export function verifyQueueId(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const lastColonIdx = decoded.lastIndexOf(':');
    if (lastColonIdx === -1) return null;

    const signature = decoded.slice(lastColonIdx + 1);
    const payload = decoded.slice(0, lastColonIdx);

    const expected = crypto
      .createHmac('sha256', TRACKING_SECRET)
      .update(payload)
      .digest('hex');

    if (signature !== expected) return null;

    // Extract queueId (first part before ':')
    const queueId = payload.split(':')[0];
    return queueId;
  } catch {
    return null;
  }
}

/* ── E-11: Generate tracking pixel URL for open tracking ── */
export function generateTrackingPixelUrl(queueId: string): string {
  const token = signQueueId(queueId);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  return `${baseUrl}/api/tracking/open?q=${token}`;
}

/* ── E-11: Wrap all href links in HTML with click tracking ── */
export function wrapLinksWithTracking(html: string, queueId: string): string {
  const token = signQueueId(queueId);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';

  return html.replace(
    /href=(["'])(https?:\/\/[^"']+)\1/gi,
    (_, quote, url) => {
      const encodedUrl = encodeURIComponent(url);
      const trackingUrl = `${baseUrl}/api/tracking/click?q=${token}&url=${encodedUrl}`;
      return `href=${quote}${trackingUrl}${quote}`;
    }
  );
}

/* ── 1x1 transparent GIF (43 bytes) ── */
export const TRACKING_PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);