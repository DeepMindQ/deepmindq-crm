/**
 * Email Quality Intelligence Engine
 * ===================================
 * 5-level validation pipeline:
 *   Level 1: Syntax regex
 *   Level 2: Domain existence (DNS A record)
 *   Level 3: MX record validation
 *   Level 4: Disposable email detection (100+ domains)
 *   Level 5: Role/generic email detection (info@, sales@, etc.)
 *
 * Output: status, qualityScore (0-100), confidence, reasons, domain classification
 *
 * Used by: Import pipeline, Contact enrichment, Intelligence factory
 */

// ─── Types ──────────────────────────────────────────────────────────────

export interface EmailValidationResult {
  email: string;
  isValid: boolean;
  status: 'valid' | 'personal' | 'role' | 'disposable' | 'invalid' | 'risky';
  qualityScore: number;       // 0-100
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  domain: string;
  isDisposable: boolean;
  isRoleEmail: boolean;
  isPersonalEmail: boolean;
  mxRecordsFound: boolean;
  dnsValid: boolean;
}

// ─── Level 1: Syntax Validation ────────────────────────────────────────

const EMAIL_SYNTAX_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

function validateSyntax(email: string): boolean {
  return EMAIL_SYNTAX_REGEX.test(email);
}

// ─── Level 4: Disposable Email Domains (100+) ──────────────────────────

const DISPOSABLE_DOMAINS: Set<string> = new Set([
  // Major disposable providers
  'guerrillamail.com', 'mailinator.com', 'throwaway.email', 'yopmail.com',
  'tempmail.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la',
  'dispostable.com', 'harakirimail.com', 'maildrop.cc', 'mailnesia.com',
  'tempail.com', 'fakeinbox.com', '10minutemail.com', 'tempinbox.com',
  'trashmail.com', 'mailcatch.com', 'mailexpire.com', 'meltmail.com',
  'mytemp.email', 'nada.email', 'throwam.com', 'trashymail.com',
  'wegwerfmail.de', 'mailscrap.com', 'mailzilla.org', 'mt2015.com',
  'objectmail.com', 'proxymail.eu', 'rcpt.at', 'reallymymail.com',
  'recode.me', 'regbypass.com', 'rmqkr.net', 'royal.net', 'scbox.one',
  'selsate.net', 'spamavert.com', 'superrito.com', 'tempmailo.com',
  'thc.lol', 'tmpmail.net', 'trbvm.com', 'trash-email.com',
  'trash-mail.at', 'trashmail.de', 'trashmail.me', 'trashmail.org',
  'uggsrock.com', 'mailme.lv', 'emailfake.com', 'generator.email',
  'maildegisim.com', 'mailtemp.info', 'momentics.com', 'mytrashmail.com',
  'nomail.xl.cx', 'noreply1.com', 'spam4.me', 'tempmailaddress.com',
  'tempmaildemo.com', 'test123.com', 'ufacturi.com', 'viewcastmedia.com',
  'wetrainbayarea.com', 'yopmail.fr', 'jetable.org', 'mailforspam.com',
  'safetymail.info', 'filzmail.com', 'incognitomail.org', 'mailnull.com',
  'tempmail.nl', 'disposableemailaddresses.emailmiser.com', 'mailimate.com',
  'disposableaddress.com', 'emaillime.com', 'emailmiser.com',
  'guerrillamail.de', 'guerrillamail.net', 'spamgourmet.com',
  'inboxkitten.com', 'emailondeck.com', 'crazymailing.com',
  'temp-mail.org', 'temp-mail.io', 'cryptogmail.com', 'deadaddress.com',
  'dispostable.com', 'e4ward.com', 'emailigo.de', 'emailtemporario.com.br',
  'fakemailgenerator.com', 'getairmail.com', 'gishpuppy.com', 'guerrillamail.info',
  'hacccc.com', 'mailcatch.com', 'maileater.com', 'mailmoat.com',
  'mailshell.com', 'mailzilla.org', 'mohmal.com', 'motingza.com',
  'msa.minsmail.com', 'nobulk.com', 'nobuma.com', 'nowmymail.com',
  'objectmail.com', 'padilet.com', 'postonline.me', 'quickemail.com',
  'reallymymail.com', 'recvmail.com', 'rmqkr.net', 'royal.net',
  'scbox.one', 'selsate.net', 'sendspamhere.com', 'shipfromthis.com',
  'spam1.us', 'spamgourmet.com', 'spamherelots.com', 'spamobox.com',
  'suio.me', 'superstachel电子邮件.com', 'tempmailaddress.com',
  'tempmaildemo.com', 'trashymail.com', 'tyldd.com', 'uggsrock.com',
  'unknownsite.org', 'mailinater.com', 'messagebeamer.de',
]);

