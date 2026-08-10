# DeepMindQ CRM — Production 90+ Master Plan

**Version**: 1.0 — LOCKED (Master Reference)
**Created**: 2026-08-10
**Status**: NOT STARTED
**Auto-Update**: This file is updated automatically as each phase completes. Do NOT manually edit phase statuses.

---

## Verification Methodology (How Every Phase Is Proven End-to-End)

Every phase follows this 3-layer verification before being marked complete:

| Layer | Method | Proof Artifact |
|-------|--------|---------------|
| **L1: Code Evidence** | Every file/function modified is logged with before/after | worklog.md entry with file paths + line numbers |
| **L2: Integration Chain** | Full request chain traced: Route → Service → DB → Response | Subagent reads modified files, verifies import chains intact |
| **L3: Regression Guard** | Related routes/screens checked for breakage | Re-read sibling files, verify no broken imports or type errors |

**Anti-Cheating Rules** (what will NOT be accepted):
- No `// TODO: implement later` comments
- No mock data replacing real logic
- No fixing 1 screen and claiming "all screens done"
- No skipping error handling on "less important" endpoints
- No placeholder values (e.g., hardcoded zeros)

---

## Current Audit Scores (Baseline)

| # | Category | Current Score | Target Score | Gap |
|---|----------|:---:|:---:|:---:|
| 1 | Product Functionality | 78 | 95+ | 17 |
| 2 | Frontend / UX | 35 | 90+ | 55 |
| 3 | Backend / API | 72 | 92+ | 20 |
| 4 | Database / Data Flow | 85 | 95+ | 10 |
| 5 | AI Intelligence | 65 | 90+ | 25 |
| 6 | Security | 52 | 95+ | 43 |
| 7 | Performance / Scale | 58 | 90+ | 32 |
| 8 | Operations | 42 | 90+ | 48 |
| 9 | Testing | 25 | 90+ | 65 |
| **OVERALL** | **38** | **90+** | **52** |

---

## Phase A — Critical Security Blockers (Security: 52 → 80)

**Priority**: CRITICAL — Must complete before any customer access
**Effort**: ~6-8 hours
**Dependencies**: None

### A.1 — Fix SSRF in Slack Integration
- **File**: `src/app/api/integrations/slack/route.ts`
- **Issue**: Accepts arbitrary URLs with zero validation, no IP blocking, no auth
- **Fix**: Add URL allowlist (only slack.com domains), block internal IPs (10.x, 172.16-31.x, 192.168.x), add request authentication
- **Verification**: Read file after fix, confirm allowlist logic present, confirm IP blocklist present

### A.2 — Authenticate Webhook Management Endpoints
- **File**: `src/app/api/webhooks/manage/route.ts`
- **Issue**: GET/POST/DELETE with ZERO authentication, listed in PUBLIC_PATH_PREFIXES
- **Fix**: Remove from PUBLIC_PATH_PREFIXES, add session-based auth check (require `admin` or `manager` role), add CSRF validation
- **Verification**: Read middleware.ts to confirm removed from public list, read route.ts to confirm auth guard present

### A.3 — Fix CRM Webhook Auth Bypass
- **File**: `src/app/api/webhooks/crm/hubspot/route.ts` (lines 26-31)
- **File**: `src/app/api/webhooks/crm/salesforce/route.ts` (lines 22-27)
- **Issue**: `if (!secret) return true` bypasses all auth; Salesforce queries DB before signature check (timing leak)
- **Fix**: Reject requests when secret is missing (return 401), move signature verification BEFORE any DB query
- **Verification**: Read both files, confirm early-return-on-missing-secret is gone, confirm verify signature is first operation

### A.4 — Fix Encryption Key Mismatch
- **File**: `src/lib/encryption.ts`
- **Issue**: Reads `ENCRYPTION_KEY` but `.env.example` documents `API_KEY_ENCRYPTION_KEY`; has plaintext fallback when key missing
- **Fix**: Standardize to single env var name, remove plaintext fallback (throw error if key missing), update `.env.example`
- **Verification**: Read encryption.ts, confirm no plaintext fallback, confirm env var name matches .env.example

