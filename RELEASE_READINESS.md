# DeepMindQ — Release Readiness Document

**Commit:** `8805bc5c`
**Date:** 2026-08-08
**Status:** CI GREEN — All 11 blocking jobs passed
**Phase:** CI Stabilization Complete → Production Deployment Readiness Audit

---

## 1. CI Status

### 1.1 Baseline Commit

| Field | Value |
|-------|-------|
| Commit hash | `8805bc5c` |
| Branch | `main` / `develop` |
| CI workflow | `.github/workflows/ci.yml` |
| Total blocking jobs | **11** (all passing) |
| Total non-blocking jobs | **12** (allowed to fail) |
| Node version | 22 |
| Test framework | Vitest 4.x |
| Runtime | Next.js 16.1.1, React 19 |

### 1.2 Blocking CI Jobs (All Passing)

| # | Job Name | Vitest Config | Command | Services | Status |
|---|----------|--------------|---------|----------|--------|
| 1 | Security Gate | `vitest.security.config.ts` | `npx vitest run --config vitest.security.config.ts` | None | ✅ |
| 2 | Dependency Audit | N/A | `node scripts/dependency-audit-ci.js` | None | ✅ |
| 3 | API Security Contract | N/A | `node scripts/api-security-scan.js` | None | ✅ |
| 4 | Lint + Typecheck | N/A | `npm run lint && npm run lint:strict && npx tsc --noEmit` | None | ✅ |
| 5 | Unit Tests | `vitest.unit.config.ts` | `npx vitest run --config vitest.unit.config.ts` | None | ✅ |
| 6 | Security Tests | `vitest.security.config.ts` | `npx vitest run --config vitest.security.config.ts` | None | ✅ |
| 7 | API Tests | `vitest.api.config.ts` | `npx vitest run --config vitest.api.config.ts` | PostgreSQL 16 | ✅ |
| 8 | Database Tests | `vitest.database.config.ts` | `npx vitest run --config vitest.database.config.ts` | PostgreSQL 16 | ✅ |
| 9 | Integration Tests | `vitest.integration.config.ts` | `npx vitest run --config vitest.integration.config.ts` | None | ✅ |
| 10 | M5 Intelligence Tests | `vitest.m5.config.ts` | `npx vitest run --config vitest.m5.config.ts --reporter=verbose` | None | ✅ |
| 11 | Build Verification | N/A | `npm run build:vercel` | None | ✅ |

### 1.3 Non-Blocking CI Jobs (Allowed to Fail)

| Job Name | Config | Purpose |
|----------|--------|---------|
| AI Engine | `vitest.ai.config.ts` | AI model inference tests |
| AI Governance | `vitest.ai-governance.config.ts` | Prompt registry, config coverage |
| AI Retrieval | `vitest.ai-retrieval.config.ts` | Hybrid search, knowledge graph |
| AI Framework | `vitest.ai-framework.config.ts` | Agent framework, memory |
| AI Inference | `vitest.ai-inference.config.ts` | Hallucination, confidence engine |
| E2E Tests | `vitest.e2e.config.ts` | Business journey tests |
| Performance | `vitest.performance.config.ts` | Benchmarks, scale, memory |
| UI Components | `vitest.ui.config.ts` | React component tests (jsdom) |
| Playwright E2E | Playwright | Browser-based E2E |

### 1.4 Root Causes Fixed During CI Stabilization

The CI stabilization effort (3 days) addressed the following categories of issues:

- **Test architecture sprawl**: Multiple overlapping vitest configurations with unclear boundaries. Fixed by clarifying include/exclude patterns per config and establishing the CI matrix above.
- **Vitest worker teardown instability**: Workers crashed after test completion, causing false-negative CI failures. Mitigated with `tee` + `PIPESTATUS` pattern that distinguishes test failures from teardown errors.
- **Security gate structural checks**: Codified CSRF flow integrity, AI route authentication, security headers, DOMPurify presence, CSP policy, AuthProvider session validation, and environment validation as shell-based static analysis gates in CI.
- **Dependency audit exceptions**: Documented accepted upstream vulnerabilities (postcss via Next.js 16, protobufjs/sharp/onnxruntime-web via @xenova/transformers) with risk mitigation rationale. New actionable vulnerabilities still block CI.
- **API security contract**: Static scanner ensures every non-public API route has `checkApiAuth`, `withApiMiddleware`, or `getCurrentSession` — prevents auth bypass regressions.

