/* ═══════════════════════════════════════════════════
   Shared email verification utilities.
   Used by /api/verify-email and /api/batches (import flow).
   ═══════════════════════════════════════════════════ */

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com','guerrillamail.com','tempmail.com','throwaway.email',
  'yopmail.com','sharklasers.com','maildrop.cc','trashmail.com',
  'burnermail.io','tempmail.ninja','discard.email','spamgourmet.com',
  'tempail.com','trashymail.com','10minutemail.com','tempmailo.com',
  'minuteinbox.com','tempmail.plus','emailondeck.com','crazymailing.com',
  'inboxkitten.com','tempmail.io','mailsac.com','inboxalias.com',
  'mailcatch.com','mailexpire.com','mohmal.com','burpcollaborator.net',
  'harakirimail.com','filzmail.com','incognitomail.org','mailnull.com',
  'wegwerfmail.de','nomail.xl.cx','fakeinbox.com','mailnesia.com',
  'test.email','example.com','fake.com','none.com','null.com',
]);

const ROLE_PREFIXES = [
  'info@','sales@','marketing@','support@','help@','admin@',
  'contact@','team@','office@','hr@','jobs@','career@',
  'press@','media@','pr@','legal@','abuse@','noreply@',
  'no-reply@','postmaster@','webmaster@','root@',
  'newsletter@','news@','updates@','notifications@','notify@',
  'billing@','finance@','accounts@','orders@','service@','services@',
  'customerservice@','customercare@','enquiries@','inquiry@',
  'feedback@','hello@','hi@','ops@','devops@','it@','tech@',
];

const FREE_PROVIDERS = new Set([
  'gmail.com','yahoo.com','hotmail.com','outlook.com','live.com',
  'aol.com','icloud.com','mail.com','protonmail.com','proton.me',
  'zoho.com','yandex.com','qq.com','163.com','126.com',
  'rediff.com','inbox.com','fastmail.com','gmx.com','mail.ru',
]);

export function checkSyntax(email: string): { pass: boolean; detail: string } {
  if (!email || !email.includes('@')) return { pass: false, detail: 'Missing @' };
  const [local, domain] = email.split('@');
  if (!local || !domain) return { pass: false, detail: 'Empty local or domain' };
  if (local.length > 64) return { pass: false, detail: 'Local too long' };
  if (domain.length > 253) return { pass: false, detail: 'Domain too long' };
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..'))
    return { pass: false, detail: 'Invalid dot usage' };
  const regex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return { pass: regex.test(email), detail: regex.test(email) ? 'Valid syntax' : 'Invalid format' };
}

export function checkDisposable(email: string): { pass: boolean; detail: string } {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return { pass: false, detail: 'No domain' };
  if (DISPOSABLE_DOMAINS.has(domain)) return { pass: false, detail: `Disposable: ${domain}` };
  return { pass: true, detail: 'Not disposable' };
}

export function checkRoleBased(email: string): { pass: boolean; detail: string } {
  const lower = email.toLowerCase();
  for (const prefix of ROLE_PREFIXES) {
    if (lower.startsWith(prefix)) return { pass: false, detail: `Role-based: ${prefix}*` };
  }
  return { pass: true, detail: 'Not role-based' };
}

export function checkFreeProvider(email: string): { pass: boolean; detail: string; isFree: boolean } {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return { pass: true, detail: 'No domain', isFree: false };
  const isFree = FREE_PROVIDERS.has(domain);
  return { pass: true, detail: isFree ? `Free: ${domain}` : `Corporate: ${domain}`, isFree };
}

export function scoreEmail(email: string): { health: string; score: number; issues: string[] } {
  const syntax = checkSyntax(email);
  const disposable = checkDisposable(email);
  const roleBased = checkRoleBased(email);
  const free = checkFreeProvider(email);

  const issues: string[] = [];
  let score = 0;

  if (!syntax.pass) {
    return { health: 'invalid', score: 0, issues: [syntax.detail] };
  }
  score += 25;

  if (!disposable.pass) {
    issues.push(disposable.detail);
    score -= 40;
  } else {
    score += 10;
  }

  if (!roleBased.pass) {
    issues.push(roleBased.detail);
    score -= 15;
  } else {
    score += 10;
  }

  if (!free.isFree) {
    score += 15;
  }

  score = Math.max(0, Math.min(100, score));

  let health = 'valid';
  if (issues.length > 0 && score < 50) health = 'invalid';
  else if (issues.length > 0 || free.isFree) health = 'risky';

  return { health, score, issues };
}