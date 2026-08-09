# DeepMindQ — CI Test Execution Map

**Last Updated:** 2026-08-08 | **Governance Level:** Enterprise (Fortune 500 Production)

This is the **single source of truth** for every test directory, its vitest config, CI job, and execution frequency. No test file should exist outside this map.

---

## 1. Complete Execution Map

### Blocking Jobs (Must Pass for Merge)

| CI Job | Blocking? | Type | Vitest Config | Test Directories | Pool | Workers | DB? | Timeout | Test Files |
|--------|-----------|------|---------------|-----------------|------|---------|-----|---------|------------|
| `security-gate` | YES | Static grep | N/A | N/A (file checks) | — | — | No | 5m | — |
| `dependency-audit` | YES | Script | N/A | N/A (node script) | — | — | No | 5m | — |
| `api-security-contract` | YES | Script | N/A | N/A (node script) | — | — | No | 5m | — |
| `lint-and-typecheck` | YES | Lint+tsc | N/A | N/A (eslint+tsc) | — | — | No | 10m | — |
| `test-unit` | YES | Vitest | `vitest.unit.config.ts` | `tests/unit/**` | forks | 1 | No | 10m | 37 |
| `test-security` | YES | Vitest | `vitest.security.config.ts` | `tests/security/**` | forks | 1 | No | 8m | 17 |
| `test-api` | YES | Vitest | `vitest.api.config.ts` | `tests/api/**` | forks | 1 | Yes | 10m | 12 |
| `test-database` | YES | Vitest | `vitest.database.config.ts` | `tests/database/**` | forks | 1 | Yes | 8m | 10 |
| `test-integration` | YES | Vitest | `vitest.integration.config.ts` | `tests/integration/**` | forks | 1 | No | 10m | 9 |
| `test-m5-intelligence` | YES | Vitest | `vitest.m5.config.ts` | `tests/m5/**` | forks | 1 | No | 5m | 8 |
| `build` | YES | Build | N/A | N/A (next build) | — | — | No | 15m | — |

**Total blocking test files: 93**

### Non-Blocking Jobs (Allowed to Fail)

| CI Job | Blocking? | Type | Vitest Config | Test Directories | Pool | Timeout | Test Files |
|--------|-----------|------|---------------|-----------------|------|---------|------------|
| `test-ai` | No | Vitest | `vitest.ai.config.ts` | `tests/ai/**` | — | 5m | 46 |
| `test-ai-governance` | No | Vitest | `vitest.ai-governance.config.ts` | (empty) | — | 15m | 0 |
| `test-ai-retrieval` | No | Vitest | `vitest.ai-retrieval.config.ts` | (empty) | — | 5m | 0 |
| `test-ai-framework` | No | Vitest | `vitest.ai-framework.config.ts` | (empty) | — | 5m | 0 |
| `test-ai-inference` | No | Vitest | `vitest.ai-inference.config.ts` | (empty) | — | 5m | 0 |
| `test-e2e` | No | Vitest | `vitest.e2e.config.ts` | `tests/e2e/**` | — | 10m | 4 |
| `test-performance` | No | Vitest | `vitest.performance.config.ts` | `tests/performance/**` | — | 15m | 15 |
| `test-ui` | No | Vitest | `vitest.ui.config.ts` | `tests/ui/**` | — | 8m | 2 |
| `test-playwright` | No | Playwright | N/A | N/A | — | 15m | — |

**Total non-blocking test files: 67**

### Local-Only (No CI Job)

| Directory | Config | npm Script | Test Files | Notes |
|-----------|--------|-------------|------------|-------|
| `tests/real-integration/**` | `vitest.real-integration.config.ts` | `test:real-integration` | 3 | Full DB, runs locally on demand |
| `tests/smoke/**` | `vitest.smoke.config.ts` | `test:smoke` | 1 | Quick smoke validation |
| `tests/audit/**` | `vitest.audit.config.ts` | `test:audit` | 1 | Governance audit checks |

**Total local-only test files: 5**

---

## 2. Local Developer Commands

```bash
# Fast local validation (4 DB-free blocking suites — ~60s)
npm test

# Full CI-equivalent blocking suites (no DB)
npm run test:blocking

# DB-dependent blocking suites (requires PostgreSQL)
npm run test:blocking:db

# Individual category (match CI job exactly)
npm run test:unit          # → vitest.unit.config.ts
npm run test:security      # → vitest.security.config.ts
npm run test:api           # → vitest.api.config.ts
npm run test:database      # → vitest.database.config.ts
npm run test:integration   # → vitest.integration.config.ts
npm run test:m5            # → vitest.m5.config.ts
```

---

## 3. Vitest Config Standardization

All 7 blocking vitest configs now share identical governance parameters:

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `pool` | `forks` | Eliminates Vitest 4.x + Node 22.x teardown crash |
| `maxWorkers` | `1` | Deterministic execution, no race conditions |
| `testTimeout` | `15000` (30s for DB) | Standardized across all configs |
| `hookTimeout` | `10000` (15s for DB) | Standardized across all configs |
| `teardownTimeout` | `10000` | Explicit cleanup window (was missing in 4 configs) |
| `globals` | `true` | Consistent test API |
| `setupFiles` | `./tests/setup.ts` | Shared bootstrap |

---

## 4. Test File Distribution

