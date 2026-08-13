// Re-export from signals engine
export { detectSignalsForOrganization } from '../signals/engine';
import type { DetectedSignal } from '../signals/engine';
export type { DetectedSignal };

export async function storeSignals(signals: DetectedSignal[]): Promise<number> {
  // Storing is handled by callers; this is a stub
  return signals.length;
}
