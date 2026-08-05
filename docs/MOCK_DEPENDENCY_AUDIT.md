# Mock Dependency Audit — DeepMindQ Enterprise Test Framework
## Milestone 3 — Section 3.4: Test Reality Classification

**Generated**: 2026-08-05
**Branch**: `milestone-3-testing-certification-v4`
**Purpose**: Classify every test by mock dependency, identify gaps, and define policy.

---

## Classification Policy

| Test Tier | Mock Policy | Rationale |
|-----------|-------------|-----------|
| **Unit Tests** | Mocks **acceptable** | Testing pure logic in isolation — db, external services, AI models should be mocked |
| **Integration Tests** | Mocks **minimized** | Cross-module interactions should use real implementations where possible; only external services (AI providers, email) should be mocked |
| **E2E Tests** | Mocks **minimized** | `mockJsonRequest()` pattern acceptable for API route testing; auth flows should use real OTP/password verification |
| **Performance Tests** | Mocks **acceptable for IO** | Throughput benchmarks need controlled environments; mock external IO but test real computation |
| **Security Tests** | Mocks **selective** | Auth/crypto MUST be tested with real implementations; only database persistence may be mocked |

---

## Current Classification

### Unit Tests (22 files, 8 use vi.mock)

| File | Mocks Used | Classification | Acceptable? |
|------|-----------|---------------|------------|
| `auth-authz-certification.test.ts` | None (real crypto) | ✅ Real | Yes — tests PBKDF2, OTP, RBAC with real crypto |
| `auth-components.test.ts` | Logger | ✅ Acceptable | Yes — logger is infrastructure |
| `ai-governance.test.ts` | db, logger | ✅ Acceptable | Yes — unit tests governance logic |
| `intelligence-contract.test.ts` | db, logger, research-engine | ✅ Acceptable | Yes — tests contract logic |
| `icp-config.test.ts` | None | ✅ Real | Yes |
| `utils.test.ts` | None | ✅ Real | Yes |
| `store.test.ts` | None | ✅ Real | Yes |
| `email-verification.test.ts` | None | ✅ Real | Yes — uses real crypto |
| `test-hoisted*.test.ts` | None | ✅ Real | Yes |
| `test-mock-types.test.ts` | Test utilities | ✅ Acceptable | Meta-test |
| Subdirectory files (authentication, authorization, security, scoring, signal, etc.) | Mixed | ⚠️ Review | Most acceptable for unit scope |

### Security Tests (13 files, 9 use vi.mock)

| File | Mocks Used | Classification | Gap? |
|------|-----------|---------------|------|
| `enterprise-security.test.ts` | Mock-heavy | ⚠️ High | Real auth testing preferred |
| `security-auth.test.ts` | db, session | ⚠️ Medium | Crypto tests are real; db mocked |
| `security-verify-otp.test.ts` | Partial mock | ✅ Acceptable | Real OTP verification |
| `security-auth-blocking.test.ts` | Partial mock | ✅ Acceptable | Tests real blocking logic |
| `security-phase3a-audit-fixes.test.ts` | db | ⚠️ Medium | Should use real db in CI |
| `security-phase3b-hygiene.test.ts` | db | ⚠️ Medium | Should use real db in CI |
| `security-phase4-critical-input-path.test.ts` | Partial | ✅ Acceptable | Input validation uses real logic |
| `wi18-security-gate-integrity.test.ts` | Partial | ✅ Acceptable | Gate logic tested with real impl |
| `wi18-security-regression.test.ts` | Partial | ✅ Acceptable | |

### Integration Tests (7 files, 6 use vi.mock)

| File | Mocks Used | Classification | Gap? |
|------|-----------|---------------|------|
| `phase-1a-intelligence-foundation.test.ts` | db, research-engine | ⚠️ High | Should reduce mocks |
| `intelligence-alerts.test.ts` | db | ⚠️ Medium | Real DB preferred |
| `wi18.2-persistence-engine.test.ts` | db | ⚠️ Medium | Persistence should use real DB |
| `wi18.2-phase2-gate-tests.test.ts` | db | ⚠️ Medium | |
| `wi18.2-phase3.5-evidence-pipeline.test.ts` | db | ⚠️ Medium | |
| `wi18.2-phase3.5-integration-enabled.test.ts` | db | ⚠️ Medium | |
| Subdirectory files (api, database, ai-services, etc.) | Mostly empty | — | New tests needed |

