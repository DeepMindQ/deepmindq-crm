# Security Policy

## Security Model Summary

DeepMindQ implements defense-in-depth across multiple layers:

- **OTP Authentication** — Time-based one-time passwords for user authentication.
- **CSRF Enforcement** — Double-submit cookie pattern enforced via middleware on all state-changing requests.
- **AES-256-GCM Key Encryption** — Encryption keys at rest are encrypted with AES-256-GCM using a master key.
- **Rate Limiting** — Per-route and per-user rate limiting to prevent abuse.
- **Input Validation (Zod)** — All user input is validated at the boundary using Zod schemas; nothing reaches business logic unvalidated.
- **CORS Policy** — Strict, explicitly-configured CORS origins. No wildcards in production.
- **Timing-Safe Comparisons** — All secret comparisons (passwords, tokens, OTPs) use constant-time comparison functions to prevent timing attacks.

## Dedicated Deployment Security

DeepMindQ is deployed as a fully isolated, per-customer instance. There is **zero shared infrastructure** between tenants:

- **Per-customer database** — Each customer has their own isolated database instance.
- **Per-customer secrets** — Encryption keys, API keys, and credentials are scoped to a single customer and never shared.
- **Per-customer S3 storage** — File storage buckets are provisioned per customer with isolated access policies.
- **Zero shared infrastructure** — No shared compute, storage, or network resources between customer deployments.

## Vulnerability Reporting

If you discover a security vulnerability, please report it responsibly:

1. **Email** your report to **security@deepmindq.com**.
2. **Do not create a public GitHub issue** for security vulnerabilities. Public disclosure puts users at risk.
3. **Private disclosure** — We will acknowledge receipt within 48 hours and work with you on a coordinated fix.
4. **Expected response time** — You should receive an initial response within 48 hours of your report. We will keep you informed of progress toward a fix.

We appreciate responsible disclosure and will credit researchers who follow this process (unless you prefer to remain anonymous).

## Security Architecture Layers

The following layers are applied in order on every request:

1. **Environment validation at startup** — `validate-env.ts` verifies all required secrets and configuration values are present. The application refuses to start if any are missing. No fallbacks, no defaults for secrets.
2. **Security headers via middleware** — `middleware.ts` applies `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`, and other security headers to all responses.
3. **Path traversal blocking** — The middleware blocks requests containing path traversal sequences (`..`, encoded variants) before they reach route handlers.
4. **CSRF token enforcement** — Double-submit cookie pattern validates CSRF tokens on all `POST`, `PUT`, `PATCH`, and `DELETE` requests.
5. **Per-route rate limiting** — Configurable rate limits per API route to prevent brute-force and abuse.
6. **Auth guards (198/223 routes)** — 198 of 223 routes require authentication. Unauthenticated requests to protected routes receive a 401 response.
7. **Admin-only gates on destructive operations** — Operations such as user deletion, bulk data export, and system configuration changes require admin-level authorization in addition to standard authentication.
8. **Input validation with Zod** — Every API endpoint validates request bodies, query parameters, and path parameters against Zod schemas. Invalid input is rejected with a 400 response and no data is processed.
9. **AI governance for all LLM calls** — All calls to external LLM providers pass through `governedAI()`, which enforces content policies, token limits, and audit logging. Direct LLM API calls are not permitted.
10. **Audit logging** — Security-relevant events (authentication attempts, authorization failures, destructive operations, AI governance actions) are logged for compliance and incident response.

## Supported Versions

Only the **current `main` branch** is supported. We do not maintain security patches for older branches or tags. Always deploy from the latest `main`.