---

## 2. Environment Requirements

### 2.1 Required Environment Variables for Production

| Variable | Required | Description | Generation |
|----------|----------|-------------|------------|
| `DATABASE_URL` | **YES** | PostgreSQL connection (pgBouncer URL for app queries) | Neon console |
| `DIRECT_DATABASE_URL` | **YES** | PostgreSQL direct connection (for Prisma migrations) | Neon console |
| `SESSION_TOKEN_HMAC_SECRET` | **YES** (min 32 chars) | HMAC secret for session token signing | `openssl rand -base64 32` |
| `NEXTAUTH_SECRET` | Legacy fallback | Accepted for backward compat (deprecated name) | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Recommended | Public base URL (default: `http://localhost:3000`) | Manual |
| `AUTHORIZED_EMAIL` | **YES** | Single admin email allowed to log in | Manual |
| `TRACKING_SECRET` | **YES** (min 16 chars) | HMAC secret for email tracking token signing | `openssl rand -hex 32` |
| `API_KEY_ENCRYPTION_KEY` | **YES** (min 32 chars) | AES-256-GCM key for encrypting AI API keys at rest | `openssl rand -base64 32` |

### 2.2 Optional but Recommended Variables

| Variable | Description | Default/Fallback |
|----------|-------------|-----------------|
| `NVIDIA_API_KEY` | Primary AI provider (Llama 3.1 8B, free ~40 RPM) | Template fallback |
| `FIREWORKS_API_KEY` | Backup AI provider (Llama 3.3 70B, free tier) | Template fallback |
| `GROQ_API_KEY` | Fallback AI provider (Llama 3.3 70B, free tier) | Template fallback |
| `GEMINI_API_KEY` | Fallback AI (Gemini 2.0 Flash, free tier) | Template fallback |
| `TAVILY_API_KEY` | Web search (free 1000/month) | No web search |
| `EMAIL_PROVIDER` | Email service (`resend`) | No email |
| `EMAIL_API_KEY` | Resend API key (`re_xxx...`) | OTP login disabled |
| `EMAIL_FROM` | Sender email (verified domain) | No email |
| `CLEARBIT_API_KEY` | Company enrichment (free 50/month) | AI estimation |
| `CRON_SECRET` | Bearer token for Vercel Cron auth | `openssl rand -hex 32` |
| `RESEND_WEBHOOK_SECRET` | HMAC signing for Resend webhooks | From Resend dashboard |
| `SETUP_TOKEN` | One-time token for `/api/setup-db` | `openssl rand -hex 32` |
| `NEXT_PUBLIC_APP_URL` | Public URL for email links/tracking pixels | Derived from NEXTAUTH_URL |
| `SENTRY_DSN` | Server-side Sentry DSN | No error tracking |
| `NEXT_PUBLIC_SENTRY_DSN` | Client-side Sentry DSN | No client error tracking |
| `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | File attachment storage | No file uploads |

### 2.3 Production Validation Enforcement

The `validateEnv()` function in `src/lib/validate-env.ts` enforces the following at startup in production (exits process on failure):

1. `SESSION_TOKEN_HMAC_SECRET` or `NEXTAUTH_SECRET` must be set and >= 32 characters
2. `DATABASE_URL` must be set
3. `TRACKING_SECRET` must be set and >= 16 characters
4. `AUTHORIZED_EMAIL` must be set
5. `API_KEY_ENCRYPTION_KEY` must be set and >= 32 characters (WI-18.1 LOCK — prevents plaintext API key storage)

In development, these emit warnings but do not block startup.

### 2.4 Variables Required by CI (from GitHub Secrets)

| Secret | Used In | CI Job |
|--------|---------|--------|
| `DATABASE_URL` | test-api, test-database, build | PostgreSQL connection |
| `NEXTAUTH_SECRET` | build | Next.js build |
| `API_KEY_ENCRYPTION_KEY` | build | Encryption at build time |
| `TRACKING_SECRET` | build | Tracking token generation |
| `AUTHORIZED_EMAIL` | build | Build-time validation |

### 2.5 Variables Required by Deployment Workflows

| Secret | Used In | Workflow |
|--------|---------|----------|
| `VERCEL_TOKEN` | Deploy Production, Deploy Staging | Vercel API auth |
| `VERCEL_ORG_ID` | Deploy Production, Deploy Staging | Vercel org |
| `VERCEL_PROJECT_ID` | Deploy Production, Deploy Staging | Vercel project |
| `DATABASE_URL` | Deploy Production (build + migrate) | Production DB |
| `DIRECT_DATABASE_URL` | Deploy Production (migrate) | Migration DB |
| `STAGING_DATABASE_URL` | Deploy Staging | Staging DB |
| `STAGING_DIRECT_DATABASE_URL` | Deploy Staging (migrate) | Staging migration DB |
| `STAGING_NEXTAUTH_SECRET` | Deploy Staging (build) | Staging auth |
| `STAGING_AUTHORIZED_EMAIL` | Deploy Staging (build) | Staging login |

---

## 3. Database Requirements

### 3.1 Prisma Configuration

| Setting | Value |
|---------|-------|
| Provider | PostgreSQL |
| Client version | Prisma 6.19.3 |
| Relation mode | `foreignKeys` |
| Preview features | `relationJoins` |
| Migration count | 2 migrations |

### 3.2 Migration History

| Migration | Date | Description |
|-----------|------|-------------|
| `20260701000000_init_baseline` | 2026-07-01 | Initial schema baseline (all core models) |
| `20260807000000_add_company_parent_subsidiary` | 2026-08-07 | Company parent/subsidiary fields + Advisor tables (Conversation, Message, Workspace, Escalation, SavedBriefing) |

### 3.3 Migration Safety

- **Baseline handling (P3005)**: Both `deploy-production.yml` and `deploy-staging.yml` handle the case where a production database has schema but no migration history. They run `prisma migrate resolve --applied 20260701000000_init_baseline` to establish the baseline without re-applying DDL.
- **Pre-migration backup**: Production deploy creates a `pg_dump` backup before running any pending migrations. Falls back to Neon PITR (Point-in-Time Recovery) if `pg_dump` is unavailable.
- **Dry-run check**: Both deploy workflows check `prisma migrate status` first and skip migration if no pending migrations exist.

### 3.4 Seed Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `scripts/seed-ci.ts` | Deterministic CI test data (10 companies, 10 contacts, etc.) | `npx tsx scripts/seed-ci.ts` — CI only |
| `scripts/seed.ts` | General purpose seed | `npx tsx scripts/seed.ts` |
| `scripts/seed-demo.ts` | Demo data | Manual |
| `scripts/seed-enterprise-data.ts` | Enterprise demo data | Manual |
| `scripts/seed-data-intelligence.ts` | Intelligence data | Manual |

**Production note**: No seed script should be run against production. CI seed is specifically designed with deterministic IDs for test reproducibility.

### 3.5 PostgreSQL Compatibility

- **Target**: PostgreSQL 16 (Alpine) — used in CI, Docker Compose, and recommended for production
- **Recommended provider**: Neon (serverless PostgreSQL) — native Vercel integration, pgbouncer support, PITR
- **Connection pooling**: App queries use pgbouncer URL (`?pgbouncer=true`), migrations use direct URL (raw TCP)
- **Connection limits**: Auto-detected — 10 for Vercel/AWS Lambda, 20 for standard environments. Configurable via `connection_limit` query param in DATABASE_URL.

---

## 4. Security Readiness

### 4.1 CSRF Protection

| Component | Status | Details |
|-----------|--------|---------|
| Token generation | ✅ | `src/lib/csrf.ts` — `generateCsrfToken()` using `crypto.randomBytes(32)` |
| Token validation | ✅ | `timingSafeEqual()` constant-time comparison |
| Edge middleware | ✅ | `src/proxy.ts` — validates CSRF on all state-changing API requests |
| Client integration | ✅ | `src/lib/fetchApi.ts` — automatically injects `x-csrf-token` header |
| Auth helper integration | ✅ | `src/lib/auth-helpers.ts` — `validateCsrf()` with timing-safe comparison |
| CI enforcement | ✅ | Security gate verifies `generateCsrfToken`, `timingSafeEqual`, `validateCsrf` in source |

### 4.2 Security Headers

Applied via `getSecurityHeaders()` in `src/lib/auth-helpers.ts` and injected by Edge proxy (`src/proxy.ts`) on every response:

| Header | Value | Status |
|--------|-------|--------|
| `X-Content-Type-Options` | `nosniff` | ✅ |
| `X-Frame-Options` | `DENY` | ✅ |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | ✅ |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'` (prod) | ✅ |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | ✅ |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | ✅ |
| `X-XSS-Protection` | `1; mode=block` | ✅ |
| `poweredByHeader` | `false` (next.config.ts) | ✅ |
| `unsafe-inline` in CSP | **Blocked** — CI gate verifies | ✅ |

