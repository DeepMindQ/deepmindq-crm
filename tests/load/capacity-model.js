/**
 * DeepMindQ Capacity Planning Model (10.2)
 *
 * Analyzes load test results (JSON) and projects infrastructure requirements
 * for 100, 500, 1000, and 5000 concurrent users.
 *
 * Usage:
 *   node tests/load/capacity-model.js tests/load/results/load-test-<timestamp>.json
 *   node tests/load/capacity-model.js                           # uses latest results file
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const RESULTS_DIR = path.join(__dirname, 'results');
const USER_CONCURRENCY_FACTOR = 3;   // avg requests per user per second
const SAFETY_MARGIN = 1.5;            // 50% headroom
const MEMORY_PER_CONN_MB = 0.1;       // Node.js per-connection memory estimate
const BASELINE_CPU_CORES = 2;         // minimum allocation
const BASELINE_RAM_MB = 512;          // minimum allocation
const CPU_PER_100_RPS = 0.5;          // cores per 100 req/s (estimated)
const RAM_PER_100_RPS_MB = 64;        // RAM per 100 req/s (estimated)

// ─── Load Results ─────────────────────────────────────────────────────────────

function loadResults(filePath) {
  if (!filePath) {
    // Find the latest results file
    if (!fs.existsSync(RESULTS_DIR)) {
      console.error('  No results directory found. Run load tests first.');
      process.exit(1);
    }
    const files = fs
      .readdirSync(RESULTS_DIR)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse();
    if (files.length === 0) {
      console.error('  No results files found. Run load tests first.');
      process.exit(1);
    }
    filePath = path.join(RESULTS_DIR, files[0]);
    console.log(`  Using latest results: ${files[0]}`);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

// ─── Analysis ─────────────────────────────────────────────────────────────────

function analyzeScenario(scenario) {
  if (scenario.error) {
    return { ...scenario, analysisStatus: 'FAILED', failReason: scenario.error };
  }

  const analysis = {
    scenarioKey: scenario.scenarioKey,
    scenarioName: scenario.scenarioName,
    analysisStatus: 'OK',
    throughput: scenario.requestsPerSecond,
    avgLatencyMs: scenario.avgLatencyMs,
    p95LatencyMs: scenario.p95LatencyMs,
    p99LatencyMs: scenario.p99LatencyMs,
    errorRatePct: scenario.errorRatePct,
    totalRequests: scenario.totalRequests,
    successfulRequests: scenario.successfulRequests,
    timeouts: scenario.timeouts,
  };

  // Grade the scenario
  analysis.grade = gradeScenario(analysis);
  return analysis;
}

function gradeScenario(a) {
  let score = 100;

  // Penalize high error rates
  if (a.errorRatePct > 10) score -= 40;
  else if (a.errorRatePct > 5) score -= 25;
  else if (a.errorRatePct > 1) score -= 10;

  // Penalize timeouts
  if (a.timeouts > a.totalRequests * 0.05) score -= 20;
  else if (a.timeouts > a.totalRequests * 0.01) score -= 10;

  // Penalize high latency
  if (a.p99LatencyMs > 5000) score -= 20;
  else if (a.p99LatencyMs > 2000) score -= 10;
  else if (a.p99LatencyMs > 1000) score -= 5;

  if (a.p95LatencyMs > 2000) score -= 15;
  else if (a.p95LatencyMs > 1000) score -= 5;

  if (a.avgLatencyMs > 500) score -= 10;

  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}

// ─── Capacity Projection ───────────────────────────────────────────────────────

function projectCapacity(analyses) {
  // Find the peak observed RPS from successful scenarios
  const successful = analyses.filter((a) => a.analysisStatus === 'OK');
  if (successful.length === 0) {
    return { error: 'No successful scenarios to project from.' };
  }

  const peakRps = Math.max(...successful.map((a) => a.throughput));
  const avgP95 = successful.reduce((s, a) => s + a.p95LatencyMs, 0) / successful.length;
  const avgP99 = successful.reduce((s, a) => s + a.p99LatencyMs, 0) / successful.length;
  const avgErrorRate = successful.reduce((s, a) => s + a.errorRatePct, 0) / successful.length;

  // User tiers to project
  const userTiers = [100, 500, 1000, 5000];
  const projections = {};

  for (const users of userTiers) {
    const expectedRps = users * USER_CONCURRENCY_FACTOR;
    const scaledRps = expectedRps * SAFETY_MARGIN;

    // Estimate latency scaling (simplified linear model)
    const rpsRatio = scaledRps / Math.max(peakRps, 1);
    const projectedP95 = Math.round(avgP95 * Math.pow(rpsRatio, 0.7));
    const projectedP99 = Math.round(avgP99 * Math.pow(rpsRatio, 0.7));

    // Estimate infrastructure
    const cpuCores = Math.max(BASELINE_CPU_CORES, Math.ceil(CPU_PER_100_RPS * (scaledRps / 100)));
    const ramMb = Math.max(BASELINE_RAM_MB, Math.ceil(RAM_PER_100_RPS_MB * (scaledRps / 100)));
    const maxConnections = Math.ceil(scaledRps * 2); // 2x for headroom
    const connectionMemoryMb = Math.ceil(maxConnections * MEMORY_PER_CONN_MB);
    const totalRamMb = ramMb + connectionMemoryMb;

    // Can current setup handle it?
    const canHandle = scaledRps <= peakRps * SAFETY_MARGIN && projectedP95 < 3000 && projectedP99 < 10000;

    projections[users] = {
      concurrentUsers: users,
      expectedRps,
      scaledRps: Math.round(scaledRps),
      projectedP95LatencyMs: projectedP95,
      projectedP99LatencyMs: projectedP99,
      projectedErrorRatePct: Math.round(avgErrorRate * 100) / 100,
      canHandle,
      infrastructure: {
        cpuCores,
        ramMb: totalRamMb,
        maxConnections,
        connectionMemoryMb,
        recommendedInstances: Math.max(1, Math.ceil(cpuCores / 8)),
        recommendedInstanceType: getInstanceRecommendation(totalRamMb, cpuCores),
      },
    };
  }

  return {
    observedPeakRps: Math.round(peakRps * 100) / 100,
    observedAvgP95Ms: Math.round(avgP95 * 100) / 100,
    observedAvgP99Ms: Math.round(avgP99 * 100) / 100,
    observedAvgErrorRatePct: Math.round(avgErrorRate * 100) / 100,
    scalingModel: {
      concurrencyFactor: USER_CONCURRENCY_FACTOR,
      safetyMargin: SAFETY_MARGIN,
      memoryPerConnMb: MEMORY_PER_CONN_MB,
      cpuPer100Rps: CPU_PER_100_RPS,
      ramPer100RpsMb: RAM_PER_100_RPS_MB,
    },
    projections,
  };
}

function getInstanceRecommendation(ramMb, cpuCores) {
  if (ramMb <= 1024) return 'small (1-2 vCPU, 1-2GB RAM)';
  if (ramMb <= 4096) return 'medium (2-4 vCPU, 2-4GB RAM)';
  if (ramMb <= 16384) return 'large (4-8 vCPU, 8-16GB RAM)';
  return 'xlarge (8+ vCPU, 16+GB RAM)';
}

// ─── Report Generation ────────────────────────────────────────────────────────

function generateReport(analyses, capacity, meta) {
  const report = {
    generatedAt: new Date().toISOString(),
    sourceMeta: meta,
    scenarioAnalysis: analyses,
    capacityProjection: capacity,
    recommendations: generateRecommendations(analyses, capacity),
  };
  return report;
}

function generateRecommendations(analyses, capacity) {
  const recs = [];

  // Check for failing scenarios
  const failed = analyses.filter((a) => a.analysisStatus === 'FAILED');
  if (failed.length > 0) {
    recs.push({
      severity: 'critical',
      category: 'reliability',
      message: `${failed.length} scenario(s) failed completely: ${failed.map((f) => f.scenarioKey).join(', ')}.`,
      action: 'Investigate server stability and fix route handlers that are crashing.',
    });
  }

  // Check for high error rates
  const highError = analyses.filter((a) => a.analysisStatus === 'OK' && a.errorRatePct > 5);
  if (highError.length > 0) {
    recs.push({
      severity: 'high',
      category: 'reliability',
      message: `High error rate in: ${highError.map((h) => `${h.scenarioKey} (${h.errorRatePct}%)`).join(', ')}.`,
      action: 'Review rate limiting, connection pooling, and error handling for affected endpoints.',
    });
  }

  // Check for high latency
  const slowP95 = analyses.filter((a) => a.analysisStatus === 'OK' && a.p95LatencyMs > 1000);
  if (slowP95.length > 0) {
    recs.push({
      severity: 'high',
      category: 'performance',
      message: `High P95 latency in: ${slowP95.map((s) => `${s.scenarioKey} (${s.p95LatencyMs}ms)`).join(', ')}.`,
      action: 'Add caching, optimize database queries, and consider connection keep-alive tuning.',
    });
  }

  // Check for timeouts
  const timeoutScenarios = analyses.filter((a) => a.analysisStatus === 'OK' && a.timeouts > 0);
  if (timeoutScenarios.length > 0) {
    recs.push({
      severity: 'medium',
      category: 'reliability',
      message: `Timeouts detected in: ${timeoutScenarios.map((t) => `${t.scenarioKey} (${t.timeouts})`).join(', ')}.`,
      action: 'Increase server timeout settings, review long-running queries, and add circuit breakers.',
    });
  }

  // Capacity recommendations
  const proj = capacity.projections;
  if (proj) {
    for (const [tier, data] of Object.entries(proj)) {
      if (!data.canHandle) {
        recs.push({
          severity: 'medium',
          category: 'capacity',
          message: `Current setup cannot handle ${tier} concurrent users (requires ${data.scaledRps} RPS).`,
          action: `Scale to ${data.infrastructure.recommendedInstances}x ${data.infrastructure.recommendedInstanceType} instances (${data.infrastructure.cpuCores} cores, ${data.infrastructure.ramMb}MB RAM).`,
        });
      }
    }

    // Memory leak detection (soak test)
    const soakAnalysis = analyses.find((a) => a.scenarioKey === 'soak');
    if (soakAnalysis && soakAnalysis.analysisStatus === 'OK') {
      if (soakAnalysis.errorRatePct > 2) {
        recs.push({
          severity: 'high',
          category: 'memory',
          message: 'Soak test shows increasing error rate — possible memory leak.',
          action: 'Profile heap usage over time, check for event listener leaks, and review cache growth patterns.',
        });
      } else {
        recs.push({
          severity: 'info',
          category: 'memory',
          message: 'Soak test passed — no significant memory leak detected.',
          action: 'Continue monitoring in production with memory alerts.',
        });
      }
    }
  }

  if (recs.length === 0) {
    recs.push({
      severity: 'info',
      category: 'general',
      message: 'All scenarios performed well within acceptable thresholds.',
      action: 'Monitor in production and re-run load tests after major changes.',
    });
  }

  return recs;
}

// ─── Pretty Printer ───────────────────────────────────────────────────────────

function printReport(report) {
  console.log('');
  console.log('  +=======================================================+');
  console.log('  |        DEEPMINDQ CAPACITY PLANNING REPORT            |');
  console.log('  +=======================================================+');
  console.log(`  | Generated    : ${report.generatedAt.padEnd(37)}|`);
  console.log('  +=======================================================+');

  // Scenario analysis
  console.log('');
  console.log('  SCENARIO ANALYSIS');
  console.log('  -----------------');
  console.log(
    '  ' +
      'Scenario'.padEnd(14) +
      'Grade'.padEnd(7) +
      'RPS'.padEnd(10) +
      'Avg(ms)'.padEnd(10) +
      'P95(ms)'.padEnd(10) +
      'P99(ms)'.padEnd(10) +
      'Err%'.padEnd(8) +
      'Timeouts'
  );
  console.log('  ' + '-'.repeat(75));

  for (const a of report.scenarioAnalysis) {
    if (a.analysisStatus === 'FAILED') {
      console.log(
        '  ' +
          a.scenarioKey.padEnd(14) +
          'FAILED '.padEnd(7) +
          '-'.padEnd(10) +
          '-'.padEnd(10) +
          '-'.padEnd(10) +
          '-'.padEnd(10) +
          '-'.padEnd(8) +
          a.failReason?.substring(0, 20)
      );
    } else {
      console.log(
        '  ' +
          a.scenarioKey.padEnd(14) +
          a.grade.padEnd(7) +
          String(a.throughput).padEnd(10) +
          String(a.avgLatencyMs).padEnd(10) +
          String(a.p95LatencyMs).padEnd(10) +
          String(a.p99LatencyMs).padEnd(10) +
          String(a.errorRatePct + '%').padEnd(8) +
          String(a.timeouts)
      );
    }
  }

  // Capacity projection
  const cap = report.capacityProjection;
  if (cap.error) {
    console.log(`
  Capacity projection unavailable: ${cap.error}`);
    return;
  }

  console.log('');
  console.log('  CAPACITY PROJECTION');
  console.log('  -------------------');
  console.log(`  Observed peak throughput: ${cap.observedPeakRps} req/s`);
  console.log(`  Observed avg P95 latency: ${cap.observedAvgP95Ms}ms`);
  console.log(`  Observed avg P99 latency: ${cap.observedAvgP99Ms}ms`);
  console.log(`  Observed avg error rate:  ${cap.observedAvgErrorRatePct}%`);
  console.log(`  Scaling safety margin:    ${cap.scalingModel.safetyMargin}x`);
  console.log(`  User concurrency factor:  ${cap.scalingModel.concurrencyFactor} req/user/s`);
  console.log('');

  console.log(
    '  ' +
      'Users'.padEnd(8) +
      'Exp RPS'.padEnd(10) +
      'Scaled'.padEnd(10) +
      'Proj P95'.padEnd(11) +
      'Proj P99'.padEnd(11) +
      'Cores'.padEnd(7) +
      'RAM(MB)'.padEnd(9) +
      'Instances'.padEnd(11) +
      'OK?'
  );
  console.log('  ' + '-'.repeat(85));

  for (const [tier, data] of Object.entries(cap.projections)) {
    const ok = data.canHandle ? 'YES' : 'NO';
    console.log(
      '  ' +
        String(tier).padEnd(8) +
        String(data.expectedRps).padEnd(10) +
        String(data.scaledRps).padEnd(10) +
        String(data.projectedP95LatencyMs + 'ms').padEnd(11) +
        String(data.projectedP99LatencyMs + 'ms').padEnd(11) +
        String(data.infrastructure.cpuCores).padEnd(7) +
        String(data.infrastructure.ramMb).padEnd(9) +
        String(data.infrastructure.recommendedInstances).padEnd(11) +
        ok
    );
  }

  // Recommendations
  console.log('');
  console.log('  RECOMMENDATIONS');
  console.log('  ----------------');
  for (const rec of report.recommendations) {
    const icon =
      rec.severity === 'critical' ? '[CRIT]' :
      rec.severity === 'high' ? '[HIGH]' :
      rec.severity === 'medium' ? '[MED]' :
      '[INFO]';
    console.log(`  ${icon} [${rec.category}] ${rec.message}`);
    console.log(`         Action: ${rec.action}`);
    console.log('');
  }
}

// ─── CLI Entry Point ──────────────────────────────────────────────────────────

async function main() {
  const filePath = process.argv[2] || null;

  console.log('');
  console.log('  DeepMindQ Capacity Planning Model (10.2)');
  console.log('  ==========================================');
  console.log('');

  // Load results
  const data = loadResults(filePath);
  console.log(`  Loaded ${data.scenarios.length} scenario(s) from results.`);
  console.log(`  Test meta: ${data.meta.cpuCount} CPUs, ${data.meta.totalMemoryMb}MB RAM, Node ${data.meta.nodeVersion}`);
  console.log('');

  // Analyze each scenario
  const analyses = data.scenarios.map(analyzeScenario);

  // Project capacity
  const capacity = projectCapacity(analyses);

  // Generate and print report
  const report = generateReport(analyses, capacity, data.meta);
  printReport(report);

  // Save report as JSON
  const RESULTS_DIR = path.join(__dirname, 'results');
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(RESULTS_DIR, `capacity-report-${timestamp}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`  Report saved to: ${outputPath}`);
  console.log('');
}

main().catch((err) => {
  console.error('  Fatal error:', err);
  process.exit(1);
});
