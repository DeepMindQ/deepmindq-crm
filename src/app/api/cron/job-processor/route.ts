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
 * 7. Run autonomous monitoring with persistence (WI-3)
 * 8. Generate operational pipeline alerts (WI-3)
 * 9. Run cross-account analysis with persistence (WI-4)
 * 10. Run prediction batch with persistence (WI-4)
 * 11. Run learning loop with persistence (WI-5)
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

    // Step 6: Run autonomous monitoring with persistence (WI-3)
    try {
      const { runMonitoringBatchWithPersistence } = await import('@/lib/intelligence-sources/autonomous-monitor');
      const activeCompanies = await (await import('@/lib/db')).db.company.findMany({
        where: { status: 'active' },
        select: { id: true },
      });
      const companyIds = activeCompanies.map((c: { id: string }) => c.id);
      // Batch in groups of 10 to avoid Vercel function timeout
      const BATCH_SIZE = 10;
      let totalPersisted = 0;
      let totalScanned = 0;
      for (let i = 0; i < companyIds.length; i += BATCH_SIZE) {
        const batch = companyIds.slice(i, i + BATCH_SIZE);
        const { persistedCount } = await runMonitoringBatchWithPersistence(batch);
        totalScanned += batch.length;
        totalPersisted += persistedCount;
      }
      results.monitoring = { companiesScanned: totalScanned, alertsGenerated: totalPersisted };
    } catch (err) {
      logger.warn('[cron] Monitoring analysis failed:', { error: err });
      results.monitoring = { error: 'Monitoring engine not available' };
    }

    // Step 7: Generate operational pipeline alerts (WI-3)
    try {
      const { autoGenerateAlerts } = await import('@/lib/intelligence-sources/intelligence-alerts');
      const opResult = await autoGenerateAlerts();
      results.operationalAlerts = { created: opResult.created };
    } catch (err) {
      logger.warn('[cron] Operational alert generation failed:', { error: err });
      results.operationalAlerts = { error: 'Operational alert engine not available' };
    }

    // Step 8: Run cross-account analysis with persistence (WI-4)
    try {
      const { runCrossAccountAnalysisWithPersistence } = await import('@/lib/intelligence-sources/autonomous-monitor');
      const activeCompanies = await (await import('@/lib/db')).db.company.findMany({
        where: { status: 'active' },
        select: { id: true },
      });
      const allCompanyIds = activeCompanies.map((c: { id: string }) => c.id);
      if (allCompanyIds.length >= 2) {
        const { insights, persistedCount } = await runCrossAccountAnalysisWithPersistence(allCompanyIds);
        results.crossAccountAnalysis = { patternsDetected: insights.length, alertsPersisted: persistedCount };
      } else {
        results.crossAccountAnalysis = { skipped: 'Fewer than 2 active companies' };
      }
    } catch (err) {
      logger.warn('[cron] Cross-account analysis failed:', { error: err });
      results.crossAccountAnalysis = { error: 'Cross-account engine not available' };
    }

    // Step 9: Run prediction batch with persistence (WI-4)
    try {
      const { runPredictionBatchWithPersistence } = await import('@/lib/intelligence-sources/autonomous-monitor');
      // Top 20 companies by intelligenceScore to manage computation cost
      const topCompanies = await (await import('@/lib/db')).db.company.findMany({
        where: { status: 'active', intelligenceScore: { gte: 0 } },
        orderBy: { intelligenceScore: 'desc' },
        take: 20,
        select: { id: true },
      });
      const topCompanyIds = topCompanies.map((c: { id: string }) => c.id);
      if (topCompanyIds.length > 0) {
        const { persistedCount } = await runPredictionBatchWithPersistence(topCompanyIds);
        results.predictionBatch = { companiesAnalyzed: topCompanyIds.length, alertsPersisted: persistedCount };
      } else {
        results.predictionBatch = { skipped: 'No companies with intelligence scores' };
      }
    } catch (err) {
      logger.warn('[cron] Prediction batch failed:', { error: err });
      results.predictionBatch = { error: 'Prediction engine not available' };
    }

    // Step 10: Run learning loop with persistence (WI-5)
    try {
      const { runLearningLoopWithPersistence } = await import('@/lib/intelligence-sources/autonomous-monitor');
      const { insights, persistedCount } = await runLearningLoopWithPersistence();
      results.learningLoop = { insightsAnalyzed: insights.length, qualityAlerts: persistedCount };
    } catch (err) {
      logger.warn('[cron] Learning loop failed:', { error: err });
      results.learningLoop = { error: 'Learning loop engine not available' };
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
