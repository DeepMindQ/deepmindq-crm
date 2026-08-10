# RB-001: High Error Rate Response

**Severity**: SEV1
**Owner**: Platform Engineering
**Last Updated**: 2026-08-10
**Status**: Tested in Staging

## Overview

A sustained spike in HTTP 4xx/5xx errors indicates a systemic issue affecting API
availability. This can be caused by upstream service failures, database outages,
invalid deployments, or resource exhaustion. Left unaddressed, users will experience
complete or partial loss of platform functionality.

## Detection

### Alert Rules (src/lib/monitoring.ts)

| Rule ID | Metric | Condition | Threshold | Severity |
|---------|--------|-----------|-----------|----------|
| `error-rate` | `api.error.count` | `gt` | `> 10` in 60s | critical |
| `high-response-time` | `api.request.duration` | `gt` | `> 5000ms` in 60s | warning |

### Prometheus Metrics

- `deepmindq_http_errors_total` — Counter of all HTTP error responses (4xx + 5xx).
  A sudden rate increase beyond baseline indicates a problem.
- `deepmindq_http_requests_total` — Total request counter. Use this to calculate
  error percentage: `deepmindq_http_errors_total / deepmindq_http_requests_total`.
- `deepmindq_http_request_duration_p95_ms` — P95 latency. Spikes often correlate
  with error rate increases.

### External Monitoring

- **Sentry**: Check for new error types appearing in the Issues dashboard.
  Critical alerts are forwarded from `monitoring.ts` via `Sentry.captureMessage()`.
- **Grafana**: The `#alerts-critical` Slack channel receives webhook notifications
  for all `critical`-severity alerts from the `log`, `email`, and `slack` channels.

## Immediate Response (First 5 Minutes)

1. **Acknowledge the alert** in `#alerts-critical` Slack channel.
2. **Create an incident** using the Incident Manager:
   ```bash
   curl -X POST https://deepmindq.io/api/incidents \
     -H 'Content-Type: application/json' \
     -d '{
       "action": "create",
       "title": "High Error Rate — >10 errors/min",
       "severity": "SEV1",
       "description": "api.error.count exceeds threshold of 10 in 60s window",
       "author": "on-call-engineer"
     }'
   ```
3. **Check the health endpoints** to determine scope:
   ```bash
   # Overall system health
   curl -s https://deepmindq.io/api/system-health | jq '.status'

   # Database connectivity
   curl -s https://deepmindq.io/api/health/database | jq '.status'

   # Prometheus metrics for error count
   curl -s https://deepmindq.io/api/health/metrics | rg 'deepmindq_http_errors_total'
   ```
4. **Trigger on-demand alert evaluation**:
   ```bash
   curl -s https://deepmindq.io/api/monitoring | jq '.activeAlerts'
   ```
5. **Check Sentry** for new error types and grouping:
   - Navigate to `https://sentry.deepmindq.internal/issues/`
   - Filter by: **Last 15 minutes**, **Environment: Production**
   - Look for a single new error type dominating the stream
6. **Post initial status** to the incident Slack channel.

## Diagnosis

### Step 1: Determine Error Type Distribution

```bash
# Check Prometheus for current error count
curl -s https://deepmindq.io/api/health/metrics | rg 'deepmindq_http_errors_total'

# Check API metrics for error rate percentage and latency percentiles
curl -s https://deepmindq.io/api/health/metrics | rg -e 'deepmindq_http_request_duration' -e 'deepmindq_http_errors'
```

### Step 2: Check Application Logs

```bash
# Check Vercel function logs (or container logs if self-hosted)
# Vercel:
vercel logs --output json | jq 'select(.level == "error")' | head -50

# Self-hosted:
docker logs deepmindq-blue --tail 200 --timestamps | rg 'ERROR|FATAL'
```

### Step 3: Check Database Health

If errors are 500-class, the database is a likely culprit:

```bash
# Check database health report (includes connectivity, latency, migration status)
curl -s https://deepmindq.io/api/health/database | jq .

# If using self-hosted, check DB connection directly:
psql $DATABASE_URL -c "SELECT 1;"
```

### Step 4: Check for Recent Deployments

```bash
# Check if a deployment happened recently
vercel deployments --limit 5

# Compare error onset time with deployment timestamp
```

### Step 5: Identify the Error Pattern

