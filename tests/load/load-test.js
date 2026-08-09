/**
 * DeepMindQ Load Testing & Capacity Planning Suite (10.2)
 *
 * Pure Node.js load testing - no external binaries (k6, autocannon) required.
 * Uses built-in `http` module for concurrent HTTP flooding.
 *
 * Usage:
 *   node tests/load/load-test.js [scenario]
 *   node tests/load/load-test.js --all
 *   node tests/load/load-test.js health
 *   node tests/load/load-test.js --list
 */

'use strict';

const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = process.env.LOAD_TEST_URL || 'http://localhost:3000';
const RESULTS_DIR = path.join(__dirname, 'results');
const TIMEOUT_MS = parseInt(process.env.LOAD_TEST_TIMEOUT || '10000', 10);

const SCENARIOS = {
  health: {
    name: 'Health Endpoint Load Test',
    description: 'Blast /api/health at 1000 req/s for 30 seconds',
    endpoint: '/api/health',
    method: 'GET',
    body: null,
    headers: {},
    targetRps: 1000,
    durationSec: 30,
    connections: 50,
  },
  auth: {
    name: 'Auth Login Load Test',
    description: 'POST /api/auth/login at 100 req/s for 60 seconds',
    endpoint: '/api/auth/login',
    method: 'POST',
    body: JSON.stringify({ email: 'loadtest@deepmindq.dev', password: 'LoadTest2024!' }),
    headers: { 'Content-Type': 'application/json' },
    targetRps: 100,
    durationSec: 60,
    connections: 20,
  },
  dashboard: {
    name: 'Dashboard API Load Test',
    description: 'GET /api/dashboard/stats at 200 req/s for 30 seconds',
    endpoint: '/api/dashboard/stats',
    method: 'GET',
    body: null,
    headers: {},
    targetRps: 200,
    durationSec: 30,
    connections: 30,
  },
  companies: {
    name: 'Companies API Load Test',
    description: 'GET /api/companies at 150 req/s for 30 seconds',
    endpoint: '/api/companies',
    method: 'GET',
    body: null,
    headers: {},
    targetRps: 150,
    durationSec: 30,
    connections: 25,
  },
  ai: {
    name: 'AI Advisor Load Test',
    description: 'POST /api/ai/chat at 50 req/s for 60 seconds',
    endpoint: '/api/ai/chat',
    method: 'POST',
    body: JSON.stringify({
      message: 'What are the key buying signals for enterprise accounts?',
      context: { companyId: 'load-test-company' },
    }),
    headers: { 'Content-Type': 'application/json' },
    targetRps: 50,
    durationSec: 60,
    connections: 15,
  },
  mixed: {
    name: 'Mixed Traffic Scenario',
    description: 'Proportional mix of all endpoints over 60 seconds',
    endpoints: [
      { endpoint: '/api/health', method: 'GET', body: null, headers: {}, weight: 0.30 },
      { endpoint: '/api/dashboard/stats', method: 'GET', body: null, headers: {}, weight: 0.20 },
      { endpoint: '/api/companies', method: 'GET', body: null, headers: {}, weight: 0.15 },
      { endpoint: '/api/leads', method: 'GET', body: null, headers: {}, weight: 0.10 },
      { endpoint: '/api/contacts', method: 'GET', body: null, headers: {}, weight: 0.10 },
      { endpoint: '/api/signals', method: 'GET', body: null, headers: {}, weight: 0.05 },
      { endpoint: '/api/pipeline', method: 'GET', body: null, headers: {}, weight: 0.05 },
      { endpoint: '/api/recommendations', method: 'GET', body: null, headers: {}, weight: 0.05 },
    ],
    targetRps: 300,
    durationSec: 60,
    connections: 40,
  },
  rampup: {
    name: 'Ramp-Up Test',
    description: '10 to 500 concurrent users over 5 minutes',
    endpoint: '/api/health',
    method: 'GET',
    body: null,
    headers: {},
    rampUp: true,
    startConnections: 10,
    endConnections: 500,
    durationSec: 300,
  },
  spike: {
    name: 'Spike Test',
    description: 'Sudden 10x traffic spike - 50 to 500 to 50 req/s',
    endpoint: '/api/dashboard/stats',
    method: 'GET',
    body: null,
    headers: {},
    spike: true,
    baselineRps: 50,
    spikeRps: 500,
    spikeDurationSec: 30,
    totalDurationSec: 120,
    connections: 60,
  },
  endurance: {
    name: 'Endurance Test',
    description: 'Sustained 200 req/s for 10 minutes',
    endpoint: '/api/companies',
    method: 'GET',
    body: null,
    headers: {},
    targetRps: 200,
    durationSec: 600,
    connections: 40,
  },
  soak: {
    name: 'Soak Test',
    description: '50 req/s for 30 minutes to detect memory leaks',
    endpoint: '/api/health',
    method: 'GET',
    body: null,
    headers: {},
    targetRps: 50,
    durationSec: 1800,
    connections: 20,
  },
};

