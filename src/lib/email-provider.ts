/* ═══════════════════════════════════════════════════
   Email Provider Abstraction Layer (E-01)

   Supports: Resend, SendGrid, SES, Postmark
   Config via env vars or /api/settings:
     EMAIL_PROVIDER  - "resend" | "sendgrid" | "ses" | "postmark"
     EMAIL_API_KEY   - Provider API key
     EMAIL_FROM      - Default from address
   ═══════════════════════════════════════════════════ */

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  messageId?: string;
  references?: string;
}

export interface SendEmailResult {
  success: boolean;
  providerId?: string;
  error?: string;
  provider: string;
}

type ProviderType = 'resend' | 'sendgrid' | 'ses' | 'postmark';

function getProviderConfig(): {
  provider: ProviderType;
  apiKey: string;
  from: string;
} {
  const provider = (process.env.EMAIL_PROVIDER || 'resend') as ProviderType;
  const apiKey = process.env.EMAIL_API_KEY || '';
  const from = process.env.EMAIL_FROM || 'onboarding@resend.dev';
  return { provider, apiKey, from };
}

/* ── Resend Implementation ── */
async function sendViaResend(
  params: SendEmailParams,
  apiKey: string,
  from: string,
): Promise<SendEmailResult> {
  try {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
    if (params.messageId) headers['X-Message-Id'] = params.messageId;
    if (params.references) headers['References'] = params.references;

    const body: Record<string, unknown> = {
      from: params.from || from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    };
    if (params.replyTo) body['reply_to'] = params.replyTo;
    if (params.messageId) body['headers'] = {
      'Message-ID': params.messageId,
      ...(params.references ? { 'References': params.references } : {}),
    };

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        provider: 'resend',
        error: data?.message || data?.error?.message || `HTTP ${res.status}`,
      };
    }

    return {
      success: true,
      providerId: data.id,
      provider: 'resend',
    };
  } catch (err) {
    return {
      success: false,
      provider: 'resend',
      error: err instanceof Error ? err.message : 'Unknown Resend error',
    };
  }
}

/* ── SendGrid Implementation ── */
async function sendViaSendGrid(
  params: SendEmailParams,
  apiKey: string,
  from: string,
): Promise<SendEmailResult> {
  try {
    const body: Record<string, unknown> = {
      personalizations: [{ to: [{ email: params.to }] }],
      from: { email: params.from || from },
      subject: params.subject,
      content: [{ type: 'text/html', value: params.html }],
    };
    if (params.replyTo) body['reply_to_list'] = [{ email: params.replyTo }];

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const msgId = res.headers.get('X-Message-Id');

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        success: false,
        provider: 'sendgrid',
        error: errText || `HTTP ${res.status}`,
      };
    }

    return {
      success: true,
      providerId: msgId || undefined,
      provider: 'sendgrid',
    };
  } catch (err) {
    return {
      success: false,
      provider: 'sendgrid',
      error: err instanceof Error ? err.message : 'Unknown SendGrid error',
    };
  }
}

/* ── Postmark Implementation ── */
async function sendViaPostmark(
  params: SendEmailParams,
  apiKey: string,
  from: string,
): Promise<SendEmailResult> {
  try {
    const body: Record<string, unknown> = {
      From: params.from || from,
      To: params.to,
      Subject: params.subject,
      HtmlBody: params.html,
    };
    if (params.replyTo) body['ReplyTo'] = params.replyTo;
    if (params.messageId) body['MessageID'] = params.messageId;

    const res = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'X-Postmark-Server-Token': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        provider: 'postmark',
        error: data?.Message || `HTTP ${res.status}`,
      };
    }

    return {
      success: true,
      providerId: data.MessageID,
      provider: 'postmark',
    };
  } catch (err) {
    return {
      success: false,
      provider: 'postmark',
      error: err instanceof Error ? err.message : 'Unknown Postmark error',
    };
  }
}

/* ── SES Implementation (stub — requires AWS SDK in production) ── */
async function sendViaSES(
  params: SendEmailParams,
  apiKey: string,
  from: string,
): Promise<SendEmailResult> {
  // SES requires AWS SDK with credential signing.
  // For this implementation, we use the SES v2 API via HTTP.
  // In production, use @aws-sdk/client-sesv2.
  return {
    success: false,
    provider: 'ses',
    error: 'SES requires AWS SDK integration. Use Resend for development.',
  };
}

/* ═══════════════════════════════════════════════════
   Main sendEmail function — dispatches to the
   configured provider.
   ═══════════════════════════════════════════════════ */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const config = getProviderConfig();

  if (!config.apiKey) {
    return {
      success: false,
      provider: config.provider,
      error: `No EMAIL_API_KEY configured for provider "${config.provider}". Set the environment variable or configure in Settings.`,
    };
  }

  switch (config.provider) {
    case 'resend':
      return sendViaResend(params, config.apiKey, config.from);
    case 'sendgrid':
      return sendViaSendGrid(params, config.apiKey, config.from);
    case 'postmark':
      return sendViaPostmark(params, config.apiKey, config.from);
    case 'ses':
      return sendViaSES(params, config.apiKey, config.from);
    default:
      return {
        success: false,
        provider: config.provider,
        error: `Unknown provider: ${config.provider}`,
      };
  }
}

/* ═══════════════════════════════════════════════════
   Get current provider info (for UI display)
   ═══════════════════════════════════════════════════ */
export function getProviderInfo(): {
  provider: string;
  from: string;
  configured: boolean;
} {
  const config = getProviderConfig();
  return {
    provider: config.provider,
    from: config.from,
    configured: !!config.apiKey,
  };
}