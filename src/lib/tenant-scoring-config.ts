/**
 * Tenant Scoring Configuration Helper
 * ====================================
 *
 * Shared helper for reading TenantScoringConfig from the database.
 * Used by ai-unified-confidence, blended-confidence, and recommendation-engine
 * to apply tenant-specific scoring weights when available.
 *
 * NON-THROWING: All functions return null on error.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { LRUCache } from '@/lib/lru-cache';

// ── In-memory cache for tenant configs (100 tenants max) ──

const tenantConfigCache = new LRUCache<string, CacheEntry<TenantScoringConfig>>(100);
const TENANT_CONFIG_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// ── Types ──────────────────────────────────────────────────────────────

/** Shape of a TenantScoringConfig row from the database. */
export interface TenantScoringConfig {
  id: string;
  tenantId: string;
  confidenceWeights: Record<string, number>;
  recommendationWeights: Record<string, number>;
  prioritySignals: string[];
  targetIndustries: string[];
  targetSizeRange: { min?: number; max?: number };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Weight type for the getTenantWeights helper. */
export type WeightType = 'confidence' | 'recommendation' | 'blended';

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Get the full TenantScoringConfig for a tenant.
 * Returns null if no config exists, is inactive, or on error.
 */
export async function getTenantConfig(tenantId: string): Promise<TenantScoringConfig | null> {
  if (!tenantId) return null;

  // Check cache first
  const cached = tenantConfigCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const config = await db.tenantScoringConfig.findUnique({
      where: { tenantId },
    });

    if (!config || !config.isActive) return null;

    const parsed: TenantScoringConfig = {
      id: config.id,
      tenantId: config.tenantId,
      confidenceWeights: (config.confidenceWeights as Record<string, number>) ?? {},
      recommendationWeights: (config.recommendationWeights as Record<string, number>) ?? {},
      prioritySignals: (config.prioritySignals as string[]) ?? [],
      targetIndustries: (config.targetIndustries as string[]) ?? [],
      targetSizeRange: (config.targetSizeRange as { min?: number; max?: number }) ?? {},
      isActive: config.isActive,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };

    // Cache the result
    tenantConfigCache.set(tenantId, {
      data: parsed,
      expiresAt: Date.now() + TENANT_CONFIG_TTL_MS,
    });

    return parsed;
  } catch (err) {
    logger.error(`[tenant-scoring-config] Failed to load config for tenant ${tenantId}`, {
      error: err instanceof Error ? err.message : err,
    });
    return null;
  }
}

/**
 * Get tenant-specific weights for a given weight type.
 * Returns null if no custom weights are configured or on error.
 *
 * For 'confidence': reads confidenceWeights (keys: dataQuality, sourceReliability, etc.)
 * For 'recommendation': reads recommendationWeights (keys: accountScore, opportunityScore, etc.)
 * For 'blended': reads confidenceWeights and maps to blended-confidence keys
 */
export async function getTenantWeights(
  tenantId: string,
  type: WeightType,
): Promise<Record<string, number> | null> {
  const config = await getTenantConfig(tenantId);
  if (!config) return null;

  switch (type) {
    case 'confidence': {
      const weights = config.confidenceWeights;
      return Object.keys(weights).length > 0 ? weights : null;
    }
    case 'recommendation': {
      const weights = config.recommendationWeights;
      return Object.keys(weights).length > 0 ? weights : null;
    }
    case 'blended': {
      // Blended confidence uses different key names; map from confidence weights
      const cw = config.confidenceWeights;
      if (Object.keys(cw).length === 0) return null;
      // If tenant has explicit confidence weights, use them as blended override hints
      // The blended confidence engine has its own source-level weights
      return cw;
    }
    default:
      return null;
  }
}

/**
 * Invalidate cached config for a specific tenant (e.g. after config update).
 */
export function invalidateTenantConfigCache(tenantId: string): void {
  tenantConfigCache.delete(tenantId);
  logger.debug(`[tenant-scoring-config] Cache invalidated for tenant ${tenantId}`);
}
