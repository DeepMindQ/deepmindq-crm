// Stub for database performance monitor

export function getDbPerformanceStats() {
  return {
    queriesPerSecond: 0,
    p50LatencyMs: 0,
    p95LatencyMs: 0,
    p99LatencyMs: 0,
    slowQueryCount: 0,
  };
}
