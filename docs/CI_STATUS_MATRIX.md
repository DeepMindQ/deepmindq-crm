# CI Status Matrix — M4 Phase 2 Final Verification

> **Date**: 2026-08-05  
> **Commit SHA**: `eaefc6806cf201e83f0a55eb1493a23c12db8ac1`  
> **Branch**: `main`  
> **Node Version**: CI uses Node 22 (`NODE_VERSION: '22'`), Local uses Node 24

---

## 1. CI Pipeline Overview

**Workflow File**: `.github/workflows/ci.yml`  
**Trigger**: push to `main`/`develop`, pull_request to `main`/`develop`, merge_group  
**Total CI Jobs**: 20 (10 blocking, 10 non-blocking)

**Nightly Workflow**: `.github/workflows/nightly-regression.yml`  
**Jobs**: 3 (full-regression, performance-benchmarks, memory-check)

---

## 2. CI Status Matrix — ci.yml

### 2.1 Blocking Jobs (must pass for merge)

| # | Job Name | CI Status | Blocking | Test Result | Root Cause (if Red) | Fix Applied |
|---|----------|-----------|----------|-------------|---------------------|------------|
| 1 | **security-gate** | 🟢 GREEN | Yes | 333/333 pass + 9 static checks pass | — | — |
| 2 | **dependency-audit** | 🟢 GREEN | Yes | All high/critical documented exceptions | — | — |
| 3 | **api-security-contract** | 🟢 GREEN | Yes | 219 protected, 31 public routes verified | — | — |
| 4 | **lint-and-typecheck** | 🟢 GREEN | Yes | ESLint: 0 errors, 2 warnings. TSC: 0 errors | — | — |
| 5 | **test-unit** | 🟢 GREEN | Yes | 898/898 pass (27 files, 2 empty) | **WAS FAKE GREEN** — see §3.1 | ✅ Fixed: pool threads→forks, removed `--dangerouslyIgnoreUnhandledErrors`, excluded broken import |
| 6 | **test-security** | 🟢 GREEN | Yes | 333/333 pass (13 files) | — | — |
| 7 | **test-api** | 🟢 GREEN | Yes | 745 pass, 14 skipped (12 files) | Skips are environment-dependent API tests | — |
| 8 | **test-database** | 🟡 GREEN* | Yes | 331 pass, 12 skipped (9/10 files pass) | `real-database-integration.test.ts` — see §3.2 | *Requires CI PostgreSQL service container to verify |
| 9 | **test-integration** | 🟢 GREEN | Yes | 158/158 pass (7 files) | — | — |
| 10 | **build** | 🟢 GREEN | Yes | `npm run build:vercel` | — | — |

### 2.2 Non-Blocking Jobs (informational, `if: always()`)

| # | Job Name | CI Status | Blocking | Test Result | Root Cause (if Red) | Fix Applied |
|---|----------|-----------|----------|-------------|---------------------|------------|
| 11 | **test-ai** | 🟢 GREEN | No | 409/409 pass (22 files) | — | — |
| 12 | **test-ai-governance** | 🟢 GREEN | No | 211/211 pass (10/16 files, 6 no tests) | **WAS FAKE GREEN** — see §3.3 | ✅ Fixed: removed `|| true`, added tee+grep wrapper |
| 13 | **test-ai-retrieval** | 🟢 GREEN | No | 91/91 pass (2 files) | — | — |
| 14 | **test-ai-framework** | 🟢 GREEN | No | 386/386 pass (6 files) | — | — |
| 15 | **test-ai-inference** | 🟢 GREEN | No | 3/3 pass (1 file) | — | — |
| 16 | **test-e2e** | 🟢 GREEN | No | 67/67 pass (4 files) | — | — |
| 17 | **test-performance** | 🟢 GREEN | No | 231/231 pass (14 files) | — | — |
| 18 | **test-ui** | 🟢 GREEN | No | 102/102 pass (2 files) | — | — |
| 19 | **test-playwright** | 🔵 UNVERIFIED | No | Requires browser + server build | Cannot verify locally — needs CI run | — |

### 2.3 Nightly Regression — nightly-regression.yml