// ─── Utility: Statistics ─────────────────────────────────────────────────────

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function computeStats(latencies, errors, timeouts, totalDurationSec, maxConcurrent) {
  const sorted = [...latencies].sort((a, b) => a - b);
  const total = latencies.length + errors + timeouts;
  const errorRate = total > 0 ? ((errors + timeouts) / total) * 100 : 0;
  const sum = sorted.reduce((a, b) => a + b, 0);
  const avg = sorted.length > 0 ? sum / sorted.length : 0;

  return {
    totalRequests: total,
    successfulRequests: latencies.length,
    failedRequests: errors,
    timeouts,
    requestsPerSecond: Math.round((total / totalDurationSec) * 100) / 100,
    avgLatencyMs: Math.round(avg * 100) / 100,
    p50LatencyMs: percentile(sorted, 50),
    p95LatencyMs: percentile(sorted, 95),
    p99LatencyMs: percentile(sorted, 99),
    maxLatencyMs: sorted.length > 0 ? sorted[sorted.length - 1] : 0,
    minLatencyMs: sorted.length > 0 ? sorted[0] : 0,
    errorRatePct: Math.round(errorRate * 100) / 100,
    maxConcurrentConnections: maxConcurrent,
    totalDurationSec: Math.round(totalDurationSec * 100) / 100,
  };
}

// ─── HTTP Request Runner ─────────────────────────────────────────────────────

function makeRequest(url, method, headers, body) {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    const parsedUrl = new URL(url);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method || 'GET',
      headers: {
        Connection: 'keep-alive',
        ...headers,
      },
      timeout: TIMEOUT_MS,
    };

    const req = http.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const end = process.hrtime.bigint();
        const latencyMs = Number(end - start) / 1e6;
        resolve({ latencyMs, statusCode: res.statusCode, error: null, timeout: false });
      });
    });

    req.on('error', (err) => {
      const end = process.hrtime.bigint();
      const latencyMs = Number(end - start) / 1e6;
      resolve({ latencyMs, statusCode: 0, error: err.message, timeout: false });
    });

    req.on('timeout', () => {
      req.destroy();
      const end = process.hrtime.bigint();
      const latencyMs = Number(end - start) / 1e6;
      resolve({ latencyMs, statusCode: 0, error: 'ETIMEDOUT', timeout: true });
    });

    if (body) req.write(body);
    req.end();
  });
}

// ─── Single-Endpoint Flood Runner ─────────────────────────────────────────────

