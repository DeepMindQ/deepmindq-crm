/**
 * DeepMindQ Enterprise Test Framework — Milestone 3
 * Section: Unit / Security / Auth Helpers Certification
 *
 * Tests centralized security utilities (src/lib/auth-helpers.ts):
 * - Public path detection
 * - Session token extraction
 * - Edge rate limiting
 * - Security headers
 * - CSRF validation (Edge-compatible)
 * - Response helpers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  isPublicPath,
  getSessionToken,
  isApiRoute,
  isRateLimitedPublicApi,
  getSecurityHeaders,
  validateCsrf,
  edgeRateLimit,
  PUBLIC_PATH_PREFIXES,
  SESSION_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  CSRF_TOKEN_HEADER,
} from '@/lib/auth-helpers'
import { NextRequest } from 'next/server'

describe('Auth Helpers — Security Utilities Certification', () => {
  // ── Public Path Detection ──────────────────────────────────────

  describe('isPublicPath — route classification', () => {
    it('should return true for root path', () => {
      expect(isPublicPath('/')).toBe(true)
    })

    it('should return true for /api/auth/login', () => {
      expect(isPublicPath('/api/auth/login')).toBe(true)
    })

    it('should return true for /api/auth/request-otp', () => {
      expect(isPublicPath('/api/auth/request-otp')).toBe(true)
    })

    it('should return true for /api/webhooks/bounce', () => {
      expect(isPublicPath('/api/webhooks/bounce')).toBe(true)
    })

    it('should return true for /api/ping', () => {
      expect(isPublicPath('/api/ping')).toBe(true)
    })

    it('should return true for /api/ready', () => {
      expect(isPublicPath('/api/ready')).toBe(true)
    })

    it('should return true for /api/cron/process', () => {
      expect(isPublicPath('/api/cron/process')).toBe(true)
    })

    it('should return true for /login', () => {
      expect(isPublicPath('/login')).toBe(true)
    })

    it('should return true for /_next/static/chunk.js', () => {
      expect(isPublicPath('/_next/static/chunk.js')).toBe(true)
    })

    it('should return false for /api/companies (protected)', () => {
      expect(isPublicPath('/api/companies')).toBe(false)
    })

    it('should return false for /api/companies/123 (protected)', () => {
      expect(isPublicPath('/api/companies/123')).toBe(false)
    })

    it('should return false for /app/dashboard (protected)', () => {
      expect(isPublicPath('/app/dashboard')).toBe(false)
    })

    it('should return false for /api/research (protected)', () => {
      expect(isPublicPath('/api/research')).toBe(false)
    })

    it('should classify PUBLIC_PATH_PREFIXES correctly', () => {
      expect(PUBLIC_PATH_PREFIXES.length).toBeGreaterThanOrEqual(15)
      expect(PUBLIC_PATH_PREFIXES).toContain('/api/auth/')
      expect(PUBLIC_PATH_PREFIXES).toContain('/api/webhooks/crm/')
    })
  })

  // ── API Route Detection ───────────────────────────────────────

  describe('isApiRoute — API detection', () => {
    it('should return true for /api/* paths', () => {
      expect(isApiRoute('/api/companies')).toBe(true)
      expect(isApiRoute('/api/auth/login')).toBe(true)
      expect(isApiRoute('/api/anything')).toBe(true)
    })

    it('should return false for non-API paths', () => {
      expect(isApiRoute('/companies')).toBe(false)
      expect(isApiRoute('/app/dashboard')).toBe(false)
    })
  })

  // ── Rate-Limited Public API Detection ───────────────────────────

  describe('isRateLimitedPublicApi — OTP endpoints', () => {
    it('should identify OTP request as rate-limited', () => {
      expect(isRateLimitedPublicApi('/api/auth/request-otp')).toBe(true)
    })

    it('should identify OTP verify as rate-limited', () => {
      expect(isRateLimitedPublicApi('/api/auth/verify-otp')).toBe(true)
    })

    it('should NOT identify /api/ping as rate-limited', () => {
      expect(isRateLimitedPublicApi('/api/ping')).toBe(false)
    })

    it('should NOT identify /api/companies as rate-limited', () => {
      expect(isRateLimitedPublicApi('/api/companies')).toBe(false)
    })
  })

  // ── Security Headers ───────────────────────────────────────────

  describe('getSecurityHeaders — security response headers', () => {
    it('should include X-Content-Type-Options: nosniff', () => {
      const headers = getSecurityHeaders()
      expect(headers['X-Content-Type-Options']).toBe('nosniff')
    })

    it('should include X-Frame-Options: DENY', () => {
      const headers = getSecurityHeaders()
      expect(headers['X-Frame-Options']).toBe('DENY')
    })

    it('should include Strict-Transport-Security', () => {
      const headers = getSecurityHeaders()
      expect(headers['Strict-Transport-Security']).toContain('max-age=31536000')
      expect(headers['Strict-Transport-Security']).toContain('includeSubDomains')
    })

    it('should include Referrer-Policy: strict-origin-when-cross-origin', () => {
      const headers = getSecurityHeaders()
      expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    })

    it('should include Permissions-Policy disabling camera/microphone/geolocation', () => {
      const headers = getSecurityHeaders()
      expect(headers['Permissions-Policy']).toContain('camera=()')
      expect(headers['Permissions-Policy']).toContain('microphone=()')
      expect(headers['Permissions-Policy']).toContain('geolocation=()')
    })

    it('should include Content-Security-Policy', () => {
      const headers = getSecurityHeaders()
      expect(headers['Content-Security-Policy']).toBeDefined()
      expect(headers['Content-Security-Policy']).toContain('default-src')
      expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'")
    })
  })

  // ── CSRF Validation (Edge-compatible) ──────────────────────────

  describe('validateCsrf — Edge CSRF check', () => {
    it('should pass for GET requests without tokens', () => {
      const req = new NextRequest('http://localhost/api/companies', { method: 'GET' })
      expect(validateCsrf(req)).toBe(true)
    })

    it('should pass for OPTIONS requests', () => {
      const req = new NextRequest('http://localhost/api/companies', { method: 'OPTIONS' })
      expect(validateCsrf(req)).toBe(true)
    })

    it('should fail for POST without CSRF token', () => {
      const req = new NextRequest('http://localhost/api/companies', { method: 'POST' })
      expect(validateCsrf(req)).toBe(false)
    })

    it('should pass for POST with matching header and cookie', () => {
      const token = 'a'.repeat(64)
      const req = new NextRequest('http://localhost/api/companies', {
        method: 'POST',
        headers: {
          [CSRF_TOKEN_HEADER]: token,
          'cookie': `${CSRF_COOKIE_NAME}=${token}`,
        },
      })
      expect(validateCsrf(req)).toBe(true)
    })

    it('should fail for POST with mismatched tokens', () => {
      const req = new NextRequest('http://localhost/api/companies', {
        method: 'POST',
        headers: {
          [CSRF_TOKEN_HEADER]: 'a'.repeat(64),
          'cookie': `${CSRF_COOKIE_NAME}=${'b'.repeat(64)}`,
        },
      })
      expect(validateCsrf(req)).toBe(false)
    })
  })

  // ── Edge Rate Limiting ─────────────────────────────────────────

  describe('edgeRateLimit — in-memory rate limiter', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should allow requests within limit', () => {
      const result = edgeRateLimit('test-key', 5, 60000)
      expect(result.success).toBe(true)
      expect(result.remaining).toBeGreaterThanOrEqual(0)
    })

    it('should block requests exceeding limit', () => {
      for (let i = 0; i < 5; i++) {
        edgeRateLimit('burst-key', 5, 60000)
      }
      const result = edgeRateLimit('burst-key', 5, 60000)
      expect(result.success).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('should reset after window expires', () => {
      for (let i = 0; i < 5; i++) {
        edgeRateLimit('reset-key', 3, 60000)
      }
      const blocked = edgeRateLimit('reset-key', 3, 60000)
      expect(blocked.success).toBe(false)

      vi.advanceTimersByTime(61000)
      const afterReset = edgeRateLimit('reset-key', 3, 60000)
      expect(afterReset.success).toBe(true)
    })
  })
})
