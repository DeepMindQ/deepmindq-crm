/**
 * GET  /api/intelligence/refresh — Get freshness status or companies needing refresh
 * POST /api/intelligence/refresh — Trigger intelligence refresh
 *
 * Intelligence API — External Intelligence Endpoint
 *
 * Non-throwing: standardized error responses.
 */

import { NextRequest } from 'next/server';
import { getFreshnessStatus, getCompaniesNeedingRefresh, batchUpdateFreshness } from '@/lib/intelligence-sources/freshness-manager';
import { logger } from '@/lib/logger';
import { utilityGuard, RateLimitedError } from '@/lib/intelligence-api/guard';
import { scrubError } from '@/lib/intelligence-api/handler';

export async function GET(req: NextRequest) {
  let correlationId;
  let responseHeaders;
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

  const startedAt = Date.now();

  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');
    const batch = searchParams.get('batch');

    if (companyId) {
      const status = await getFreshnessStatus(companyId);
      if (!status) {
        return Response.json(
          { success: false, error: 'Company not found', meta: { endpoint: 'refresh', durationMs: Date.now() - startedAt } },
          { status: 404 },
        );
      }
      return Response.json({ success: true, data: status, meta: { endpoint: 'refresh', durationMs: Date.now() - startedAt } });
    }

    if (batch === 'true') {
      const needingRefresh = await getCompaniesNeedingRefresh();
      return Response.json({
        success: true,
        data: { companies: needingRefresh, count: needingRefresh.length },
        meta: { endpoint: 'refresh', durationMs: Date.now() - startedAt },
      });
    }

    return Response.json(
      { success: false, error: 'Provide companyId or batch=true', meta: { endpoint: 'refresh', durationMs: Date.now() - startedAt } },
      { status: 400 },
    );
  } catch (err) {
    const message = scrubError(err instanceof Error ? err.message : String(err));
    logger.error('[intelligence/refresh] GET Error', { error: message });
    return Response.json(
      { success: false, error: 'Freshness check failed', details: message, meta: { endpoint: 'refresh', durationMs: Date.now() - startedAt } },
      { status: 502 },
    );
  }
}

export async function POST(req: NextRequest) {
  let correlationId;
  let responseHeaders;
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

  const startedAt = Date.now();

  try {
    const body = await req.json();
    const { companyId, batchUpdate } = body;

    if (batchUpdate) {
      const updated = await batchUpdateFreshness();
      return Response.json({ success: true, data: { updated }, meta: { endpoint: 'refresh', durationMs: Date.now() - startedAt } });
    }

    if (companyId) {
      const { updateFreshnessAfterCollection } = await import('@/lib/intelligence-sources/freshness-manager');
      await updateFreshnessAfterCollection(companyId);
      const status = await getFreshnessStatus(companyId);
      return Response.json({ success: true, data: status, meta: { endpoint: 'refresh', durationMs: Date.now() - startedAt } });
    }

    return Response.json(
      { success: false, error: 'Provide companyId or batchUpdate: true', meta: { endpoint: 'refresh', durationMs: Date.now() - startedAt } },
      { status: 400 },
    );
  } catch (err) {
    const message = scrubError(err instanceof Error ? err.message : String(err));
    logger.error('[intelligence/refresh] POST Error', { error: message });
    return Response.json(
      { success: false, error: 'Intelligence refresh failed', details: message, meta: { endpoint: 'refresh', durationMs: Date.now() - startedAt } },
      { status: 502 },
    );
  }
}
