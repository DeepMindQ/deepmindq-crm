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