### A.5 — Add External Alerting for Critical Failures
- **Files**: `src/lib/monitoring/`, new `src/lib/alerting.ts`
- **Issue**: Errors logged internally but never reach operators
- **Fix**: Create alerting module that sends Slack/email on: unhandled errors, auth failures > 10/min, DB connection pool exhaustion, AI pipeline failures
- **Verification**: Read alerting.ts, confirm all 4 alert triggers implemented, confirm Slack webhook integration

**Phase A Exit Criteria**: All 5 items verified via L1+L2. No endpoint accepts unauthenticated requests. No secrets bypassed.

**Status**: ✅ COMPLETE (Completed: 2026-08-10)
**Worklog**: See worklog.md — Task ID: phase-a-security-blockers
**Actual Score**: Security 52 → 80 (estimated, pending full re-score)
**Files Modified**: 11 (1 new, 10 modified) | **Tests Added**: 0 (security test suite deferred to Phase H)

---

## Phase B — Backend Hardening (Backend: 72 → 92, Performance: 58 → 75)

**Priority**: HIGH
**Effort**: ~8-10 hours
**Dependencies**: Phase A complete

### B.1 — Cursor Pagination for List Endpoints
- **Files**: `src/app/api/companies/route.ts`, `src/app/api/leads/route.ts`, `src/app/api/contacts/route.ts`, `src/app/api/deals/route.ts`, all other list endpoints using offset
- **Issue**: Offset-as-cursor pattern breaks on data changes, O(n) performance at high offsets
- **Fix**: Implement true keyset pagination using `(cursor, direction)` with `createdAt` or `id` as cursor, return `nextCursor` / `prevCursor` in response
- **Scope**: Apply to ALL ~15 list endpoints consistently
- **Verification**: Read each modified route file, confirm keyset WHERE clause, confirm cursor fields in response type

### B.2 — Dashboard Query Optimization
- **File**: `src/app/api/dashboard/route.ts`
- **Issue**: Fires 9 parallel queries across 7 tables, consumes 9/10 pool connections
- **Fix**: (1) Aggregate common metrics into a materialized view or cache layer, (2) Batch related queries, (3) Add stale-while-revalidate caching (60s TTL), (4) Reduce to 3-4 queries max
- **Verification**: Read route.ts, count parallel queries, confirm ≤4, confirm cache layer present

### B.3 — Zod Validation on All API Routes
- **Scope**: ~143 routes missing input validation
- **Issue**: Raw `req.json()` parsed without validation — injection risk, type confusion
- **Fix**: Add Zod schemas for every route's input (query params, body, path params). Create reusable schemas in `src/lib/validations/`. Apply via middleware or helper function.
- **Verification**: Run `rg "req.json()" src/app/api/` — should return zero unvalidated parses. Spot-check 10 random routes.

### B.4 — CSRF Token Stability
- **File**: `src/middleware.ts`
- **Issue**: CSRF token regenerated every request, breaks multi-tab usage and parallel requests
- **Fix**: Generate CSRF token once per session, store in server-side session, rotate only on login/interval (30 min)
- **Verification**: Read middleware.ts, confirm token generation tied to session not per-request

### B.5 — CSP Hardening
- **File**: `src/middleware.ts`
- **Issue**: `style-src 'unsafe-inline'` allows XSS via style injection
- **Fix**: Move to nonce-based CSP for scripts and styles, add `strict-dynamic`
- **Verification**: Read middleware.ts, confirm nonce generation, confirm no `'unsafe-inline'` for script-src

**Phase B Exit Criteria**: All 5 items verified. Zero unvalidated API inputs. Dashboard ≤4 queries. All list endpoints use keyset pagination.

**Status**: ⬜ NOT STARTED

---

## Phase C — Database & Data Integrity (Database: 85 → 95)

**Priority**: HIGH
**Effort**: ~4-6 hours
**Dependencies**: None (can run parallel with Phase A)

