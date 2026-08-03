# DeepMindQ Security Reference

> **STATUS**: WI-18.1 Hardened and Locked
> **LAST UPDATED**: 2026-08-03
> **CLASSIFICATION**: Enterprise Security Architecture Document

This document is the **authoritative security reference** for DeepMindQ. It covers authentication architecture, CSRF design, secret management, API protection model, security testing process, and incident response basics. Any security-related change MUST reference this document.

---

## 1. Authentication Architecture

### 1.1 OTP-Based Login Flow

DeepMindQ uses time-based one-time passwords (OTP) for user authentication. There are no passwords stored in the system.

**Flow:**
1. User submits email at `/api/auth/request-otp`
2. Server generates a 6-digit OTP, stores in `otpCache` (in-memory, TTL 5 minutes)
3. OTP is delivered via email (Resend provider)
4. User submits OTP at `/api/auth/verify-otp`
5. Server validates OTP with constant-time comparison (`timingSafeEqual`)
6. On success, server creates a session record in the database and sets `dmq_session` cookie
7. All subsequent requests use this session cookie for authentication

### 1.2 Session Management

- **Cookie**: `dmq_session` (HttpOnly, Secure in production, SameSite=Lax)
- **Validation**: `getCurrentSession()` in `src/lib/session.ts` reads the cookie, queries the database
- **Edge layer**: Middleware validates cookie existence for all protected routes before the request reaches the route handler
- **Client layer**: `AuthProvider` (React Context) calls `/api/auth/me` on mount and redirects to `/login` if no session exists

### 1.3 Auth Guard Pattern

All protected API routes MUST call `checkApiAuth()` at the top of their handler:

```typescript
import { checkApiAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;
  // ... proceed with authenticated logic
}
```

For admin-only operations, additionally call `requireAdminRole(session)`.

### 1.4 Route Protection Model

**Default: PROTECTED.** All `/api/*` routes require authentication unless explicitly listed in `PUBLIC_PATH_PREFIXES` (defined in `src/lib/auth-helpers.ts`).

**Public routes (intentionally unauthenticated):**

| Route Prefix | Reason |
|---|---|
| `/api/auth/*` | Login, OTP, registration — must work without session |
| `/api/webhooks/*` | Third-party callbacks (Resend bounces/replies) — use HMAC signatures instead |
| `/api/tracking/*` | Email tracking pixels — called from email clients |
| `/api/emails/track` | Email open/click tracking — called from email clients |
| `/api/unsubscribe` | Email preference management — one-click from emails |
| `/api/cron/*` | Scheduled tasks — authenticated via `CRON_SECRET` Bearer token |
| `/api/health`, `/api/ready`, `/api/ping`, `/api/version` | Infrastructure probes — called from monitoring |
| `/api/setup-db` | Initial database setup — authenticated via `SETUP_TOKEN` |

**To add a new public route**, you MUST update ALL of these:
1. `PUBLIC_PATH_PREFIXES` in `src/lib/auth-helpers.ts`
2. `PUBLIC_ROUTE_PREFIXES` in `scripts/api-security-scan.js`
3. Document the reason in the table above in this SECURITY.md

**CI enforces this automatically.** The API Security Contract scanner (`scripts/api-security-scan.js`) runs on every PR and fails if any non-public route lacks an auth guard.

---

## 2. CSRF Protection Design

### 2.1 Double-Submit Cookie Pattern

DeepMindQ uses the double-submit cookie pattern for CSRF protection:

1. **Token Generation**: On every page request, middleware generates a cryptographically random 64-hex-char token (`randomBytes(32)`) and sets it as the `csrf-token` cookie (non-HttpOnly, Secure in production, SameSite=Lax, 1-hour TTL)
2. **Client Reads Token**: `fetchApi.ts` reads the `csrf-token` cookie via `getCsrfToken()`
3. **Client Sends Token**: On all state-changing requests (POST, PUT, PATCH, DELETE), `fetchApi.ts` automatically adds the `x-csrf-token` header
4. **Server Validates**: Middleware compares the `x-csrf-token` header value against the `csrf-token` cookie using constant-time comparison (`timingSafeEqual`)

### 2.2 Why This Pattern

- **No server-side state**: Tokens are generated per-request, not stored server-side
- **SameSite=Lax backup**: Even without the CSRF check, SameSite=Lax prevents cross-site POST from external sites
- **Constant-time comparison**: Prevents timing attacks on the token comparison