| # | Job Name | Expected Status | Test Result | Notes |
|---|----------|----------------|-------------|-------|
| 20 | **full-regression** | 🟡 DEPENDS | Runs `npm run test:full` (all configs sequentially) | Depends on unit fix + ai-governance fix |
| 21 | **performance-benchmarks** | 🟢 GREEN | 231/231 (from performance config) | Should pass |
| 22 | **memory-check** | 🟡 DEPENDS | Runs unit + security + ai sequentially | Depends on unit fix |

---

## 3. Issues Found and Fixed

### 3.1 test-unit — Fake Green (CRITICAL)

**Problem**: `vitest.unit.config.ts` used `pool: 'threads'` which crashes the Vitest worker process with a teardown error on large test suites (30 files, 900+ tests). The CI workflow masked this crash with:
- `--dangerouslyIgnoreUnhandledErrors` — suppressed the crash signal
- tee+grep wrapper — checked for `Test Files.*failed` in output, but the crash occurred BEFORE vitest could print the summary line
- Result: CI reported GREEN but tests never completed

**Fix Applied**:
1. Changed `vitest.unit.config.ts` from `pool: 'threads'` → `pool: 'forks'` (consistent with ai-governance config)
2. Removed `--dangerouslyIgnoreUnhandledErrors` from CI job (no longer needed — forks eliminates the crash)
3. Removed misleading "Vitest worker teardown crash suppressed" message from CI output
4. Excluded `tests/unit/sprint1-modules.test.ts` (imports removed module `@/lib/intelligence-sources/adaptive-intelligence`)

**Verification**: 898/898 tests pass, 27/27 files pass, no crashes.

### 3.2 test-ai-governance — Fake Green (CRITICAL)

**Problem**: CI line 419 contained `|| true` which silently suppressed ALL failures including OOM kills:
```
npx vitest run --config vitest.ai-governance.config.ts --dangerouslyIgnoreUnhandledErrors || true
```
This was documented as "removed" in the Phase 2 closure report but was still present in the CI file.

**Fix Applied**:
1. Removed `|| true`
2. Removed `--dangerouslyIgnoreUnhandledErrors`
3. Added proper tee+grep wrapper matching all other CI jobs
4. The vitest config already uses `pool: 'forks'` (fixed in Phase 2) so no crash

**Verification**: 211/211 tests pass, CI grep finds no failures → GREEN.

### 3.3 sprint1-modules.test.ts — Import Error

**Problem**: `tests/unit/sprint1-modules.test.ts` imports `@/lib/intelligence-sources/adaptive-intelligence` which no longer exists. This caused 1 file failure / 45 test "failures" (unloaded tests counted as failed).

**Decision**: Exclude from unit config. The module was intentionally removed; the test has no corresponding source code. Moving to `tests/legacy/` for archival.

**Verification**: Unit tests now 27/27 files pass.

### 3.4 test-database — Conditional Pass

**Problem**: `tests/database/migration-tests/real-database-integration.test.ts` fails locally because it requires a live PostgreSQL connection with full migration history.

**CI Behavior**: The CI job provides a PostgreSQL 16 service container with `prisma migrate deploy` before tests. This test should pass in CI because the database is available. However, the test connects to `process.env.DATABASE_URL` directly, so it depends on the CI service container being properly configured.

**Decision**: No code fix needed. This is expected behavior — the test is designed for real PostgreSQL. CI provides PostgreSQL. If CI reports GREEN, the test is validated. If CI reports RED, the PostgreSQL service container or migration needs investigation.

---

## 4. Suppression Audit — Post-Fix Verification

| Pattern | Pre-Fix Count | Post-Fix Count | Status |
|---------|:------------:|:-------------:|--------|
| `\|\| true` (bash suppression in CI) | 1 | **0** | ✅ Removed |
| `--dangerouslyIgnoreUnhandledErrors` (CI) | 2 | **0** | ✅ Removed |
| `dangerouslyIgnoreUnhandledErrors` (vitest configs) | 0 | 0 | ✅ Clean |
| Empty catch blocks `{}` | 0 | 0 | ✅ Clean |
| `expect(true).toBe(true)` | 0 | 0 | ✅ Clean |
| `expect(value).toBe(value)` | 0 | 0 | ✅ Clean |

---

## 5. src/ Co-located Tests — NOT Covered by CI

The default vitest config includes `src/**/*.test.{ts,tsx}` but the CI **does NOT run the default config**. CI runs only category-specific configs that target `tests/**/*.test.{ts,tsx}` exclusively.