function isDisposableDomain(domain: string): boolean {
  if (DISPOSABLE_DOMAINS.has(domain)) return true;
  // Check parent domains (e.g., subdomain.mailinator.com)
  const parts = domain.split('.');
  for (let i = 1; i < parts.length; i++) {
    const parent = parts.slice(i).join('.');
    if (DISPOSABLE_DOMAINS.has(parent)) return true;
  }
  return false;
}

// ─── Level 5: Role/Generic Email Detection ────────────────────────────

const ROLE_EMAIL_LOCALS: Set<string> = new Set([
  'info', 'sales', 'support', 'hr', 'admin', 'office', 'contact',
  'hello', 'team', 'marketing', 'careers', 'jobs', 'recruiting',
  'help', 'service', 'customerservice', 'customer', 'feedback',
  'press', 'media', 'pr', 'comms', 'communications', 'ops',
  'operations', 'it', 'tech', 'security', 'legal', 'finance',
  'billing', 'accounts', 'reception', 'frontdesk', 'general',
  'enquiries', 'inquiries', 'questions', 'noreply', 'no-reply',
  'abuse', 'postmaster', 'webmaster', 'domain', 'newsletter',
  'unsubscribe', 'mailer', 'daemon', 'root', 'system', 'server',
  'administrator', 'test', 'testing', 'sample', 'example', 'demo',
  'null', 'void', 'dev', 'devnull', 'blackhole', 'trash',
]);

function isRoleEmail(localPart: string): boolean {
  return ROLE_EMAIL_LOCALS.has(localPart.toLowerCase());
}

// ─── Personal Email Domains ───────────────────────────────────────────

const PERSONAL_EMAIL_DOMAINS: Set<string> = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'yahoo.in',
  'hotmail.com', 'outlook.com', 'live.com', 'msn.com',
  'aol.com', 'icloud.com', 'me.com', 'mac.com',
  'protonmail.com', 'proton.me', 'tutanota.com', 'tuta.io',
  'mail.com', 'zoho.com', 'yandex.com', 'yandex.ru',
  'rediffmail.com', 'rediff.com',
  'inbox.com', 'gmx.com', 'gmx.net',
  'fastmail.com', 'fastmail.fm', 'hushmail.com',
  'mail.ru', 'rambler.ru', 'inbox.ru',
  'qq.com', '163.com', '126.com', 'sina.com', 'sohu.com',
  'web.de', 'gmx.de', 'mail.de',
  'att.net', 'sbcglobal.net', 'bellsouth.net', 'verizon.net',
  'comcast.net', 'earthlink.net',
]);

function isPersonalDomain(domain: string): boolean {
  return PERSONAL_EMAIL_DOMAINS.has(domain);
}

// ─── Main Validation Function ──────────────────────────────────────────