### 2.3 Implementation Files

| File | Role |
|---|---|
| `src/lib/csrf.ts` | Token generation (`generateCsrfToken`) |
| `src/lib/auth-helpers.ts` | Token validation (`validateCsrf`, `csrfCheck`) |
| `src/lib/fetchApi.ts` | Client-side token injection (`getCsrfToken`, `isStateChangingMethod`) |
| `src/middleware.ts` | Edge-level enforcement (Layer 2 + Layer 3) |

### 2.4 Exemptions

- GET, HEAD, OPTIONS requests are exempt (safe methods by definition)
- Public API routes skip session/CSRF checks (handled at middleware Layer 3)

---

## 3. Security Headers

Applied to EVERY response via Edge middleware (`src/middleware.ts`), sourced from `getSecurityHeaders()` in `src/lib/auth-helpers.ts`.

| Header | Value | Purpose |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Prevent MIME type sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking via iframes |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS filter (defense in depth) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer leakage |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Disable browser APIs |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Force HTTPS for 1 year |
| `Content-Security-Policy` | See below | Prevent injection attacks |

### 3.1 Content-Security-Policy

```
default-src 'self'
script-src 'self'                          # Production: no unsafe-inline
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
font-src 'self' https://fonts.gstatic.com data:
img-src 'self' data: blob: https://*.googleusercontent.com
connect-src 'self' https://*.googleapis.com https://api.tavily.com
frame-ancestors 'none'
base-uri 'self'
form-action 'self'
```

**Key decisions:**
- `unsafe-inline` is NOT in `script-src` in production (no inline scripts allowed)
- `unsafe-eval` is allowed in development only (needed for Next.js HMR)
- `unsafe-inline` IS in `style-src` (needed for Google Fonts and Tailwind)

---

## 4. Secret Management

### 4.1 Required Secrets (Production)

| Secret | Purpose | Minimum Length | Generated With |
|---|---|---|---|
| `DATABASE_URL` | PostgreSQL connection | N/A | Neon console |
| `NEXTAUTH_SECRET` | Session signing | 32 chars | `openssl rand -base64 32` |
| `AUTHORIZED_EMAIL` | Admin login email | N/A | Manual |
| `TRACKING_SECRET` | Email tracking HMAC | 16 chars | `openssl rand -hex 32` |
| `API_KEY_ENCRYPTION_KEY` | AES-256-GCM encryption for API keys at rest | 32 chars | `openssl rand -base64 32` |
| `CRON_SECRET` | Cron job authentication | N/A | `openssl rand -hex 32` |

### 4.2 Enforcement

- **Production startup**: `validateEnv()` in `src/lib/validate-env.ts` throws an Error if any required secret is missing or too short. The application **refuses to start**.
- **Development**: Missing secrets generate warnings but do not block startup.
- **API_KEY_ENCRYPTION_KEY**: Without this key, AI provider API keys stored in the database are in PLAINTEXT. The startup validation explicitly warns about this risk.
- **No fallback secrets**: There are NO default values for security-critical variables. Production must have them set.

### 4.3 AI Provider API Keys

AI provider keys (OpenAI, Gemini, Groq, Fireworks, NVIDIA, Tavily) are OPTIONAL — the application degrades gracefully to template fallback when they're missing. These keys are encrypted at rest using AES-256-GCM with `API_KEY_ENCRYPTION_KEY`.

---

## 5. API Protection Model

### 5.1 Defense-in-Depth Layers

Every API request passes through these layers in order:

1. **Edge Middleware** (`src/middleware.ts`): Security headers, CSRF, session cookie check, rate limiting
2. **API Route Handler**: `checkApiAuth()` for session validation
3. **Input Validation**: Zod schemas validate all request bodies/params
4. **AI Governance**: `governedAI()` for all LLM calls (content policies, token limits, audit logging)
5. **Audit Logging**: Security events logged for compliance

### 5.2 API Security Checklist (for every new route)

When creating a new API route, the following checklist applies:

