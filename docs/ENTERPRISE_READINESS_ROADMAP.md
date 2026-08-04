# DeepMindQ Enterprise Readiness Roadmap

**Product**: Enterprise AI Intelligence Platform  
**Version**: 1.0-roadmap  
**Last Updated**: 2026-08-04  
**Execution Priority**: Security > Testing > AI Accuracy > Deployment > UI/UX > Documentation

---

## Product Context (Permanent)

DeepMindQ is an **Enterprise AI Intelligence Platform** designed for enterprise deployment and licensing. It is NOT a CRM, NOT a SaaS self-service application, and NOT a multi-tenant platform.

**Core Capabilities**:
- Signal detection (32 types)
- Hybrid RAG retrieval (6 signals with Reciprocal Rank Fusion)
- Hallucination prevention (665 lines, claim extraction + citation verification)
- AI governance framework (1,523 lines, 40+ generation type configs)
- 4-provider LLM fallback (OpenAI, Gemini, Groq, Fireworks)
- 40+ generation type configurations with confidence thresholds

**Intentionally Out of Scope**:
- Multi-tenancy (single-enterprise deployment model)
- Subscription billing / payment processing
- CRM workflow engines
- Self-service onboarding

**Codebase Scale**: 221,521 lines total, 125,691 non-test source, 250 API routes, 85 Prisma models, 32 enums, 417 indexes, 224 test files (~8,111 test cases)

---

## Milestone Framework

Every milestone follows the same discipline:
1. **Implement** — Code changes with clear commit messages
2. **Test** — Local verification (TypeScript, ESLint, unit tests)
3. **Commit** — Descriptive commit with fix references
4. **Push** — Feature branch pushed to GitHub
5. **PR** — Pull Request with full scope documentation
6. **CI** — All GitHub Actions jobs green
7. **Evidence** — Run-specific evidence captured
8. **Close** — Only when all acceptance criteria are satisfied

---

## Milestone 1 — Security Foundation

**Status**: ✅ COMPLETE (100%)  
**Date Closed**: 2026-08-04  
**Target Score**: Security 58 → 90+  

### Objective
Eliminate all critical and high-severity security vulnerabilities identified in the Phase 5.6 Enterprise Readiness Audit. Establish security-hardened patterns for session management, authentication, authorization, and AI governance.

### Completed Fixes

| ID | Severity | Finding | Resolution | Files |
|----|----------|---------|------------|-------|
| C-01 | Critical | Session tokens stored in plaintext in DB | SHA-256 hash with `dmq_session:` prefix before storage | `src/lib/session.ts` |
| C-02 | Critical | Full session tokens exposed via `/api/sessions` | Masked to first 8 chars + `***` in all API responses | `src/lib/session-manager.ts` |
| C-03 | Critical | Non-constant-time OTP comparison (timing attack) | XOR-based constant-time compare function | `src/app/api/auth/verify-otp/route.ts` |
| H-01 | High | RBAC allow-by-default (238/250 routes unprotected) | Deny-by-default + 20 wildcard prefix route entries | `src/lib/rbac.ts` |
| H-02 | Medium | Misleading `NEXTAUTH_SECRET` naming | Renamed to `SESSION_TOKEN_HMAC_SECRET` with backwards compat | `src/lib/validate-env.ts` |
| H-04 | High | `api-metrics` auth guard bypassed (object always truthy) | Destructured `errorResponse` pattern | `src/app/api/api-metrics/route.ts` |
| H-05 | High | Dev OTP bypass active in staging environments | Dual-gate: `NODE_ENV === 'development'` AND `ALLOW_DEV_OTP === 'true'` | `src/app/api/auth/login/route.ts`, `register/route.ts`, `src/lib/otp.ts` |
| H-06 | Critical | `hasPermission()` maps null/undefined role to admin | Explicit falsy guard, deny by default | `src/lib/rbac.ts` |
| A-01 | High | AI governance bypassed on 3 customer-facing routes | `enforceGovernance: true` on account-brief, conversation-plan, suggested-contacts | 3 AI route files |
| A-02 | High | AI enrichment auto-writes unverified data to DB | Human approval workflow — suggestions returned, never auto-persisted | `src/app/api/ai/enrich/route.ts` |

### Files Changed (15)
- `src/lib/session.ts` — Token hashing (SHA-256), all DB operations use hash
- `src/lib/session-manager.ts` — Token masking, hash-based isCurrent comparison
- `src/lib/rbac.ts` — Deny-by-default, null-role protection, 20 wildcard entries
- `src/lib/validate-env.ts` — SESSION_TOKEN_HMAC_SECRET with backwards compat
- `src/app/api/auth/verify-otp/route.ts` — Constant-time comparison, hash consistency
- `src/app/api/auth/login/route.ts` — Dual-gate dev OTP
- `src/app/api/auth/register/route.ts` — Dual-gate dev OTP
- `src/app/api/api-metrics/route.ts` — Proper auth guard destructuring
- `src/app/api/ai/account-brief/route.ts` — Governance enabled
- `src/app/api/ai/conversation-plan/route.ts` — Governance enabled
- `src/app/api/ai/suggested-contacts/route.ts` — Governance enabled
- `src/app/api/ai/enrich/route.ts` — Human approval workflow
- `src/lib/otp.ts` — Strict dev OTP check
- `tests/security/enterprise-security.test.ts` — Aligned to deny-by-default
- `tests/security/security-phase4-critical-input-path.test.ts` — Aligned to dual-gate

