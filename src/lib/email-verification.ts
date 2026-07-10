import dns from 'node:dns/promises'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmailValidationResult {
  syntaxOk: boolean
  domainOk: boolean
  mxOk: boolean | null
  disposableOk: boolean
  spfOk: boolean | null
  dmarcOk: boolean | null
  tldScore: number
  score: number
  status: 'valid' | 'risky' | 'invalid'
  recommendation: string
}

interface CheckInputs {
  syntaxOk: boolean
  domainOk: boolean
  mxOk: boolean | null
  disposableOk: boolean
  spfOk: boolean | null
  dmarcOk: boolean | null
  tldScore: number
}

// ---------------------------------------------------------------------------
// Disposable domain list (50+ entries)
// ---------------------------------------------------------------------------

const DISPOSABLE_DOMAINS: string[] = [
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamailblock.com',
  'grr.la',
  'tempmail.com',
  'throwaway.email',
  'yopmail.com',
  'sharklasers.com',
  'dispostable.com',
  'trashmail.com',
  'tempmailaddress.com',
  '10minutemail.com',
  'maildrop.cc',
  'mailnesia.com',
  'mailsac.com',
  'mintemail.com',
  'tempr.email',
  'tempail.com',
  'fakeinbox.com',
  'tempinbox.com',
  'burnermail.io',
  'discard.email',
  'emailondeck.com',
  'filzmail.com',
  'getnmail.com',
  'incognitomail.org',
  'mailcatch.com',
  'mailexpire.com',
  'mailmoat.com',
  'mailnull.com',
  'mailshell.com',
  'mailzilla.org',
  'mohmal.com',
  'mytemp.email',
  'nada.email',
  'no-spam.ws',
  'nospamfor.us',
  'objectmail.com',
  'onewaymail.com',
  'ospam.net',
  'quickemail.info',
  'rcpt.at',
  'recode.me',
  'regbypass.com',
  'safetymail.info',
  'safetypost.de',
  's0ny.net',
  'spamavert.com',
  'spamgourmet.com',
  'spambox.us',
  'tempmail.io',
  'throwam.com',
  'tmpmail.net',
  'tmpmail.org',
  'trashymail.com',
  'wegwerfmail.de',
  'yopmail.fr',
  'yopmail.net',
  'jetable.org',
  'mailscrap.com',
  'guerrillamail.info',
  'guerrillamail.net',
  'guerrillamail.org',
  'disposableemailaddresses.emailmiser.com',
  'mailinator.org',
  'mailinator2.com',
  'notmailinator.com',
  'mailinater.com',
  'mailinator.net',
]

// ---------------------------------------------------------------------------
// TLD trust scoring
// ---------------------------------------------------------------------------

const HIGH_TRUST_TLDS = new Set([
  'com', 'org', 'net', 'edu', 'gov', 'mil', 'int', 'io', 'co',
])

const MEDIUM_TRUST_TLDS = new Set([
  'ai', 'dev', 'app', 'me', 'info', 'biz', 'name', 'pro', 'xyz',
  'tv', 'us', 'uk', 'ca', 'au', 'de', 'fr', 'jp', 'cn', 'in',
  'br', 'eu', 'nl', 'ch', 'se', 'no', 'dk', 'fi', 'it', 'es',
  'pt', 'pl', 'cz', 'kr', 'tw', 'hk', 'sg', 'nz', 'ie', 'be',
  'at', 'ru', 'za', 'mx', 'ar', 'cl', 'tech', 'cloud', 'site',
])

// ---------------------------------------------------------------------------
// Core checks
// ---------------------------------------------------------------------------

/**
 * RFC-compliant email syntax check.
 * Matches the vast majority of valid RFC 5322 addresses while keeping
 * the regex maintainable.
 */
export function checkSyntax(email: string): boolean {
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(
    email,
  )
}

/** Extract the domain portion after '@' from an email address. */
export function extractDomain(email: string): string {
  return email.split('@')[1] || ''
}

/** Check whether the domain is a known disposable / temporary email provider. */
export function isDisposableDomain(domain: string): boolean {
  const lower = domain.toLowerCase()
  return DISPOSABLE_DOMAINS.some(
    (d) => lower === d || lower.endsWith('.' + d),
  )
}

/**
 * Real DNS MX record lookup with a 5-second timeout.
 * Returns `true` if MX records exist, `false` if none found,
 * and `null` on timeout / DNS error (unknown).
 */
export async function checkMxRecords(domain: string): Promise<boolean | null> {
  try {
    const records = await Promise.race([
      dns.resolveMx(domain),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('MX lookup timed out')), 5_000),
      ),
    ])
    return records.length > 0
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[email-verification] MX lookup failed for "${domain}": ${msg}`)
    return null
  }
}

/**
 * Check for a valid SPF (Sender Policy Framework) TXT record on the domain.
 * Returns `true` if a "v=spf1" record is found, `false` if not,
 * and `null` on timeout / DNS error.
 */
export async function checkSpfRecord(domain: string): Promise<boolean | null> {
  try {
    const records = await Promise.race([
      dns.resolveTxt(domain),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('SPF lookup timed out')), 5_000),
      ),
    ])
    // TXT records come back as string[][] — flatten and search
    const txtValues = records.map((r) => r.join(''))
    return txtValues.some((t) => t.startsWith('v=spf1'))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[email-verification] SPF lookup failed for "${domain}": ${msg}`)
    return null
  }
}

