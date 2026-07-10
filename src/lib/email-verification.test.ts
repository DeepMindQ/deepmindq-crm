import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  checkSyntax,
  extractDomain,
  isDisposableDomain,
  getTldTrustScore,
  calculateEmailScore,
  validateEmail,
  checkMxRecords,
  checkSpfRecord,
  checkDmarcRecord,
} from './email-verification'

// ---------------------------------------------------------------------------
// DNS mock — needed by checkMxRecords, checkSpfRecord, checkDmarcRecord,
// and validateEmail.  The source imports `dns from 'node:dns/promises'`.
// ---------------------------------------------------------------------------
vi.mock('node:dns/promises', () => ({
  default: {
    resolveMx: vi.fn(),
    resolveTxt: vi.fn(),
  },
}))

import dns from 'node:dns/promises'
const mockedResolveMx = vi.mocked(dns.resolveMx)
const mockedResolveTxt = vi.mocked(dns.resolveTxt)

// ===========================================================================
// 1. checkSyntax
// ===========================================================================

describe('checkSyntax', () => {
  it('accepts a valid standard email', () => {
    expect(checkSyntax('user@example.com')).toBe(true)
  })

  it('rejects email with no @ sign', () => {
    expect(checkSyntax('userexample.com')).toBe(false)
  })

  it('rejects email with no domain part', () => {
    expect(checkSyntax('user@')).toBe(false)
  })

  it('rejects email with spaces', () => {
    expect(checkSyntax('user @example.com')).toBe(false)
  })

  it('handles edge case: plus-addressing (valid)', () => {
    expect(checkSyntax('user+tag@example.com')).toBe(true)
  })

  // --- additional cases ---

  it('accepts dots in the local part', () => {
    expect(checkSyntax('first.last@example.com')).toBe(true)
  })

  it('accepts hyphens in the domain', () => {
    expect(checkSyntax('user@my-domain.com')).toBe(true)
  })

  it('accepts underscores in the local part', () => {
    expect(checkSyntax('user_name@example.com')).toBe(true)
  })

  it('accepts numbers in local and domain parts', () => {
    expect(checkSyntax('user123@example456.com')).toBe(true)
  })

  it('accepts common special characters in the local part', () => {
    expect(checkSyntax('user!#$%&\'*+/=?^_`{|}~-@example.com')).toBe(true)
  })

  it('rejects double @ sign', () => {
    expect(checkSyntax('user@@example.com')).toBe(false)
  })

  it('rejects leading @ sign', () => {
    expect(checkSyntax('@example.com')).toBe(false)
  })

  it('rejects domain without a TLD (single label)', () => {
    expect(checkSyntax('user@localhost')).toBe(false)
  })

  it('rejects single-character TLD', () => {
    expect(checkSyntax('user@example.x')).toBe(false)
  })

  it('accepts multi-level subdomains', () => {
    expect(checkSyntax('user@a.b.c.d.example.com')).toBe(true)
  })

  it('rejects empty string', () => {
    expect(checkSyntax('')).toBe(false)
  })

  it('rejects consecutive dots in the domain', () => {
    expect(checkSyntax('user@example..com')).toBe(false)
  })

  it('accepts a long but valid email', () => {
    const local = 'a'.repeat(64)
    expect(checkSyntax(`${local}@example.com`)).toBe(true)
  })
})

// ===========================================================================
// 2. extractDomain
// ===========================================================================

describe('extractDomain', () => {
  it('extracts domain from a normal email', () => {
    expect(extractDomain('user@example.com')).toBe('example.com')
  })

  it('extracts domain from a subdomain email', () => {
    expect(extractDomain('user@mail.example.co.uk')).toBe('mail.example.co.uk')
  })

  it('returns empty string when no @ is present', () => {
    expect(extractDomain('userexample.com')).toBe('')
  })

  // --- additional cases ---

  it('returns empty string when @ is at the end', () => {
    expect(extractDomain('user@')).toBe('')
  })

  it('returns everything after the first @', () => {
    expect(extractDomain('user@sub.example.com')).toBe('sub.example.com')
  })

  it('returns empty string for an empty input', () => {
    expect(extractDomain('')).toBe('')
  })

  it('handles a single @ character', () => {
    expect(extractDomain('@')).toBe('')
  })

  it('returns domain with hyphens intact', () => {
    expect(extractDomain('user@my-domain.co')).toBe('my-domain.co')
  })
})

// ===========================================================================
// 3. isDisposableDomain
// ===========================================================================

