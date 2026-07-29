import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * GET /api/cron/job-processor
 *
 * Called by Vercel Cron daily (6 AM) to run intelligence maintenance:
 * 1. Process pending workflow jobs
 * 2. Recover stale jobs (running > 30 min)
 * 3. Update intelligence freshness scores
 * 4. Run evidence lifecycle management
 * 5. Propagate cross-account signals
 * 6. Run scheduled intelligence connectors
 *
 * Vercel Cron config is in vercel.json (crons array).
 * Set CRON_SECRET env var in Vercel to secure this endpoint.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const startTime = Date.now();
  const results: Record<string, any> = {};

  try {
    // Step 1: Recover stale workflow jobs
    try {
      const { recoverStaleJobs, processNextJobs } = await import('@/lib/workflow-engine');
      const recovered = await recoverStaleJobs(30);
      const jobResult = await processNextJobs(5);
      results.jobs = { recovered, ...jobResult };
    } catch (err) {
      logger.warn('[cron] Job processing failed:', { error: err });
      results.jobs = { error: 'Job engine not available' };
    }

    // Step 2: Update intelligence freshness scores
    try {
      const { batchUpdateFreshness } = await import('@/lib/intelligence-sources/freshness-manager');
      const freshnessUpdated = await batchUpdateFreshness();
      results.freshness = { updated: freshnessUpdated };
    } catch (err) {
      logger.warn('[cron] Freshness update failed:', { error: err });
      results.freshness = { error: 'Freshness manager not available' };
    }

    // Step 3: Evidence lifecycle management
    // (evidence-lifecycle module removed in Phase 2 — evidence lifecycle
    //  is now handled inline by freshness-manager)
    results.evidenceLifecycle = { skipped: 'Module consolidated into freshness-manager' };

    // Step 4: Cross-account signal propagation
    // (cross-account-propagation module removed in Phase 2 — cross-account
    //  patterns are detected on-demand via detectCrossAccountPatterns)
    results.crossAccountPropagation = { skipped: 'Module removed — use on-demand detection' };

    // Step 5: Run scheduled intelligence connectors
    try {
      const { runAllDueConnectors } = await import('@/lib/intelligence-sources/connector-scheduler');
      const connectorResult = await runAllDueConnectors();
      results.connectors = connectorResult;
    } catch (err) {
      logger.warn('[cron] Connector scheduling failed:', { error: err });
      results.connectors = { error: 'Connector scheduler not available' };
    }

    const duration = Date.now() - startTime;
    logger.info(`[cron/job-processor] Complete in ${duration}ms`, { error: JSON.stringify(results) });

    return NextResponse.json({
      ok: true,
      duration_ms: duration,
      ...results,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`[cron/job-processor] Failed (${Date.now() - startTime}ms):`, { detail: msg });
    return NextResponse.json({ ok: false, error: msg, results }, { status: 500 });
  }
}
