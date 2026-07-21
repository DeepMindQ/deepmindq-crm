/**
 * Signal Validation Engine (Phase 6 — Module 3)
 *
 * Classifies each signal's trustworthiness into:
 *   VALID       — Confirmed by evidence + high confidence
 *   WEAK        — Low evidence support or single-source
 *   CONFLICTING — Contradicts other active signals
 *   EXPIRED     — Past relevance window
 *
 * Uses upsert to create-or-update SignalValidation records.
 * Triggered by POST /api/g-intelligence/companies/[id]/validate.
 */

import { db } from '@/lib/db';

export type ValidationStatus = 'VALID' | 'WEAK' | 'CONFLICTING' | 'EXPIRED';

export interface SignalValidationResult {
  signalId: string;
  validationStatus: ValidationStatus;
  confidenceScore: number;
  reason: string;
  evidenceCount: number;
  sourceDomainCount: number;
  signalAge: number;
}

// ── Classification Rules ──

function classifySignal(params: {
  confidence: number;
  impact: string;
  evidenceCount: number;
  sourceDomainCount: number;
  signalAge: number;
  lifecycleStatus: string;
  hasConflict: boolean;
}): { status: ValidationStatus; reason: string } {
  const { confidence, impact, evidenceCount, sourceDomainCount, signalAge, lifecycleStatus, hasConflict } = params;

  // EXPIRED: past relevance window
  if (lifecycleStatus === 'expired' || lifecycleStatus === 'archived') {
    return { status: 'EXPIRED', reason: `Signal is ${lifecycleStatus} (age: ${signalAge}d)` };
  }

  // CONFLICTING: contradicts other active signals (set by contradiction detection)
  if (hasConflict) {
    return { status: 'CONFLICTING', reason: 'Detected contradiction with other active signals' };
  }

  // VALID: high confidence + high impact + multi-source
  if (confidence >= 0.7 && impact === 'high' && evidenceCount >= 2) {
    return { status: 'VALID', reason: `High confidence (${(confidence * 100).toFixed(0)}%), high impact, ${evidenceCount} evidence items from ${sourceDomainCount} source(s)` };
  }

  // WEAK: low confidence or single-source
  if (confidence < 0.5 || evidenceCount <= 1) {
    const reasons: string[] = [];
    if (confidence < 0.5) reasons.push(`low confidence (${(confidence * 100).toFixed(0)}%)`);
    if (evidenceCount <= 1) reasons.push(`single source (${evidenceCount} evidence item${evidenceCount === 1 ? '' : 's'})`);
    return { status: 'WEAK', reason: reasons.join(', ') };
  }

  // Default: VALID if confidence is reasonable
  if (confidence >= 0.5 && evidenceCount >= 2) {
    return { status: 'VALID', reason: `Adequate confidence (${(confidence * 100).toFixed(0)}%), ${evidenceCount} evidence items from ${sourceDomainCount} source(s)` };
  }

  return { status: 'WEAK', reason: `Insufficient evidence (${evidenceCount} item${evidenceCount === 1 ? '' : 's'})` };
}

// ── Validate all signals for a company ──

export async function validateCompanySignals(
  companyId: string,
): Promise<{ validated: number; results: SignalValidationResult[] }> {
  // Load all signals for this company
  const signals = await db.companySignal.findMany({
    where: { companyId },
    select: {
      id: true,
      confidence: true,
      impact: true,
      status: true,
      signalDate: true,
      evidenceIds: true,
    },
  });

  if (signals.length === 0) {
    return { validated: 0, results: [] };
  }

  // Load conflict signal IDs for this company (open conflicts only)
  const conflicts = await db.intelligenceConflict.findMany({
    where: { companyId, status: 'open' },
    select: { relatedSignals: true },
  });
  const conflictedSignalIds = new Set<string>();
  for (const c of conflicts) {
    const ids = c.relatedSignals as string[];
    if (Array.isArray(ids)) {
      ids.forEach(id => conflictedSignalIds.add(id));
    }
  }

  // Load evidence counts per signal
  // Parse evidenceIds JSON to get per-signal evidence counts
  const signalEvidenceMap = new Map<string, string[]>();
  for (const sig of signals) {
    try {
      const parsed = JSON.parse(sig.evidenceIds || '[]');
      signalEvidenceMap.set(sig.id, Array.isArray(parsed) ? parsed : []);
    } catch {
      signalEvidenceMap.set(sig.id, []);
    }
  }

  // Load evidence details for source domain counting
  const allEvidenceIds = Array.from(signalEvidenceMap.values()).flat();
  let evidenceRecords: { id: string; sourceUrl: string; status: string }[] = [];
  if (allEvidenceIds.length > 0) {
    evidenceRecords = await db.evidence.findMany({
      where: {
        id: { in: allEvidenceIds },
        status: { in: ['active', 'aging'] },
      },
      select: { id: true, sourceUrl: true, status: true },
    });
  }

  // Group evidence by signal
  const evidenceBySignal = new Map<string, typeof evidenceRecords>();
  for (const [sigId, eIds] of signalEvidenceMap) {
    const recs = evidenceRecords.filter(e => eIds.includes(e.id));
    evidenceBySignal.set(sigId, recs);
  }

  const now = Date.now();
  const results: SignalValidationResult[] = [];

  for (const sig of signals) {
    const evidence = evidenceBySignal.get(sig.id) || [];
    const sourceDomains = new Set(
      evidence.map(e => {
        try { return new URL(e.sourceUrl).hostname; } catch { return e.sourceUrl; }
      }),
    );

    // Signal age in days
    const refDate = sig.signalDate ? new Date(sig.signalDate).getTime() : now;
    const signalAge = Math.max(0, Math.round((now - refDate) / (1000 * 60 * 60 * 24)));

    const { status, reason } = classifySignal({
      confidence: sig.confidence,
      impact: sig.impact,
      evidenceCount: evidence.length,
      sourceDomainCount: sourceDomains.size,
      signalAge,
      lifecycleStatus: sig.status,
      hasConflict: conflictedSignalIds.has(sig.id),
    });

    // Upsert SignalValidation record
    await db.signalValidation.upsert({
      where: { signalId: sig.id },
      create: {
        companyId,
        signalId: sig.id,
        validationStatus: status,
        confidenceScore: sig.confidence,
        reason,
        evidenceCount: evidence.length,
        sourceDomainCount: sourceDomains.size,
        signalAge,
      },
      update: {
        validationStatus: status,
        confidenceScore: sig.confidence,
        reason,
        evidenceCount: evidence.length,
        sourceDomainCount: sourceDomains.size,
        signalAge,
        validatedAt: new Date(),
      },
    });

    results.push({
      signalId: sig.id,
      validationStatus: status,
      confidenceScore: sig.confidence,
      reason,
      evidenceCount: evidence.length,
      sourceDomainCount: sourceDomains.size,
      signalAge,
    });
  }

  return { validated: results.length, results };
}

// ── Get validation summary for a company ──

export async function getSignalValidationSummary(companyId: string): Promise<{
  total: number;
  valid: number;
  weak: number;
  conflicting: number;
  expired: number;
}> {
  const records = await db.signalValidation.findMany({
    where: { companyId },
    select: { validationStatus: true },
  });

  const summary = { total: records.length, valid: 0, weak: 0, conflicting: 0, expired: 0 };
  for (const r of records) {
    switch (r.validationStatus) {
      case 'VALID': summary.valid++; break;
      case 'WEAK': summary.weak++; break;
      case 'CONFLICTING': summary.conflicting++; break;
      case 'EXPIRED': summary.expired++; break;
    }
  }
  return summary;
}