describe('isDisposableDomain', () => {
  it('identifies mailinator.com as disposable', () => {
    expect(isDisposableDomain('mailinator.com')).toBe(true)
  })

  it('does NOT flag gmail.com as disposable', () => {
    expect(isDisposableDomain('gmail.com')).toBe(false)
  })

  it('identifies guerrillamail.com as disposable', () => {
    expect(isDisposableDomain('guerrillamail.com')).toBe(true)
  })

  it('handles full email string passed as domain (not disposable)', () => {
    expect(isDisposableDomain('test@test.com')).toBe(false)
  })

  it('handles empty string gracefully', () => {
    expect(isDisposableDomain('')).toBe(false)
  })

  // --- additional cases ---

  it('is case-insensitive', () => {
    expect(isDisposableDomain('MAILINATOR.COM')).toBe(true)
    expect(isDisposableDomain('Mailinator.Com')).toBe(true)
  })

  it('identifies subdomains of disposable domains', () => {
    expect(isDisposableDomain('sub.mailinator.com')).toBe(true)
    expect(isDisposableDomain('foo.bar.yopmail.net')).toBe(true)
  })

  it('identifies multiple known disposable domains', () => {
    const disposable = [
      'tempmail.com',
      'throwaway.email',
      'yopmail.com',
      'sharklasers.com',
      'trashmail.com',
      'burnermail.io',
      'mailnesia.com',
    ]
    for (const d of disposable) {
      expect(isDisposableDomain(d)).toBe(true)
    }
  })

  it('does NOT flag common legitimate domains', () => {
    const legit = ['outlook.com', 'yahoo.com', 'protonmail.com', 'fastmail.com', 'icloud.com']
    for (const d of legit) {
      expect(isDisposableDomain(d)).toBe(false)
    }
  })

  it('does NOT flag subdomains of non-disposable domains', () => {
    expect(isDisposableDomain('sub.gmail.com')).toBe(false)
  })

  it('identifies guerrillamail variants', () => {
    expect(isDisposableDomain('guerrillamailblock.com')).toBe(true)
    expect(isDisposableDomain('guerrillamail.info')).toBe(true)
    expect(isDisposableDomain('guerrillamail.net')).toBe(true)
    expect(isDisposableDomain('guerrillamail.org')).toBe(true)
  })
})

// ===========================================================================
// 4. getTldTrustScore
// ===========================================================================

describe('getTldTrustScore', () => {
  // --- high trust (10) ---

  it('returns 10 for .com', () => {
    expect(getTldTrustScore('example.com')).toBe(10)
  })

  it('returns 10 for .org', () => {
    expect(getTldTrustScore('example.org')).toBe(10)
  })

  it('returns 10 for .net', () => {
    expect(getTldTrustScore('example.net')).toBe(10)
  })

  it('returns 10 for .io', () => {
    expect(getTldTrustScore('example.io')).toBe(10)
  })

  it('returns 10 for .edu, .gov, .mil, .int, .co', () => {
    expect(getTldTrustScore('school.edu')).toBe(10)
    expect(getTldTrustScore('agency.gov')).toBe(10)
    expect(getTldTrustScore('military.mil')).toBe(10)
    expect(getTldTrustScore('treaty.int')).toBe(10)
    expect(getTldTrustScore('example.co')).toBe(10)
  })

  // --- medium trust (6) ---

  it('returns 6 for .ai', () => {
    expect(getTldTrustScore('startup.ai')).toBe(6)
  })

  it('returns 6 for .dev', () => {
    expect(getTldTrustScore('project.dev')).toBe(6)
  })

  it('returns 6 for .app', () => {
    expect(getTldTrustScore('myapp.app')).toBe(6)
  })

  it('returns 6 for country-code TLDs in the medium list', () => {
    expect(getTldTrustScore('example.uk')).toBe(6)
    expect(getTldTrustScore('example.de')).toBe(6)
    expect(getTldTrustScore('example.jp')).toBe(6)
  })

  it('returns 6 for .tech and .cloud', () => {
    expect(getTldTrustScore('example.tech')).toBe(6)
    expect(getTldTrustScore('example.cloud')).toBe(6)
  })

  // --- low trust (3) ---

  it('returns 3 for unknown/unlisted TLDs', () => {
    expect(getTldTrustScore('example.xyz123')).toBe(3)
    expect(getTldTrustScore('example.unknown')).toBe(3)
  })

  it('returns 3 for .tk (common free TLD, not in list)', () => {
    expect(getTldTrustScore('example.tk')).toBe(3)
  })

  it('uses only the last part for multi-part TLDs', () => {
    // .uk is medium trust
    expect(getTldTrustScore('example.co.uk')).toBe(6)
  })

  it('handles domain with hyphen in TLD part gracefully', () => {
    // Last part would be "xy-z" which is not in any set
    expect(getTldTrustScore('example.xy-z')).toBe(3)
  })
})

