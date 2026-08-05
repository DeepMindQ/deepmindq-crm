/**
 * DeepMindQ Enterprise Test Framework — Milestone 3
 * Section: Security / Regression Tests / Authentication Security
 *
 * Comprehensive security regression suite validating that ALL authentication,
 * session, CSRF, and RBAC mechanisms remain secure across code changes.
 *
 * These tests are designed to catch security regressions — if any of these fail,
 * the deployment MUST be blocked.
 *
 * Target: 100% pass rate — zero tolerance for security regressions.
 */

import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '@/lib/password'
import { hashToken } from '@/lib/session'
import {
  hasPermission,
  authorizeRoute,
  getRolePermissions,
  ROUTE_AUTHORIZATION_MATRIX,
} from '@/lib/rbac'
import {
  generateCsrfToken,
  validateCsrf,
  CSRF_TOKEN_HEADER,
  CSRF_COOKIE_NAME,
} from '@/lib/csrf'
import {
  isPublicPath,
  isRateLimitedPublicApi,
  getSecurityHeaders,
  validateCsrf as edgeValidateCsrf,
} from '@/lib/auth-helpers'
import { NextRequest } from 'next/server'
import {
  shouldRotateSession,
  SESSION_ROTATION_DAYS,
  MAX_CONCURRENT_SESSIONS,
} from '@/lib/session-manager'

