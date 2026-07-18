/**
 * Retry Mechanism — Workflow Automation Engine (Phase 2)
 *
 * Determines if an error is retryable, computes backoff timing,
 * and schedules retries by setting nextRetryAt on failed jobs.
 *
 * Error classification:
 * - Retryable: timeout, rate limit (429), 503, network errors
 * - Non-retryable: 400 bad request, 401/403 auth errors, 404 not found,
 *   invalid API key, missing required data
 *
 * Backoff: exponential with jitter
 *   base = 30s, multiplier = 2, max = 10 minutes
 *   delay = min(base * 2^attempt + random_jitter, max)
 */

// ── Error Classification ──

export interface ErrorClassification {
  isRetryable: boolean;
  errorCode: string;
  reason: string;
}

/**
 * Classify an error into retryable vs non-retryable.
 * Examines error message, HTTP status codes, and known error patterns.
 */
export function classifyError(error: unknown): ErrorClassification {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  // HTTP status code patterns
  if (lower.includes('status 429') || lower.includes('rate limit') || lower.includes('ratelimit')) {
    return { isRetryable: true, errorCode: 'RATE_LIMIT', reason: 'API rate limit hit — retry after backoff' };
  }
  if (lower.includes('status 503') || lower.includes('service unavailable')) {
    return { isRetryable: true, errorCode: 'SERVICE_UNAVAILABLE', reason: 'Upstream service unavailable — retry after backoff' };
  }
  if (lower.includes('status 502') || lower.includes('bad gateway')) {
    return { isRetryable: true, errorCode: 'BAD_GATEWAY', reason: 'Bad gateway — retry after backoff' };
  }
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('etimedout') || lower.includes('econnrefused')) {
    return { isRetryable: true, errorCode: 'TIMEOUT', reason: 'Network timeout — retry after backoff' };
  }
  if (lower.includes('econnreset') || lower.includes('socket hang up') || lower.includes('network error')) {
    return { isRetryable: true, errorCode: 'NETWORK_ERROR', reason: 'Network connection error — retry after backoff' };
  }
  if (lower.includes('500') && !lower.includes('50000') && (lower.includes('internal') || lower.includes('server error'))) {
    return { isRetryable: true, errorCode: 'INTERNAL_SERVER_ERROR', reason: 'Server internal error — retry after backoff' };
  }

  // Non-retryable errors
  if (lower.includes('status 401') || lower.includes('unauthorized') || lower.includes('invalid api key') || lower.includes('invalid_api_key')) {
    return { isRetryable: false, errorCode: 'AUTH_ERROR', reason: 'Authentication failure — check API key configuration' };
  }
  if (lower.includes('status 403') || lower.includes('forbidden')) {
    return { isRetryable: false, errorCode: 'FORBIDDEN', reason: 'Access forbidden — check permissions' };
  }
  if (lower.includes('status 400') || lower.includes('bad request') || lower.includes('invalid request')) {
    return { isRetryable: false, errorCode: 'BAD_REQUEST', reason: 'Invalid request — data issue, not transient' };
  }
  if (lower.includes('status 404') || lower.includes('not found')) {
    return { isRetryable: false, errorCode: 'NOT_FOUND', reason: 'Resource not found — will not resolve on retry' };
  }
  if (lower.includes('missing') && (lower.includes('api key') || lower.includes('company') || lower.includes('data'))) {
    return { isRetryable: false, errorCode: 'MISSING_DATA', reason: 'Required data missing — cannot retry' };
  }

  // Default: retry on unknown errors (assumed transient)
  return { isRetryable: true, errorCode: 'UNKNOWN_ERROR', reason: `Unknown error — retrying with backoff: ${message.slice(0, 200)}` };
}

// ── Backoff Calculation ──

const BASE_DELAY_MS = 30_000;     // 30 seconds
const MULTIPLIER = 2;
const MAX_DELAY_MS = 10 * 60_000; // 10 minutes
const JITTER_MAX_MS = 5_000;      // up to 5s random jitter

/**
 * Calculate the next retry time using exponential backoff with jitter.
 *
 * @param attempt - 0-based attempt index (first retry = attempt 0)
 */
export function calculateRetryDelay(attempt: number): number {
  const exponentialDelay = BASE_DELAY_MS * Math.pow(MULTIPLIER, attempt);
  const capped = Math.min(exponentialDelay, MAX_DELAY_MS);
  const jitter = Math.random() * JITTER_MAX_MS;
  return Math.round(capped + jitter);
}

/**
 * Get the absolute Date for the next retry.
 */
export function getNextRetryTime(attempt: number): Date {
  const delay = calculateRetryDelay(attempt);
  return new Date(Date.now() + delay);
}

/**
 * Human-readable backoff description.
 */
export function getBackoffDescription(attempt: number): string {
  const delay = calculateRetryDelay(attempt);
  if (delay < 60_000) return `${Math.round(delay / 1000)}s`;
  if (delay < 3600_000) return `${Math.round(delay / 60_000)}m`;
  return `${(delay / 3600_000).toFixed(1)}h`;
}