// Stub for intelligence persistence adapter

export function getPersistenceAdapter() {
  return {
    getPoolMetrics(): {
      totalConnections: number;
      activeConnections: number;
      idleConnections: number;
      waitingRequests: number;
      poolUtilizationPercent: number;
    } | null {
      return null;
    },
  };
}