### C.1 — Fix Team Performance Report Fabricated Data
- **File**: `src/app/api/reports/team-performance/route.ts`
- **Issue**: Returns placeholder zeros with comment "No owner field on Company"
- **Fix**: Add `ownerId` relation to Company model (Prisma migration), populate from team assignments, compute real metrics
- **Verification**: Read route.ts — no hardcoded zeros. Read Prisma schema — Company has ownerId relation.

### C.2 — Automated Backup with Rotation
- **File**: `scripts/backup.sh`
- **Issue**: Has typo `$METADATA_file` (lowercase f), no rotation logic
- **Fix**: Fix typo, add retention policy (keep 7 daily, 4 weekly, 12 monthly), add backup verification (restore test on staging), schedule via cron
- **Verification**: Read backup.sh, confirm typo fixed, confirm rotation logic, confirm restore test command

### C.3 — Database Index Audit
- **Scope**: `prisma/schema.prisma` — ~300 indexes claimed
- **Issue**: Need to verify which indexes actually exist in DB vs just declared
- **Fix**: Run `SELECT indexname FROM pg_indexes` against production, cross-reference with Prisma schema, add missing indexes for hot query paths
- **Verification**: Export index comparison, confirm all Prisma-declared indexes exist in DB

### C.4 — Connection Pool Configuration
- **File**: `src/lib/db.ts` or Prisma client config
- **Issue**: Default pool size may exhaust DB connections under load
- **Fix**: Configure pool: `connection_limit: 10`, `pool_timeout: 30000`, add connection health check
- **Verification**: Read DB client config, confirm pool settings, confirm health check query

**Phase C Exit Criteria**: No fabricated data anywhere. Backups automated with rotation. All declared indexes exist.

**Status**: ⬜ NOT STARTED

---

## Phase D — AI Intelligence Upgrade (AI: 65 → 90)

**Priority**: HIGH
**Effort**: ~10-12 hours
**Dependencies**: None (can run parallel with Phase A)

### D.1 — Upgrade to Transformer Embeddings
- **File**: `src/lib/embeddings.ts`
- **Issue**: Uses TF-IDF only, not transformer-based despite `@xenova/transformers` being installed
- **Fix**: Replace TF-IDF with `all-MiniLM-L6-v2` model from `@xenova/transformers`, add fallback to TF-IDF for edge cases, benchmark retrieval quality before/after
- **Verification**: Read embeddings.ts, confirm transformer model import, confirm TF-IDF as fallback only

### D.2 — LLM-Based Hallucination Prevention
- **File**: `src/lib/hallucination-prevention.ts`
- **Issue**: Keyword-based only, no LLM-based verification
- **Fix**: Add secondary LLM pass for claim verification on high-stakes outputs (confidence < 0.85), use cheaper model (Groq/Fireworks) for verification, keep keyword check as first-pass filter
- **Verification**: Read hallucination-prevention.ts, confirm dual-pass logic (keyword + LLM), confirm model selection

### D.3 — AI Response Quality Metrics
- **Scope**: New `src/lib/ai-quality.ts`, updates to AI pipeline routes
- **Issue**: No tracking of AI response quality — no feedback loop
- **Fix**: Add response quality scoring (latency, token usage, confidence, user feedback), store metrics in `AIQualityMetric` table, add dashboard panel for AI quality trends
- **Verification**: Read ai-quality.ts, confirm metrics captured. Read Prisma schema, confirm AIQualityMetric model.

### D.4 — LLM Cost Tracking
- **Scope**: New `src/lib/ai-cost-tracker.ts`, updates to all LLM provider calls
- **Issue**: No tracking of per-request AI costs
- **Fix**: Track tokens in/out per provider per request, calculate cost using provider pricing, store in `AICostLog` table, add alert when daily spend exceeds threshold
- **Verification**: Read ai-cost-tracker.ts, confirm token tracking. Confirm cost calculation per provider.

**Phase D Exit Criteria**: Embeddings use transformers. Hallucination check uses LLM verification. Quality + cost metrics tracked.

**Status**: ⬜ NOT STARTED

---

