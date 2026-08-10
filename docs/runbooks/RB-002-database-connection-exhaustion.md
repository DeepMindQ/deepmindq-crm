# RB-002: Database Connection Exhaustion

**Severity**: SEV1
**Owner**: Platform Engineering
**Last Updated**: 2026-08-10
**Status**: Tested in Staging

## Overview

Database connection pool exhaustion occurs when all available Prisma client
connections are in use and new requests queue or fail. This causes cascading
500 errors across all database-dependent endpoints. On Neon Postgres, the
connection limit is typically 100–500 depending on the plan.

## Detection

### Alert Indicators

| Source | Metric/Signal | Threshold |
|--------|--------------|-----------|
| Prometheus | `deepmindq_db_connections_active` | >= 90% of `deepmindq_db_connections_max` |
| monitoring.ts | `db.query.duration` | > 2000ms (slow-query alert rule `db-query-time`) |
| database-enterprise-monitor.ts | `performanceStats.queriesPerSecond` | Sudden drop to 0 |
| database-enterprise-monitor.ts | `connectivity` | `false` |
| Application logs | `PrismaClientInitializationError` | Any occurrence |

### Prometheus Metrics to Watch

```
deepmindq_db_connections_active       # Current active connections (gauge)
deepmindq_db_connections_max          # Maximum pool size (gauge)
deepmindq_db_query_latency_p50_ms     # P50 query latency (gauge)
deepmindq_db_query_latency_p95_ms     # P95 query latency (gauge)
deepmindq_db_query_latency_p99_ms     # P99 query latency (gauge)
deepmindq_db_queries_per_second       # Query throughput (gauge)
deepmindq_db_slow_queries_total       # Slow queries in current window (gauge)
```

## Immediate Response (First 5 Minutes)

1. **Create a SEV1 incident**:
   ```bash
   curl -X POST https://deepmindq.io/api/incidents \
     -H 'Content-Type: application/json' \
     -d '{
       "action": "create",
       "title": "Database Connection Exhaustion",
       "severity": "SEV1",
       "description": "DB connection pool at 90%+ capacity",
       "author": "on-call-engineer"
     }'
   ```

2. **Assess current state**:
   ```bash
   # Check database health report (comprehensive)
   curl -s https://deepmindq.io/api/health/database | jq .

   # Check Prometheus for exact connection counts
   curl -s https://deepmindq.io/api/health/metrics | rg 'deepmindq_db_connections'
   ```

3. **Check the database-side connection count** (requires psql access):
   ```bash
   psql $DATABASE_URL -c "SELECT count(*) as active_connections FROM pg_stat_activity WHERE state = 'active';"
   psql $DATABASE_URL -c "SELECT count(*) as total_connections FROM pg_stat_activity;"
   ```

4. **Identify long-running queries** blocking connections:
   ```bash
   psql $DATABASE_URL -c "
     SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
     FROM pg_stat_activity
     WHERE state != 'idle'
     ORDER BY duration DESC
     LIMIT 20;
   "
   ```

5. **Post status to incident channel** with connection counts and stuck queries.

## Diagnosis

### Step 1: Determine Pool Configuration

The connection pool size is controlled by the `DATABASE_URL` connection string
parameters. Check the current configuration:

```bash
# Pool size is set via connection_limit parameter in DATABASE_URL
# Check environment (masked in logs, check Vercel env or .env.local)
echo $DATABASE_URL | rg 'connection_limit'
```

Prisma connection string format:
```
postgresql://user:pass@host/db?connection_limit=10&pool_timeout=30
```

### Step 2: Review Performance Stats

```bash
# Get full database health report
# This calls getDatabaseHealthReport() from database-enterprise-monitor.ts
curl -s https://deepmindq.io/api/health/database | jq '{
  status: .status,
  connectivity: .connectivity,
  responseTimeMs: .responseTimeMs,
  performance: .performanceStats,
  migrationStatus: .migrationStatus,
  warnings: .warnings
}'
```

Key fields to examine:
- `performanceStats.slowQueryCount` — If > 0, slow queries are consuming connections
- `performanceStats.queriesPerSecond` — A sudden drop may indicate queueing
- `migrationStatus.pendingMigrations` — Pending migrations can lock tables
- `warnings` — Array of all detected issues

### Step 3: Check for Table Locks

```bash
psql $DATABASE_URL -c "
  SELECT blocked.pid AS blocked_pid,
         blocked.query AS blocked_query,
         blocking.pid AS blocking_pid,
         blocking.query AS blocking_query
  FROM pg_stat_activity blocked
  JOIN pg_locks blocked_locks ON blocked.pid = blocked_locks.pid
  JOIN pg_locks blocking_locks ON blocked_locks.locktype = blocking_locks.locktype
    AND blocked_locks.database IS NOT DISTINCT FROM blocking_locks.database
    AND blocked_locks.relation IS NOT DISTINCT FROM blocking_locks.relation
    AND blocked_locks.page IS NOT DISTINCT FROM blocking_locks.page
    AND blocked_locks.tuple IS NOT DISTINCT FROM blocking_locks.tuple
    AND blocked_locks.pid != blocking_locks.pid
  JOIN pg_stat_activity blocking ON blocking_locks.pid = blocking.pid
  WHERE NOT blocked_locks.granted;
"
```

### Step 4: Check Database-Side Resource Limits

