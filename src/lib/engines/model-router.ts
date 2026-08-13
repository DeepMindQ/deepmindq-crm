// Stub for model router

export class ModelRouter {
  static getPerformanceStats(): Array<{
    provider: string;
    totalCalls: number;
    failedCalls: number;
    circuitOpen: boolean;
  }> {
    return [];
  }
}