describe('Security Regression Suite — 100% Pass Required', () => {
  // ═══════════════════════════════════════════════════════════════
  // CRITICAL: These tests MUST all pass. A single failure is a
  // security regression that MUST block deployment.
  // ═══════════════════════════════════════════════════════════════

  describe('REGRESSION-01: Password hashing integrity', () => {
    it('hash format must be salt$hash (never changed)', async () => {
      const hash = await hashPassword('regression-test')
      expect(hash).toMatch(/^[0-9a-f]{32}\$[0-9a-f]{64}$/)
    })

    it('salt must be 16 bytes (32 hex chars)', async () => {
      const hash = await hashPassword('test')
      const [salt] = hash.split('$')
      expect(salt).toHaveLength(32)
    })

    it('hash must be 32 bytes (64 hex chars)', async () => {
      const hash = await hashPassword('test')
      const [, hashHex] = hash.split('$')
      expect(hashHex).toHaveLength(64)
    })

    it('must use constant-time comparison (no timing leaks)', async () => {
      const hash = await hashPassword('correct-password')
      // Both should take similar time (not testing timing, just verifying behavior)
      expect(await verifyPassword('correct-password', hash)).toBe(true)
      expect(await verifyPassword('x'.repeat(64), hash)).toBe(false)
    })
  })

  describe('REGRESSION-02: Session token hashing integrity', () => {
    it('token hash must use SHA-256 (64 hex chars)', async () => {
      const hash = await hashToken('test-token-value')
      expect(hash).toHaveLength(64)
      expect(hash).toMatch(/^[0-9a-f]{64}$/)
    })

    it('different tokens must produce different hashes', async () => {
      const h1 = await hashToken('token-1')
      const h2 = await hashToken('token-2')
      expect(h1).not.toBe(h2)
    })

    it('same token must produce same hash (deterministic)', async () => {
      const h1 = await hashToken('same-token')
      const h2 = await hashToken('same-token')
      expect(h1).toBe(h2)
    })
  })

  describe('REGRESSION-03: RBAC deny-by-default enforcement', () => {
    const criticalRoles = [null, undefined, '', '   ', 'hacker', 'admin" OR 1=1', 'unknown']

    it.each(criticalRoles)('must DENY role: %s for companies:read', (role) => {
      expect(hasPermission(role as any, 'companies:read')).toBe(false)
    })

    it.each(criticalRoles)('must DENY role: %s for ai:configure', (role) => {
      expect(hasPermission(role as any, 'ai:configure')).toBe(false)
    })

    it.each(criticalRoles)('must DENY role: %s for users:manage', (role) => {
      expect(hasPermission(role as any, 'users:manage')).toBe(false)
    })
  })

  describe('REGRESSION-04: RBAC permission boundaries', () => {
    it('viewer must NOT have any write permissions', () => {
      const viewerPerms = getRolePermissions('viewer')
      const writePerms = viewerPerms.filter(p => p.includes(':write') || p.includes(':delete') || p.includes(':manage'))
      expect(writePerms).toHaveLength(0)
    })

    it('user must NOT have any write permissions', () => {
      const userPerms = getRolePermissions('user')
      const writePerms = userPerms.filter(p => p.includes(':write') || p.includes(':delete') || p.includes(':manage'))
      expect(writePerms).toHaveLength(0)
    })

    it('operator must NOT have users:manage', () => {
      expect(hasPermission('operator', 'users:manage')).toBe(false)
    })

    it('operator must NOT have ai:configure', () => {
      expect(hasPermission('operator', 'ai:configure')).toBe(false)
    })

    it('operator must NOT have settings:write', () => {
      expect(hasPermission('operator', 'settings:write')).toBe(false)
    })

    it('admin must have all critical permissions', () => {
      const criticalPerms = [
        'companies:delete', 'users:manage', 'ai:configure',
        'settings:write', 'export:write', 'knowledge:manage',
      ]
      for (const perm of criticalPerms) {
        expect(hasPermission('admin', perm)).toBe(true)
      }
    })
  })

  describe('REGRESSION-05: Route authorization deny-by-default', () => {
    it('unconfigured routes must be DENIED for all roles', () => {
      const result = authorizeRoute('/api/secret-admin-panel', 'GET', 'admin')
      expect(result.authorized).toBe(false)
    })

    it('unconfigured routes must be DENIED even for admin with DELETE', () => {
      const result = authorizeRoute('/api/backdoor', 'DELETE', 'admin')
      expect(result.authorized).toBe(false)
    })
  })

  describe('REGRESSION-06: Public route stability', () => {
    const criticalPublicRoutes = [
      '/api/ping', '/api/ready', '/api/health/',
      '/api/auth/login', '/api/auth/register',
      '/api/webhooks/bounce', '/api/cron/process',
    ]

    it.each(criticalPublicRoutes)('route %s must remain PUBLIC', (route) => {
      expect(isPublicPath(route)).toBe(true)
    })

    it('protected routes must NOT become public', () => {
      const protectedRoutes = [
        '/api/companies', '/api/contacts', '/api/research',
        '/api/ai/chat', '/api/settings', '/api/audit',
      ]
      for (const route of protectedRoutes) {
        expect(isPublicPath(route)).toBe(false)
      }
    })
  })

  describe('REGRESSION-07: CSRF protection integrity', () => {
    it('POST must require CSRF token (never bypass)', () => {
      const req = new Request('http://localhost/api/companies', { method: 'POST' })
      expect(validateCsrf(req)).toBe(false)
    })

    it('DELETE must require CSRF token (never bypass)', () => {
      const req = new Request('http://localhost/api/companies/123', { method: 'DELETE' })
      expect(validateCsrf(req)).toBe(false)
    })

    it('PUT must require CSRF token (never bypass)', () => {
      const req = new Request('http://localhost/api/settings', { method: 'PUT' })
      expect(validateCsrf(req)).toBe(false)
    })

    it('GET must ALWAYS bypass CSRF (safe methods)', () => {
      const req = new Request('http://localhost/api/companies', { method: 'GET' })
      expect(validateCsrf(req)).toBe(true)
    })

    it('mismatched tokens must be REJECTED', () => {
      const req = new Request('http://localhost/api/companies', {
        method: 'POST',
        headers: {
          [CSRF_TOKEN_HEADER]: 'a'.repeat(64),
          'cookie': `${CSRF_COOKIE_NAME}=${'b'.repeat(64)}`,
        },
      })
      expect(validateCsrf(req)).toBe(false)
    })

    it('CSRF token must have 64-char entropy (32 bytes)', () => {
      const token = generateCsrfToken()
      expect(token).toHaveLength(64)
      expect(token).toMatch(/^[0-9a-f]{64}$/)
    })
  })

  describe('REGRESSION-08: Edge CSRF validation consistency', () => {
    it('Edge validateCsrf must also reject POST without token', () => {
      const req = new NextRequest('http://localhost/api/companies', { method: 'POST' })
      expect(edgeValidateCsrf(req)).toBe(false)
    })

    it('Edge validateCsrf must accept GET without token', () => {
      const req = new NextRequest('http://localhost/api/companies', { method: 'GET' })
      expect(edgeValidateCsrf(req)).toBe(true)
    })
  })

  describe('REGRESSION-09: Security headers stability', () => {
    it('X-Frame-Options must be DENY (never SAMEORIGIN or ALLOW)', () => {
      const headers = getSecurityHeaders()
      expect(headers['X-Frame-Options']).toBe('DENY')
    })

    it('X-Content-Type-Options must be nosniff', () => {
      const headers = getSecurityHeaders()
      expect(headers['X-Content-Type-Options']).toBe('nosniff')
    })

    it('HSTS must include includeSubDomains', () => {
      const headers = getSecurityHeaders()
      expect(headers['Strict-Transport-Security']).toContain('includeSubDomains')
    })

    it('CSP must include frame-ancestors none', () => {
      const headers = getSecurityHeaders()
      expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'")
    })

    it('Permissions-Policy must disable camera and microphone', () => {
      const headers = getSecurityHeaders()
      expect(headers['Permissions-Policy']).toContain('camera=()')
      expect(headers['Permissions-Policy']).toContain('microphone=()')
    })
  })

  describe('REGRESSION-10: Session rotation security', () => {
    it('SESSION_ROTATION_DAYS must be 7 (not increased)', () => {
      expect(SESSION_ROTATION_DAYS).toBe(7)
    })

    it('MAX_CONCURRENT_SESSIONS must be 5 (not increased)', () => {
      expect(MAX_CONCURRENT_SESSIONS).toBe(5)
    })

    it('sessions older than 7 days must be flagged for rotation', () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
      expect(shouldRotateSession(eightDaysAgo)).toBe(true)
    })

    it('sessions under 7 days must NOT be flagged for rotation', () => {
      const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
      expect(shouldRotateSession(sixDaysAgo)).toBe(false)
    })
  })

  describe('REGRESSION-11: OTP rate limiting', () => {
    it('OTP endpoints must be rate-limited', () => {
      expect(isRateLimitedPublicApi('/api/auth/request-otp')).toBe(true)
      expect(isRateLimitedPublicApi('/api/auth/verify-otp')).toBe(true)
    })
  })

  describe('REGRESSION-12: Route authorization matrix completeness', () => {
    it('ROUTE_AUTHORIZATION_MATRIX must have 80+ entries', () => {
      expect(ROUTE_AUTHORIZATION_MATRIX.length).toBeGreaterThanOrEqual(80)
    })

    it('auth routes must be public', () => {
      const authRoutes = ROUTE_AUTHORIZATION_MATRIX.filter(r => r.path === '/api/auth/')
      expect(authRoutes).toHaveLength(1)
      expect(authRoutes[0].public).toBe(true)
    })

    it('webhook routes must be public (HMAC verified separately)', () => {
      const webhookRoutes = ROUTE_AUTHORIZATION_MATRIX.filter(r => r.path === '/api/webhooks/')
      expect(webhookRoutes).toHaveLength(1)
      expect(webhookRoutes[0].public).toBe(true)
    })
  })
})
