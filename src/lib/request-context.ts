// Request context — provides per-request correlation IDs for structured logging.
// This module is lazy-loaded by logger.ts to avoid circular dependencies.
// In Edge Runtime or serverless contexts, it may not be available.

export function getRequestContext(): Record<string, string> {
  return {};
}
