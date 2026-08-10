import { clearAllTimers, registerTimer } from '@/lib/timer-registry';
import { logger } from '@/lib/logger';

let _shutdownRegistered = false;

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');

    // Initialize OpenTelemetry SDK (optional — graceful fallback if packages missing)
    try {
      const { registerNodeOTel } = await import('../instrumentation-node');
      await registerNodeOTel();
    } catch (err) {
      logger.info('[startup] OpenTelemetry SDK not available, using lightweight tracing fallback');
    }

    // Start periodic metrics persistence (every 5 minutes)
    try {
      const { startMetricsPersistence } = await import('@/lib/monitoring');
      startMetricsPersistence(5 * 60 * 1000);
      logger.info('[startup] Metrics persistence started (5-minute interval)');
    } catch (err) {
      logger.error('[startup] Failed to start metrics persistence (non-fatal)', { error: err });
    }
    // Start periodic alert evaluation (every 60 seconds)
    try {
      const { evaluateAlerts, collectSystemMetrics } = await import('@/lib/monitoring');
      const alertInterval = setInterval(() => {
        collectSystemMetrics();
        const triggered = evaluateAlerts();
        if (triggered.length > 0) {
          logger.info(`[startup] Alert evaluation triggered ${triggered.length} alert(s)`, { triggeredCount: triggered.length });
        }
      }, 60 * 1000);
      if (alertInterval.unref) alertInterval.unref();
      registerTimer(alertInterval);
      logger.info('[startup] Periodic alert evaluation started (60-second interval)');
    } catch (err) {
      logger.error('[startup] Failed to start alert evaluation (non-fatal)', { error: err });
    }
    // Validate environment variables at startup
    const { validateEnv } = await import('@/lib/validate-env');
    try {
      validateEnv();
    } catch (err) {
      logger.error('[startup] Environment validation failed', { error: err });
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
      logger.error('[startup] Failed to wire map state provider', { error: err });
    }

    try {
      const { executeColdStartLoad } = await import('@/lib/persistence/cold-start-loader');
      const report = await executeColdStartLoad();
      logger.info(
        `[startup] Persistence cold-start complete: status=${report.status}, ` +
        `completeness=${(report.overallCompleteness * 100).toFixed(1)}%, ` +
        `duration=${report.startupDurationMs}ms`
      );
    } catch (err) {
      logger.error('[startup] Persistence cold-start failed (non-fatal, Maps start empty)', { error: err });
    }

    // Start shadow-mode comparator if enabled (runs reconciliation every 5 min)
    try {
      const { startShadowModeComparator } = await import('@/lib/persistence/shadow-mode-comparator');
      startShadowModeComparator();
    } catch (err) {
      logger.error('[startup] Failed to start shadow-mode comparator (non-fatal)', { error: err });
    }

    // Pre-load scoring config from DB so the cache is warm
    try {
      const { getScoringConfig } = await import('@/lib/scoring-config');
      const config = await getScoringConfig();
      logger.info(`[startup] Scoring config loaded: tiers=${JSON.stringify(config.tierThresholds)}, recencyDays=${config.signalRecencyDays}`);
    } catch (err) {
      logger.error('[startup] Failed to pre-load scoring config (non-fatal, using defaults)', { error: err });
    }

    // Bridge API observability metrics into main monitoring (30-second flush)
    try {
      const { startApiMetricsBridge } = await import('@/lib/api-auto-observability');
      startApiMetricsBridge(30 * 1000);
      logger.info('[startup] API metrics bridge started (30-second interval)');
    } catch (err) {
      logger.error('[startup] Failed to start API metrics bridge (non-fatal)', { error: err });
    }

    // Phase 3.2: Periodic calibration health check (every 6 hours)
    try {
      const { checkCalibrationHealth } = await import('@/lib/confidence-calibration-engine');
      const calibrationInterval = setInterval(async () => {
        try {
          const health = await checkCalibrationHealth();
          if (health.needsAttention) {
            logger.warn(`[calibration] Recalibration needed: ${health.dimensions.filter(d => d.ece > 0.1).map(d => `${d.dimension} (ECE=${d.ece})`).join(', ')}`);
          }
        } catch (err) {
          logger.error('[calibration] Periodic check failed (non-fatal)', { error: err });
        }
      }, 6 * 60 * 60 * 1000);
      if (calibrationInterval.unref) calibrationInterval.unref();
      registerTimer(calibrationInterval);
      logger.info('[startup] Calibration health check started (6-hour interval)');
    } catch (err) {
      logger.error('[startup] Failed to start calibration health check (non-fatal)', { error: err });
    }

    // ── S5-3.4: Prompt Registry Persistence & Tracing Sync ──
    try {
      const { initializePromptPersistence } = await import('@/lib/prompt-registry-persistence');
      initializePromptPersistence();
    } catch (err) {
      logger.error('[startup] Failed to initialize prompt persistence (non-fatal)', { error: err });
    }

    // ── P3.6: A/B Testing Experiment Persistence & Cold-Start ──
    try {
      const { loadExperimentsFromDB, startExperimentMetricsFlush } = await import('@/lib/prompt-ab-testing');
      const loaded = await loadExperimentsFromDB();
      logger.info(`[startup] A/B testing: ${loaded} experiments restored from DB`);

      startExperimentMetricsFlush(5 * 60 * 1000);
      logger.info('[startup] A/B testing metrics flush started (5-minute interval)');
    } catch (err) {
      logger.error('[startup] Failed to initialize A/B testing persistence (non-fatal)', { error: err });
    }

    // Phase 3.5: Periodic evidence chain validation (daily at startup + every 24 hours)
    try {
      const { validateEvidenceChains } = await import('@/lib/evidence-chain-validator');

      // Run initial validation at startup (lightweight)
      (async () => {
        try {
          const report = await validateEvidenceChains();
          if (report.needsAttention) {
            logger.warn(`[startup] Evidence validation found ${report.decayRate}% decay rate at startup`);
          }
        } catch (err) {
          logger.error('[startup] Initial evidence validation failed (non-fatal)', { error: err });
        }
      })();

      // Schedule recurring validation every 24 hours
      const evidenceValidationInterval = setInterval(async () => {
        try {
          const report = await validateEvidenceChains();
          if (report.needsAttention) {
            logger.warn(`[evidence-validator] Scheduled validation: decay rate ${report.decayRate}% exceeds threshold`);
          }
        } catch (err) {
          logger.error('[evidence-validator] Scheduled validation failed (non-fatal)', { error: err });
        }
      }, 24 * 60 * 60 * 1000);
      if (evidenceValidationInterval.unref) evidenceValidationInterval.unref();
      registerTimer(evidenceValidationInterval);
      logger.info('[startup] Evidence chain validation started (24-hour interval)');
    } catch (err) {
      logger.error('[startup] Failed to start evidence chain validation (non-fatal)', { error: err });
    }

    // ── P4.2: CRM token refresh automation (every 5 minutes) ──
    try {
      const crmTokenRefreshInterval = setInterval(async () => {
        try {
          const { db } = await import('@/lib/db');
          const { getConnectorForProvider } = await import('@/lib/crm/crm-connector');

          // Find connections where token expires within 5 minutes
          const soonExpiring = await db.cRMConnection.findMany({
            where: {
              isActive: true,
              tokenExpiresAt: {
                lte: new Date(Date.now() + 5 * 60 * 1000),
                gt: new Date(),
              },
            },
          });

          for (const conn of soonExpiring) {
            try {
              const connector = getConnectorForProvider(conn.provider);
              if (connector) {
                await connector.refreshToken({
                  accessToken: conn.accessToken!,
                  refreshToken: conn.refreshToken!,
                  instanceUrl: conn.instanceUrl ?? undefined,
                });
                logger.info(`[crm] Token refreshed for ${conn.provider} connection ${conn.id}`);
              }
            } catch (refreshErr) {
              logger.error(`[crm] Token refresh failed for ${conn.provider} connection ${conn.id}`, { error: refreshErr });
              // Deactivate connection on refresh failure (safety)
              await db.cRMConnection.update({
                where: { id: conn.id },
                data: { isActive: false },
              });
            }
          }
        } catch (err) {
          logger.error('[crm] Token refresh check failed (non-fatal)', { error: err });
        }
      }, 5 * 60 * 1000);
      if (crmTokenRefreshInterval.unref) crmTokenRefreshInterval.unref();
      registerTimer(crmTokenRefreshInterval);
      logger.info('[startup] CRM token refresh automation started (5-minute interval)');
    } catch (err) {
      logger.error('[startup] Failed to start CRM token refresh (non-fatal)', { error: err });
    }

    // Phase 4.3: Webhook retry queue processor (every 30 seconds)
    try {
      const { processRetryQueue } = await import('@/lib/webhook-reliability');
      const webhookRetryInterval = setInterval(async () => {
        try {
          await processRetryQueue();
        } catch (err) {
          logger.error('[webhook-retry] Retry queue processing failed (non-fatal)', { error: err });
        }
      }, 30 * 1000);
      if (webhookRetryInterval.unref) webhookRetryInterval.unref();
      registerTimer(webhookRetryInterval);
      logger.info('[startup] Webhook retry queue processor started (30-second interval)');
    } catch (err) {
      logger.error('[startup] Failed to start webhook retry processor (non-fatal)', { error: err });
    }

    // Register graceful shutdown
    if (!_shutdownRegistered) {
      _shutdownRegistered = true;
      const shutdown = async (signal: string) => {
        logger.info(`[shutdown] Received ${signal}, cleaning up...`);
        // Clear all registered interval timers
        clearAllTimers();
        // Flush Sentry
        try {
          const Sentry = (await import('@sentry/nextjs')).default;
          await Sentry.close(2000);
        } catch { /* Sentry not available */ }
        logger.info('[shutdown] Cleanup complete, exiting.');
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
