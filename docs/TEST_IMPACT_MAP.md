# DeepMindQ Test Impact Map

> Module → Business Capability → Required Tests → Risk Level Mapping  
> Milestone 3 — Permanent Enterprise Validation Asset

## Purpose

This document maps every critical module to its business capability, required test categories, and risk level. When code changes in a module, this map tells developers and CI exactly which tests MUST run to validate the change.

## Risk Levels

| Level | Description | CI Action |
|-------|-------------|-----------|
| **CRITICAL** | Security, auth, data integrity | MUST pass — blocks merge |
| **HIGH** | AI accuracy, scoring, intelligence | MUST pass — blocks merge |
| **MEDIUM** | Business workflows, API correctness | SHOULD pass — warns on failure |
| **LOW** | UI, performance, accessibility | MAY pass — informational |

---

## Module Impact Map

### 1. Authentication (`src/lib/password.ts`, `src/lib/otp.ts`, `src/lib/session.ts`)

| Business Capability | Test Categories | Test Files | Risk |
|---------------------|----------------|-------------|------|
| Password hashing (PBKDF2-SHA256) | Unit / Security Regression | `tests/unit/authentication/password-certification.test.ts` | CRITICAL |
| OTP generation & verification | Unit / Security Regression | Security regression suite (REGRESSION-01,11) | CRITICAL |
| Session management & hashing | Unit / Security Regression | `tests/unit/authentication/session-certification.test.ts` | CRITICAL |
| Session rotation & limits | Unit / Security Regression | Session certification + security regression | CRITICAL |
| Device fingerprinting | Unit | `tests/unit/authentication/session-certification.test.ts` | HIGH |

### 2. Authorization (`src/lib/rbac.ts`, `src/lib/auth-helpers.ts`)

| Business Capability | Test Categories | Test Files | Risk |
|---------------------|----------------|-------------|------|
| Role-based access control | Unit / Security Regression | `tests/unit/authorization/rbac-certification.test.ts` | CRITICAL |
| Route authorization matrix | Unit / Security Regression | RBAC cert + security regression (REGRESSION-04,05,12) | CRITICAL |
| Public path detection | Unit / Security Regression | `tests/unit/security/auth-helpers-certification.test.ts` | CRITICAL |
| CSRF protection | Unit / Security Regression | `tests/unit/security/csrf-certification.test.ts` | CRITICAL |
| Security headers | Unit / Security Regression | Security regression (REGRESSION-09) | HIGH |
| Rate limiting | Unit / Security Regression | Auth helpers cert + security regression (REGRESSION-11) | HIGH |

### 3. AI Governance (`src/lib/ai-governance.ts`, 1,524 LOC)

| Business Capability | Test Categories | Test Files | Risk |
|---------------------|----------------|-------------|------|
| Governance checks (6-check gate) | Unit / AI Quality | `tests/unit/ai-governance/ai-governance-certification.test.ts` | HIGH |
| governedAICall() centralization | Unit / AI Quality | Existing ai-governance tests | HIGH |
| Domain freshness evaluation | Unit | Existing governance tests | MEDIUM |

### 4. AI Hallucination Prevention (`src/lib/ai-hallucination-prevention.ts`, 666 LOC)

| Business Capability | Test Categories | Test Files | Risk |
|---------------------|----------------|-------------|------|
| Claim extraction | Unit / AI Quality | `tests/unit/ai-governance/hallucination-prevention-certification.test.ts` | HIGH |
| Citation verification | Unit / AI Quality | Hallucination prevention certification | HIGH |
| Hedging detection | Unit / AI Quality | Hallucination prevention certification | MEDIUM |
| Specificity scoring | Unit / AI Quality | Hallucination prevention certification | MEDIUM |
| Composite hallucination check | Unit / AI Quality | Hallucination prevention certification + golden dataset | HIGH |
| Enterprise trust threshold | Unit / AI Quality | `tests/ai-testing/hallucination-testing/` | CRITICAL |

### 5. Scoring Engine (`src/lib/scoring/freshness-ranking.ts`)

