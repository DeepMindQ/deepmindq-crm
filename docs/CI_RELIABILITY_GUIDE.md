# CI Reliability Guide

## Purpose

This document establishes the permanent CI reliability standards for the DeepMindQ CRM repository. It describes how to ensure local validation matches GitHub Actions execution, so that **pushing a red commit never happens again**.

## 1. Core Principle

> **Local validation and GitHub CI must execute the same commands in the same order.**
>
> If `./scripts/ci-local.sh` exits 0, GitHub CI must pass. If it exits non-zero, do not push.

## 2. Local vs GitHub Runner Differences

| Factor | Local Environment | GitHub Actions Runner |
|--------|-------------------|----------------------|
| **OS** | Your machine (any OS) | ubuntu-latest |
| **Node.js** | Your installed version | v22 (set via actions/setup-node@v4) |
| **Project path** | `/home/z/my-project` or custom | `/home/runner/work/deepmindq-crm/deepmindq-crm` |
| **Memory** | Your available RAM | 7 GB (ubuntu-latest) |
| **CPUs** | Your available cores | 2-4 cores |
| **PostgreSQL** | Optional (local install) | Service container (postgres:16-alpine) |
| **Chromium** | Optional install | Installed via `npx playwright install --with-deps` |
| **Environment** | Your .env files | CI-specific env vars (hardcoded defaults) |
| **Parallelism** | Sequential (ci-local.sh) | Parallel jobs (independent runners) |

## 3. Path Portability Rules

**NEVER hardcode absolute machine-specific paths.** These paths differ between local machines and CI runners:

| Blocked Pattern | Reason | Use Instead |
|-----------------|--------|-------------|
| `/home/z/...` | Only exists on one dev machine | `path.resolve(__dirname, ...)` or `process.cwd()` |
| `/home/runner/...` | GitHub Actions specific | Relative paths or `process.cwd()` |
| `/Users/...` | macOS user-specific | `path.resolve(__dirname, ...)` |
| `/private/...` | macOS system paths | Relative paths |
| `/tmp/...` | Fragile across environments | `os.tmpdir()` or `path.join(process.cwd(), '.tmp')` |

### Enforcement

Two layers prevent hardcoded paths:

1. **ESLint rule**: `no-hardcoded-env-paths` in `eslint-rules/no-hardcoded-env-paths.js`
   - Runs on every `npm run lint` and pre-push hook
   - Flags string literals containing blocked patterns
   - Blocking error — prevents push

2. **CI scanner**: `scripts/no-hardcoded-paths.js`
   - Runs as a CI job step
   - Scans all source files for blocked patterns
   - Can be run locally: `node scripts/no-hardcoded-paths.js`

## 4. Required Node Version

The CI pipeline uses **Node.js v22** as defined in `.github/workflows/ci.yml`:

```yaml
env:
  NODE_VERSION: '22'
```

**To check your local version:**
```bash
node -v
```

If your local version differs from CI, you may encounter different behavior. Use `nvm` or `fnm` to match:

```bash
nvm install 22
nvm use 22
```

## 5. Database Requirements

Jobs 7 (API Tests) and 8 (Database Tests) require PostgreSQL. In CI, a service container provides this. Locally:

```bash
# Start PostgreSQL locally
docker run -d --name ci-postgres \
  -e POSTGRES_USER=ci_test \
  -e POSTGRES_PASSWORD=ci_test_pass \
  -e POSTGRES_DB=ci_test \
  -p 5432:5432 \
  postgres:16-alpine

# Set environment variable
export DATABASE_URL="postgresql://ci_test:ci_test_pass@localhost:5432/ci_test"

# Run database-dependent jobs
./scripts/ci-local.sh --job 7
./scripts/ci-local.sh --job 8
```

If PostgreSQL is not available, `ci-local.sh` skips these jobs with a warning (they still run in CI via service containers).

## 6. Memory Considerations

CI runners have **7 GB RAM**. The CI workflow sets:

```
NODE_OPTIONS=--max-old-space-size=2048  # 2 GB for test jobs
NODE_OPTIONS=--max-old-space-size=4096  # 4 GB for build jobs
```

`ci-local.sh` mirrors these settings. If you have less RAM available locally and experience OOM errors:

