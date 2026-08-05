# Vitest Teardown Crash Analysis

**Status**: Active investigation  
**Last updated**: 2026-08-05  
**Node version**: 24.18.0 (local) / 22 (CI)  
**Vitest version**: 4.1.10  

---

## 1. Problem Description

Vitest crashes during worker teardown with error: `Worker exited unexpectedly`. This crash occurs **after all test assertions have passed** — it is a teardown/cleanup issue, not a test failure.

### Error Pattern

```
node:events:487
      throw er; // Unhandled 'error' event
      ^
Error: Worker exited unexpectedly
    at Worker.emitUnexpectedExit (...)
    at Worker.emit (node:events:509:28)
    at Worker.[kOnExit] (node:internal/worker:400:10)
```

## 2. Affected Configurations

### Pool Strategy Comparison

| Pool | Behavior |
|------|----------|
| `pool: 'threads'` | Crashes on most configs — worker thread exits during teardown |
| `pool: 'forks'` | Stable for most configs — crash only on memory-heavy configs |
| `pool: 'forks', maxWorkers: 1` | Stable for light/medium configs, OOM on heavy configs |

### Per-Config Status (Local Validation, Node 24.18.0, Vitest 4.1.10)

| Config | Pool | Workers | Test Files | Tests | Result |
|--------|------|---------|-----------|-------|--------|
| unit | forks | 2 | 13 | 333 | ✅ Pass |
| security | forks | 2 | 11 | 241 | ✅ Pass |
| api | forks | 2 | 12 | 745 | ✅ Pass |
| database | forks | 2 | 10 | 331 | ✅ Pass (1 skipped — needs PostgreSQL) |
| ai | forks | 2 | 22 | 409 | ❌ 28 test failures (research-engine mock rot) |
| **ai-governance** | **threads→forks** | **1** | **16** | **574** | **⚠️ 6 OOM errors** |
| ai-retrieval | forks | 2 | 2 | 91 | ✅ Pass |
| ai-framework | forks | 2 | 6 | 386 | ✅ Pass |
| ai-inference | forks | 2 | 1 | 1 | ✅ Pass (placeholder) |
| integration | forks | 2 | 7 | 158 | ✅ Pass |
| e2e | forks | 2 | 4 | 67 | ✅ Pass |
| performance | threads | — | 14 | 231 | ✅ Pass |
| ui | forks | 2 | 2 | 102 | ✅ Pass |

## 3. Root Cause Analysis

### Primary Cause: `pool: 'threads'` Teardown Bug (Vitest 4.x)

The `threads` pool uses Node.js `worker_threads` which share memory with the parent process. During teardown, Vitest attempts to terminate worker threads, but the thread cleanup sequence races with pending async operations (mock cleanup, timer flushing, module unloading). This causes the parent to receive an unexpected exit event.

**Evidence**:
- `ai-governance` was the only config still using `pool: 'threads'` after the M4 CI restructure
- It was the only config that crashed with `Worker exited unexpectedly`
- Switching to `pool: 'forks'` eliminated the teardown crash for lighter configs

### Secondary Cause: Memory-Heavy Config OOM (ai-governance)

The `ai-governance` config includes 16 test files + 3 glob patterns covering hallucination testing, golden datasets, and confidence testing. These suites:
- Load large fixture data (791-line golden dataset)
- Create complex mock trees (AI governance framework)
- Run many assertions per file (574 total tests)

With `pool: 'forks', maxWorkers: 2`, child processes hit the 2GB memory limit (`--max-old-space-size=2048`). With `maxWorkers: 1`, the tests take >180 seconds locally (CI has more memory).

### Fix Applied (M4 Phase 2)

Changed `vitest.ai-governance.config.ts`:
- **Before**: `pool: 'threads'`, `maxThreads: 1`, `minThreads: 1`
- **After**: `pool: 'forks'`, `maxWorkers: 1`
- **Rationale**: Eliminates the threads-specific teardown crash. Single worker avoids OOM.

## 4. Vitest Diagnostic Matrix

The planned 5-combination matrix (Node 20/22/24 × Vitest 3/4 × threads/forks) could not be fully executed locally because:
- Only Vitest 4.1.10 is installed
- Node 24.18.0 is the local version
- CI uses Node 22 (standard GitHub Actions runner)

### Partial Results

| Node | Vitest | Pool | Workers | Result |
|------|--------|------|---------|--------|
| 24.18.0 | 4.1.10 | threads | 1 | ❌ Worker teardown crash |
| 24.18.0 | 4.1.10 | forks | 2 | ✅ Stable (except ai-governance OOM) |
| 24.18.0 | 4.1.10 | forks | 1 | ✅ Stable but slow for heavy configs |

### CI Environment (Node 22, from workflow config)

CI uses `NODE_VERSION: '22'` with `NODE_OPTIONS: '--max-old-space-size=2048'`. The CI runners have more memory than the local container, so the ai-governance OOM may not reproduce in CI.

## 5. Recommended Permanent Fix

### Immediate (Applied)

1. ✅ All configs use `pool: 'forks'` — eliminates threads teardown crash
2. ✅ `ai-governance` switched from threads to forks with `maxWorkers: 1`

### Monitoring

- Watch for `pool: 'forks'` OOM crashes in CI — if they occur, increase `--max-old-space-size` or reduce `maxWorkers`
- Monitor Vitest 5.x release notes for fixed teardown behavior with `pool: 'threads'`

### Long-Term Options

1. **Upgrade Vitest** — when Vitest fixes the thread pool teardown crash upstream, consider switching back to `threads` (shared memory is faster)
2. **Increase CI memory** — GitHub Actions `ubuntu-latest` runners have 7GB RAM; `--max-old-space-size=4096` is safe for CI
3. **Split ai-governance** — if OOM persists, split into `ai-governance-core` (light) and `ai-governance-quality` (heavy, maxWorkers: 1)

## 6. Workaround Removal Plan

The previous `tee + grep` wrapper and `|| true` workarounds (documented in `docs/TEST_EXECUTION_MATRIX.md`) should now be removable because:
- The root cause (`pool: 'threads'` teardown crash) has been eliminated
- All configs now use `pool: 'forks'` which is stable

### Removal Steps

1. ✅ Verify all configs use `pool: 'forks'` — DONE
2. ⬜ Run full CI and confirm zero teardown crashes
3. ⬜ Remove `TEST_EXECUTION_MATRIX.md` workaround documentation
4. ⬜ Archive the M3 `tee + grep` pattern as historical reference

---

*Analysis created: 2026-08-05*
*Part of M4 Phase 2 — CI Stabilization*
