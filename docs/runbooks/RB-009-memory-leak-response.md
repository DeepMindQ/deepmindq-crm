# RB-009: Memory Leak Response

**Severity**: SEV2
**Owner**: Platform Engineering
**Last Updated**: 2026-08-10
**Status**: Tested in Staging

## Overview

A memory leak in the Node.js process causes heap usage to grow continuously
until the process is terminated by the runtime or the container is OOMKilled.
Common causes in DeepMindQ include growing in-memory caches, unclosed database
connections, accumulated AI context tracking data, and large dataset operations.
The `memory-resource-monitor.ts` module provides leak detection and heap
monitoring capabilities.

## Detection

### Alert Indicators

| Source | Metric | Threshold | Severity |
|--------|--------|-----------|----------|
| monitoring.ts | `system.memory.percent` | > 85% (warning), > 85% alert rule | critical |
| Prometheus | `deepmindq_heap_usage_percent` | > 85% warning, > 95% critical | SEV2/SEV1 |
| Prometheus | `deepmindq_memory_growth_rate_mb_per_min` | > 10 MB/min | SEV2 |
| memory-resource-monitor.ts | `estimatedLeak: true` | 100MB growth in 10 min | SEV2 |
| Container | OOMKilled restart | Process killed by kernel | SEV1 |
| Sentry | `heap out of memory` errors | Any occurrence | SEV1 |

### Key Configuration Constants (memory-resource-monitor.ts)

```
LEAK_DETECTION_THRESHOLD_MB = 100    // 100MB growth in 10 min triggers leak warning
LEAK_CHECK_WINDOW_MS       = 600000 // 10-minute window for growth analysis
HEAP_WARNING_THRESHOLD     = 85     // 85% = log warning
HEAP_CRITICAL_THRESHOLD    = 95     // 95% = log critical + recommendations
MAX_SNAPSHOT_HISTORY       = 60     // Keep 60 memory snapshots
MAX_AI_CONTEXT_HISTORY     = 1000   // Max tracked AI contexts
MAX_DATASET_HISTORY        = 500    // Max tracked dataset operations
```

### Prometheus Metrics

```
deepmindq_heap_usage_percent                  # Current heap usage %
deepmindq_memory_growth_rate_mb_per_min        # Memory growth rate
deepmindq_memory_usage_bytes                   # RSS memory in bytes
deepmindq_ai_active_contexts                    # Active AI processing contexts
deepmindq_gc_collections_total                  # GC collections (approximate)
deepmindq_event_loop_lag_ms                     # Event loop lag indicator
```

## Immediate Response (First 5 Minutes)

1. **Assess the severity**:
   ```bash
   # Check current heap usage
   curl -s https://deepmindq.io/api/health/metrics | rg 'deepmindq_heap_usage_percent'

   # Check growth rate
   curl -s https://deepmindq.io/api/health/metrics | rg 'deepmindq_memory_growth_rate_mb_per_min'

   # Check active AI contexts (stuck contexts consume memory)
   curl -s https://deepmindq.io/api/health/metrics | rg 'deepmindq_ai_active_contexts'
   ```

2. **Create an incident** (SEV2 for leak detected, SEV1 if OOMKilled):
   ```bash
   curl -X POST https://deepmindq.io/api/incidents \
     -H 'Content-Type: application/json' \
     -d '{
       "action": "create",
       "title": "Memory Leak Detected",
       "severity": "SEV2",
       "description": "Heap at X%, growth rate Y MB/min",
       "author": "on-call-engineer"
     }'
   ```

3. **Get the full memory health report**:
   ```bash
   # getMemoryHealth() returns comprehensive report including
   # leak detection, AI context stats, large dataset stats, recommendations
   curl -s https://deepmindq.io/api/monitoring | jq '.memoryHealth'
   ```

4. **If heap > 95% or OOMKilled, prepare for emergency restart** (see Resolution).

## Diagnosis

### Step 1: Review Memory Health Report

The `getMemoryHealth()` function in `memory-resource-monitor.ts` returns:

```json
{
  "currentHeapUsedMb": 450.5,
  "currentHeapTotalMb": 512.0,
  "currentRssMb": 580.2,
  "heapUsagePercentage": 88.0,
  "memoryGrowthRateMbPerMin": 12.5,
  "estimatedLeak": true,
  "leakReason": "Memory grew 125.0MB in 10min (12.50MB/min rate)",
  "aiContextStats": {
    "activeContexts": 45,
    "avgContextSizeTokens": 8000,
    "maxContextSizeTokens": 32000,
    "totalProcessedLastHour": 250
  },
  "largeDatasetStats": {
    "activeOperations": 3,
    "avgRecordCount": 5000,
    "maxRecordCount": 25000,
    "totalOperationsLastHour": 15
  },
  "processUptimeMin": 120.5,
  "gcCount": 0,
  "recommendations": [
    "Potential memory leak detected. Review recent deployments and long-running processes.",
    "High number of active AI contexts. Check for stuck operations."
  ]
}
```

