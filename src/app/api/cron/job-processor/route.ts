import { NextResponse } from 'next/server';

/**
 * GET /api/cron/job-processor
 *
 * Called by Vercel Cron daily (6 AM) to run intelligence maintenance:
 * 1. Process pending workflow jobs
 * 2. Recover stale jobs (running > 30 min)
 * 3. Update intelligence freshness scores
 * 4. Run evidence lifecycle management
 * 5. Propagate cross-account signals
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
      console.warn('[cron] Job processing failed:', err);
      results.jobs = { error: 'Job engine not available' };
    }

    // Step 2: Update intelligence freshness scores
    try {
      const { batchUpdateFreshness } = await import('@/lib/intelligence-sources/freshness-manager');
      const freshnessUpdated = await batchUpdateFreshness();
      results.freshness = { updated: freshnessUpdated };
    } catch (err) {
      console.warn('[cron] Freshness update failed:', err);
      results.freshness = { error: 'Freshness manager not available' };
    }

    // Step 3: Evidence lifecycle management
    try {
      const { runEvidenceLifecycle } = await import('@/lib/intelligence-sources/evidence-lifecycle');
      const lifecycleStats = await runEvidenceLifecycle();
      results.evidenceLifecycle = lifecycleStats;
    } catch (err) {
      console.warn('[cron] Evidence lifecycle failed:', err);
      results.evidenceLifecycle = { error: 'Evidence lifecycle not available' };
    }

    // Step 4: Cross-account signal propagation
    try {
      const { propagateCrossAccountSignals } = await import('@/lib/intelligence-sources/cross-account-propagation');
      const propagated = await propagateCrossAccountSignals();
      results.crossAccountPropagation = propagated;
    } catch (err) {
      console.warn('[cron] Cross-account propagation failed:', err);
      results.crossAccountPropagation = { error: 'Propagation not available' };
    }

    const duration = Date.now() - startTime;
    console.log(`[cron/job-processor] Complete in ${duration}ms`, JSON.stringify(results));

    return NextResponse.json({
      ok: true,
      duration_ms: duration,
      ...results,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[cron/job-processor] Failed (${Date.now() - startTime}ms):`, msg);
    return NextResponse.json({ ok: false, error: msg, results }, { status: 500 });
  }
}
