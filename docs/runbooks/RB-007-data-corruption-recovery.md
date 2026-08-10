# RB-007: Data Corruption Recovery

**Severity**: SEV1
**Owner**: Platform Engineering
**Last Updated**: 2026-08-10
**Status**: Tested in Staging

## Overview

Data corruption in DeepMindQ manifests as integrity check failures, orphaned
records, inconsistent aggregations, or missing data that was previously present.
With Neon Postgres, the primary recovery mechanism is point-in-time recovery
(PITR). This runbook covers assessment, recovery, and verification procedures.

## Detection

### Alert Indicators

| Source | Signal | Description |
|--------|--------|-------------|
| database-enterprise-monitor.ts | Table `status: "empty"` for non-empty table | Unexpected empty table |
| database-enterprise-monitor.ts | Table `status: "stale"` for > 72 hours | No writes to active table |
| Application | Inconsistent AI scores/recommendations | Data quality issues |
| User reports | "My data is missing/wrong" | Qualitative signal |
| Data exports | Row count mismatch vs expected | Missing records |
| Aggregations | Dashboard totals don't match DB counts | Calculation errors |

### Automated Detection Queries

```bash
# Check for orphaned records (references to non-existent parents)
psql $DATABASE_URL -c "
  SELECT 'orphaned_contacts' as check_type, count(*) as count
  FROM \"Contact\" c
  LEFT JOIN \"Company\" comp ON c.\"companyId\" = comp.id
  WHERE comp.id IS NULL
  UNION ALL
  SELECT 'orphaned_leads', count(*)
  FROM \"Lead\" l
  LEFT JOIN \"Company\" comp ON l.\"companyId\" = comp.id
  WHERE comp.id IS NULL
  UNION ALL
  SELECT 'orphaned_signals', count(*)
  FROM \"Signal\" s
  LEFT JOIN \"Company\" comp ON s.\"companyId\" = comp.id
  WHERE comp.id IS NULL;
"

# Check for duplicate records
psql $DATABASE_URL -c "
  SELECT 'duplicate_contacts' as check_type, count(*) as count
  FROM (SELECT \"companyId\", email, count(*) as c FROM \"Contact\" GROUP BY \"companyId\", email HAVING c > 1) d;
"

# Check table row counts vs expectations
psql $DATABASE_URL -c "
  SELECT tablename,
         n_live_tup as estimated_rows
  FROM pg_stat_user_tables
  ORDER BY n_live_tup DESC;
"
```

## Immediate Response (First 5 Minutes)

1. **Create a SEV1 incident**:
   ```bash
   curl -X POST https://deepmindq.io/api/incidents \
     -H 'Content-Type: application/json' \
     -d '{
       "action": "create",
       "title": "Data Corruption Detected",
       "severity": "SEV1",
       "description": "Data integrity check failures detected",
       "author": "on-call-engineer"
     }'
   ```

2. **Stop any running data operations**:
   ```bash
   # Cancel any running batch imports/exports
   psql $DATABASE_URL -c "
     SELECT pg_cancel_backend(pid)
     FROM pg_stat_activity
     WHERE query LIKE '%INSERT%\"ImportRecord\"%'
        OR query LIKE '%UPDATE%\"Company\"%'
        OR query LIKE '%Batch%';
   "
   ```

3. **Assess the scope**:
   ```bash
   # Quick scope check — which tables are affected?
   curl -s https://deepmindq.io/api/health/database | jq '.tables[] | select(.status != "active")'

   # Get total row counts for all monitored tables
   curl -s https://deepmindq.io/api/health/database | jq '.sizeEstimate'
   ```

4. **Determine if recovery is needed** using persisted metric snapshots.

## Diagnosis

### Step 1: Determine When Corruption Occurred

Use the `persistMetricSnapshot()` data in `SystemSetting` to find the
last known good state:

```bash
# Load today's metric snapshots (288 entries, one per 5 minutes)
psql $DATABASE_URL -c "
  SELECT key, \"updatedAt\", length(value) as snapshot_size
  FROM \"SystemSetting\"
  WHERE key LIKE 'metrics_snapshot_%'
  ORDER BY key DESC, \"updatedAt\" DESC
  LIMIT 10;
"

# The snapshots contain timestamped aggregates that can be compared
# to identify when data counts changed unexpectedly
```

The `loadMetricSnapshots(date)` function in `monitoring.ts` retrieves these.
Compare the `totalRows` in the health report against historical snapshots.

### Step 2: Assess Corruption Type

| Type | Description | Recovery Approach |
|------|-------------|-------------------|
| Deleted records | Data was removed | PITR or re-import |
| Corrupted fields | Values are wrong/invalid | Targeted UPDATE or PITR |
| Orphaned records | FK references broken | Targeted DELETE or repair |
| Duplicates | Duplicate records created | Deduplication script |
| Schema mismatch | Code expects different schema | Migration fix |
| Aggregation mismatch | Calculated values wrong | Recalculation job |

### Step 3: Determine Recovery Strategy

- **If corruption is recent (< 24 hours) and scope is clear**: Use Neon PITR.
- **If corruption is old or scope is unclear**: Use targeted data repair.
- **If only calculated/derived data is affected**: Recalculate from source data.

## Resolution

### Option A: Neon Point-in-Time Recovery (PITR)

**Use when**: Significant data was deleted or corrupted and you need to
restore to a specific point in time.

1. **Identify the recovery timestamp**:
   - Use the metric snapshots to find the last known good state
   - Choose a timestamp 5-10 minutes before the corruption event
   - Format: ISO 8601 (e.g., `2026-08-10T14:30:00Z`)