### E2E Tests (4 files, 2 use vi.mock)

| File | Mocks Used | Classification | Gap? |
|------|-----------|---------------|------|
| `e2e-business-journey.test.ts` | db (real route handlers) | ✅ Acceptable | Uses `mockJsonRequest()` — calls real route handlers |
| `phase4-e2e-journeys.test.ts` | Partial | ⚠️ Medium | |
| Subdirectory files (business-workflows, customer-scenarios, enterprise-user-journeys) | Mostly empty | — | New tests needed |

### AI Tests (44 files, 25 use vi.mock)

| Pattern | Count | Classification |
|---------|-------|---------------|
| Real function testing (freshness, confidence, hallucination) | 15 files | ✅ Real — pure functions |
| Governance tests (real runGovernanceChecks) | 5 files | ✅ Real with mocked db/logger |
| AI engine tests (model router mocked) | 12 files | ⚠️ Acceptable — LLM can't be real |
| Integration tests (research engine mocked) | 8 files | ⚠️ Medium — real DB preferred |
| Certification tests (M3) | 4 files | ✅ Properly aligned |

### Performance Tests (14 files, 11 use vi.mock)

| Pattern | Count | Classification |
|---------|-------|---------------|
| Real computation benchmarks | 3 files (new M3-v4) | ✅ Real — measures actual performance |
| Mock-based benchmarks | 11 files | ⚠️ Acceptable — controlled environment |

### Database Tests (10 files, 6 use vi.mock)

| File | Mocks Used | Classification | Gap? |
|------|-----------|---------------|------|
| Uses real PostgreSQL (CI) | 4 files | ✅ Real | Via CI postgres service |
| Uses mocked db | 6 files | ⚠️ Medium | Should migrate to real DB |

---

## Summary Statistics

| Category | Total Files | Files with Mocks | Mock Rate | Target Mock Rate |
|----------|------------|-----------------|-----------|-----------------|
| Unit | 22 | 8 | 36% | ≤40% |
| Security | 13 | 9 | 69% | ≤50% |
| Integration | 7 | 6 | 86% | ≤50% ⚠️ |
| E2E | 4 | 2 | 50% | ≤50% |
| AI | 44 | 25 | 57% | ≤60% |
| Performance | 14 | 11 | 79% | ≤70% |
| Database | 10 | 6 | 60% | ≤40% ⚠️ |
| **Total** | **114** | **67** | **59%** | **≤55%** |

## Key Gaps Identified

1. **Integration tests have 86% mock rate** — highest priority to reduce. These should use real database connections (available via CI PostgreSQL service) and real module interactions.

2. **Security tests at 69% mock rate** — auth/crypto tests correctly use real implementations, but RBAC and route tests rely heavily on mocked db. Should use real DB with seeded test data.

3. **Database tests at 60% mock rate** — ironic that database tests mock the database. The CI environment has a real PostgreSQL service. At least 6 files should be migrated to use the real database.

4. **Performance tests at 79% mock rate** — acceptable for benchmark isolation, but the new M3-v4 load tests (12 tests, real computation) significantly improve this.

## Remediation Plan (Post-M3)

1. **P1**: Migrate integration test mocks to real PostgreSQL (CI service already configured)
2. **P2**: Add real RBAC tests with seeded users in real database
3. **P3**: Convert database test mocks to real Prisma client connections
4. **P4**: Add integration tests in empty subdirectories (api, database, ai-services, external-services)

## Mock Acceptability Reference

The following mocks are **always acceptable** in any test tier:
- `vi.mock('@/lib/logger')` — logger is infrastructure, not business logic
- `vi.mock('@/lib/db')` in unit tests — isolation is the point
- `vi.mock('@/lib/ai-cache-layer')` — external cache service
- `vi.mock('@/lib/research-engine')` — external AI/LLM service
- `vi.mock('@/lib/engines/model-router')` — external LLM API

The following mocks are **only acceptable in unit tests**:
- `vi.mock('@/lib/db')` in security/integration tests — these should use real DB
- `vi.mock('@/lib/session-manager')` — session management should be tested for real
- `vi.mock('@/lib/rbac')` — RBAC is critical security logic

The following mocks are **never acceptable**:
- Mocking crypto functions (`crypto.pbkdf2`, `crypto.randomBytes`)
- Mocking `timingSafeEqual` — security-critical constant-time comparison
- Mocking validation/sanitization functions — these are the actual security boundary