async function runFloodTest(config) {
  const { endpoint, method, body, headers, targetRps, durationSec, connections } = config;
  const url = `${BASE_URL}${endpoint}`;
  const latencies = [];
  let errors = 0;
  let timeouts = 0;
  const intervalMs = 1000 / targetRps;
  const startTime = Date.now();
  const endTime = startTime + durationSec * 1000;

  console.log(
    `  [FLOOD] Target: ${targetRps} req/s | Duration: ${durationSec}s | Conns: ${connections} | ${method} ${endpoint}`
  );

  const inFlight = new Set();

  while (Date.now() < endTime) {
    const batchDeadline = Date.now() + Math.min(intervalMs, 100);
    let firedInBatch = 0;
    const maxBatch = Math.max(1, Math.ceil(targetRps / 10));

    while (firedInBatch < maxBatch && Date.now() < batchDeadline && Date.now() < endTime) {
      if (inFlight.size >= connections) {
        await Promise.race(inFlight);
        continue;
      }

      const p = makeRequest(url, method, headers, body).then((result) => {
        inFlight.delete(p);
        if (result.timeout) {
          timeouts++;
        } else if (result.error || result.statusCode >= 400) {
          errors++;
        } else {
          latencies.push(result.latencyMs);
        }
      });
      inFlight.add(p);
      firedInBatch++;
    }

    if (Date.now() < batchDeadline) {
      await new Promise((r) => setTimeout(r, 1));
    }
  }

  await Promise.all(inFlight);

  const actualDuration = (Date.now() - startTime) / 1000;
  return computeStats(latencies, errors, timeouts, actualDuration, connections);
}

// ─── Mixed Traffic Runner ─────────────────────────────────────────────────────

async function runMixedTest(config) {
  const { endpoints, targetRps, durationSec, connections } = config;
  const latencies = [];
  let errors = 0;
  let timeouts = 0;
  const startTime = Date.now();
  const endTime = startTime + durationSec * 1000;
  const intervalMs = 1000 / targetRps;

  console.log(
    `  [MIXED] Target: ${targetRps} req/s | Duration: ${durationSec}s | ${endpoints.length} endpoints`
  );

  const weightedPool = [];
  for (const ep of endpoints) {
    const count = Math.round(ep.weight * 100);
    for (let i = 0; i < count; i++) weightedPool.push(ep);
  }

  const inFlight = new Set();

  while (Date.now() < endTime) {
    const batchDeadline = Date.now() + Math.min(intervalMs, 100);
    let firedInBatch = 0;
    const maxBatch = Math.max(1, Math.ceil(targetRps / 10));

    while (firedInBatch < maxBatch && Date.now() < batchDeadline && Date.now() < endTime) {
      if (inFlight.size >= connections) {
        await Promise.race(inFlight);
        continue;
      }

      const ep = weightedPool[Math.floor(Math.random() * weightedPool.length)];
      const url = `${BASE_URL}${ep.endpoint}`;

      const p = makeRequest(url, ep.method, ep.headers, ep.body).then((result) => {
        inFlight.delete(p);
        if (result.timeout) {
          timeouts++;
        } else if (result.error || result.statusCode >= 400) {
          errors++;
        } else {
          latencies.push(result.latencyMs);
        }
      });
      inFlight.add(p);
      firedInBatch++;
    }

    if (Date.now() < batchDeadline) {
      await new Promise((r) => setTimeout(r, 1));
    }
  }

  await Promise.all(inFlight);

  const actualDuration = (Date.now() - startTime) / 1000;
  return computeStats(latencies, errors, timeouts, actualDuration, connections);
}

// ─── Ramp-Up Runner ───────────────────────────────────────────────────────────

