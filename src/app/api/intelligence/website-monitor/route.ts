/**
 * POST /api/intelligence/website-monitor — Detect website changes
 *
 * Intelligence API — External Intelligence Endpoint
 *
 * Accepts a companyId to monitor website changes using
 * web search + governedAICall for change detection.
 *
 * Non-throwing: standardized error responses.
 */

import { NextRequest } from 'next/server';
import { monitorCompanyWebsite } from '@/lib/intelligence-sources/website-monitor/engine';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  try {
    const body = await req.json();
    const { companyId } = body;

    if (!companyId) {
      return Response.json(
        { success: false, error: 'companyId required', meta: { endpoint: 'website-monitor', durationMs: Date.now() - startedAt } },
        { status: 400 },
      );
    }

    logger.info('[intelligence/website-monitor] Monitoring', { companyId });
    const results = await monitorCompanyWebsite(companyId);
    const changesDetected = results.filter(r => r.hasChanged);

    return Response.json({
      success: true,
      data: {
        pagesMonitored: results.length,
        changesDetected: changesDetected.length,
        results,
      },
      meta: { endpoint: 'website-monitor', durationMs: Date.now() - startedAt },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[intelligence/website-monitor] Error', { error: message });
    return Response.json(
      { success: false, error: 'Website monitoring failed', details: message, meta: { endpoint: 'website-monitor', durationMs: Date.now() - startedAt } },
      { status: 502 },
    );
  }
}