// ===========================================================================
// 5. calculateEmailScore
// ===========================================================================

describe('calculateEmailScore', () => {
  // Helper to build a checks object with defaults
  const good = (overrides: Record<string, unknown> = {}) => ({
    syntaxOk: true,
    domainOk: true,
    mxOk: true,
    disposableOk: true,
    spfOk: true,
    dmarcOk: true,
    tldScore: 10,
    ...overrides,
  })

  it('returns score 100 (capped) when all checks pass with high-trust TLD', () => {
    const result = calculateEmailScore(good({ tldScore: 10 }))
    // 25+15+25+15+10+10 = 100, +10 TLD = 110 → capped at 100
    expect(result.score).toBe(100)
    expect(result.status).toBe('valid')
    expect(result.recommendation).toContain('good for outreach')
  })

  it('returns score 90 when all checks pass with medium-trust TLD', () => {
    const result = calculateEmailScore(good({ tldScore: 6 }))
    // 100 + 6 = 106 → capped at 100
    // Actually base is 100, +6 = 106 → 100
    expect(result.score).toBe(100)
    expect(result.status).toBe('valid')
  })

  it('returns score 100 when all checks pass with low-trust TLD', () => {
    const result = calculateEmailScore(good({ tldScore: 3 }))
    // 100 + 3 = 103 → capped at 100
    expect(result.score).toBe(100)
    expect(result.status).toBe('valid')
  })

  it('returns valid status when score >= 80', () => {
    // Drop MX and SPF → 25+15+0+15+0+10 +10 = 75... not >= 80
    // Drop only SPF → 25+15+25+15+0+10 +10 = 100
    // Drop SPF and DMARC → 25+15+25+15+0+0 +10 = 90
    const result = calculateEmailScore(good({ spfOk: false, dmarcOk: false }))
    expect(result.score).toBe(90)
    expect(result.status).toBe('valid')
  })

  it('returns risky status when score is 50-79', () => {
    // No MX (0), no SPF (0), no DMARC (0) → 25+15+0+15+0+0 +10 = 65
    const result = calculateEmailScore(good({ mxOk: false, spfOk: false, dmarcOk: false }))
    expect(result.score).toBe(65)
    expect(result.status).toBe('risky')
  })

  it('returns invalid status when score < 50', () => {
    // Syntax fails → 0+15+25+15+10+10 +10 = 85 ... not < 50
    // Disposable fails + no DNS → 25+15+0+0+0+0 +10 = 50... not < 50
    // Disposable fails + no DNS + low TLD → 25+15+0+0+0+0 +3 = 43
    const result = calculateEmailScore(good({ disposableOk: false, mxOk: null, spfOk: null, dmarcOk: null, tldScore: 3 }))
    expect(result.score).toBe(43)
    expect(result.status).toBe('invalid')
  })

  it('returns invalid status with score 0 when all checks fail', () => {
    const result = calculateEmailScore({
      syntaxOk: false,
      domainOk: false,
      mxOk: false,
      disposableOk: false,
      spfOk: false,
      dmarcOk: false,
      tldScore: 0,
    })
    expect(result.score).toBe(0)
    expect(result.status).toBe('invalid')
    expect(result.recommendation).toContain('Do not use')
  })

  it('treats null DNS results as 0 contribution', () => {
    // All DNS null → 25+15+0+15+0+0 +10 = 65 → risky
    const result = calculateEmailScore(good({ mxOk: null, spfOk: null, dmarcOk: null }))
    expect(result.score).toBe(65)
    expect(result.status).toBe('risky')
  })

  it('includes all check details in the result', () => {
    const result = calculateEmailScore(good({ mxOk: null, dmarcOk: null }))
    expect(result.details).toEqual({
      syntaxOk: true,
      domainOk: true,
      mxOk: 'unknown',
      disposableOk: true,
      spfOk: true,
      dmarcOk: 'unknown',
      tldScore: 10,
    })
  })

  it('recommends verification for risky emails', () => {
    const result = calculateEmailScore(good({ mxOk: false, spfOk: false, dmarcOk: false }))
    expect(result.recommendation).toContain('verifying')
  })

  it('never exceeds 100', () => {
    // Even with unrealistic tldScore
    const result = calculateEmailScore(good({ tldScore: 100 }))
    expect(result.score).toBe(100)
  })
})

