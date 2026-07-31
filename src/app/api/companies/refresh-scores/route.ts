/**
 * POST /api/companies/refresh-scores
 *
 * T6 Backend: Batch intelligence score refresh.
 * Triggers recomputation of Account Priority Scores for all (or selected) companies.
 * Uses the engine's computeAllAccountPriorities for batch processing.
 *
 * Body: { companyIds?: string[] } — empty/absent = refresh all, array = refresh selected
 * Response: { success: true, computed: number, duration: number }
 */

import { NextResponse } from 'next/server';
import { computeAllAccountPriorities, invalidateSupportingDataCache } from '@/lib/account-prioritization/engine';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const body = await request.json().catch(() => ({}));
    const { companyIds } = body as { companyIds?: string[] };

    // Invalidate cache to force fresh computation
    if (companyIds?.length) {
      companyIds.forEach(id => invalidateSupportingDataCache(id));
    } else {
      invalidateSupportingDataCache();
    }

    let computed: number;

    if (companyIds?.length) {
      // Refresh selected companies
      const { computeAccountPriority } = await import('@/lib/account-prioritization/engine');
      const results = await Promise.allSettled(
        companyIds.map(id => computeAccountPriority(id, 'batch'))
      );
      computed = results.filter(r => r.status === 'fulfilled').length;
    } else {
      // Refresh all companies
      const result = await computeAllAccountPriorities();
      computed = result.computed;
    }

    const duration = Date.now() - startedAt;
    logger.info(`[refresh-scores] Computed ${computed} company scores in ${duration}ms`);

    return NextResponse.json({
      success: true,
      computed,
      duration,
    });
  } catch (error) {
    logger.error('[refresh-scores] Batch score refresh failed:', { error });
    return NextResponse.json(
      { success: false, error: 'Batch score refresh failed' },
      { status: 500 }
    );
  }
}