### 4.3 Authentication Flow

| Component | Details |
|-----------|---------|
| Session system | Custom HMAC-based session tokens (NOT NextAuth) |
| Cookie name | `dmq_session` |
| Session check | `src/providers/auth-provider.tsx` calls `/api/auth/me` on mount |
| Redirect | Unauthenticated page access → redirect to `/login` |
| Edge enforcement | `src/proxy.ts` — all non-public `/api/*` routes require session token |
| Rate limiting | OTP: 5 requests/email/minute; General API: 100 requests/IP/minute |
| Audit logging | Auth failures logged via `auditAuthFailure()` in `src/lib/audit-logger.ts` |

### 4.4 Authorization Boundaries

| Layer | Mechanism |
|-------|-----------|
| Edge proxy | `src/proxy.ts` — session token required for all non-public routes |
| API routes | `checkApiAuth()` / `withApiMiddleware()` / `getCurrentSession()` |
| Static CI scan | `scripts/api-security-scan.js` — enforces auth guard on every non-public route |
| AI routes | CI gate verifies `checkApiAuth` in all `src/app/api/ai/*/route.ts` files |
| Public routes | Whitelist in `PUBLIC_PATH_PREFIXES` (auth-helpers.ts) + `PUBLIC_ROUTE_PREFIXES` (api-security-scan.js) |

