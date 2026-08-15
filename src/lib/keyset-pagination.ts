/**
 * Keyset (Cursor-Based) Pagination Utility
 *
 * A generic, Edge Runtime–compatible module for cursor-based pagination with Prisma.
 * Keyset pagination avoids the O(n) cost of `skip` on deep pages by encoding
 * the last-seen row's column values into an opaque cursor and using them in
 * the `WHERE` clause of the next query.
 *
 * Features:
 *  - Edge Runtime compatible (uses `TextEncoder`/`TextDecoder` + `btoa`/`atob`)
 *  - Generic — works with any Prisma model and sort column
 *  - Composite cursor support (sort column + tiebreaker column)
 *  - URL search-param parsing with validation
 *  - Structured response builder
 *
 * @example
 * ```ts
 * // API route handler
 * const { cursor, limit, sortBy, sortOrder } = parsePaginationParams(searchParams);
 * const items = await db.post.findMany({
 *   take: limit + 1,
 *   orderBy: { [sortBy]: sortOrder },
 *   where: {
 *     ...buildKeysetWhere({ cursor, sortBy, sortOrder }),
 *     // ... your other filters
 *   },
 * });
 * return buildPaginationResponse({ items: items.slice(0, limit), limit, cursor: items[limit]?.id, sortBy });
 * ```
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A Prisma `where` clause fragment — a plain object spread into `where`. */
export type PrismaWhereClause = Record<string, unknown>;

/** Parameters accepted by {@link buildKeysetWhere}. */
export interface KeysetPaginationParams<_T = unknown> {
  /** Opaque cursor string from the previous page. `null`/`undefined` = first page. */
  cursor?: string | null;
  /** The column used for sorting (e.g. `"createdAt"`, `"name"`). */
  sortBy: string;
  /** Sort direction. */
  sortOrder: 'asc' | 'desc';
  /**
   * Additional cursor fields for composite keysets.
   *
   * The **keys** identify which fields from the decoded cursor participate in
   * the tiebreaker comparison.  The **values** are ignored at runtime — the
   * actual values come from the decoded cursor.
   *
   * Order matters: fields are applied in the order they appear.
   *
   * @example
   * ```ts
   * additionalCursorFields: { id: null }
   * // → decoded cursor must contain an `id` field used as tiebreaker
   * ```
   */
  additionalCursorFields?: Record<string, unknown>;
}

/** Parameters accepted by {@link buildPaginationResponse}. */
export interface PaginationResponseParams<T = unknown> {
  /** The page items (already sliced to `limit`). */
  items: T[];
  /** The page size that was requested. */
  limit: number;
  /**
   * The raw value of the cursor field for the *next* item.
   *
   * Typically you fetch `limit + 1` rows and pass the extra row's sort-field
   * value (or its encoded cursor) here.  If omitted, `hasMore` defaults to
   * `false`.
   */
  nextCursorValue?: string | null;
  /** The column used for sorting (used to build the next cursor). */
  sortBy: string;
  /**
   * Optional extra fields to include in the next cursor.
   *
   * The **keys** specify which fields to read from `nextCursorItem` and
   * encode into the cursor.
   */
  additionalCursorFields?: Record<string, unknown>;
  /**
   * The raw next item (fetched but not included in `items`).
   * Used to extract field values for the next cursor.
   *
   * If provided, `nextCursorValue` is derived from this item automatically
   * using `sortBy`.  If both `nextCursorItem` and `nextCursorValue` are given,
   * `nextCursorItem` takes precedence.
   */
  nextCursorItem?: Record<string, unknown> | null;
}

/** The shape returned by {@link buildPaginationResponse}. */
export interface PaginationResponse<T = unknown> {
  /** The page items. */
  items: T[];
  /** Opaque cursor to fetch the next page. `null` when there are no more results. */
  nextCursor: string | null;
  /** Whether more pages exist. */
  hasMore: boolean;
  /** Structured pagination metadata. */
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
    limit: number;
  };
}

/** Parsed pagination parameters from URL search params. */
export interface ParsedPagination {
  /** Decoded cursor, or `null` for the first page. */
  cursor: string | null;
  /** Page size (clamped to 1–100, default 50). */
  limit: number;
  /** Sort column name. */
  sortBy: string;
  /** Sort direction. */
  sortOrder: 'asc' | 'desc';
}

