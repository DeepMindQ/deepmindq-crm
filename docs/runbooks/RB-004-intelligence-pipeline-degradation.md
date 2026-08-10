# RB-004: Intelligence Pipeline Degradation

**Severity**: SEV2
**Owner**: Platform Engineering
**Last Updated**: 2026-08-10
**Status**: Tested in Staging

## Overview

The intelligence pipeline powers DeepMindQ's core AI-driven features: company
research, signal processing, evidence chain validation, and recommendation
generation. Degradation manifests as stale intelligence data, low confidence
scores, increased AI failures, or missing evidence chains. This runbook covers
diagnosis and resolution of pipeline issues that do not stem from a full LLM
provider outage (see RB-003 for that scenario).

## Detection

### Alert Indicators

| Source | Metric/Signal | Threshold |
|--------|--------------|-----------|
| ai-tracing.ts | `failedRequests` spike in cost report | > 10% failure rate |
| ai-tracing.ts | `avgLatencyMs` increase | > 2x baseline |
| AIUsageLog (DB) | Status = 'failed' | Spike in volume |
| Intelligence dashboard | Stale "last refreshed" timestamps | > 4 hours for any company |
| Evidence chain | Validation failures | Missing links in chain |
| User reports | "AI insights are wrong/outdated" | Qualitative signal |

### Prometheus Metrics

```
deepmindq_ai_provider_calls_total          # Total LLM calls
deepmindq_ai_provider_errors_total         # Total LLM failures
deepmindq_ai_active_contexts               # Active AI processing contexts (stuck = bad)
```

## Immediate Response (First 5 Minutes)

1. **Assess the scope** of degradation:
   ```bash
   # Check AI provider health (rules out full outage — see RB-003 if circuit breakers open)
   curl -s https://deepmindq.io/api/health/metrics | rg 'deepmindq_ai_provider_circuit_breaker_open'
   # Expected: 0 (if > 0, follow RB-003 instead)

   # Check active AI contexts (stuck contexts indicate pipeline stalls)
   curl -s https://deepmindq.io/api/health/metrics | rg 'deepmindq_ai_active_contexts'
   # If > 50, there may be stuck operations
   ```

2. **Query AIUsageLog for recent failures**:
   ```bash
   psql $DATABASE_URL -c "
     SELECT feature, provider, model, status, count(*),
            round(avg(duration_ms)) as avg_ms,
            round(min(duration_ms)) as min_ms,
            round(max(duration_ms)) as max_ms
     FROM \"AIUsageLog\"
     WHERE \"createdAt\" > now() - interval '1 hour'
       AND status = 'failed'
     GROUP BY feature, provider, model, status
     ORDER BY count(*) DESC
     LIMIT 20;
   "
   ```

3. **Check prompt version registry** for recent changes:
   ```bash
   # Active prompt versions are tracked in ai-tracing.ts
   # via activePromptVersions Map and registerPromptVersion()
   # Exposed through monitoring or admin endpoint
   curl -s https://deepmindq.io/api/monitoring | jq '.promptVersions'
   ```

4. **Create incident** if degradation affects multiple users:
   ```bash
   curl -X POST https://deepmindq.io/api/incidents \
     -H 'Content-Type: application/json' \
     -d '{
       "action": "create",
       "title": "Intelligence Pipeline Degradation",
       "severity": "SEV2",
       "description": "AI pipeline producing stale/low-quality results",
       "author": "on-call-engineer"
     }'
   ```

## Diagnosis

### Step 1: Identify the Failing Capability

The `ai-tracing.ts` cost report breaks down performance by capability:

```bash
# Generate a 1-hour cost report to see which capabilities are failing
psql $DATABASE_URL -c "
  SELECT feature,
         count(*) FILTER (WHERE status = 'success') as successes,
         count(*) FILTER (WHERE status = 'failed') as failures,
         round(avg(duration_ms)) as avg_latency_ms,
         round(sum(estimated_cost)::numeric, 4) as total_cost_usd
  FROM \"AIUsageLog\"
  WHERE \"createdAt\" > now() - interval '1 hour'
  GROUP BY feature
  ORDER BY failures DESC;
"
```

