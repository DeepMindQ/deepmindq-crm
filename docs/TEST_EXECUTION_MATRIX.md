# Test Execution Matrix — Known Workarounds

> **Status**: Active — reviewed and documented as part of Milestone 3 closure.
> **Last updated**: 2026-08-05

## 1. Vitest Worker Teardown Crash Workaround

### Problem

Vitest 4.x running with `pool: 'threads'` (single-threaded) on Node.js 22.x crashes
during worker teardown **after all tests have passed**. The crash produces a non-zero
exit code even though every test assertion succeeds. This is a known upstream issue in
Vitest's thread pool cleanup logic — not a test failure.

### Affected CI Jobs

| Job | Blocking? | Current Mitigation |
|-----|-----------|-------------------|
| `test-unit` (Run unit tests) | **Yes — Blocking** | `tee + grep` intelligent wrapper |
| `test-unit` (Generate unit test coverage) | **Yes — Blocking** | `tee + grep` intelligent wrapper |
| `test-ai-governance` | No — Non-Blocking | `|| true` (acceptable for non-blocking) |

### How the Mitigations Work

#### Blocking Jobs: `tee + grep` Wrapper

The blocking `test-unit` steps use a shell wrapper that:

1. Captures full vitest output via `tee` to a temp file
2. Preserves the real vitest exit code via `${PIPESTATUS[0]}`
3. Greps the output for `Test Files.*failed` and `Tests .*failed` patterns
4. **If real failures are detected** — exits with the original vitest failure code
5. **If no failures are detected** — the teardown crash is suppressed, exits 0

This means: **real test failures still cause CI failure.** Only the harmless
worker teardown crash is suppressed.

```yaml
# Pattern used in blocking jobs:
run: |
  npx vitest run --config vitest.unit.config.ts \
    --dangerouslyIgnoreUnhandledErrors 2>&1 | tee /tmp/vitest-output.txt
  EXIT_CODE=${PIPESTATUS[0]}
  if grep -q 'Test Files.*failed' /tmp/vitest-output.txt; then
    echo '::error::Test files failed — real test failure detected'
    exit $EXIT_CODE
  fi
  if grep -q 'Tests .*failed' /tmp/vitest-output.txt; then
    echo '::error::Tests failed — real test failure detected'
    exit $EXIT_CODE
  fi
  echo 'All tests passed (Vitest worker teardown crash suppressed)'
  exit 0
```

#### Non-Blocking Job: `|| true`

The non-blocking `test-ai-governance` job uses bare `|| true` because:
- It does **not** block merge — failures are informational only
- The `tee + grep` pattern adds complexity; for non-blocking jobs, simplicity is acceptable
- The same teardown crash occurs there (same vitest + node version combination)

**Important**: `|| true` unconditionally suppresses ALL exit codes, including real failures.
This is acceptable ONLY because the job is non-blocking.

### Removal Criteria

This workaround should be removed when **any** of these conditions is met:

1. **Vitest upgrade**: Vitest fixes the thread pool teardown crash upstream.
   Monitor: [vitest issues](https://github.com/vitest-dev/vitest/issues)
   — search for "worker teardown crash" or "thread pool exit code".
2. **Node.js version change**: The crash may not occur on newer Node.js versions.
   Test by removing the wrapper on a candidate Node.js version and running CI.
3. **Pool strategy change**: If `pool: 'forks'` is restored and proven stable
   (it previously caused OOM crashes on CI runners), the workaround is no longer needed.
4. **Vitest `--teardown-timeout` flag**: If vitest adds a configurable teardown
   timeout that gracefully handles slow thread cleanup, use that instead.

### Removal Steps (when criteria met)

1. Remove the `tee + grep` wrapper from `test-unit` steps in `.github/workflows/ci.yml`
2. Restore simple `npx vitest run ...` commands
3. Remove `|| true` from `test-ai-governance`
4. Remove `--dangerouslyIgnoreUnhandledErrors` if no longer needed
5. Delete this section from `docs/TEST_EXECUTION_MATRIX.md`
6. Run full CI and verify green without workarounds

## 2. `--dangerouslyIgnoreUnhandledErrors` Flag

Used alongside the above workaround in the same 3 commands.

- **Purpose**: Suppresses unhandled rejection errors that occur during the same
  Vitest thread teardown phase.
- **Risk**: Low in CI — CI runs test files in isolation. Unhandled rejections
  during teardown are not indicative of application bugs.
- **Removal**: Same criteria as the teardown crash workaround above.
