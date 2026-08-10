# RB-003: LLM Provider Outage

**Severity**: SEV2
**Owner**: Platform Engineering
**Last Updated**: 2026-08-10
**Status**: Tested in Staging

## Overview

When one or more LLM providers (nvidia, fireworks, groq, gemini) experience an
outage or degradation, AI-powered features such as intelligence research,
reasoning, and recommendation engines may fail or degrade. The platform's
`search-provider-fallback.ts` implements a circuit breaker pattern that
automatically fails over to the next provider in the chain, but full chain
failure results in degraded mode with empty results.

## Detection

### Alert Indicators

| Source | Metric/Signal | Threshold |
|--------|--------------|-----------|
| monitoring.ts | `ai.request.duration` | > 10000ms (alert rule `ai-latency`) |
| Prometheus | `deepmindq_ai_provider_circuit_breaker_open` | > 0 (any provider open) |
| Prometheus | `deepmindq_ai_provider_errors_total` | Sudden spike |
| Prometheus | `deepmindq_ai_provider_calls_total` | Drop to near-zero |
| search-provider-fallback.ts | `isDegraded: true` | Any search returns degraded |
| ai-tracing.ts | High `failedRequests` in cost report | Spike in failures |

### Provider-Specific Status Pages

- NVIDIA NIM: https://build.nvidia.com/status
- Fireworks AI: https://fireworks.ai/status
- Groq: https://status.groq.com
- Google Gemini: https://status.cloud.google.com

## Immediate Response (First 5 Minutes)

1. **Confirm the outage scope** — check which providers are affected:
   ```bash
   # Check Prometheus for circuit breaker state
   curl -s https://deepmindq.io/api/health/metrics | rg 'deepmindq_ai_provider_circuit_breaker_open'
   # Value > 0 means at least one provider's circuit is open

   # Check AI provider error count
   curl -s https://deepmindq.io/api/health/metrics | rg 'deepmindq_ai_provider_errors_total'
   ```

2. **Check ModelRouter performance stats** per provider:
   ```bash
   # ModelRouter.getPerformanceStats() exposes per-provider call/fail counts
   curl -s https://deepmindq.io/api/health/metrics | rg 'deepmindq_ai_provider'
   ```

3. **Check the fallback chain status**:
   ```bash
   # The search-provider-fallback.ts getFallbackStatus() exposes per-provider
   # circuit state, failure counts, and average latency
   curl -s https://deepmindq.io/api/monitoring | jq '.fallbackStatus'
   ```

4. **Create an incident** if AI features are materially degraded:
   ```bash
   curl -X POST https://deepmindq.io/api/incidents \
     -H 'Content-Type: application/json' \
     -d '{
       "action": "create",
       "title": "LLM Provider Outage",
       "severity": "SEV2",
       "description": "Circuit breaker open on one or more AI providers",
       "author": "on-call-engineer"
     }'
   ```

5. **Check provider status pages** for known incidents.

## Diagnosis

### Step 1: Identify Which Provider(s) Are Failing

The `ModelRouter` in `src/lib/engines/model-router.ts` maintains per-provider
stats accessible via `ModelRouter.getPerformanceStats()`. This returns an array
with each provider's `totalCalls`, `failedCalls`, and `circuitOpen` state.

```bash
curl -s https://deepmindq.io/api/health/metrics | rg 'deepmindq_ai_provider'
```

Cross-reference with `search-provider-fallback.ts`:
- `getFallbackStatus().providers[].circuitState` — `"closed"` (healthy),
  `"open"` (failing), `"half_open"` (probing)
- `getFallbackStatus().providers[].failureCount` — consecutive failures
- `getFallbackStatus().providers[].avgLatencyMs` — rolling average latency

### Step 2: Verify Fallback Chain Order

The fallback chain in `search-provider-fallback.ts` is configured via the
`providers` array in `SearchFallbackConfig`:

```
Default chain: ["primary", "web_reader", "cache"]
```

For AI LLM calls, the `ModelRouter` uses its own provider selection logic.
The standard provider priority is:

```
nvidia → fireworks → groq → gemini
```

### Step 3: Check API Key Validity

Verify that API keys for each provider are set and valid:

| Provider | Environment Variable | Status Page |
|----------|---------------------|-------------|
| NVIDIA | `NVIDIA_API_KEY` | https://build.nvidia.com/status |
| Fireworks | `FIREWORKS_API_KEY` | https://fireworks.ai/status |
| Groq | `GROQ_API_KEY` | https://status.groq.com |
| Gemini | `GEMINI_API_KEY` | https://status.cloud.google.com |

```bash
# Test a specific provider directly (example for Groq):
curl -s -H "Authorization: Bearer $GROQ_API_KEY" \
  https://api.groq.com/openai/v1/models | jq '.data[].id' | head -5
```

### Step 4: Check AI Tracing Cost Report

```bash
# Generate a cost report for the last 24 hours via ai-tracing.ts
# (exposed through admin API or direct DB query)
# This shows failure rates by model and capability
psql $DATABASE_URL -c "
  SELECT provider, model, status, count(*), avg(duration_ms)
  FROM \"AIUsageLog\"
  WHERE \"createdAt\" > now() - interval '1 hour'
  GROUP BY provider, model, status
  ORDER BY count(*) DESC;
"
```

