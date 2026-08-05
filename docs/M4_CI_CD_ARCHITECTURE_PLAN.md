# M4 — CI/CD & Architecture Plan

**Milestone**: M4  
**Start Date**: 2026-08-05  
**Status**: IN PROGRESS  
**M3 Closure SHA**: `4646a7ba4cc3c4ecc894974700a99cd2fdcc486a`  
**M3 Closure PR**: [#10](https://github.com/DeepMindQ/deepmindq-crm/pull/10)

---

## 1. M4 Objectives

Build a reliable engineering delivery architecture where:
- **Code changes are traceable** — every commit maps to a milestone, branch, and CI run
- **CI results are trustworthy** — every job is a reliable signal, no hidden failure paths
- **Deployments are repeatable** — staging and production deployments follow documented, automated procedures
- **Environments are separated** — dev, staging, and production have distinct configurations and data
- **Releases are controlled** — production deployments require approval gates and pre-deployment validation

### Success Metrics

| Metric | Current (M3 End) | M4 Target |
|--------|-------------------|-----------|
| CI blocking jobs passing | 10/10 | 10/10 (maintain) |
| CI non-blocking jobs passing | ~3/9 | 9/9 |
| Root-level duplicate test files | 65 | 0 |
| Vitest teardown crash root cause | Unknown | Diagnosed |
| Deployment pipeline | None | Staging + Production foundations |
| `|| true` instances in CI | 1 (non-blocking) | 0 |
| Test ownership ambiguity | High (67 mirrors) | Zero |
| Documented workflow reliability | None | Complete |

---

## 2. Current M3 Baseline

### CI Pipeline State (M3 End)

**19 Total CI Jobs**: 10 Blocking + 9 Non-Blocking

Blocking Jobs (must pass for merge):
1. `security-regression` — Security regression gate
2. `dependency-audit` — Dependency security audit
3. `security-contract` — API security contract
4. `lint-typecheck` — ESLint + TypeScript compilation
5. `build-verification` — Next.js production build
6. `test-unit` — Unit tests (vitest.unit.config.ts)
7. `test-coverage` — Unit test coverage generation
8. `test-integration` — Integration tests (vitest.integration.config.ts)
9. `test-database` — Database tests with fresh PostgreSQL
10. `test-api` — API tests with seeded database

Non-Blocking Jobs (`if: always()`, informational):
1. `test-security` — Security test suite
2. `test-ai-governance` — AI governance tests (uses `|| true`)
3. `test-e2e` — Playwright E2E tests
4. `test-performance` — Performance benchmarks
5. `test-ui` — UI component tests
6. `test-real-integration` — Real integration tests
7. `coverage-report` — Coverage aggregation
8. `test-golden` — Golden dataset tests
9. `nightly-trigger` — Nightly regression trigger

### Known Workarounds

| Workaround | Location | Risk | Removal Criteria |
|------------|----------|------|-----------------|
| `tee + grep` wrapper for vitest teardown crash | `ci.yml` test-unit steps (lines ~208-230) | Low — only suppresses teardown crash, real failures still detected | Vitest fix / Node version change / pool strategy change |
| `|| true` on test-ai-governance | `ci.yml` ~line 395 | Medium — hides all failures but job is non-blocking | Same as above, or stabilize the job independently |
| `--dangerouslyIgnoreUnhandledErrors` | Same 3 commands as above | Low — suppresses unhandled rejections during teardown | Same removal criteria |
| `pool: 'threads', maxThreads: 1` | All 18 vitest configs | None (deliberate, prevents OOM) | Keep permanently — CI runner resource constraint |

### Test Architecture State (M3 End)

- **217 total test files** across root and subdirectories
- **65 root-level files** (`tests/*.test.ts`) — many are mirrors of subdirectory versions
- **9 legacy test files** in `tests/legacy/`
- **18 vitest configuration files** — each defines a test subset
- **Coverage thresholds**: 30% statements / 20% branches (uniformly low)
- **Mock rate**: ~86% of integration tests use mocked dependencies

### Key Documentation from M3

| Document | Purpose |
|----------|---------|
| `docs/TEST_EXECUTION_MATRIX.md` | Vitest teardown workaround documentation, removal criteria |
| `docs/TEST_IMPACT_MAP.md` | Test-to-source mapping for impact analysis |
| `docs/MOCK_DEPENDENCY_AUDIT.md` | Mock usage audit findings |

---

## 3. Phase Breakdown

### Phase 1 — Test Architecture Cleanup

**Execution Order**: First (reduces blast radius for Phase 2)

#### Task 1.1: Root-Level Duplicate Audit

Audit all 65 files in `tests/*.test.ts` against their subdirectory counterparts. Each file must be classified as:
- **Mirror** — identical or near-identical to a subdirectory version → DELETE
- **Unique** — contains tests not found elsewhere → RECLASSIFY to appropriate subdirectory
- **Legacy** — references deprecated/removed features → DELETE with documentation

**Validation**: For each deletion, verify the subdirectory version is picked up by a vitest config.

#### Task 1.2: Legacy Test Audit

Audit 9 files in `tests/legacy/`:
```
tests/legacy/account-brief.test.ts
tests/legacy/account-scoring.test.ts
tests/legacy/acquisition-engine.test.ts
tests/legacy/analytics-dashboard.test.ts
tests/legacy/health-export-knowledge.test.ts
tests/legacy/research-engine.test.ts
tests/legacy/signal-extraction.test.ts
tests/legacy/source-governance.test.ts
tests/legacy/sprint1-modules.test.ts
```
For each: determine if tests are still relevant, if source code still exists, and if the test is covered elsewhere.

#### Task 1.3: Test Ownership Validation

Map every remaining test file to exactly one vitest config. Identify orphaned tests (files not included by any config) and either:
- Add them to an existing config, or
- Create a new config if they represent a distinct test category

#### Task 1.4: npm Test Strategy

Update `package.json` test scripts to reflect the cleaned architecture:
- `npm test` — run all categorized configs
- Named scripts for each config (already partially exists)
- Remove references to deleted files

#### Task 1.5: Coverage Threshold Review

Evaluate current thresholds (30/20/30/30) and propose new targets:
- Analyze actual coverage achieved on M3 CI
- Set realistic thresholds that catch regressions without being fragile
- Target: raise toward 50/40/45/50 across configs

#### Task 1.6: Mock Dependency Audit Follow-Up

Continue the M3 mock audit findings:
- Identify top 10 most-mocked modules
- Prioritize which mocks can be replaced with real instances
- Target: reduce integration test mock rate from 86%

**Phase 1 Deliverables**:
- Clean test directory structure (no root-level duplicates)
- Updated vitest configs with clear ownership
- Updated `npm test` scripts
- Documented test execution model
- Coverage threshold recommendations

---

### Phase 2 — CI Stabilization

**Execution Order**: Second (after dedup reduces noise)

#### Task 2.1: Non-Blocking Job Stabilization

For each of the 9 non-blocking jobs, diagnose and fix:

| Job | Known Issue | Fix Strategy |
|-----|-------------|-------------|
| `test-security` | Likely passes but needs verification | Run and validate |
| `test-ai-governance` | Uses `|| true` (hides failures) | Apply tee+grep wrapper, then remove once stable |
| `test-e2e` | Server startup timing, flaky selectors | Fix Playwright config, increase timeout, stabilize selectors |
| `test-performance` | Mock-based benchmarks | Stabilize timing, increase thresholds |
| `test-ui` | Needs verification | Run and validate |
| `test-real-integration` | Needs PostgreSQL | Ensure CI service container configured |
| `coverage-report` | Depends on other jobs | Should pass if dependencies pass |
| `test-golden` | Needs verification | Run and validate |
| `nightly-trigger` | Meta job | Verify trigger logic |

#### Task 2.2: Remove Hidden Failure Paths

- Replace `|| true` on `test-ai-governance` with the same `tee + grep` intelligent wrapper used on blocking jobs
- Document the change in TEST_EXECUTION_MATRIX.md

#### Task 2.3: Convert Stabilized Jobs

Once a non-blocking job passes consistently (3+ consecutive CI runs):
1. Remove `if: always()` condition
2. Add to required status checks (or keep as informational with documented reasoning)
3. Update CI documentation

#### Task 2.4: Vitest Diagnostic Matrix (Parallel, Non-Blocking)

Run in parallel — does NOT block Phase 2 or Phase 3.

**Matrix**:

| | Vitest 3.x | Vitest 4.x |
|---|---|---|
| Node 20 | threads / forks | threads / forks |
| Node 22 | threads / forks | threads / forks |
| Node 24 | threads / forks | threads / forks |

**5 Validation Questions**:
1. Does the teardown crash reproduce on each combination?
2. Is the crash specific to `threads` pool or does `forks` also crash?
3. Does coverage collection affect teardown behavior?
4. Are there differences between CI (GitHub Actions) and local execution?
5. Does `--teardown-timeout` (if available) resolve the issue?

**Output Required**:
- Root cause determination
- Recommended permanent fix
- Migration/removal plan for current `tee + grep` workaround

**Fix Options**:
1. Upgrade to a Vitest version that fixes the teardown crash
2. Switch to `pool: 'forks'` if proven stable (previously caused OOM)
3. Pin a specific Node.js version if the crash is version-specific
4. Accept the workaround as permanent if no fix is viable

**Phase 2 Deliverables**:
- All 9 non-blocking jobs passing consistently
- Zero `|| true` instances in CI
- Vitest diagnostic matrix results documented
- Non-blocking jobs converted from `if: always()` to standard triggers

---

### Phase 3 — Deployment Pipeline Foundation

**Execution Order**: Third (after CI is trustworthy)

#### Task 3.1: Staging Pipeline

Create `.github/workflows/deploy-staging.yml`:
- Trigger: push to `develop` branch
- Steps:
  1. Run blocking CI jobs (reuse ci.yml as composite action or matrix)
  2. Build production bundle
  3. Deploy to staging environment
  4. Run database migrations (`prisma migrate deploy`)
  5. Seed data if needed
  6. Execute smoke tests against staging
  7. Send deployment notification (Slack/ GitHub issue comment)

#### Task 3.2: Production Pipeline

Create `.github/workflows/deploy-production.yml`:
- Trigger: push to `main` branch (after PR merge)
- Steps:
  1. Run full CI suite (blocking + non-blocking)
  2. Approval gate (GitHub Environment with required reviewers)
  3. Pre-deployment validation:
     - Verify database migration is safe (no destructive changes)
     - Verify no pending migration drift
  4. Build production bundle
  5. Deploy to production
  6. Production smoke tests (critical path verification)
  7. Post-deployment health check
  8. Rollback procedure if smoke tests fail

#### Task 3.3: Smoke Test Suite

Create `tests/smoke/` with critical path tests:
- `/api/health` returns 200
- `/api/auth/login` accepts valid credentials
- Core API endpoints respond within SLA
- Database connectivity verified
- AI engine initializes without errors

#### Task 3.4: Health Check Endpoint

Enhance or create `/api/health` endpoint:
- Database connectivity check
- Environment indicator (dev/staging/production)
- Version/SHA reporting
- Response time monitoring

#### Task 3.5: Environment Documentation

Create `docs/ENVIRONMENT_STRATEGY.md`:
- Development: local, `.env.local`, `prisma db push` allowed
- Staging: deployed from `develop`, real database, seeded
- Production: deployed from `main`, approval gate, migration safety
- Secrets management: which vars, where stored, rotation policy
- Database strategy: migration-only in CI/staging/production

**Phase 3 Deliverables**:
- Staging deployment workflow
- Production deployment workflow with approval gate
- Smoke test suite
- Health check endpoint
- Environment strategy documentation

---

### GitHub Workflow Reliability (Cross-Phase)

These improvements span all phases:

#### GWR-1: Authentication Documentation

Document in `docs/GITHUB_WORKFLOW_GUIDE.md`:
- GitHub CLI authentication (`gh auth login`)
- SSH key setup for git operations
- Git credential manager configuration
- Why tokens must NOT be embedded in remote URLs
- Token rotation procedures

#### GWR-2: Repository State Validation

Create pre-commit or CI checks:
```bash
# Verify branch matches expectation
# Verify current SHA matches remote
# Verify PR source branch
# Verify CI status before merge
```

#### GWR-3: Workflow Trigger Audit

Audit all `.github/workflows/*.yml` files:
- Verify `push` triggers target correct branches
- Verify `pull_request` triggers are appropriate
- Add `merge_group` support where required
- Remove any unintended triggers

#### GWR-4: Milestone PR Evidence Checklist

Every milestone PR must record:
- Source branch name
- Merge commit SHA
- CI run URL and status
- Passing/failing jobs list
- Known limitations and workarounds
- Rollback procedure (how to undo the merge)

#### GWR-5: GitHub Workflow Guide

Create `docs/GITHUB_WORKFLOW_GUIDE.md` covering:
1. Branch strategy (`main` = production, `develop` = staging, feature branches)
2. Commit message conventions
3. PR creation and review process
4. CI debugging (how to interpret failures, rerun, artifacts)
5. Authentication setup and troubleshooting
6. Release workflow (staging → approval → production)

---

## 4. Dependencies

### Internal Dependencies

| Dependency | Source | Impact |
|------------|--------|--------|
| M3 completion | Milestone 3 | M3 must be closed with CI green before M4 work begins |
| Test file audit data | M3 MOCK_DEPENDENCY_AUDIT.md | Phase 1.6 depends on M3 mock audit findings |
| Vitest workaround | docs/TEST_EXECUTION_MATRIX.md | Phase 2 requires understanding current workaround |
| CI workflow | `.github/workflows/ci.yml` | All phases modify or extend this file |

### External Dependencies

| Dependency | Purpose | Risk |
|------------|---------|------|
| GitHub Actions runners | CI execution | Runner resource limits (OOM) affect Vitest pool strategy |
| PostgreSQL 16 service container | Database tests | Available via GitHub Actions services |
| Vercel (or target platform) | Deployment | Phase 3 requires platform-specific deployment configuration |
| Vitest upstream fixes | Teardown crash | Uncontrollable — diagnostic matrix determines workaround path |

### Cross-Phase Dependencies

```
Phase 1 (Test Cleanup) ──→ Phase 2 (CI Stabilization) ──→ Phase 3 (Deployment)
         │                           │
         │                           └──→ Vitest Diagnostic Matrix (parallel, non-blocking)
         │
         └──→ GitHub Workflow Reliability (continuous, cross-phase)
```

---

## 5. Risks

### High Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| Test dedup breaks CI | Deleting root-level files that CI references directly | Audit CI job test commands before deletion; verify each config's include paths |
| Non-blocking jobs reveal hidden failures | Removing `|| true` or `if: always()` exposes real bugs | Phase 1 dedup first reduces noise; fix real bugs as discovered |
| Vitest diagnostic inconclusive | Matrix doesn't reproduce crash or finds no fix | Keep `tee + grep` workaround as permanent documented solution |

### Medium Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| Coverage threshold raise breaks CI | New thresholds too aggressive for current code | Set thresholds based on actual coverage data; raise incrementally |
| Deployment platform not ready | Phase 3 blocked by Vercel/platform configuration | Phase 1 and 2 proceed independently; Phase 3 can use any platform |
| `pool: 'forks'` still OOM on CI | Diagnostic matrix confirms forks crash | Stay on threads, keep `tee + grep` workaround |

### Low Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| Legacy test deletion removes valuable tests | Loss of test coverage for edge cases | Full audit before deletion; only delete confirmed duplicates/dead code |
| Environment documentation drift | Docs become outdated | Include environment docs in CI validation |

---

## 6. Completion Criteria

### Phase 1 Complete When:
- [ ] 65 root-level duplicate test files audited (mirror / unique / legacy)
- [ ] Confirmed mirrors deleted
- [ ] 9 legacy test files audited
- [ ] Every test file belongs to exactly one vitest config
- [ ] `npm test` execution strategy updated
- [ ] Coverage thresholds reviewed and new targets set
- [ ] Test execution model documented

### Phase 2 Complete When:
- [ ] All 9 non-blocking CI jobs pass consistently (3+ consecutive green runs)
- [ ] `|| true` removed from `test-ai-governance` (replaced with tee+grep or proper fix)
- [ ] Playwright E2E tests stabilized
- [ ] Non-blocking jobs converted from `if: always()` to standard triggers
- [ ] Vitest diagnostic matrix executed and results documented
- [ ] Root cause and fix path determined (or workaround accepted as permanent)

### Phase 3 Complete When:
- [ ] Staging deployment workflow created and tested
- [ ] Production deployment workflow with approval gate created
- [ ] Smoke test suite passes against staging/production
- [ ] Health check endpoint deployed and verified
- [ ] Environment strategy documented

### GitHub Workflow Reliability Complete When:
- [ ] Authentication process documented
- [ ] Repository state validation checks in place
- [ ] All workflow triggers audited and correct
- [ ] PR evidence checklist template created
- [ ] `docs/GITHUB_WORKFLOW_GUIDE.md` created

### M4 Final Acceptance:
- [ ] Test architecture cleaned — no duplicate files, clear ownership
- [ ] CI jobs reliable — all 19 jobs are trustworthy signals
- [ ] Vitest issue diagnosed — root cause known, fix path documented
- [ ] GitHub workflow hardened — authentication, triggers, state validation
- [ ] Deployment pipeline foundation ready — staging + production workflows exist
- [ ] Environment strategy documented — dev/staging/production separation

---

*Plan created: 2026-08-05*
*Based on M3 closure evidence: PR #10, SHA 4646a7ba*
