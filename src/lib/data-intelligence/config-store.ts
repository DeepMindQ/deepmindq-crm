/**
 * Configuration Store — Data Intelligence Engine
 *
 * Loads ALL business rules from the database (not hardcoded).
 * Provides an in-memory cache with TTL to avoid hammering the DB
 * on every row validation during bulk processing.
 *
 * Cache invalidation: any write operation (create/update/delete config)
 * should call invalidateCache() to force a fresh DB read.
 */

import { db } from '@/lib/db';

// ── Types ──

export interface ColumnMappingRuleConfig {
  id: string;
  name: string;
  pattern: string;
  targetField: string;
  priority: number;
  isActive: boolean;
}

export interface ValidationRuleConfig {
  id: string;
  name: string;
  targetField: string;
  ruleType: 'required' | 'regex' | 'format' | 'range' | 'uniqueness' | 'custom';
  config: Record<string, unknown>;
  severity: 'error' | 'warning';
  message: string;
  priority: number;
  isActive: boolean;
}

export interface NormalizationMappingConfig {
  id: string;
  category: string;
  sourceValue: string;
  normalizedValue: string;
  isActive: boolean;
}

export interface ScoringWeightConfig {
  id: string;
  dimension: string;
  field: string | null;
  key: string | null;
  weight: number;
  maxScore: number;
  description: string | null;
  isActive: boolean;
}

interface ConfigCache {
  columnRules: ColumnMappingRuleConfig[];
  validationRules: ValidationRuleConfig[];
  normalizationMappings: NormalizationMappingConfig[];
  scoringWeights: ScoringWeightConfig[];
  // Pre-built lookup maps for fast access during processing
  normalizationByCategory: Map<string, Map<string, string>>;
  scoringByDimension: Map<string, ScoringWeightConfig[]>;
  loadedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cache: ConfigCache | null = null;

// ── Cache Management ──

export function invalidateCache(): void {
  cache = null;
}

async function getCache(): Promise<ConfigCache> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) {
    return cache;
  }
  cache = await loadAllConfigs();
  return cache;
}

async function loadAllConfigs(): Promise<ConfigCache> {
  const [columnRules, validationRules, normalizationMappings, scoringWeights] = await Promise.all([
    db.columnMappingRule.findMany({ where: { isActive: true }, orderBy: { priority: 'desc' } }),
    db.fieldValidationRule.findMany({ where: { isActive: true }, orderBy: { priority: 'desc' } }),
    db.normalizationMapping.findMany({ where: { isActive: true } }),
    db.scoringWeight.findMany({ where: { isActive: true } }),
  ]);

  // Build normalization lookup: category → sourceValue → normalizedValue
  const normalizationByCategory = new Map<string, Map<string, string>>();
  for (const m of normalizationMappings) {
    if (!normalizationByCategory.has(m.category)) {
      normalizationByCategory.set(m.category, new Map());
    }
    normalizationByCategory.get(m.category)!.set(
      m.sourceValue.toLowerCase().trim(),
      m.normalizedValue
    );
  }

  // Build scoring lookup: dimension → weights[]
  const scoringByDimension = new Map<string, ScoringWeightConfig[]>();
  for (const w of scoringWeights) {
    if (!scoringByDimension.has(w.dimension)) {
      scoringByDimension.set(w.dimension, []);
    }
    scoringByDimension.get(w.dimension)!.push(w);
  }

  return {
    columnRules: columnRules.map(r => ({
      ...r,
      config: {}, // column rules have no config
    })) as ColumnMappingRuleConfig[],
    validationRules: validationRules.map(r => ({
      ...r,
      config: safeJsonParse(r.config),
      ruleType: r.ruleType as ValidationRuleConfig['ruleType'],
      severity: r.severity as ValidationRuleConfig['severity'],
    })),
    normalizationMappings: normalizationMappings.map(m => ({
      ...m,
      isActive: m.isActive,
    })),
    scoringWeights: scoringWeights.map(w => ({
      ...w,
      isActive: w.isActive,
    })),
    normalizationByCategory,
    scoringByDimension,
    loadedAt: Date.now(),
  };
}

function safeJsonParse(str: string): Record<string, unknown> {
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}

// ── Public Accessors ──

export async function getColumnMappingRules(): Promise<ColumnMappingRuleConfig[]> {
  const c = await getCache();
  return c.columnRules;
}

export async function getValidationRules(): Promise<ValidationRuleConfig[]> {
  const c = await getCache();
  return c.validationRules;
}

export async function getNormalizationMappings(): Promise<NormalizationMappingConfig[]> {
  const c = await getCache();
  return c.normalizationMappings;
}

export async function getScoringWeights(): Promise<ScoringWeightConfig[]> {
  const c = await getCache();
  return c.scoringWeights;
}

/**
 * Look up a normalized value for a given category and source value.
 * Returns the source value as-is if no mapping exists.
 */
export async function getNormalizedValue(
  category: string,
  sourceValue: string
): Promise<string> {
  if (!sourceValue) return sourceValue;
  const c = await getCache();
  const categoryMap = c.normalizationByCategory.get(category.toLowerCase());
  if (!categoryMap) return sourceValue;
  const normalized = categoryMap.get(sourceValue.toLowerCase().trim());
  return normalized || sourceValue;
}

/**
 * Get all normalization mappings for a category.
 * Useful for UI dropdowns showing available mappings.
 */
export async function getNormalizationByCategory(
  category: string
): Promise<Map<string, string>> {
  const c = await getCache();
  return c.normalizationByCategory.get(category.toLowerCase()) || new Map();
}

/**
 * Get scoring weights for a specific dimension.
 */
export async function getScoringByDimension(
  dimension: string
): Promise<ScoringWeightConfig[]> {
  const c = await getCache();
  return c.scoringByDimension.get(dimension) || [];
}

// ── Target Fields (the canonical list of fields the system understands) ──

export const TARGET_FIELDS = [
  'name',        // Contact name
  'email',       // Contact email
  'company',     // Company name
  'title',       // Job title
  'phone',       // Phone number
  'linkedin',    // LinkedIn URL
  'location',    // Location / city
  'country',     // Country
  'industry',    // Industry / sector
  'size',        // Employee count / company size
  'website',     // Website URL
  'domain',      // Company domain
  'revenue',     // Company revenue
  'funding',     // Funding stage
  'state',       // State / region
  'zip',         // Zip / postal code
  'address',     // Full address
] as const;

export type TargetField = (typeof TARGET_FIELDS)[number];