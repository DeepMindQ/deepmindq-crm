import { describe, it, expect } from 'vitest'
import {
  checkSyntax,
  isDisposableDomain,
  getTldTrustScore,
} from '../src/lib/email-verification'
import { cn } from '../src/lib/utils'

// ---------------------------------------------------------------------------
// Extract the parseCSV function inline (it's a local function in import-screen.tsx
// so we duplicate it here for testability — this is the actual logic from the source)
// ---------------------------------------------------------------------------

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }
  const parseLine = (line: string) => {
    const f: string[] = []
    let c = '',
      q = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (q) {
        if (ch === '"' && line[i + 1] === '"') {
          c += '"'
          i++
        } else if (ch === '"') q = false
        else c += ch
      } else {
        if (ch === '"') q = true
        else if (ch === ',') {
          f.push(c.trim())
          c = ''
        } else c += ch
      }
    }
    f.push(c.trim())
    return f
  }
  return { headers: parseLine(lines[0]), rows: lines.slice(1).map(parseLine) }
}

// ---------------------------------------------------------------------------
// CSV Parsing Tests
// ---------------------------------------------------------------------------

describe('CSV Parsing — parseCSV', () => {
  it('parses a simple CSV with headers and data rows', () => {
    const csv = `Name,Email,Company
John,john@example.com,Acme
Jane,jane@example.com,Beta`
    const result = parseCSV(csv)
    expect(result.headers).toEqual(['Name', 'Email', 'Company'])
    expect(result.rows).toEqual([
      ['John', 'john@example.com', 'Acme'],
      ['Jane', 'jane@example.com', 'Beta'],
    ])
  })

  it('returns empty arrays for a CSV with only a header row (requires at least 2 lines)', () => {
    const csv = `Name,Email`
    const result = parseCSV(csv)
    // By design: parseCSV requires at least a header + 1 data row
    expect(result.headers).toEqual([])
    expect(result.rows).toEqual([])
  })

  it('returns empty arrays for an empty string', () => {
    const result = parseCSV('')
    expect(result.headers).toEqual([])
    expect(result.rows).toEqual([])
  })

  it('returns empty arrays for a string with only whitespace', () => {
    const result = parseCSV('   \n  \n  ')
    expect(result.headers).toEqual([])
    expect(result.rows).toEqual([])
  })

  it('handles quoted fields with commas inside', () => {
    const csv = `Name,Email
"Smith, John",john@example.com`
    const result = parseCSV(csv)
    expect(result.headers).toEqual(['Name', 'Email'])
    expect(result.rows[0][0]).toBe('Smith, John')
    expect(result.rows[0][1]).toBe('john@example.com')
  })

  it('handles escaped double quotes inside quoted fields', () => {
    const csv = `Name,Note
John,"He said ""hello"" to me"`
    const result = parseCSV(csv)
    expect(result.rows[0][1]).toBe('He said "hello" to me')
  })

  it('handles CRLF line endings', () => {
    const csv = 'Name,Email\r\nJohn,john@example.com\r\nJane,jane@example.com'
    const result = parseCSV(csv)
    expect(result.rows.length).toBe(2)
    expect(result.rows[0]).toEqual(['John', 'john@example.com'])
  })

  it('handles mixed LF and CRLF line endings', () => {
    const csv = 'Name,Email\nJohn,john@example.com\r\nJane,jane@example.com'
    const result = parseCSV(csv)
    expect(result.rows.length).toBe(2)
  })

  it('trims whitespace from fields', () => {
    const csv = `Name , Email , Company 
 John , john@example.com , Acme `
    const result = parseCSV(csv)
    expect(result.headers).toEqual(['Name', 'Email', 'Company'])
    expect(result.rows[0]).toEqual(['John', 'john@example.com', 'Acme'])
  })

  it('handles empty fields', () => {
    const csv = `Name,Email,Phone
John,,555-1234
, jane@test.com,`
    const result = parseCSV(csv)
    expect(result.rows[0][1]).toBe('')
    expect(result.rows[1][0]).toBe('')
    expect(result.rows[1][2]).toBe('')
  })

  it('handles a CSV with many columns', () => {
    const csv = `Col1,Col2,Col3,Col4,Col5,Col6,Col7,Col8,Col9,Col10
a1,a2,a3,a4,a5,a6,a7,a8,a9,a10`
    const result = parseCSV(csv)
    expect(result.headers.length).toBe(10)
    expect(result.rows[0].length).toBe(10)
    expect(result.rows[0][9]).toBe('a10')
  })

  it('handles a realistic contact import CSV', () => {
    const csv = `Company Name,Contact Name,Email,Job Title,Role,Phone,Location
Acme Corp,John Smith,john@acme.com,VP Engineering,Leadership,+1-555-0100,"New York, NY"
Beta Inc,Jane Doe,jane@beta.com,CTO,Leadership,+1-555-0200,San Francisco`
    const result = parseCSV(csv)
    expect(result.headers.length).toBe(7)
    expect(result.rows.length).toBe(2)
    expect(result.rows[0][0]).toBe('Acme Corp')
    expect(result.rows[0][2]).toBe('john@acme.com')
    // Comma inside quoted location should be preserved
    expect(result.rows[0][6]).toBe('New York, NY')
  })
})