/**
 * Check for a valid DMARC record on the `_dmarc` subdomain.
 * Returns `true` if a "v=DMARC1" record is found, `false` if not,
 * and `null` on timeout / DNS error.
 */
export async function checkDmarcRecord(domain: string): Promise<boolean | null> {
  try {
    const records = await Promise.race([
      dns.resolveTxt(`_dmarc.${domain}`),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DMARC lookup timed out')), 5_000),
      ),
    ])
    const txtValues = records.map((r) => r.join(''))
    return txtValues.some((t) => t.toLowerCase().includes('v=dmarc1'))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[email-verification] DMARC lookup failed for "${domain}": ${msg}`)
    return null
  }
}

/**
 * Score the TLD portion of a domain based on reputation.
 * - High-trust TLDs (com, org, net, edu, gov, io, co) → 10
 * - Medium-trust TLDs → 6
 * - Everything else → 3
 */
export function getTldTrustScore(domain: string): number {
  const parts = domain.split('.')
  const tld = (parts[parts.length - 1] || '').toLowerCase()

  if (HIGH_TRUST_TLDS.has(tld)) return 10
  if (MEDIUM_TRUST_TLDS.has(tld)) return 6
  return 3
}

// ---------------------------------------------------------------------------
// Weighted scoring algorithm
// ---------------------------------------------------------------------------

/**
 * Calculate a 0–100 email quality score from individual check results.
 *
 * Weighting:
 *   - syntax   25 pts
 *   - domain   15 pts
 *   - MX       25 pts  (null → 0)
 *   - disposable 15 pts
 *   - SPF      10 pts  (null → 0)
 *   - DMARC    10 pts  (null → 0)
 *   - TLD bonus: tldScore (0–10) added on top (capped at 100)
 */
export function calculateEmailScore(checks: CheckInputs): {
  score: number
  status: string
  recommendation: string
  details: Record<string, boolean | number>
} {
  let score = 0

  if (checks.syntaxOk) score += 25
  if (checks.domainOk) score += 15
  if (checks.mxOk === true) score += 25
  if (checks.disposableOk) score += 15
  if (checks.spfOk === true) score += 10
  if (checks.dmarcOk === true) score += 10

  // Add TLD trust bonus
  score += checks.tldScore
  score = Math.min(score, 100)

  const status = score >= 80 ? 'valid' : score >= 50 ? 'risky' : 'invalid'

  const recommendation =
    status === 'valid'
      ? 'Email looks good for outreach'
      : status === 'risky'
        ? 'Consider verifying with a real-time validation service before sending'
        : 'Do not use this email for outreach'

  return {
    score,
    status,
    recommendation,
    details: {
      syntaxOk: checks.syntaxOk,
      domainOk: checks.domainOk,
      mxOk: checks.mxOk ?? 'unknown',
      disposableOk: checks.disposableOk,
      spfOk: checks.spfOk ?? 'unknown',
      dmarcOk: checks.dmarcOk ?? 'unknown',
      tldScore: checks.tldScore,
    },
  }
}

// ---------------------------------------------------------------------------
// Orchestrator — run all checks in parallel
// ---------------------------------------------------------------------------

/**
 * Validate a single email address with all checks running concurrently.
 * Returns a comprehensive `EmailValidationResult`.
 */
export async function validateEmail(email: string): Promise<EmailValidationResult> {
  // Synchronous checks
  const syntaxOk = checkSyntax(email)
  const domain = extractDomain(email)
  const domainParts = domain.split('.')
  const domainOk = domainParts.length >= 2 && domainParts.every((p) => p.length > 0)
  const disposableOk = !isDisposableDomain(domain)
  const tldScore = getTldTrustScore(domain)

  // Short-circuit: if syntax, domain, or disposable is bad, skip DNS lookups
  if (!syntaxOk || !domainOk || !disposableOk) {
    const { score, status, recommendation } = calculateEmailScore({
      syntaxOk,
      domainOk,
      mxOk: null,
      disposableOk,
      spfOk: null,
      dmarcOk: null,
      tldScore,
    })

    return {
      syntaxOk,
      domainOk,
      mxOk: null,
      disposableOk,
      spfOk: null,
      dmarcOk: null,
      tldScore,
      score,
      status: status as EmailValidationResult['status'],
      recommendation,
    }
  }

  // Run all DNS checks in parallel
  const [mxOk, spfOk, dmarcOk] = await Promise.all([
    checkMxRecords(domain),
    checkSpfRecord(domain),
    checkDmarcRecord(domain),
  ])

  const { score, status, recommendation } = calculateEmailScore({
    syntaxOk,
    domainOk,
    mxOk,
    disposableOk,
    spfOk,
    dmarcOk,
    tldScore,
  })

  return {
    syntaxOk,
    domainOk,
    mxOk,
    disposableOk,
    spfOk,
    dmarcOk,
    tldScore,
    score,
    status: status as EmailValidationResult['status'],
    recommendation,
  }
}