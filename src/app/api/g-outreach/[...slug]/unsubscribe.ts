import { db } from '@/lib/db';
import { verifyUnsubscribeToken } from '@/lib/unsubscribe';
import { NextRequest, NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════
   E-09: Unsubscribe Endpoint

   GET /api/unsubscribe?email=xxx&token=xxx

   Verifies the HMAC token, updates the contact's
   consent status, creates a Suppression record,
   and returns a branded HTML confirmation page.
   ═══════════════════════════════════════════════════ */

const COMPANY_NAME = process.env.COMPANY_NAME || 'DeepMindQ';
const BRAND_COLOR = 'var(--color-gold)';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderConfirmationHtml(email: string, success: boolean, error?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${success ? 'Unsubscribed' : 'Unsubscribe Error'} — ${COMPANY_NAME}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #0f0f11;
      color: #e5e7eb;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 48px 40px;
      max-width: 480px;
      width: 100%;
      text-align: center;
      backdrop-filter: blur(12px);
    }
    .icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 32px;
      ${success
        ? `background: rgba(34, 197, 94, 0.12); color: #22c55e;`
        : `background: rgba(239, 68, 68, 0.12); color: #ef4444;`
      }
    }
    h1 {
      font-size: 24px;
      font-weight: 600;
      color: #f9fafb;
      margin-bottom: 12px;
    }
    p {
      font-size: 15px;
      line-height: 1.6;
      color: #9ca3af;
      margin-bottom: 8px;
    }
    .email {
      color: ${BRAND_COLOR};
      font-weight: 500;
      word-break: break-all;
    }
    .divider {
      height: 1px;
      background: rgba(255, 255, 255, 0.06);
      margin: 24px 0;
    }
    .footer {
      font-size: 12px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${success ? '&#10003;' : '!'}</div>
    <h1>${success ? 'You&#39;ve been unsubscribed' : 'Unsubscribe Error'}</h1>
    ${success
      ? `<p>The email address <span class="email">${escapeHtml(email)}</span> has been removed from our mailing list. You will no longer receive outreach emails from ${escapeHtml(COMPANY_NAME)}.</p>`
      : `<p>${escapeHtml(error || 'We could not process your request. The link may have expired or is invalid.')}</p>`
    }
    <div class="divider"></div>
    <p class="footer">
      ${escapeHtml(COMPANY_NAME)} Outreach Platform<br>
      If you believe this was an error, please contact us.
    </p>
  </div>
</body>
</html>`;
}

function renderMissingParamsHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invalid Request — ${COMPANY_NAME}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #0f0f11;
      color: #e5e7eb;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 48px 40px;
      max-width: 480px;
      width: 100%;
      text-align: center;
    }
    h1 { font-size: 24px; font-weight: 600; color: #f9fafb; margin-bottom: 12px; }
    p { font-size: 15px; color: #9ca3af; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Invalid Unsubscribe Link</h1>
    <p>This unsubscribe link is incomplete or malformed. Please use the full link provided in the email you received.</p>
  </div>
</body>
</html>`;
}

/* ═══════════════════════════════════════════════════
   GET /api/unsubscribe?email=xxx&token=xxx
   ═══════════════════════════════════════════════════ */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  const token = searchParams.get('token');

  // Missing params
  if (!email || !token) {
    return new Response(renderMissingParamsHtml(), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return new Response(
      renderConfirmationHtml(email, false, 'The email address format is invalid.'),
      {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }

  // Verify token
  let tokenValid = false;
  try {
    tokenValid = verifyUnsubscribeToken(normalizedEmail, token);
  } catch {
    return new Response(
      renderConfirmationHtml(email, false, 'The verification token is invalid.'),
      {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }

  if (!tokenValid) {
    return new Response(
      renderConfirmationHtml(email, false, 'The unsubscribe link is invalid or has been tampered with.'),
      {
        status: 403,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }

  try {
    // Find contact by email
    const contact = await db.contact.findFirst({
      where: { email: normalizedEmail },
    });

    if (!contact) {
      return new Response(
        renderConfirmationHtml(email, false, 'We could not find your email address in our system. You may already be unsubscribed.'),
        {
          status: 404,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }
      );
    }

    // Update contact consent status
    await db.contact.update({
      where: { id: contact.id },
      data: {
        consentStatus: 'opted_out',
        isSuppressed: true,
        suppressionReason: 'unsubscribe',
      },
    });

    // Create suppression record (upsert to handle repeated clicks)
    await db.suppression.upsert({
      where: { contactId: contact.id },
      create: {
        contactId: contact.id,
        reason: 'unsubscribe',
        method: 'auto_webhook',
      },
      update: {
        reason: 'unsubscribe',
        method: 'auto_webhook',
      },
    });

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          action: 'unsubscribe',
          entity: 'Contact',
          entityId: contact.id,
          details: `Contact unsubscribed via link: ${normalizedEmail}`,
        },
      });
    } catch (e) {
      console.warn('[Unsubscribe] Audit log failed:', e);
    }

    return new Response(
      renderConfirmationHtml(normalizedEmail, true),
      {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  } catch (error) {
    console.error('[Unsubscribe] Error processing unsubscribe:', error);
    return new Response(
      renderConfirmationHtml(email, false, 'An internal error occurred. Please try again later or contact us directly.'),
      {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }
}

// POST for programmatic unsubscribe (same logic, JSON response)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, token } = body;

    if (!email || !token) {
      return NextResponse.json({ error: 'Missing email or token' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    let tokenValid = false;
    try {
      tokenValid = verifyUnsubscribeToken(normalizedEmail, token);
    } catch {
      return NextResponse.json({ error: 'Invalid token format' }, { status: 400 });
    }

    if (!tokenValid) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
    }

    const contact = await db.contact.findFirst({
      where: { email: normalizedEmail },
    });

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found', unsubscribed: true }, { status: 404 });
    }

    await db.contact.update({
      where: { id: contact.id },
      data: {
        consentStatus: 'opted_out',
        isSuppressed: true,
        suppressionReason: 'unsubscribe',
      },
    });

    await db.suppression.upsert({
      where: { contactId: contact.id },
      create: { contactId: contact.id, reason: 'unsubscribe', method: 'auto_webhook' },
      update: { reason: 'unsubscribe', method: 'auto_webhook' },
    });

    try {
      await db.auditLog.create({
        data: {
          action: 'unsubscribe',
          entity: 'Contact',
          entityId: contact.id,
          details: `Programmatic unsubscribe: ${normalizedEmail}`,
        },
      });
    } catch { /* ignore */ }

    return NextResponse.json({ success: true, email: normalizedEmail });
  } catch (error) {
    console.error('[Unsubscribe] POST error:', error);
    return NextResponse.json({ error: 'Unsubscribe failed' }, { status: 500 });
  }
}