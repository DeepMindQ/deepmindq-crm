/**
 * WI-18.3 Query Safety Helpers
 * 
 * Prevents unbounded findMany queries in production.
 * Every findMany MUST use safeFindMany() or explicitly bypass with unsafeFindMany().
 */

import { logger } from '@/lib/logger';

const DEFAULT_QUERY_LIMIT = 100;
const MAX_QUERY_LIMIT = 1000;
const ABSOLUTE_MAX = 5000;

export interface QueryBounds {
  take: number;
  skip?: number;
  cursor?: { id: string };
}

/**
 * Parse and clamp pagination params for findMany queries.
 * Ensures no query can return more than ABSOLUTE_MAX rows.
 */
export function safeQueryBounds(
  requestedLimit?: number,
  requestedPage?: number,
  requestedCursor?: string
): QueryBounds {
  const limit = Math.min(
    ABSOLUTE_MAX,
    Math.max(1, Math.min(MAX_QUERY_LIMIT, requestedLimit ?? DEFAULT_QUERY_LIMIT))
  );
  
  if (requestedCursor) {
    return { take: limit, cursor: { id: requestedCursor } };
  }
  
  const page = Math.max(1, requestedPage ?? 1);
  return { take: limit, skip: (page - 1) * limit };
}

/**
 * Wrap a findMany with safety bounds.
 * Usage: safeFindMany(db.company.findMany, { where: {...}, orderBy: {...} }, { limit: 50 })
 */
export async function safeFindMany<T>(
  queryFn: (args: any) => Promise<T[]>,
  prismaArgs: Record<string, any>,
  bounds?: { limit?: number; page?: number; cursor?: string }
): Promise<T[]> {
  const qb = safeQueryBounds(bounds?.limit, bounds?.page, bounds?.cursor);
  return queryFn({
    ...prismaArgs,
    take: qb.take,
    ...(qb.skip !== undefined ? { skip: qb.skip } : {}),
    ...(qb.cursor ? { cursor: qb.cursor, skip: 1 } : {}),
  });
}

/**
 * For queries that MUST be unbounded (e.g., batch exports, cron jobs).
 * Requires explicit justification in the `reason` param.
 * Log a warning for observability.
 */
export async function unsafeFindMany<T>(
  queryFn: (args: any) => Promise<T[]>,
  prismaArgs: Record<string, any>,
  reason: string
): Promise<T[]> {
  if (process.env.NODE_ENV === 'production') {
    logger.warn(`[QUERY-SAFETY] Unbounded findMany executed: ${reason}`);
  }
  return queryFn(prismaArgs);
}