```
[ ] Authentication: Does this route need auth? If yes, add checkApiAuth().
    If no, add to PUBLIC_PATH_PREFIXES in auth-helpers.ts AND api-security-scan.js.
[ ] Authorization: Does this route need admin-only access? If yes, add requireAdminRole().
[ ] Input Validation: All request bodies MUST be validated with Zod schemas.
    Use validateBody(schema, body) from src/lib/apiHelpers.ts.
[ ] Error Handling: Use the standard pattern:
    - ok(data) for success (200)
    - err(message, status) for client errors (400/404)
    - Never throw — always return a JSON error response.
[ ] Rate Limiting: Does this route need custom rate limits?
    Use withApiMiddleware() or edgeRateLimit() for custom limits.
[ ] Sanitization: Any user-provided strings rendered in HTML MUST go through
    sanitizeString() or sanitizeHtml() from src/lib/sanitize.ts.
[ ] Audit Logging: Destructive operations (delete, bulk update, export) MUST
    be logged via logAction() from src/lib/audit.ts.
```

### 5.3 Automated Enforcement

The CI pipeline enforces items 1 (auth) and partially item 3 (validation exists in route handlers that use Zod) via:
- **Security gate tests**: Verify auth guards on AI routes
- **API Security Contract scanner**: Scans ALL routes for missing auth guards

---

## 6. Input Validation and Sanitization

### 6.1 Zod Validation (Boundary)

All user input is validated at the API boundary using Zod schemas defined in `src/lib/validations.ts`. Invalid input receives a 400 response before any business logic runs.

### 6.2 DOMPurify Sanitization (Output)

All user-provided strings that could be rendered as HTML are sanitized using DOMPurify (`src/lib/sanitize.ts`):
- `sanitizeString(str)` — Strips ALL HTML tags. Use for plain text fields.
- `sanitizeHtml(html)` — Allows safe formatting tags only (b, i, a, p, br, etc.). Use for rich text fields.

DOMPurify uses jsdom on the server side and falls back to regex stripping if jsdom is unavailable.

### 6.3 Timing-Safe Comparisons

All secret comparisons (CSRF tokens, OTPs, passwords) use `timingSafeEqual()` to prevent timing attacks.

---

## 7. Security Testing Process

### 7.1 CI Security Gates (automatic, every PR)

| Gate | What It Checks | Fails Build If |
|---|---|---|
| Security Regression Tests | 112 assertions across middleware, CSRF, auth, headers, CSP, DOMPurify, AuthProvider, env validation, CI config, API scanner | Any assertion fails |
| Middleware Existence | `src/middleware.ts` file exists | File deleted |
| CSRF Flow Integrity | Token generation, client sending, server validation all present | Any part broken |
| AI Route Auth | All `/api/ai/*` routes import `checkApiAuth` | Any route unprotected |
| Security Headers | All 7 required headers present in `getSecurityHeaders()` | Any header missing |
| DOMPurify Active | `isomorphic-dompurify` imported in `sanitize.ts` | Import removed |
| CSP Policy | No `unsafe-inline` in `script-src` for production | Found unsafe-inline |
| AuthProvider | Session check + redirect to `/login` | No-op detected |
| Environment Validation | `API_KEY_ENCRYPTION_KEY` validated, plaintext warning, production throw | Validation missing |
| Dependency Audit | `npm audit --audit-level=high` | Critical/high CVEs |
| API Security Contract | All non-public routes have auth guards | Unprotected route found |

### 7.2 Test Files

| File | Coverage |
|---|---|
| `tests/wi18-security-regression.test.ts` | 48 tests — middleware, CSRF, fetchApi, AI auth, DOMPurify, Zod, CSP, AuthProvider, headers, env docs, CI config |
| `tests/wi18-security-gate-integrity.test.ts` | 64 tests — middleware enforcement, CSRF flow, protected APIs, security headers, CSP hardening, DOMPurify, AuthProvider, secret docs, CI config, API scanner, env validation |
| `tests/security-auth.test.ts` | Authentication-specific tests |
| `tests/security-auth-blocking.test.ts` | Auth blocking for unauthenticated access |
| `tests/security-admin-routes.test.ts` | Admin-only route protection |

### 7.3 Running Security Tests Locally

```bash
# Run all security gate tests
npx vitest run tests/wi18-security-security-regression.test.ts tests/wi18-security-gate-integrity.test.ts

# Run API security contract scanner
node scripts/api-security-scan.js

# Run all security-related tests
npx vitest run tests/security-*.test.ts tests/wi18-*.test.ts
```

---

## 8. Deployment Security

### 8.1 Per-Customer Isolation

DeepMindQ is deployed as fully isolated, per-customer instances:
- Per-customer database (no shared data)
- Per-customer secrets (no shared credentials)
- Per-customer S3 storage (no shared files)
- Zero shared compute, storage, or network resources

