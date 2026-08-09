# Prisma Schema Change Validation Report

**Date**: $(date -u +%Y-%m-%d)
**Schema**: `prisma/schema.prisma`
**Migrations**: 2 (`20260701000000_init_baseline`, `20260807000000_add_company_parent_subsidiary`)
**Models**: ~110 | **Relations (FK-side)**: 97 | **DB FK constraints**: 94

---

## 1. What Changed Technically

### 1.1 `relationMode`: `prisma_client_join_on` → `foreignKeys`

| Aspect | Before (`prisma_client_join_on`) | After (`foreignKeys`) |
|---|---|---|
| FK constraint validation | Prisma Client skips DB-level FK validation | Prisma Client **validates** FK constraints exist |
| Query generation | Explicit `JOIN ... ON` for relation queries | Standard Prisma query planning (potentially sub-queries) |
| Cascade deletes | Application-level (Prisma sends separate DELETEs) | Database-level (PG FK `ON DELETE CASCADE` enforces) |
| Orphan prevention | Only if app code handles it | Enforced by DB FK `ON DELETE RESTRICT` |
| `onDelete` not specified | No enforcement (Prisma ignores) | Defaults to `Restrict` — **blocks parent delete** |

### 1.2 `previewFeatures`: datasource → generator

```diff
- datasource db { previewFeatures = ["relationJoins"] }
+ generator client { previewFeatures = ["relationJoins"] }
```

This is a **correct, non-breaking relocation**. Prisma 5.x+ expects preview features in the `generator` block. The `relationJoins` feature enables SQL JOIN-based relation resolution instead of the default row-level fetch strategy.

---

## 2. Impact on Relations

### 2.1 Cascade Deletes (80 CASCADE FKs in DB)

**Risk: LOW** — The database already has `ON DELETE CASCADE` constraints from the init migration. Switching to `foreignKeys` mode simply tells Prisma to **rely on** these existing constraints rather than emulating cascades in application code. The behavioral outcome is identical.

### 2.2 SetNull on Delete (7 SET NULL FKs in DB)

Affected relations (all have nullable FK columns — correct):

| Table | FK Column | Target | Schema `onDelete` |
|---|---|---|---|
| IntelligenceAlert | companyId | Company | ✅ `SetNull` |
| AgentOrchestration | reasoningContextId | ReasoningContext | ✅ `SetNull` |
| KnowledgeDocument | capabilityAssetId | CapabilityAsset | ✅ `SetNull` |
| EmailSequence | opportunityId | OpportunityRecommendation | ⚠️ **Not specified** |
| Draft | abTestId | ABTest | ⚠️ **Not specified** |
| AdvisorConversation | companyId | Company | ✅ `SetNull` |
| AdvisorSavedBriefing | companyId | Company | ✅ `SetNull` |

### 2.3 ⚠️ Schema/Migration Mismatch: Implicit Restrict

Two relations have `ON DELETE SET NULL` in the **database** but **no `onDelete`** in the current schema:

- `EmailSequence.opportunity → OpportunityRecommendation` — DB has `SET NULL`, schema defaults to `Restrict`
- `Draft.abTest → ABTest` — DB has `SET NULL`, schema defaults to `Restrict`