async function runRampUpTest(config) {
  const { endpoint, method, body, headers, startConnections, endConnections, durationSec } = config;
  const url = `${BASE_URL}${endpoint}`;
  const latencies = [];
  let errors = 0;
  let timeouts = 0;
  const startTime = Date.now();
  const endTime = startTime + durationSec * 1000;
  const rampIntervalSec = 30;
  const rampSnapshots = [];

  console.log(
    `  [RAMP-UP] ${startConnections} -> ${endConnections} conns over ${durationSec}s | ${method} ${endpoint}`
  );

  const inFlight = new Set();
  let lastReport = startTime;
  let lastSnapshotStart = startTime;
  let snapLatencies = 0;
  let snapErrors = 0;
  let snapTimeouts = 0;

  while (Date.now() < endTime) {
    const elapsed = (Date.now() - startTime) / 1000;
    const progress = Math.min(elapsed / durationSec, 1.0);
    const currentConns = Math.round(startConnections + (endConnections - startConnections) * progress);
    const currentRps = currentConns * 2;
    const intervalMs = 1000 / Math.max(currentRps, 1);

    // Snapshot reporting
    if (Date.now() - lastReport > rampIntervalSec * 1000) {
      const snapDuration = (Date.now() - lastSnapshotStart) / 1000;
      rampSnapshots.push({
        elapsedSec: Math.round(elapsed),
        connections: currentConns,
        targetRps: currentRps,
        requestsInWindow: snapLatencies + snapErrors + snapTimeouts,
        errorsInWindow: snapErrors,
        timeoutsInWindow: snapTimeouts,
        windowDurationSec: Math.round(snapDuration * 100) / 100,
      });
      console.log(
        `    t=${Math.round(elapsed)}s | Conns: ${currentConns} | RPS: ${currentRps} | ` +
        `Reqs: ${snapLatencies + snapErrors + snapTimeouts} | Err: ${snapErrors} | TO: ${snapTimeouts}`
      );
      lastReport = Date.now();
      lastSnapshotStart = Date.now();
      snapLatencies = 0;
      snapErrors = 0;
      snapTimeouts = 0;
    }

    const batchDeadline = Date.now() + Math.min(intervalMs, 100);
    let firedInBatch = 0;
    const maxBatch = Math.max(1, Math.ceil(currentRps / 10));

    while (firedInBatch < maxBatch && Date.now() < batchDeadline && Date.now() < endTime) {
      if (inFlight.size >= currentConns) {
        await Promise.race(inFlight);
        continue;
      }

      const p = makeRequest(url, method, headers, body).then((result) => {
        inFlight.delete(p);
        if (result.timeout) {
          timeouts++;
          snapTimeouts++;
        } else if (result.error || result.statusCode >= 400) {
          errors++;
          snapErrors++;
        } else {
          latencies.push(result.latencyMs);
          snapLatencies++;
        }
      });
      inFlight.add(p);
      firedInBatch++;
    }

    if (Date.now() < batchDeadline) {
      await new Promise((r) => setTimeout(r, 1));
    }
  }

  await Promise.all(inFlight);

  // Final snapshot
  const finalDuration = (Date.now() - lastSnapshotStart) / 1000;
  rampSnapshots.push({
    elapsedSec: Math.round(durationSec),
    connections: endConnections,
    targetRps: endConnections * 2,
    requestsInWindow: snapLatencies + snapErrors + snapTimeouts,
    errorsInWindow: snapErrors,
    timeoutsInWindow: snapTimeouts,
    windowDurationSec: Math.round(finalDuration * 100) / 100,
  });

  const actualDuration = (Date.now() - startTime) / 1000;
  const stats = computeStats(latencies, errors, timeouts, actualDuration, endConnections);
  stats.rampSnapshots = rampSnapshots;
  return stats;
}

// ─── Spike Test Runner ────────────────────────────────────────────────────────

