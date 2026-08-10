# DeepMindQ Load Testing Suite (k6)

## Prerequisites
- Install k6: https://k6.io/docs/getting-started/installation/
- Start the application: `npm run dev`
- Set env vars (optional): `BASE_URL`, `API_KEY`, `AUTH_TOKEN`

## Running Tests

### Baseline (1000 req/min for 5 minutes)
```bash
k6 run tests/load/k6/baseline.js
```

### Spike (ramp to 500 VUs, sustain 60s, recover)
```bash
k6 run tests/load/k6/spike.js
```

### Endurance (100 VUs for 30 minutes, memory leak detection)
```bash
k6 run tests/load/k6/endurance.js
```

### AI Pipeline (50 concurrent AI queries)
```bash
k6 run tests/load/k6/ai-pipeline.js
```

## SLA Thresholds
| Category      | P95 Target | P99 Target | Error Rate |
|---------------|-----------|-----------|------------|
| CRUD ops      | < 500ms   | < 3s      | < 1%       |
| AI generation | < 3s      | < 10s     | < 5%       |
| Spike         | < 500ms   | < 3s      | < 5%       |
| Endurance     | < 600ms   | < 3s      | < 1%       |

## Output Analysis
- Check `p(95)` and `p(99)` latency metrics in k6 output
- For endurance: compare first 5min p95 vs last 5min p95 (increasing trend = memory leak)
- For spike: verify recovery time after VUs drop back to 50
