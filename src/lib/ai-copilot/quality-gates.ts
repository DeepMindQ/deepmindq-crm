// Stub for AI copilot quality gates

export interface QualityReport {
  score: number;
  issues: string[];
  passed: boolean;
}

export async function runQualityGates(_input: string, _output: string): Promise<QualityReport> {
  return { score: 100, issues: [], passed: true };
}

export function formatQualityReportForLog(_report: QualityReport): string {
  return 'quality:pass';
}
