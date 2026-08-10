# DeepMindQ Monitoring Stack

## Quick Start

### 1. Start Prometheus

```bash
docker run -d \
  --name prometheus \
  -p 9090:9090 \
  -v $(pwd)/monitoring/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml \
  -v $(pwd)/monitoring/prometheus/alerts.yml:/etc/prometheus/alerts.yml \
  prom/prometheus \
  --config.file=/etc/prometheus/prometheus.yml \
  --web.enable-lifecycle
```

To load alert rules, add to `prometheus.yml` under `global`:

```yaml
rule_files:
  - /etc/prometheus/alerts.yml
```

### 2. Import Dashboards into Grafana

1. Start Grafana (e.g., `docker run -d --name=grafana -p 3001:3000 grafana/grafana`)
2. Add Prometheus as a data source (URL: `http://host.docker.internal:9090` or `http://prometheus:9090` if on the same Docker network)
3. Go to **Dashboards > Import**
4. Upload the JSON files from `monitoring/grafana/dashboards/`:
   - `system-health.json`
   - `api-performance.json`
   - `ai-cost.json`
   - `ai-performance.json`
   - `database-health.json`
   - `business-metrics.json`
5. When prompted, select your Prometheus datasource

Alternatively, use Grafana's file provisioning — place the JSON files in a directory and configure `monitoring/grafana/provisioning/dashboards.yml` to point to them.

## Dashboard Overview

| Dashboard | UID | Description |
|---|---|---|
| **System Health** | `deepmindq-system-health` | Process uptime, heap usage %, RSS memory, event loop lag, GC collections, active incidents, SLA breaches |
| **API Performance** | `deepmindq-api-performance` | Request rate, error rate, P50/P95 latency gauges, error ratio, latency trends with threshold lines |
| **AI Provider Cost** | `deepmindq-ai-cost` | Total AI calls, errors, circuit breaker status, call throughput, cost estimation table |
| **AI Performance** | `deepmindq-ai-performance` | Active AI contexts, call throughput, circuit breaker status, error rate; placeholders for quality metrics |
| **Database Health** | `deepmindq-database-health` | Connection pool gauge, query latency P50/P95/P99 with threshold lines, QPS, slow queries |
| **Business Metrics** | `deepmindq-business-metrics` | Request volume, AI utilization ratio, incident pipeline health, memory/DB/event-loop capacity gauges |

## Prometheus Alert Rules

The alerts in `monitoring/prometheus/alerts.yml` map to the application's internal monitoring (`src/lib/monitoring.ts`) as follows:

| Prometheus Alert | Severity | Expression | Internal Equivalent |
|---|---|---|---|
| `HighErrorRate` | critical | `rate(errors_total[5m]) > 0.1` | `monitoring.ts` — API error rate check |
| `HighMemoryUsage` | critical | `heap_usage_percent > 85` | `memory-resource-monitor.ts` — heap threshold |
| `SlowDatabaseQueries` | warning | `db_query_latency_p95_ms > 200` | `database-performance-monitor.ts` — slow query detection |
| `HighAILatency` | warning | `circuit_breaker_open > 0` | `model-router.ts` — circuit breaker state |
| `MemoryLeakDetected` | warning | `memory_growth_rate > 10 MB/min` | `memory-resource-monitor.ts` — growth rate analysis |
| `DatabaseConnectionExhaustion` | critical | `active >= max * 0.9` | `database-enterprise-monitor.ts` — pool pressure |

## Metrics Endpoint

All metrics are exposed at:

```
GET /api/health/metrics
```

This returns Prometheus text format (Content-Type: `text/plain; version=0.0.4`). No authentication is required, consistent with standard Prometheus scraping conventions.