## Phase E — Frontend / UX Overhaul (Frontend: 35 → 90)

**Priority**: HIGH (largest gap — 55 points)
**Effort**: ~15-18 hours
**Dependencies**: Phase B (backend patterns established)

### E.1 — Loading States for All 51 Screens
- **Scope**: All 51 screens identified in audit missing loading indicators
- **Fix**: Create reusable `<LoadingSkeleton />` component with variants (table, card, detail, list), apply to every data-fetching screen, add `loading.tsx` files for Next.js streaming
- **Pattern**: Each screen gets: `const { data, isLoading } = useQuery(...)` → `{isLoading && <LoadingSkeleton variant="table" />}`
- **Verification**: Run `rg "isLoading" src/app/` — should find loading handling on every page that fetches data

### E.2 — Error Handling for All 34 Screens
- **Scope**: All 34 screens missing error UI
- **Fix**: Create reusable `<ErrorBoundary />` and `<ErrorPanel />` components, add try/catch in data fetching, show user-friendly error messages with retry action, log to Sentry
- **Pattern**: Each screen gets: `{error && <ErrorPanel error={error} onRetry={refetch} />}`
- **Verification**: Run `rg "ErrorPanel\|errorBoundary\|error.tsx" src/app/` — should find error handling on every data-fetching page

### E.3 — Empty States for All 57 Screens
- **Scope**: All 57 screens missing empty-state UI
- **Fix**: Create reusable `<EmptyState />` component with icon, title, description, and primary action, apply to every list/table view
- **Pattern**: `{data?.length === 0 && <EmptyState icon={Users} title="No companies yet" action={<Button>Add Company</Button>} />}`
- **Verification**: Run `rg "EmptyState" src/app/` — should find empty state handling on every list page

### E.4 — Admin Pages into AppShell
- **Files**: 5 admin pages — `/app/admin/config`, `/heatmap`, `/calibration`, `/audit`, `/scoring`
- **Issue**: Bypass AppShell entirely — no sidebar, no navigation, no consistent layout
- **Fix**: Wrap all admin pages in AppShell layout, add admin section to sidebar navigation, ensure auth guard (admin role required)
- **Verification**: Read each admin page, confirm AppShell wrapper present, confirm not standalone layout

### E.5 — Fix Dead Pages and Broken Links
- **Files**: `src/app/demo/page.tsx` (100% hardcoded), `src/app/login/page.tsx` (dead redirect, 3 lines)
- **Fix**: Either remove dead pages or rebuild with real functionality. Fix all broken internal links across the app.
- **Verification**: Run link audit across all `<Link href=...>` components, confirm no 404 targets

### E.6 — Responsive Design Pass
- **Scope**: All 85 screens
- **Issue**: Many screens not tested for mobile/tablet viewports
- **Fix**: Audit every screen at 3 breakpoints (mobile 375px, tablet 768px, desktop 1280px), fix overflow issues, ensure tables have horizontal scroll, forms stack on mobile
- **Verification**: Spot-check 20 screens across 3 breakpoints using agent-browser snapshots

**Phase E Exit Criteria**: Every screen has loading + error + empty states. No dead pages. All admin in AppShell. Responsive at 3 breakpoints.

**Status**: ⬜ NOT STARTED

---

## Phase F — Performance & Scaling (Performance: 58 → 90)

**Priority**: MEDIUM-HIGH
**Effort**: ~8-10 hours
**Dependencies**: Phase B (pagination), Phase C (DB config)

### F.1 — Distributed Rate Limiting
- **Files**: `src/middleware.ts`, new `src/lib/rate-limit.ts`
- **Issue**: In-memory rate limiting bypassable on serverless (Vercel) — each cold start resets counters
- **Fix**: Implement Redis-based or Upstash-based sliding window rate limiter, fallback to in-memory with reduced limits, apply per-user and per-IP
- **Verification**: Read rate-limit.ts, confirm Redis/Upstash integration, confirm fallback logic

