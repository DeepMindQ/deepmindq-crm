/**
 * DeepMindQ — Query Performance Optimizer
 * 
 * Provides Prisma query helpers for optimized database access.
 * Includes select field projection, pagination, cursor-based navigation,
 * and batch query patterns.
 */

import { Prisma } from '@prisma/client'
import { logger } from '@/lib/logger'

// ── Field Selection Helper ──
// Avoids SELECT * by specifying only needed fields
export function selectFields<T extends Record<string, boolean>>(fields: T): T {
  return fields
}

// ── Pagination Helper ──
export interface PaginationParams {
  page?: number
  limit?: number
  cursor?: string
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
    hasNextPage: boolean
    hasPrevPage: boolean
    nextCursor?: string
  }
}

export function getPaginationOffset(params: PaginationParams): number {
  const page = Math.max(1, params.page || 1)
  const limit = Math.min(100, Math.max(1, params.limit || 25))
  return (page - 1) * limit
}

export function getPrismaPagination(params: PaginationParams) {
  const page = Math.max(1, params.page || 1)
  const limit = Math.min(100, Math.max(1, params.limit || 25))
  const skip = (page - 1) * limit
  
  return {
    skip,
    take: limit,
    orderBy: params.sortBy ? { [params.sortBy]: params.sortOrder || 'asc' as const } : undefined,
    cursor: params.cursor ? { id: params.cursor } : undefined,
  }
}

// ── Common Optimized Queries ──
// P0 Deep Audit #3 NOTE: OPTIMIZED_QUERIES is exported for future integration
// with API route handlers (CB-2: AI memory/knowledge graph persistence).
// Currently has zero consumers. When integrating, ensure Prisma field names
// match the schema (already corrected in P0.5 for: rawName, sizeRange,
// lastEnrichedAt, updatedAt, title, lastCheckedAt).
export const OPTIMIZED_QUERIES = {
  // Company list with minimal fields (no research cards, no notes)
  // P0.5: Fixed field names to match Prisma schema (was: name, employeeSize, dataFreshness, lastUpdatedAt)
  companiesList: selectFields({
    id: true, rawName: true, domain: true, industry: true,
    sizeRange: true, country: true, status: true,
    intelligenceScore: true, lastEnrichedAt: true,
    updatedAt: true, createdAt: true,
  }),
  
  // Contact list with email health
  // P0.5: Fixed field names to match Prisma schema (was: name, jobTitle, lastValidatedAt)
  contactsList: selectFields({
    id: true, rawName: true, email: true, title: true,
    companyId: true, status: true, emailHealth: true,
    emailHealthScore: true, lastCheckedAt: true,
  }),
  
  // Opportunity list
  opportunitiesList: selectFields({
    id: true, title: true, status: true, companyId: true,
    createdAt: true, updatedAt: true,
  }),
  
  // Dashboard counts (no joins)
  dashboardCounts: selectFields({
    id: true, status: true, intelligenceScore: true,
  }),
}

// ── Batch Query Helper ──
// Splits large ID arrays into chunks to avoid PostgreSQL query length limits
export function chunkIds<T extends string | number>(ids: T[], chunkSize = 100): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < ids.length; i += chunkSize) {
    chunks.push(ids.slice(i, i + chunkSize))
  }
  return chunks
}

// ── Query Timing Wrapper ──
export async function timedQuery<T>(label: string, query: () => Promise<T>): Promise<T> {
  const start = performance.now()
  try {
    const result = await query()
    const duration = performance.now() - start
    if (duration > 1000) {
      logger.warn(`[QueryPerf] Slow query: ${label} took ${duration.toFixed(0)}ms`, { label, durationMs: duration })
    }
    return result
  } catch (error) {
    const duration = performance.now() - start
    logger.error(`[QueryPerf] Failed query: ${label} after ${duration.toFixed(0)}ms`, { label, durationMs: duration, error })
    throw error
  }
}

// ── Connection Pool Metrics ──
export function getPoolMetrics(): Record<string, unknown> {
  // Would connect to Prisma's connection pool metrics in production
  return {
    activeConnections: 'N/A',
    idleConnections: 'N/A',
    waitingQueries: 0,
    poolSize: process.env.DATABASE_POOL_SIZE || 10,
  }
}
