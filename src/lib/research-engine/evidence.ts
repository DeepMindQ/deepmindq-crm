/**
 * Evidence Storage — Research Intelligence Engine (Phase 3)
 *
 * Manages per-field evidence records linking extracted data
 * back to their web sources. Enables:
 * - "Show me all evidence for company X's revenue"
 * - Per-field confidence scoring based on evidence count, quality, recency
 * - Full audit trail of what was extracted and from where
 * - Deduplication on re-research
 * - Accepts pre-fetched results to avoid double-searching
 * - Recency-weighted confidence decay (sources older than 12 months decay)
 * - Corroboration scoring (multi-source confirmation boost)
 * - Source quality tiers from SystemSetting (config-over-code)
 */

import { db } from '@/lib/db';
import { type WebSearchResult } from '@/lib/zai-helpers';

// ── Types ──

export interface RawEvidence {
  searchQuery: string;
  sourceUrl: string;
  sourceTitle: string;
  sourceName: string;
  snippet: string;
  relevanceScore: number; // 0-1
  sourceDate?: string | null; // ISO date from search result
}

export interface ExtractedField {
  field: string;          // revenue, employeeCount, etc.
  value: string;
  confidence: number;     // 0-1
  evidenceCount: number;
  sources: string[];      // evidence IDs
}

export interface FieldConfidence {
  [field: string]: number; // field → 0-1 confidence
}

// ── Source Quality Tiers (Config-over-Code) ──

interface SourceTierConfig {
  premium: string[];   // highest trust — Bloomberg, Reuters, official filings
  standard: string[];  // reliable — TechCrunch, Crunchbase, LinkedIn
  low: string[];       // lower trust — social media, forums, aggregators
  // recency weights
  recencyHalfLifeDays: number;  // days after which confidence halves (default 365)
  corroborationBonus: number;   // bonus per additional corroborating source (default 0.08)
  maxCorroborationBonus: number; // cap on total corroboration bonus (default 0.25)
}

const DEFAULT_TIER_CONFIG: SourceTierConfig = {
  premium: [
    'bloomberg.com', 'reuters.com', 'wsj.com', 'ft.com', 'sec.gov',
    'crunchbase.com', 'pitchbook.com', 'privco.com', 'linkedIn.com',
  ],
  standard: [
    'techcrunch.com', 'venturebeat.com', 'businessinsider.com',
    'forbes.com', 'wired.com', 'theverge.com', 'arstechnica.com',
    'linkedin.com', 'zoominfo.com', 'g2.com', 'gartner.com',
  ],
  low: [
    'twitter.com', 'x.com', 'facebook.com', 'instagram.com',
    'reddit.com', 'quora.com', 'medium.com', 'yelp.com',
  ],
  recencyHalfLifeDays: 365,
  corroborationBonus: 0.08,
  maxCorroborationBonus: 0.25,
};

/**
 * Load source quality tier config from SystemSetting (config-over-code).
 * Falls back to DEFAULT_TIER_CONFIG if not set.
 */
async function getTierConfig(): Promise<SourceTierConfig> {
  try {
    const setting = await db.systemSetting.findUnique({
      where: { key: 'evidence_source_tiers' },
    });
    if (setting?.value) {
      const parsed = JSON.parse(setting.value) as Partial<SourceTierConfig>;
      return {
        premium: parsed.premium || DEFAULT_TIER_CONFIG.premium,
        standard: parsed.standard || DEFAULT_TIER_CONFIG.standard,
        low: parsed.low || DEFAULT_TIER_CONFIG.low,
        recencyHalfLifeDays: parsed.recencyHalfLifeDays || DEFAULT_TIER_CONFIG.recencyHalfLifeDays,
        corroborationBonus: parsed.corroborationBonus || DEFAULT_TIER_CONFIG.corroborationBonus,
        maxCorroborationBonus: parsed.maxCorroborationBonus || DEFAULT_TIER_CONFIG.maxCorroborationBonus,
      };
    }
  } catch (err) {
    console.warn('[evidence] Failed to load tier config from SystemSetting, using defaults:', err);
  }
  return DEFAULT_TIER_CONFIG;
}

