/**
 * Pagination Helper
 *
 * Standardizes pagination across all list API endpoints.
 * Usage: const { skip, take, pagination } = parsePagination(request.url);
 */

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

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

/**
 * Parse pagination params from query params object.
 */
export function parsePagination(params: PaginationParams): { page: number; limit: number; skip: number; sortBy: string; sortOrder: 'asc' | 'desc' } {
  const page = Math.max(1, parseInt(String(params.page || '1'), 10) || 1)
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(String(params.limit || String(DEFAULT_LIMIT)), 10) || DEFAULT_LIMIT))
  const skip = (page - 1) * limit
  const sortBy = String(params.sortBy || 'createdAt')
  const sortOrder = (params.sortOrder === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc'
  return { page, limit, skip, sortBy, sortOrder }
}

/**
 * Parse pagination from a URL string (convenience wrapper).
 */
export function parsePaginationFromUrl(url: string) {
  const { searchParams } = new URL(url)
  return parsePagination({
    page: searchParams.get('page') || '1',
    limit: searchParams.get('limit') || String(DEFAULT_LIMIT),
    sortBy: searchParams.get('sortBy') || 'createdAt',
    sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc' | null) || 'desc',
  })
}

/**
 * Build pagination metadata for response.
 */
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

/**
 * Wrap data array with pagination metadata.
 */
export function paginatedResponse<T>(data: T[], total: number, page: number, limit: number): PaginationResult<T> {
  return {
    data,
    pagination: buildPaginationMeta(total, page, limit),
  }
}

/**
 * Legacy interface for backward compatibility with remote version.
 */
export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface LegacyPaginationParams {
  page: number
  limit: number
  skip: number
  take: number
}

/**
 * Legacy parsePagination that takes a URL string (backward compat).
 */
export function legacyParsePagination(url: string): LegacyPaginationParams {
  const { page, limit, skip } = parsePaginationFromUrl(url)
  return { page, limit, skip, take: limit }
}

export function legacyBuildPaginationMeta(total: number, params: LegacyPaginationParams): PaginationMeta {
  return buildPaginationMeta(total, params.page, params.limit)
}