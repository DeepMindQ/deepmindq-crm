# Enterprise Test Architecture — Phase 5.5

## Overview

DeepMindQ uses a **categorized test architecture** where tests are separated by responsibility
and run independently. This eliminates OOM failures, enables parallel CI execution,
and supports unlimited test growth without increasing memory pressure.

## Architecture

```
tests/
├── unit/           Pure logic, no DB/API/network (node)
├── security/       Auth, CSRF, RBAC, session management (node)
├── api/            API route handlers, request/response (node)
├── database/       Prisma queries, DB operations (node)
├── ai/             AI engine, tracing, cost, knowledge (node)
├── integration/    Cross-module, multi-service flows (node)
├── e2e/            End-to-end business journeys (node)
├── performance/    Benchmarks, scale, memory profiling (node)
├── ui/             React component tests (jsdom)
└── legacy/         Archived tests (not executed)
```

Each category has a dedicated Vitest configuration:
`vitest.{category}.config.ts`

## Running Tests Locally

### Run a Single Category

```bash
npm run test:unit           # ~500 tests, 2s
npm run test:security      # ~177 tests, 3s
npm run test:api           # ~700+ tests, 8s
npm run test:database      # ~422 tests, 3s
npm run test:ai            # ~900+ tests, 30s
npm run test:integration   # ~139 tests, 2s
npm run test:e2e           # ~30 tests, 3s
npm run test:performance  # ~219 tests, 4s
npm run test:ui            # ~102 tests, 2s
```

### Run Full Regression

```bash
npm run test:full           # All categories sequentially
```

Use `test:full` for release validation, nightly regression, or production certification.
CI pull requests run categories independently in parallel.

### Run with Coverage

```bash
npm run test:coverage -- --config vitest.unit.config.ts
```

### Watch Mode (Development)

```bash
npx vitest --config vitest.unit.config.ts    # Watch unit tests
npx vitest --config vitest.ai.config.ts      # Watch AI tests
```

## Writing New Tests

1. **Choose the category** based on what the test verifies:
   - Testing a pure function? → `tests/unit/`
   - Testing auth/CSRF/RBAC? → `tests/security/`
   - Testing an API route? → `tests/api/`
   - Testing a DB query? → `tests/database/`
   - Testing AI logic/cost? → `tests/ai/`
   - Testing cross-module flow? → `tests/integration/`
   - Testing a user journey? → `tests/e2e/`
   - Testing benchmarks? → `tests/performance/`
   - Testing a React component? → `tests/ui/`

2. **Place the file** in the matching `tests/{category}/` directory.

3. **Use `@/` imports** for all source files (the `@` alias maps to `./src/`).

4. **Do NOT use jsdom** unless writing UI tests. Backend tests run in `node` environment.

## Category Details

| Category | Environment | Timeout | Max Forks | Memory | Test Count |
|----------|-----------|---------|-----------|--------|-----------|
| unit | node | 10s | 2 | 2GB | ~500 |
| security | node | 15s | 2 | 2GB | ~177 |
| api | node | 15s | 2 | 2GB | ~700 |
| database | node | 20s | 2 | 2GB | ~422 |
| ai | node | 20s | 2 | 3GB | ~900 |
| integration | node | 30s | 2 | 3GB | ~139 |
| e2e | node | 60s | 2 | 3GB | ~30 |
| performance | node | 120s | 1 | 4GB | ~219 |
| ui | jsdom | 15s | 1 | 3GB | ~102 |

## CI Pipeline

GitHub Actions runs each category as an **independent job** on a fresh runner:

```
security-gate → [dependency-audit, api-security-contract]
                     ↓
              [lint-and-typecheck, test-unit, test-security, test-api,
               test-database, test-ai, test-integration, test-e2e,
               test-performance, test-ui]
                     ↓
                   build
```

Each job gets dedicated memory, independent failure tracking, and clear diagnostics.

### Nightly Regression

A separate `nightly-regression.yml` workflow runs at 02:00 UTC daily:
- Full regression suite
- Performance benchmarks
- Memory leak detection
- Coverage report generation
- Artifact storage (30-day retention)

## Coverage Governance

| Phase | Statements | Branches | Functions | Lines |
|-------|-----------|----------|-----------|-------|
| Phase 5.5 (current) | 30% | 20% | 30% | 30% |
| Phase 6 target | 50% | 40% | 50% | 50% |
| Production target | 80% | 70% | 80% | 80% |

Thresholds are **never artificially lowered** to make CI pass.

## Test Sharding (Future)

For categories exceeding 1,000 tests, use Vitest's built-in sharding:

```bash
npx vitest run --config vitest.ai.config.ts --shard=1/4
npx vitest run --config vitest.ai.config.ts --shard=2/4
npx vitest run --config vitest.ai.config.ts --shard=3/4
npx vitest run --config vitest.ai.config.ts --shard=4/4
```

This allows unlimited growth without increasing per-job memory pressure.

## Legacy Tests

Tests in `tests/legacy/` are archived and not executed. These reference deleted source files,
outdated API shapes, or broken imports. They are preserved for reference during future rewrites.
