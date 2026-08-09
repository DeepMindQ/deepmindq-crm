/**
 * POST /api/intelligence/internal-memory
 *
 * Intelligence API — Internal Memory Endpoint
 *
 * Extracts intelligence signals from internal CRM data (notes, meetings,
 * timeline, human intel, account strategy) and optionally persists them.
 *
 * Non-throwing: standardized error responses.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { extractInternalMemorySignals, computeInternalMemoryDepth } from '@/lib/intelligence-sources/internal-memory-connector';
import { logger } from '@/lib/logger';
import { utilityGuard, RateLimitedError, utilityError, utilityCatchError, utilitySuccess } from '@/lib/intelligence-api/guard';
import { z } from 'zod';
import { companyIdSchema } from '@/lib/intelligence-api/validators';
import { checkApiAuth } from '@/lib/api-auth';

const internalMemoryBodySchema = z.object({
  companyId: companyIdSchema,
});

export async function POST(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

let ctx: Awaited<ReturnType<typeof utilityGuard>>;
  try {
    ctx = utilityGuard(request, 'internal-memory');
  } catch (rlErr) {
    if (rlErr instanceof RateLimitedError) {
      return new Response(JSON.stringify(rlErr.errorBody), { status: 429, headers: rlErr.headers });
    }
    throw rlErr;
  }

  const startedAt = Date.now();

  try {
    const body = await request.json();
    const parsed = internalMemoryBodySchema.safeParse(body);
    if (!parsed.success) {
      return utilityError(ctx, 400, `Validation failed: ${parsed.error.issues[0]?.message}`, 'VALIDATION_FAILED', Date.now() - startedAt);
    }
    const { companyId } = parsed.data;

    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { id: true, rawName: true, normalizedName: true, industry: true, sizeRange: true },
    });

    if (!company) {
      return utilityError(ctx, 404, 'Company not found', 'NOT_FOUND', Date.now() - startedAt);
    }

    const result = await extractInternalMemorySignals(companyId);
    const depth = await computeInternalMemoryDepth(companyId);

    return utilitySuccess(ctx, {
      company: {
        id: company.id,
        name: company.normalizedName || company.rawName,
        industry: company.industry,
        sizeRange: company.sizeRange,
      },
      signals: result.signals.slice(0, 20),
      sources: result.sources,
      memoryDepth: depth,
      meta: {
        totalSignalsExtracted: result.signalsExtracted,
        signalsPersisted: result.signalsPersisted,
        pipelineLatencyMs: Date.now() - startedAt,
      },
    }, 'internal-memory', Date.now() - startedAt);
  } catch (err) {
    return utilityCatchError(ctx, err, 502, 'INTELLIGENCE_UNAVAILABLE', 'Internal memory extraction failed', Date.now() - startedAt);
  }
}