### Step 5: Determine Outage Type

| Symptom | Cause | Action |
|---------|-------|--------|
| Single provider failing | Provider-side outage | Wait for resolution, fallback active |
| All providers failing | API key rotation needed | Check keys, rotate if expired |
| Intermittent failures | Rate limiting | Reduce request rate, request limit increase |
| Timeout-only errors | Network/firewall issue | Check egress rules |
| Auth errors only | API key invalid/expired | Rotate keys immediately |

## Resolution

### Option A: Wait for Automatic Fallback (Degraded but Functional)

If only the primary provider is down, the circuit breaker in
`search-provider-fallback.ts` will:
1. Open the circuit after `circuitBreakerThreshold` (default: 3) consecutive failures
2. Route to the next provider in the chain automatically
3. After `circuitBreakerResetMs` (default: 300000 = 5 min), enter half-open state
4. If the probe succeeds, close the circuit

**Action**: Monitor the situation. No manual intervention needed unless
all providers fail.

### Option B: Manually Reset a Circuit Breaker

If a provider has recovered but the circuit remains open:

The `SearchProvider` interface exposes `resetCircuit()` on each provider.
This is not directly exposed via an API endpoint — you need to redeploy
or implement a reset endpoint:

```bash
# Redeploy to reset all circuit breaker state (they are in-memory)
vercel --prod
```

### Option C: Rotate an Expired API Key

If the outage is due to an expired or invalid API key:

1. Generate a new API key from the provider's dashboard
2. Update the environment variable in Vercel:
   ```bash
   vercel env rm GROQ_API_KEY production
   vercel env add GROQ_API_KEY production
   # Paste the new key
   ```
3. **Redeploy** for the new key to take effect:
   ```bash
   vercel --prod
   ```
4. Reset the circuit breaker via redeploy (see Option B).

### Option D: Force Disable a Bad Provider

If a provider is consistently failing and draining resources:

1. Set the environment variable to disable it:
   ```
   GROQ_API_KEY=disabled
   ```
2. The ModelRouter will skip providers with invalid/missing keys.
3. Redeploy for changes to take effect.

## Verification

1. **Circuit breakers are closed**:
   ```bash
   curl -s https://deepmindq.io/api/health/metrics | rg 'deepmindq_ai_provider_circuit_breaker_open'
   # Expected: deepmindq_ai_provider_circuit_breaker_open 0
   ```

2. **Error rate has normalized**:
   ```bash
   curl -s https://deepmindq.io/api/health/metrics | rg 'deepmindq_ai_provider_errors_total'
   # Should not be increasing
   ```

3. **AI features are functional**: Test an actual AI operation:
   - Navigate to the intelligence dashboard in the UI
   - Trigger a manual intelligence refresh on a test company
   - Verify the response contains non-empty results

4. **Cost report shows recovery**:
   ```bash
   # Check that failedRequests is decreasing
   # Via AIUsageLog query (see Diagnosis Step 4)
   ```

5. **Fallback chain fully operational**: Confirm all providers show
   `healthy: true` and `circuitState: "closed"`.

## Escalation

| Condition | Action | Timeline |
|-----------|--------|----------|
| All 4 providers down | Page AI/ML Lead + VP Engineering | Immediately |
| Single provider down > 30 min | Notify AI/ML Lead | 30 min |
| Rate limit hit on all providers | Request limit increase from providers | 1 hour |
| Provider outage > 2 hours | Consider temporary feature disable | 2 hours |

## Prevention

### Short-Term

- **Add per-provider alerting** in Grafana:
  ```
  alert: AIProviderCircuitOpen
  expr: deepmindq_ai_provider_circuit_breaker_open > 0
  for: 1m
  labels:
    severity: warning
  annotations:
    summary: "AI provider circuit breaker is open"
  ```

- **Set up provider status monitoring**: Create uptime checks against each
  provider's status page API.

### Medium-Term

- **API key rotation automation**: Implement scheduled key rotation with
  zero-downtime key rollover.

- **Add a circuit breaker reset API endpoint**: Expose `resetCircuit()`
  via a protected admin endpoint to avoid redeployment.

### Long-Term

- **Multi-region provider redundancy**: Configure providers in multiple
  cloud regions to avoid single-region outages.

- **Local model fallback**: For critical capabilities, maintain a small
  local model (e.g., via Vercel Edge inference) as a last-resort fallback.

## Related

- **Search Provider Fallback**: `src/lib/search-provider-fallback.ts` —
  Circuit breaker pattern, fallback chain, `getFallbackStatus()`,
  `SearchProvider.resetCircuit()`, `SearchMetrics`
- **AI Tracing**: `src/lib/ai-tracing.ts` — `getAICostReport()`,
  `recordAITrace()`, model cost estimation
- **Model Router**: `src/lib/engines/model-router.ts` —
  `ModelRouter.getPerformanceStats()`, provider selection logic
- **Metrics Endpoint**: `src/app/api/health/metrics/route.ts` —
  `deepmindq_ai_provider_*` Prometheus metrics
- **Monitoring**: `src/lib/monitoring.ts` — `ai-latency` alert rule (> 10000ms)
- **Incident Response**: `docs/incident-response.md` — Section 3.4 AI Service Provider Outage
- **Environment Config**: `docs/ENVIRONMENT_CONFIGURATION.md` — API key variables
