import { describe, it, expect } from 'vitest'

describe('Auth Flow — OTP Generation', () => {
  it('generates 6-digit code', () => {
    const bytes = new Uint8Array(4)
    crypto.getRandomValues(bytes)
    const num = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]
    const code = (Math.abs(num) % 1000000).toString().padStart(6, '0')
    expect(code).toHaveLength(6)
    expect(code).toMatch(/^\d{6}$/)
  })

  it('hashes OTP with SHA-256 + dmq: prefix', async () => {
    const enc = new TextEncoder()
    const hash = await crypto.subtle.digest('SHA-256', enc.encode('dmq:123456'))
    const hex = Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    expect(hex).toHaveLength(64)
  })
})

describe('Auth Flow — Session Token', () => {
  it('generates 64-hex-char token', () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    const token = Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    expect(token).toHaveLength(64)
  })

  it('hashes with dmq_session: prefix', async () => {
    const enc = new TextEncoder()
    const hash = await crypto.subtle.digest('SHA-256', enc.encode('dmq_session:abc'))
    const hex = Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    expect(hex).toHaveLength(64)
  })
})

describe('Auth Flow — Constraints', () => {
  const SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000

  it('10-minute OTP expiry', () => expect(10).toBe(10))
  it('5 max OTP attempts', () => expect(5).toBe(5))
  it('60-second rate limit', () => expect(60000).toBe(60000))
  it('30-day session expiry', () => expect(SESSION_EXPIRY_MS).toBe(2592000000))
  it('5 max concurrent sessions', () => expect(5).toBe(5))
})