### Step 2: Identify the Leak Source

#### A. AI Context Leak

If `aiContextStats.activeContexts` is high (> 50) or growing:

- AI contexts are tracked via `startAIContextTracking()` and `endAIContextTracking()`
  in `memory-resource-monitor.ts`.
- A stuck context means `endAIContextTracking()` was never called for that operation.
- Check `aiContextHistory` for long-running operations.

```bash
# Check AIUsageLog for stuck operations (high duration_ms)
psql $DATABASE_URL -c "
  SELECT id, feature, provider, duration_ms, status, "createdAt"
  FROM \"AIUsageLog\"
  WHERE duration_ms > 60000  -- > 1 minute
  ORDER BY duration_ms DESC
  LIMIT 20;
"
```

#### B. Large Dataset Operation Leak

If `largeDatasetStats.activeOperations` is high (> 10):

- Large datasets are tracked via `startLargeDatasetTracking()` and
  `endLargeDatasetTracking()` in `memory-resource-monitor.ts`.
- Operations with > 10,000 records trigger a warning log.

```bash
# Check for large import/export/batch operations
psql $DATABASE_URL -c "
  SELECT id, type, status, count("id")
  FROM (
    SELECT id, 'import' as type, status FROM \"ImportRecord\" WHERE \"createdAt\" > now() - interval '1 hour'
    UNION ALL
    SELECT id, 'export' as type, status FROM \"ExportRecord\" WHERE \"createdAt\" > now() - interval '1 hour'
    UNION ALL
    SELECT id, 'batch' as type, status FROM \"Batch\" WHERE \"createdAt\" > now() - interval '1 hour'
  ) ops
  GROUP BY id, type, status
  ORDER BY count DESC
  LIMIT 10;
"
```

#### C. Cache/Memory Map Growth

The platform uses several in-memory data structures:

- `MetricsCollector` in `monitoring.ts` — max 10,000 points (auto-trims)
- `metricsBuffer` in `database-performance-monitor.ts` — max 10,000 entries
- `memorySnapshots` in `memory-resource-monitor.ts` — max 60 entries
- `aiContextHistory` — max 1,000 entries
- `largeDatasetHistory` — max 500 entries
- `activePromptVersions` Map in `ai-tracing.ts` — unbounded (should be small)
- Circuit breaker state in `search-provider-fallback.ts` — bounded per provider
- Incidents Map in `incident-manager.ts` — max 1,000 entries (auto-evicts)

#### D. Recent Deployment

```bash
# Check if a recent deployment coincides with leak onset
vercel deployments --limit 5

# If the leak started after a specific deploy, the deploy likely introduced it
```

### Step 3: Generate a Heap Snapshot (Self-Hosted Only)

```bash
# Generate a heap snapshot for analysis
docker exec deepmindq-blue node -e "
  const v8 = require('v8');
  const fs = require('fs');
  const stream = v8.getHeapSnapshot();
  stream.pipe(fs.createWriteStream('/tmp/heapdump.heapsnapshot'));
  console.log('Heap snapshot written to /tmp/heapdump.heapsnapshot');
"

# Copy the snapshot out for analysis
docker cp deepmindq-blue:/tmp/heapdump.heapsnapshot ./heapdump-$(date +%s).heapsnapshot

# Analyze with Chrome DevTools: Open chrome://inspect → Load → Select the file
```

## Resolution

### Option A: Force Garbage Collection (Node.js)

If `--expose-gc` flag is available (self-hosted):

```bash
docker exec deepmindq-blue node -e "
  if (global.gc) {
    global.gc();
    console.log('GC forced');
  } else {
    console.log('GC not exposed. Restart with --expose-gc flag.');
  }
"
```

Note: In Vercel serverless, you cannot force GC. The runtime manages GC.

### Option B: Application Restart (Recommended)

The most reliable fix for a memory leak in production:

```bash
# Vercel: redeploy (creates fresh function instances)
vercel --prod

# Self-hosted: restart the container
docker restart deepmindq-blue
```

After restart, the in-memory state will be rebuilt:
- Incidents are restored from `SystemSetting` via `incidentManager.loadIncidents()`
- Metrics collection starts fresh (historical data preserved in DB snapshots)
- AI context and dataset tracking starts empty

