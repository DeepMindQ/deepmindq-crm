# RB-008: Metrics Pipeline Failure

**Severity**: SEV3
**Owner**: Platform Engineering
**Last Updated**: 2026-08-10
**Status**: Tested in Staging

## Overview

The metrics pipeline collects in-memory metrics via `src/lib/monitoring.ts`,
persists snapshots to the database every 5 minutes via `startMetricsPersistence()`,
and exposes Prometheus-compatible metrics at `/api/health/metrics`. A failure in
this pipeline means Grafana dashboards show stale data, alerts may not fire,
and operational visibility is lost. The application itself continues to function.

## Detection

### Alert Indicators

| Source | Signal | Description |
|--------|--------|-------------|
| Grafana | Gaps in metric charts | No data points for > 5 min |
| Prometheus | Scrape returns zeros or stale values | Metrics not updating |
| `/api/health/metrics` | All values return 0 | Metrics collector reset or broken |
| SystemSetting | No new `metrics_snapshot_*` entries | Persistence interval stopped |
| Alertmanager | No alerts firing despite known issues | Alert evaluation broken |

### Self-Test

```bash
# Quick check: is the metrics endpoint returning real data?
curl -s https://deepmindq.io/api/health/metrics | rg 'deepmindq_http_requests_total'
# If the value is 0 and you know there's traffic, the pipeline is broken

# Check for stale snapshots
psql $DATABASE_URL -c "
  SELECT key, \"updatedAt\", length(value) as snapshot_size
  FROM \"SystemSetting\"
  WHERE key LIKE 'metrics_snapshot_%'
  ORDER BY \"updatedAt\" DESC
  LIMIT 5;
"
# If the most recent entry is > 10 minutes old, persistence has stopped
```

## Immediate Response (First 5 Minutes)

1. **Determine the failure mode**:
   ```bash
   # Is the metrics endpoint itself working?
   curl -s -o /dev/null -w '%{http_code}' https://deepmindq.io/api/health/metrics
   # Expected: 200. If not, the route handler is broken.

   # Are metrics being collected (in-memory)?
   curl -s https://deepmindq.io/api/monitoring | jq '.aggregates'
   # If this returns empty or mostly zeros, collection is broken.

   # Are metrics being persisted (to DB)?
   psql $DATABASE_URL -c "
     SELECT \"updatedAt\" FROM \"SystemSetting\"
     WHERE key LIKE 'metrics_snapshot_%'
     ORDER BY \"updatedAt\" DESC LIMIT 1;
   "
   # If > 10 minutes ago, persistence interval is broken.
   ```

2. **Create a SEV3 incident** (or SEV2 if alerting is also broken):
   ```bash
   curl -X POST https://deepmindq.io/api/incidents \
     -H 'Content-Type: application/json' \
     -d '{
       "action": "create",
       "title": "Metrics Pipeline Failure",
       "severity": "SEV3",
       "description": "Metrics not being collected or persisted",
       "author": "on-call-engineer"
     }'
   ```

3. **Check for memory pressure** that may have killed the interval:
   ```bash
   curl -s https://deepmindq.io/api/health/metrics | rg 'deepmindq_heap_usage_percent'
   # If > 90%, memory pressure may be preventing timer callbacks
   ```

## Diagnosis

### Failure Mode A: Metrics Endpoint Returning Zeros

The `/api/health/metrics` endpoint (`src/app/api/health/metrics/route.ts`) calls
`collectSystemMetrics()` and `monitoringMetrics.getAggregates()` at scrape time.

**Check**: Is `collectSystemMetrics()` being called? This is invoked at scrape
time (not on a timer), so if the endpoint returns zeros, the `MetricsCollector`
instance may have been reset or the serverless function is not sharing state.

```bash
# Verify system metrics are being collected
curl -s https://deepmindq.io/api/health/metrics | rg 'deepmindq_memory_usage_bytes'
# If 0, the MetricsCollector may be empty
```

**Root cause**: In Vercel serverless, each function invocation creates a new
process. In-memory metrics are lost between cold starts. The
`startMetricsPersistence()` in `instrumentation.ts` mitigates this by
persisting to the database, but real-time metrics are only available within
a single function instance's lifetime.

### Failure Mode B: Persistence Interval Stopped

The `startMetricsPersistence()` function in `monitoring.ts` (line 258) creates
a `setInterval` that calls `persistMetricSnapshot()` every 5 minutes (300,000ms).
This is called once at startup in `instrumentation.ts`.

**Possible causes**:
1. The `setInterval` was garbage collected (shouldn't happen — `timer.unref()`
   is called, but the reference is not retained by the caller).
2. The `instrumentation.ts` `register()` function failed to import monitoring.
3. The `persistMetricSnapshot()` function is throwing (it catches internally,
   so check the startup log).
4. Serverless function cold starts — the interval is per-instance and may
   not survive cold starts.

```bash
# Check if startMetricsPersistence was called at startup
# Look for the startup log message
vercel logs --output json 2>/dev/null | jq 'select(.message | test("Metrics persistence"))' | tail -5
# Expected: "[startup] Metrics persistence started (5-minute interval)"
```

### Failure Mode C: Database Writes Failing

If `persistMetricSnapshot()` is running but data isn't appearing in the DB:

```bash
# Check if the SystemSetting table is writable
psql $DATABASE_URL -c "
  INSERT INTO \"SystemSetting\" (key, value)
  VALUES ('test_write', 'ok')
  ON CONFLICT (key) DO UPDATE SET value = 'ok';
  SELECT value FROM \"SystemSetting\" WHERE key = 'test_write';
"
# Clean up
psql $DATABASE_URL -c "DELETE FROM \"SystemSetting\" WHERE key = 'test_write';"
```

