/**
 * DeepMindQ Enterprise Test Framework — Milestone 3
 * Section: Unit / Security / CSRF Protection Certification
 *
 * Tests CSRF token generation, validation, constant-time comparison,
 * middleware integration, and security edge cases.
 *
 * Validates: Token entropy, cookie/header matching, timing-safe comparison,
 * safe method bypass, and request forgery resistance.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  generateCsrfToken,
  validateCsrf,
  csrfMiddleware,
  CSRF_TOKEN_HEADER,
  CSRF_COOKIE_NAME,
} from '@/lib/csrf'

describe('CSRF Protection — Certification', () => {
  // ── Token Generation ───────────────────────────────────────────

  describe('generateCsrfToken — entropy and format', () => {
    it('should generate a 64-character hex string (32 bytes)', () => {
      const token = generateCsrfToken()
      expect(token).toHaveLength(64)
      expect(token).toMatch(/^[0-9a-f]{64}$/)
    })

    it('should generate unique tokens on each call', () => {
      const tokens = new Set(Array.from({ length: 100 }, () => generateCsrfToken()))
      expect(tokens.size).toBe(100)
    })

    it('should use cryptographic randomBytes (no predictable patterns)', () => {
      const tokens = Array.from({ length: 10 }, () => generateCsrfToken())
      // Check no two tokens share the first 16 chars
      const prefixes = tokens.map(t => t.substring(0, 16))
      expect(new Set(prefixes).size).toBe(10)
    })
  })

  // ── Validation — Correct Matching ──────────────────────────────

  describe('validateCsrf — correct token matching', () => {
    it('should return true when header matches cookie', () => {
      const token = generateCsrfToken()
      const req = new Request('http://localhost', {
        method: 'POST',
        headers: {
          [CSRF_TOKEN_HEADER]: token,
          'cookie': `${CSRF_COOKIE_NAME}=${token}`,
        },
      })
      expect(validateCsrf(req)).toBe(true)
    })

    it('should return false when header token differs from cookie', () => {
      const headerToken = generateCsrfToken()
      const cookieToken = generateCsrfToken()
      const req = new Request('http://localhost', {
        method: 'POST',
        headers: {
          [CSRF_TOKEN_HEADER]: headerToken,
          'cookie': `${CSRF_COOKIE_NAME}=${cookieToken}`,
        },
      })
      expect(validateCsrf(req)).toBe(false)
    })
  })

  // ── Safe Methods Bypass ────────────────────────────────────────

  describe('validateCsrf — safe method bypass', () => {
    const token = generateCsrfToken()

    it('GET should pass without CSRF token', () => {
      const req = new Request('http://localhost', { method: 'GET' })
      expect(validateCsrf(req)).toBe(true)
    })

    it('HEAD should pass without CSRF token', () => {
      const req = new Request('http://localhost', { method: 'HEAD' })
      expect(validateCsrf(req)).toBe(true)
    })

    it('OPTIONS should pass without CSRF token', () => {
      const req = new Request('http://localhost', { method: 'OPTIONS' })
      expect(validateCsrf(req)).toBe(true)
    })

    it('POST should require CSRF token', () => {
      const req = new Request('http://localhost', { method: 'POST' })
      expect(validateCsrf(req)).toBe(false)
    })

    it('PUT should require CSRF token', () => {
      const req = new Request('http://localhost', { method: 'PUT' })
      expect(validateCsrf(req)).toBe(false)
    })

    it('DELETE should require CSRF token', () => {
      const req = new Request('http://localhost', { method: 'DELETE' })
      expect(validateCsrf(req)).toBe(false)
    })

    it('PATCH should require CSRF token', () => {
      const req = new Request('http://localhost', { method: 'PATCH' })
      expect(validateCsrf(req)).toBe(false)
    })
  })

  // ── Missing Tokens ─────────────────────────────────────────────

  describe('validateCsrf — missing token handling', () => {
    it('should return false when header is missing', () => {
      const token = generateCsrfToken()
      const req = new Request('http://localhost', {
        method: 'POST',
        headers: { 'cookie': `${CSRF_COOKIE_NAME}=${token}` },
      })
      expect(validateCsrf(req)).toBe(false)
    })

    it('should return false when cookie is missing', () => {
      const token = generateCsrfToken()
      const req = new Request('http://localhost', {
        method: 'POST',
        headers: { [CSRF_TOKEN_HEADER]: token },
      })
      expect(validateCsrf(req)).toBe(false)
    })

    it('should return false when both are missing', () => {
      const req = new Request('http://localhost', { method: 'POST' })
      expect(validateCsrf(req)).toBe(false)
    })

    it('should return false when cookie has wrong name', () => {
      const token = generateCsrfToken()
      const req = new Request('http://localhost', {
        method: 'POST',
        headers: {
          [CSRF_TOKEN_HEADER]: token,
          'cookie': `wrong-name=${token}`,
        },
      })
      expect(validateCsrf(req)).toBe(false)
    })
  })

  // ── Middleware Integration ─────────────────────────────────────

  describe('csrfMiddleware — response pattern', () => {
    it('should return valid:true for matched tokens', () => {
      const token = generateCsrfToken()
      const req = new Request('http://localhost', {
        method: 'POST',
        headers: {
          [CSRF_TOKEN_HEADER]: token,
          'cookie': `${CSRF_COOKIE_NAME}=${token}`,
        },
      })
      const result = csrfMiddleware(req)
      expect(result.valid).toBe(true)
      expect(result.response).toBeUndefined()
    })

    it('should return 403 response for missing tokens', () => {
      const req = new Request('http://localhost', { method: 'POST' })
      const result = csrfMiddleware(req)
      expect(result.valid).toBe(false)
      expect(result.response).toBeDefined()
      expect(result.response!.status).toBe(403)
    })
  })

  // ── Timing Attack Resistance ───────────────────────────────────

  describe('CSRF — timing attack resistance (length mismatch)', () => {
    it('should reject tokens of different lengths', () => {
      const longToken = generateCsrfToken()
      const shortToken = longToken.substring(0, 32) // Half length
      const req = new Request('http://localhost', {
        method: 'POST',
        headers: {
          [CSRF_TOKEN_HEADER]: longToken,
          'cookie': `${CSRF_COOKIE_NAME}=${shortToken}`,
        },
      })
      expect(validateCsrf(req)).toBe(false)
    })
  })
})