On the Neon console (`https://console.neon.tech`):
- Check current active connections vs plan limit
- Check compute unit utilization (CPU, memory)
- Check if autoscaling is enabled and functional

## Resolution

### Option A: Terminate Stuck Queries (Immediate)

If specific long-running queries are identified:

```bash
# Terminate a specific blocking query by PID
psql $DATABASE_URL -c "SELECT pg_terminate_backend(PID);"

# Terminate all idle connections older than 5 minutes (free up pool)
psql $DATABASE_URL -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE state = 'idle'
    AND query_start < now() - interval '5 minutes'
    AND pid != pg_backend_pid();
"
```

### Option B: Increase Connection Pool Size

1. Update `DATABASE_URL` in Vercel environment variables:
   ```
   # Increase connection_limit from current value (typically 10) to 20-50
   # Also increase pool_timeout if connections are timing out
   DATABASE_URL=postgresql://user:pass@host/db?connection_limit=30&pool_timeout=60
   ```

2. **Redeploy** for the new env var to take effect:
   ```bash
   vercel --prod
   ```

3. **Verify new pool size**:
   ```bash
   curl -s https://deepmindq.io/api/health/metrics | rg 'deepmindq_db_connections_max'
   ```

### Option C: Emergency Application Restart

If the pool is completely deadlocked:

```bash
# Vercel: redeploy to get fresh connections
vercel --prod

# Self-hosted: restart the container
docker restart deepmindq-blue
```

### Option D: Query Optimization

If slow queries are the root cause, check `database-performance-monitor.ts`
stats for the most expensive operations:

```bash
curl -s https://deepmindq.io/api/health/database | jq '.performanceStats.topSlowQueries'
```

The `topSlowQueries` array shows the top 10 slowest queries by average
duration, including model name, action type, count, and max duration.

Common optimizations:
- Add missing indexes for frequently queried fields
- Use `select` in Prisma queries to limit returned columns
- Implement cursor-based pagination instead of offset
- Add `take`/`skip` limits to prevent full table scans

## Verification

1. **Connection count returns to normal**:
   ```bash
   curl -s https://deepmindq.io/api/health/metrics | rg 'deepmindq_db_connections_active'
   # Should be < 70% of max
   ```

2. **Database health report shows healthy**:
   ```bash
   curl -s https://deepmindq.io/api/health/database | jq '.status'
   # Expected: "healthy"
   ```

3. **Latency targets met** (per `database-performance-monitor.ts`):
   - P95 latency < 200ms
   - P99 latency < 500ms
   ```bash
   curl -s https://deepmindq.io/api/health/metrics | rg 'deepmindq_db_query_latency_p95'
   ```

4. **No slow queries** in the current window:
   ```bash
   curl -s https://deepmindq.io/api/health/metrics | rg 'deepmindq_db_slow_queries_total'
   # Should be 0 or very low
   ```

5. **Application error rate normalizes**: Verify via RB-001 procedure.

## Escalation

| Condition | Action | Timeline |
|-----------|--------|----------|
| Cannot free connections in 10 min | Page DBA on-call | 10 min |
| Neon database shows resource exhaustion | Contact Neon support | 10 min |
| Root cause requires schema/index changes | Engage Engineering Lead | 30 min |
| Connection exhaustion is recurring | Escalate for architectural review | Post-incident |

## Prevention

### Short-Term

- **Set up connection pool alerting** in Grafana:
  ```
  alert: DBConnectionPoolHigh
  expr: deepmindq_db_connections_active / deepmindq_db_connections_max > 0.8
  for: 2m
  labels:
    severity: warning
  ```

- **Configure Prisma connection timeout**: Ensure `pool_timeout` is set in
  `DATABASE_URL` (recommended: 30-60 seconds) so queries fail fast rather than
  queueing indefinitely.

### Medium-Term

- **Implement connection pooling at the database level**: Use Neon's built-in
  connection pooling (PgBouncer) via the `-pooler` endpoint to multiplex
  many application connections over fewer database connections.

- **Add query-level timeouts**: Set `statement_timeout` at the database level
  for non-critical queries:
  ```sql
  SET statement_timeout = '5000';  -- 5 second timeout per session
  ```

### Long-Term

- **Query audit**: Regular review of `topSlowQueries` from the performance
  monitor. Create a weekly automated report.

- **Connection pool right-sizing**: Based on `database-enterprise-monitor.ts`
  `sizeEstimate.totalRows` and query volume data, right-size the pool.

- **Database read replicas**: Offload read-heavy queries to a Neon read
  replica to reduce load on the primary.

## Related

- **Database Health Monitor**: `src/lib/database-enterprise-monitor.ts` —
  `getDatabaseHealthReport()`, `getDatabaseHealthSummary()`, table health,
  migration status, connectivity probe
- **Performance Monitor**: `src/lib/database-performance-monitor.ts` —
  `getDbPerformanceStats()`, `validateLatencyTargets()`, slow query tracking
- **Metrics Endpoint**: `src/app/api/health/metrics/route.ts` —
  DB connection and query latency Prometheus metrics
- **Monitoring**: `src/lib/monitoring.ts` — `db-query-time` alert rule (> 2000ms)
- **Incident Response**: `docs/incident-response.md` — Section 3.1 Database Connection Failure
- **API Observability**: `src/lib/api-observability.ts` — HTTP error rate metrics
