# DeepMindQ — CI Release Readiness Report

**Generated:** 2026-08-08 | **Scope:** Full CI Pipeline Configuration Audit | **Status:** Phase 1 Complete — Mapping

---

## Executive Summary

DeepMindQ operates a 23-vitest-config CI pipeline with 10 blocking jobs and 11 non-blocking jobs. After 3 days of CI failures traced to test configuration sprawl (not application code), this report establishes the definitive CI ↔ local configuration mapping, identifies orphaned test assets, and provides the actionable repair roadmap.

**Key Findings:**
- **10 blocking CI jobs** gate merge — 7 run vitest, 3 run static analysis/scripts
- **23 vitest config files** exist; CI uses 12, local `npm test` uses the default (which intentionally runs nothing)
- **5 orphaned test directories** (7 test files total) have no vitest config and no CI job
- **Configuration drift risk:** default `vitest.config.ts` has a broad `include` that is neutralized by an equally broad `exclude` — fragile design
- **Pool strategy inconsistency:** unit and m5 configs use `forks`; security, api, integration, database use `threads`

---

## 1. Blocking CI Jobs — Complete Matrix

| # | CI Job | Blocking? | Command | Vitest Config | Pool | Test Dir | DB? | Files | Timeout |
|---|--------|-----------|---------|---------------|------|----------|-----|-------|---------|
| 1 | `security-gate` | **YES** | `npx vitest run --config vitest.security.config.ts` + 6 static grep checks | `vitest.security.config.ts` | threads/1 | `tests/security/**` | No | 17 | 10m |
| 2 | `dependency-audit` | **YES** | `node scripts/dependency-audit-ci.js` | N/A (script) | — | — | No | — | 5m |
| 3 | `api-security-contract` | **YES** | `node scripts/api-security-scan.js` | N/A (script) | — | — | No | — | 5m |
| 4 | `lint-and-typecheck` | **YES** | `npm run lint` + `npm run lint:strict` + `npx tsc --noEmit` | N/A (eslint/tsc) | — | — | No | — | 10m |
| 5 | `test-unit` | **YES** | `npx vitest run --config vitest.unit.config.ts` | `vitest.unit.config.ts` | **forks/1** | `tests/unit/**` | No | 32 | 10m |
| 6 | `test-security` | **YES** | `npx vitest run --config vitest.security.config.ts` | `vitest.security.config.ts` | threads/1 | `tests/security/**` | No | 17 | 8m |
| 7 | `test-api` | **YES** | `npx vitest run --config vitest.api.config.ts` | `vitest.api.config.ts` | threads/1 | `tests/api/**` | **Yes** | 12 | 10m |
| 8 | `test-database` | **YES** | `npx vitest run --config vitest.database.config.ts` | `vitest.database.config.ts` | threads/1 | `tests/database/**` | **Yes** | 10 | 8m |
| 9 | `test-integration` | **YES** | `npx vitest run --config vitest.integration.config.ts` | `vitest.integration.config.ts` | threads/1 | `tests/integration/**` | No | 7 | 10m |
| 10 | `test-m5-intelligence` | **YES** | `npx vitest run --config vitest.m5.config.ts` | `vitest.m5.config.ts` | **forks/1** | `tests/m5/**` | No | 8 | 5m |
| 11 | `build` | **YES** | `npm run build:vercel` | N/A (next build) | — | — | No | — | 15m |

**Total blocking vitest test files: 103** (17 security counted twice since both job 1 and job 6 use the same config/dir)

---

## 2. Non-Blocking CI Jobs

