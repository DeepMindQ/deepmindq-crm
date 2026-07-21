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
}