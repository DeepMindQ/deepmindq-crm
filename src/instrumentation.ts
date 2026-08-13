export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Sentry initialization
    try {
      await import('../sentry.server.config');
    } catch {
      // Sentry not configured
    }
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    try {
      await import('../sentry.edge.config');
    } catch {
      // Sentry not configured
    }
  }
}
