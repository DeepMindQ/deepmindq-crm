import { clearAllTimers } from '@/lib/timer-registry';

let _shutdownRegistered = false;

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
    // Validate environment variables at startup
    const { validateEnv } = await import('@/lib/validate-env');
    try {
      validateEnv();
    } catch (err) {
      console.error('[startup] Environment validation failed:', err);
      // In production, exit. In development, warn and continue.
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    }

    // ── WI-18.2 Phase 3: Persistence Cold-Start Initialization ──
    // Wire the map state provider (enables shadow-mode reconciliation)
    // and execute cold-start load (populates in-memory Maps from DB).
    try {
      const { wireMapStateProvider } = await import('@/lib/persistence/map-state-provider');
      wireMapStateProvider();
    } catch (err) {
      console.error('[startup] Failed to wire map state provider:', err);
    }

    try {
      const { executeColdStartLoad } = await import('@/lib/persistence/cold-start-loader');
      const report = await executeColdStartLoad();
      console.log(
        `[startup] Persistence cold-start complete: status=${report.status}, ` +
        `completeness=${(report.overallCompleteness * 100).toFixed(1)}%, ` +
        `duration=${report.startupDurationMs}ms`
      );
    } catch (err) {
      console.error('[startup] Persistence cold-start failed (non-fatal, Maps start empty):', err);
    }

    // Pre-load scoring config from DB so the cache is warm
    try {
      const { getScoringConfig } = await import('@/lib/scoring-config');
      const config = await getScoringConfig();
      console.log(`[startup] Scoring config loaded: tiers=${JSON.stringify(config.tierThresholds)}, recencyDays=${config.signalRecencyDays}`);
    } catch (err) {
      console.error('[startup] Failed to pre-load scoring config (non-fatal, using defaults):', err);
    }

    // Register graceful shutdown
    if (!_shutdownRegistered) {
      _shutdownRegistered = true;
      const shutdown = async (signal: string) => {
        console.log(`[shutdown] Received ${signal}, cleaning up...`);
        // Clear all registered interval timers
        clearAllTimers();
        // Flush Sentry
        try {
          const Sentry = (await import('@sentry/nextjs')).default;
          await Sentry.close(2000);
        } catch { /* Sentry not available */ }
        console.log('[shutdown] Cleanup complete, exiting.');
        process.exit(0);
      };
      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));
    }
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}
