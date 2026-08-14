/**
 * Structured JSON logger for production.
 * Falls back to colorized console in development.
 *
 * Phase G enhancements:
 * - correlationId and requestId auto-injected from AsyncLocalStorage
 * - service and deployment fields in every log entry
 * - requestLogger factory for pre-bound request-scoped loggers
 */

import { env } from '@/lib/env-config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  service: string
  deployment: {
    environment: string
    slot: string
    region: string
  }
  correlationId?: string
  requestId?: string
  traceId?: string
  [key: string]: unknown
}

const isDev = !env.isProduction;
const SERVICE_NAME = env.otelServiceName;

// ── Deployment context (computed once at module load) ──
const DEPLOYMENT_CONTEXT = {
  environment: env.deployEnvironment,
  slot: env.deploySlot,
  region: env.deployRegion,
}

// ── Trace Context (legacy — kept for backward compat) ──
let _traceContext: { traceId?: string } = {}

/**
 * Set the current trace context for automatic injection into log entries.
 * Called by tracing middleware or instrumentation.
 * @deprecated Prefer using requestContextStorage from @/lib/request-context
 */
export function setTraceContext(ctx: { traceId?: string }): void {
  _traceContext = ctx
}

/**
 * Get the current trace ID for log enrichment.
 * @deprecated Prefer using getRequestContext() from @/lib/request-context
 */
export function getTraceId(): string | undefined {
  return _traceContext.traceId
}

// ── Safe Write (avoids recursion if logger is used in error-handling paths) ──
function safeWrite(formatted: string, colorFormatted?: string): void {
  try {
    if (isDev && colorFormatted) {
      console.log(colorFormatted)
    } else {
      console.log(formatted)
    }
  } catch {
    // Last resort — if console itself fails, silently drop
  }
}

function formatEntry(entry: LogEntry): string {
  return JSON.stringify(entry)
}

/**
 * Read request context from AsyncLocalStorage if available.
 * Lazy import to avoid circular dependencies.
 */
function getRequestFields(): { correlationId?: string; requestId?: string; traceId?: string } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@/lib/request-context');
    const getRequestContext = mod?.getRequestContext;
    if (typeof getRequestContext !== 'function') return {};
    const ctx = getRequestContext();
    if (ctx) {
      return {
        correlationId: ctx.correlationId,
        requestId: ctx.requestId,
        traceId: ctx.traceId,
      };
    }
  } catch {
    // request-context module not available (Edge runtime, etc.)
  }
  return {}
}

function log(level: LogLevel, message: string, meta: Record<string, unknown> = {}) {
  const requestFields = getRequestFields()

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: SERVICE_NAME,
    deployment: DEPLOYMENT_CONTEXT,
    ...requestFields,
    // Allow meta to override request fields if explicitly provided
    ...meta,
  }

  // Inject traceId from legacy trace context (backward compat)
  if (_traceContext.traceId && !entry.traceId) {
    entry.traceId = _traceContext.traceId
  }

  // Sentry integration for error/fatal levels with an Error object
  if ((level === 'error' || level === 'fatal') && meta?.error instanceof Error) {
    // Fire-and-forget Sentry capture
    import('@sentry/nextjs').then(Sentry => {
      Sentry.captureException(meta.error, { extra: { message, ...meta } })
    }).catch(() => { /* Sentry not available */ })
  }

  if (isDev) {
    const colors: Record<LogLevel, string> = {
      debug: '\x1b[36m',
      info: '\x1b[32m',
      warn: '\x1b[33m',
      error: '\x1b[31m',
      fatal: '\x1b[35m',
    }
    const reset = '\x1b[0m'
    safeWrite(formatEntry(entry), `${colors[level]}[${level.toUpperCase()}]${reset} ${message}`)
  } else {
    safeWrite(formatEntry(entry))
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => log('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
  fatal: (message: string, meta?: Record<string, unknown>) => log('fatal', message, meta),
}

// Request logger middleware helper
export function logRequest(method: string, path: string, status: number, durationMs: number, ip?: string, correlationId?: string) {
  const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'
  logger[level](`${method} ${path} ${status}`, {
    method,
    path,
    status,
    durationMs,
    ip,
    correlationId,
  })
}

export function childLogger(context: Record<string, unknown>) {
  return {
    debug: (message: string, meta?: Record<string, unknown>) => log('debug', message, { ...context, ...meta }),
    info: (message: string, meta?: Record<string, unknown>) => log('info', message, { ...context, ...meta }),
    warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, { ...context, ...meta }),
    error: (message: string, meta?: Record<string, unknown>) => log('error', message, { ...context, ...meta }),
    fatal: (message: string, meta?: Record<string, unknown>) => log('fatal', message, { ...context, ...meta }),
  }
}

/**
 * Create a request-scoped logger with pre-bound correlation/request/trace IDs.
 * Useful in API route handlers where context is already established.
 *
 * @example
 * ```ts
 * const reqLogger = requestLogger({ correlationId: 'abc', route: '/api/users' })
 * reqLogger.info('User list fetched', { count: 42 })
 * // Output includes correlationId and route in every entry
 * ```
 */
export function requestLogger(
  context: {
    correlationId?: string
    requestId?: string
    traceId?: string
    route?: string
    userId?: string
  } = {}
) {
  const baseContext = {
    ...context,
    // Merge any active AsyncLocalStorage context
    ...getRequestFields(),
  }
  // Remove undefined keys for cleaner output
  const cleanContext: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(baseContext)) {
    if (v !== undefined) cleanContext[k] = v
  }
  return childLogger(cleanContext)
}