| # | CI Job | Command | Vitest Config | Test Dir | Files |
|---|--------|---------|---------------|----------|-------|
| 1 | `test-ai` | `npx vitest run --config vitest.ai.config.ts` | `vitest.ai.config.ts` | `tests/ai/**` | 46 |
| 2 | `test-ai-governance` | `npx vitest run --config vitest.ai-governance.config.ts` | `vitest.ai-governance.config.ts` | (0 files found) | 0 |
| 3 | `test-ai-retrieval` | `npx vitest run --config vitest.ai-retrieval.config.ts` | `vitest.ai-retrieval.config.ts` | (0 files found) | 0 |
| 4 | `test-ai-framework` | `npx vitest run --config vitest.ai-framework.config.ts` | `vitest.ai-framework.config.ts` | (0 files found) | 0 |
| 5 | `test-ai-inference` | `npx vitest run --config vitest.ai-inference.config.ts` | `vitest.ai-inference.config.ts` | (0 files found) | 0 |
| 6 | `test-e2e` | `npx vitest run --config vitest.e2e.config.ts` | `vitest.e2e.config.ts` | `tests/e2e/**` | 4 |
| 7 | `test-performance` | `npx vitest run --config vitest.performance.config.ts` | `vitest.performance.config.ts` | `tests/performance/**` | 15 |
| 8 | `test-ui` | `npx vitest run --config vitest.ui.config.ts` | `vitest.ui.config.ts` | `tests/ui/**` | 2 |
| 9 | `test-playwright` | `npx playwright test` | N/A (playwright) | — | — |

---

## 3. Local `npm test` Commands — CI Reproduction Guide

To locally reproduce any CI job exactly, run:

```bash
# Blocking vitest jobs (no DB needed)
npx vitest run --config vitest.security.config.ts
npx vitest run --config vitest.unit.config.ts
npx vitest run --config vitest.integration.config.ts
npx vitest run --config vitest.m5.config.ts

# Blocking vitest jobs (PostgreSQL required)
DATABASE_URL=postgresql://user:pass@localhost:5432/testdb \
  npx vitest run --config vitest.api.config.ts
DATABASE_URL=postgresql://user:pass@localhost:5432/testdb \
  npx vitest run --config vitest.database.config.ts

# Blocking non-vitest jobs
node scripts/dependency-audit-ci.js
node scripts/api-security-scan.js
npm run lint && npm run lint:strict && npx tsc --noEmit

# Default npm test (runs NOTHING by design — excludes all subdirs)
npm test   # → vitest run → vitest.config.ts → empty include after exclusions
```

### ⚠️ Default `npm test` is a No-Op

The default `vitest.config.ts` includes `tests/**/*.test.{ts,tsx}` and `src/**/*.test.{ts,tsx}`, but its `exclude` list removes every known subdirectory. Per the file's own comment: *"All subdirectories are excluded — this config intentionally runs nothing."* Running `npm test` locally gives a false sense of coverage — it does not exercise any CI-blocking test path.

---

## 4. Vitest Config Inventory — 23 Files

| Config File | Used in CI? | Used by npm script? | Pool | Max Workers |
|------------|-------------|---------------------|------|-------------|
| `vitest.config.ts` | No | `npm test` | threads | 1 |
| `vitest.unit.config.ts` | **YES** (job 5) | `test:unit` | **forks** | 1 |
| `vitest.security.config.ts` | **YES** (job 1, 6) | `test:security` | threads | 1 |
| `vitest.api.config.ts` | **YES** (job 7) | `test:api` | threads | 1 |
| `vitest.database.config.ts` | **YES** (job 8) | `test:database` | threads | 1 |
| `vitest.integration.config.ts` | **YES** (job 9) | `test:integration` | threads | 1 |
| `vitest.m5.config.ts` | **YES** (job 10) | `test:m5` | **forks** | 1 |
| `vitest.ai.config.ts` | YES (non-block) | `test:ai` | — | — |
| `vitest.ai-governance.config.ts` | YES (non-block) | `test:ai-governance` | — | — |
| `vitest.ai-retrieval.config.ts` | YES (non-block) | `test:ai-retrieval` | — | — |
| `vitest.ai-framework.config.ts` | YES (non-block) | `test:ai-framework` | — | — |
| `vitest.ai-inference.config.ts` | YES (non-block) | `test:ai-inference` | — | — |
| `vitest.e2e.config.ts` | YES (non-block) | `test:e2e` | — | — |
| `vitest.performance.config.ts` | YES (non-block) | `test:performance` | — | — |
| `vitest.ui.config.ts` | YES (non-block) | `test:ui` | — | — |
| `vitest.smoke.config.ts` | No | `test:smoke` | — | — |
| `vitest.audit.config.ts` | No | `test:audit` | — | — |
| `vitest.functional.config.ts` | No | `test:functional` | — | — |
| `vitest.real-integration.config.ts` | No | `test:real-integration` | — | — |
| `vitest.golden.config.ts` | No | No | — | — |
| `vitest.golden-single.config.ts` | No | No | — | — |
| `vitest.research-engine.config.ts` | No | No | — | — |
| `vitest.a11y.config.ts` | No | No | — | — |