| Pattern | Likely Cause | Follow Runbook |
|---------|-------------|----------------|
| All endpoints returning 500 | Database down or connection exhaustion | RB-002 |
| AI endpoints returning 504 | LLM provider outage | RB-003 |
| New 500 types after deploy | Bad deployment | RB-006 |
| 401/403 spike | Session/CSRF issue | RB-005 |
| Gradual error increase | Memory leak / resource exhaustion | RB-009 |
| Stale/zero metrics | Metrics pipeline failure | RB-008 |

## Resolution

### If Database-Related (Most Common)

1. Follow **RB-002** for database connection exhaustion.
2. Verify connectivity: `curl -s https://deepmindq.io/api/health/database | jq '.connectivity'`
3. If connectivity is `false`, check Neon console for database status.

### If AI Provider-Related

1. Follow **RB-003** for LLM provider outage.
2. Check `deepmindq_ai_provider_circuit_breaker_open` metric — if > 0, circuit
   breakers have tripped.

### If Deployment-Related

1. Follow **RB-006** for deployment rollback.
2. Roll back to the last known good deployment immediately.

### If Memory-Related

1. Follow **RB-009** for memory leak response.
2. Check `deepmindq_heap_usage_percent` — if > 95%, restart is imminent.

### If No Clear Cause

1. **Restart the application** as a last-resort stabilization measure:
   - Vercel: `vercel --prod` (redeploy current commit)
   - Self-hosted: `docker restart deepmindq-blue`
2. Monitor error rate for 5 minutes post-restart.
3. If errors persist, escalate to Engineering Lead.

## Verification

1. **Error rate drops below threshold**:
   ```bash
   # Verify api.error.count is below 10
   curl -s https://deepmindq.io/api/monitoring | jq '.activeAlerts[] | select(.ruleId == "error-rate")'
   # Should return empty (no active alert)
   ```
2. **Health endpoints return healthy**:
   ```bash
   curl -s https://deepmindq.io/api/system-health | jq '.status'
   # Expected: "healthy"
   ```
3. **Sentry error rate returns to baseline**: Check Sentry dashboard for
   new error creation rate returning to normal.
4. **No new error types**: Confirm in Sentry that no novel exception types
   have appeared in the last 15 minutes.
5. **Monitor for 15 minutes** after resolution before transitioning incident
   to `monitoring` status.

## Escalation

| Condition | Action | Timeline |
|-----------|--------|----------|
| Error rate not decreasing after 15 min | Page Engineering Lead | 15 min |
| Root cause identified but fix requires code change | Engage domain expert | 30 min |
| All providers down simultaneously | Page VP Engineering + AI/ML Lead | 30 min |
| SLA breach on SEV1 (15 min response) | Auto-escalate via Incident Manager | 15 min |
| Data integrity concern | Escalate to SEV1, notify Security Lead | Immediately |

The `incident-manager.ts` `checkSLA()` method automatically tracks response SLA:
- SEV1: 15 minutes to initial response
- SEV2: 30 minutes to initial response

## Prevention

### Short-Term

- **Tune alert thresholds**: If frequent false positives, adjust the `error-rate`
  rule threshold in `src/lib/monitoring.ts` `ALERT_RULES` array (line 102).
  Current: `api.error.count > 10` in 60s.
- **Add error-type-specific alerts**: Create separate alert rules for 4xx vs 5xx
  to distinguish client errors from server errors.

### Medium-Term

- **Implement automated mitigation**: Add a middleware that triggers circuit
  breakers on the API layer when error rate exceeds threshold.
- **Enhance Sentry integration**: Add Sentry performance monitoring for
  transaction-level error rate tracking.

### Long-Term

- **Chaos engineering**: Regularly test resilience by injecting failures in
  staging (database disconnect, AI provider timeout, memory pressure).
- **Error budget policy**: Define SLOs (e.g., 99.9% availability) and link
  alert thresholds to error budget consumption.

## Related

- **Alert Rules**: `src/lib/monitoring.ts` — `ALERT_RULES` array (5 rules, lines 100–106)
- **Metrics Endpoint**: `src/app/api/health/metrics/route.ts` — Prometheus exporter
- **Monitoring Endpoint**: `src/app/api/monitoring/route.ts` — On-demand alert evaluation
- **Sentry DSN**: Configured in `sentry.server.config.ts` and `sentry.edge.config.ts`
- **Incident Manager**: `src/lib/incident-manager.ts` — SLA tracking, incident lifecycle
- **Incident Response**: `docs/incident-response.md` — Full response procedures
- **Slack Integration**: `src/lib/slack-integration.ts` — Alert notification delivery
