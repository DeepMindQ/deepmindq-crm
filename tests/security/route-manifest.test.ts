/**
 * Security Route Manifest Test
 *
 * Validates that every API route in the codebase is classified as either
 * "protected" (has auth: checkApiAuth, withCsrf, requireAuth, withApiMiddleware,
 * HMAC token, or X-Setup-Token) or "public" (listed in PUBLIC_PATH_PREFIXES
 * or intentionally documented as public).
 *
 * This test is a GATE — it will FAIL if any route is classified as
 * "unprotected", catching routes that slip through without auth.
 *
 * To regenerate the manifest, run the generation script or update
 * reports/security-route-manifest.json manually.
 *
 * If a route is legitimately unprotected (e.g. new webhook endpoint),
 * add it to PUBLIC_PATH_PREFIXES in src/lib/auth-helpers.ts AND
 * regenerate the manifest before merging.
 */

import { describe, it, expect } from 'vitest'
import manifest from '../../reports/security-route-manifest.json'

// Type the manifest for IDE support
type RouteEntry = {
  path: string
  file: string
  classification: 'protected' | 'public' | 'unprotected'
  auth_method: string | null
  csrf: boolean
  public_reason: string | null
}

type SecurityManifest = {
  generated: string
  total_routes: number
  protected: number
  public: number
  unprotected: number
  routes: RouteEntry[]
}

const m = manifest as unknown as SecurityManifest

// ── Explicit whitelist for routes that are known unprotected ──────
// This list should be EMPTY in a healthy codebase.
// If you add an entry here, you MUST file a ticket to add proper auth.
const ALLOWED_UNPROTECTED: string[] = [
  // Example: '/api/new-endpoint', // TICKET-XXX: Adding auth
]

describe('Security Route Manifest', () => {
  it('manifest was generated recently (within last 30 days)', () => {
    const generated = new Date(m.generated)
    const maxAgeMs = 30 * 24 * 60 * 60 * 1000
    const ageMs = Date.now() - generated.getTime()
    expect(ageMs).toBeLessThan(maxAgeMs)
  })

  it('has scanned a non-zero number of routes', () => {
    expect(m.total_routes).toBeGreaterThan(0)
  })

  it('route counts are consistent with the routes array', () => {
    const fromArray = {
      protected: m.routes.filter(r => r.classification === 'protected').length,
      public: m.routes.filter(r => r.classification === 'public').length,
      unprotected: m.routes.filter(r => r.classification === 'unprotected').length,
    }
    expect(fromArray.protected).toBe(m.protected)
    expect(fromArray.public).toBe(m.public)
    expect(fromArray.unprotected).toBe(m.unprotected)
    expect(fromArray.protected + fromArray.public + fromArray.unprotected).toBe(m.total_routes)
  })

  it('every route has a valid classification', () => {
    const validClassifications = ['protected', 'public', 'unprotected']
    for (const route of m.routes) {
      expect(validClassifications, `Route ${route.path} has invalid classification: ${route.classification}`).toContain(route.classification)
    }
  })

  it('protected routes specify an auth_method', () => {
    const protectedRoutes = m.routes.filter(r => r.classification === 'protected')
    for (const route of protectedRoutes) {
      expect(route.auth_method, `Protected route ${route.path} must specify an auth_method`).not.toBeNull()
      expect(route.auth_method!.length, `auth_method for ${route.path} should not be empty`).toBeGreaterThan(0)
    }
  })

  it('public routes specify a public_reason', () => {
    const publicRoutes = m.routes.filter(r => r.classification === 'public')
    for (const route of publicRoutes) {
      expect(route.public_reason, `Public route ${route.path} must specify a public_reason`).not.toBeNull()
    }
  })

  it('NO unprotected routes exist (unless explicitly whitelisted)', () => {
    const unprotectedRoutes = m.routes.filter(r => r.classification === 'unprotected')
    const unexpectedUnprotected = unprotectedRoutes.filter(r => !ALLOWED_UNPROTECTED.includes(r.path))

    if (unexpectedUnprotected.length > 0) {
      const paths = unexpectedUnprotected.map(r => `  - ${r.path} (${r.file})`).join('\n')
      throw new Error(
        `SECURITY GATE FAILURE: ${unexpectedUnprotected.length} unprotected route(s) found:\n${paths}\n\n` +
        `Either add auth to these routes, add them to PUBLIC_PATH_PREFIXES in src/lib/auth-helpers.ts,\n` +
        `or add them to the ALLOWED_UNPROTECTED whitelist with a ticket reference.\n` +
        `Then regenerate the manifest.\n`
      )
    }

    // If whitelisted, ensure count matches
    if (ALLOWED_UNPROTECTED.length > 0) {
      expect(unprotectedRoutes.length).toBe(ALLOWED_UNPROTECTED.length)
    }
  })

  it('whitelisted unprotected routes actually exist in the manifest', () => {
    const manifestPaths = new Set(m.routes.map(r => r.path))
    for (const whitelisted of ALLOWED_UNPROTECTED) {
      expect(manifestPaths.has(whitelisted), `ALLOWED_UNPROTECTED lists ${whitelisted} but it does not exist in the manifest`).toBe(true)
    }
  })

  it('routes with CSRF also have auth', () => {
    const csrfRoutes = m.routes.filter(r => r.csrf)
    for (const route of csrfRoutes) {
      expect(route.classification).toBe('protected')
      expect(route.auth_method, `CSRF route ${route.path} must also have an auth_method`).toContain('withCsrf')
    }
  })

  it('all route paths are unique', () => {
    const paths = m.routes.map(r => r.path)
    const uniquePaths = new Set(paths)
    expect(uniquePaths.size).toBe(paths.length)
  })

  it('all route files reference src/app/api/', () => {
    for (const route of m.routes) {
      expect(route.file, `Route ${route.path} has unexpected file path`).toContain('src/app/api/')
    }
  })
})
