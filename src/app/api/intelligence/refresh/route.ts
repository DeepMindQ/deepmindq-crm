/**
 * GET  /api/intelligence/refresh — Get freshness status or companies needing refresh
 * POST /api/intelligence/refresh — Trigger intelligence refresh
 *
 * Intelligence API — External Intelligence Endpoint
 *
 * Non-throwing: standardized error responses.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { companyIdSchema } from '@/lib/intelligence-api/validators';
import { getFreshnessStatus, getCompaniesNeedingRefresh, batchUpdateFreshness } from '@/lib/intelligence-sources/freshness-manager';
import { logger } from '@/lib/logger';
import { utilityGuard, RateLimitedError, utilityError, utilityCatchError, utilitySuccess } from '@/lib/intelligence-api/guard';
import { checkApiAuth } from '@/lib/api-auth';

const refreshGetQuerySchema = z.object({
  companyId: companyIdSchema.optional(),
  batch: z.enum(['true', 'false']).optional(),
}).refine(d => d.companyId || d.batch === 'true', {
  message: 'Provide companyId or batch=true',
});

const refreshPostBodySchema = z.object({
  companyId: companyIdSchema.optional(),
  batchUpdate: z.boolean().optional(),
}).refine(d => d.companyId || d.batchUpdate, {
  message: 'Provide companyId or batchUpdate: true',
});

export async function GET(req: NextRequest) {
  let correlationId;
  let responseHeaders;
  // ── Authentication + RBAC Guard ──
  const { errorResponse } = await checkApiAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const ctx = utilityGuard(req, 'refresh');
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
    const { searchParams } = new URL(req.url);
    const queryResult = refreshGetQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!queryResult.success) {
      return utilityError(ctx, 400, `Validation failed: ${queryResult.error.issues[0]?.message}`, 'VALIDATION_FAILED', Date.now() - startedAt);
    }
    const { companyId, batch } = queryResult.data;

    if (companyId) {
      const status = await getFreshnessStatus(companyId);
      if (!status) {
        return utilityError(ctx, 404, 'Company not found', 'NOT_FOUND', Date.now() - startedAt);
      }
      return utilitySuccess(ctx, status, 'refresh', Date.now() - startedAt);
    }

    // batch is guaranteed 'true' here (refine ensures companyId or batch=true)
    const needingRefresh = await getCompaniesNeedingRefresh();
    return utilitySuccess(ctx, { companies: needingRefresh, count: needingRefresh.length }, 'refresh', Date.now() - startedAt);
  } catch (err) {
    return utilityCatchError(ctx, err, 502, 'INTELLIGENCE_UNAVAILABLE', 'Freshness check failed', Date.now() - startedAt);
  }
}

export async function POST(req: NextRequest) {
  let correlationId;
  let responseHeaders;
  // ── Authentication + RBAC Guard ──
  const { errorResponse } = await checkApiAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const ctx = utilityGuard(req, 'refresh');
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
    const body = await req.json();
    const parsed = refreshPostBodySchema.safeParse(body);
    if (!parsed.success) {
      return utilityError(ctx, 400, `Validation failed: ${parsed.error.issues[0]?.message}`, 'VALIDATION_FAILED', Date.now() - startedAt);
    }
    const { companyId, batchUpdate } = parsed.data;

    if (batchUpdate) {
      const updated = await batchUpdateFreshness();
      return utilitySuccess(ctx, { updated }, 'refresh', Date.now() - startedAt);
    }

    if (companyId) {
      const { updateFreshnessAfterCollection } = await import('@/lib/intelligence-sources/freshness-manager');
      await updateFreshnessAfterCollection(companyId);
      const status = await getFreshnessStatus(companyId);
      return utilitySuccess(ctx, status, 'refresh', Date.now() - startedAt);
    }

    // Unreachable — refine guarantees companyId or batchUpdate is present
  } catch (err) {
    return utilityCatchError(ctx, err, 502, 'INTELLIGENCE_UNAVAILABLE', 'Intelligence refresh failed', Date.now() - startedAt);
  }
}
