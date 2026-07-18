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

  // Auto-seed if config tables are empty (first deploy)
  if (columnRules.length === 0 && validationRules.length === 0) {
    console.log('[config-store] No config rules found — triggering auto-seed');
    try {
      await autoSeed();
      // Reload after seeding
      const [cr, vr, nm, sw] = await Promise.all([
        db.columnMappingRule.findMany({ where: { isActive: true }, orderBy: { priority: 'desc' } }),
        db.fieldValidationRule.findMany({ where: { isActive: true }, orderBy: { priority: 'desc' } }),
        db.normalizationMapping.findMany({ where: { isActive: true } }),
        db.scoringWeight.findMany({ where: { isActive: true } }),
      ]);
      return buildCache(cr, vr, nm, sw);
    } catch (err) {
      console.error('[config-store] Auto-seed failed:', err);
      // Return empty cache — engine will work with defaults
    }
  }

  return buildCache(columnRules, validationRules, normalizationMappings, scoringWeights);
}

function buildCache(
  columnRules: any[],
  validationRules: any[],
  normalizationMappings: any[],
  scoringWeights: any[]
): ConfigCache {
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
      config: {},
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

/**
 * Auto-seed default configuration rules.
 * Only runs when config tables are completely empty.
 */
async function autoSeed(): Promise<void> {
  // Column Mapping Rules
  const cmRules = [
    { id: 'seed-cm-name', name: 'Name variants', pattern: '^(name|fullname|contact.?name|person.?name|first.?name.?last.?name)$', targetField: 'name', priority: 10 },
    { id: 'seed-cm-email', name: 'Email variants', pattern: '^(email|e-?mail.?addr|mailto|email.?address)$', targetField: 'email', priority: 10 },
    { id: 'seed-cm-title', name: 'Title variants', pattern: '^(title|job.?title|role|position|designation|job.?role)$', targetField: 'title', priority: 10 },
    { id: 'seed-cm-phone', name: 'Phone variants', pattern: '^(phone|telephone|tel|mobile|phone.?number|contact.?number)$', targetField: 'phone', priority: 10 },
    { id: 'seed-cm-linkedin', name: 'LinkedIn variants', pattern: '^(linkedin|linkedin.?url|li.?url|linkedin.?profile)$', targetField: 'linkedin', priority: 10 },
    { id: 'seed-cm-company', name: 'Company name variants', pattern: '^(company|company.?name|organization|org|account|firm|employer|business.?name)$', targetField: 'company', priority: 10 },
    { id: 'seed-cm-industry', name: 'Industry variants', pattern: '^(industry|sector|vertical|business.?sector|industry.?vertical)$', targetField: 'industry', priority: 10 },
    { id: 'seed-cm-size', name: 'Size variants', pattern: '^(size|employees|employee.?count|staff|headcount|company.?size|no.?of.?employees|head.?count|num.?employees|total.?employees)$', targetField: 'size', priority: 10 },
    { id: 'seed-cm-website', name: 'Website variants', pattern: '^(website|url|web|site|homepage|company.?url|company.?website)$', targetField: 'website', priority: 10 },
    { id: 'seed-cm-domain', name: 'Domain variants', pattern: '^(domain|company.?domain|website.?domain|email.?domain)$', targetField: 'domain', priority: 10 },
    { id: 'seed-cm-revenue', name: 'Revenue variants', pattern: '^(revenue|annual.?revenue|company.?revenue|turnover|arr)$', targetField: 'revenue', priority: 10 },
    { id: 'seed-cm-funding', name: 'Funding variants', pattern: '^(funding|funding.?stage|investment.?stage|series|stage)$', targetField: 'funding', priority: 10 },
    { id: 'seed-cm-location', name: 'Location variants', pattern: '^(location|city|address|headquarters|hq)$', targetField: 'location', priority: 8 },
    { id: 'seed-cm-country', name: 'Country variants', pattern: '^(country|region|nation)$', targetField: 'country', priority: 8 },
    { id: 'seed-cm-state', name: 'State variants', pattern: '^(state|province|territory)$', targetField: 'state', priority: 5 },
    { id: 'seed-cm-zip', name: 'ZIP variants', pattern: '^(zip|zip.?code|postal|postal.?code)$', targetField: 'zip', priority: 5 },
  ];

  for (const rule of cmRules) {
    await db.columnMappingRule.upsert({
      where: { id: rule.id },
      update: rule,
      create: rule,
    });
  }

  // Validation Rules
  const vRules = [
    { id: 'seed-vr-email-when-no-name', name: 'Email required when no name', targetField: 'email', ruleType: 'required', config: '{"whenFields":["name"]}', severity: 'error', message: 'Email is required when name is empty', priority: 10 },
    { id: 'seed-vr-name-when-no-email', name: 'Name required when no email', targetField: 'name', ruleType: 'required', config: '{"whenFields":["email"]}', severity: 'error', message: 'Name is required when email is empty', priority: 10 },
    { id: 'seed-vr-email-format', name: 'Email format', targetField: 'email', ruleType: 'format', config: '{"format":"email"}', severity: 'error', message: 'Invalid email format', priority: 10 },
    { id: 'seed-vr-domain-format', name: 'Domain format', targetField: 'domain', ruleType: 'format', config: '{"format":"domain"}', severity: 'warning', message: 'Invalid domain format', priority: 5 },
    { id: 'seed-vr-website-format', name: 'URL format for website', targetField: 'website', ruleType: 'format', config: '{"format":"url"}', severity: 'warning', message: 'Website URL appears invalid', priority: 5 },
    { id: 'seed-vr-name-special', name: 'Name not only special chars', targetField: 'name', ruleType: 'custom', config: '{"customType":"no_special_chars_only"}', severity: 'warning', message: 'Name contains only special characters', priority: 8 },
    { id: 'seed-vr-name-words', name: 'Name minimum word count', targetField: 'name', ruleType: 'custom', config: '{"customType":"min_word_count","minWords":1}', severity: 'warning', message: 'Name may be incomplete (single word)', priority: 3 },
    { id: 'seed-vr-company-missing', name: 'Company name missing', targetField: 'company', ruleType: 'required', config: '{"whenFields":[]}', severity: 'warning', message: 'Company name is missing', priority: 5 },
    { id: 'seed-vr-size-range', name: 'Employee size range check', targetField: 'size', ruleType: 'regex', config: '{"pattern":"^(\\\\d{1,3}(,\\\\d{3})*\\\\+?|\\\\d+-\\\\d+(,\\\\d{3})*|\\\\d+)$"}', severity: 'warning', message: 'Employee size may need normalization', priority: 5 },
    { id: 'seed-vr-email-unique', name: 'Email uniqueness', targetField: 'email', ruleType: 'uniqueness', config: '{}', severity: 'error', message: 'Duplicate email address', priority: 10 },
    { id: 'seed-vr-domain-unique', name: 'Domain uniqueness', targetField: 'domain', ruleType: 'uniqueness', config: '{}', severity: 'warning', message: 'Duplicate domain in batch', priority: 5 },
    { id: 'seed-vr-phone-format', name: 'Phone format basic check', targetField: 'phone', ruleType: 'regex', config: '{"pattern":"^[+\\\\d\\\\s\\\\-().]{7,20}$"}', severity: 'warning', message: 'Phone number format looks unusual', priority: 3 },
  ];

  for (const rule of vRules) {
    await db.fieldValidationRule.upsert({
      where: { id: rule.id },
      update: rule,
      create: rule,
    });
  }

  // Normalization Mappings
  const normMappings = [
    { category: 'industry', sourceValue: 'banking', normalizedValue: 'Financial Services' },
    { category: 'industry', sourceValue: 'fintech', normalizedValue: 'Financial Technology' },
    { category: 'industry', sourceValue: 'health care', normalizedValue: 'Healthcare' },
    { category: 'industry', sourceValue: 'it', normalizedValue: 'Information Technology' },
    { category: 'industry', sourceValue: 'ecommerce', normalizedValue: 'E-Commerce' },
    { category: 'industry', sourceValue: 'biotech', normalizedValue: 'Biotechnology' },
    { category: 'industry', sourceValue: 'ai', normalizedValue: 'Artificial Intelligence' },
    { category: 'industry', sourceValue: 'cybersecurity', normalizedValue: 'Cybersecurity' },
    { category: 'industry', sourceValue: 'consulting', normalizedValue: 'Consulting' },
    { category: 'industry', sourceValue: 'real estate', normalizedValue: 'Real Estate' },
    { category: 'country', sourceValue: 'us', normalizedValue: 'United States' },
    { category: 'country', sourceValue: 'usa', normalizedValue: 'United States' },
    { category: 'country', sourceValue: 'uk', normalizedValue: 'United Kingdom' },
    { category: 'country', sourceValue: 'india', normalizedValue: 'India' },
    { category: 'country', sourceValue: 'uae', normalizedValue: 'United Arab Emirates' },
    { category: 'employee_size', sourceValue: 'self-employed', normalizedValue: '1-10' },
    { category: 'employee_size', sourceValue: 'startup', normalizedValue: '1-10' },
    { category: 'employee_size', sourceValue: 'smb', normalizedValue: '11-50' },
    { category: 'employee_size', sourceValue: 'enterprise', normalizedValue: '1,001-5,000' },
  ];

  for (const m of normMappings) {
    await db.normalizationMapping.upsert({
      where: { category_sourceValue: { category: m.category, sourceValue: m.sourceValue } },
      update: { normalizedValue: m.normalizedValue },
      create: m,
    });
  }

  // Scoring Weights
  const scoringWeights = [
    { dimension: 'data_quality', field: '', key: 'completeness', weight: 40, maxScore: 100, description: 'Fields filled' },
    { dimension: 'data_quality', field: '', key: 'validity', weight: 30, maxScore: 100, description: 'No errors' },
    { dimension: 'data_quality', field: '', key: 'richness', weight: 30, maxScore: 100, description: 'Data quality' },
    { dimension: 'role', field: '', key: 'c_level', weight: 25, maxScore: 25, description: 'C-level' },
    { dimension: 'role', field: '', key: 'vp', weight: 20, maxScore: 25, description: 'VP' },
    { dimension: 'role', field: '', key: 'director', weight: 20, maxScore: 25, description: 'Director' },
    { dimension: 'company_fit', field: 'industry', key: 'Technology', weight: 10, maxScore: 20, description: 'Tech industry' },
    { dimension: 'company_fit', field: 'industry', key: 'Financial Services', weight: 10, maxScore: 20, description: 'Finance' },
    { dimension: 'company_fit', field: 'industry', key: 'Healthcare', weight: 8, maxScore: 20, description: 'Healthcare' },
    { dimension: 'email_health', field: '', key: 'valid', weight: 15, maxScore: 15, description: 'Valid email' },
    { dimension: 'email_health', field: '', key: 'risky', weight: 8, maxScore: 15, description: 'Risky email' },
  ];

  for (const w of scoringWeights) {
    await db.scoringWeight.upsert({
      where: { dimension_field_key: { dimension: w.dimension, field: w.field, key: w.key } },
      update: { weight: w.weight, maxScore: w.maxScore, description: w.description },
      create: w,
    });
  }

  console.log(`[config-store] Auto-seed complete: ${cmRules.length} column rules, ${vRules.length} validation rules, ${normMappings.length} normalizations, ${scoringWeights.length} scoring weights`);
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