export async function validateEmail(email: string): Promise<EmailValidationResult> {
  const domain = email.split('@')[1]?.toLowerCase() || '';

  // ── Level 1: Syntax ──
  if (!email || !email.includes('@') || !validateSyntax(email)) {
    return {
      email,
      isValid: false,
      status: 'invalid',
      qualityScore: 0,
      confidence: 'high',
      reasons: ['Invalid email syntax'],
      domain,
      isDisposable: false,
      isRoleEmail: false,
      isPersonalEmail: false,
      mxRecordsFound: false,
      dnsValid: false,
    };
  }

  // ── Level 4: Disposable (check before DNS — saves time) ──
  if (isDisposableDomain(domain)) {
    return {
      email,
      isValid: false,
      status: 'disposable',
      qualityScore: 0,
      confidence: 'high',
      reasons: ['Disposable email provider detected — suppressed'],
      domain,
      isDisposable: true,
      isRoleEmail: false,
      isPersonalEmail: false,
      mxRecordsFound: false,
      dnsValid: false,
    };
  }

  // ── Level 5: Role/Generic email detection ──
  const localPart = email.split('@')[0]?.toLowerCase() || '';
  if (isRoleEmail(localPart)) {
    return {
      email,
      isValid: true,
      status: 'role',
      qualityScore: 30,
      confidence: 'high',
      reasons: ['Generic role mailbox (not an individual) — excluded from decision-maker scoring'],
      domain,
      isDisposable: false,
      isRoleEmail: true,
      isPersonalEmail: false,
      mxRecordsFound: false,
      dnsValid: false,
    };
  }

  // ── Personal email detection ──
  if (isPersonalDomain(domain)) {
    return {
      email,
      isValid: true,
      status: 'personal',
      qualityScore: 40,
      confidence: 'high',
      reasons: ['Personal email provider — not corporate domain'],
      domain,
      isDisposable: false,
      isRoleEmail: false,
      isPersonalEmail: true,
      mxRecordsFound: false,
      dnsValid: false,
    };
  }

  // ── Level 2+3: DNS + MX validation ──
  let dnsValid = false;
  let mxRecordsFound = false;

  try {
    const dns = await import('dns/promises');
    // Try MX records first (most reliable for email)
    const mxRecords = await dns.resolveMx(domain);
    if (mxRecords && mxRecords.length > 0) {
      mxRecordsFound = true;
      dnsValid = true;
    }
  } catch {
    // No MX records — try A record fallback
    try {
      const dns = await import('dns/promises');
      const aRecords = await dns.resolve4(domain);
      if (aRecords && aRecords.length > 0) {
        dnsValid = true;
        // Domain exists but no MX — probably has email but configured differently
      }
    } catch {
      // Domain doesn't resolve at all
    }
  }

  if (!dnsValid) {
    return {
      email,
      isValid: false,
      status: 'invalid',
      qualityScore: 5,
      confidence: 'high',
      reasons: ['Domain does not exist — no DNS records found'],
      domain,
      isDisposable: false,
      isRoleEmail: false,
      isPersonalEmail: false,
      mxRecordsFound: false,
      dnsValid: false,
    };
  }

  // ── Valid corporate email ──
  const qualityScore = mxRecordsFound ? 95 : 80;
  const reasons: string[] = ['Valid email syntax'];
  if (dnsValid) reasons.push('Domain verified');
  if (mxRecordsFound) reasons.push('MX records confirmed');

  return {
    email,
    isValid: true,
    status: 'valid',
    qualityScore,
    confidence: 'high',
    reasons,
    domain,
    isDisposable: false,
    isRoleEmail: false,
    isPersonalEmail: false,
    mxRecordsFound,
    dnsValid: true,
  };
}

// ─── Bulk Validation (for import pipeline) ─────────────────────────────

/**
 * Validate multiple emails in parallel chunks.
 * Processes 20 emails at a time to avoid DNS flood.
 */
export async function validateEmailsBulk(
  emails: string[],
): Promise<Map<string, EmailValidationResult>> {
  const results = new Map<string, EmailValidationResult>();
  const CHUNK = 20;

  for (let i = 0; i < emails.length; i += CHUNK) {
    const chunk = emails.slice(i, i + CHUNK).filter(Boolean);
    const chunkResults = await Promise.all(
      chunk.map(async (email) => {
        const result = await validateEmail(email);
        return [email, result] as const;
      }),
    );
    for (const [email, result] of chunkResults) {
      results.set(email, result);
    }
  }

  return results;
}

/**
 * Map validation result to Contact model fields.
 */
export function validationToContactFields(result: EmailValidationResult): {
  emailHealth: string;
  emailHealthScore: number;
  isSuppressed: boolean;
  suppressionReason: string | null;
} {
  switch (result.status) {
    case 'valid':
      return {
        emailHealth: 'valid',
        emailHealthScore: result.qualityScore,
        isSuppressed: false,
        suppressionReason: null,
      };
    case 'personal':
      return {
        emailHealth: 'risky',
        emailHealthScore: result.qualityScore,
        isSuppressed: false,
        suppressionReason: 'Personal email — not corporate',
      };
    case 'role':
      return {
        emailHealth: 'risky',
        emailHealthScore: result.qualityScore,
        isSuppressed: false,
        suppressionReason: 'Generic role mailbox — not individual',
      };
    case 'disposable':
      return {
        emailHealth: 'invalid',
        emailHealthScore: 0,
        isSuppressed: true,
        suppressionReason: 'Disposable email provider',
      };
    case 'invalid':
      return {
        emailHealth: 'invalid',
        emailHealthScore: result.qualityScore,
        isSuppressed: true,
        suppressionReason: result.reasons[0] || 'Invalid email',
      };
    default:
      return {
        emailHealth: 'unknown',
        emailHealthScore: 0,
        isSuppressed: false,
        suppressionReason: null,
      };
  }
}