/**
 * Classify a URL into a quality tier: premium, standard, or low.
 */
async function classifySourceTier(url: string): Promise<string> {
  const config = await getTierConfig();
  const urlLower = url.toLowerCase();

  if (config.premium.some(d => urlLower.includes(d))) return 'premium';
  if (config.low.some(d => urlLower.includes(d))) return 'low';
  return 'standard';
}

/**
 * Convert quality tier to a numeric weight for confidence calculation.
 */
function tierToWeight(tier: string): number {
  switch (tier) {
    case 'premium': return 1.0;
    case 'standard': return 0.7;
    case 'low': return 0.4;
    default: return 0.7;
  }
}

// ── Recency Scoring ──

/**
 * Calculate a recency decay factor (0-1) based on how old the source is.
 * Uses exponential decay: decay = 2^(-ageDays / halfLifeDays)
 * - Source from today: 1.0
 * - Source at half-life: 0.5
 * - Source at 2x half-life: 0.25
 * If no sourceDate, assume recent (0.9) to avoid penalizing unknown dates too hard.
 */
function calculateRecencyFactor(sourceDate: Date | null, halfLifeDays: number): number {
  if (!sourceDate) return 0.9; // unknown date — assume reasonably recent

  const ageMs = Date.now() - sourceDate.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays < 0) return 0.9; // future date, treat as recent
  if (ageDays < 30) return 1.0; // last 30 days = fully fresh

  // Exponential decay
  const decay = Math.pow(2, -ageDays / halfLifeDays);
  return Math.max(0.1, Math.min(1, decay)); // floor at 0.1
}

// ── Step 2: Evidence Collection ──

/**
 * Store evidence from already-fetched search results (no re-searching).
 * Used by researcher.ts Step 2 after Step 1 has collected results.
 * Deduplicates against existing evidence for the same company+URL.
 * Classifies source quality tier from config.
 */
export async function storeEvidenceFromResults(
  companyId: string,
  jobId: string | null,
  searchQuery: string,
  results: Array<{ title: string; snippet: string; url: string; source: string; date?: string }>,
): Promise<RawEvidence[]> {
  if (results.length === 0) return [];

  // Get existing URLs for this company to dedup
  const existingEvidence = await db.evidence.findMany({
    where: { companyId },
    select: { sourceUrl: true },
  });
  const existingUrls = new Set(existingEvidence.map(e => e.sourceUrl));

  // Load tier config once for the whole batch
  const tierConfig = await getTierConfig();

  const evidence: RawEvidence[] = [];
  for (const r of results) {
    // Skip duplicates
    if (existingUrls.has(r.url)) continue;

    const sourceName = r.source || extractDomain(r.url);
    const relevance = calculateRelevanceFromRaw(r, tierConfig);
    const tier = classifySourceTierSync(r.url, tierConfig);
    const sourceDate = r.date ? parseFlexibleDate(r.date) : null;

    evidence.push({
      searchQuery,
      sourceUrl: r.url,
      sourceTitle: r.title || '',
      sourceName,
      snippet: r.snippet,
      relevanceScore: relevance,
      sourceDate: r.date || null,
    });
    existingUrls.add(r.url); // prevent intra-batch dups too
  }

  // Batch store new evidence with quality tier and source date
  if (evidence.length > 0) {
    await db.evidence.createMany({
      data: evidence.map(e => {
        const tier = classifySourceTierSync(e.sourceUrl, tierConfig);
        return {
          companyId,
          jobId: jobId || undefined,
          searchQuery: e.searchQuery,
          sourceUrl: e.sourceUrl,
          sourceTitle: e.sourceTitle,
          sourceName: e.sourceName,
          snippet: e.snippet,
          relevanceScore: e.relevanceScore,
          confidence: e.relevanceScore * 0.8, // initial confidence, updated in Step 4
          sourceDate: e.sourceDate ? parseFlexibleDate(e.sourceDate) : null,
          sourceQualityTier: tier,
        };
      }),
    });
  }

  return evidence;
}

/**
 * Legacy: Run a search query and collect evidence records from results.
 * Kept for backward compat — prefer storeEvidenceFromResults() when results
 * are already available.
 */
