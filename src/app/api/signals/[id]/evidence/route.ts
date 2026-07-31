import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/apiHelpers';

/* ═══════════════════════════════════════════════════════════════
   Ticket 8 — Signal Evidence Detail API

   Fetches actual Evidence records that back a given signal.
   A CompanySignal stores evidenceIds (JSON array of Evidence IDs).
   This endpoint resolves those IDs into full Evidence records.

   GET /api/signals/[id]/evidence
   Response: { success, data: { evidence: EvidenceItem[] } }
   ═══════════════════════════════════════════════════════════════ */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || typeof id !== 'string' || id.length < 1) {
      return apiError('Signal ID is required', 400);
    }

    // 1. Fetch the signal to get its evidenceIds
    const signal = await db.companySignal.findUnique({
      where: { id },
      select: { id: true, evidenceIds: true, companyId: true },
    });

    if (!signal) {
      return apiError('Signal not found', 404);
    }

    // 2. Parse evidenceIds from JSON
    let evidenceIds: string[] = [];
    try {
      const raw = typeof signal.evidenceIds === 'string'
        ? JSON.parse(signal.evidenceIds)
        : signal.evidenceIds;
      if (Array.isArray(raw)) {
        evidenceIds = raw.filter((eid: unknown) => typeof eid === 'string' && eid.length > 0);
      }
    } catch {
      // Malformed JSON — return empty evidence list
      return apiSuccess({ evidence: [], signalId: id });
    }

    // 3. Fetch Evidence records by IDs
    if (evidenceIds.length === 0) {
      return apiSuccess({ evidence: [], signalId: id });
    }

    const evidenceRecords = await db.evidence.findMany({
      where: {
        id: { in: evidenceIds },
      },
      select: {
        id: true,
        sourceUrl: true,
        sourceTitle: true,
        sourceName: true,
        snippet: true,
        extractedField: true,
        extractedValue: true,
        relevanceScore: true,
        confidence: true,
        sourceDate: true,
        sourceQualityTier: true,
        status: true,
        createdAt: true,
      },
      orderBy: { confidence: 'desc' },
    });

    return apiSuccess({ evidence: evidenceRecords, signalId: id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch evidence';
    return apiError(message, 500);
  }
}
