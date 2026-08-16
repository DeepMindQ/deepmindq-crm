/**
 * P5.1 — Cursor-based Pagination Utility
 *
 * Replaces offset pagination (skip/take) with keyset cursor pagination.
 * Prevents full table scans on deep pages.
 */

export interface CursorPaginationOptions {
  cursor?: string; // Opaque cursor from previous page
  limit?: number; // Page size (default 20, max 100)
  direction?: 'forward' | 'backward';
}

export interface CursorPaginationResult<T> {
  data: T[];
  nextCursor?: string; // Opaque cursor for next page
  prevCursor?: string; // Opaque cursor for previous page
  hasMore: boolean;
  totalCount?: number; // Optional total (requires count query)
}

/**
 * Encode a cursor value (typically a timestamp + ID combo).
 * Base64-encoded JSON to prevent tampering.
 */
export function encodeCursor(value: {
  id: string;
  createdAt?: string;
  updatedAt?: string;
}): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/**
 * Decode a cursor value. Returns null for invalid/missing cursors.
 */
export function decodeCursor(
  cursor?: string,
): { id: string; createdAt?: string; updatedAt?: string } | null {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString());
  } catch {
    return null;
  }
}

/**
 * Build Prisma cursor where clause for forward pagination.
 * Uses (createdAt, id) as the keyset for stable ordering.
 */
export function buildCursorWhere(
  cursor: ReturnType<typeof decodeCursor>,
  field: string = 'createdAt',
): Record<string, unknown> {
  if (!cursor) return {};

  if (cursor.createdAt) {
    return {
      OR: [
        { [field]: { lt: new Date(cursor.createdAt) } },
        { [field]: new Date(cursor.createdAt), id: { gt: cursor.id } },
      ],
    };
  }

  return { id: { gt: cursor.id } };
}