### F.2 — SSE Connection Management
- **File**: `src/app/api/stream/` routes
- **Issue**: SSE connections tracked in-memory, lost on serverless scale-down
- **Fix**: Move SSE tracking to Redis, add reconnection logic on client side, add heartbeat to detect dead connections
- **Verification**: Read stream routes, confirm Redis-backed connection registry, confirm client reconnect

### F.3 — Response Caching Layer
- **Scope**: API routes for reference data (companies, contacts, deals lists)
- **Issue**: Every request hits DB, even for unchanged data
- **Fix**: Add stale-while-revalidate cache with configurable TTL per route type, use Next.js `fetch` cache or custom cache layer
- **Verification**: Read cache implementation, confirm TTL configuration, confirm cache headers

### F.4 — Image/Asset Optimization
- **Scope**: All pages rendering images
- **Fix**: Use Next.js `<Image />` component everywhere (not raw `<img>`), add lazy loading, configure CDN cache headers
- **Verification**: Run `rg "<img " src/` — should return zero results

### F.5 — Bundle Size Optimization
- **Scope**: `next.config.ts`, component imports
- **Fix**: Analyze webpack bundle, split large chunks, lazy-load non-critical components, tree-shake unused exports
- **Verification**: Run build, check bundle size report, confirm no single chunk > 200KB

**Phase F Exit Criteria**: Rate limiting survives serverless. SSE connections persist. Reference data cached. Bundle optimized.

**Status**: ⬜ NOT STARTED

---

## Phase G — Operations & Reliability (Operations: 42 → 90)

**Priority**: MEDIUM
**Effort**: ~8-10 hours
**Dependencies**: None (can run parallel)

### G.1 — Fix Blue/Green Deploy Hardcoding
- **File**: `.github/workflows/blue-green-deploy.yml`
- **Issue**: Hardcoded staging target, not configurable
- **Fix**: Parameterize environment target via workflow inputs and GitHub environment variables, add production guard
- **Verification**: Read workflow file, confirm no hardcoded environment names

### G.2 — Configure OpenTelemetry Export
- **File**: `instrumentation-node.ts`
- **Issue**: OTel exporter not configured, traces go nowhere
- **Fix**: Configure OTel exporter (Honeycomb/Datadog/Tempo), add resource attributes (service.name, deployment.env), verify traces appear in dashboard
- **Verification**: Read instrumentation-node.ts, confirm exporter URL, confirm resource attributes

### G.3 — Sentry Configuration Fix
- **Files**: `sentry.server.config.ts`, `sentry.client.config.ts`, `sentry.edge.config.ts`
- **Issue**: 10% sample rate too low for production debugging
- **Fix**: Set sample rate to 100% for errors, 10% for transactions (performance), add user context, add release tracking
- **Verification**: Read all 3 Sentry configs, confirm rates, confirm release tracking

### G.4 — Health Check Endpoints
- **Scope**: New `/api/health` and `/api/ready`
- **Fix**: Liveness probe (process alive), readiness probe (DB connected, cache connected, AI providers reachable), include version and deployment info
- **Verification**: Read health endpoints, confirm DB + AI + cache checks

### G.5 — Structured Logging
- **Scope**: All API routes
- **Issue**: Inconsistent logging — some `console.log`, some `console.error`, no structured format
- **Fix**: Implement structured logger (JSON format with timestamp, level, requestId, userId, route), replace all console.log/error with structured logger, add request correlation IDs
- **Verification**: Run `rg "console\.(log|error|warn)" src/app/api/` — should return near-zero results

**Phase G Exit Criteria**: Deploy workflow parameterized. Traces export to real backend. Sentry captures 100% errors. Health checks operational. All logging structured.

**Status**: ⬜ NOT STARTED

---

## Phase H — Testing Infrastructure (Testing: 25 → 90)

**Priority**: HIGH (largest absolute gap — 65 points)
**Effort**: ~20-25 hours
**Dependencies**: Phase A (security tests), Phase B (validation tests)

### H.1 — Security Test Suite
- **Scope**: New `tests/security/` directory
- **Fix**: Write tests for: SSRF prevention (Slack), webhook auth enforcement, CRM webhook signature verification, encryption key validation, CSRF token stability, CSP enforcement
- **Verification**: Run `npx vitest --config vitest.security.config.ts`, confirm all pass

