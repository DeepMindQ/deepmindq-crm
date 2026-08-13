// Stub for monitoring module

export const metrics = {
  getAggregates(): Record<string, { last?: number; sum?: number; count?: number }> {
    return {};
  },
};

export function collectSystemMetrics(): void {
  // no-op stub
}