export async function collectEvidence(
  companyId: string,
  jobId: string | null,
  query: string,
  maxResults: number = 8,
): Promise<RawEvidence[]> {
  const { webSearch } = await import('@/lib/zai-helpers');
  const results = await webSearch(query, maxResults);
  const normalized = results.map(r => ({
    title: r.title,
    snippet: r.snippet || r.description || '',
    url: r.url,
    source: r.host_name || r.name || '',
    date: r.date || '',
  }));
  return storeEvidenceFromResults(companyId, jobId, query, normalized);
}

// ── Evidence Cleanup on Re-Research ──

/**
 * Clean up old evidence before a new research run.
 * Keeps the latest 50 records, deletes older ones.
 * This prevents unbounded evidence growth on repeated research.
 */
export async function cleanupOldEvidence(companyId: string, _keepJobId: string | null): Promise<number> {
  const latestEvidence = await db.evidence.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true },
  });

  if (latestEvidence.length <= 50) return 0;

  const keepIds = new Set(latestEvidence.map(e => e.id));
  const oldCount = await db.evidence.count({
    where: {
      companyId,
      id: { notIn: [...keepIds] },
    },
  });

  if (oldCount > 0) {
    await db.evidence.deleteMany({
      where: {
        companyId,
        id: { notIn: [...keepIds] },
      },
    });
  }

  return oldCount;
}

// ── Step 4: Field Validation — Cross-Reference ──

/**
 * After LLM extraction, link extracted values to their supporting evidence.
 * Returns per-field confidence based on:
 *   1. Source quality tier (premium/standard/low)
 *   2. Relevance score of matching evidence
 *   3. Recency decay (how old the source is)
 *   4. Corroboration (how many independent sources confirm the same value)
 */
export async function linkEvidenceToFields(
  companyId: string,
  extractedData: Record<string, string>,
): Promise<{ fieldConfidence: FieldConfidence; updatedEvidence: number }> {
  const fieldConfidence: FieldConfidence = {};
  let updatedEvidence = 0;

  // Load config for recency and corroboration
  const tierConfig = await getTierConfig();

  // Get all evidence for this company
  const allEvidence = await db.evidence.findMany({
    where: { companyId },
    orderBy: { relevanceScore: 'desc' },
  });

  if (allEvidence.length === 0) {
    for (const field of Object.keys(extractedData)) {
      fieldConfidence[field] = 0.2;
    }
    return { fieldConfidence, updatedEvidence: 0 };
  }

  const searchableFields = [
    'revenue', 'employeeCount', 'fundingStage', 'techStack',
    'industry', 'businessOverview', 'website',
  ];

  for (const field of Object.keys(extractedData)) {
    if (!searchableFields.includes(field)) {
      fieldConfidence[field] = 0.5;
      continue;
    }

    const value = extractedData[field];
    if (!value || value === 'Not found') {
      fieldConfidence[field] = 0;
      continue;
    }

    // Find evidence snippets that support this field
    const valueLower = value.toLowerCase();
    const fieldKeywords = getFieldKeywords(field);

    const supportingEvidence = allEvidence.filter(e => {
      const snippetLower = e.snippet.toLowerCase();
      // Strategy 1: value appears in snippet (first 40 chars for long values)
      if (valueLower !== 'not found' && valueLower.length > 3 && snippetLower.includes(valueLower.slice(0, 40))) return true;
      // Strategy 2: field keywords appear in snippet (for short/generic values)
      if (fieldKeywords.some(kw => snippetLower.includes(kw))) return true;
      return false;
    });

    if (supportingEvidence.length === 0) {
      fieldConfidence[field] = 0.3;
      continue;
    }

    // ── Multi-factor confidence calculation ──

    // Factor 1: Average relevance score (0-1)
    const avgRelevance = supportingEvidence.reduce((sum, e) => sum + e.relevanceScore, 0) / supportingEvidence.length;

    // Factor 2: Source quality tier weighting
    const avgTierWeight = supportingEvidence.reduce((sum, e) => sum + tierToWeight(e.sourceQualityTier), 0) / supportingEvidence.length;

    // Factor 3: Recency decay — average recency across all supporting evidence
    const avgRecency = supportingEvidence.reduce((sum, e) => {
      return sum + calculateRecencyFactor(e.sourceDate, tierConfig.recencyHalfLifeDays);
    }, 0) / supportingEvidence.length;

    // Factor 4: Corroboration — how many independent sources confirm
    // Use unique domains (not just URLs) to count truly independent sources
    const uniqueDomains = new Set(
      supportingEvidence.map(e => {
        try { return new URL(e.sourceUrl).hostname; } catch { return e.sourceUrl; }
      })
    );
    const corroborationCount = uniqueDomains.size;
    const corroborationBoost = Math.min(
      (corroborationCount - 1) * tierConfig.corroborationBonus, // -1 because first source is baseline
      tierConfig.maxCorroborationBonus,
    );

    // Weighted combination:
    //   relevance: 30%, quality tier: 25%, recency: 25%, corroboration: 20%
    const rawConfidence = (
      avgRelevance * 0.30 +
      avgTierWeight * 0.25 +
      avgRecency * 0.25 +
      (0.5 + corroborationBoost) * 0.20  // 0.5 base + corroboration bonus
    );

    const confidence = Math.round(Math.min(1, rawConfidence) * 100) / 100;
    fieldConfidence[field] = confidence;

    // Update evidence records to link them to this field
    const evidenceIds = supportingEvidence.map(e => e.id);
    await db.evidence.updateMany({
      where: { id: { in: evidenceIds }, extractedField: null },
      data: {
        extractedField: field,
        extractedValue: value,
        confidence: confidence,
      },
    });
    updatedEvidence += evidenceIds.length;
  }

  return { fieldConfidence, updatedEvidence };
}

