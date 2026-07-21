export interface PaginationParams {
  page?: number | string
  limit?: number | string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginationResult<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export function parsePagination(params: PaginationParams): { page: number; limit: number; skip: number; sortBy: string; sortOrder: 'asc' | 'desc' } {
  const page = Math.max(1, parseInt(String(params.page || '1'), 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(String(params.limit || '20'), 10) || 20))
  const skip = (page - 1) * limit
  const sortBy = String(params.sortBy || 'createdAt')
  const sortOrder = (params.sortOrder === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc'
  return { page, limit, skip, sortBy, sortOrder }
}

export function buildPaginationMeta(total: number, page: number, limit: number) {
  const totalPages = Math.max(1, Math.ceil(total / limit))
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  }
}

export function paginatedResponse<T>(data: T[], total: number, page: number, limit: number): PaginationResult<T> {
  return {
    data,
    pagination: buildPaginationMeta(total, page, limit),
  }
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