/**
 * Evidence Storage — Research Intelligence Engine (Phase 3)
 *
 * Manages per-field evidence records linking extracted data
 * back to their web sources. Enables:
 * - "Show me all evidence for company X's revenue"
 * - Per-field confidence scoring based on evidence count & quality
 * - Full audit trail of what was extracted and from where
 */

import { db } from '@/lib/db';
import { webSearch, type WebSearchResult } from '@/lib/zai-helpers';

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
 * Run a search query and collect evidence records from results.
 * Each search result becomes an evidence entry.
 */
export async function collectEvidence(
  companyId: string,
  jobId: string | null,
  query: string,
  maxResults: number = 8,
): Promise<RawEvidence[]> {
  const results = await webSearch(query, maxResults);
  const evidence: RawEvidence[] = [];

  for (const r of results) {
    const sourceName = r.host_name || extractDomain(r.url);
    evidence.push({
      searchQuery: query,
      sourceUrl: r.url,
      sourceTitle: r.title || '',
      sourceName,
      snippet: r.snippet || r.description || '',
      relevanceScore: calculateRelevance(r),
    });
  }

  // Batch store evidence
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
        confidence: e.relevanceScore * 0.8, // initial confidence = relevance * 0.8
      })),
    });
  }

  return evidence;
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

  // Get all evidence for this company
  const allEvidence = await db.evidence.findMany({
    where: { companyId },
    orderBy: { relevanceScore: 'desc' },
  });

  if (allEvidence.length === 0) {
    // No evidence — low confidence for everything
    for (const field of Object.keys(extractedData)) {
      fieldConfidence[field] = 0.2;
    }
    return { fieldConfidence, updatedEvidence: 0 };
  }

  // For each extracted field, find supporting evidence
  const searchableFields = [
    'revenue', 'employeeCount', 'fundingStage', 'techStack',
    'industry', 'businessOverview', 'website',
  ];

  for (const field of Object.keys(extractedData)) {
    if (!searchableFields.includes(field)) {
      fieldConfidence[field] = 0.5; // unknown field, medium confidence
      continue;
    }

    const value = extractedData[field];
    if (!value || value === 'Not found') {
      fieldConfidence[field] = 0;
      continue;
    }

    // Find evidence snippets that mention this field's value
    const supportingEvidence = allEvidence.filter(e =>
      e.snippet.toLowerCase().includes(value.toLowerCase().slice(0, 30))
    );

    if (supportingEvidence.length === 0) {
      fieldConfidence[field] = 0.3; // extracted but no direct evidence
      continue;
    }

    // Confidence = based on count and quality of supporting evidence
    const avgRelevance = supportingEvidence.reduce((sum, e) => sum + e.relevanceScore, 0) / supportingEvidence.length;
    const countBonus = Math.min(supportingEvidence.length / 3, 1); // max bonus at 3+ sources
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

function calculateRelevance(result: WebSearchResult): number {
  let score = 0.5;
  // Longer snippets are more useful
  if (result.snippet.length > 200) score += 0.15;
  else if (result.snippet.length > 100) score += 0.1;
  // Has a title
  if (result.title) score += 0.1;
  // Known high-quality sources
  const highQuality = ['linkedin.com', 'crunchbase.com', 'techcrunch.com', 'bloomberg.com', 'reuters.com'];
  if (highQuality.some(h => result.url?.includes(h))) score += 0.15;
  // Not a social media link
  const social = ['twitter.com', 'x.com', 'facebook.com', 'instagram.com'];
  if (!social.some(s => result.url?.includes(s))) score += 0.05;
  return Math.min(1, score);
}