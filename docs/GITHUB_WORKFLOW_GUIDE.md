# GitHub Workflow Guide — DeepMindQ

> **Purpose**: Standardised GitHub workflow procedures incorporating reliability improvements
> derived from M3/M4 milestone lessons. This document ensures every contributor follows
> consistent branch, commit, PR, CI, and release practices to minimise friction and prevent
> regressions.

---

## Table of Contents

1. [Branch Strategy](#1-branch-strategy)
2. [Commit Process](#2-commit-process)
3. [PR Process](#3-pr-process)
4. [CI Architecture Overview](#4-ci-architecture-overview)
5. [CI Debugging Guide](#5-ci-debugging-guide)
6. [GitHub Authentication Setup](#6-github-authentication-setup)
7. [Release Workflow](#7-release-workflow)
8. [Milestone PR Evidence Checklist](#8-milestone-pr-evidence-checklist)
9. [Troubleshooting Common Issues](#9-troubleshooting-common-issues)
10. [Repository Change Verification Checklist](#10-repository-change-verification-checklist)

---

## 1. Branch Strategy

DeepMindQ uses a **dual-trunk** model with named feature branches to keep the commit
history searchable and CI execution predictable.

### Branch Hierarchy

| Branch Pattern | Purpose | CI Triggers | Merge Target |
|---|---|---|---|
| `main` | **Production** — always deployable | Push, PR | — (protected) |
| `develop` | **Staging** — integration target | Push, PR | — (protected) |
| `m*-` | Milestone branch (e.g. `m3-security-hardening`) | Push, PR | `develop` → `main` |
| `phase*-` | Phase branch (e.g. `phase2-ai-engine`) | Push, PR | `develop` → `main` |
| `ticket*` | Ticket/issue branch (e.g. `ticket-142-fix-login`) | Push, PR | `develop` |

### Rules

- **All branches** trigger the full CI suite on push and on PR creation/update.
- Feature branches **must** target `develop`, never `main` directly.
- `main` and `develop` are protected — force-pushes are disabled.
- Delete feature branches after merge to keep the branch list clean.
- Never commit directly to `main` or `develop` — always use a PR.

### Naming Convention

```
<type>-<short-description>

Types:  m3, m4, phase1, phase2, ticket-<number>, hotfix
Example: m4-ci-reliability, ticket-187-rate-limit-bug
```

---

## 2. Commit Process

### Commit Message Format

Follow **Conventional Commits** (enforced by lint-staged + commitlint where configured):

```
<type>(<scope>): <short description> [ticket-<n>]

<body explaining what and why>

<footer with breaking changes or references>
```

**Types**: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `perf`, `security`

**Examples**:

```
fix(auth): resolve CSRF token refresh race condition [ticket-142]

The CSRF token was being regenerated mid-request when concurrent
requests hit the middleware. This locks the token store during
rotation.

test(ai-retrieval): add hybrid search integration tests [ticket-155]

ci(workflows): pin Vitest to 3.x to avoid teardown crash [m3]
```

### Pre-Commit Hooks

- **ESLint** runs on staged files.
- **TypeScript** type-checks affected modules.
- If pre-commit hooks stall or time out, see [Troubleshooting](#9-troubleshooting-common-issues).

### Pushing

**Standard push**:

```bash
git push origin <branch-name>
```

**When pre-push hooks cause timeouts** (M3 lesson — GitHub Actions auto-generated token
embedded in remote URL triggers slow credential checks):

```bash
git push --no-verify origin <branch-name>
```

> ⚠️ `--no-verify` skips client-side hooks. Use only when hooks are
> demonstrably broken, not to bypass legitimate checks.

---

## 3. PR Process

### Before Creating a PR

1. **Rebase** onto the latest target branch (`develop` or `main`).
2. **Run local CI smoke test** to catch obvious failures before pushing:
   ```bash
   npm run lint && npm run typecheck && npm run test:unit
   ```
3. **Update documentation** if the PR changes public APIs, architecture, or workflows.
4. **Verify no leftover debug code** — `console.log`, temporary `TODO` hacks, etc.

### PR Title Format

```
<type>(<scope>): <description> [ticket-<n>]
```

### PR Template Checklist

Every PR **must** include:

- [ ] **Description** — What changed and why.
- [ ] **Testing** — How changes were tested locally.
- [ ] **CI Status** — All 20 CI jobs passing (or documented exceptions).
- [ ] **Breaking Changes** — None, or a migration guide.
- [ ] **Documentation Updated** — If applicable.
- [ ] **Rollback Plan** — How to revert if issues arise post-merge.

### Review Requirements

| PR Target | Required Approvals | CI Requirement |
|---|---|---|
| `develop` | 1 reviewer | All jobs green |
| `main` | 2 reviewers + 1 lead | All jobs green + staging validation |

### Merge Strategy

- Use **Squash and Merge** for feature branches to keep `main`/`develop` linear.
- Use **Rebase and Merge** only when commit granularity matters (e.g., milestone evidence).
- Never use **Create a Merge Commit** — it produces noisy history.

---

## 4. CI Architecture Overview

### Pipeline Summary

```
Trigger: push to main/develop, pull_request to main/develop
         ↓
  ┌──────────────────────────────────────────────────────┐
  │              GATE JOBS (blocking)                     │
  │  security-gate  │  dependency-audit  │  api-security-  │
  │                  │                    │    contract     │
  └────────┬─────────┴────────┬───────────┴───────┬───────┘
           │                  │                   │
  ┌────────▼──────────────────▼───────────────────▼───────┐
  │            QUALITY GATE (blocking)                     │
  │            lint-and-typecheck                          │
  └───────────────────────┬───────────────────────────────┘
                          │
  ┌───────────────────────▼───────────────────────────────┐
  │              TEST MATRIX (16 jobs, all blocking)       │
  │  test-unit │ test-security │ test-api │ test-database │
  │  test-ai   │ test-ai-gov   │ test-ai-ret │ test-ai-fw  │
  │  test-ai-inf │ test-integration │ test-e2e │ test-perf  │
  │  test-ui                                                │
  └───────────────────────┬───────────────────────────────┘
                          │
  ┌───────────────────────▼───────────────────────────────┐
  │              BUILD (blocking, depends on all above)   │
  │              build                                     │
  └───────────────────────────────────────────────────────┘
```

### Job Catalogue (20 total)

| # | Job Name | Purpose | Blocking | Service Dependencies |
|---|---|---|---|---|
| 1 | `security-gate` | Permanent security regression gates | ✅ | — |
| 2 | `dependency-audit` | npm dependency vulnerability scan | ✅ | — |
| 3 | `api-security-contract` | Static API auth guard verification | ✅ | — |
| 4 | `lint-and-typecheck` | ESLint + TypeScript compilation | ✅ | — |
| 5 | `test-unit` | Pure logic unit tests | ✅ | — |
| 6 | `test-security` | Auth / CSRF / RBAC security tests | ✅ | — |
| 7 | `test-api` | API route handler tests | ✅ | PostgreSQL |
| 8 | `test-database` | Database / Prisma ORM tests | ✅ | PostgreSQL |
| 9 | `test-ai` | AI engine core tests | ✅ | — |
| 10 | `test-ai-governance` | AI governance, prompt registry, config coverage | ✅ | — |
| 11 | `test-ai-retrieval` | AI retrieval, hybrid search, knowledge graph | ✅ | — |
| 12 | `test-ai-framework` | AI agent framework, memory, evaluation engine | ✅ | — |
| 13 | `test-ai-inference` | AI hallucination, confidence, recommendation engine | ✅ | — |
| 14 | `test-integration` | Cross-module integration tests | ✅ | — |
| 15 | `test-e2e` | End-to-end business journey tests | ✅ | — |
| 16 | `test-performance` | Benchmarks, scale, memory tests | ✅ | — |
| 17 | `test-ui` | React component tests | ✅ | — |
| 18 | `build` | Final production build verification | ✅ | All above |

### Runtime Configuration

| Parameter | Value | Rationale |
|---|---|---|
| Node.js version | `22` | Current LTS, matches production |
| Test runner | Vitest | Fast, ESM-native, compatible config |
| Worker pool | `pool: 'forks'` | Avoids Vitest 4.x threads teardown crash (M3 lesson) |
| Max workers | `2` | Conservative parallelism for CI resource stability |
| Concurrency group | `ci-${{ github.ref }}` | One CI run per branch at a time |
| Cancel in progress | `true` | New pushes supersede stale runs, saving minutes |

### Concurrency Control

```yaml
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

- Each branch gets exactly **one active CI run**.
- Pushing new commits **cancels** the previous in-progress run for that branch.
- This prevents CI queue buildup on active feature branches.

---

## 5. CI Debugging Guide

### Reproducing a CI Failure Locally

CI jobs map directly to npm scripts. To reproduce any failing job:

```bash
# Example: reproduce test-api failure
npx vitest run --config vitest.config.api.ts --pool forks --poolOptions.forks.maxForks 2

# Example: reproduce test-ai failure
npx vitest run --config vitest.config.ai.ts --pool forks --poolOptions.forks.maxForks 2

# Example: reproduce lint-and-typecheck failure
npm run lint && npm run typecheck
```

### Reading CI Logs

1. Open the failed workflow run in GitHub Actions.
2. Click the red ✗ job.
3. Expand the **Run Tests** step.
4. Look for the **summary table** at the end — it lists every test file with pass/fail.
5. Scroll up from the first `FAIL` line to find the assertion error.

### Common Failure Patterns

| Symptom | Likely Cause | Fix |
|---|---|---|
| All tests pass but job fails with exit code 1 | Vitest teardown crash (M3) | Ensure `pool: 'forks'` in config; avoid `pool: 'threads'` |
| `test-api` fails with ECONNREFUSED | PostgreSQL service not ready | Add `services:` wait or increase `sleep` in workflow |
| `test-security` fails after auth refactor | CSRF/RBAC contract changed | Update test expectations to match new guard behaviour |
| `build` fails but all tests pass | Type error only caught by `tsc --noEmit` | Run `npm run typecheck` locally; check for `@ts-ignore` abuse |
| Random test flake in `test-e2e` | Timing-sensitive async operations | Increase timeouts, use `waitFor()` instead of fixed `sleep` |
| OOM in `test-performance` | Memory leak or insufficient runner RAM | Check `--max-old-space-size`; profile with `--inspect` |

### Vitest Worker Teardown Crash (M3 Lesson)

**Problem**: Vitest 4.x + Node.js 22.x crashes during teardown after all tests pass,
causing the CI job to report failure despite a green test summary.

**Current workaround**: All Vitest configurations use `pool: 'forks'` which sidesteps the
threads-specific teardown crash path.

**Do not** change to `pool: 'threads'` without validating stability on Node 22.x.

---

## 6. GitHub Authentication Setup

### Container Environment Issues

When running inside a GitHub Actions container or Codespace:

| Issue | Cause | Resolution |
|---|---|---|
| `git push` times out | Pre-push hooks trigger slow credential negotiation | `git push --no-verify` |
| Token embedded in remote URL | GitHub Actions auto-generates `https://x-access-token:...@github.com/...` | This is normal inside Actions; do not modify |
| `.git/HEAD` resets to `main` | Container checkout overrides HEAD reference | Manually correct: `git checkout <your-branch>` and verify with `git branch --show-current` |

### Local Development Authentication

```bash
# Configure Git credentials for HTTPS
git config --global credential.helper store

# Or use SSH (recommended for frequent contributors)
ssh-keygen -t ed25519 -C "your-email@example.com"
gh ssh-key add ~/.ssh/id_ed25519.pub
```

### Personal Access Token (PAT)

For automated scripts or CI debugging outside GitHub Actions:

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**.
2. Create a token with `Contents: Read and Write` scope.
3. Store securely (e.g., `gh auth login --with-token < token.txt`).
4. **Never commit tokens** — use GitHub Secrets for any workflow credentials.

---

## 7. Release Workflow

### Release Criteria

A release from `develop` to `main` requires:

1. **All 20 CI jobs green** on `develop`.
2. **No open critical/high severity issues** in the milestone.
3. **Staging validation** completed (deploy `develop` to staging, smoke-test).
4. **At least 2 approving reviews** on the release PR.
5. **Release notes** drafted and reviewed.

### Release PR Process

```bash
# 1. Ensure develop is up to date
git checkout develop
git pull origin develop

# 2. Create release branch
git checkout -b release/v<version>

# 3. Bump version
npm version <major|minor|patch> --no-git-tag-version

# 4. Update CHANGELOG.md

# 5. Commit and push
git add -A
git commit -m "chore(release): prepare v<version>"
git push --no-verify origin release/v<version>

# 6. Create PR: release/v<version> → main
gh pr create --base main --title "chore(release): v<version>" --body "..."

# 7. After merge, tag the release
git checkout main
git pull
git tag v<version>
git push origin v<version>
```

### Post-Release

1. GitHub Actions will trigger CI on `main` — verify it passes.
2. Deploy `main` to production following the [Deployment Guide](./DEPLOYMENT_GUIDE.md).
3. Close the milestone in GitHub Issues.
4. Archive milestone evidence per the checklist below.

---

## 8. Milestone PR Evidence Checklist

Every milestone PR (e.g., M3, M4, phase deliveries) **must** include the following
evidence in the PR description. Copy this template and fill in each field.

```markdown
## Milestone Evidence

### Branch Information
- **Branch name**: `<branch-name>`
- **Commit SHA**: `<full-sha>`
- **Base branch**: `develop` / `main`

### CI Results
- **CI Run URL**: `<link to GitHub Actions run>`
- **Overall status**: ✅ Passing / ❌ Failing / ⚠️ Partial
- **Passing jobs**: <list all passing job names>
- **Failing jobs**: <list any failing job names, or "None">
- **Skipped jobs**: <list any skipped jobs and reason>

### Known Limitations and Workarounds
- <document any known issues, temporary workarounds, or
  technical debt accepted for this milestone>

### Rollback Procedure
1. <step-by-step rollback instructions>
2. <commands to revert if necessary>
3. <data migration rollback if applicable>

### Testing Summary
- **Tests added**: <count>
- **Tests removed/refactored**: <count>
- **Coverage delta**: <before> → <after>
- **Manual testing performed**: <description>
```

### Evidence Retention

- CI run logs are retained for **90 days** by GitHub (free tier).
- Download and archive logs for critical milestones using:
  ```bash
  gh run view <run-id> --log > ci-logs-<milestone>.txt
  ```
- Attach archived logs to the milestone PR as a workflow artifact.

---

## 9. Troubleshooting Common Issues

### Issue: CI Cancels My Run Immediately

**Cause**: Concurrency group `ci-${{ github.ref }}` cancels in-progress runs when a new
push arrives on the same branch.

**Fix**: This is intentional. If you need to preserve a run, push to a new branch name
or use `workflow_dispatch` for manual triggering.

---

### Issue: Vitest Teardown Crash (Exit Code 1, All Tests Pass)

**Cause**: Known bug — Vitest 4.x worker threads crash during teardown on Node.js 22.x.

**Fix**:
1. Verify all configs use `pool: 'forks'`.
2. Do not switch to `pool: 'threads'`.
3. If the crash persists with forks, pin Vitest to a known-stable version:
   ```bash
   npm install vitest@3.x --save-dev
   ```

---

### Issue: `git push` Hangs or Times Out

**Cause**: Pre-push hooks may invoke slow credential or lint checks, especially inside
container environments where the token is embedded in the remote URL.

**Fix**:
```bash
git push --no-verify origin <branch>
```
If the problem persists without hooks, check network connectivity and GitHub status.

---

### Issue: `.git/HEAD` Shows `main` After Checkout in Container

**Cause**: Container-based environments (GitHub Actions, Codespaces) may override the
HEAD reference during environment setup.

**Fix**:
```bash
git checkout <your-branch>
git branch --show-current  # Verify correct branch
```

---

### Issue: `test-api` or `test-database` Fails with Connection Refused

**Cause**: PostgreSQL service container hasn't finished initialising when tests start.

**Fix**: In `.github/workflows/ci.yml`, ensure the test step has a readiness check:
```yaml
- name: Wait for PostgreSQL
  run: |
    for i in $(seq 1 30); do
      pg_isready -h localhost -p 5432 && break
      sleep 1
    done
```

---

### Issue: `test-performance` Fails with Out of Memory

**Cause**: Benchmark tests may allocate large data structures that exceed the default
Node.js heap.

**Fix**: Increase heap size in the workflow step:
```yaml
- name: Run performance tests
  run: NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --config vitest.config.performance.ts
```

---

### Issue: Flaky E2E Tests

**Cause**: End-to-end tests depend on timing, network latency, or external service state.

**Mitigation strategies**:
1. Use `waitFor()` / `waitForSelector()` instead of fixed `sleep()` calls.
2. Increase individual test timeouts for known-slow operations.
3. Run flaky tests in isolation to identify interference.
4. If a test is consistently flaky, move it to a `@skip` or `@retry` annotation
   and file a ticket.

---

### Issue: Dependency Audit Reports New Vulnerabilities

**Cause**: A transitive dependency has a published CVE.

**Fix**:
1. Run `npm audit` locally to see full report.
2. If a fix is available: `npm audit fix` (or `--force` for major bumps).
3. If no fix is available: evaluate severity, document risk acceptance in the PR,
   and add an entry to [TECHNICAL_DEBT.md](./TECHNICAL_DEBT.md).

---

## 10. Repository Change Verification Checklist

M3 revealed that code pushed from container environments may not reach GitHub
reliably. Every milestone PR must record the following evidence **before merge**
to prevent future uncertainty about whether code actually reached the remote.

### Pre-Merge Verification Template

Copy this template into the PR description for every milestone delivery:

```markdown
### Repository Change Verification

#### Before Merge
| Field | Value |
|---|---|
| **Current branch** | `<branch-name>` |
| **Local HEAD SHA** | `<git rev-parse HEAD>` |
| **Remote HEAD SHA** | `<git ls-remote origin <branch> | cut -f1>` |
| **PR number** | `#<number>` |
| **CI run URL** | `<link to GitHub Actions run>` |
| **Passing jobs** | `<list all passing job names>` |
| **Failing jobs** | `<"None" or list with documented reason>` |

#### After Merge
| Field | Value |
|---|---|
| **Merge commit SHA** | `<git log -1 --format=%H on target branch>` |
| **Merge timestamp** | `<ISO 8601>` |
| **Target branch SHA** | `<git rev-parse HEAD on target>` |
| **GitHub verification** | `gh api repos/{owner}/{repo}/commits/<sha> — status 200` |
```

### Verification Steps (Pre-Merge)

1. **Confirm branch alignment**:
   ```bash
   git branch --show-current
   git rev-parse HEAD
   git ls-remote origin $(git branch --show-current) | cut -f1
   # Both SHAs must match
   ```

2. **Verify CI completion**:
   ```bash
   gh run list --branch <branch> --limit 1
   # Confirm status is "completed" and conclusion is "success"
   ```

3. **Download and archive CI logs** for milestone deliveries:
   ```bash
   gh run view <run-id> --log > ci-logs-<milestone>.txt
   ```

4. **Confirm all files are pushed** (no local-only commits):
   ```bash
   git log origin/<branch>..HEAD --oneline
   # Must return empty — no unpushed commits
   ```

### Verification Steps (Post-Merge)

1. **Fetch and verify merge landed**:
   ```bash
   git fetch origin
   git log origin/<target-branch> --oneline -5
   # Merge commit must appear
   ```

2. **Confirm via GitHub API**:
   ```bash
   gh api repos/{owner}/{repo}/commits/<merge-sha>
   # Must return HTTP 200 with commit details
   ```

3. **Trigger post-merge CI** and confirm it passes:
   ```bash
   gh run list --branch <target-branch> --limit 1
   ```

### When Verification Fails

| Symptom | Likely Cause | Fix |
|---|---|---|
| Local SHA ≠ Remote SHA | Push failed silently | Re-push with `git push --no-verify origin <branch>` |
| CI run not found | Push didn't trigger CI | Check branch protection rules; push again |
| Merge commit missing from target | Merge didn't complete | Re-merge via GitHub UI; check branch permissions |
| GitHub API returns 404 | Commit not on remote | Force-refresh: `git fetch --all` and re-verify |

---

## Appendix: Quick Reference

```bash
# Run full CI suite locally (approximation)
npm run lint && npm run typecheck && npx vitest run --pool forks --poolOptions.forks.maxForks 2

# Run a specific test job locally
npx vitest run --config vitest.config.<suite>.ts --pool forks --poolOptions.forks.maxForks 2

# Push when hooks are broken
git push --no-verify origin <branch>

# Download CI logs
gh run view <run-id> --log

# Check CI status of latest run on a branch
gh run list --branch <branch> --limit 1

# Cancel a stuck CI run
gh run cancel <run-id>

# Re-run a failed CI job
gh run rerun <run-id>
```

---

*Last updated: M4 — CI Reliability Improvements*
*See also: [TESTING_STRATEGY.md](./TESTING_STRATEGY.md), [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md),
[TECHNICAL_DEBT.md](./TECHNICAL_DEBT.md), [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)*
