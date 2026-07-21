// Structured JSON logger for production
// Falls back to console in development

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  [key: string]: unknown
}

const isDev = process.env.NODE_ENV !== 'production'

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

  if (isDev) {
    const colors: Record<LogLevel, string> = {
      debug: '\x1b[36m',
      info: '\x1b[32m',
      warn: '\x1b[33m',
      error: '\x1b[31m',
      fatal: '\x1b[35m',
    }
    const reset = '\x1b[0m'
    console.log(`${colors[level]}[${level.toUpperCase()}]${reset} ${message}`, meta)
  } else {
    console.log(formatEntry(entry))
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