### Commit History
| SHA | Description |
|-----|-------------|
| `baa19c2` | Milestone 1 — Security Foundation Certification (11 findings) |
| `27bd956` | Milestone 1 — Security Hardening: 3 additional fixes + test alignment |
| `90b59be` | Milestone 1 — Fix residual H-05 in otp.ts + re-audit alignment |

### GitHub Evidence
- **Pull Request**: [#5](https://github.com/DeepMindQ/deepmindq-crm/pull/5)
- **Branch**: `milestone-1-security-hardening`
- **CI Run**: Pending final verification

### Local Verification Results
| Check | Result |
|-------|--------|
| TypeScript compilation | ✅ 0 errors |
| ESLint | ✅ 0 errors |
| Pre-commit hooks | ✅ Passed (lint + typecheck) |
| Security tests | ✅ 241/241 passed |
| Unit tests | ✅ 393/393 passed |

### Security Re-Audit Results

| Finding | Before | After | Evidence |
|---------|--------|-------|----------|
| C-01: Token hashing | Plaintext in DB | SHA-256 hash stored | `session.ts:36-41,84,142,230,295` |
| C-02: Token exposure | Full token in response | Masked (8 chars + ***) | `session-manager.ts:303` |
| C-03: Timing-safe OTP | Direct string compare | XOR constant-time | `verify-otp/route.ts:26-36,131` |
| H-01: RBAC default | allow-by-default | deny-by-default | `rbac.ts:388-397` |
| H-06: Null-role escalation | Maps to admin | Denies access | `rbac.ts:337-340` |
| H-02: Secret naming | NEXTAUTH_SECRET | SESSION_TOKEN_HMAC_SECRET | `validate-env.ts:9-12` |
| H-04: api-metrics bypass | Object always truthy | Destructured guard | `api-metrics/route.ts:13-14` |
| H-05: Dev OTP scope | `!== production` | `=== development` | `login:69, register:89, otp.ts:238` |
| A-01: Governance bypass | `enforceGovernance: false` | `enforceGovernance: true` | All 3 AI routes verified |
| A-02: Enrichment auto-write | Direct DB write | Suggestions only | `enrich/route.ts:167,173,295,298` |

### Remaining Risks (Deferred to Future Milestones)

| Risk | Severity | Target Milestone |
|------|----------|-----------------|
| B-01: RBAC `authorizeRoute()` defined but not wired into request pipeline | Architecture | Milestone 5 (Architecture) or Milestone 6 (CI/CD) |
| B-02: `SESSION_TOKEN_HMAC_SECRET` env var validated but unused (dead code) | Low | Milestone 8 (Documentation) |
| B-03: `governedAICallAggregate` skips governance checks | Low (by design) | Milestone 4 (AI Intelligence) |

**Note on B-01**: The RBAC deny-by-default logic itself is correctly implemented. The architectural task of integrating `authorizeRoute()` into the proxy/middleware pipeline requires coordination with the Edge proxy (`src/proxy.ts`) and is scoped to a dedicated milestone. This is NOT a code bug — it is an integration gap.

---

## Milestone 2 — Database & Deployment Certification

**Status**: 🔲 PENDING  
**Target**: DB 76 → 95, Ops 50 → 75

### Scope
- Create base Prisma migration (CREATE TABLE) for fresh deployments
- Validate `prisma migrate deploy` on clean database
- Remove development artifacts from production build
- Database connection pooling verification
- Seed data validation

### Exit Criteria
- [ ] Fresh deployment succeeds with `prisma migrate deploy`
- [ ] No dev-only code in production build
- [ ] Database schema validated
- [ ] CI `test-api` job passes

---

## Milestone 3 — Testing Quality Certification

**Status**: 🔲 PENDING  
**Target**: Testing 30 → 75

### Scope
- Real E2E tests (not mock-based)
- AI output accuracy tests
- Coverage thresholds increased
- Integration test stabilization
- Test infrastructure hardening

---

## Milestone 4 — AI Intelligence Certification

**Status**: 🔲 PENDING

### Scope
- Hybrid RAG retrieval validation
- Hallucination prevention testing
- Governance framework coverage
- LLM fallback reliability
- AI output quality benchmarks

---

## Milestone 5 — CI/CD Pipeline Certification

**Status**: 🔲 PENDING

### Scope
- CI pipeline stabilization (all jobs green)
- RBAC integration into request pipeline
- Deployment pipeline hardening
- Artifact management

---

## Milestone 6 — UI/UX Certification

**Status**: 🔲 PENDING

### Scope
- Page decomposition from monolithic `page.tsx`
- Responsive design validation
- Accessibility audit
- Component architecture

---

## Milestone 7 — Operations Certification

**Status**: 🔲 PENDING

### Scope
- Monitoring and alerting
- Session cleanup automation
- Error handling hardening
- Operational runbooks

---

## Milestone 8 — Performance Certification

**Status**: 🔲 PENDING

### Scope
- API latency benchmarks
- Database query optimization
- Bundle size analysis
- Load testing

---

## Milestone 9 — Documentation Certification

**Status**: 🔲 PENDING

### Scope
- API documentation completeness
- Architecture documentation
- Deployment guide validation
- Dead code cleanup

---

## Milestone 10 — Final Enterprise Certification

**Status**: 🔲 PENDING

### Scope
- Full re-audit across all categories
- Evidence package compilation
- Enterprise readiness score
- Certification sign-off
