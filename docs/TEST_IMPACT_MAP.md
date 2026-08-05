# DeepMindQ — Test Impact Map

> **Milestone 3: Enterprise Testing Quality Certification**
> Version: 1.0 | Last Updated: 2026-08-05

## Purpose

This document maps every critical code module to its business capability, associated risk level, and the tests that validate it. When code changes are proposed, this map enables automatic identification of impacted tests, reducing regression risk and ensuring continuous certification.

## Architecture Overview

```
Source Module (code change) → Business Capability → Risk Level → Impacted Tests
```

---

## Module-to-Test Mapping

### 1. Authentication Module

| Source File | Business Capability | Risk Level | Unit Tests | Integration Tests | E2E Tests | Security Tests |
|---|---|---|---|---|---|---|
| `src/lib/password.ts` | User Authentication | **Critical** | `tests/unit/authentication/password-certification.test.ts` | — | — | `tests/security/vulnerability-tests/security-regression-certification.test.ts` |
| `src/lib/otp.ts` | OTP Login Flow | **Critical** | `tests/unit/auth-components.test.ts` | `tests/integration/api/api-integration-auth.test.ts` | — | `tests/security/vulnerability-tests/security-regression-certification.test.ts` |
| `src/lib/session.ts` | Session Management | **Critical** | `tests/unit/authentication/session-certification.test.ts` | — | — | `tests/security/vulnerability-tests/security-regression-certification.test.ts` |
| `src/lib/session-manager.ts` | Session Rotation & Limits | **High** | `tests/unit/authentication/password-session-certification.test.ts` | — | — | — |
| `src/lib/auth-helpers.ts` | Edge Auth Middleware | **Critical** | `tests/unit/security/auth-helpers-certification.test.ts` | `tests/integration/api/api-integration-auth.test.ts` | — | `tests/security/vulnerability-tests/security-regression-certification.test.ts` |

### 2. Authorization Module

| Source File | Business Capability | Risk Level | Unit Tests | Integration Tests | E2E Tests | Security Tests |
|---|---|---|---|---|---|---|
| `src/lib/rbac.ts` | Role-Based Access Control | **Critical** | `tests/unit/authorization/rbac-certification.test.ts` | `tests/integration/api/api-integration-auth.test.ts` | — | `tests/security/vulnerability-tests/security-regression-certification.test.ts` |
| `src/lib/csrf.ts` | CSRF Protection | **Critical** | `tests/unit/security/csrf-certification.test.ts` | `tests/integration/api/api-integration-auth.test.ts` | — | `tests/security/vulnerability-tests/security-regression-certification.test.ts` |
| `src/app/api/*/route.ts` | API Route Guards | **Critical** | — | `tests/integration/api/api-integration-auth.test.ts` | `tests/e2e/business-workflows/e2e-business-workflows.test.ts` | — |

### 3. AI Governance Module

| Source File | Business Capability | Risk Level | Unit Tests | AI Tests | Integration Tests |
|---|---|---|---|---|---|
| `src/lib/ai-governance.ts` | AI Quality Gates | **Critical** | — | `tests/ai-testing/hallucination-testing/ai-governance-certification.test.ts` | `tests/integration/intelligence-alerts.test.ts` |
| `src/lib/ai-hallucination-prevention.ts` | Hallucination Detection | **Critical** | — | `tests/ai-testing/hallucination-testing/hallucination-prevention-certification.test.ts` | — |
| `src/lib/ai-evidence-framework.ts` | Evidence Grounding | **High** | — | `tests/ai-testing/hallucination-testing/golden-dataset-hallucination.test.ts` | — |

### 4. Scoring & Intelligence Module