Typical capabilities: `research`, `reasoning`, `fusion`, `recommendation`, `scoring`.

### Step 2: Check for Stale Intelligence Data

```bash
# Find companies with stale intelligence (no refresh in > 4 hours)
psql $DATABASE_URL -c "
  SELECT c.id, c.name, c.\"lastIntelligenceRefreshAt\"
  FROM \"Company\" c
  WHERE c.\"lastIntelligenceRefreshAt\" < now() - interval '4 hours'
    OR c.\"lastIntelligenceRefreshAt\" IS NULL
  ORDER BY c.\"lastIntelligenceRefreshAt\" ASC NULLS FIRST
  LIMIT 20;
"
```

### Step 3: Check Prompt Version Changes

If a prompt was recently changed, it may be causing quality degradation.
The `ai-tracing.ts` module tracks active prompt versions:

```bash
# Check when prompt versions were last activated
# Prompt versions are registered via registerPromptVersion(key, capability, model, description)
# and stored in the activePromptVersions Map
# Also persisted via prompt-registry-persistence.ts to SystemSetting
psql $DATABASE_URL -c "
  SELECT key, value
  FROM \"SystemSetting\"
  WHERE key LIKE 'prompt_version_%'
  ORDER BY key;
"
```

### Step 4: Check Evidence Chain Validation

The intelligence pipeline produces evidence chains that should be validated
before storage. Check for validation failures:

```bash
# Check AI cache hit/miss rates (low hit rate = cache issues)
psql $DATABASE_URL -c "
  SELECT count(*) as total_cache,
         count(*) FILTER (WHERE \"cachedAt\" IS NOT NULL) as cached,
         round(count(*) FILTER (WHERE \"cachedAt\" IS NOT NULL)::numeric / count(*) * 100, 1) as hit_pct
  FROM \"AICache\";
"
```

### Step 5: Determine Root Cause Category

| Symptom | Likely Cause | Resolution |
|---------|-------------|------------|
| All capabilities failing | LLM provider issue | See RB-003 |
| Single capability failing | Prompt engineering regression | Rollback prompt version |
| Stale data, no failures | Pipeline trigger/scheduler broken | Manual trigger, check cron |
| Low confidence scores | Data quality issue upstream | Check signal ingestion |
| High latency, no failures | Model change or overload | Check provider, consider switching model |
| Intermittent failures | Rate limiting | Reduce request rate |

## Resolution

### Option A: Manual Pipeline Trigger

If the pipeline has stalled (stale data but no errors), trigger a manual run:

```bash
# Trigger intelligence refresh for a specific company (via admin API)
curl -X POST https://deepmindq.io/api/admin/intelligence/refresh \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <admin-token>' \
  -d '{ "companyId": "<id>" }'
```

For bulk refresh:
```bash
# Trigger refresh for all stale companies
curl -X POST https://deepmindq.io/api/admin/intelligence/bulk-refresh \
  -H 'Authorization: Bearer <admin-token>'
```

### Option B: Prompt Version Rollback

If a recent prompt change caused quality degradation:

1. Identify the bad prompt version from the registry (Step 3 above).
2. Identify the last known good version from `AIUsageLog`:
   ```bash
   psql $DATABASE_URL -c "
     SELECT feature, model, min(\"createdAt\") as first_seen, count(*)
     FROM \"AIUsageLog\"
     WHERE status = 'success'
       AND \"createdAt\" > now() - interval '7 days'
     GROUP BY feature, model
     ORDER BY first_seen DESC;
   "
   ```
3. Revert the prompt in the source code to the known-good version.
4. The `versionPrompt()` function in `ai-tracing.ts` generates a hash from
   the combined `systemPrompt + userTemplate` — verify the hash matches the
   known-good version.