### Option C: Clear Stuck AI Contexts

If the leak is specifically from stuck AI contexts:

```bash
# Clear all active AI context tracking (in-memory only)
# This requires a code change or endpoint — redeployment is simpler
# Alternatively, the memory-resource-monitor.resetMemoryMonitor() clears all state
```

### Option D: Fix the Leak (Code Change)

Once the leak source is identified:

1. Add proper cleanup in the identified code path
2. Ensure all `startAIContextTracking()` calls have matching `endAIContextTracking()`
3. Ensure all `startLargeDatasetTracking()` calls have matching `endLargeDatasetTracking()`
4. Add bounds checks to any Maps/Arrays that may grow unbounded
5. Deploy the fix: `vercel --prod`

## Verification

1. **Heap usage returns to baseline**:
   ```bash
   curl -s https://deepmindq.io/api/health/metrics | rg 'deepmindq_heap_usage_percent'
   # Should be < 70% after restart
   ```

2. **Growth rate returns to near-zero**:
   ```bash
   curl -s https://deepmindq.io/api/health/metrics | rg 'deepmindq_memory_growth_rate_mb_per_min'
   # Should be < 2 MB/min (normal for growing caches)
   ```

3. **Memory health report shows no leak**:
   ```bash
   curl -s https://deepmindq.io/api/monitoring | jq '.memoryHealth.estimatedLeak'
   # Expected: false
   ```

4. **Active AI contexts return to normal**:
   ```bash
   curl -s https://deepmindq.io/api/health/metrics | rg 'deepmindq_ai_active_contexts'
   # Should be < 20 during normal operation
   ```

5. **Monitor for 30 minutes** to confirm growth rate stays flat.

6. **Check for OOMKilled restarts** (self-hosted):
   ```bash
   docker inspect deepmindq-blue --format='{{.State.OOMKilled}}'
   # Expected: false
   docker inspect deepmindq-blue --format='{{.RestartCount}}'
   # Should not be increasing
   ```

## Escalation

| Condition | Action | Timeline |
|-----------|--------|----------|
| OOMKilled (process crash) | Escalate to SEV1 | Immediately |
| Leak persists after restart | Page Engineering Lead | 30 min |
| Heap snapshot analysis needed | Engage performance specialist | 1 hour |
| Leak source unidentified > 2 hours | Escalate to SEV1 | 2 hours |

## Prevention

### Short-Term

- **Add automated restart on OOM**: Configure container orchestrator to
  automatically restart on OOMKilled, and alert.

- **Set memory limits**: Ensure Vercel function memory limit is set
  appropriately (default 1024MB, increase if needed).

### Medium-Term

- **Memory leak detection in CI**: Add a test that runs a workload and
  checks that heap usage doesn't grow beyond a threshold.

- **Regular heap snapshots**: Schedule periodic heap snapshots (e.g., every
  30 minutes) and compare to detect gradual growth.

### Long-Term

- **Memory-aware architecture**: Replace large in-memory caches with
  database-backed or Redis-backed alternatives.

- **Automated scaling**: Implement horizontal autoscaling that adds
  instances when memory pressure is detected.

## Related

- **Memory Resource Monitor**: `src/lib/memory-resource-monitor.ts` —
  `getMemoryHealth()`, `analyzeMemoryGrowth()`, `takeMemorySnapshot()`,
  `startAIContextTracking()`, `endAIContextTracking()`,
  `startLargeDatasetTracking()`, `endLargeDatasetTracking()`,
  `resetMemoryMonitor()`, leak detection thresholds
- **AI Tracing**: `src/lib/ai-tracing.ts` — `activePromptVersions` Map,
  `recordAITrace()` for AI operation tracking
- **Monitoring**: `src/lib/monitoring.ts` — `system.memory.percent` alert rule,
  `collectSystemMetrics()`, `MetricsCollector` (max 10,000 points)
- **Database Performance Monitor**: `src/lib/database-performance-monitor.ts` —
  `metricsBuffer` (max 10,000 entries)
- **Metrics Endpoint**: `src/app/api/health/metrics/route.ts` —
  `deepmindq_heap_usage_percent`, `deepmindq_memory_growth_rate_mb_per_min`,
  `deepmindq_ai_active_contexts`
- **Incident Manager**: `src/lib/incident-manager.ts` —
  `incidents` Map (max 1,000 entries), auto-eviction
- **Search Fallback**: `src/lib/search-provider-fallback.ts` —
  In-memory LRU cache (max 1,000 entries, 1hr TTL)
- **Incident Response**: `docs/incident-response.md` — Section 3.3 Memory Leak / OOM