| Source File | Business Capability | Risk Level | Unit Tests | Integration Tests |
|---|---|---|---|---|
| `src/lib/scoring/freshness-ranking.ts` | Data Freshness | **High** | `tests/unit/scoring-engine/freshness-ranking-certification.test.ts` | — |
| `src/lib/ai-unified-confidence.ts` | Confidence Scoring | **High** | `tests/unit/auth-components.test.ts` (subset) | — |
| `src/lib/intelligence-contract.ts` | Intelligence Pipeline | **High** | `tests/intelligence-contract.test.ts` | — |
| `src/lib/intelligence-pipeline.ts` | Data Processing | **Medium** | — | `tests/integration/intelligence-alerts.test.ts` |

### 5. Database & Data Module

| Source File | Business Capability | Risk Level | Unit Tests | Database Tests |
|---|---|---|---|---|
| `prisma/schema.prisma` | Data Model | **Critical** | — | `tests/database/migration-tests/real-database-integration.test.ts` |
| `src/lib/db.ts` | Database Client | **Critical** | — | `tests/database/engine.test.ts` |
| `src/app/api/companies/route.ts` | Company CRUD | **High** | — | `tests/database/ticket2-integration.test.ts` |

### 6. Recommendation & Signal Module

| Source File | Business Capability | Risk Level | Unit Tests | Integration Tests |
|---|---|---|---|---|
| `src/lib/recommendation-engine.ts` | AI Recommendations | **Medium** | — | `tests/intelligence-contract.test.ts` (subset) |
| `src/lib/ai-insight-service.ts` | Insight Generation | **Medium** | — | `tests/integration/intelligence-alerts.test.ts` |

---

## Risk Classification

| Risk Level | Definition | Change Protocol |
|---|---|---|
| **Critical** | Directly impacts user auth, data security, or AI output quality | Full regression suite + manual review required |
| **High** | Impacts business logic or data integrity | Targeted regression + unit tests |
| **Medium** | Impacts non-critical features or UX | Unit tests only |
| **Low** | Cosmetic or configuration changes | Automated checks only |

---

## Impact Detection Logic

When a file is modified in a PR, the following rules apply:

1. **Authentication files** (`password.ts`, `otp.ts`, `session.ts`, `auth-helpers.ts`) → Trigger: unit/auth, integration/api, security/vulnerability tests
2. **Authorization files** (`rbac.ts`, `csrf.ts`) → Trigger: unit/authorization, integration/api, security tests
3. **AI governance files** (`ai-governance.ts`, `ai-hallucination-prevention.ts`) → Trigger: ai-testing/governance, ai-testing/hallucination tests
4. **Scoring files** (`freshness-ranking.ts`, `ai-unified-confidence.ts`) → Trigger: unit/scoring tests
5. **Database schema** (`schema.prisma`) → Trigger: all database tests + migration tests
6. **API routes** → Trigger: corresponding integration test suite
7. **Any file** → At minimum: lint + typecheck + unit tests

---

## Test Categories Summary

| Category | Config File | Test Count | Coverage Target | CI Job |
|---|---|---|---|---|
| Unit | `vitest.unit.config.ts` | ~200+ | 30%+ statements | `test-unit` |
| Security | `vitest.security.config.ts` | ~100+ | All critical paths | `test-security` |
| AI Governance | `vitest.ai-governance.config.ts` | ~80+ | All generation types | `test-ai-governance` |
| API Integration | `vitest.api.config.ts` | ~60+ | Route coverage | `test-api` |
| Database | `vitest.database.config.ts` | ~50+ | Schema coverage | `test-database` |
| E2E | `vitest.e2e.config.ts` | ~40+ | Business workflows | `test-e2e` |
| Integration | `vitest.integration.config.ts` | ~30+ | Cross-module | `test-integration` |
| Performance | `vitest.performance.config.ts` | ~20+ | Benchmark stability | `test-performance` |
| UI | `vitest.ui.config.ts` | ~10+ | Component rendering | `test-ui` |

---

## Maintenance Protocol

1. When adding a new source module, add an entry to the appropriate section above
2. When adding a new test file, map it to its source module
3. When a PR modifies files, check this map to determine required test runs
4. Review this document quarterly to ensure accuracy