5. Deploy the fix: `vercel --prod`

### Option C: Cache Invalidation

If stale cache is serving old results:

```bash
# Clear the AI cache for specific entries
psql $DATABASE_URL -c "
  DELETE FROM \"AICache\" WHERE \"createdAt\" < now() - interval '2 hours';
"

# Or clear all cache (more aggressive)
psql $DATABASE_URL -c "TRUNCATE TABLE \"AICache\";"
```

Note: The search-provider-fallback.ts also has an in-memory LRU cache
(max 1000 entries, 1-hour TTL). This is cleared on redeploy.

### Option D: Model Switch

If a specific model is producing poor results:

1. Check which models are being used per capability in `ModelRouter`.
2. Switch to an alternative model by updating the routing configuration.
3. Deploy the change.

## Verification

1. **Pipeline produces fresh results**:
   ```bash
   # Check that lastIntelligenceRefreshAt is recent
   psql $DATABASE_URL -c "
     SELECT count(*) FROM \"Company\" 
     WHERE \"lastIntelligenceRefreshAt\" > now() - interval '30 minutes';
   "
   ```

2. **AI failure rate has returned to baseline**:
   ```bash
   # Should be < 5% failures in the last hour
   psql $DATABASE_URL -c "
     SELECT round(
       count(*) FILTER (WHERE status = 'failed')::numeric / count(*) * 100, 2
     ) as failure_pct
     FROM \"AIUsageLog\"
     WHERE \"createdAt\" > now() - interval '1 hour';
   "
   ```

3. **Confidence scores are within normal range**: Check the intelligence
   dashboard for sample companies.

4. **Evidence chains are complete**: Verify that signals link to evidence
   and evidence links to conclusions in the intelligence view.

## Escalation

| Condition | Action | Timeline |
|-----------|--------|----------|
| All AI capabilities failing | Page AI/ML Lead | 15 min |
| Prompt rollback required | Engage prompt engineering team | 30 min |
| Data quality issue identified | Engage data engineering team | 1 hour |
| Issue persists > 2 hours | Escalate to SEV1 | 2 hours |

## Prevention

### Short-Term

- **Add pipeline freshness alerting**: Alert when no intelligence refreshes
  have completed in the last 2 hours.

- **Add prompt version change tracking**: Log prompt version changes to
  AuditLog for traceability.

### Medium-Term

- **Automated prompt A/B testing**: Before promoting a new prompt version,
  run it alongside the current version and compare quality metrics.

- **Pipeline health dashboard**: Create a Grafana panel showing pipeline
  throughput, success rate, and data freshness.

### Long-Term

- **Automated quality monitoring**: Implement output quality scoring
  (e.g., confidence distribution tracking) with alerts for degradation.

- **Pipeline self-healing**: Automatic retry with different prompts/models
  when quality drops below threshold.

## Related

- **AI Tracing**: `src/lib/ai-tracing.ts` — `registerPromptVersion()`,
  `getActivePromptVersions()`, `getAICostReport()`, `estimateCost()`,
  `activePromptVersions` Map
- **AI Retrieval Validation**: `src/lib/ai-retrieval-validation.ts` —
  Evidence chain validation logic
- **Intelligence Pipeline**: `src/lib/intelligence-pipeline.ts` —
  Core pipeline orchestration
- **Prompt Registry Persistence**: `src/lib/prompt-registry-persistence.ts` —
  Persists prompt versions to SystemSetting
- **Model Router**: `src/lib/engines/model-router.ts` —
  Provider/model selection, performance stats
- **Search Fallback**: `src/lib/search-provider-fallback.ts` —
  In-memory LRU cache (1000 entries, 1hr TTL)
- **Memory Monitor**: `src/lib/memory-resource-monitor.ts` —
  `startAIContextTracking()`, `endAIContextTracking()` for detecting stuck contexts
- **Monitoring**: `src/lib/monitoring.ts` — `ai-latency` alert rule