### 4.5 API Route Protection

- **Public paths** (exempt from auth): `/api/auth/`, `/api/webhooks/`, `/api/tracking/`, `/api/cron/`, `/api/health/`, `/api/ping`, `/api/ready`, `/api/version`, `/api/verify-email`, `/api/brand`, `/api/docs`, `/api/integrations/slack`, `/api/integrations/zapier`, `/api/monitoring`, `/api/v1`
- **All other API routes**: Must contain `checkApiAuth`, `withApiMiddleware`, or `getCurrentSession` — enforced by CI static scanner

### 4.6 PII Encryption

| Component | Status | Details |
|-----------|--------|---------|
| Encryption at rest | ✅ | AES-256-GCM via `src/lib/encryption.ts` |
| Prisma extension | ✅ | `src/lib/prisma-encryption-middleware.ts` — transparent decrypt on read |
| Contact PII fields | ✅ | `email`, `phone`, `linkedinUrl`, `rawName`, `normalizedName` |
| User PII fields | ✅ | `email`, `phone` |
| Key requirement | ✅ | `API_KEY_ENCRYPTION_KEY` (32+ chars) enforced in production via `validateEnv()` |
| Plaintext warning | ✅ | Dev mode warns if key missing; production exits |

### 4.7 Input Sanitization

| Component | Status | Details |
|-----------|--------|---------|
| HTML sanitization | ✅ | `src/lib/sanitize.ts` — DOMPurify (`isomorphic-dompurify`) |
| CI enforcement | ✅ | Security gate verifies `isomorphic-dompurify` in sanitize.ts |
| Fallback | ✅ | Regex strip if DOMPurify/jsdom unavailable |

### 4.8 Audit Logging

- Structured audit trail in `src/lib/audit-logger.ts`
- Categories: auth, authorization, csrf, rate_limit, admin, data_export, data_import, data_delete, config_change, webhook, security
- Severity levels: info, warn, critical
- Persisted to AuditLog Prisma model + real-time structured logger
- Non-blocking — audit failures never impact request handling

