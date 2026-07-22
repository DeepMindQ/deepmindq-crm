import { randomBytes } from 'crypto'

const CSRF_TOKEN_HEADER = 'x-csrf-token'
const CSRF_COOKIE_NAME = 'csrf-token'

// Generate a new CSRF token
export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex')
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