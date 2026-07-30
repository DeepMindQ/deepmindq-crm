/**
 * POST /api/intelligence/enrich-batch — Enrich multiple companies
 * GET  /api/intelligence/enrich-batch — Pipeline statistics
 *
 * Intelligence API — External Intelligence Endpoint
 *
 * Batch enrichment with job tracking. GET returns pipeline stats.
 * Non-throwing: standardized error responses.
 */

import { NextRequest } from 'next/server';
import { IntelligencePipeline } from '@/lib/intelligence-pipeline';
import { db } from '@/lib/db';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { utilityGuard, RateLimitedError } from '@/lib/intelligence-api/guard';
import { scrubError } from '@/lib/intelligence-api/handler';

const batchSchema = z.object({
  companyIds: z.array(z.string().min(1)).min(1).max(100),
  batchId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  let correlationId;
  let responseHeaders;
  try {
    const ctx = utilityGuard(request, 'enrich-batch');
    correlationId = ctx.correlationId;
    responseHeaders = ctx.responseHeaders;
  } catch (rlErr) {
    if (rlErr instanceof RateLimitedError) {
      return new Response(JSON.stringify(rlErr.errorBody), { status: 429, headers: rlErr.headers });
    }
    throw rlErr;
  }

  const startedAt = Date.now();

  try {
    const body = await request.json();
    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: 'Invalid request: companyIds (1-100 strings) required', meta: { endpoint: 'enrich-batch', durationMs: Date.now() - startedAt } },
        { status: 400 },
      );
    }

    const { companyIds, batchId } = parsed.data;

    // Verify companies exist
    const existingCompanies = await db.company.findMany({
      where: { id: { in: companyIds } },
      select: { id: true },
    });
    const validIds = existingCompanies.map(c => c.id);

    if (validIds.length === 0) {
      return Response.json(
        { success: false, error: 'No valid companies found', meta: { endpoint: 'enrich-batch', durationMs: Date.now() - startedAt } },
        { status: 404 },
      );
    }

    logger.info('[intelligence/enrich-batch] Batch enrichment', { count: validIds.length });
    const { results, jobId } = await IntelligencePipeline.enrichBatch(validIds, { batchId });

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const signalsCreated = results.reduce((sum, r) => sum + r.signalsCreated, 0);
    const evidenceCreated = results.reduce((sum, r) => sum + r.evidenceCreated, 0);

    return Response.json({
      success: true,
      data: {
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
      },
      meta: { endpoint: 'enrich-batch', durationMs: Date.now() - startedAt },
    });
  } catch (err) {
    const message = scrubError(err instanceof Error ? err.message : 'Batch enrichment failed');
    logger.error('[intelligence/enrich-batch]', { detail: message });
    return Response.json(
      { success: false, error: message, meta: { endpoint: 'enrich-batch', durationMs: Date.now() - startedAt } },
      { status: 502 },
    );
  }
}

export async function GET() {

  const startedAt = Date.now();

  try {
    const stats = await IntelligencePipeline.getStats();
    return Response.json({
      success: true,
      data: stats,
      meta: { endpoint: 'enrich-batch', durationMs: Date.now() - startedAt },
    });
  } catch (err) {
    const message = scrubError(err instanceof Error ? err.message : 'Failed to get pipeline stats');
    logger.error('[intelligence/enrich-batch] GET failed', { detail: message });
    return Response.json(
      { success: false, error: message, meta: { endpoint: 'enrich-batch', durationMs: Date.now() - startedAt } },
      { status: 502 },
    );
  }
}