| Business Capability | Test Categories | Test Files | Risk |
|---------------------|----------------|-------------|------|
| Freshness half-life decay | Unit | `tests/unit/scoring-engine/freshness-ranking-certification.test.ts` | HIGH |
| Source quality weights | Unit | Freshness ranking certification | MEDIUM |
| Composite intelligence ranking | Unit | Freshness ranking certification | HIGH |
| Staleness classification | Unit | Freshness ranking certification | MEDIUM |

### 6. Intelligence Contract (`src/lib/intelligence-contract.ts`, 923 LOC)

| Business Capability | Test Categories | Test Files | Risk |
|---------------------|----------------|-------------|------|
| Research context building | Unit / Integration | `tests/unit/intelligence-engine/intelligence-contract.test.ts` | HIGH |
| Account intelligence retrieval | Unit / Integration | Existing intelligence-contract tests | HIGH |
| Freshness adjustments | Unit | Existing tests | MEDIUM |

### 7. Signal Engine (`src/lib/research-engine/`)

| Business Capability | Test Categories | Test Files | Risk |
|---------------------|----------------|-------------|------|
| Signal lifecycle management | Unit / Integration | `tests/unit/signal-engine/` | MEDIUM |
| Evidence quality scoring | Unit | Existing research-engine tests | MEDIUM |
| Opportunity recommendation | Unit | Existing tests | MEDIUM |

### 8. Business Workflows

| Business Capability | Test Categories | Test Files | Risk |
|---------------------|----------------|-------------|------|
| Company onboarding | E2E | `tests/e2e/business-workflows/e2e-business-workflows.test.ts` | HIGH |
| Contact discovery | E2E | E2E business workflows | HIGH |
| Intelligence activation | E2E | E2E business workflows | HIGH |
| Sales pipeline tracking | E2E | E2E business workflows | HIGH |
| Data import pipeline | E2E | E2E business workflows | MEDIUM |

### 9. API Routes (~250 routes)

| Business Capability | Test Categories | Test Files | Risk |
|---------------------|----------------|-------------|------|
| CRUD operations | Integration | `tests/integration/api/` | HIGH |
| Auth-protected routes | Security | `tests/security/api-security/` | CRITICAL |
| Error handling | Integration | `tests/integration/api/` | MEDIUM |

### 10. Database Layer (~100 Prisma models)

| Business Capability | Test Categories | Test Files | Risk |
|---------------------|----------------|-------------|------|
| Schema integrity | Database | `tests/database/integrity-tests/` | HIGH |
| Migration safety | Database | `tests/database/migration-tests/` | HIGH |
| Query performance | Database / Performance | `tests/database/performance-tests/` | MEDIUM |

---

## CI Impact Detection Rules

When a file changes, run these test categories:

| File Pattern Changed | Test Categories to Run |
|---------------------|----------------------|
| `src/lib/password.ts` | `test:unit` + `test:security` |
| `src/lib/otp.ts` | `test:unit` + `test:security` |
| `src/lib/session*.ts` | `test:unit` + `test:security` |
| `src/lib/rbac.ts` | `test:unit` + `test:security` |
| `src/lib/csrf.ts` | `test:unit` + `test:security` |
| `src/lib/auth-helpers.ts` | `test:unit` + `test:security` |
| `src/lib/ai-governance.ts` | `test:ai-governance` + `test:ai` |
| `src/lib/ai-hallucination*.ts` | `test:ai-governance` + `test:ai` |
| `src/lib/scoring/*.ts` | `test:unit` |
| `src/lib/intelligence*.ts` | `test:ai` + `test:integration` |
| `src/lib/research-engine/*.ts` | `test:ai` + `test:integration` |
| `src/app/api/auth/*` | `test:security` + `test:e2e` |
| `src/app/api/companies/*` | `test:api` + `test:e2e` |
| `src/app/api/contacts/*` | `test:api` + `test:e2e` |
| `prisma/schema.prisma` | `test:database` + `test:full` |

## Maintenance Protocol

1. **Every PR** must check this map for affected modules
2. **Every merge** must run all CRITICAL and HIGH risk tests for changed modules
3. **Every new module** must be added to this map with appropriate risk level
4. **Quarterly review** of risk levels and test coverage gaps
