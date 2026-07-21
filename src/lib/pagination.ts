/**
 * Pagination Helper
 *
 * Standardizes pagination across all list API endpoints.
 * Usage: const { skip, take, pagination } = parsePagination(request.url);
 */

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Parse pagination params from a request URL.
 * Supports: ?page=1&limit=20 or ?offset=0&limit=20
 */
export function parsePagination(url: string): PaginationParams {
  const { searchParams } = new URL(url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));
  const offset = parseInt(searchParams.get('offset') || '0', 10) || 0;

  return {
    page,
    limit,
    skip: offset > 0 ? offset : (page - 1) * limit,
    take: limit,
  };
}

/**
 * Build pagination metadata for response.
 */
export function buildPaginationMeta(total: number, params: PaginationParams): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / params.limit));
  return {
    page: params.page,
    limit: params.limit,
    total,
    totalPages,
    hasNext: params.page < totalPages,
    hasPrev: params.page > 1,
  };
}