# Orphaned Prisma Models Audit

**Date**: Phase 9.4  
**Scope**: 10 models with zero references in application code  
**Schema file**: `prisma/schema.prisma`

---

## Summary

| # | Model | Recommendation | Action |
|---|-------|---------------|--------|
| 1 | `SecurityFinding` | **KEEP** | Wire up via `api/admin/security-findings` |
| 2 | `RetrievalIndexEntry` | **KEEP** | Wire up via `api/knowledge/index` |
| 3 | `RetrievalCorpusStats` | **KEEP** | Include in `api/knowledge/index` |
| 4 | `ABTest` | REMOVE (future) | Replaced by `AIExperiment` model |
| 5 | `AICallLog` | REMOVE (future) | Replaced by `AIUsageLog` model |
| 6 | `KnowledgeVersion` | REMOVE (future) | Versioning handled in app layer |
| 7 | `PersistenceHealthSnapshot` | REMOVE (future) | Phase 1 persistence is production code |
| 8 | `PersistenceOperationLog` | REMOVE (future) | Phase 1 persistence is production code |
| 9 | `ReasoningStrategy` | REMOVE (future) | Reasoning handled by AI governance layer |
| 10 | `ShadowModeReconciliation` | REMOVE (future) | Shadow mode resolved; no longer needed |

---

## Models to KEEP

### 1. `SecurityFinding` (line 3709)

**What it was designed for:**
Tracks security audit findings with OWASP categorization, CVSS scoring, severity levels, and remediation tracking. Supports full lifecycle: discovery → in_progress → remediated/accepted_risk/false_positive.

**Why it's orphaned:**
The model was defined in the schema as part of the security compliance infrastructure (SOC2, penetration test tracking) but no API route was ever created to read or write findings. Security audit logs exist via the `access-audit` system, but this structured findings table has no application interface.

**Recommendation: KEEP** — Enterprise security programs require structured vulnerability/finding tracking. The model has well-designed fields (severity, OWASP category, CVSS score, remediation deadlines). Wiring it up provides a foundation for security dashboards and compliance reporting.

**Action taken:** Created `src/app/api/admin/security-findings/route.ts` with:
- `GET` — List findings with optional filters (severity, status, category)
- `POST` — Create a new security finding (admin only)

---

### 2. `RetrievalIndexEntry` (line 3392)

**What it was designed for:**
Stores full-text index entries for the hybrid retrieval system. Each entry contains the indexed content, a display snippet, BM25 term frequencies (JSON), extracted entities, and provenance metadata. Supports multi-tenancy via `companyId`/`isGlobal`. Vector embeddings are managed via raw SQL (pgvector), not Prisma ORM.

**Why it's orphaned:**
The knowledge search system (`src/app/api/knowledge/search/route.ts`) uses `$queryRaw` with raw SQL for retrieval queries instead of Prisma's `retrievalIndexEntry` accessor. This was a deliberate design choice to leverage PostgreSQL's full-text search and pgvector extensions directly, which Prisma doesn't natively support.

**Recommendation: KEEP** — While search uses raw SQL for performance, having an API route to inspect index entries is valuable for:
- Debugging retrieval quality issues
- Admin visibility into what's indexed
- Rebuilding or invalidating specific index entries

**Action taken:** Created `src/app/api/knowledge/index/route.ts` with:
- `GET` — Query index entries with filters (entityType, companyId, sourceTier)

---

### 3. `RetrievalCorpusStats` (line 3432)

**What it was designed for:**
A singleton row that stores IDF (Inverse Document Frequency) statistics for the retrieval corpus. Holds the document frequency map and total document count, used by the BM25 ranking algorithm to compute relevance scores.

**Why it's orphaned:**
Like `RetrievalIndexEntry`, the BM25 scoring is performed via raw SQL queries. The corpus stats are read and updated directly in SQL rather than through the Prisma model accessor.

**Recommendation: KEEP** — Corpus statistics are critical for retrieval quality. Exposing them via API provides:
- Visibility into corpus size and growth
- Debugging BM25 scoring issues
- Admin health checks on the retrieval system

**Action taken:** Extended `src/app/api/knowledge/index/route.ts` to include:
- `GET /api/knowledge/index?include=corpusStats` — Returns corpus statistics alongside index entries

---

## Models to REMOVE (Future Cleanup)

### 4. `ABTest` (line 981)

**What it was designed for:**
A/B testing framework for email campaigns. Tracks test name, status (running/completed/cancelled), winner variant, and total sends. Has a relation to `Draft[]` for the test variants.

**Why it's orphaned:**
The `AIExperiment` model (line ~3088 in Phase 9 section) replaced this with a more comprehensive experiment tracking system that supports prompt variants, confidence thresholds, multi-metric evaluation, and statistical significance testing. The `ABTest` model only tracks send-level A/B tests and lacks the sophistication needed for AI-driven experiments.

**Recommendation: REMOVE** — After verifying no data exists in production, create a migration to drop this table. The `Draft` model's relation to `ABTest` will need to be relaxed first.

**Migration steps when ready:**
1. Check `Draft` model for `abTestId` field — make nullable if not already
2. Verify zero rows: `SELECT COUNT(*) FROM "ABTest"`
3. Create migration: remove `ABTest` table and `Draft.abTestId` FK

---

### 5. `AICallLog` (line 3043)

**What it was designed for:**
Detailed per-call logging for AI provider invocations. Records provider, model, tier, generation type, token usage, cost, latency, cache hits, and attribution (company/contact/pipeline run).

