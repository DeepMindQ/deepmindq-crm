/**
 * WI-18.3 API Observability
 * 
 * Tracks API request metrics: latency, status codes, error rates.
 * Uses the existing logRequest from logger.ts.
 */

interface ApiMetric {
  endpoint: string;
  method: string;
  statusCode: number;
  latencyMs: number;
  timestamp: string;
}

// In-memory metrics buffer (resets on deploy — adequate for dashboard baselines)
const metricsBuffer: ApiMetric[] = [];
const BUFFER_SIZE = 1000;

export function recordApiMetric(
  method: string,
  path: string,
  statusCode: number,
  latencyMs: number
) {
  metricsBuffer.push({
    endpoint: path,
    method,
    statusCode,
    latencyMs,
    timestamp: new Date().toISOString(),
  });
  
  // Trim buffer
  while (metricsBuffer.length > BUFFER_SIZE) {
    metricsBuffer.shift();
  }
}

export function getApiMetrics() {
  if (metricsBuffer.length === 0) {
    return {
      totalRequests: 0,
      errorRate: 0,
      avgLatencyMs: 0,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      topEndpoints: [],
      recentErrors: [],
    };
  }

  const total = metricsBuffer.length;
  const errors = metricsBuffer.filter(m => m.statusCode >= 400);
  const latencies = metricsBuffer.map(m => m.latencyMs).sort((a, b) => a - b);
  
  const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;

  // Top endpoints by request count
  const endpointCounts = new Map<string, number>();
  for (const m of metricsBuffer) {
    endpointCounts.set(m.endpoint, (endpointCounts.get(m.endpoint) ?? 0) + 1);
  }
  const topEndpoints = [...endpointCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([endpoint, count]) => ({ endpoint, count }));

  // Recent errors
  const recentErrors = errors.slice(-20).map(m => ({
    endpoint: m.endpoint,
    statusCode: m.statusCode,
    latencyMs: m.latencyMs,
    timestamp: m.timestamp,
  }));

  return {
    totalRequests: total,
    errorRate: errors.length / total,
    avgLatencyMs: Math.round(avg),
    p50LatencyMs: p50,
    p95LatencyMs: p95,
    topEndpoints,
    recentErrors,
  };
}
