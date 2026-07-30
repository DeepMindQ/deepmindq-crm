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
import { utilityGuard, RateLimitedError, utilityError, utilityCatchError, utilitySuccess } from '@/lib/intelligence-api/guard';

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

  const ctx = { correlationId, responseHeaders };
  const startedAt = Date.now();

  try {
    const body = await request.json();
    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) {
      return utilityError(ctx, 400, 'Invalid request: companyIds (1-100 strings) required', 'INVALID_REQUEST', Date.now() - startedAt);
    }

    const { companyIds, batchId } = parsed.data;

    // Verify companies exist
    const existingCompanies = await db.company.findMany({
      where: { id: { in: companyIds } },
      select: { id: true },
    });
    const validIds = existingCompanies.map(c => c.id);

    if (validIds.length === 0) {
      return utilityError(ctx, 404, 'No valid companies found', 'NOT_FOUND', Date.now() - startedAt);
    }

    logger.info('[intelligence/enrich-batch] Batch enrichment', { count: validIds.length });
    const { results, jobId } = await IntelligencePipeline.enrichBatch(validIds, { batchId });

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const signalsCreated = results.reduce((sum, r) => sum + r.signalsCreated, 0);
    const evidenceCreated = results.reduce((sum, r) => sum + r.evidenceCreated, 0);

    const data = {
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
    };

    return utilitySuccess(ctx, data, 'enrich-batch', Date.now() - startedAt);
  } catch (err) {
    return utilityCatchError(ctx, err, 502, 'INTELLIGENCE_UNAVAILABLE', 'Batch enrichment failed', Date.now() - startedAt);
  }
}

export async function GET(request: NextRequest) {
  let correlationId: string;
  let responseHeaders: Record<string, string>;
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

  const ctx = { correlationId, responseHeaders };
  const startedAt = Date.now();

  try {
    const stats = await IntelligencePipeline.getStats();
    return utilitySuccess(ctx, stats, 'enrich-batch', Date.now() - startedAt);
  } catch (err) {
    return utilityCatchError(ctx, err, 502, 'INTELLIGENCE_UNAVAILABLE', 'Failed to get pipeline stats', Date.now() - startedAt);
  }
}