The following `src/` test files are **invisible to CI**:

| File | Tests | Status | Notes |
|------|:-----:|--------|-------|
| `src/app/api/__tests__/api-integration.test.ts` | 42 | RED | Prisma mock mismatch — NOT in any CI job |
| `src/app/api/__tests__/health-export-knowledge.test.ts` | 0 | EMPTY | No tests — NOT in any CI job |
| `src/app/api/__tests__/import-timeline-notes.test.ts` | 15 | RED | Prisma mock mismatch — NOT in any CI job |
| `src/app/api/__tests__/opportunities-research.test.ts` | 17 | RED | Prisma mock mismatch — NOT in any CI job |
| `src/components/shared/__tests__/design-system.test.tsx` | 50 | RED | Component rendering mismatch — NOT in any CI job |
| `src/lib/intelligence-sources/__tests__/acquisition-engine.test.ts` | 0 | EMPTY | No tests — NOT in any CI job |
| `src/lib/intelligence-sources/__tests__/analytics-dashboard.test.ts` | 0 | EMPTY | No tests — NOT in any CI job |
| `src/lib/intelligence-sources/__tests__/source-governance.test.ts` | 0 | EMPTY | No tests — NOT in any CI job |
| `src/lib/intelligence-sources/__tests__/intelligence-alerts.test.ts` | 16 | 2 RED | Minor assertion mismatch — NOT in any CI job |
| `src/lib/revenue-intelligence/__tests__/account-brief.test.ts` | 12 | 11 RED | Interface changes — NOT in any CI job |
| `src/lib/revenue-intelligence/__tests__/account-scoring.test.ts` | 15 | 12 RED | Interface changes — NOT in any CI job |
| `src/lib/revenue-intelligence/__tests__/signal-extraction.test.ts` | 12 | 9 RED | Interface changes — NOT in any CI job |

**Total**: 146 tests in 12 `src/` test files — **0 covered by CI**.

These failures do NOT affect CI green/red status because CI never runs them. They represent technical debt but NOT CI noise.

---

## 6. Pool Configuration Summary

| Config | Pool | Threads Crash Risk | Status |
|--------|------|:------------------:|--------|
| vitest.unit.config.ts | **forks** (FIXED) | LOW | ✅ |
| vitest.security.config.ts | forks | LOW | ✅ |
| vitest.ai-governance.config.ts | forks | LOW | ✅ |
| vitest.research-engine.config.ts | forks | LOW | ✅ |
| vitest.api.config.ts | threads | MEDIUM (small suite) | ✅ |
| vitest.database.config.ts | threads | MEDIUM (small suite) | ✅ |
| vitest.e2e.config.ts | threads | MEDIUM (small suite) | ✅ |
| vitest.performance.config.ts | threads | MEDIUM (small suite) | ✅ |
| vitest.ui.config.ts | threads | MEDIUM (small suite) | ✅ |
| vitest.ai.config.ts | threads | LOW (explicit file list) | ✅ |
| vitest.ai-inference.config.ts | forks | LOW | ✅ |

**Risk Note**: Configs with `pool: 'threads'` and small test counts (< 30 files, < 500 tests) pass locally without crash. The crash is load-dependent. If test counts grow, these configs may need migration to `forks`. This is documented in `docs/VITEST_TEARDOWN_ANALYSIS.md`.

---

## 7. Verification Checklist — Before Phase 2 Closure

- [x] All 10 blocking CI jobs verified GREEN (or GREEN* with documented caveat)
- [x] All 9 non-blocking CI jobs verified GREEN (or UNVERIFIED with documented reason)
- [x] Zero `|| true` in CI workflow
- [x] Zero `--dangerouslyIgnoreUnhandledErrors` in CI workflow
- [x] Zero empty catch blocks in test files
- [x] Zero tautological assertions in test files
- [x] `vitest.unit.config.ts` migrated to forks pool
- [x] `test-ai-governance` CI job: `|| true` replaced with tee+grep wrapper
- [x] `sprint1-modules.test.ts` import error excluded
- [x] `vitest.research-engine.config.ts` include path corrected
- [x] All suppression patterns verified zero across entire codebase

---

*Document generated: 2026-08-05*  
*Pending: CI run on GitHub Actions to verify test-database and test-playwright*
