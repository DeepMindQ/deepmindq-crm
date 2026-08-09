# Middleware → Proxy Migration: Security Completeness Audit

**Date**: 2026-08-08
**Scope**: `src/middleware.ts` (deleted) → `src/proxy.ts` (current)  
**Supporting modules reviewed**: `src/lib/auth-helpers.ts`, `src/lib/csrf.ts`, `src/lib/with-csrf.ts`, `src/lib/fetchApi.ts`, `next.config.ts`

---

## Summary

| Verdict | Detail |
|---|---|
| **CRITICAL GAP** | CSRF token **generation & cookie issuance** was removed. No code path sets the `csrf-token` cookie. All state-changing API calls will fail with 403. |
| **MEDIUM GAP** | CSRF token is no longer exposed in the `x-csrf-token` **response header** on safe API requests, breaking any client code that relied on header-based token retrieval. |
| **LOW GAP** | Proxy header comment claims "CORS / Preflight handling" — no such code exists (was not in old middleware either; misleading documentation). |
| **IMPROVEMENT** | proxy.ts adds authentication enforcement, per-endpoint rate limiting (registry), audit logging, and public-path whitelisting — none of which existed in the old middleware. |

---

## Feature-by-Feature Comparison

### 1. Security Headers (CSP, HSTS, X-Frame-Options, etc.)

| Check | Old `middleware.ts` | New `proxy.ts` + `auth-helpers.ts` | Status |
|---|---|---|---|
| Content-Security-Policy | Inline `getSecurityHeaders()` | Delegated to `auth-helpers.ts` `getSecurityHeaders()` | ✅ Preserved |
| X-Frame-Options: DENY | ✅ | ✅ | ✅ Preserved |
| X-Content-Type-Options: nosniff | ✅ | ✅ | ✅ Preserved |
| X-XSS-Protection: 1; mode=block | ✅ | ✅ | ✅ Preserved |
| Referrer-Policy | ✅ | ✅ | ✅ Preserved |
| Permissions-Policy | ✅ | ✅ | ✅ Preserved |
| Strict-Transport-Security | ✅ | ✅ | ✅ Preserved |
| CSP dev/prod toggle | ✅ (`unsafe-eval` in dev) | ✅ (identical logic) | ✅ Preserved |
| Applied to ALL responses | ✅ (line 155) | ✅ (line 68, plus every branch) | ✅ Preserved |

### 2. CSRF Protection — Double-Submit Cookie

| Check | Old `middleware.ts` | New `proxy.ts` + `auth-helpers.ts` | Status |
|---|---|---|---|
| Timing-safe comparison | ✅ `timingSafeEqual()` (inline) | ✅ `timingSafeEqual()` in `auth-helpers.ts` | ✅ Preserved |
| Validate header vs cookie match | ✅ Lines 206–217 | ✅ `validateCsrf()` in `auth-helpers.ts` | ✅ Preserved |
| 403 on CSRF failure | ✅ | ✅ (proxy.ts lines 112–117) | ✅ Preserved |
| **Generate CSRF token** (Web Crypto) | ✅ `generateCsrfToken()` (line 68–72) | ❌ **NOT PRESENT** | 🔴 **LOST** |
| **Set csrf-token cookie on page requests** | ✅ Lines 161–170 | ❌ **NOT PRESENT** | 🔴 **LOST** |
| **Set csrf-token cookie on safe API requests** | ✅ Lines 178–189 | ❌ **NOT PRESENT** | 🔴 **LOST** |
| **Expose token in x-csrf-token response header** | ✅ Line 193 (safe methods), line 221 (after validation) | ❌ **NOT PRESENT** | 🟡 **LOST** |
| Skip prefixes for auth/webhooks/tracking/cron | ✅ `CSRF_SKIP_PREFIXES` | ✅ Covered by `PUBLIC_PATH_PREFIXES` in `auth-helpers.ts` | ✅ Preserved |
| Cookie attributes (httpOnly, secure, sameSite, path, maxAge) | ✅ | N/A (no cookie set) | 🔴 LOST |

**Impact**: `src/lib/fetchApi.ts` reads the CSRF token from `document.cookie` (line 16, comment: "The Edge middleware injects this cookie on every page load"). Since no code sets this cookie, `getCsrfToken()` always returns `null`, and all POST/PUT/DELETE/PATCH requests via `fetchApi` will send no `x-csrf-token` header, causing proxy.ts to reject them with 403.

**Note**: `src/lib/csrf.ts` has a `generateCsrfToken()` but uses Node.js `crypto.randomBytes` — **not Edge-compatible**. The old middleware used `crypto.getRandomValues()` (Web Crypto) specifically for Edge compatibility.

### 3. Authentication Enforcement

