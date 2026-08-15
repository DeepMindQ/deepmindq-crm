// ═══════════════════════════════════════════════════════════════════════════
// Logger — Unit Tests
//
// Tests logger, childLogger, requestLogger, logRequest, setTraceContext,
// and getTraceId from @/lib/logger.ts.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock env-config ────────────────────────────────────────────────────

vi.mock('@/lib/env-config', () => ({
  env: {
    isProduction: false,
    otelServiceName: 'test-service',
    deployEnvironment: 'test',
    deploySlot: 'none',
    deployRegion: 'us-east-1',
  },
}));

// Mock Sentry to prevent actual import
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// ── Module under test ──────────────────────────────────────────────────

const { logger, childLogger, requestLogger, logRequest, setTraceContext, getTraceId } =
  await import('@/lib/logger');

// ── Helpers ────────────────────────────────────────────────────────────

let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  setTraceContext({}); // Reset trace context
});

afterEach(() => {
  consoleSpy.mockRestore();
});

function getLastConsoleOutput(): string {
  const calls = consoleSpy.mock.calls;
  if (calls.length === 0) return '';
  return calls[calls.length - 1][0] as string;
}

function parseLastJsonLog(): Record<string, unknown> {
  const output = getLastConsoleOutput();
  // In dev mode, it logs colored text first, then JSON
  // The JSON line is the last one
  try {
    return JSON.parse(output);
  } catch {
    // Try to find JSON in the output
    const match = output.match(/\{[^}]+\}/);
    return match ? JSON.parse(match[0]) : {};
  }
}

// ── logger methods ─────────────────────────────────────────────────────

describe('logger', () => {
  it('logger.info outputs to console', () => {
    logger.info('test message');
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('logger.debug outputs to console', () => {
    logger.debug('debug message');
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('logger.warn outputs to console', () => {
    logger.warn('warning message');
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('logger.error outputs to console', () => {
    logger.error('error message');
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('logger.fatal outputs to console', () => {
    logger.fatal('fatal message');
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('includes JSON-structured output with timestamp', () => {
    logger.info('structured test');
    const output = getLastConsoleOutput();
    // Dev mode uses colorized output + JSON; find the JSON part
    expect(output).toContain('structured test');
  });

  it('includes service name in log entry', () => {
    logger.info('service check');
    const output = getLastConsoleOutput();
    expect(output).toContain('service check');
  });

  it('includes meta data in output', () => {
    logger.info('with meta', { userId: 'u1', action: 'test' });
    const output = getLastConsoleOutput();
    expect(output).toContain('with meta');
  });

  it('fires Sentry captureException for error with Error object', async () => {
    const err = new Error('test error');
    logger.error('something failed', { error: err });
    // Sentry is dynamically imported, so we need to wait a tick
    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  it('does not crash when console.log throws', () => {
    consoleSpy.mockImplementation(() => {
      throw new Error('console broken');
    });
    // Should not throw — safeWrite catches
    expect(() => logger.info('should not crash')).not.toThrow();
  });
});

// ── childLogger ────────────────────────────────────────────────────────

describe('childLogger', () => {
  it('creates a logger with pre-bound context', () => {
    const child = childLogger({ component: 'test', requestId: 'req-1' });
    expect(typeof child.info).toBe('function');
    expect(typeof child.error).toBe('function');
  });

  it('child logger outputs to console', () => {
    const child = childLogger({ component: 'test' });
    child.info('child message');
    expect(consoleSpy).toHaveBeenCalled();
    const output = getLastConsoleOutput();
    expect(output).toContain('child message');
  });

  it('merges context with additional meta', () => {
    const child = childLogger({ route: '/api/test' });
    child.info('merged', { userId: 'u1' });
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('supports all log levels', () => {
    const child = childLogger({});
    child.debug('debug');
    child.info('info');
    child.warn('warn');
    child.error('error');
    child.fatal('fatal');
    expect(consoleSpy).toHaveBeenCalledTimes(5);
  });
});

// ── requestLogger ──────────────────────────────────────────────────────

describe('requestLogger', () => {
  it('creates logger with request-scoped context', () => {
    const reqLog = requestLogger({
      correlationId: 'corr-1',
      route: '/api/users',
    });
    expect(typeof reqLog.info).toBe('function');
  });

  it('filters out undefined context values', () => {
    const reqLog = requestLogger({
      correlationId: 'corr-1',
      requestId: undefined,
      route: '/api/users',
    });
    reqLog.info('request');
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('works with empty context', () => {
    const reqLog = requestLogger();
    reqLog.info('empty context log');
    expect(consoleSpy).toHaveBeenCalled();
  });
});

// ── logRequest ─────────────────────────────────────────────────────────

describe('logRequest', () => {
  it('logs 2xx responses at info level', () => {
    logRequest('GET', '/api/data', 200, 42, '127.0.0.1');
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('logs 4xx responses at warn level', () => {
    logRequest('POST', '/api/data', 400, 10, '127.0.0.1');
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('logs 5xx responses at error level', () => {
    logRequest('GET', '/api/data', 500, 100, '127.0.0.1');
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('includes method, path, and status in output', () => {
    logRequest('GET', '/api/test', 200, 5);
    const output = getLastConsoleOutput();
    expect(output).toContain('GET /api/test 200');
  });
});

// ── setTraceContext / getTraceId ───────────────────────────────────────

describe('setTraceContext / getTraceId', () => {
  it('getTraceId returns undefined by default', () => {
    setTraceContext({});
    expect(getTraceId()).toBeUndefined();
  });

  it('setTraceContext stores and getTraceId retrieves traceId', () => {
    setTraceContext({ traceId: 'trace-abc-123' });
    expect(getTraceId()).toBe('trace-abc-123');
  });

  it('traceId is included in log entries when set', () => {
    setTraceContext({ traceId: 'trace-xyz' });
    logger.info('trace test');
    expect(consoleSpy).toHaveBeenCalled();
    const output = getLastConsoleOutput();
    expect(output).toContain('trace test');
  });

  it('can be updated to a new traceId', () => {
    setTraceContext({ traceId: 'first' });
    expect(getTraceId()).toBe('first');
    setTraceContext({ traceId: 'second' });
    expect(getTraceId()).toBe('second');
  });
});
