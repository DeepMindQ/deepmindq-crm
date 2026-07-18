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
    // ── Industries (comprehensive taxonomy) ──
    { category: 'industry', sourceValue: 'banking', normalizedValue: 'Financial Services' },
    { category: 'industry', sourceValue: 'finance', normalizedValue: 'Financial Services' },
    { category: 'industry', sourceValue: 'financial services', normalizedValue: 'Financial Services' },
    { category: 'industry', sourceValue: 'fintech', normalizedValue: 'Financial Technology' },
    { category: 'industry', sourceValue: 'financial technology', normalizedValue: 'Financial Technology' },
    { category: 'industry', sourceValue: 'insurtech', normalizedValue: 'Insurance Technology' },
    { category: 'industry', sourceValue: 'insurance', normalizedValue: 'Insurance' },
    { category: 'industry', sourceValue: 'health care', normalizedValue: 'Healthcare' },
    { category: 'industry', sourceValue: 'healthcare', normalizedValue: 'Healthcare' },
    { category: 'industry', sourceValue: 'health tech', normalizedValue: 'Healthcare Technology' },
    { category: 'industry', sourceValue: 'healthtech', normalizedValue: 'Healthcare Technology' },
    { category: 'industry', sourceValue: 'medtech', normalizedValue: 'Medical Technology' },
    { category: 'industry', sourceValue: 'pharma', normalizedValue: 'Pharmaceuticals' },
    { category: 'industry', sourceValue: 'pharmaceutical', normalizedValue: 'Pharmaceuticals' },
    { category: 'industry', sourceValue: 'biotech', normalizedValue: 'Biotechnology' },
    { category: 'industry', sourceValue: 'biotechnology', normalizedValue: 'Biotechnology' },
    { category: 'industry', sourceValue: 'it', normalizedValue: 'Information Technology' },
    { category: 'industry', sourceValue: 'information technology', normalizedValue: 'Information Technology' },
    { category: 'industry', sourceValue: 'software', normalizedValue: 'Software' },
    { category: 'industry', sourceValue: 'saas', normalizedValue: 'SaaS' },
    { category: 'industry', sourceValue: 'paas', normalizedValue: 'Cloud Computing' },
    { category: 'industry', sourceValue: 'iaas', normalizedValue: 'Cloud Computing' },
    { category: 'industry', sourceValue: 'cloud computing', normalizedValue: 'Cloud Computing' },
    { category: 'industry', sourceValue: 'cloud', normalizedValue: 'Cloud Computing' },
    { category: 'industry', sourceValue: 'ecommerce', normalizedValue: 'E-Commerce' },
    { category: 'industry', sourceValue: 'e-commerce', normalizedValue: 'E-Commerce' },
    { category: 'industry', sourceValue: 'e commerce', normalizedValue: 'E-Commerce' },
    { category: 'industry', sourceValue: 'retail', normalizedValue: 'Retail' },
    { category: 'industry', sourceValue: 'ai', normalizedValue: 'Artificial Intelligence' },
    { category: 'industry', sourceValue: 'artificial intelligence', normalizedValue: 'Artificial Intelligence' },
    { category: 'industry', sourceValue: 'machine learning', normalizedValue: 'Artificial Intelligence' },
    { category: 'industry', sourceValue: 'ml', normalizedValue: 'Artificial Intelligence' },
    { category: 'industry', sourceValue: 'cybersecurity', normalizedValue: 'Cybersecurity' },
    { category: 'industry', sourceValue: 'cyber security', normalizedValue: 'Cybersecurity' },
    { category: 'industry', sourceValue: 'infosec', normalizedValue: 'Cybersecurity' },
    { category: 'industry', sourceValue: 'consulting', normalizedValue: 'Consulting' },
    { category: 'industry', sourceValue: 'real estate', normalizedValue: 'Real Estate' },
    { category: 'industry', sourceValue: 'realestate', normalizedValue: 'Real Estate' },
    { category: 'industry', sourceValue: 'construction', normalizedValue: 'Construction' },
    { category: 'industry', sourceValue: 'manufacturing', normalizedValue: 'Manufacturing' },
    { category: 'industry', sourceValue: 'logistics', normalizedValue: 'Logistics & Supply Chain' },
    { category: 'industry', sourceValue: 'supply chain', normalizedValue: 'Logistics & Supply Chain' },
    { category: 'industry', sourceValue: 'transportation', normalizedValue: 'Transportation' },
    { category: 'industry', sourceValue: 'edtech', normalizedValue: 'Education Technology' },
    { category: 'industry', sourceValue: 'education', normalizedValue: 'Education' },
    { category: 'industry', sourceValue: 'education technology', normalizedValue: 'Education Technology' },
    { category: 'industry', sourceValue: 'legal', normalizedValue: 'Legal Services' },
    { category: 'industry', sourceValue: 'legaltech', normalizedValue: 'Legal Technology' },
    { category: 'industry', sourceValue: 'legal tech', normalizedValue: 'Legal Technology' },
    { category: 'industry', sourceValue: 'marketing', normalizedValue: 'Marketing & Advertising' },
    { category: 'industry', sourceValue: 'advertising', normalizedValue: 'Marketing & Advertising' },
    { category: 'industry', sourceValue: 'adtech', normalizedValue: 'Advertising Technology' },
    { category: 'industry', sourceValue: 'media', normalizedValue: 'Media & Entertainment' },
    { category: 'industry', sourceValue: 'entertainment', normalizedValue: 'Media & Entertainment' },
    { category: 'industry', sourceValue: 'gaming', normalizedValue: 'Gaming' },
    { category: 'industry', sourceValue: 'telecom', normalizedValue: 'Telecommunications' },
    { category: 'industry', sourceValue: 'telecommunications', normalizedValue: 'Telecommunications' },
    { category: 'industry', sourceValue: 'energy', normalizedValue: 'Energy' },
    { category: 'industry', sourceValue: 'renewable energy', normalizedValue: 'Renewable Energy' },
    { category: 'industry', sourceValue: 'cleantech', normalizedValue: 'Clean Technology' },
    { category: 'industry', sourceValue: 'agritech', normalizedValue: 'Agricultural Technology' },
    { category: 'industry', sourceValue: 'agriculture', normalizedValue: 'Agriculture' },
    { category: 'industry', sourceValue: 'food & beverage', normalizedValue: 'Food & Beverage' },
    { category: 'industry', sourceValue: 'f&b', normalizedValue: 'Food & Beverage' },
    { category: 'industry', sourceValue: 'hospitality', normalizedValue: 'Hospitality' },
    { category: 'industry', sourceValue: 'travel', normalizedValue: 'Travel & Tourism' },
    { category: 'industry', sourceValue: 'tourism', normalizedValue: 'Travel & Tourism' },
    { category: 'industry', sourceValue: 'automotive', normalizedValue: 'Automotive' },
    { category: 'industry', sourceValue: 'automobile', normalizedValue: 'Automotive' },
    { category: 'industry', sourceValue: 'aerospace', normalizedValue: 'Aerospace & Defense' },
    { category: 'industry', sourceValue: 'defense', normalizedValue: 'Aerospace & Defense' },
    { category: 'industry', sourceValue: 'government', normalizedValue: 'Government' },
    { category: 'industry', sourceValue: 'public sector', normalizedValue: 'Government' },
    { category: 'industry', sourceValue: 'nonprofit', normalizedValue: 'Non-Profit' },
    { category: 'industry', sourceValue: 'non-profit', normalizedValue: 'Non-Profit' },
    { category: 'industry', sourceValue: 'ngo', normalizedValue: 'Non-Profit' },
    { category: 'industry', sourceValue: 'hr tech', normalizedValue: 'HR Technology' },
    { category: 'industry', sourceValue: 'hrtech', normalizedValue: 'HR Technology' },
    { category: 'industry', sourceValue: 'human resources', normalizedValue: 'Human Resources' },
    { category: 'industry', sourceValue: 'prop tech', normalizedValue: 'Property Technology' },
    { category: 'industry', sourceValue: 'proptech', normalizedValue: 'Property Technology' },
    { category: 'industry', sourceValue: 'regtech', normalizedValue: 'Regulatory Technology' },
    { category: 'industry', sourceValue: 'wealtech', normalizedValue: 'Wealth Technology' },
    { category: 'industry', sourceValue: 'insurtech', normalizedValue: 'Insurance Technology' },
    { category: 'industry', sourceValue: 'devops', normalizedValue: 'Information Technology' },
    { category: 'industry', sourceValue: 'data analytics', normalizedValue: 'Data & Analytics' },
    { category: 'industry', sourceValue: 'blockchain', normalizedValue: 'Blockchain' },
    { category: 'industry', sourceValue: 'cryptocurrency', normalizedValue: 'Blockchain' },
    { category: 'industry', sourceValue: 'iot', normalizedValue: 'Internet of Things' },
    { category: 'industry', sourceValue: 'internet of things', normalizedValue: 'Internet of Things' },
    { category: 'industry', sourceValue: 'robotics', normalizedValue: 'Robotics' },
    { category: 'industry', sourceValue: 'semiconductor', normalizedValue: 'Semiconductors' },
    { category: 'industry', sourceValue: 'chips', normalizedValue: 'Semiconductors' },
    { category: 'industry', sourceValue: 'textile', normalizedValue: 'Textiles' },
    { category: 'industry', sourceValue: 'mining', normalizedValue: 'Mining' },
    { category: 'industry', sourceValue: 'oil & gas', normalizedValue: 'Oil & Gas' },
    { category: 'industry', sourceValue: 'utilities', normalizedValue: 'Utilities' },
    { category: 'industry', sourceValue: 'professional services', normalizedValue: 'Professional Services' },
    { category: 'industry', sourceValue: 'staffing', normalizedValue: 'Staffing & Recruiting' },
    { category: 'industry', sourceValue: 'recruiting', normalizedValue: 'Staffing & Recruiting' },

    // ── Countries (comprehensive, ISO-style) ──
    { category: 'country', sourceValue: 'us', normalizedValue: 'United States' },
    { category: 'country', sourceValue: 'usa', normalizedValue: 'United States' },
    { category: 'country', sourceValue: 'united states', normalizedValue: 'United States' },
    { category: 'country', sourceValue: 'united states of america', normalizedValue: 'United States' },
    { category: 'country', sourceValue: 'uk', normalizedValue: 'United Kingdom' },
    { category: 'country', sourceValue: 'gb', normalizedValue: 'United Kingdom' },
    { category: 'country', sourceValue: 'great britain', normalizedValue: 'United Kingdom' },
    { category: 'country', sourceValue: 'england', normalizedValue: 'United Kingdom' },
    { category: 'country', sourceValue: 'india', normalizedValue: 'India' },
    { category: 'country', sourceValue: 'in', normalizedValue: 'India' },
    { category: 'country', sourceValue: 'uae', normalizedValue: 'United Arab Emirates' },
    { category: 'country', sourceValue: 'united arab emirates', normalizedValue: 'United Arab Emirates' },
    { category: 'country', sourceValue: 'dubai', normalizedValue: 'United Arab Emirates' },
    { category: 'country', sourceValue: 'canada', normalizedValue: 'Canada' },
    { category: 'country', sourceValue: 'ca', normalizedValue: 'Canada' },
    { category: 'country', sourceValue: 'australia', normalizedValue: 'Australia' },
    { category: 'country', sourceValue: 'au', normalizedValue: 'Australia' },
    { category: 'country', sourceValue: 'germany', normalizedValue: 'Germany' },
    { category: 'country', sourceValue: 'de', normalizedValue: 'Germany' },
    { category: 'country', sourceValue: 'france', normalizedValue: 'France' },
    { category: 'country', sourceValue: 'fr', normalizedValue: 'France' },
    { category: 'country', sourceValue: 'japan', normalizedValue: 'Japan' },
    { category: 'country', sourceValue: 'jp', normalizedValue: 'Japan' },
    { category: 'country', sourceValue: 'china', normalizedValue: 'China' },
    { category: 'country', sourceValue: 'cn', normalizedValue: 'China' },
    { category: 'country', sourceValue: 'singapore', normalizedValue: 'Singapore' },
    { category: 'country', sourceValue: 'sg', normalizedValue: 'Singapore' },
    { category: 'country', sourceValue: 'netherlands', normalizedValue: 'Netherlands' },
    { category: 'country', sourceValue: 'nl', normalizedValue: 'Netherlands' },
    { category: 'country', sourceValue: 'holland', normalizedValue: 'Netherlands' },
    { category: 'country', sourceValue: 'sweden', normalizedValue: 'Sweden' },
    { category: 'country', sourceValue: 'se', normalizedValue: 'Sweden' },
    { category: 'country', sourceValue: 'norway', normalizedValue: 'Norway' },
    { category: 'country', sourceValue: 'no', normalizedValue: 'Norway' },
    { category: 'country', sourceValue: 'denmark', normalizedValue: 'Denmark' },
    { category: 'country', sourceValue: 'dk', normalizedValue: 'Denmark' },
    { category: 'country', sourceValue: 'finland', normalizedValue: 'Finland' },
    { category: 'country', sourceValue: 'fi', normalizedValue: 'Finland' },
    { category: 'country', sourceValue: 'switzerland', normalizedValue: 'Switzerland' },
    { category: 'country', sourceValue: 'ch', normalizedValue: 'Switzerland' },
    { category: 'country', sourceValue: 'italy', normalizedValue: 'Italy' },
    { category: 'country', sourceValue: 'it', normalizedValue: 'Italy' },
    { category: 'country', sourceValue: 'spain', normalizedValue: 'Spain' },
    { category: 'country', sourceValue: 'es', normalizedValue: 'Spain' },
    { category: 'country', sourceValue: 'portugal', normalizedValue: 'Portugal' },
    { category: 'country', sourceValue: 'pt', normalizedValue: 'Portugal' },
    { category: 'country', sourceValue: 'ireland', normalizedValue: 'Ireland' },
    { category: 'country', sourceValue: 'ie', normalizedValue: 'Ireland' },
    { category: 'country', sourceValue: 'brazil', normalizedValue: 'Brazil' },
    { category: 'country', sourceValue: 'br', normalizedValue: 'Brazil' },
    { category: 'country', sourceValue: 'mexico', normalizedValue: 'Mexico' },
    { category: 'country', sourceValue: 'mx', normalizedValue: 'Mexico' },
    { category: 'country', sourceValue: 'argentina', normalizedValue: 'Argentina' },
    { category: 'country', sourceValue: 'ar', normalizedValue: 'Argentina' },
    { category: 'country', sourceValue: 'colombia', normalizedValue: 'Colombia' },
    { category: 'country', sourceValue: 'co', normalizedValue: 'Colombia' },
    { category: 'country', sourceValue: 'chile', normalizedValue: 'Chile' },
    { category: 'country', sourceValue: 'cl', normalizedValue: 'Chile' },
    { category: 'country', sourceValue: 'peru', normalizedValue: 'Peru' },
    { category: 'country', sourceValue: 'south africa', normalizedValue: 'South Africa' },
    { category: 'country', sourceValue: 'za', normalizedValue: 'South Africa' },
    { category: 'country', sourceValue: 'nigeria', normalizedValue: 'Nigeria' },
    { category: 'country', sourceValue: 'ng', normalizedValue: 'Nigeria' },
    { category: 'country', sourceValue: 'kenya', normalizedValue: 'Kenya' },
    { category: 'country', sourceValue: 'ke', normalizedValue: 'Kenya' },
    { category: 'country', sourceValue: 'egypt', normalizedValue: 'Egypt' },
    { category: 'country', sourceValue: 'eg', normalizedValue: 'Egypt' },
    { category: 'country', sourceValue: 'saudi arabia', normalizedValue: 'Saudi Arabia' },
    { category: 'country', sourceValue: 'sa', normalizedValue: 'Saudi Arabia' },
    { category: 'country', sourceValue: 'israel', normalizedValue: 'Israel' },
    { category: 'country', sourceValue: 'il', normalizedValue: 'Israel' },
    { category: 'country', sourceValue: 'turkey', normalizedValue: 'Turkey' },
    { category: 'country', sourceValue: 'tr', normalizedValue: 'Turkey' },
    { category: 'country', sourceValue: 'south korea', normalizedValue: 'South Korea' },
    { category: 'country', sourceValue: 'kr', normalizedValue: 'South Korea' },
    { category: 'country', sourceValue: 'korea', normalizedValue: 'South Korea' },
    { category: 'country', sourceValue: 'indonesia', normalizedValue: 'Indonesia' },
    { category: 'country', sourceValue: 'id', normalizedValue: 'Indonesia' },
    { category: 'country', sourceValue: 'malaysia', normalizedValue: 'Malaysia' },
    { category: 'country', sourceValue: 'my', normalizedValue: 'Malaysia' },
    { category: 'country', sourceValue: 'thailand', normalizedValue: 'Thailand' },
    { category: 'country', sourceValue: 'th', normalizedValue: 'Thailand' },
    { category: 'country', sourceValue: 'vietnam', normalizedValue: 'Vietnam' },
    { category: 'country', sourceValue: 'vn', normalizedValue: 'Vietnam' },
    { category: 'country', sourceValue: 'philippines', normalizedValue: 'Philippines' },
    { category: 'country', sourceValue: 'ph', normalizedValue: 'Philippines' },
    { category: 'country', sourceValue: 'pakistan', normalizedValue: 'Pakistan' },
    { category: 'country', sourceValue: 'pk', normalizedValue: 'Pakistan' },
    { category: 'country', sourceValue: 'bangladesh', normalizedValue: 'Bangladesh' },
    { category: 'country', sourceValue: 'bd', normalizedValue: 'Bangladesh' },
    { category: 'country', sourceValue: 'poland', normalizedValue: 'Poland' },
    { category: 'country', sourceValue: 'pl', normalizedValue: 'Poland' },
    { category: 'country', sourceValue: 'czech republic', normalizedValue: 'Czech Republic' },
    { category: 'country', sourceValue: 'czechia', normalizedValue: 'Czech Republic' },
    { category: 'country', sourceValue: 'romania', normalizedValue: 'Romania' },
    { category: 'country', sourceValue: 'belgium', normalizedValue: 'Belgium' },
    { category: 'country', sourceValue: 'austria', normalizedValue: 'Austria' },
    { category: 'country', sourceValue: 'new zealand', normalizedValue: 'New Zealand' },
    { category: 'country', sourceValue: 'nz', normalizedValue: 'New Zealand' },
    { category: 'country', sourceValue: 'philippines', normalizedValue: 'Philippines' },

    // ── Employee Size (comprehensive text variants) ──
    { category: 'employee_size', sourceValue: 'self-employed', normalizedValue: '1-10' },
    { category: 'employee_size', sourceValue: 'solo', normalizedValue: '1-10' },
    { category: 'employee_size', sourceValue: 'freelancer', normalizedValue: '1-10' },
    { category: 'employee_size', sourceValue: 'solopreneur', normalizedValue: '1-10' },
    { category: 'employee_size', sourceValue: 'micro', normalizedValue: '1-10' },
    { category: 'employee_size', sourceValue: 'startup', normalizedValue: '1-10' },
    { category: 'employee_size', sourceValue: 'small business', normalizedValue: '11-50' },
    { category: 'employee_size', sourceValue: 'smb', normalizedValue: '11-50' },
    { category: 'employee_size', sourceValue: 'sme', normalizedValue: '51-200' },
    { category: 'employee_size', sourceValue: 'mid-market', normalizedValue: '201-500' },
    { category: 'employee_size', sourceValue: 'mid market', normalizedValue: '201-500' },
    { category: 'employee_size', sourceValue: 'midsize', normalizedValue: '201-500' },
    { category: 'employee_size', sourceValue: 'mid-size', normalizedValue: '201-500' },
    { category: 'employee_size', sourceValue: 'enterprise', normalizedValue: '10,001+' },
    { category: 'employee_size', sourceValue: 'large enterprise', normalizedValue: '10,001+' },
    { category: 'employee_size', sourceValue: 'mega', normalizedValue: '10,001+' },
    { category: 'employee_size', sourceValue: '1-10', normalizedValue: '1-10' },
    { category: 'employee_size', sourceValue: '1 to 10', normalizedValue: '1-10' },
    { category: 'employee_size', sourceValue: '1-50', normalizedValue: '1-50' },
    { category: 'employee_size', sourceValue: '2-10', normalizedValue: '1-10' },
    { category: 'employee_size', sourceValue: '11-50', normalizedValue: '11-50' },
    { category: 'employee_size', sourceValue: '51-200', normalizedValue: '51-200' },
    { category: 'employee_size', sourceValue: '201-500', normalizedValue: '201-500' },
    { category: 'employee_size', sourceValue: '501-1000', normalizedValue: '501-1,000' },
    { category: 'employee_size', sourceValue: '501-1,000', normalizedValue: '501-1,000' },
    { category: 'employee_size', sourceValue: '1001-5000', normalizedValue: '1,001-5,000' },
    { category: 'employee_size', sourceValue: '1,001-5,000', normalizedValue: '1,001-5,000' },
    { category: 'employee_size', sourceValue: '5001-10000', normalizedValue: '5,001-10,000' },
    { category: 'employee_size', sourceValue: '5,001-10,000', normalizedValue: '5,001-10,000' },
    { category: 'employee_size', sourceValue: '10001+', normalizedValue: '10,001+' },
    { category: 'employee_size', sourceValue: '10,001+', normalizedValue: '10,001+' },
    { category: 'employee_size', sourceValue: '10000+', normalizedValue: '10,001+' },
    { category: 'employee_size', sourceValue: '10k+', normalizedValue: '10,001+' },
    { category: 'employee_size', sourceValue: '5000-10000', normalizedValue: '5,001-10,000' },
    { category: 'employee_size', sourceValue: '1000-5000', normalizedValue: '1,001-5,000' },
    { category: 'employee_size', sourceValue: '500-1000', normalizedValue: '501-1,000' },
    { category: 'employee_size', sourceValue: '200-500', normalizedValue: '201-500' },
    { category: 'employee_size', sourceValue: '50-200', normalizedValue: '51-200' },
    { category: 'employee_size', sourceValue: '10-50', normalizedValue: '11-50' },
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