### H.2 — API Integration Test Suite
- **Scope**: Expand existing `tests/api/`
- **Fix**: Write integration tests for all CRUD operations (companies, leads, contacts, deals), test pagination (keyset), test validation (Zod errors), test error responses, test auth guards
- **Target**: Cover all ~143 API routes with at least happy-path + error-path tests
- **Verification**: Run API test suite, confirm >80% route coverage

### H.3 — Frontend Component Test Suite
- **Scope**: New `tests/ui/` directory
- **Fix**: Test all reusable components (LoadingSkeleton, ErrorPanel, EmptyState, AppShell), test loading/error/empty state rendering, test responsive behavior
- **Verification**: Run `npx vitest --config vitest.ui.config.ts`, confirm all pass

### H.4 — E2E Critical Path Tests
- **Scope**: `tests/e2e/`
- **Fix**: Write Playwright tests for: Login → Dashboard → Company List → Company Detail → AI Analysis → Report generation, test complete user journey end-to-end
- **Target**: 10 critical path scenarios
- **Verification**: Run `npx playwright test`, confirm all 10 scenarios pass

### H.5 — AI Pipeline Tests
- **Scope**: `tests/ai/`
- **Fix**: Test embedding generation (transformer model), test hallucination prevention (both passes), test RAG retrieval quality, test LLM fallback chain, test response quality scoring
- **Verification**: Run `npx vitest --config vitest.ai.config.ts`, confirm all pass

### H.6 — Performance Tests
- **Scope**: `tests/performance/`
- **Fix**: Load test dashboard endpoint (concurrent users), test pagination performance at scale (10K+ records), test rate limiter effectiveness, test SSE connection stability
- **Verification**: Run performance suite, confirm dashboard <500ms p95, pagination <100ms p95

### H.7 — Test Infrastructure
- **Scope**: CI workflow updates
- **Fix**: Add test coverage reporting (minimum 70% threshold), add test failure notifications (Slack), add parallel test execution, add test result artifacts
- **Verification**: Read CI workflow, confirm coverage threshold, confirm notification setup

**Phase H Exit Criteria**: All test suites pass. Coverage ≥70%. E2E critical paths verified. Performance benchmarks met.

**Status**: ⬜ NOT STARTED

---

## Phase I — Product Polish & Final Validation (Product: 78 → 95)

**Priority**: MEDIUM
**Effort**: ~6-8 hours
**Dependencies**: All previous phases complete

### I.1 — Feature Completeness Audit
- **Scope**: All 85 screens
- **Fix**: Verify every feature works end-to-end: data import/export, CRM connectors, AI analysis, knowledge graph, reporting, admin config, user management
- **Verification**: Walk through every feature manually (via code read), create checklist

### I.2 — Edge Case Handling
- **Scope**: All API routes + frontend forms
- **Fix**: Handle: empty inputs, unicode characters, extremely long strings (>10K chars), concurrent modifications, deleted references (orphan cleanup)
- **Verification**: Read validation logic on 20 random routes, confirm edge cases covered

### I.3 — Accessibility Audit
- **Scope**: All 85 screens
- **Fix**: Add ARIA labels to interactive elements, ensure keyboard navigation works, add skip-to-content links, fix color contrast issues, add screen reader support for data tables
- **Verification**: Run `npx vitest --config vitest.a11y.config.ts`, confirm all pass

### I.4 — Documentation Update
- **Scope**: README.md, API_REFERENCE.md, ARCHITECTURE.md, DEPLOYMENT_GUIDE.md
- **Fix**: Update all documentation to reflect changes from Phases A-H, add new endpoint docs, update architecture diagrams, update deployment instructions
- **Verification**: Read all docs, confirm they match current codebase state

**Phase I Exit Criteria**: All features verified end-to-end. Edge cases handled. Accessibility passes. Docs match code.

**Status**: ⬜ NOT STARTED

---

## Execution Order & Dependencies