2. **Create a restore in the Neon Console**:
   - Navigate to `https://console.neon.tech`
   - Select the project
   - Go to **Branches** → **Create restore point**
   - Select the timestamp for recovery
   - Create a new branch from the restore point

3. **Verify the restored data**:
   ```bash
   # Point DATABASE_URL at the restored branch temporarily
   # Run integrity checks against the restored data
   psql $RESTORED_DATABASE_URL -c "
     SELECT 'companies' as tbl, count(*) FROM \"Company\"
     UNION ALL SELECT 'contacts', count(*) FROM \"Contact\"
     UNION ALL SELECT 'signals', count(*) FROM \"Signal\"
     UNION ALL SELECT 'leads', count(*) FROM \"Lead\";
   "
   ```

4. **Switch the application** to the restored branch:
   ```bash
   # Update DATABASE_URL to point to the restored branch
   vercel env rm DATABASE_URL production
   vercel env add DATABASE_URL production
   # Enter the restored branch connection string
   vercel --prod
   ```

5. **Promote the restored branch** (once verified) to become the primary
   branch in Neon.

### Option B: Targeted Data Repair

**Use when**: Only specific records are corrupted and the scope is small.

1. **Export the corrupted records** (for audit trail):
   ```sql
   CREATE TEMP TABLE corrupted_records AS
   SELECT * FROM "Company" WHERE <corruption_condition>;
   ```

2. **Repair the data**:
   ```sql
   -- Example: Fix NULL fields that should have values
   UPDATE "Company" SET "name" = 'Unknown' WHERE "name" IS NULL;

   -- Example: Remove orphaned records
   DELETE FROM "Contact" WHERE "companyId" NOT IN (SELECT id FROM "Company");

   -- Example: Deduplicate records
   DELETE FROM "Contact"
   WHERE ctid NOT IN (
     SELECT min(ctid) FROM "Contact" GROUP BY "companyId", email
   );
   ```

3. **Run integrity checks** to verify the repair.

### Option C: Recalculate Derived Data

**Use when**: Source data (Company, Contact) is intact but derived data
(Signals, AI scores, recommendations) is corrupted.

1. **Trigger a full recalculation**:
   ```bash
   curl -X POST https://deepmindq.io/api/admin/intelligence/reprocess-all \
     -H 'Authorization: Bearer <admin-token>'
   ```

2. **Clear the AI cache** to force fresh computation:
   ```sql
   TRUNCATE TABLE "AICache";
   ```

3. **Monitor the reprocessing** for completion and errors.

## Verification

1. **All integrity checks pass**:
   ```bash
   # Run the orphan check — should return 0 for all types
   psql $DATABASE_URL -c "
     SELECT 'orphaned_contacts' as check_type, count(*) as count
     FROM \"Contact\" c LEFT JOIN \"Company\" comp ON c.\"companyId\" = comp.id
     WHERE comp.id IS NULL;
   "
   ```

2. **Table health is normal**:
   ```bash
   curl -s https://deepmindq.io/api/health/database | jq '.tables[] | {name, rowCount, status}'
   # All should show status: "active"
   ```

3. **Row counts match expected** (compare to pre-corruption snapshots):
   ```bash
   curl -s https://deepmindq.io/api/health/database | jq '.sizeEstimate'
   ```

4. **Dashboard aggregations are correct**: Spot-check 5-10 companies
   for expected data.

5. **AI intelligence data is fresh**: Verify `lastIntelligenceRefreshAt`
   for recently active companies.

6. **Export a sample** and verify against source data.

## Escalation

| Condition | Action | Timeline |
|-----------|--------|----------|
| PITR needed | Page DBA on-call | 10 min |
| Data loss > 1000 records | Notify Engineering Lead + Legal | 30 min |
| PII affected | Notify legal/compliance | 1 hour |
| Recovery fails | Escalate to VP Engineering | 1 hour |
| Cause is unknown | Engage security team | 2 hours |

## Prevention

### Short-Term

- **Database backups**: Verify Neon automated backups are enabled and
  running (check retention period — recommend 7 days minimum).

- **Add data integrity monitoring**: Schedule a daily integrity check
  job that runs the orphan/duplicate queries and alerts on anomalies.

### Medium-Term

- **Soft deletes**: Ensure all tables use soft deletes (`deletedAt`) to
  prevent accidental permanent data loss.

- **Data validation layer**: Add Prisma middleware that validates data
  integrity on writes (FK existence, field format, business rules).

### Long-Term

- **Change Data Capture (CDC)**: Implement CDC to track all data changes
  with full before/after values for audit and recovery.

- **Automated data repair**: Build self-healing data pipelines that
  detect and repair common corruption patterns automatically.

## Related

- **Metrics Persistence**: `src/lib/monitoring.ts` — `persistMetricSnapshot()`,
  `loadMetricSnapshots()`, `SystemSetting` key prefix `metrics_snapshot_`
- **Database Health Monitor**: `src/lib/database-enterprise-monitor.ts` —
  `getDatabaseHealthReport()`, table health, `sizeEstimate`,
  17 monitored tables
- **API Health Metrics**: `src/app/api/health/metrics/route.ts` —
  Prometheus endpoint for monitoring data volume changes
- **Incident Manager**: `src/lib/incident-manager.ts` — SEV1 SLA: 15 min response
- **Incident Response**: `docs/incident-response.md` — Section 3.6 Data Integrity Issue
- **Database Design**: `docs/DATABASE_DESIGN.md` — Full schema documentation
- **Prisma Schema**: `prisma/schema.prisma` — Source of truth for schema