---

## 5. Deployment Readiness

### 5.1 Deployment Targets

| Target | Configuration | Status |
|--------|--------------|--------|
| **Vercel (primary)** | `vercel.json`, `build:vercel` script | ✅ Ready |
| **Docker (self-hosted)** | `Dockerfile`, `docker-compose.yml` | ✅ Ready |
| **Render/Railway/Fly.io** | Via standalone output in `next.config.ts` | ✅ Compatible |

### 5.2 Build Configuration

| Setting | Value | Notes |
|---------|-------|-------|
| Build command | `npx prisma generate && npx next build` | `build:vercel` — skips migrate deploy |
| Output mode | Standalone (non-Vercel) / Vercel default (Vercel) | `next.config.ts` conditional |
| TypeScript strict | `ignoreBuildErrors: false` | Type errors block build |
| React strict mode | `true` | |
| Compression | `true` | |
| External packages | `nodemailer` | `serverExternalPackages` |
| Bundle analysis | `ANALYZE=true npm run build` | Optional |
| Vercel region | `bom1` (Mumbai) | `vercel.json` |

### 5.3 Docker Build Details

| Stage | Base Image | Purpose |
|-------|-----------|---------|
| deps | `node:20-alpine` | Install production dependencies |
| builder | `node:20-alpine` | Prisma generate + migrate deploy + Next.js build |
| runner | `node:20-alpine` | Minimal production image with standalone output |

- Non-root user (`nextjs:nodejs`) in production stage
- Health check: `wget -qO- http://localhost:3000/api/health` every 30s
- Exposed port: 3000

### 5.4 Runtime Environment

| Component | Version/Value |
|-----------|--------------|
| Node.js | 22 (CI) / 20 (Docker alpine) |
| Next.js | 16.1.1 |
| React | 19.0.0 |
| Prisma | 6.19.3 |
| npm | >= 10.0.0 |

### 5.5 Database Connection Pooling

- **Serverless (Vercel)**: 10 connections + pgbouncer enabled automatically
- **Standard (Docker)**: 20 connections
- **Configurable**: Via `connection_limit` query parameter in DATABASE_URL
- **Slow query detection**: Queries > 1000ms logged as `[PRISMA-SLOW]`
- **Diagnostics**: `PrismaDiagnostics` tracks total queries, slow queries, timeouts

### 5.6 Background Jobs

| Job | Schedule | Endpoint | Auth |
|-----|----------|----------|------|
| Job Processor | Daily 06:00 UTC | `/api/cron/job-processor` | `CRON_SECRET` Bearer token |
| Backup | Daily 02:00 (Docker only) | `pg_dump` in docker-compose | Local only |

Vercel Cron configured in `vercel.json`:
```json
{ "path": "/api/cron/job-processor", "schedule": "0 6 * * *" }
```

### 5.7 External Integrations

| Service | Purpose | Required |
|---------|---------|----------|
| Neon PostgreSQL | Database | YES |
| Resend | Transactional email (OTP, notifications) | For OTP login |
| NVIDIA NIM | Primary AI (Llama 3.1 8B) | Optional |
| Fireworks AI | Backup AI (Llama 3.3 70B) | Optional |
| Groq | Fallback AI (Llama 3.3 70B) | Optional |
| Google Gemini | Fallback AI (Gemini 2.0 Flash) | Optional |
| Tavily | Web search (1000/month free) | Optional |
| Clearbit | Company enrichment | Optional |
| Sentry | Error tracking | Optional |
| AWS S3 | File attachments | Optional |

### 5.8 Deployment Pipelines

#### Production Pipeline (`deploy-production.yml`)

| Stage | Gate | Automatic Rollback |
|-------|------|-------------------|
| 1. CI Validation + Human Approval | GitHub environment `production` (required reviewers) | — |
| 2. Production Build | Build must succeed | — |
| 3. Pre-Migration Backup | pg_dump or Neon PITR | — |
| 4. Database Migration | P3005 baseline handling | — |
| 5. Vercel Deploy | Captures previous deployment ID | — |
| 6. Smoke Tests | Vitest smoke suite against production | ✅ |
| 7. Health Check | 3 retries, 30s interval | ✅ |
| 8. Rollback | Triggered by health/smoke failure | ✅ Auto-rollback |

