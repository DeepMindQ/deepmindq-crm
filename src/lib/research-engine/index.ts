/**
 * Research Intelligence Engine — Public API (Phase 3)
 *
 * This is the main entry point for the research engine.
 * Other modules import from here.
 *
 * Usage:
 *   import { runResearch, getEvidence, getSignalSummary } from '@/lib/research-engine';
 */

export { researchCompany, type ResearchResult, type ResearchStepProgress } from './researcher';
export {
  collectEvidence,
  linkEvidenceToFields,
  getEvidenceForField,
  getEvidenceSummary,
  type RawEvidence,
  type ExtractedField,
  type FieldConfidence,
} from './evidence';
export {
  detectSignals,
  storeSignals,
  type DetectedSignal,
  type SignalDetectionResult,
} from './signals';

/**
 * Convenience function: run full research pipeline for a company.
 * Wraps researchCompany with default error handling.
 */
import { researchCompany } from './researcher';
import { db } from '@/lib/db';

export async function runResearch(params: {
  companyId: string;
  companyName: string;
  domain?: string | null;
  industry?: string | null;
  jobId?: string | null;
  force?: boolean;
  onProgress?: (p: { step: number; label: string; progress: number; message: string }) => void;
}) {
  const company = await db.company.findUnique({ where: { id: params.companyId } });
  if (!company) throw new Error(`Company ${params.companyId} not found`);

  return researchCompany(
    params.companyId,
    params.companyName || company.rawName || company.normalizedName,
    params.domain || company.domain,
    params.industry || company.industry,
    params.jobId || null,
    params.force || false,
    params.onProgress,
  );
}