async function runSpikeTest(config) {
  const { endpoint, method, body, headers, baselineRps, spikeRps, spikeDurationSec, totalDurationSec, connections } = config;
  const url = `${BASE_URL}${endpoint}`;
  const latencies = [];
  let errors = 0;
  let timeouts = 0;
  const startTime = Date.now();
  const endTime = startTime + totalDurationSec * 1000;

  // Phases: baseline (45s) -> spike (spikeDurationSec) -> recovery (remaining)
  const baselineEnd = startTime + 45000;
  const spikeEnd = baselineEnd + spikeDurationSec * 1000;
  const phaseLatencies = { baseline: [], spike: [], recovery: [] };
  const phaseErrors = { baseline: 0, spike: 0, recovery: 0 };
  const phaseTimeouts = { baseline: 0, spike: 0, recovery: 0 };

  console.log(
    `  [SPIKE] ${baselineRps} -> ${spikeRps} -> ${baselineRps} req/s over ${totalDurationSec}s | ${method} ${endpoint}`
  );

  const inFlight = new Set();

  while (Date.now() < endTime) {
    const now = Date.now();
    let currentRps;
    let phase;

    if (now < baselineEnd) {
      currentRps = baselineRps;
      phase = 'baseline';
    } else if (now < spikeEnd) {
      currentRps = spikeRps;
      phase = 'spike';
    } else {
      currentRps = baselineRps;
      phase = 'recovery';
    }

    const intervalMs = 1000 / currentRps;
    const batchDeadline = now + Math.min(intervalMs, 100);
    let firedInBatch = 0;
    const maxBatch = Math.max(1, Math.ceil(currentRps / 10));

    while (firedInBatch < maxBatch && Date.now() < batchDeadline && Date.now() < endTime) {
      if (inFlight.size >= connections) {
        await Promise.race(inFlight);
        continue;
      }

      const p = makeRequest(url, method, headers, body).then((result) => {
        inFlight.delete(p);
        if (result.timeout) {
          timeouts++;
          phaseTimeouts[phase]++;
        } else if (result.error || result.statusCode >= 400) {
          errors++;
          phaseErrors[phase]++;
        } else {
          latencies.push(result.latencyMs);
          phaseLatencies[phase].push(result.latencyMs);
        }
      });
      inFlight.add(p);
      firedInBatch++;
    }

    if (Date.now() < batchDeadline) {
      await new Promise((r) => setTimeout(r, 1));
    }
  }

  await Promise.all(inFlight);

  const actualDuration = (Date.now() - startTime) / 1000;
  const stats = computeStats(latencies, errors, timeouts, actualDuration, connections);
  stats.spikePhases = {
    baseline: computeStats(
      phaseLatencies.baseline,
      phaseErrors.baseline,
      phaseTimeouts.baseline,
      45,
      connections
    ),
    spike: computeStats(
      phaseLatencies.spike,
      phaseErrors.spike,
      phaseTimeouts.spike,
      spikeDurationSec,
      connections
    ),
    recovery: computeStats(
      phaseLatencies.recovery,
      phaseErrors.recovery,
      phaseTimeouts.recovery,
      actualDuration - 45 - spikeDurationSec,
      connections
    ),
  };
  return stats;
}

// ─── Scenario Dispatcher ──────────────────────────────────────────────────────

async function runScenario(key) {
  const config = SCENARIOS[key];
  if (!config) throw new Error(`Unknown scenario: ${key}`);

  console.log(`\n${'='.repeat(70)}`);
  console.log(`  SCENARIO: ${config.name}`);
  console.log(`  ${config.description}`);
  console.log(`${'='.repeat(70)}`);

  let stats;
  const scenarioStart = Date.now();

  if (config.rampUp) {
    stats = await runRampUpTest(config);
  } else if (config.spike) {
    stats = await runSpikeTest(config);
  } else if (config.endpoints) {
    stats = await runMixedTest(config);
  } else {
    stats = await runFloodTest(config);
  }

  const wallTime = (Date.now() - scenarioStart) / 1000;
  stats.scenarioKey = key;
  stats.scenarioName = config.name;
  stats.wallClockSec = Math.round(wallTime * 100) / 100;
  stats.timestamp = new Date().toISOString();
  stats.targetUrl = BASE_URL;

  return stats;
}

// ─── Report Formatters ────────────────────────────────────────────────────────