#### Staging Pipeline (`deploy-staging.yml`)

| Stage | Gate |
|-------|------|
| 1. Build | Build with staging env vars |
| 2. Migration | Staging Neon database (P3005 handling) |
| 3. Preview Deploy | Vercel preview (NOT production) |
| 4. Smoke Tests | Vitest smoke suite |
| 5. Health Check | 3 retries, 15s interval |

---

## 6. Observability

### 6.1 Sentry Integration

| Component | File | DSN Variable | Status |
|-----------|------|-------------|--------|
| Server | `sentry.server.config.ts` | `SENTRY_DSN` | ✅ Configured (0.1 sampling in prod) |
| Client | `sentry.client.config.ts` | `NEXT_PUBLIC_SENTRY_DSN` | ✅ Configured (0.1 sampling in prod) |
| Edge | `sentry.edge.config.ts` | `NEXT_PUBLIC_SENTRY_DSN` | ✅ Configured |
| Instrumentation | `src/instrumentation.ts` | Auto-imports on startup | ✅ Wired |

- `instrumentation.ts` imports Sentry server config on Node.js runtime, edge config on Edge runtime
- Graceful shutdown flushes Sentry events (2s timeout)
- Dev mode: 1.0 trace sampling; Production: 0.1 trace sampling

### 6.2 Error Tracking

| Layer | Mechanism |
|-------|-----------|
| API routes | Sentry auto-captures unhandled errors |
| Edge proxy | Sentry edge integration |
| Client | Browser tracing + error capture |
| Prisma | Error/warn level logging (production: error only) |
| Slow queries | `[PRISMA-SLOW]` warning for > 1000ms queries |

### 6.3 Logging

| Component | Details |
|-----------|---------|
| Logger | `src/lib/logger.ts` — Structured JSON in production, colored console in dev |
| Levels | debug, info, warn, error, fatal |
| Format | `{ timestamp, level, message, ...meta }` (JSON in prod) |
| Request logging | Built-in request logger middleware helper |

### 6.4 Health Checks

| Endpoint | Auth | Response | Purpose |
|----------|------|----------|---------|
| `GET /api/health` | Public | `{ status, uptime, version, environment, providers, db }` | Liveness probe |
| `GET /api/health/database` | Public | DB-specific health | Database connectivity |
| `GET /api/health/ai` | Public | AI provider status | AI availability |
| `GET /api/health/persistence` | Public | Persistence engine status | WI-18.2 persistence |
| `GET /api/health/deps` | Public | Dependency status | External deps |
| `GET /api/health/ready` | Public | Readiness probe | Full readiness check |

**Docker health check**: `wget -qO- http://localhost:3000/api/health` every 30s, 5s timeout, 3 retries, 15s start period.

### 6.5 Monitoring & Metrics

| Component | Details |
|-----------|---------|
| `PrismaDiagnostics` | Tracks totalQueries, slowQueries, timedOutQueries |
| Database performance monitor | p50/p95/p99 query latency tracking via `recordDbQuery()` |
| Metrics persistence | Periodic flush every 5 minutes (`startMetricsPersistence()`) |
| `NEXT_PUBLIC_BUILD_SHA` | Build/deployment identifier in health response |
| `VERCEL_GIT_COMMIT_SHA` | Auto-populated by Vercel for deployment validation |

### 6.6 Monitoring Alerts

- **Sentry**: Configurable alert rules per project in Sentry dashboard
- **Vercel**: Built-in deployment alerts (failed builds, function errors)
- **Neon**: Database health alerts (connection saturation, storage)
- **Vercel Cron**: Cron job failures reported in Vercel dashboard

---

## 7. Deployment Checklist

### Pre-Deployment (First-Time Setup)

