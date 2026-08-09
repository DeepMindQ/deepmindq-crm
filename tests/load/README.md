# DeepMindQ Load Testing & Capacity Planning Suite (10.2)

Pure Node.js load testing — no external binaries (k6, autocannon) required.
Uses the built-in `http` module for concurrent HTTP flooding.

## Prerequisites

- Node.js 20+
- The Next.js dev server running (`bun run dev`)

## Quick Start

```bash
# Default: runs the quick suite (health, auth, dashboard, companies, ai, mixed)
node tests/load/load-test.js

# Run all 10 scenarios (includes ramp-up, spike, endurance, soak)
node tests/load/load-test.js --all

# Run a specific scenario
node tests/load/load-test.js health
node tests/load/load-test.js spike

# List all available scenarios
node tests/load/load-test.js --list

# Target a different server
LOAD_TEST_URL=http://localhost:8080 node tests/load/load-test.js health

# Custom request timeout (default: 10s)
LOAD_TEST_TIMEOUT=30000 node tests/load/load-test.js ai
```

## Scenarios

| Scenario   | Endpoint              | Target RPS | Duration | Description                            |
|------------|-----------------------|------------|----------|----------------------------------------|
| `health`   | GET /api/health       | 1000       | 30s      | Health endpoint throughput             |
| `auth`     | POST /api/auth/login  | 100        | 60s      | Authentication endpoint load           |
| `dashboard`| GET /api/dashboard/stats | 200     | 30s      | Dashboard stats endpoint load          |
| `companies`| GET /api/companies    | 150        | 30s      | Company listing endpoint load          |
| `ai`       | POST /api/ai/chat     | 50         | 60s      | AI advisor endpoint load               |
| `mixed`    | 8 endpoints weighted  | 300        | 60s      | Proportional mixed traffic             |
| `rampup`   | GET /api/health       | 10-500     | 5min     | Gradual ramp from 10 to 500 connections|
| `spike`    | GET /api/dashboard/stats | 50-500  | 2min     | Sudden 10x spike test                  |
| `endurance`| GET /api/companies    | 200        | 10min    | Sustained load endurance test          |
| `soak`     | GET /api/health       | 50         | 30min    | Long-duration soak test                |

## Metrics Collected

For each scenario:

- **Total requests** / successful / failed
- **Requests per second** (actual)
- **Average latency** (ms)
- **P50 / P95 / P99 latency** (ms)
- **Min / Max latency** (ms)
- **Error rate** (%)
- **Timeouts** (count)
- **Max concurrent connections**

## Capacity Planning

After running load tests, analyze the results:

```bash
# Analyze the latest results file
node tests/load/capacity-model.js

# Analyze a specific results file
node tests/load/capacity-model.js tests/load/results/load-test-<timestamp>.json
```

The capacity model:

- Grades each scenario (A through F)
- Projects infrastructure needs for 100, 500, 1000, and 5000 users
- Estimates CPU cores, RAM, and instance counts
- Flags capacity bottlenecks and memory leak indicators
- Generates actionable recommendations

## Output

Results are saved to `tests/load/results/` as:

- `load-test-<timestamp>.json` — raw metrics for all scenarios
- `load-test-<timestamp>.txt` — human-readable summary
- `capacity-report-<timestamp>.json` — full capacity planning report