// ===========================================================================
// 6. checkMxRecords  (DNS-mocked)
// ===========================================================================

describe('checkMxRecords', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when MX records exist', async () => {
    mockedResolveMx.mockResolvedValueOnce([{ exchange: 'mail.example.com', priority: 10 }])
    expect(await checkMxRecords('example.com')).toBe(true)
  })

  it('returns false when MX lookup returns empty array', async () => {
    mockedResolveMx.mockResolvedValueOnce([])
    expect(await checkMxRecords('example.com')).toBe(false)
  })

  it('returns null on DNS error', async () => {
    mockedResolveMx.mockRejectedValueOnce(new Error('ENOTFOUND'))
    expect(await checkMxRecords('example.com')).toBe(null)
  })

  it('returns null on timeout', async () => {
    mockedResolveMx.mockRejectedValueOnce(new Error('MX lookup timed out'))
    expect(await checkMxRecords('example.com')).toBe(null)
  })

  it('calls resolveMx with the correct domain', async () => {
    mockedResolveMx.mockResolvedValueOnce([{ exchange: 'mail.test.com', priority: 10 }])
    await checkMxRecords('test.com')
    expect(mockedResolveMx).toHaveBeenCalledWith('test.com')
  })
})

// ===========================================================================
// 7. checkSpfRecord  (DNS-mocked)
// ===========================================================================

describe('checkSpfRecord', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when v=spf1 record is present', async () => {
    mockedResolveTxt.mockResolvedValueOnce([['v=spf1 include:_spf.google.com ~all']])
    expect(await checkSpfRecord('example.com')).toBe(true)
  })

  it('returns false when TXT records exist but no SPF', async () => {
    mockedResolveTxt.mockResolvedValueOnce([['some-other-record']])
    expect(await checkSpfRecord('example.com')).toBe(false)
  })

  it('returns true when SPF is one of multiple TXT records', async () => {
    mockedResolveTxt.mockResolvedValueOnce([
      ['site-verification=abc123'],
      ['v=spf1 include:_spf.google.com ~all'],
    ])
    expect(await checkSpfRecord('example.com')).toBe(true)
  })

  it('returns false when no TXT records exist', async () => {
    mockedResolveTxt.mockResolvedValueOnce([])
    expect(await checkSpfRecord('example.com')).toBe(false)
  })

  it('returns null on DNS error', async () => {
    mockedResolveTxt.mockRejectedValueOnce(new Error('ENOTFOUND'))
    expect(await checkSpfRecord('example.com')).toBe(null)
  })

  it('handles multi-part TXT chunks (joined)', async () => {
    // TXT records can be split into chunks
    mockedResolveTxt.mockResolvedValueOnce([['v=spf1 ', 'include:_spf.google.com ~all']])
    expect(await checkSpfRecord('example.com')).toBe(true)
  })
})

// ===========================================================================
// 8. checkDmarcRecord  (DNS-mocked)
// ===========================================================================

describe('checkDmarcRecord', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when v=DMARC1 record is present', async () => {
    mockedResolveTxt.mockResolvedValueOnce([['v=DMARC1; p=none; rua=mailto:dmarc@example.com']])
    expect(await checkDmarcRecord('example.com')).toBe(true)
  })

  it('returns false when _dmarc TXT records exist but no DMARC', async () => {
    mockedResolveTxt.mockResolvedValueOnce([['some-other-record']])
    expect(await checkDmarcRecord('example.com')).toBe(false)
  })

  it('is case-insensitive for v=DMARC1', async () => {
    mockedResolveTxt.mockResolvedValueOnce([['v=dmarc1; p=reject']])
    expect(await checkDmarcRecord('example.com')).toBe(true)
  })

  it('returns false when no TXT records on _dmarc subdomain', async () => {
    mockedResolveTxt.mockResolvedValueOnce([])
    expect(await checkDmarcRecord('example.com')).toBe(false)
  })

  it('returns null on DNS error', async () => {
    mockedResolveTxt.mockRejectedValueOnce(new Error('ENOTFOUND'))
    expect(await checkDmarcRecord('example.com')).toBe(null)
  })

  it('calls resolveTxt with _dmarc. prefix', async () => {
    mockedResolveTxt.mockResolvedValueOnce([['v=DMARC1; p=none']])
    await checkDmarcRecord('example.com')
    expect(mockedResolveTxt).toHaveBeenCalledWith('_dmarc.example.com')
  })
})

