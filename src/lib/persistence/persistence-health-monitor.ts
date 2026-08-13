// Stub for persistence health monitor

export function getPersistenceHealthMonitor() {
  return {
    generateHealthReport() {
      return {
        overallHealth: 'healthy' as const,
        totalWrites: 0,
        totalFailures: 0,
        unhealthyCount: 0,
        criticalFailureExists: false,
        alerts: [] as Array<{ store: string; level: string; consecutiveFailures: number; message: string; timestamp: number }>,
        stores: [] as Array<{ store: string; healthy: boolean; totalWrites: number; totalFailures: number; consecutiveFailures: number; lastWriteLatencyMs: number; lastWriteAt: number | null }>,
      };
    },
  };
}