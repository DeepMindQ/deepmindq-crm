/**
 * Phase 4 — Items 2.1-2.7: Shared Retry & Error Handling Utilities
 *
 * Provides consistent retry logic with exponential backoff and detailed
 * error surfacing for all intelligence connectors.
 *
 * Features:
 *   - Configurable retry count and base delay
 *   - Exponential backoff with jitter
 *   - Retryable error classification (network timeouts, 5xx, rate limits)
 *   - Detailed error aggregation for ConnectorResult/ConnectorAcquisitionResult
 *
 * Usage:
 *   import { withRetry, classifyError, isRetryable } from '../retry-utilities';
 */

import { logger } from '@/lib/logger';

/** Retry configuration */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 2, meaning up to 3 total attempts) */
  maxRetries: number;
  /** Base delay in milliseconds for exponential backoff (default: 1500) */
  baseDelayMs: number;
  /** Maximum delay cap in milliseconds (default: 30000) */
  maxDelayMs: number;
  /** Whether to add jitter to prevent thundering herd (default: true) */
  jitter: boolean;
}

/** Default retry configuration for connectors */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2,
  baseDelayMs: 1500,
  maxDelayMs: 30_000,
  jitter: true,
};

/** Classified error type */
export type ErrorClassification = 'retryable_network' | 'retryable_rate_limit' | 'retryable_server' | 'non_retryable' | 'unknown';

/**
 * Classify an error to determine if it's retryable.
 *
 * Retryable:
 *   - Network errors (ECONNRESET, ENOTFOUND, ETIMEDOUT)
 *   - HTTP 429 (rate limited) — with longer backoff
 *   - HTTP 5xx (server errors) — with standard backoff
 *   - Timeout errors
 *
 * Non-retryable:
 *   - HTTP 4xx (client errors, except 429)
 *   - Authentication errors
 *   - Data parsing errors
 *   - Configuration errors
 */
export function classifyError(error: unknown): ErrorClassification {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    const code = (error as any).code?.toLowerCase() || '';

    // Network errors
    if (['econnreset', 'enotfound', 'econnrefused', 'etimedout', 'econnaborted', 'socket_hang_up'].includes(code)) {
      return 'retryable_network';
    }

    // Timeout
    if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('abort')) {
      return 'retryable_network';
    }

    // HTTP status codes (for errors that include status)
    const httpStatus = (error as any).status ?? (error as any).statusCode;
    if (httpStatus === 429) return 'retryable_rate_limit';
    if (httpStatus >= 500 && httpStatus < 600) return 'retryable_server';
    if (httpStatus >= 400 && httpStatus < 500) return 'non_retryable';

    // Rate limit indicators
    if (msg.includes('rate limit') || msg.includes('too many requests')) {
      return 'retryable_rate_limit';
    }
  }

  return 'unknown';
}

/**
 * Check if an error is retryable based on classification.
 */
export function isRetryable(error: unknown): boolean {
  const classification = classifyError(error);
  return classification !== 'non_retryable';
}

/**
 * Calculate delay with exponential backoff and optional jitter.
 *
 * Formula: min(baseDelay * 2^attempt + jitter, maxDelay)
 * For rate limits: baseDelay * 3^attempt (more aggressive backoff)
 */
export function calculateBackoff(
  attempt: number,
  config: RetryConfig,
  classification: ErrorClassification,
): number {
  let delay: number;

  if (classification === 'retryable_rate_limit') {
    // More aggressive backoff for rate limits
    delay = config.baseDelayMs * Math.pow(3, attempt);
  } else {
    // Standard exponential backoff
    delay = config.baseDelayMs * Math.pow(2, attempt);
  }

  // Apply jitter (±25%)
  if (config.jitter) {
    const jitterRange = delay * 0.25;
    delay += (Math.random() - 0.5) * 2 * jitterRange;
  }

  return Math.min(delay, config.maxDelayMs);
}

/**
 * Execute an async function with retry logic.
 *
 * @param fn - The async function to execute
 * @param context - Description for logging (e.g., "Crunchbase API call")
 * @param config - Retry configuration
 * @returns The result of the function
 * @throws The last error if all retries are exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  context: string,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<T> {
  let lastError: unknown;
  let actualAttempts = 0;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    actualAttempts++;
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const classification = classifyError(error);

      if (!isRetryable(error) || attempt === config.maxRetries) {
        // Don't retry non-retryable errors or if we've exhausted retries
        break;
      }

      const delay = calculateBackoff(attempt, config, classification);
      const errMsg = error instanceof Error ? error.message : String(error);

      logger.warn(
        `[retry] ${context} attempt ${attempt + 1}/${config.maxRetries + 1} failed (${classification}): ${errMsg}. Retrying in ${Math.round(delay)}ms`
      );

      await sleep(delay);
    }
  }

  // All retries exhausted — throw the last error with context
  const errMsg = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`[retry] ${context} failed after ${actualAttempts} attempts: ${errMsg}`);
}

/**
 * Build a detailed error message for connector results.
 *
 * Includes:
 *   - Original error message
 *   - Error classification
 *   - Retry attempts made
 *   - Timestamp
 */
export function buildConnectorErrorDetail(
  error: unknown,
  context: string,
  attempts: number = 1,
): string {
  const classification = classifyError(error);
  const errMsg = error instanceof Error ? error.message : String(error);
  const timestamp = new Date().toISOString();

  return [
    `[${timestamp}] ${context}`,
    `Error: ${errMsg}`,
    `Classification: ${classification}`,
    `Attempts: ${attempts}`,
  ].join(' | ');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