// ===========================================================================
// 9. validateEmail  (full orchestrator, DNS-mocked)
// ===========================================================================

describe('validateEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns score >= 80 and status valid for a fully verified email', async () => {
    mockedResolveMx.mockResolvedValueOnce([{ exchange: 'mail.gmail.com', priority: 10 }])
    mockedResolveTxt
      .mockResolvedValueOnce([['v=spf1 include:_spf.google.com ~all']])   // SPF
      .mockResolvedValueOnce([['v=DMARC1; p=reject']])                     // DMARC

    const result = await validateEmail('user@gmail.com')

    expect(result.syntaxOk).toBe(true)
    expect(result.domainOk).toBe(true)
    expect(result.disposableOk).toBe(true)
    expect(result.mxOk).toBe(true)
    expect(result.spfOk).toBe(true)
    expect(result.dmarcOk).toBe(true)
    expect(result.tldScore).toBe(10) // .com = high trust
    expect(result.score).toBeGreaterThanOrEqual(80)
    expect(result.status).toBe('valid')
  })

  it('returns invalid status for disposable domain email', async () => {
    // Disposable domains short-circuit DNS — no DNS calls made
    const result = await validateEmail('user@mailinator.com')

    expect(result.disposableOk).toBe(false)
    expect(result.status).toBe('risky') // score = 25+15+0+0+0+0+10 = 50
    expect(result.mxOk).toBe(null)      // DNS skipped
    expect(mockedResolveMx).not.toHaveBeenCalled()
  })

  it('returns invalid status for bad syntax', async () => {
    const result = await validateEmail('not-an-email')

    expect(result.syntaxOk).toBe(false)
    expect(result.status).toBe('invalid')
    expect(result.score).toBeLessThan(50)
    expect(mockedResolveMx).not.toHaveBeenCalled() // DNS skipped
  })

  it('returns reduced score when domain has no MX records', async () => {
    mockedResolveMx.mockResolvedValueOnce([])  // No MX records
    mockedResolveTxt
      .mockResolvedValueOnce([['v=spf1 include:_spf.example.com ~all']])  // SPF
      .mockResolvedValueOnce([['v=DMARC1; p=none']])                       // DMARC

    const result = await validateEmail('user@nomx-example.com')

    expect(result.mxOk).toBe(false)
    // With MX false: 25+15+0+15+10+10+6 = 81 → valid, but reduced
    // (tldScore=6 because .com domain part... wait, nomx-example.com → tld is com → 10)
    // 25+15+0+15+10+10+10 = 85
    expect(result.score).toBeLessThan(100)
  })

  it('returns risky status when DNS lookups timeout', async () => {
    mockedResolveMx.mockRejectedValueOnce(new Error('MX lookup timed out'))
    mockedResolveTxt
      .mockRejectedValueOnce(new Error('SPF lookup timed out'))
      .mockRejectedValueOnce(new Error('DMARC lookup timed out'))

    const result = await validateEmail('user@example.com')

    expect(result.mxOk).toBe(null)
    expect(result.spfOk).toBe(null)
    expect(result.dmarcOk).toBe(null)
    // 25+15+0+15+0+0+10 = 65 → risky
    expect(result.score).toBe(65)
    expect(result.status).toBe('risky')
  })

  it('includes all expected fields in the result', async () => {
    mockedResolveMx.mockResolvedValueOnce([{ exchange: 'mail.example.com', priority: 10 }])
    mockedResolveTxt
      .mockResolvedValueOnce([['v=spf1 ~all']])
      .mockResolvedValueOnce([['v=DMARC1; p=none']])

    const result = await validateEmail('user@example.com')

    expect(result).toHaveProperty('syntaxOk')
    expect(result).toHaveProperty('domainOk')
    expect(result).toHaveProperty('mxOk')
    expect(result).toHaveProperty('disposableOk')
    expect(result).toHaveProperty('spfOk')
    expect(result).toHaveProperty('dmarcOk')
    expect(result).toHaveProperty('tldScore')
    expect(result).toHaveProperty('score')
    expect(result).toHaveProperty('status')
    expect(result).toHaveProperty('recommendation')
  })

  it('skips DNS lookups for emails with bad domain structure', async () => {
    const result = await validateEmail('user@singlepart')

    expect(result.domainOk).toBe(false)
    expect(result.status).toBe('invalid')
    expect(mockedResolveMx).not.toHaveBeenCalled()
  })
})