/** Options for {@link parsePaginationParams}. */
export interface PaginationParseOptions {
  /** Default sort column (default `"createdAt"`). */
  defaultSortBy?: string;
  /** Default sort order (default `"desc"`). */
  defaultSortOrder?: 'asc' | 'desc';
  /** Default page size (default `50`). */
  defaultLimit?: number;
  /** Maximum page size (default `100`). */
  maxLimit?: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Base64-encode a string in an Edge Runtime–compatible way.
 *
 * Uses `TextEncoder` → manual byte conversion → `btoa` so that Unicode
 * characters in JSON (e.g. string field values) survive the round-trip.
 */
function base64Encode(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/**
 * Base64-decode a string in an Edge Runtime–compatible way.
 *
 * Reverse of {@link base64Encode}: `atob` → `Uint8Array` → `TextDecoder`.
 */
function base64Decode(input: string): string {
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Encode a set of column values into an opaque base64 cursor string.
 *
 * The cursor is safe to expose to clients — it is not signed or encrypted,
 * so treat it as user input when decoding (always validate after decoding).
 *
 * @param values - Column-value pairs that uniquely identify a row position.
 * @returns A base64-encoded JSON string.
 *
 * @example
 * ```ts
 * encodeCursor({ id: 'abc', createdAt: '2024-01-01T00:00:00Z' })
 * // → 'eyJpZCI6ImFiYyIsImNyZWF0ZWRBdCI6IjIwMjQtMDEtMDFUMDA6MDA6MDBaIn0='
 * ```
 */
export function encodeCursor(values: Record<string, unknown>): string {
  return base64Encode(JSON.stringify(values));
}

/**
 * Decode an opaque cursor string back into its column-value pairs.
 *
 * Returns `null` if the cursor is falsy, malformed, or not valid JSON.
 *
 * @param cursor - The base64 cursor string.
 * @returns The decoded column-value pairs, or `null` on failure.
 */
export function decodeCursor(cursor: string): Record<string, unknown> | null {
  if (!cursor) return null;
  try {
    const json = base64Decode(cursor);
    const parsed = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Build a Prisma `where` clause fragment for keyset (cursor-based) pagination.
 *
 * The returned object can be spread directly into a Prisma `where` clause:
 *
 * ```ts
 * const where = {
 *   status: 'PUBLISHED',
 *   ...buildKeysetWhere({ cursor, sortBy: 'createdAt', sortOrder: 'desc' }),
 * };
 * ```
 *
 * ### How it works
 *
 * Keyset pagination replaces `skip` with a `WHERE` filter that selects only
 * rows that come **after** the cursor position.  For a single sort column:
 *
 * - **Ascending**:  `WHERE sortCol > cursorValue`
 * - **Descending**: `WHERE sortCol < cursorValue`
 *
 * When rows share the same sort-column value (a "tie"), we need a tiebreaker
 * — typically the primary key `id` — to produce a stable, unique ordering:
 *
 * - **Ascending**:  `WHERE (sortCol > val) OR (sortCol = val AND id > cursorId)`
 * - **Descending**: `WHERE (sortCol < val) OR (sortCol = val AND id < cursorId)`
 *
 * For multi-level tiebreakers, each additional field from
 * `additionalCursorFields` adds another nesting level.
 *
 * @param params - Keyset pagination parameters.
 * @returns A Prisma `where` clause fragment (empty object if no cursor).
 */
export function buildKeysetWhere<T>(params: KeysetPaginationParams<T>): PrismaWhereClause {
  const { cursor, sortBy, sortOrder, additionalCursorFields } = params;

  // No cursor → first page, no filter needed.
  if (!cursor) return {};

  const decoded = decodeCursor(cursor);
  if (!decoded) return {};

  const cursorSortValue = decoded[sortBy];
  if (cursorSortValue === undefined) return {};

  // Collect tiebreaker fields: keys from additionalCursorFields (in order),
  // defaulting to ['id'] if none are provided.
  const tiebreakerKeys = additionalCursorFields ? Object.keys(additionalCursorFields) : ['id'];

  const isAsc = sortOrder === 'asc';
  const primaryOp = isAsc ? 'gt' : 'lt';

  // Build the primary condition: sortCol {gt/lt} cursorValue
  const primaryCondition: PrismaWhereClause = {
    [sortBy]: { [primaryOp]: cursorSortValue },
  };

  // Build the tiebreaker chain.
  // For N tiebreaker fields [f1, f2, …, fN], we produce:
  //   { sortBy: cursorValue, f1: cursorF1, …, fK: cursorFK, fK+1: { gt/lt: cursorFK+1 } }
  // for each level K from 0 to N-1, all OR'd together with the primary.
  const tiebreakerConditions: PrismaWhereClause[] = [];

  // Build conditions bottom-up: start from the deepest tiebreaker and work outward.
  let deepCondition: PrismaWhereClause | null = null;

  // Iterate tiebreakers in reverse order to build the nested chain.
  for (let i = tiebreakerKeys.length - 1; i >= 0; i--) {
    const field = tiebreakerKeys[i]!;
    const value = decoded[field];

    if (value === undefined) continue;

    // The deepest level is just { field: { gt/lt: value } }.
    // Outer levels wrap the inner condition.
    if (deepCondition === null) {
      deepCondition = {
        [sortBy]: cursorSortValue,
        [field]: { [primaryOp]: value },
      };
    } else {
      deepCondition = {
        [sortBy]: cursorSortValue,
        [field]: value,
        ...(deepCondition as Record<string, unknown>),
      };
    }

    tiebreakerConditions.unshift(deepCondition);
  }

  // If there are no valid tiebreaker conditions, fall back to primary only.
  // This still works but may skip/duplicate rows if the sort column has duplicates.
  if (tiebreakerConditions.length === 0) {
    return primaryCondition;
  }

  return {
    OR: [primaryCondition, ...tiebreakerConditions],
  };
}

/**
 * Build a structured pagination response from fetched items.
 *
 * ### Usage pattern (fetch `limit + 1` to detect `hasMore`):
 *
 * ```ts
 * const rows = await db.post.findMany({ take: limit + 1, ... });
 * const items = rows.slice(0, limit);
 * const hasNext = rows.length > limit;
 * return buildPaginationResponse({
 *   items,
 *   limit,
 *   sortBy: 'createdAt',
 *   nextCursorItem: hasNext ? rows[limit] : null,
 *   additionalCursorFields: { id: null },
 * });
 * ```
 *
 * @param params - Response-building parameters.
 * @returns A structured pagination response.
 */
export function buildPaginationResponse<T>(
  params: PaginationResponseParams<T>,
): PaginationResponse<T> {
  const { items, limit, sortBy, additionalCursorFields, nextCursorItem, nextCursorValue } = params;

  let nextCursor: string | null = null;
  let hasMore = false;

  // Determine if there are more results.
  if (nextCursorItem) {
    hasMore = true;
    // Extract field values from the extra item to build the cursor.
    const cursorValues: Record<string, unknown> = {
      [sortBy]: nextCursorItem[sortBy],
    };
    if (additionalCursorFields) {
      for (const key of Object.keys(additionalCursorFields)) {
        if (nextCursorItem[key] !== undefined) {
          cursorValues[key] = nextCursorItem[key];
        }
      }
    }
    nextCursor = encodeCursor(cursorValues);
  } else if (nextCursorValue) {
    // Fallback: caller provided a raw value instead of an item.
    hasMore = true;
    const cursorValues: Record<string, unknown> = {
      [sortBy]: nextCursorValue,
    };
    nextCursor = encodeCursor(cursorValues);
  }

  return {
    items,
    nextCursor,
    hasMore,
    pagination: {
      nextCursor,
      hasMore,
      limit,
    },
  };
}

/**
 * Parse and validate pagination parameters from `URLSearchParams`.
 *
 * Extracts `cursor`, `limit`, `sortBy`, and `sortOrder` from the query string,
 * applying sensible defaults and clamping values to safe ranges.
 *
 * @param searchParams - The `URLSearchParams` object (e.g. from `request.nextUrl.searchParams`).
 * @param options - Optional defaults and limits.
 * @returns Validated pagination parameters.
 *
 * @example
 * ```ts
 * // In a Next.js route handler:
 * const { cursor, limit, sortBy, sortOrder } = parsePaginationParams(
 *   request.nextUrl.searchParams,
 *   { defaultSortBy: 'name', defaultSortOrder: 'asc' },
 * );
 * ```
 */
export function parsePaginationParams(
  searchParams: URLSearchParams,
  options: PaginationParseOptions = {},
): ParsedPagination {
  const {
    defaultSortBy = 'createdAt',
    defaultSortOrder = 'desc',
    defaultLimit = 50,
    maxLimit = 100,
  } = options;

  // --- cursor ---
  const rawCursor = searchParams.get('cursor');
  const cursor = rawCursor || null;

  // --- limit ---
  const rawLimit = searchParams.get('limit');
  let limit = defaultLimit;
  if (rawLimit) {
    const parsed = parseInt(rawLimit, 10);
    if (!isNaN(parsed) && parsed >= 1) {
      limit = Math.min(parsed, maxLimit);
    }
  }

  // --- sortBy ---
  // Only allow alphanumeric characters plus underscores to prevent injection.
  const rawSortBy = searchParams.get('sortBy');
  const sortBy =
    rawSortBy && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(rawSortBy) ? rawSortBy : defaultSortBy;

  // --- sortOrder ---
  const rawSortOrder = searchParams.get('sortOrder');
  const sortOrder: 'asc' | 'desc' =
    rawSortOrder === 'asc' || rawSortOrder === 'desc' ? rawSortOrder : defaultSortOrder;

  return { cursor, limit, sortBy, sortOrder };
}
