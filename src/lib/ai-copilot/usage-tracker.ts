// Stub for AI copilot usage tracker

export async function logAIUsage(_params: {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  quality?: unknown;
  errorMessage?: string;
}): Promise<void> {
  // no-op stub
}

export function estimateCost(_provider: string, _model: string, _promptTokens: number, _completionTokens: number): number {
  return 0;
}
