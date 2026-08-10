# RB-006: Deployment Rollback

**Severity**: SEV2
**Owner**: Platform Engineering
**Last Updated**: 2026-08-10
**Status**: Tested in Staging

## Overview

A failed or problematic deployment can introduce new errors, break existing
functionality, or cause database schema incompatibilities. This runbook covers
the procedure for rolling back a Vercel deployment and, if necessary, rolling
back Prisma database migrations. The goal is to restore service to the last
known good state within 10 minutes.

## Detection

### Alert Indicators

| Source | Signal | Timing |
|--------|--------|--------|
| Error spike | `deepmindq_http_errors_total` rate increase | Immediately after deploy |
| Sentry | New error types appearing | Within minutes of deploy |
| Health checks | `/api/system-health` returns `degraded` or `unhealthy` | On first request |
| User reports | "Something is broken" after deploy | Minutes to hours |
| Deployment logs | Build warnings or runtime errors in deploy log | During deploy |
| DB migration | `database-enterprise-monitor.ts` shows `needs_migration` | After deploy |

### Key Correlation Signal

**Always compare the error onset timestamp with the most recent deployment
timestamp.** If errors start within 5 minutes of a deploy, assume deployment-
caused until proven otherwise.

```bash
# Check recent deployments
vercel deployments --limit 5

# Check error count
vercel logs --output json | jq 'select(.level == "error")' | head -20
```

## Immediate Response (First 5 Minutes)

1. **Create an incident**:
   ```bash
   curl -X POST https://deepmindq.io/api/incidents \
     -H 'Content-Type: application/json' \
     -d '{
       "action": "create",
       "title": "Failed Deployment — Rolling Back",
       "severity": "SEV2",
       "description": "Post-deploy error spike detected, initiating rollback",
       "author": "on-call-engineer"
     }'
   ```

2. **Confirm the deployment is the cause**:
   ```bash
   # Get the current (potentially bad) deployment ID
   vercel ls --limit 1

   # Get the previous (known good) deployment ID
   vercel ls --limit 2
   ```

3. **Execute the rollback immediately** (do not wait for full diagnosis):
   ```bash
   # Option A: Vercel rollback to previous deployment
   vercel rollback <PREVIOUS_DEPLOYMENT_ID>

   # Option B: If using the deploy script (self-hosted)
   ./scripts/deploy.sh rollback
   ```

4. **Verify the rollback succeeded**:
   ```bash
   vercel ls --limit 1
   # Confirm the active deployment is the previous one
   ```

5. **Check if database migration rollback is needed** (see Resolution section).

## Diagnosis

### Step 1: Identify What Changed

```bash
# Compare the bad and good deployment commits
vercel inspect <BAD_DEPLOYMENT_ID> | jq '.gitCommit'
vercel inspect <GOOD_DEPLOYMENT_ID> | jq '.gitCommit'

# View the diff
git diff <GOOD_COMMIT>..<BAD_COMMIT> --stat
```

### Step 2: Check for Database Schema Changes

```bash
# Check migration status via the enterprise monitor
# getDatabaseHealthReport() includes migrationStatus
# which shows lastMigration, pendingMigrations, and status
curl -s https://deepmindq.io/api/health/database | jq '.migrationStatus'
```

Key fields:
- `status: "current"` — All migrations applied, no action needed
- `status: "needs_migration"` — There are pending (unapplied) migrations
- `pendingMigrations: true` — Migrations exist that haven't been applied

Also check the `_prisma_migrations` table directly:
```bash
psql $DATABASE_URL -c "
  SELECT migration_name, finished_at, rolled_back_at
  FROM \"_prisma_migrations\"
  ORDER BY finished_at DESC NULLS LAST
  LIMIT 10;
"
```

### Step 3: Check for Data Migration Issues

If the deployment included a data migration (not just schema):

```bash
# Check if any tables have unexpected empty or corrupted data
curl -s https://deepmindq.io/api/health/database | jq '.tables[] | select(.status == "empty")'

# Check specific table row counts
curl -s https://deepmindq.io/api/health/database | jq '.sizeEstimate'
```

The `database-enterprise-monitor.ts` monitors 17 core tables:
`User`, `Session`, `OtpCode`, `AuditLog`, `Company`, `Contact`, `Lead`,
`Opportunity`, `Note`, `Signal`, `AICache`, `AIUsageLog`,
`ConversationPlan`, `Sequence`, `EmailTemplate`, `Batch`, `ImportRecord`,
`ExportRecord`.

### Step 4: Categorize the Failure

| Failure Type | Rollback Scope | Action |
|-------------|---------------|--------|
| Code-only bug | Application only | Vercel rollback, no DB action |
| Schema migration (additive) | Application + DB | Vercel rollback, keep migration |
| Schema migration (destructive) | Application + DB | Vercel rollback + DB rollback |
| Data migration failure | Application + DB | Vercel rollback + data repair |
| Environment variable change | Application only | Revert env var + redeploy |
| Dependency update | Application only | Vercel rollback |

## Resolution

### Application Rollback (Vercel)