function formatTable(stats) {
  const lines = [];
  lines.push('');
  lines.push('  +-------------------------------------------------------+');
  lines.push('  |                  LOAD TEST RESULTS                    |');
  lines.push('  +-------------------------------------------------------+');
  lines.push(`  | Scenario      : ${stats.scenarioName.padEnd(38)}|`);
  lines.push(`  | Timestamp     : ${stats.timestamp.padEnd(38)}|`);
  lines.push(`  | Target URL    : ${stats.targetUrl.padEnd(38)}|`);
  lines.push('  +-------------------------------------------------------+');
  lines.push(`  | Total Requests: ${String(stats.totalRequests).padEnd(38)}|`);
  lines.push(`  | Successful    : ${String(stats.successfulRequests).padEnd(38)}|`);
  lines.push(`  | Failed        : ${String(stats.failedRequests).padEnd(38)}|`);
  lines.push(`  | Timeouts      : ${String(stats.timeouts).padEnd(38)}|`);
  lines.push(`  | Req/sec       : ${String(stats.requestsPerSecond).padEnd(38)}|`);
  lines.push(`  | Error Rate    : ${String(stats.errorRatePct + '%').padEnd(38)}|`);
  lines.push('  +-------------------------------------------------------+');
  lines.push(`  | Avg Latency   : ${String(stats.avgLatencyMs + ' ms').padEnd(38)}|`);
  lines.push(`  | Min Latency   : ${String(stats.minLatencyMs + ' ms').padEnd(38)}|`);
  lines.push(`  | P50 Latency   : ${String(stats.p50LatencyMs + ' ms').padEnd(38)}|`);
  lines.push(`  | P95 Latency   : ${String(stats.p95LatencyMs + ' ms').padEnd(38)}|`);
  lines.push(`  | P99 Latency   : ${String(stats.p99LatencyMs + ' ms').padEnd(38)}|`);
  lines.push(`  | Max Latency   : ${String(stats.maxLatencyMs + ' ms').padEnd(38)}|`);
  lines.push(`  | Max Conns     : ${String(stats.maxConcurrentConnections).padEnd(38)}|`);
  lines.push(`  | Duration      : ${String(stats.totalDurationSec + 's').padEnd(38)}|`);
  lines.push('  +-------------------------------------------------------+');

  // Spike test: phase breakdown
  if (stats.spikePhases) {
    lines.push('');
    lines.push('  Spike Phase Breakdown:');
    for (const [phaseName, phaseStats] of Object.entries(stats.spikePhases)) {
      lines.push(`    ${phaseName.padEnd(12)}: ${phaseStats.requestsPerSecond} req/s | ` +
        `avg ${phaseStats.avgLatencyMs}ms | p95 ${phaseStats.p95LatencyMs}ms | ` +
        `err ${phaseStats.errorRatePct}%`);
    }
  }

  // Ramp-up: snapshots
  if (stats.rampSnapshots && stats.rampSnapshots.length > 0) {
    lines.push('');
    lines.push('  Ramp-Up Snapshots:');
    for (const snap of stats.rampSnapshots) {
      lines.push(`    t=${String(snap.elapsedSec).padStart(4)}s | ` +
        `conns: ${String(snap.connections).padStart(4)} | ` +
        `rps: ${String(snap.targetRps).padStart(4)} | ` +
        `reqs: ${String(snap.requestsInWindow).padStart(6)} | ` +
        `err: ${String(snap.errorsInWindow).padStart(4)} | ` +
        `to: ${String(snap.timeoutsInWindow).padStart(3)}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

function saveResults(allResults) {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(RESULTS_DIR, `load-test-${timestamp}.json`);
  const summaryPath = path.join(RESULTS_DIR, `load-test-${timestamp}.txt`);

  // JSON output
  const output = {
    meta: {
      platform: os.platform(),
      arch: os.arch(),
      cpuCount: os.cpus().length,
      totalMemoryMb: Math.round(os.totalmem() / 1024 / 1024),
      freeMemoryMb: Math.round(os.freemem() / 1024 / 1024),
      nodeVersion: process.version,
      generatedAt: new Date().toISOString(),
      targetUrl: BASE_URL,
    },
    scenarios: allResults,
  };

  fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));
  console.log(`\n  Results saved to: ${jsonPath}`);

  // Text summary
  const textLines = ['DeepMindQ Load Test Summary', '===========================', ''];
  for (const r of allResults) {
    textLines.push(`[${r.scenarioKey}] ${r.scenarioName}`);
    textLines.push(`  Total: ${r.totalRequests} | RPS: ${r.requestsPerSecond} | ` +
      `Avg: ${r.avgLatencyMs}ms | P95: ${r.p95LatencyMs}ms | P99: ${r.p99LatencyMs}ms | ` +
      `Errors: ${r.errorRatePct}% | Timeouts: ${r.timeouts}`);
    textLines.push('');
  }
  fs.writeFileSync(summaryPath, textLines.join('\n'));
  console.log(`  Summary saved to: ${summaryPath}`);

  return jsonPath;
}

// ─── Pre-Flight Check ────────────────────────────────────────────────────────

async function preflightCheck() {
  console.log(`  Target: ${BASE_URL}`);
  console.log('  Running pre-flight health check...');

  return new Promise((resolve) => {
    const req = http.get(`${BASE_URL}/api/health`, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 500) {
          console.log(`  Health check passed (HTTP ${res.statusCode}).`);
          resolve(true);
        } else {
          console.log(`  WARNING: Health check returned HTTP ${res.statusCode}.`);
          console.log('  Proceeding anyway — some scenarios may show 4xx errors.');
          resolve(true);
        }
      });
    });
    req.on('error', (err) => {
      console.log(`  WARNING: Cannot reach ${BASE_URL}: ${err.message}`);
      console.log('  Ensure the Next.js dev server is running: bun run dev');
      resolve(false);
    });
    req.on('timeout', () => {
      req.destroy();
      console.log('  WARNING: Health check timed out (5s).');
      resolve(true);
    });
  });
}

// ─── CLI Entry Point ──────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  console.log('');
  console.log('  DeepMindQ Load Testing Suite (10.2)');
  console.log('  ====================================');
  console.log(`  Node.js ${process.version} | ${os.cpus().length} CPUs | ${Math.round(os.totalmem() / 1024 / 1024)}MB RAM`);
  console.log('');

  // --list: show available scenarios
  if (args.includes('--list')) {
    console.log('  Available scenarios:\n');
    for (const [key, s] of Object.entries(SCENARIOS)) {
      console.log(`    ${key.padEnd(12)} - ${s.name}`);
      console.log(`                  ${s.description}\n`);
    }
    return;
  }

  // Determine which scenarios to run
  let scenarioKeys = [];
  if (args.includes('--all')) {
    scenarioKeys = Object.keys(SCENARIOS);
  } else if (args.length > 0 && !args[0].startsWith('--')) {
    for (const a of args) {
      if (SCENARIOS[a]) scenarioKeys.push(a);
      else console.log(`  WARNING: Unknown scenario '${a}' — skipped.`);
    }
  } else {
    // Default: run the quick scenarios (skip endurance/soak)
    scenarioKeys = ['health', 'auth', 'dashboard', 'companies', 'ai', 'mixed'];
    console.log('  No scenario specified. Running quick suite: ' + scenarioKeys.join(', '));
    console.log('  Use --all for full suite or --list to see options.\n');
  }

  // Pre-flight
  const alive = await preflightCheck();
  if (!alive) {
    console.log('\n  Aborting: target server is unreachable.');
    process.exit(1);
  }

  // Run scenarios
  const allResults = [];
  const totalStart = Date.now();

  for (const key of scenarioKeys) {
    try {
      const stats = await runScenario(key);
      console.log(formatTable(stats));
      allResults.push(stats);
    } catch (err) {
      console.error(`  FAILED scenario '${key}': ${err.message}`);
      allResults.push({
        scenarioKey: key,
        scenarioName: SCENARIOS[key].name,
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  const totalWall = ((Date.now() - totalStart) / 1000).toFixed(1);
 console.log(`\n  All scenarios completed in ${totalWall}s.`);

  // Save results
  if (allResults.length > 0) {
    const resultsFile = saveResults(allResults);
    console.log(`\n  Run capacity model: node tests/load/capacity-model.js ${resultsFile}`);
  }

  console.log('');
}

main().catch((err) => {
  console.error('  Fatal error:', err);
  process.exit(1);
});
