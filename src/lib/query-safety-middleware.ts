/**
 * WI-18.4 Phase 4 — Query Safety Middleware
 *
 * Provides a callback function that monitors for unbounded findMany calls.
 * Logs a structured warning when `take` is not set.
 * Runs in monitoring mode only — does NOT block or modify queries.
 *
 * Usage with Prisma $use (if available) or manual wrapping:
 *   import { createQuerySafetyMiddleware } from '@/lib/query-safety-middleware';
 *   // Use the returned function as a query interceptor
 */

import { logger } from '@/lib/logger'

/** Structured log format for query safety warnings. */
interface QuerySafetyWarning {
  model: string;
  action: string;
  caller: string;
  timestamp: string;
}

/** Parameters passed to Prisma middleware callbacks. */
interface QueryParams {
  model?: string;
  action: string;
  args: Record<string, unknown>;
  data?: unknown;
  runInTransaction?: boolean;
}

/**
 * Extract a human-readable caller identifier from the call stack.
 * Returns the first user-land frame above this module and Prisma internals.
 */
function getCallerInfo(): string {
  try {
    const stack = new Error().stack ?? '';
    const lines = stack.split('\n');

    // Skip the first 3 lines: Error, getCallerInfo, createQuerySafetyMiddleware
    for (let i = 3; i < lines.length; i++) {
      const line = lines[i].trim();
      // Skip node_modules / prisma internals
      if (line.includes('node_modules')) continue;
      if (line.includes('query-safety-middleware')) continue;

      // Extract file:line info
      const match = line.match(/(?:at\s+)?(?:.*?\s+\()?(.+?)(?:\))$/);
      if (match) {
        return match[1].trim();
      }
    }
  } catch {
    // Error.stack may not be available in all environments
  }
  return '<unknown>';
}

/**
 * Returns a callback suitable for use as a Prisma middleware interceptor
 * or for manual wrapping of query calls. Monitors for unbounded findMany
 * calls and logs structured warnings when `take` is not set.
 *
 * Does NOT block or modify the query — monitoring mode only.
 */
export function createQuerySafetyMiddleware() {
  return (
    params: QueryParams,
    next: (params: QueryParams) => Promise<unknown>,
  ): Promise<unknown> => {
    // Only monitor findMany calls
    if (params.action === 'findMany') {
      const args = params.args;

      // Check if `take` is explicitly set
      if (args.take === undefined) {
        const warning: QuerySafetyWarning = {
          model: params.model ?? 'Unknown',
          action: params.action,
          caller: getCallerInfo(),
          timestamp: new Date().toISOString(),
        };

        logger.warn(
          `[QUERY-SAFETY] Unbounded findMany on ${warning.model} at ${warning.caller}`,
          { model: warning.model, caller: warning.caller },
        );
      }
    }

    // Pass through unchanged
    return next(params);
  };
}
