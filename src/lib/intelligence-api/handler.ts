/**
 * Intelligence API — Sensitive Data Scrubbing
 *
 * Provides scrubbing utilities to prevent sensitive data from leaking
 * into API error responses (passwords, tokens, connection strings, etc.).
 *
 * Usage:
 *   import { scrubError } from '@/lib/intelligence-api/handler';
 *   const safe = scrubError(err.message);
 */

// ── Sensitive data patterns to scrub from error messages ────────────────────

const SENSITIVE_PATTERNS = [
  /password[=\s][^\s]*/gi,
  /secret[=\s][^\s]*/gi,
  /token[=\s][^\s]*/gi,
  /api[_-]?key[=\s][^\s]*/gi,
  /connection[_-]?string[=\s][^\s]*/gi,
  /database[_-]?url[=\s][^\s]*/gi,
  /postgresql:\/\/[^\s]+/gi,
  /postgres:\/\/[^\s]+/gi,
  /mysql:\/\/[^\s]+/gi,
  /mongodb:\/\/[^\s]+/gi,
  /mongodb\+srv:\/\/[^\s]+/gi,
  /bearer\s+\S+/gi,
  /authorization:\s*\S+/gi,
  /ssh[_-]?[a-z]+[_-]?key[=\s][^\s]*/gi,
  /aws[_-]?secret[_-]?access[_-]?key[=\s][^\s]*/gi,
  /private[_-]?key[=\s][^\s]*/gi,
];

/**
 * Scrub sensitive data from error messages to prevent leaking in API responses.
 */
function scrubError(message: string): string {
  let scrubbed = message;
  for (const pattern of SENSITIVE_PATTERNS) {
    scrubbed = scrubbed.replace(pattern, '[REDACTED]');
  }
  // Truncate long error messages at a safe boundary (before any partial [REDACTED])
  if (scrubbed.length > 500) {
    const safeCut = scrubbed.lastIndexOf('[REDACTED]', 500);
    scrubbed = (safeCut > 400 ? scrubbed.substring(0, safeCut) : scrubbed.substring(0, 500)) + '...';
  }
  return scrubbed;
}

export { SENSITIVE_PATTERNS, scrubError };
