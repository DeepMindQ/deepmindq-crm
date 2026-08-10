// Structured JSON logger for production
// Falls back to console in development

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  traceId?: string
  [key: string]: unknown
}

const isDev = process.env.NODE_ENV !== 'production'

// ── Trace Context ──
let _traceContext: { traceId?: string } = {}

/**
 * Set the current trace context for automatic injection into log entries.
 * Called by tracing middleware or instrumentation.
 */
export function setTraceContext(ctx: { traceId?: string }): void {
  _traceContext = ctx
}

/**
 * Get the current trace ID for log enrichment.
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

function log(level: LogLevel, message: string, meta: Record<string, unknown> = {}) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  }

  // Inject traceId from current trace context
  if (_traceContext.traceId) {
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
