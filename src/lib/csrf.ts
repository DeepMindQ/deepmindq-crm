import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

// ---------------------------------------------------------------------------
// In-memory CSRF token store — single-process, suitable for server-side
// Next.js API routes. Tokens expire after 1 hour.
// ---------------------------------------------------------------------------

interface CsrfEntry {
  token: string;
  createdAt: number;
}

const TOKEN_TTL_MS = 60 * 60 * 1_000; // 1 hour

// Keyed by a session identifier (cookie value or request fingerprint).
// For simplicity we use a single global token slot — every call to
// `generateCsrfToken` overwrites the previous value. This works for
// single-user / dev scenarios. For multi-user production, key by session.
const store: Map<string, CsrfEntry> = new Map();

/**
 * Periodically prune expired tokens to prevent unbounded memory growth.
 * Runs at most once per minute.
 */
let lastPrune = 0;
function pruneExpired(now: number) {
  if (now - lastPrune < 60_000) return;
  lastPrune = now;
  for (const [key, entry] of store) {
    if (now - entry.createdAt > TOKEN_TTL_MS) {
      store.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a random 32-byte hex CSRF token and store it.
 *
 * @param sessionKey - Optional key to scope the token per-session.
 *                     Defaults to `"__global__"`.
 * @returns The generated hex token string.
 */
export function generateCsrfToken(sessionKey = '__global__'): string {
  const token = randomBytes(32).toString('hex');
  const now = Date.now();
  store.set(sessionKey, { token, createdAt: now });
  pruneExpired(now);
  return token;
}

/**
 * Validate a CSRF token from the request against the stored token.
 *
 * Checks the `X-CSRF-Token` header.
 *
 * @param request - The incoming Request object.
 * @param sessionKey - The session key used when generating the token.
 *                     Defaults to `"__global__"`.
 * @returns `true` if the token matches and has not expired.
 */
export function validateCsrfToken(
  request: Request,
  sessionKey = '__global__',
): boolean {
  const now = Date.now();
  pruneExpired(now);

  const entry = store.get(sessionKey);
  if (!entry) return false;

  // Expired?
  if (now - entry.createdAt > TOKEN_TTL_MS) {
    store.delete(sessionKey);
    return false;
  }

  const supplied = request.headers.get('X-CSRF-Token') || '';
  // Constant-time comparison not strictly necessary for hex tokens in a
  // server-side guard, but we use a simple equality check here.
  return supplied === entry.token;
}

/**
 * CSRF middleware for state-changing (POST / PUT / DELETE) requests.
 *
 * - GET / HEAD / OPTIONS requests always pass through.
 * - For mutating requests, validates the `X-CSRF-Token` header.
 * - Returns `{ valid: true }` on success, or `{ valid: false, response }`
 *   with a 403 JSON response on failure.
 *
 * @param request - The incoming Request object.
 * @param sessionKey - The session key used when generating the token.
 */
export function csrfMiddleware(
  request: Request,
  sessionKey = '__global__',
): { valid: boolean; response?: Response } {
  const method = request.method.toUpperCase();
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];

  if (safeMethods.includes(method)) {
    return { valid: true };
  }

  if (!validateCsrfToken(request, sessionKey)) {
    return {
      valid: false,
      response: NextResponse.json(
        {
          error: 'CSRF validation failed',
          detail:
            'Missing or invalid X-CSRF-Token header. Call GET /api/csrf-token to obtain one.',
        },
        { status: 403 },
      ),
    };
  }

  return { valid: true };
}