// ── Evidence Retrieval ──

/**
 * Get all evidence for a specific company and field.
 */
export async function getEvidenceForField(
  companyId: string,
  field: string,
): Promise<Array<{
  id: string;
  sourceUrl: string;
  sourceTitle: string | null;
  sourceName: string | null;
  snippet: string;
  extractedValue: string | null;
  confidence: number;
  sourceQualityTier: string;
  sourceDate: Date | null;
  createdAt: Date;
}>> {
  return db.evidence.findMany({
    where: { companyId, extractedField: field },
    orderBy: { confidence: 'desc' },
    select: {
      id: true,
      sourceUrl: true,
      sourceTitle: true,
      sourceName: true,
      snippet: true,
      extractedValue: true,
      confidence: true,
      sourceQualityTier: true,
      sourceDate: true,
      createdAt: true,
    },
  });
}

/**
 * Get ALL evidence for a company (with optional field filter).
 */
export async function getCompanyEvidence(
  companyId: string,
  options?: { field?: string; limit?: number; offset?: number },
): Promise<{
  evidence: Array<{
    id: string;
    searchQuery: string | null;
    sourceUrl: string;
    sourceTitle: string | null;
    sourceName: string | null;
    snippet: string;
    extractedField: string | null;
    extractedValue: string | null;
    relevanceScore: number;
    confidence: number;
    sourceQualityTier: string;
    sourceDate: Date | null;
    createdAt: Date;
  }>;
  total: number;
}> {
  const where: Record<string, unknown> = { companyId };
  if (options?.field) where.extractedField = options.field;

  const [evidence, total] = await Promise.all([
    db.evidence.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    }),
    db.evidence.count({ where }),
  ]);

  return { evidence, total };
}

/**
 * Get evidence summary for a company — how many evidence per field.
 * Includes average confidence and quality tier breakdown.
 */
