// Stub for database enterprise monitor

export async function getDatabaseHealthSummary() {
  return {
    status: 'healthy' as const,
    latencyMs: 0,
    poolSize: 0,
    activeConnections: 0,
    lastQueryAt: new Date().toISOString(),
  };
}

export async function getDatabaseHealthReport() {
  return {
    status: 'healthy' as const,
    performanceStats: { p95LatencyMs: 0, p50LatencyMs: 0, avgLatencyMs: 0, queryCount: 0, slowQueryCount: 0 },
    poolStats: { totalConnections: 0, activeConnections: 0, idleConnections: 0, waitingRequests: 0 },
  };
}