**11 configs are CI-active, 12 are local-only or unused.**

---

## 5. Orphaned Test Directories — No Config, No CI Job

These directories contain test files that are never executed by any CI job or local npm script:

| Directory | Files | Risk |
|-----------|-------|------|
| `tests/crm/` | 1 | Silent test rot — code changes won't be caught |
| `tests/data-intelligence/` | 3 | Silent test rot |
| `tests/enrichment/` | 1 | Silent test rot |
| `tests/persistence/` | 1 | Silent test rot |
| `tests/scoring/` | 1 | Silent test rot |
| **Total** | **7** | |

**Recommendation:** Either assign these to an existing vitest config (e.g., merge into `tests/unit/`) or add explicit exclude rules to prevent accidental inclusion by the default config.

---

## 6. Known Configuration Risks

### Risk 1: Default Config Fragility
`vitest.config.ts` uses a broad `include` + exhaustive `exclude` pattern. Any new test directory added to `tests/` will be silently included by `npm test` unless manually added to the exclude list. This is the root cause of past "test sprawl" where developers accidentally ran CI-only tests locally.

### Risk 2: Pool Strategy Inconsistency
- `vitest.unit.config.ts` → `forks` (chosen to avoid Vitest 4.x + Node 22.x teardown crashes)
- `vitest.m5.config.ts` → `forks` (same reason)
- All other blocking configs → `threads`

If the teardown crash affects `threads` pool configs at scale, the unit and m5 configs are already hardened. The remaining 4 blocking configs (security, api, database, integration) still use `threads` and may hit the same crash under load.

### Risk 3: Duplicate Security Testing
Job 1 (`security-gate`) runs `vitest.security.config.ts` AND 6 static grep checks. Job 6 (`test-security`) runs the same `vitest.security.config.ts`. This means the 17 security test files run twice per CI run — once in the gate, once in the dedicated job. This is intentional defense-in-depth but doubles the security test execution time.

### Risk 4: CI Environment Gaps
- `test-api` and `test-database` use PostgreSQL service containers in CI but have no local equivalent in `npm test`
- `security-gate` sets `DATABASE_URL` to a placeholder that doesn't exist — tests must handle missing DB gracefully

### Risk 5: Empty AI Sub-Configs
4 AI vitest configs (`ai-governance`, `ai-retrieval`, `ai-framework`, `ai-inference`) point to directories with 0 test files. Their CI jobs will pass vacuously. Either migrate tests into these dirs or remove the jobs.

---

## 7. Dependency Graph — Blocking Job Flow

```
                    ┌──────────────┐    ┌───────────────────┐
                    │ security-gate│    │ api-security-     │
                    │   (vitest +  │    │ contract (script)  │
                    │   6 greps)   │    └─────────┬─────────┘
                    └──────┬───────┘              │
                           │                      │
                    ┌──────┴──────────────────────┴───────┐
                    │                                      │
              ┌─────▼─────┐    ┌──────────┐    ┌─────────▼──────┐
              │ lint-and-  │    │ test-unit│    │ test-security   │
              │ typecheck  │    │ (forks)  │    │ (threads)       │
              └─────┬──────┘    └────┬─────┘    └───────┬─────────┘
                    │                │                  │
              ┌─────▼─────┐    ┌────▼──────┐    ┌───────▼─────────┐
              │ test-api  │    │ test-db   │    │ test-integr.   │
              │ (threads) │    │ (threads) │    │ (threads)       │
              └─────┬─────┘    └────┬──────┘    └───────┬─────────┘
                    │                │                  │
              ┌─────▼─────┐    ┌────▼──────────────────▼──────┐
              │ test-m5   │    │                              │
              │ (forks)   │    │     ┌────────────────────┐  │
              └─────┬─────┘    │     │ dependency-audit   │  │
                    │          │     │ (script)            │  │
                    └──────────┼─────┴─────────┬──────────┘  │
                               │               │              │
                               └───────┬───────┘              │
                                       │                      │
                                       ▼                      │
                               ┌──────────────┐              │
                               │    BUILD      │◄─────────────┘
                               │ (next build)  │
                               └──────────────┘
```

