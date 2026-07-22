import crypto from 'crypto';

/* ═══════════════════════════════════════════════════
   E-09: Unsubscribe Utilities

   Helper functions for generating unsubscribe URLs,
   appending unsubscribe footers to email HTML, and
   constructing List-Unsubscribe headers.
   ═══════════════════════════════════════════════════ */

const UNSUBSCRIBE_SECRET = (() => {
  if (!process.env.UNSUBSCRIBE_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('UNSUBSCRIBE_SECRET must be set in production environment');
    }
    return 'dev-only-unsafe-key';
  }
  return process.env.UNSUBSCRIBE_SECRET;
})();
const COMPANY_NAME = process.env.COMPANY_NAME || 'DeepMindQ';
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '';

/**
 * Generate a signed unsubscribe URL for a given email.
 * Token is SHA-256 of the email + secret, ensuring links
 * can't be forged or guessed.
 */
export function generateUnsubscribeUrl(email: string): string {
  const token = generateUnsubscribeToken(email);
  const params = new URLSearchParams({ email, token });
  return `${BASE_URL}/api/unsubscribe?${params.toString()}`;
}

/**
 * Generate the HMAC-SHA256 token for an email address.
 */
export function generateUnsubscribeToken(email: string): string {
  return crypto
    .createHmac('sha256', UNSUBSCRIBE_SECRET)
    .update(email.toLowerCase().trim())
    .digest('hex');
}

/**
 * Verify an unsubscribe token against an email.
 */
export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = generateUnsubscribeToken(email);
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(token, 'hex')
  );
}

/**
 * Append an unsubscribe footer to HTML email content.
 * Uses a simple, clean text block at the bottom.
 */
export function appendUnsubscribeFooter(html: string, email: string): string {
  const unsubscribeUrl = generateUnsubscribeUrl(email);
  const fromName = COMPANY_NAME;

  const footerBlock = `
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;line-height:1.5;">
  <p style="margin:0 0 4px 0;">You're receiving this because you're on ${fromName}'s outreach list.</p>
  <p style="margin:0;">
    <a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;" target="_blank">Unsubscribe</a>
    &nbsp;&middot;&nbsp;
    ${fromName}
  </p>
</div>`;

  // Append before closing </body> if present, otherwise at the end
  if (html.includes('</body>')) {
    return html.replace('</body>', `${footerBlock}\n</body>`);
  }

  return html + '\n' + footerBlock;
}

/**
 * Generate a List-Unsubscribe header value.
 * Supports both mailto: and http: formats per RFC 8058.
 */
export function generateListUnsubscribeHeader(email: string): string {
  const unsubscribeUrl = generateUnsubscribeUrl(email);
  // RFC 8058 format: List-Unsubscribe: <https://...>, <mailto:...>
  return `<${unsubscribeUrl}>, <mailto:unsubscribe@deepmindq.com?subject=Unsubscribe ${encodeURIComponent(email)}>`;
}

/**
 * Generate the List-Unsubscribe-Post header (RFC 8058).
 * "List-Unsubscribe: One-Click" indicates one-click unsubscribe support.
 */
export function generateListUnsubscribePostHeader(): string {
  return 'List-Unsubscribe-Post=One-Click';
}

/**
 * Get all compliance headers for an outgoing email.
 */
export function getComplianceHeaders(email: string): Record<string, string> {
  return {
    'List-Unsubscribe': generateListUnsubscribeHeader(email),
    'List-Unsubscribe-Post': generateListUnsubscribePostHeader(),
    'List-ID': `<outreach.${COMPANY_NAME.toLowerCase().replace(/\s+/g, '')}.com>`,
  };
}