### 8.2 Startup Validation

On production startup, `validateEnv()` (in `src/lib/validate-env.ts`) validates:
- `DATABASE_URL` is set
- `NEXTAUTH_SECRET` is set and >= 32 characters
- `AUTHORIZED_EMAIL` is set
- `TRACKING_SECRET` is set and >= 16 characters
- `API_KEY_ENCRYPTION_KEY` is set and >= 32 characters

Missing or invalid secrets cause the application to **refuse to start** with a clear error message. No silent downgrade.

---

## 9. AI Governance

### 9.1 Governed AI Pattern

All calls to external LLM providers pass through `governedAI()` which enforces:
- Content policies (block harmful output)
- Token limits (prevent cost runaway)
- Audit logging (all AI interactions logged)
- Provider failover (automatic fallback to next provider)

### 9.2 Non-Throwing AI Architecture

AI components are strategic assets. They never throw exceptions that crash the application. All errors are caught, logged, and returned as structured error responses.

---

## 10. Incident Response Basics

### 10.1 Severity Classification

| Severity | Example | Response Time |
|---|---|---|
| **Critical** | Data breach, auth bypass, active exploitation | Immediate (within 1 hour) |
| **High** | CSRF broken, security header missing in production | Within 4 hours |
| **Medium** | Missing rate limit on sensitive endpoint, dev-mode CSP in prod | Within 24 hours |
| **Low** | Documentation gap, non-critical test failure | Within 1 week |

### 10.2 Response Process

1. **Contain**: If active exploitation, revoke sessions, rotate secrets, block IPs
2. **Assess**: Determine scope, affected data, attack vector
3. **Fix**: Patch the vulnerability, add regression test
4. **Verify**: Run full security gate suite, confirm all gates pass
5. **Communicate**: Notify affected users if data was compromised

### 10.3 Secret Rotation

If a secret is compromised:
1. Generate a new secret using `openssl rand -base64 32` (or `openssl rand -hex 32` for hex)
2. Update the environment variable in the deployment platform
3. Redeploy the application
4. Invalidate all existing sessions (users will need to re-login)

---

## 11. Vulnerability Reporting

If you discover a security vulnerability, please report it responsibly:

1. **Email**: security@deepmindq.com
2. **Do NOT** create a public GitHub issue for security vulnerabilities
3. **Private disclosure**: We will acknowledge receipt within 48 hours
4. **Response time**: Initial response within 48 hours of report

We appreciate responsible disclosure and will credit researchers who follow this process (unless you prefer anonymity).

---

## 12. Supported Versions

Only the **current `main` branch** is supported. Security patches are not maintained for older branches or tags. Always deploy from the latest `main`.

---

## 13. Security Gate CI Architecture

```
PR opened / Push to main or develop
        │
        ▼
┌─────────────────────────┐
│   security-gate (first)  │  ← 9 inline checks + 112 test assertions
│   - Middleware exists?   │
│   - CSRF flow intact?    │
│   - AI routes authed?    │
│   - Headers present?     │
│   - DOMPurify active?     │
│   - CSP hardened?         │
│   - AuthProvider works?   │
│   - Env validation?       │
└────────┬────────┬────────┘
         │        │
    PASS │        │ FAIL
         │        ▼
         │   BUILD BLOCKED
         ▼
┌─────────────────────────┐
│   dependency-audit       │  ← npm audit --audit-level=high
└────────┬────────────────┘
         │
    PASS │
         ▼
┌─────────────────────────┐
│   api-security-contract  │  ← scans 239 routes for missing auth
└────────┬────────────────┘
         │
    PASS │
         ▼
┌─────────────────────────┐
│   lint-and-typecheck     │  ← ESLint + TypeScript strict
│   (depends: security-gate,│
│    api-security-contract) │
└────────┬────────────────┘
         │
    PASS │
         ▼
┌─────────────────────────┐
│   test                   │  ← Vitest (all tests)
└────────┬────────────────┘
         │
    PASS │
         ▼
┌─────────────────────────┐
│   build                  │  ← next build (production)
│   (depends: lint, test,  │
│    dependency-audit)     │
└────────┬────────────────┘
         │
    PASS │
         ▼
      MERGE OK
```

Security gates run FIRST. If they fail, nothing else runs. A security regression CANNOT merge.
