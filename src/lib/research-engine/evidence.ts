/**
 * Evidence Storage — Research Intelligence Engine (Phase 3)
 *
 * Manages per-field evidence records linking extracted data
 * back to their web sources. Enables:
 * - "Show me all evidence for company X's revenue"
 * - Per-field confidence scoring based on evidence count & quality
 * - Full audit trail of what was extracted and from where
 * - Deduplication on re-research (GAP 16+21)
 * - Accepts pre-fetched results to avoid double-searching (GAP 15)
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

// ── Step 2: Evidence Collection ──

/**
 * Store evidence from already-fetched search results (no re-searching).
 * Used by researcher.ts Step 2 after Step 1 has collected results.
 * Deduplicates against existing evidence for the same company+URL.
 */
export async function storeEvidenceFromResults(
  companyId: string,
  jobId: string | null,
  searchQuery: string,
  results: Array<{ title: string; snippet: string; url: string; source: string }>,
): Promise<RawEvidence[]> {
  if (results.length === 0) return [];

  // Get existing URLs for this company to dedup (GAP 16)
  const existingEvidence = await db.evidence.findMany({
    where: { companyId },
    select: { sourceUrl: true },
  });
  const existingUrls = new Set(existingEvidence.map(e => e.sourceUrl));

  const evidence: RawEvidence[] = [];
  for (const r of results) {
    // Skip duplicates
    if (existingUrls.has(r.url)) continue;

    const sourceName = r.source || extractDomain(r.url);
    const relevance = calculateRelevanceFromRaw(r);
    evidence.push({
      searchQuery,
      sourceUrl: r.url,
      sourceTitle: r.title || '',
      sourceName,
      snippet: r.snippet,
      relevanceScore: relevance,
    });
    existingUrls.add(r.url); // prevent intra-batch dups too
  }

  // Batch store new evidence
  if (evidence.length > 0) {
    await db.evidence.createMany({
      data: evidence.map(e => ({
        companyId,
        jobId: jobId || undefined,
        searchQuery: e.searchQuery,
        sourceUrl: e.sourceUrl,
        sourceTitle: e.sourceTitle,
        sourceName: e.sourceName,
        snippet: e.snippet,
        relevanceScore: e.relevanceScore,
        confidence: e.relevanceScore * 0.8,
      })),
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
  }));
  return storeEvidenceFromResults(companyId, jobId, query, normalized);
}

// ── Evidence Cleanup on Re-Research (GAP 21) ──

/**
 * Mark old evidence as superseded before a new research run.
 * Keeps last run's evidence, archives older runs.
 */
export async function cleanupOldEvidence(companyId: string, keepJobId: string | null): Promise<number> {
  // Get the most recent evidence batch (by this job or latest)
  const latestEvidence = await db.evidence.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true },
  });

  if (latestEvidence.length <= 50) return 0; // not enough to warrant cleanup

  // Delete evidence older than the latest 50 records
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
 * Returns per-field confidence based on evidence count and source quality.
 */
export async function linkEvidenceToFields(
  companyId: string,
  extractedData: Record<string, string>,
): Promise<{ fieldConfidence: FieldConfidence; updatedEvidence: number }> {
  const fieldConfidence: FieldConfidence = {};
  let updatedEvidence = 0;

  // Get all evidence for this company (only current run's evidence)
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

    // Find evidence snippets that mention this field's value
    // Use multiple strategies: exact match, keyword match, partial match
    const valueLower = value.toLowerCase();
    const fieldKeywords = getFieldKeywords(field);

    const supportingEvidence = allEvidence.filter(e => {
      const snippetLower = e.snippet.toLowerCase();
      // Strategy 1: value appears in snippet
      if (valueLower !== 'not found' && snippetLower.includes(valueLower.slice(0, 40))) return true;
      // Strategy 2: field keywords appear in snippet (for short/generic values)
      if (fieldKeywords.some(kw => snippetLower.includes(kw))) return true;
      return false;
    });

    if (supportingEvidence.length === 0) {
      fieldConfidence[field] = 0.3;
      continue;
    }

    const avgRelevance = supportingEvidence.reduce((sum, e) => sum + e.relevanceScore, 0) / supportingEvidence.length;
    const countBonus = Math.min(supportingEvidence.length / 3, 1);
    const confidence = Math.min(1, avgRelevance * 0.6 + countBonus * 0.4);

    fieldConfidence[field] = Math.round(confidence * 100) / 100;

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
 */
export async function getEvidenceSummary(companyId: string): Promise<{
  totalEvidence: number;
  fields: Record<string, { count: number; avgConfidence: number }>;
}> {
  const evidence = await db.evidence.findMany({
    where: { companyId, extractedField: { not: null } },
    select: { extractedField: true, confidence: true },
  });

  const fields: Record<string, { count: number; confidenceSum: number }> = {};
  for (const e of evidence) {
    const f = e.extractedField!;
    if (!fields[f]) fields[f] = { count: 0, confidenceSum: 0 };
    fields[f].count++;
    fields[f].confidenceSum += e.confidence;
  }

  return {
    totalEvidence: evidence.length,
    fields: Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, {
        count: v.count,
        avgConfidence: Math.round((v.confidenceSum / v.count) * 100) / 100,
      }])
    ),
  };
}

// ── Helpers ──

function extractDomain(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

function calculateRelevanceFromRaw(result: { title: string; snippet: string; url: string }): number {
  let score = 0.5;
  if (result.snippet.length > 200) score += 0.15;
  else if (result.snippet.length > 100) score += 0.1;
  if (result.title) score += 0.1;
  const highQuality = ['linkedin.com', 'crunchbase.com', 'techcrunch.com', 'bloomberg.com', 'reuters.com'];
  if (highQuality.some(h => result.url?.includes(h))) score += 0.15;
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