| Check | Old `middleware.ts` | New `proxy.ts` | Status |
|---|---|---|---|
| Session token check for /api/* | ❌ Not in middleware (handled at route level) | ✅ `getSessionToken()` + 401 response | 🟢 **NEW** |
| Page route redirect to /login | ❌ Not in middleware | ✅ `handlePageRoute()` (line 173–192) | 🟢 **NEW** |
| Audit logging on auth failure | ❌ | ✅ `auditAuthFailure()` (line 102) | 🟢 **NEW** |

### 4. Rate Limiting

| Check | Old `middleware.ts` | New `proxy.ts` | Status |
|---|---|---|---|
| OTP rate limiting | ❌ Not in middleware | ✅ `otpRateLimit()` (5/min) | 🟢 **NEW** |
| General API rate limiting | ❌ Not in middleware | ✅ `generalApiRateLimit()` (100/min) | 🟢 **NEW** |
| Per-endpoint registry limits | ❌ | ✅ `getRateLimitConfig()` + `edgeRateLimit()` | 🟢 **NEW** |
| Rate limit response headers (X-RateLimit-*) | ❌ | ✅ Lines 146–149, 163–165, 235–237 | 🟢 **NEW** |
| Rate limiting for public auth APIs | ❌ | ✅ `applyRateLimiting()` (line 197–240) | 🟢 **NEW** |

### 5. Public Path Whitelist

| Check | Old `middleware.ts` | New `proxy.ts` | Status |
|---|---|---|---|
| Public path list | N/A (middleware didn't do auth) | ✅ `PUBLIC_PATH_PREFIXES` (17 entries) | 🟢 **NEW** |
| Rate-limited public API list | N/A | ✅ `RATE_LIMITED_PUBLIC_APIS` (4 entries) | 🟢 **NEW** |

### 6. CORS / Preflight Handling

| Check | Old `middleware.ts` | New `proxy.ts` | Status |
|---|---|---|---|
| CORS headers | ❌ Not present | ❌ Not present | — No change |
| Preflight (OPTIONS) handling | ❌ Not present (OPTIONS treated as safe method) | ❌ Not present (OPTIONS in safe-methods list) | — No change |

**Note**: `proxy.ts` header comment (line 13) claims responsibility for "CORS / Preflight handling" — this is **misleading documentation**. Neither file implements CORS.

### 7. Matcher Configuration

| Check | Old `middleware.ts` | New `proxy.ts` | Status |
|---|---|---|---|
| Exclude _next/static | ✅ | ✅ | ✅ |
| Exclude _next/image | ✅ | ✅ | ✅ |
| Exclude favicon.ico | ✅ | ✅ | ✅ |
| Exclude robots.txt | ✅ | ❌ (will run proxy on it — harmless) | 🟢 Acceptable |
| Exclude sitemap.xml | ✅ | ❌ (will run proxy on it — harmless) | 🟢 Acceptable |
| Exclude _next/webpack | ❌ | ✅ | 🟢 **Improved** |
| Exclude static file extensions | ❌ | ✅ (svg, png, jpg, gif, webp, ico, css, js, woff, etc.) | 🟢 **Improved** |

### 8. Audit Logging

| Check | Old `middleware.ts` | New `proxy.ts` | Status |
|---|---|---|---|
| Auth failure audit | ❌ | ✅ `auditAuthFailure()` | 🟢 **NEW** |
| CSRF failure audit | ❌ | ✅ `auditCsrfFailure()` | 🟢 **NEW** |

---

## Gaps Detail

### GAP-1 (CRITICAL): CSRF Cookie Never Issued

**What was lost**: The old middleware generated a 32-byte random CSRF token via `crypto.getRandomValues()` (Edge-compatible Web Crypto) and set it as an `httpOnly`, `SameSite=Lax` cookie named `csrf-token` on:
1. Every page request (if cookie absent)
2. Every safe API request (if cookie absent)

It also exposed the token in the `x-csrf-token` response header so the client could read it.

**Current state**: No code in `proxy.ts`, `auth-helpers.ts`, or anywhere in the codebase sets the `csrf-token` cookie. The client-side `fetchApi.ts` relies on this cookie existing (line 12 comment: "The Edge middleware injects this cookie on every page load").

**Consequence**: All POST/PUT/DELETE/PATCH API requests will fail with 403 "CSRF validation failed".

**Fix required**: Add CSRF cookie generation and issuance to `proxy.ts`. Example:
```typescript
// Add to proxy.ts — in the public path branch and page route handler
function ensureCsrfCookie(request: NextRequest, response: NextResponse): string {
  const existing = getCsrfCookie(request);
  if (existing) return existing;
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  response.cookies.set('csrf-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  });
  return token;
}
```

### GAP-2 (MEDIUM): CSRF Token Not Exposed in Response Headers

**What was lost**: Old middleware set `x-csrf-token` response header on safe API requests and after successful CSRF validation, enabling header-based token retrieval.

**Current state**: Not set anywhere. Client reads from cookie only (which is also not set — see GAP-1).

**Fix**: After generating/reading the CSRF cookie in proxy.ts, also set `response.headers.set('x-csrf-token', token)`.

### GAP-3 (LOW): Misleading CORS Comment

**What**: proxy.ts line 13 claims "5. CORS / Preflight handling" but no CORS code exists.

**Fix**: Remove or update the comment. If CORS is needed, implement it.

---

## Improvements in proxy.ts (Not in Old Middleware)

1. **Authentication enforcement** at edge level — session required for all non-public API and page routes
2. **Rate limiting** — OTP (5/min), general API (100/min), per-endpoint registry
3. **Audit logging** — auth failures and CSRF failures logged
4. **Public path whitelist** — 17 explicit public path prefixes
5. **Rate limit headers** — X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-RateLimit-Policy
6. **Botnet protection** — rate limit store eviction when exceeding 50k entries
7. **Broader static file exclusion** in matcher (font files, CSS, JS, image extensions)

---

## Stale References

| File | Line | Issue |
|---|---|---|
| `next.config.ts` | 35 | Comment references `src/middleware.ts` — should say `src/proxy.ts` |
| `src/lib/auth-helpers.ts` | 6 | Comment says "for use in both middleware.ts and API routes" — should say `proxy.ts` |

---

## Conclusion

The migration from `middleware.ts` to `proxy.ts` **gains** authentication enforcement, rate limiting, and audit logging. However, it **loses** the CSRF token issuance mechanism that is critical for the double-submit cookie pattern to function. Without fixing GAP-1, all state-changing API requests via the standard `fetchApi` client will be rejected with 403. This is a blocking issue that must be resolved before the proxy.ts migration is considered complete.