// ---------------------------------------------------------------------------
// Email Validation Edge Cases (supplementary to api-routes.test.ts)
// ---------------------------------------------------------------------------

describe('Email Validation — Additional Edge Cases', () => {
  it('checkSyntax rejects strings with spaces', () => {
    expect(checkSyntax('user @domain.com')).toBe(false)
    expect(checkSyntax('user@ domain.com')).toBe(false)
    expect(checkSyntax('user name@domain.com')).toBe(false)
  })

  it('checkSyntax accepts common valid patterns', () => {
    expect(checkSyntax('a@b.co')).toBe(true)
    expect(checkSyntax('user.name+tag+another@sub.domain.org')).toBe(true)
    expect(checkSyntax('123456@numbers.com')).toBe(true)
    expect(checkSyntax('user_name@domain.com')).toBe(true)
  })

  it('checkSyntax rejects missing TLD', () => {
    expect(checkSyntax('user@domain')).toBe(false)
  })

  it('checkSyntax rejects single-char TLD', () => {
    expect(checkSyntax('user@domain.x')).toBe(false)
  })

  it('isDisposableDomain rejects subdomains only if not exact match', () => {
    // 'mailinator.com' is disposable, so 'sub.mailinator.com' should be too
    expect(isDisposableDomain('sub.mailinator.com')).toBe(true)
    // A domain that merely contains "mailinator" as a substring should not match
    // Note: "notmailinator.com" is actually in the disposable list, so use a safe domain
    expect(isDisposableDomain('xmailinatorx.com')).toBe(false)
  })

  it('getTldTrustScore handles all high-trust TLDs', () => {
    const highTlds = ['com', 'org', 'net', 'edu', 'gov', 'mil', 'int', 'io', 'co']
    for (const tld of highTlds) {
      expect(getTldTrustScore(`example.${tld}`)).toBe(10)
    }
  })

  it('getTldTrustScore handles various medium-trust TLDs', () => {
    const mediumTlds = ['ai', 'dev', 'app', 'me', 'info', 'biz', 'tech', 'cloud', 'site']
    for (const tld of mediumTlds) {
      expect(getTldTrustScore(`example.${tld}`)).toBe(6)
    }
  })

  it('getTldTrustScore is case-insensitive', () => {
    expect(getTldTrustScore('example.COM')).toBe(10)
    expect(getTldTrustScore('example.AI')).toBe(6)
  })
})

// ---------------------------------------------------------------------------
// cn() utility function
// ---------------------------------------------------------------------------

describe('cn() utility', () => {
  it('merges class names', () => {
    const result = cn('text-red-500', 'bg-blue-500')
    expect(result).toContain('text-red-500')
    expect(result).toContain('bg-blue-500')
  })

  it('handles conditional classes', () => {
    const result = cn('base', false && 'hidden', 'visible')
    expect(result).toContain('base')
    expect(result).toContain('visible')
    expect(result).not.toContain('hidden')
  })

  it('deduplicates conflicting tailwind classes', () => {
    // twMerge should resolve the conflict: p-4 should win over p-2
    const result = cn('p-2', 'p-4')
    expect(result).toContain('p-4')
    expect(result).not.toContain('p-2')
  })

  it('handles empty and undefined inputs', () => {
    const result = cn('', undefined, null as any, 'active')
    expect(result).toBe('active')
  })
})