### Failure Mode D: Prometheus Scrape Configuration

If Grafana shows gaps but the endpoint is working:

1. Check Prometheus scrape configuration:
   ```yaml
   # In prometheus.yml
   scrape_configs:
     - job_name: 'deepmindq'
       scrape_interval: 60s
       static_configs:
         - targets: ['deepmindq.io']
       metrics_path: '/api/health/metrics'
   ```

2. Check Prometheus targets page: `http://prometheus:9090/targets`
3. Look for scrape errors in Prometheus logs.

## Resolution

### Fix A: Restart Metrics Persistence

If the interval has stopped, a redeployment will restart it:

```bash
# Redeploy to trigger instrumentation.ts register() again
vercel --prod

# Verify the startup log appears
vercel logs --output json 2>/dev/null | jq 'select(.message | test("Metrics persistence"))' | tail -1
```

### Fix B: Fix Database Connectivity

If `persistMetricSnapshot()` is failing due to database issues:

1. Follow RB-002 for database connection issues.
2. The function has a try/catch that logs warnings but doesn't throw,
   so check for `[Monitoring] Failed to persist metric snapshot` in logs.

### Fix C: Fix Prometheus Scrape

1. Verify the `metrics_path` in Prometheus config is `/api/health/metrics`.
2. Verify the target URL is reachable from the Prometheus server.
3. Check that the response `Content-Type` is `text/plain` (set by the endpoint).
4. Reload Prometheus configuration:
   ```bash
   curl -X POST http://prometheus:9090/-/reload
   ```

### Fix D: Memory Pressure Recovery

If memory pressure is causing timer callbacks to be delayed or skipped:

1. Check `deepmindq_heap_usage_percent` — if > 85%, follow RB-009.
2. The `HEAP_WARNING_THRESHOLD` (85%) and `HEAP_CRITICAL_THRESHOLD` (95%)
   in `memory-resource-monitor.ts` will trigger log warnings.

## Verification

1. **Metrics endpoint returns non-zero values**:
   ```bash
   curl -s https://deepmindq.io/api/health/metrics | rg 'deepmindq_http_requests_total'
   # Should be > 0 if there's traffic
   ```

2. **New snapshots are being persisted**:
   ```bash
   psql $DATABASE_URL -c "
     SELECT key, \"updatedAt\"
     FROM \"SystemSetting\"
     WHERE key LIKE 'metrics_snapshot_%'
     ORDER BY \"updatedAt\" DESC LIMIT 1;
   "
   # Should be within the last 5 minutes
   ```

3. **Grafana dashboards are updating**: Check that new data points appear
   in the next scrape interval (60 seconds).

4. **Alerts are firing again**: If alert rules are being evaluated,
   `GET /api/monitoring` should return current alert states.

5. **Monitor for 15 minutes** to confirm consistent persistence.

## Escalation

| Condition | Action | Timeline |
|-----------|--------|----------|
| Metrics down > 30 min | Notify Engineering Lead | 30 min |
| Also affects alerting | Escalate to SEV2 | Immediately |
| Database writes failing | Follow RB-002 | Immediately |
| Prometheus scrape broken | Engage Infra team | 1 hour |

## Prevention

### Short-Term

- **Add a liveness metric for the persistence interval**: Record a timestamp
  metric each time `persistMetricSnapshot()` runs. Alert if this timestamp
  is > 10 minutes old.
  ```
  deepmindq_metrics_persistence_last_success_timestamp
  ```

- **Add startup validation**: In `instrumentation.ts`, verify that
  `startMetricsPersistence()` returns successfully and log the cleanup
  function handle.

### Medium-Term

- **Use external metrics collector**: For serverless environments,
  consider pushing metrics to an external service (e.g., Prometheus
  remote_write, Datadog, New Relic) instead of relying on in-memory
  state and pull-based scraping.

- **Add a health check for the metrics pipeline**: Include metrics
  pipeline health in the `/api/system-health` response.

### Long-Term

- **Structured metrics pipeline**: Replace the in-memory `MetricsCollector`
  with a proper metrics library (e.g., `prom-client`) that handles
  serverless function lifecycle correctly.

- **Metrics aggregation service**: Move metric aggregation to a
  dedicated service that pulls from the database snapshots, rather
  than relying on in-memory state.

## Related

- **Monitoring**: `src/lib/monitoring.ts` — `MetricsCollector` class,
  `persistMetricSnapshot()`, `loadMetricSnapshots()`,
  `startMetricsPersistence(intervalMs)`, `METRICS_SNAPSHOT_PREFIX`
- **Instrumentation**: `src/instrumentation.ts` — `startMetricsPersistence(5 * 60 * 1000)`
  call at startup (line 10-14)
- **Metrics Endpoint**: `src/app/api/health/metrics/route.ts` —
  Prometheus-compatible exporter, all `deepmindq_*` metrics
- **Monitoring API**: `src/app/api/monitoring/route.ts` —
  On-demand alert evaluation via `evaluateAlerts()`
- **System Health**: `src/app/api/system-health/route.ts` —
  Overall system health overview
- **API Observability**: `src/lib/api-observability.ts` —
  `getApiMetrics()` for HTTP metrics used by the exporter
- **Incident Manager**: `src/lib/incident-manager.ts` —
  Incident metrics exposed via the exporter