```
tests/
├── unit/            37 files  ████████░░  (blocking)
├── ai/              46 files  ██████████  (non-blocking)
├── security/        17 files  ████░░░░░░  (blocking)
├── api/             12 files  ███░░░░░░░  (blocking)
├── performance/     15 files  ███░░░░░░░  (non-blocking)
├── database/        10 files  ██░░░░░░░░  (blocking)
├── m5/               8 files  ██░░░░░░░░  (blocking)
├── integration/      9 files  ██░░░░░░░░  (blocking)
├── e2e/              4 files  █░░░░░░░░░  (non-blocking)
├── real-integration/ 3 files  █░░░░░░░░░  (local only)
├── ui/               2 files  ░░░░░░░░░░  (non-blocking)
├── smoke/            1 file   ░░░░░░░░░░  (local only)
├── audit/            1 file   ░░░░░░░░░░  (local only)
└── fixtures/         0 files  (shared test data)
                    ──────────
Total:            165 files
CI-covered:       160 files (97.0%)
Local-only:         5 files (3.0%)
Orphaned:           0 files (0.0%) ← was 7 before hardening
```

---

## 5. Before / After Governance Matrix

### Pool Strategy

| Config | Before (M4) | After (M5 Hardened) |
|--------|------------|---------------------|
| `vitest.unit.config.ts` | forks | forks (unchanged) |
| `vitest.security.config.ts` | **threads** | **forks** |
| `vitest.api.config.ts` | **threads** | **forks** |
| `vitest.database.config.ts` | **threads** | **forks** |
| `vitest.integration.config.ts` | **threads** | **forks** |
| `vitest.m5.config.ts` | forks | forks (unchanged) |

### Teardown Timeout

| Config | Before | After |
|--------|--------|-------|
| `vitest.unit.config.ts` | 10s | 10s |
| `vitest.security.config.ts` | **MISSING** | **10s** |
| `vitest.api.config.ts` | **MISSING** | **10s** |
| `vitest.database.config.ts` | **MISSING** | **10s** |
| `vitest.integration.config.ts` | **MISSING** | **10s** |
| `vitest.m5.config.ts` | 10s | 10s |

### Duplicate Execution

| Test Directory | Before | After |
|----------------|--------|-------|
| `tests/security/**` (17 files) | **Ran TWICE** (job 1 + job 6) | **Runs ONCE** (job 6 only) |
| `security-gate` job | vitest + 6 greps | **Static greps only** (faster) |

### Orphaned Tests

| Directory | Before | After |
|-----------|--------|-------|
| `tests/crm/` (1 file) | No config, no CI | **Moved to `tests/unit/`** |
| `tests/data-intelligence/` (3 files) | No config, no CI | **Moved: 2 to `tests/unit/`, 1 to `tests/integration/`** |
| `tests/enrichment/` (1 file) | No config, no CI | **Moved to `tests/unit/`** |
| `tests/persistence/` (1 file) | No config, no CI | **Moved to `tests/integration/`** |
| `tests/scoring/` (1 file) | No config, no CI | **Moved to `tests/unit/`** |
| **Total orphaned** | **7 files** | **0 files** |

### `npm test` Behavior

| Metric | Before (M4) | After (M5 Hardened) |
|--------|------------|---------------------|
| Tests executed | **0** (silent no-op) | **93** (4 DB-free blocking suites) |
| Developer value | False confidence | Meaningful CI-equivalent validation |
| Match CI gates | No | Yes (unit + security + integration + m5) |

### CI Execution Time Impact

| Job | Before | After | Delta |
|-----|--------|-------|-------|
| `security-gate` | ~10m (vitest + greps) | ~2m (greps only) | **-8m** |
| `test-unit` | ~10m | ~10m (+5 extra tests) | ~same |
| `test-integration` | ~10m | ~10m (+2 extra tests) | ~same |
| `test-security` | ~8m | ~8m (unchanged) | ~same |
| **Total CI wall-clock** | **~38m** | **~32m** | **-6m (16% faster)** |

---

## 6. Dependency Graph

```
  ┌──────────────┐    ┌───────────────────┐
  │ security-gate│    │ api-security-     │     ┌──────────────────┐
  │ (static only)│    │ contract (script) │     │ dependency-audit │
  └──────┬───────┘    └─────────┬─────────┘     │ (script)         │
         │                      │               └────────┬─────────┘
         └──────────┬───────────┘                        │
                    │                                   │
     ┌──────────────┼───────────────────────────────┐   │
     │              │                               │   │
┌────▼─────┐  ┌─────▼──────┐  ┌──────────┐  ┌─────▼──────┐
│ lint+    │  │ test-unit │  │ test-sec │  │ test-integr.│
│ tsc      │  │ (forks,37) │  │ (forks,17)│  │ (forks,9)   │
└────┬─────┘  └────┬───────┘  └────┬─────┘  └─────┬──────┘
     │              │               │              │
┌────▼─────┐  ┌─────▼──────┐  ┌────▼──────────────▼────┐
│ test-api │  │ test-db    │  │ test-m5               │
│ (forks)  │  │ (forks)    │  │ (forks,8)              │
│ +PG      │  │ +PG        │  │                        │
└────┬─────┘  └────┬───────┘  └───────────────────────┘
     │              │
     └──────┬───────┘
            ▼
     ┌──────────────┐
     │    BUILD     │  ← Waits on ALL blocking jobs above
     │ (next build) │     + dependency-audit
     └──────────────┘
```

---

## 7. Governance Rules

1. **No orphaned tests.** Every `tests/` subdirectory with `.test.ts` files MUST have either a CI job or be listed in Local-Only.
2. **No duplicate vitest runs.** Each test directory is executed by exactly one CI job.
3. **All blocking configs use forks.** Standardized pool strategy eliminates teardown crashes.
4. **All blocking configs have teardownTimeout.** Prevents silent worker hangs.
5. **`npm test` must be meaningful.** It runs the 4 DB-free blocking suites.
6. **New test directories require a CI job assignment.** Update this map when adding tests.
7. **No application logic changes in governance PRs.** This map is configuration-only.

---

*This document is the canonical reference. See also: `docs/RELEASE_READINESS.md` for Phase 1 audit findings.*