export async function getEvidenceSummary(companyId: string): Promise<{
  totalEvidence: number;
  fields: Record<string, { count: number; avgConfidence: number; tierBreakdown: { premium: number; standard: number; low: number } }>;
}> {
  const evidence = await db.evidence.findMany({
    where: { companyId, extractedField: { not: null } },
    select: { extractedField: true, confidence: true, sourceQualityTier: true },
  });

  const fields: Record<string, { count: number; confidenceSum: number; tierBreakdown: { premium: number; standard: number; low: number } }> = {};
  for (const e of evidence) {
    const f = e.extractedField!;
    if (!fields[f]) fields[f] = { count: 0, confidenceSum: 0, tierBreakdown: { premium: 0, standard: 0, low: 0 } };
    fields[f].count++;
    fields[f].confidenceSum += e.confidence;
    const tier = e.sourceQualityTier as 'premium' | 'standard' | 'low';
    if (tier in fields[f].tierBreakdown) fields[f].tierBreakdown[tier]++;
  }

  return {
    totalEvidence: evidence.length,
    fields: Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, {
        count: v.count,
        avgConfidence: Math.round((v.confidenceSum / v.count) * 100) / 100,
        tierBreakdown: v.tierBreakdown,
      }])
    ),
  };
}

// ── Helpers ──

function extractDomain(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

/**
 * Classify source tier synchronously (when config is already loaded).
 */
function classifySourceTierSync(url: string, config: SourceTierConfig): string {
  const urlLower = url.toLowerCase();
  if (config.premium.some(d => urlLower.includes(d))) return 'premium';
  if (config.low.some(d => urlLower.includes(d))) return 'low';
  return 'standard';
}

/**
 * Calculate relevance score from raw search result.
 * Now uses config-over-code tier lists instead of hardcoded domains.
 */
function calculateRelevanceFromRaw(
  result: { title: string; snippet: string; url: string },
  tierConfig?: SourceTierConfig,
): number {
  let score = 0.5;
  if (result.snippet.length > 200) score += 0.15;
  else if (result.snippet.length > 100) score += 0.1;
  if (result.title) score += 0.1;

  // Source quality bonus from tier config (or defaults)
  const config = tierConfig || DEFAULT_TIER_CONFIG;
  const tier = classifySourceTierSync(result.url, config);
  if (tier === 'premium') score += 0.2;
  else if (tier === 'standard') score += 0.1;
  // low tier: no bonus

  // Social media penalty (they're rarely good evidence for business data)
  const social = ['twitter.com', 'x.com', 'facebook.com', 'instagram.com'];
  if (!social.some(s => result.url?.includes(s))) score += 0.05;

  return Math.min(1, score);
}

function calculateRelevance(result: WebSearchResult): number {
  return calculateRelevanceFromRaw({
    title: result.title,
    snippet: result.snippet || result.description || '',
    url: result.url,
  });
}

/**
 * Parse flexible date strings from search results (ISO, relative, etc.)
 */
function parseFlexibleDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  try {
    // Try ISO format first
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
  } catch { /* fall through */ }

  // Try relative dates like "2 days ago", "3 months ago"
  const relativeMatch = dateStr.match(/(\d+)\s+(day|days|week|weeks|month|months|year|years)\s+ago/i);
  if (relativeMatch) {
    const num = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2].toLowerCase();
    const now = new Date();
    switch (unit) {
      case 'day': case 'days': return new Date(now.getTime() - num * 86400000);
      case 'week': case 'weeks': return new Date(now.getTime() - num * 7 * 86400000);
      case 'month': case 'months': return new Date(now.getTime() - num * 30 * 86400000);
      case 'year': case 'years': return new Date(now.getTime() - num * 365 * 86400000);
    }
  }

  return null;
}

/**
 * Get search keywords for each field to improve evidence matching.
 */
function getFieldKeywords(field: string): string[] {
  const map: Record<string, string[]> = {
    revenue: ['revenue', 'annual revenue', 'turnover', 'sales', 'arr', 'million', 'billion', 'usd', '$'],
    employeeCount: ['employee', 'employees', 'headcount', 'people', 'staff', 'workers', 'team size'],
    fundingStage: ['funding', 'series', 'seed', 'investment', 'valuation', 'raised', 'venture', 'bootstrap'],
    techStack: ['technology', 'tech stack', 'built with', 'uses', 'platform', 'framework', 'cloud', 'aws', 'azure', 'kubernetes'],
    industry: ['industry', 'sector', 'market', 'space', 'vertical', 'category'],
    businessOverview: ['company', 'founded', 'based', 'headquartered', 'provides', 'offers', 'serves'],
    website: ['website', 'http', 'www', '.com', 'official site'],
  };
  return map[field] || [field];
}