```bash
# 1. Identify the last known good deployment
GOOD_DEPLOY=$(vercel ls --limit 5 --yes 2>/dev/null | head -2 | tail -1 | awk '{print $1}')

# 2. Roll back to it
vercel rollback $GOOD_DEPLOY

# 3. Verify
vercel ls --limit 1
```

### Database Migration Rollback (Prisma)

**WARNING: Only roll back database migrations if the schema change is
incompatible with the rolled-back application code.**

#### For Additive Migrations (new columns, new tables)

**No action needed.** The old application code will ignore new columns/tables.

#### For Destructive Migrations (dropped columns, renamed columns, type changes)

1. **Mark the migration as rolled back** (tells Prisma it's been undone):
   ```bash
   npx prisma migrate resolve \
     --rolled-back <MIGRATION_NAME> \
     --schema prisma/schema.prisma
   ```

2. **Manually reverse the schema change** if needed:
   ```sql
   -- Example: Re-add a dropped column
   ALTER TABLE "Company" ADD COLUMN "dropped_column" TEXT;

   -- Example: Rename a renamed column back
   ALTER TABLE "Company" RENAME COLUMN "new_name" TO "old_name";
   ```

3. **Verify migration status**:
   ```bash
   curl -s https://deepmindq.io/api/health/database | jq '.migrationStatus'
   # Expected: { "status": "current", "pendingMigrations": false }
   ```

### Data Migration Repair

If a data migration corrupted or incorrectly transformed data:

1. **Assess the damage** using the metrics snapshots:
   ```bash
   # Check persisted metric snapshots for pre/post migration state
   # These are stored by persistMetricSnapshot() in SystemSetting
   psql $DATABASE_URL -c "
     SELECT key, length(value) as value_size, "updatedAt"
     FROM \"SystemSetting\"
     WHERE key LIKE 'metrics_snapshot_%'
     ORDER BY key DESC
     LIMIT 5;
   "
   ```

2. **Use Neon point-in-time recovery** if data was deleted or overwritten
   (see RB-007 for full procedure).

3. **Write and run a repair migration**:
   ```bash
   npx prisma migrate dev --name repair-data-after-rollback
   # Write the repair SQL in the generated migration file
   npx prisma migrate deploy
   ```

### Environment Variable Rollback

```bash
# Revert the changed environment variable
vercel env rm <VAR_NAME> production
vercel env add <VAR_NAME> production
# Enter the previous value

# Redeploy with the reverted variable
vercel --prod
```

## Verification

1. **Application is serving the correct version**:
   ```bash
   curl -s https://deepmindq.io/api/system-health | jq '.version'
   # Should match the known-good deployment
   ```

2. **Error rate returns to baseline**:
   ```bash
   curl -s https://deepmindq.io/api/health/metrics | rg 'deepmindq_http_errors_total'
   # Should not be increasing
   ```

3. **Database health is normal**:
   ```bash
   curl -s https://deepmindq.io/api/health/database | jq '.status'
   # Expected: "healthy"
   ```

4. **Migration status is current**:
   ```bash
   curl -s https://deepmindq.io/api/health/database | jq '.migrationStatus'
   # Expected: { "status": "current", "pendingMigrations": false }
   ```

5. **No new error types in Sentry** within 15 minutes of rollback.

6. **Key user flows work**: Login, dashboard load, AI intelligence refresh,
   data export.

## Escalation

| Condition | Action | Timeline |
|-----------|--------|----------|
| Rollback fails | Page Engineering Lead | 5 min |
| DB migration rollback needed | Page DBA on-call | 10 min |
| Data loss during migration | Escalate to SEV1, see RB-007 | Immediately |
| Rollback doesn't fix the issue | Investigate as new incident | 15 min |

## Prevention

### Short-Term

- **Pre-deploy smoke tests**: Add automated health check verification
  after each deployment. The deploy script should curl `/api/system-health`
  and roll back automatically on failure.

- **Database migration safety**: Require that all migrations are additive
  (no column drops, no type changes) in code review.

### Medium-Term

- **Blue-green deployment**: Use Vercel's built-in deployment slots to
  test the new version before switching traffic.

- **Migration rollback scripts**: For every migration, maintain a
  corresponding rollback script that is tested in staging.

### Long-Term

- **Canary deployments**: Route a small percentage of traffic to the new
  version first, monitor for errors, then gradually increase.

- **Automated rollback on error spike**: Integrate error rate monitoring
  with Vercel's deployment pipeline for automatic rollback.

## Related

- **Database Health Monitor**: `src/lib/database-enterprise-monitor.ts` —
  `getMigrationHealth()`, `getDatabaseHealthReport()`, `migrationStatus`
- **DB Migration**: `src/lib/db-migration.ts` — Migration execution logic
- **Metrics Persistence**: `src/lib/monitoring.ts` — `persistMetricSnapshot()`
  for timestamped state verification across deployments
- **Instrumentation**: `src/instrumentation.ts` — Startup sequence,
  `startMetricsPersistence()`, cold-start load
- **API Health Metrics**: `src/app/api/health/metrics/route.ts` —
  Prometheus endpoint for verification
- **Incident Manager**: `src/lib/incident-manager.ts` — SEV2 SLA: 30 min response
- **Incident Response**: `docs/incident-response.md` — Section 3.5 Failed Deployment
