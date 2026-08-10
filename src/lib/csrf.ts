/**
 * CSRF Protection — Double-Submit Cookie Pattern
 *
 * P0.4 DEEP FIX: Replaced Node.js crypto.randomBytes with
 * crypto.getRandomValues (Web Crypto API) for Edge compatibility.
 *
 * Pattern:
 *   1. Server sets a non-httpOnly csrf-token cookie on page loads
 *   2. Client reads cookie, sends same value as x-csrf-token header
 *   3. Server compares header == cookie (constant-time)
 *   4. If mismatch or missing → 403
 *
 * The csrf-token cookie MUST be set by:
 *   - Edge middleware (src/middleware.ts) — uses generateCsrfToken()
 *   - Next.js 16 proxy (src/proxy.ts) — uses generateCsrfToken()
 * Both import from this file (single source of truth).
 */

const CSRF_TOKEN_HEADER = 'x-csrf-token'
const CSRF_COOKIE_NAME = 'csrf-token'

// Generate a new CSRF token using Web Crypto API (Edge-compatible)
export function generateCsrfToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// Validate a CSRF token from request
export function validateCsrf(req: Request): boolean {
  // Skip CSRF for GET/HEAD/OPTIONS (safe methods)
  const method = req.method.toUpperCase()
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return true

  const headerToken = req.headers.get(CSRF_TOKEN_HEADER)
  const cookieToken = getCsrfCookie(req)

  if (!headerToken || !cookieToken) return false
  // Use constant-time comparison to prevent timing attacks
  return timingSafeEqual(headerToken, cookieToken)
}

function getCsrfCookie(req: Request): string | null {
  const cookies = req.headers.get('cookie') || ''
  const match = cookies.match(new RegExp(`(?:^|;\\s*)${CSRF_COOKIE_NAME}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

// Constant-time string comparison
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

export { CSRF_TOKEN_HEADER, CSRF_COOKIE_NAME }

/**
 * Middleware-style CSRF check returning a result object.
 * Used by API routes that expect { valid, response } pattern.
 */
export function csrfMiddleware(req: Request): { valid: boolean; response?: Response } {
  const valid = validateCsrf(req)
  return {
    valid,
    response: valid ? undefined : new Response(
      JSON.stringify({ error: 'CSRF validation failed' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    ),
  }
}
