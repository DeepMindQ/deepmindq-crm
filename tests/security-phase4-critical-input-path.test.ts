/**
 * Phase 4 — Critical Input Path Hardening Tests
 *
 * Verifies:
 * C1. Register endpoint rejects unauthorized emails (AUTHORIZED_EMAIL guard)
 * C2. Webhook endpoints fail-closed when RESEND_WEBHOOK_SECRET is missing
 * C2. Webhook signature comparison uses crypto.timingSafeEqual
 * H3. Dev OTP code is NOT returned unless ALLOW_DEV_OTP === 'true'
 * L1. Dead RBAC code (rbac.ts) is removed
 * L2. Unused rate limiter exports are removed
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import crypto from 'crypto'

// ── Helpers ──────────────────────────────────────────────────────────

const SRC_DIR = resolve(__dirname, '../src/lib')
const API_DIR = resolve(__dirname, '../src/app/api')

// ── Test Suite ──────────────────────────────────────────────────────

describe('Phase 4 — Critical Input Path Hardening', () => {

  // ══════════════════════════════════════════════════════════════════
  // C1: Register endpoint — AUTHORIZED_EMAIL guard
  // ══════════════════════════════════════════════════════════════════
  describe('C1: Register endpoint AUTHORIZED_EMAIL guard', () => {
    it('register/route.ts contains AUTHORIZED_EMAIL check before user creation', () => {
      const filePath = resolve(API_DIR, 'auth/register/route.ts')
      const content = readFileSync(filePath, 'utf-8')

      // Must have the AUTHORIZED_EMAIL constant
      expect(content).toMatch(/AUTHORIZED_EMAIL\s*=\s*process\.env\.AUTHORIZED_EMAIL/)

      // The guard must appear BEFORE the db.user.create call
      const guardIndex = content.indexOf('Registration is restricted to authorized personnel only')
      const createIndex = content.indexOf('db.user.create')
      expect(guardIndex).toBeGreaterThan(-1)
      expect(createIndex).toBeGreaterThan(-1)
      expect(guardIndex).toBeLessThan(createIndex)
    })

    it('returns 403 for unauthorized email addresses', async () => {
      // We mock everything and call the route handler directly
      const mockHashPassword = vi.fn().mockResolvedValue('hashed-pw')
      const mockRequestOtp = vi.fn().mockResolvedValue({ success: true })
      const mockFindUnique = vi.fn().mockResolvedValue(null) // user doesn't exist yet

      vi.doMock('@/lib/password', () => ({ hashPassword: mockHashPassword }))
      vi.doMock('@/lib/otp', () => ({ requestOtp: mockRequestOtp }))
      vi.doMock('@/lib/db', () => ({
        db: {
          user: {
            findUnique: mockFindUnique,
            create: vi.fn().mockResolvedValue({ id: 'u-1', email: 'attacker@evil.com', name: 'Hacker', role: 'admin' }),
          },
        },
      }))
      vi.doMock('@/lib/logger', () => ({
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      }))

      const { POST } = await import('@/app/api/auth/register/route')

      // Create a mock request with an unauthorized email
      const mockRequest = {
        json: async () => ({
          name: 'Attacker',
          email: 'attacker@evil.com',
          password: 'Password123!',
          confirmPassword: 'Password123!',
        }),
      } as any

      const response = await POST(mockRequest)
      const data = await (response as any).json()

      // Must be 403 Forbidden
      expect(response.status).toBe(403)
      expect(data.error).toContain('restricted')

      // DB user.create must NEVER have been called
      const { db } = await import('@/lib/db')
      expect(db.user.create).not.toHaveBeenCalled()
    })

    it('allows registration for authorized email', async () => {
      const mockHashPassword = vi.fn().mockResolvedValue('hashed-pw')
      const mockRequestOtp = vi.fn().mockResolvedValue({ success: true })
      const mockFindUnique = vi.fn().mockResolvedValue(null)

      vi.doMock('@/lib/password', () => ({ hashPassword: mockHashPassword }))
      vi.doMock('@/lib/otp', () => ({ requestOtp: mockRequestOtp }))
      vi.doMock('@/lib/db', () => ({
        db: {
          user: {
            findUnique: mockFindUnique,
            create: vi.fn().mockResolvedValue({ id: 'u-1', email: 'shanker001@gmail.com', name: 'Shanker', role: 'admin' }),
          },
        },
      }))
      vi.doMock('@/lib/logger', () => ({
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      }))

      // Re-import to get fresh mocks
      vi.resetModules()

      const { POST } = await import('@/app/api/auth/register/route')

      const mockRequest = {
        json: async () => ({
          name: 'Shanker',
          email: 'shanker001@gmail.com',
          password: 'Password123!',
          confirmPassword: 'Password123!',
        }),
      } as any

      const response = await POST(mockRequest)
      expect(response.status).toBe(200)

      // DB user.create must have been called
      const { db } = await import('@/lib/db')
      expect(db.user.create).toHaveBeenCalledTimes(1)
    })
  })

  // ══════════════════════════════════════════════════════════════════
  // C2: Webhook fail-closed + timing-safe comparison
  // ══════════════════════════════════════════════════════════════════
  describe('C2: Webhook signature verification — fail-closed', () => {
    it('webhooks/reply/route.ts rejects when RESEND_WEBHOOK_SECRET is not set', () => {
      const filePath = resolve(API_DIR, 'webhooks/reply/route.ts')
      const content = readFileSync(filePath, 'utf-8')

      // Must NOT have the old "if (webhookSecret)" pattern
      expect(content).not.toMatch(/if\s*\(\s*webhookSecret\s*\)\s*{/)

      // Must have fail-closed check
      expect(content).toContain('RESEND_WEBHOOK_SECRET is not configured')
      expect(content).toContain('status: 503')
    })

    it('webhooks/bounce/route.ts rejects when RESEND_WEBHOOK_SECRET is not set', () => {
      const filePath = resolve(API_DIR, 'webhooks/bounce/route.ts')
      const content = readFileSync(filePath, 'utf-8')

      // Must NOT have the old "if (webhookSecret)" pattern
      expect(content).not.toMatch(/if\s*\(\s*webhookSecret\s*\)\s*{/)

      // Must have fail-closed check
      expect(content).toContain('RESEND_WEBHOOK_SECRET is not configured')
      expect(content).toContain('status: 503')
    })

    it('webhooks/reply/route.ts requires signature header', () => {
      const content = readFileSync(resolve(API_DIR, 'webhooks/reply/route.ts'), 'utf-8')
      expect(content).toContain('Missing webhook signature')
      expect(content).toContain('status: 401')
    })

    it('webhooks/bounce/route.ts requires signature header', () => {
      const content = readFileSync(resolve(API_DIR, 'webhooks/bounce/route.ts'), 'utf-8')
      expect(content).toContain('Missing webhook signature')
      expect(content).toContain('status: 401')
    })
  })

  describe('C2: Webhook signature uses timing-safe comparison', () => {
    it('webhooks/reply/route.ts uses crypto.timingSafeEqual', () => {
      const content = readFileSync(resolve(API_DIR, 'webhooks/reply/route.ts'), 'utf-8')
      expect(content).toContain('crypto.timingSafeEqual')
      // Must NOT have the old timing-unsafe comparison
      expect(content).not.toMatch(/signature\s*!==\s*expected/)
    })

    it('webhooks/bounce/route.ts uses crypto.timingSafeEqual', () => {
      const content = readFileSync(resolve(API_DIR, 'webhooks/bounce/route.ts'), 'utf-8')
      expect(content).toContain('crypto.timingSafeEqual')
      // Must NOT have the old timing-unsafe comparison
      expect(content).not.toMatch(/signature\s*!==\s*expected/)
    })

    it('timing-safe comparison correctly validates matching signatures', () => {
      const secret = 'test-secret-key'
      const body = '{"test": "data"}'
      const expected = crypto.createHmac('sha256', secret).update(body).digest('hex')

      const sigBuf = Buffer.from(expected, 'utf8')
      const expBuf = Buffer.from(expected, 'utf8')
      expect(sigBuf.length === expBuf.length).toBe(true)
      expect(crypto.timingSafeEqual(sigBuf, expBuf)).toBe(true)
    })

    it('timing-safe comparison correctly rejects tampered signatures', () => {
      const secret = 'test-secret-key'
      const body = '{"test": "data"}'
      const expected = crypto.createHmac('sha256', secret).update(body).digest('hex')
      const tampered = 'a' + expected.slice(1) // change first char

      // Different length — must fail length check first
      if (tampered.length === expected.length) {
        const sigBuf = Buffer.from(tampered, 'utf8')
        const expBuf = Buffer.from(expected, 'utf8')
        expect(() => crypto.timingSafeEqual(sigBuf, expBuf)).not.toThrow()
        expect(crypto.timingSafeEqual(sigBuf, expBuf)).toBe(false)
      }
      // Same-length tampered signature test
      const tamperedSameLen = expected.slice(0, -1) + (expected.slice(-1) === 'a' ? 'b' : 'a')
      const sigBuf2 = Buffer.from(tamperedSameLen, 'utf8')
      const expBuf2 = Buffer.from(expected, 'utf8')
      expect(crypto.timingSafeEqual(sigBuf2, expBuf2)).toBe(false)
    })
  })

  // ══════════════════════════════════════════════════════════════════
  // H3: Dev OTP behind explicit ALLOW_DEV_OTP flag
  // ══════════════════════════════════════════════════════════════════
  describe('H3: Dev OTP requires explicit ALLOW_DEV_OTP flag', () => {
    it('login/route.ts uses ALLOW_DEV_OTP instead of NODE_ENV', () => {
      const content = readFileSync(resolve(API_DIR, 'auth/login/route.ts'), 'utf-8')
      expect(content).toContain("process.env.ALLOW_DEV_OTP === 'true'")
      // Must NOT have the old NODE_ENV-based check
      expect(content).not.toContain("process.env.NODE_ENV === 'development'")
    })

    it('register/route.ts uses ALLOW_DEV_OTP instead of NODE_ENV', () => {
      const content = readFileSync(resolve(API_DIR, 'auth/register/route.ts'), 'utf-8')
      expect(content).toContain("process.env.ALLOW_DEV_OTP === 'true'")
      // Must NOT have the old NODE_ENV-based check
      expect(content).not.toContain("process.env.NODE_ENV === 'development'")
    })

    it('otp.ts uses ALLOW_DEV_OTP instead of NODE_ENV for devCode return', () => {
      const content = readFileSync(resolve(SRC_DIR, 'otp.ts'), 'utf-8')
      expect(content).toContain("process.env.ALLOW_DEV_OTP === 'true'")
      // Must NOT use NODE_ENV to gate devCode return
      // (ENABLE_DEV_AUTH_BYPASS is logging-only, that's fine)
      expect(content).not.toMatch(/NODE_ENV.*development.*devCode/)
    })

    it('login-page.tsx does not double-gate with NODE_ENV', () => {
      const content = readFileSync(resolve(__dirname, '../src/components/login-page.tsx'), 'utf-8')
      // Must NOT have the NODE_ENV check on devCode display
      expect(content).not.toContain('process.env.NODE_ENV')
      // Must still gate on devCode presence
      expect(content).toMatch(/\{devCode\s+&&\s*\(/)
    })
  })

  // ══════════════════════════════════════════════════════════════════
  // L1: Dead RBAC code removed
  // ══════════════════════════════════════════════════════════════════
  describe('L1: Dead RBAC code removed', () => {
    it('rbac.ts no longer exists', () => {
      const filePath = resolve(SRC_DIR, 'rbac.ts')
      expect(existsSync(filePath)).toBe(false)
    })

    it('no remaining imports of rbac.ts anywhere in src/', () => {
      const { execSync } = require('child_process')
      // Use ripgrep to search for any rbac imports
      try {
        const result = execSync('rg "from.*rbac" /home/z/my-project/src --type ts -l', { encoding: 'utf-8' })
        // If we get here, files were found — fail
        expect(result.trim()).toBe('')
      } catch (e: any) {
        // rg returns exit code 1 when no matches — that's expected
        expect(e.status).toBe(1)
      }
    })
  })

  // ══════════════════════════════════════════════════════════════════
  // L2: Unused rate limiter exports removed
  // ══════════════════════════════════════════════════════════════════
  describe('L2: Unused rate limiter exports removed', () => {
    it('rate-limit.ts does not export authRateLimit', () => {
      const content = readFileSync(resolve(SRC_DIR, 'rate-limit.ts'), 'utf-8')
      expect(content).not.toContain('export const authRateLimit')
    })

    it('rate-limit.ts does not export aiRateLimit', () => {
      const content = readFileSync(resolve(SRC_DIR, 'rate-limit.ts'), 'utf-8')
      expect(content).not.toContain('export const aiRateLimit')
    })

    it('rate-limit.ts does not export importRateLimit', () => {
      const content = readFileSync(resolve(SRC_DIR, 'rate-limit.ts'), 'utf-8')
      expect(content).not.toContain('export const importRateLimit')
    })

    it('rate-limit.ts still exports used limiters (apiRateLimit, emailSendRateLimit)', () => {
      const content = readFileSync(resolve(SRC_DIR, 'rate-limit.ts'), 'utf-8')
      expect(content).toContain('export const apiRateLimit')
      expect(content).toContain('export const emailSendRateLimit')
    })

    it('core rateLimit function is still exported', () => {
      const content = readFileSync(resolve(SRC_DIR, 'rate-limit.ts'), 'utf-8')
      expect(content).toContain('export function rateLimit')
    })
  })

  // ══════════════════════════════════════════════════════════════════
  // Cross-cutting: no regressions in remaining auth
  // ══════════════════════════════════════════════════════════════════
  describe('Cross-cutting: auth infrastructure integrity', () => {
    it('proxy.ts still enforces auth for non-public API routes', () => {
      const content = readFileSync(resolve(__dirname, '../src/proxy.ts'), 'utf-8')
      expect(content).toContain('unauthorizedResponse')
      expect(content).toContain('handleApiRoute')
    })

    it('api-auth.ts checkApiAuth still validates sessions', () => {
      const content = readFileSync(resolve(SRC_DIR, 'api-auth.ts'), 'utf-8')
      expect(content).toContain('export async function checkApiAuth')
      expect(content).toContain('getCurrentSession')
    })

    it('auth-helpers.ts rate-limited public APIs includes register', () => {
      const content = readFileSync(resolve(SRC_DIR, 'auth-helpers.ts'), 'utf-8')
      expect(content).toContain('/api/auth/register')
    })

    it('webhooks remain in PUBLIC_PATH_PREFIXES (they must be publicly reachable)', () => {
      const content = readFileSync(resolve(SRC_DIR, 'auth-helpers.ts'), 'utf-8')
      expect(content).toContain('/api/webhooks/')
    })
  })
})