**Jobs 1-3 run in parallel.** Jobs 4-10 wait for 1+3. Build waits for all blocking jobs.

---

## 8. Repair Roadmap — 6 Phases

### Phase 1: Mapping ✅ (This Report)
Establish CI ↔ local ↔ vitest configuration correspondence. Identify orphans and gaps.

### Phase 2: Local Reproduction
Run each blocking CI command locally with `CI=true` to get current pass/fail status:

```bash
CI=true NODE_OPTIONS='--max-old-space-size=2048' \
  npx vitest run --config vitest.security.config.ts

CI=true NODE_OPTIONS='--max-old-space-size=2048' \
  npx vitest run --config vitest.unit.config.ts

CI=true NODE_OPTIONS='--max-old-space-size=2048' \
  npx vitest run --config vitest.api.config.ts

CI=true NODE_OPTIONS='--max-old-space-size=2048' \
  npx vitest run --config vitest.database.config.ts

CI=true NODE_OPTIONS='--max-old-space-size=2048' \
  npx vitest run --config vitest.integration.config.ts

CI=true NODE_OPTIONS='--max-old-space-size=2048' \
  npx vitest run --config vitest.m5.config.ts
```

### Phase 3: Fix Configuration Boundaries
- Reverse default config: use empty `include` + explicit `exclude` → prevents future sprawl
- Reconcile orphaned test dirs (assign or remove)
- Standardize pool strategy across all blocking configs (evaluate `forks` everywhere)
- Remove or populate empty AI sub-configs

### Phase 4: Classify Test Failures
For each failing test, classify as:
- **A: Code Regression** — application code changed, test needs update
- **B: Test Obsolete** — test references removed/renamed module
- **C: Environment/Config** — missing env var, DB dependency, timing issue

### Phase 5: Stabilize Vitest Runtime
- Address worker teardown crashes (migrate remaining `threads` → `forks` if needed)
- Fix unhandled promise rejections
- Eliminate flaky timing-dependent tests

### Phase 6: CI Gate Validation
- Run all blocking commands sequentially
- Push to branch → monitor GitHub Actions
- All 10 blocking jobs → green → merge unlocked

---

## 9. Test File Distribution

```
tests/
├── unit/           32 files  ████░░  (blocking)
├── ai/             46 files  ██████  (non-blocking)
├── security/       17 files  ███░░░  (blocking)
├── api/            12 files  ██░░░░  (blocking)
├── performance/    15 files  ██░░░░  (non-blocking)
├── database/       10 files  █░░░░░  (blocking)
├── m5/              8 files  █░░░░░  (blocking)
├── integration/     7 files  █░░░░░  (blocking)
├── e2e/             4 files  ░░░░░░  (non-blocking)
├── ui/              2 files  ░░░░░░  (non-blocking)
├── data-intelligence/ 3 files ⚠️ ORPHAN
├── crm/             1 file  ⚠️ ORPHAN
├── enrichment/      1 file  ⚠️ ORPHAN
├── persistence/     1 file  ⚠️ ORPHAN
├── scoring/         1 file  ⚠️ ORPHAN
├── real-integration/ 3 files (local only)
└── smoke/           1 file  (local only)
                    ─────────
Total:           ~163 files
CI-covered:       ~156 files (95.7%)
Orphaned:           ~7 files (4.3%)
```

---

*This report is a living document. Update as configuration changes are applied.*