**Why it's orphaned:**
The `AIUsageLog` model provides the same functionality with additional enterprise features:
- Structured input/output tracking
- Governance metadata (experiment ID, strategy ID)
- Cost tracking with budget awareness
- The `ModelRouter` and `ai-governance` layer handle logging directly

The `AICallLog` model has FK relations to `Company`, `Contact`, and `PipelineRun`, suggesting it was the original Phase 1 logging table before the governance layer was built.

**Recommendation: REMOVE** — The `AIUsageLog` model and governance layer have fully superseded this. Verify no data needs to be migrated before dropping.

**Migration steps when ready:**
1. Migrate any historical data from `AICallLog` to `AIUsageLog` if needed
2. Remove FK relations from `Company`, `Contact`, `PipelineRun` models
3. Drop `AICallLog` table

---

### 6. `KnowledgeVersion` (line 2117)

**What it was designed for:**
Content versioning for knowledge entries. Stores snapshots of knowledge content at each version with monotonically increasing version numbers, changed fields (JSON diff), and change reason/attribution.

**Why it's orphaned:**
Versioning is handled at the application layer rather than the database layer. The `KnowledgeEntry` model tracks `updatedAt` and the intelligence sources system handles versioning through its own change tracking. The `KnowledgeVersion` model was never wired into the knowledge CRUD operations.

**Recommendation: REMOVE** — Application-layer versioning is sufficient for current needs. If database-level versioning becomes required (e.g., for audit compliance), it should be re-implemented with a proper event-sourcing pattern.

**Migration steps when ready:**
1. Verify zero rows: `SELECT COUNT(*) FROM "KnowledgeVersion"`
2. Remove FK relation from `KnowledgeEntry`
3. Drop `KnowledgeVersion` table

---

### 7. `PersistenceHealthSnapshot` (line 3474)

**What it was designed for:**
Periodic health snapshots for the intelligence persistence layer. Records whether each store is healthy, last write latency, consecutive failures, failure queue depth, and total write/failure counts. Triggered on state changes, scheduled intervals, or alerts.

**Why it's orphaned:**
This model was created for Phase 1's dual-write persistence system (in-memory Map + DB). That system is now production code and uses the `database-enterprise-monitor.ts` for health monitoring instead. The persistence adapter directly exposes health status without needing to write snapshots to the database.

**Recommendation: REMOVE** — Health monitoring is now handled by the enterprise database monitor which doesn't need to persist snapshots. The real-time health API is sufficient.

**Migration steps when ready:**
1. Verify zero rows or that data is no longer needed
2. Drop `PersistenceHealthSnapshot` table

---

### 8. `PersistenceOperationLog` (line 3449)

**What it was designed for:**
Audit trail and dead-letter queue for persistence operations. Tracks each upsert/delete/batch operation with status (pending/completed/failed/dead_letter), latency, error messages, retry counts with exponential backoff scheduling.

**Why it's orphaned:**
Same as `PersistenceHealthSnapshot` — this was for the Phase 1 dual-write system. The production persistence layer now uses the enterprise database monitor and the structured logging system for operation tracking. Failed operations are handled by the circuit breaker and retry logic in the persistence adapter.

**Recommendation: REMOVE** — The application-level retry/circuit-breaker pattern and structured logging have replaced the need for a database-backed operation log.

**Migration steps when ready:**
1. Verify zero rows or that historical data is no longer needed
2. Drop `PersistenceOperationLog` table

---

### 9. `ReasoningStrategy` (line 3886)

**What it was designed for:**
Per-company-size-segment reasoning configuration. Defines which of the 30 reasoning steps to run, at what depth (skip/quick/standard/deep), LLM tier, max tokens, and priority signal types. Supports four segments: enterprise, mid_market, smb, startup.

**Why it's orphaned:**
The AI governance layer (`src/lib/ai-governance.ts`) and `ModelRouter` now handle reasoning strategy selection dynamically based on the query type, confidence requirements, and cost constraints. The static per-segment configuration approach was superseded by the adaptive intelligence architecture.

**Recommendation: REMOVE** — The `reasoning-strategy-router.ts` file exists but uses an in-memory configuration, not this database model. The AI governance layer's adaptive approach is more flexible.

**Migration steps when ready:**
1. Verify `reasoning-strategy-router.ts` doesn't reference the DB model
2. Drop `ReasoningStrategy` table

---

### 10. `ShadowModeReconciliation` (line 3494)

**What it was designed for:**
Comparison logs for shadow mode reconciliation between in-memory Map state and database state. Records entry counts, missing entries (from both sides), mismatched entries with hash comparisons, and duration.

**Why it's orphaned:**
Shadow mode was a Phase 1 technique for validating the dual-write persistence system by comparing in-memory and database states. Now that the persistence system is production code and has been validated, shadow mode reconciliation is no longer needed.

**Recommendation: REMOVE** — Shadow mode has been resolved. No ongoing need for reconciliation logging.

**Migration steps when ready:**
1. Verify zero rows or archive if historically valuable
2. Drop `ShadowModeReconciliation` table

---

## Removal Priority

For the 7 models recommended for removal, prioritize in this order:

1. **`ShadowModeReconciliation`** — Zero ongoing value, smallest model
2. **`PersistenceHealthSnapshot`** — Replaced by enterprise monitor
3. **`PersistenceOperationLog`** — Replaced by structured logging
4. **`ReasoningStrategy`** — Never used, replaced by governance
5. **`KnowledgeVersion`** — Never used, versioning in app layer
6. **`ABTest`** — Has FK relation to `Draft`, needs careful migration
7. **`AICallLog`** — Has FK relations to 3 models, most complex removal

Each removal should be a separate migration with its own PR for easy rollback.
