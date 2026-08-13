// Stub for SLA monitor

export function getRouteSLAReport(): Array<{
  route: string;
  category: string;
  breachCount: number;
  p99Ms: number;
  slaThreshold: number;
  currentP99Compliant: boolean;
}> {
  return [];
}

export function getRawRouteStats(): Record<string, unknown> {
  return {};
}

export function getSLAThreshold(_route: string): number {
  return 5000;
}
