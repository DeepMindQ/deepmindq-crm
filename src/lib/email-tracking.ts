import crypto from 'crypto';

/* ═══════════════════════════════════════════════════
   Email Tracking — Open & Click tracking utilities

   E-06: Message-ID generation
   E-11: Open pixel URLs, click link wrapping, HMAC signing
   ═══════════════════════════════════════════════════ */

const TRACKING_SECRET = process.env.TRACKING_SECRET;
if (!TRACKING_SECRET) {
  console.warn('[email-tracking] TRACKING_SECRET is not set. Email tracking signatures will be invalid.');
}

/* ── E-06: Generate a unique Message-ID ── */
export function generateMessageId(): string {
  const uuid = crypto.randomUUID();
  const ts = Date.now().toString(36);
  return `<${uuid}-${ts}@deepmindq.com>`;
}

/* ── E-11: HMAC sign a queueId to prevent abuse ── */
export function signQueueId(queueId: string): string {
  if (!TRACKING_SECRET) {
    throw new Error('TRACKING_SECRET is not configured — cannot sign tracking tokens');
  }
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

    if (!TRACKING_SECRET) return null;
    const expected = crypto
      .createHmac('sha256', TRACKING_SECRET)
      .update(payload)
      .digest('hex');

    if (signature.length !== expected.length) return null;
    let result = 0;
    for (let i = 0; i < signature.length; i++) {
      result |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    if (result !== 0) return null;

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

/* ── Legacy event tracking: HMAC-signed eid tokens ── */

/**
 * Sign an event ID with HMAC to prevent token fabrication.
 * Format: base64url(eventId:timestamp:hmac-sha256)
 * Reuses the same TRACKING_SECRET as E-11 tokens.
 */
export function signTrackingEventId(eventId: string): string {
  if (!TRACKING_SECRET) {
    throw new Error('TRACKING_SECRET is not configured — cannot sign tracking event IDs');
  }
  const payload = `${eventId}:${Date.now()}`;
  const signature = crypto
    .createHmac('sha256', TRACKING_SECRET)
    .update(payload)
    .digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64url');
}

/**\n * Verify and decode a signed tracking event ID.\n * Returns the original eventId or null if invalid.\n *\n * DESIGN NOTE — Token expiry:\n * The token embeds a timestamp but this function does NOT enforce expiry.\n * This is intentional: email clients re-fetch tracking pixels (preview panes,\n * multi-device opens) and tokens must remain valid for the lifetime of the\n * in-memory tracking registry (7 days, see TRACKING_TTL_MS).\n *\n * FUTURE ENHANCEMENT: Add configurable TTL check (e.g., reject tokens\n * older than TRACKING_TOKEN_TTL_MS = 30 days) to bound token lifetime\n * independently from registry expiry. Tracked as SH1-enhancement.\n */
export function verifyTrackingEventId(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const lastColonIdx = decoded.lastIndexOf(':');
    if (lastColonIdx === -1) return null;

    const signature = decoded.slice(lastColonIdx + 1);
    const payload = decoded.slice(0, lastColonIdx);

    if (!TRACKING_SECRET) return null;
    const expected = crypto
      .createHmac('sha256', TRACKING_SECRET)
      .update(payload)
      .digest('hex');

    // Constant-time comparison
    if (signature.length !== expected.length) return null;
    let result = 0;
    for (let i = 0; i < signature.length; i++) {
      result |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    if (result !== 0) return null;

    // Extract eventId (first part before ':')
    const eventId = payload.split(':')[0];
    return eventId;
  } catch {
    return null;
  }
}

/* ── Event registration: maps eventId → contactId/draftId ── */
interface TrackingRecord {
  eventId: string;
  contactId: string;
  draftId: string;
  createdAt: number;
}

// In-memory store for tracking event lookups (serverless-friendly, auto-expires)
const trackingRegistry = new Map<string, TrackingRecord>();
const TRACKING_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function registerTrackingEvent(eventId: string, contactId: string, draftId: string): void {
  // Purge expired entries before adding new one to bound memory
  purgeExpired();
  trackingRegistry.set(eventId, { eventId, contactId, draftId, createdAt: Date.now() });
}

export function recordTrackingEvent(
  eventId: string,
  payload: { type: 'open' | 'click'; timestamp: Date; ip: string; userAgent: string; targetUrl?: string }
): { contactId: string; draftId: string } | null {
  const record = trackingRegistry.get(eventId);
  if (!record) return null;
  // Expire old entries
  if (Date.now() - record.createdAt > TRACKING_TTL_MS) {
    trackingRegistry.delete(eventId);
    return null;
  }
  return { contactId: record.contactId, draftId: record.draftId };
}

// Periodically purge expired entries (called on registration to bound memory)
function purgeExpired(): void {
  const now = Date.now();
  for (const [key, record] of trackingRegistry) {
    if (now - record.createdAt > TRACKING_TTL_MS) {
      trackingRegistry.delete(key);
    }
  }
}

/* ── 1x1 transparent GIF (43 bytes) ── */
export const TRACKING_PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);