# Test Execution Matrix — DeepMindQ M3 Stabilization

## Architecture

All vitest configs use **threads pool with single thread** (`maxThreads: 1, minThreads: 1`) for deterministic, reproducible execution. No forks — fork-based pools duplicate module graphs causing OOM on large test files.

## Blocking Jobs (CI Merge Gate)

| # | Job | Command | Config | Pool | Requires | Files | Duration |
|---|-----|---------|--------|------|----------|-------|----------|
| 1 | Security Gate | `npx vitest run --config vitest.security.config.ts` + static checks | `vitest.security.config.ts` | threads:1 | — | ~5 | ~2min |
| 2 | Dependency Audit | `node scripts/dependency-audit-ci.js` | — | — | npm | — | ~30s |
| 3 | API Security Contract | `node scripts/api-security-scan.js` | — | — | npm | — | ~30s |
| 4 | Lint + Typecheck | `npm run lint && npx tsc --noEmit` | — | — | npm, prisma | — | ~3min |
| 5 | Unit Tests | `npx vitest run --config vitest.unit.config.ts --dangerouslyIgnoreUnhandledErrors` | `vitest.unit.config.ts` | threads:1 | DATABASE_URL env | 29 | ~90s |
| 6 | Security Tests | `npx vitest run --config vitest.security.config.ts` | `vitest.security.config.ts` | threads:1 | — | ~5 | ~2min |
| 7 | API Tests | `npx vitest run --config vitest.api.config.ts` | `vitest.api.config.ts` | threads:1 | PostgreSQL service | ~5 | ~3min |
| 8 | Database Tests | `npx vitest run --config vitest.database.config.ts` | `vitest.database.config.ts` | threads:1 | PostgreSQL service | ~5 | ~3min |
| 9 | Integration Tests | `npx vitest run --config vitest.integration.config.ts` | `vitest.integration.config.ts` | threads:1 | DATABASE_URL env | ~5 | ~3min |
| 10 | Build Verification | `npm run build:vercel` | — | — | env vars | — | ~5min |

## Non-Blocking Jobs (Allowed to Fail)

| # | Job | Command | Config | Pool | Requires |
|---|-----|---------|--------|------|----------|
| 11 | AI Engine | `npx vitest run --config vitest.ai.config.ts` | `vitest.ai.config.ts` | threads:1 | prisma |
| 12 | AI Governance | `npx vitest run --config vitest.ai-governance.config.ts` | `vitest.ai-governance.config.ts` | threads:1 | prisma |
| 13 | AI Retrieval | `npx vitest run --config vitest.ai-retrieval.config.ts` | `vitest.ai-retrieval.config.ts` | threads:1 | prisma |
| 14 | AI Framework | `npx vitest run --config vitest.ai-framework.config.ts` | `vitest.ai-framework.config.ts` | threads:1 | prisma |
| 15 | AI Inference | `npx vitest run --config vitest.ai-inference.config.ts` | `vitest.ai-inference.config.ts` | threads:1 | prisma |
| 16 | E2E Tests | `npx vitest run --config vitest.e2e.config.ts` | `vitest.e2e.config.ts` | threads:1 | prisma |
| 17 | Performance | `npx vitest run --config vitest.performance.config.ts` | `vitest.performance.config.ts` | threads:1 | prisma |
| 18 | UI Components | `npx vitest run --config vitest.ui.config.ts` | `vitest.ui.config.ts` | threads:1 | prisma |
| 19 | Playwright | `npx playwright test` | playwright.config.ts | — | build, server |

## Environment Variables

### Unit Tests
| Variable | Value | Required |
|----------|-------|----------|
| CI | 'true' | Yes |
| NODE_OPTIONS | '--max-old-space-size=2048' | Yes |
| DATABASE_URL | 'postgresql://ci:ci@localhost:5432/ci_test' | Yes (Prisma import validation) |

### API Tests
| Variable | Value | Required |
|----------|-------|----------|
| DATABASE_URL | postgresql://ci_test:ci_test_pass@localhost:5432/ci_test | Yes |
| DIRECT_DATABASE_URL | postgresql://ci_test:ci_test_pass@localhost:5432/ci_test | Yes |

### Build / Playwright
| Variable | Value | Required |
|----------|-------|----------|
| DATABASE_URL | secrets.DATABASE_URL or fallback | Yes |
| NEXTAUTH_SECRET | secrets.NEXTAUTH_SECRET or fallback | Yes |
| API_KEY_ENCRYPTION_KEY | secrets.API_KEY_ENCRYPTION_KEY or fallback | Yes |
| TRACKING_SECRET | secrets.TRACKING_SECRET or fallback | Yes |
| AUTHORIZED_EMAIL | secrets.AUTHORIZED_EMAIL or fallback | Yes |

## Unit Test File Map

The monolithic `auth-authz-certification.test.ts` (2217 lines) was split into 8 focused files during M3 stabilization:

| Original Section | New File | Tests |
|-----------------|----------|-------|
| Password Hashing | `tests/unit/auth/password.test.ts` | 11 |
| RBAC Authorization | `tests/unit/auth/rbac.test.ts` | 37 |
| CSRF Protection | `tests/unit/auth/csrf.test.ts` | 17 |
| Auth Helpers | `tests/unit/auth/auth-helpers.test.ts` | 38 |
| OTP Service | `tests/unit/auth/otp.test.ts` | 20 |
| Session Manager | `tests/unit/auth/session-manager.test.ts` | 46 |
| Session Module | `tests/unit/auth/session.test.ts` | 8 |
| API Auth Guard | `tests/unit/auth/api-auth.test.ts` | 7 |

## Known Issues

### Vitest Worker Teardown Crash (Vitest 4.x + Node.js v24)
- **Symptom**: Worker exits unexpectedly AFTER all tests pass
- **Impact**: 898/898 tests pass, 27/29 files pass, 2 worker teardown errors
- **Mitigation**: `--dangerouslyIgnoreUnhandledErrors` flag in CI
- **Root cause**: Vitest 4.1.10 + Node.js v24.18.0 threads pool teardown bug
- **CI uses**: Node.js 22 (LTS) — may not exhibit this issue

## Acceptance Criteria

- [ ] Local: `npm run test:unit` passes (0 test failures)
- [ ] Local: `npm run test:security` passes
- [ ] Local: `npm run test:integration` passes
- [ ] CI: All blocking jobs green
- [ ] CI: No skipped tests in blocking jobs
- [ ] CI: No worker crashes in blocking jobs