In `prisma_client_join_on` mode, this mismatch was invisible (Prisma didn't validate FK constraints). In `foreignKeys` mode, Prisma **will detect this mismatch** and may:
1. Fail `prisma validate` if it introspects the DB
2. Generate a migration that ALTERs the FK to `RESTRICT`
3. Cause runtime errors if the DB behavior doesn't match Prisma's expectations

**Recommendation**: Add `onDelete: SetNull` to both relations in the schema, or run `prisma migrate diff` against the live DB to see the exact drift.

### 2.4 Relations Without Explicit `onDelete` (9 relations)

These default to `Restrict` in `foreignKeys` mode:

| Table | FK Column | Target |
|---|---|---|
| Contact | batchId | ImportBatch |
| OpportunityRecommendation | signalId | CompanySignal |
| OpportunityRecommendation | capabilityMatchId | SignalCapabilityMatch |
| MergeRecord | survivorId | Company |
| MergeRecord | duplicateId | Company |
| CRMSyncLog | connectionId | CRMConnection |
| EmailSequence | opportunityId | OpportunityRecommendation |
| Draft | abTestId | ABTest |
| AdvisorSavedBriefing | companyId *(via second migration)* | Company |

**Impact**: In `prisma_client_join_on` mode, deleting a `CompanySignal` would silently leave `OpportunityRecommendation` rows with orphaned `signalId` values. In `foreignKeys` mode, the DB FK constraint will **block the delete** and throw a `P2003` error. Review any bulk-delete or cleanup jobs that delete parent records.

### 2.5 Knowledge Graph & AI Tables — NOT Affected

The following high-volume models deliberately use **plain `String` fields** (not Prisma relations) for cross-references:

- `KnowledgeGraphNode.companyId` — plain field, no `@relation`
- `KnowledgeGraphEdge.sourceId` / `targetId` — plain fields, no `@relation`
- `Embedding.entityId` — plain field, `@unique` but no `@relation`
- `RetrievalIndexEntry.companyId` — plain field, no `@relation`
- `Company.parentId` — plain field, no `@relation` (self-ref for subsidiary tree)
- `AIMemoryEntry` — no relation fields

**These are immune to the `relationMode` change.** This is a good architecture decision for graph/AI workloads where FK constraint overhead would be prohibitive.

---

## 3. Unmigrated Models (9 models in schema, no CREATE TABLE in migrations)

These models exist in the Prisma schema but have no corresponding migration file:

| Model | Has `@relation`? | FK Needed? |
|---|---|---|
| CRMConnection | No | No |
| CRMSyncLog | Yes → CRMConnection | Yes: `connectionId` CASCADE |
| ComprehensiveAuditLog | No | No |
| DataExport | No | No |
| EnrichmentJob | No | No |
| ImportTemplate | No | No |
| MergeRecord | Yes → Company (×2) | Yes: `survivorId` + `duplicateId` (both Restrict) |
| PrivacyRequest | No | No |
| SecurityFinding | No | No |

**If these tables exist in the database** (created via `prisma db push`), they will **NOT have FK constraints** because `db push` in `prisma_client_join_on` mode does not create FK constraints. Switching to `foreignKeys` mode would cause Prisma to expect FKs that don't exist.

**If they don't exist in the database**, this is not an immediate problem but a migration is needed before using them.

**Recommendation**: Run a migration to create missing tables and FK constraints:
```bash
npx prisma migrate dev --name add_missing_models
```

---

## 4. Query Pattern Impact

### 4.1 `relationJoins` Preview Feature

With `relationJoins` in the generator, Prisma Client may generate different SQL for relation queries:

```prisma
// Before: potentially N+1 or separate queries
const company = await prisma.company.findUnique({
  where: { id },
  include: { signals: true, notes: true }
});

// After: may use SQL JOINs (more efficient)
```

**Risk: LOW** — JOINs are generally more efficient. However:
- Test any queries that rely on **relation ordering** or **relation filtering** edge cases
- Watch for query plan changes in slow query logs
- The `include` API behavior is unchanged; only the SQL generation differs

### 4.2 Raw SQL Queries

If any code uses `$queryRaw` or `$executeRaw` with manual JOINs, those are unaffected — raw SQL bypasses Prisma's relation handling entirely.

---

## 5. Is This Change Safe for Production?

### Verdict: **CONDITIONALLY SAFE** ✅⚠️

The change is architecturally correct and moves the schema to Prisma's recommended configuration. However, three items need resolution before deploying:

### Must Fix Before Deploy

1. **Schema/migration mismatch** (`EmailSequence.opportunity`, `Draft.abTest`): Add `onDelete: SetNull` to both, or generate a corrective migration.

2. **Unmigrated models with relations** (`CRMSyncLog`, `MergeRecord`): Generate and apply a migration. If these tables already exist in the DB, the migration must ADD the FK constraints (which requires existing data to be valid).

3. **Implicit Restrict behavior change**: Audit any code paths that delete `CompanySignal`, `SignalCapabilityMatch`, `ImportBatch`, or `Company` records — these now have DB-enforced restrict on child tables that may not have had enforcement before.

### Recommended Deploy Sequence

1. Fix the two `onDelete: SetNull` omissions in the schema
2. Generate migration for unmigrated models: `npx prisma migrate dev --name align_schema_to_foreignkeys`
3. Review the generated migration SQL carefully (especially any FK additions)
4. Test in staging with `relationMode = "foreignKeys"` and `previewFeatures = ["relationJoins"]`
5. Run integration tests covering: cascade deletes, parent deletions with children, SetNull scenarios
6. Deploy migration, then deploy the schema change

### No Migration Needed For

- The `relationMode` and `previewFeatures` changes themselves are **Prisma Client-only** — they don't change the database schema
- The 94 existing FK constraints remain unchanged
- The 7 `SET NULL` constraints remain unchanged

---

## 6. Summary

| Item | Status | Action |
|---|---|---|
| `relationMode` change | ✅ Correct direction | Deploy after fixes |
| `previewFeatures` relocation | ✅ Non-breaking | None |
| 94 existing FK constraints | ✅ Match DB state | None |
| 2 missing `onDelete: SetNull` | ⚠️ Mismatch | Fix schema |
| 9 unmigrated models (3 with FKs) | ⚠️ Missing tables/FKs | Generate migration |
| 9 implicit Restrict relations | ⚠️ Behavior change | Audit delete paths |
| Knowledge graph / AI tables | ✅ Not affected | None |
| `relationJoins` query generation | ⚠️ Minor risk | Test in staging |
| `Company.parentId` self-ref | ✅ Plain field | None |
