import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.DEPLOY_ENVIRONMENT || process.env.NODE_ENV || 'development',
  release: process.env.NEXT_PUBLIC_BUILD_SHA || undefined,

  // 100% error sampling — capture ALL errors
  sampleRate: 1.0,

  // 10% transaction sampling — performance traces
  tracesSampleRate: 0.1,

  debug: process.env.NODE_ENV === 'development',

  // Rate limiting — prevent quota exhaustion from error storms
  maxBreadcrumbs: 50,

  // Before send hook to add deployment context
  beforeSend(event) {
    event.tags = {
      ...event.tags,
      deploySlot: process.env.DEPLOY_SLOT || 'none',
      region: process.env.DEPLOY_REGION || 'unknown',
      runtime: 'edge',
    }
    return event
  },

  // Ignore specific noisy errors
  ignoreErrors: [
    'CSRF validation failed',
    'Rate limited',
    'Unauthorized',
  ],
})
