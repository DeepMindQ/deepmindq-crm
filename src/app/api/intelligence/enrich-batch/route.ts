import { NextRequest, NextResponse } from 'next/server';
import { apiSuccess, apiError, validateBody } from '@/lib/apiHelpers';
import { IntelligencePipeline } from '@/lib/intelligence-pipeline';
import { db } from '@/lib/db';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// ────────────────────────────────────────────────────────────────────────
// POST /api/intelligence/enrich-batch
//
// Enrich multiple companies with AI intelligence.
// Creates a Job record for progress tracking.
// Processes sequentially to respect rate limits.
// ────────────────────────────────────────────────────────────────────────

const batchSchema = z.object({
  companyIds: z.array(z.string().min(1)).min(1).max(100),
  batchId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = validateBody(batchSchema, body);
    if (parsed instanceof Response) return parsed;

    const { companyIds, batchId } = parsed;

    // Verify companies exist
    const existingCompanies = await db.company.findMany({
      where: { id: { in: companyIds } },
      select: { id: true },
    });
    const validIds = existingCompanies.map(c => c.id);

    if (validIds.length === 0) {
      return apiError('No valid companies found', 404);
    }

    // Start batch enrichment (non-blocking for large batches)
    const { results, jobId } = await IntelligencePipeline.enrichBatch(validIds, {
      batchId,
    });

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const signalsCreated = results.reduce((sum, r) => sum + r.signalsCreated, 0);
    const evidenceCreated = results.reduce((sum, r) => sum + r.evidenceCreated, 0);

    return apiSuccess({
      jobId,
      totalProcessed: results.length,
      succeeded,
      failed,
      signalsCreated,
      evidenceCreated,
      results: results.map(r => ({
        companyId: r.companyId,
        companyName: r.companyName,
        success: r.success,
        signalsCreated: r.signalsCreated,
        evidenceCreated: r.evidenceCreated,
        error: r.error,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Batch enrichment failed';
    logger.error('[enrich-batch]', { detail: msg });
    return apiError(msg);
  }
}

// ────────────────────────────────────────────────────────────────────────
// GET /api/intelligence/enrich-batch
//
// Get enrichment pipeline statistics.
// ────────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const stats = await IntelligencePipeline.getStats();
    return apiSuccess(stats);
  } catch (err) {
    return apiError('Failed to get pipeline stats');
  }
}