- Reduce `NODE_OPTIONS` max-old-space-size
- Or run jobs individually: `./scripts/ci-local.sh --job 5`

## 7. Timeout Considerations

| CI Job | CI Timeout | Local Expectation |
|--------|-----------|------------------|
| Security Gate | 10 min | < 30s |
| Dependency Audit | 5 min | < 5s |
| API Security Contract | 5 min | < 5s |
| Lint + Typecheck | 10 min | < 60s |
| Unit Tests | 5 min | < 3 min (memory-limited locally) |
| Security Tests | 8 min | < 30s |
| API Tests | 10 min | < 30s (requires PostgreSQL) |
| Database Tests | 8 min | < 30s (requires PostgreSQL) |
| Integration Tests | 10 min | < 10s |
| Build | 15 min | < 2 min |

## 8. Pre-Push Workflow

```
git add .
git commit -m "your message"
# Pre-push hook runs automatically:
#   → scripts/ci-local.sh --quick (mirrors CI blocking jobs)
#   → If pass: push proceeds
#   → If fail: push blocked, fix locally
git push
```

**Manual verification before push:**
```bash
# Full CI mirror (all 10 blocking jobs)
./scripts/ci-local.sh

# Quick check (skip build)
./scripts/ci-local.sh --quick

# Single job
./scripts/ci-local.sh --job 5

# Path check
node scripts/no-hardcoded-paths.js
```

## 9. Debugging CI Failures

When GitHub CI fails but ci-local.sh passed:

### Step 1: Identify the failing job
```
Check: https://github.com/DeepMindQ/deepmindq-crm/actions
```

### Step 2: Get the job logs
```
curl -H "Authorization: token $TOKEN" \
  "https://api.github.com/repos/DeepMindQ/deepmindq-crm/actions/jobs/JOB_ID/logs"
```

### Step 3: Common causes

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Hardcoded path error | `/home/z/my-project` in code | Use `path.resolve(__dirname, ...)` |
| OOM in CI | Node memory limit too low | Increase `--max-old-space-size` |
| PostgreSQL connection refused | DB service not ready | CI handles this via health checks |
| File not found | Case sensitivity | Linux is case-sensitive, macOS is not |
| Timeout | Test too slow on limited CPU | Add test isolation or increase timeout |

### Step 4: Reproduce locally
```bash
# Match CI environment as closely as possible
CI=true NODE_OPTIONS="--max-old-space-size=2048" \
  npx vitest run --config vitest.<category>.config.ts
```

## 10. CI Pipeline Architecture

```
                    ┌─────────────┐  ┌──────────────────┐
                    │ security-gate│  │ dependency-audit │
                    └──────┬──────┘  └──────────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
    ┌─────────┴──┐  ┌──────┴─────┐  ┌──┴────────────┐
    │ lint+      │  │ test-unit  │  │ test-security │
    │ typecheck  │  │            │  │               │
    └─────┬──────┘  └──────┬─────┘  └──────┬────────┘
          │               │                │
    ┌─────┴──────┐  ┌──────┴─────┐  ┌──────┴────────┐
    │ test-api   │  │ test-db    │  │ test-         │
    │ (PostgreSQL)│  │ (PostgreSQL)│  │ integration   │
    └────────────┘  └────────────┘  └───────────────┘
          │               │                │
          └───────────────┼────────────────┘
                          │
                   ┌──────┴──────┐
                   │    build    │
                   └─────────────┘
```

Non-blocking jobs (AI, E2E, Performance, UI, Playwright) run with `if: always()` and do NOT gate the build.

## 11. Adding New Tests

When adding a new test file:

1. **Add it to the correct vitest config** (unit, security, api, database, integration, etc.)
2. **Run ci-local.sh --job N** where N is the corresponding job number
3. **Verify it passes locally before committing**
4. **Never use hardcoded paths** — use `__dirname` or `process.cwd()`
5. **Never add `|| true` to test commands** — this hides failures

## 12. Maintenance

This CI reliability infrastructure requires minimal maintenance:

- **When adding a new CI job**: Update both `ci.yml` AND `ci-local.sh`
- **When changing vitest configs**: Run `ci-local.sh` to verify
- **When adding new blocked path patterns**: Update both the ESLint rule and `no-hardcoded-paths.js`
- **Monthly**: Review CI run times and adjust timeouts if needed