```
Phase A (Security Blockers) ─────┐
Phase C (Database) ─────────────┼──→ Phase B (Backend) ──→ Phase E (Frontend)
Phase D (AI Intelligence) ──────┘         │                       │
                                           ├──→ Phase F (Performance) ┤
Phase G (Operations) ──────────────────────┘                       │
                                                                   ↓
                                              Phase H (Testing) ──→ Phase I (Polish)
```

**Parallel Tracks** (can execute simultaneously):
- Track 1: A → B → E (Security → Backend → Frontend)
- Track 2: C (Database — independent)
- Track 3: D (AI — independent)
- Track 4: G (Operations — independent)

**Convergence Points**:
- Phase F requires B (pagination) and C (DB config) complete
- Phase H requires A (security tests) and B (validation tests) complete
- Phase I requires ALL previous phases complete

---

## Effort Summary

| Phase | Category Impact | Effort (hrs) | Dependencies |
|-------|----------------|:---:|-------------|
| A — Security Blockers | Security: 52→80 | 6-8 | None |
| B — Backend Hardening | Backend: 72→92, Perf: +17 | 8-10 | A |
| C — Database | Database: 85→95 | 4-6 | None |
| D — AI Intelligence | AI: 65→90 | 10-12 | None |
| E — Frontend/UX | Frontend: 35→90 | 15-18 | B |
| F — Performance | Performance: 58→90 | 8-10 | B, C |
| G — Operations | Operations: 42→90 | 8-10 | None |
| H — Testing | Testing: 25→90 | 20-25 | A, B |
| I — Polish | Product: 78→95 | 6-8 | All |
| **TOTAL** | **All → 90+** | **85-107** | — |

---

## Score Projection After Each Phase

| After Phase | Product | Frontend | Backend | Database | AI | Security | Perf | Ops | Testing | Overall |
|:-----------:|:------:|:--------:|:-------:|:--------:|:--:|:--------:|:----:|:---:|:-------:|:-------:|
| Baseline | 78 | 35 | 72 | 85 | 65 | 52 | 58 | 42 | 25 | 38 |
| A | 78 | 35 | 72 | 85 | 65 | **80** | 58 | 42 | 25 | 49 |
| B | 78 | 35 | **92** | 85 | 65 | 80 | **75** | 42 | 25 | 56 |
| C | 78 | 35 | 92 | **95** | 65 | 80 | 75 | 42 | 25 | 60 |
| D | 78 | 35 | 92 | 95 | **90** | 80 | 75 | 42 | 25 | 64 |
| E | 78 | **90** | 92 | 95 | 90 | 80 | 75 | 42 | 25 | 72 |
| F | 78 | 90 | 92 | 95 | 90 | 80 | **90** | 42 | 25 | 76 |
| G | 78 | 90 | 92 | 95 | 90 | 80 | 90 | **90** | 25 | 82 |
| H | 78 | 90 | 92 | 95 | 90 | 80 | 90 | 90 | **90** | 89 |
| I | **95** | 90 | 92 | 95 | 90 | 80 | 90 | 90 | 90 | **92** |

**Note**: Security reaches 80 after Phase A. To push Security to 95+, the following additional items are tracked within Phases B (CSP), H (security tests), and I (edge cases). Final projected Security score: 95+.

---

## Auto-Update Protocol

This file is updated by the development agent after each phase:

1. **Phase Start**: Change status from `⬜ NOT STARTED` to `🟡 IN PROGRESS`
2. **Phase Complete**: Change status to `✅ COMPLETE`, add completion date, add link to worklog entry
3. **Score Update**: Update the score projection table with actual post-phase scores
4. **Git Commit**: Each status change is committed with message: `chore: update master plan — Phase X status`

**Format for completed phase:**
```
**Status**: ✅ COMPLETE (Completed: 2026-MM-DD)
**Worklog**: [link to worklog section]
**Actual Score**: [measured score after phase]
**Files Modified**: [count] | **Tests Added**: [count]
```

---

*This document is the single source of truth for production readiness. Do not create competing roadmaps.*