- [ ] Provision Neon PostgreSQL database (free tier available)
- [ ] Set `DATABASE_URL` (pgBouncer) and `DIRECT_DATABASE_URL` (direct) in Vercel/env
- [ ] Generate and set `SESSION_TOKEN_HMAC_SECRET` (32+ chars)
- [ ] Set `AUTHORIZED_EMAIL` to admin email
- [ ] Generate and set `TRACKING_SECRET` (16+ chars)
- [ ] Generate and set `API_KEY_ENCRYPTION_KEY` (32+ chars)
- [ ] Set `NEXTAUTH_URL` to production URL
- [ ] Generate and set `CRON_SECRET`
- [ ] Configure Resend (optional — required for OTP login): `EMAIL_API_KEY`, `EMAIL_FROM`
- [ ] Configure AI providers (optional — at least one recommended): `NVIDIA_API_KEY`, `FIREWORKS_API_KEY`, etc.
- [ ] Configure Sentry (optional): `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`
- [ ] Create GitHub environment `production` with required reviewers
- [ ] Add GitHub secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `DATABASE_URL`, `DIRECT_DATABASE_URL`

### Deployment Verification

- [ ] Push to `develop` → staging pipeline deploys preview → smoke tests + health check pass
- [ ] Create PR `develop` → `main` → CI passes all 11 blocking jobs
- [ ] Merge to `main` → production pipeline runs
- [ ] Production build succeeds
- [ ] Pre-migration backup verified (or PITR available)
- [ ] Database migration succeeds (or skipped if no pending)
- [ ] Vercel production deployment live
- [ ] Smoke tests pass against production URL
- [ ] Health check returns `{ "status": "ok" }` with `db: true`
- [ ] Verify OTP login works end-to-end
- [ ] Verify AI features work (if AI keys configured)

### Post-Deployment

- [ ] Check Sentry for any new errors
- [ ] Verify `/api/health` response includes correct version/commit
- [ ] Confirm cron job execution (next 06:00 UTC)
- [ ] Review audit logs for auth patterns

---

## 8. Known Non-Blocking Issues

### 8.1 Upstream Dependency Vulnerabilities (Accepted Exceptions)

| Package | Severity | Via | Mitigation |
|---------|----------|-----|-----------|
| `postcss` | High | Next.js 16 | No user-controlled CSS input |
| `protobufjs` | High | @xenova/transformers → onnxruntime-web | No untrusted protobuf deserialization |
| `sharp` | High | @xenova/transformers | Only processes internal images |
| `onnxruntime-web` | High | @xenova/transformers | No untrusted protobuf |
| `@xenova/transformers` | High | Direct dep | Breaking to downgrade to 1.x |
| `next` | High | Direct dep (framework) | Breaking to downgrade to 14.x |

**Review cadence**: Re-evaluate with each Next.js/transformers major release.

### 8.2 Docker Node Version Mismatch

- CI uses Node 22; Dockerfile uses `node:20-alpine`
- **Risk**: Low — Next.js 16 supports Node 20+. The mismatch is intentional for Alpine compatibility.
- **Recommendation**: Consider updating Dockerfile to `node:22-alpine` when available.

### 8.3 Non-Blocking Test Suites

The following CI jobs are marked `if: always()` and do NOT block merge:
- test-ai, test-ai-governance, test-ai-retrieval, test-ai-framework, test-ai-inference
- test-e2e, test-performance, test-ui, test-playwright

These may have individual test failures that should be addressed over time but do not prevent deployment.

### 8.4 CSP `unsafe-eval` in Development

- `script-src 'self' 'unsafe-eval'` is allowed in development for Next.js hot-reload
- Production CSP uses `script-src 'self'` (no unsafe-eval)
- CI gate verifies no `unsafe-inline` in production script-src

### 8.5 In-Memory Rate Limiting (Edge)

- Rate limit store in `src/lib/auth-helpers.ts` uses in-memory Map
- In multi-instance deployments (Vercel serverless), rate limits are per-instance
- **Mitigation**: Vercel typically routes to the same instance for a session; eviction policy prevents memory bloat (50K entry max)
- **Recommendation**: For multi-region/multi-instance deployments, consider Redis-backed rate limiting

### 8.6 Local .env Uses SQLite

- Current local `.env` has `DATABASE_URL=file:/home/z/my-project/db/custom.db`
- Production requires PostgreSQL — this is a local development artifact
- **Action**: Ensure production `.env` or Vercel env vars use PostgreSQL URL

---

*This document is auto-generated from codebase audit. Last updated: 2026-08-08T00:00:00Z*
