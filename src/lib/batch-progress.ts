/**
 * Shared in-memory batch progress tracker.
 * Used by batches.ts (import) and batches/[id]/progress.ts (read).
 */

export interface BatchProgress {
  status: string;
  processedRows: number;
  totalRows: number;
  acceptedRows: number;
  duplicateRows: number;
  invalidRows: number;
  startedAt: number;
  cancelled: boolean;
  consentSource?: string;
  source?: string;
  consentIp?: string;
}

export const batchProgress = new Map<string, BatchProgress>();

export function cancelBatch(batchId: string) {
  const p = batchProgress.get(batchId);
  if (p) p.cancelled = true;
}