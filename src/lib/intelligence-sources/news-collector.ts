/**
 * Phase 2A — External News Collection Pipeline
 *
 * Single-source approach: One reliable data source producing real external
 * intelligence is more valuable than a complex multi-source framework.
 *
 * Data flow:
 *   Company ID → Construct search queries → Web search → Parse results
 *   → Store as Evidence (raw preservation) → Classify → Store as CompanySignal
 *
 * Critical principle: Preserve the raw intelligence EXACTLY as received.
 * This evidence becomes the foundation for Phase B's Evidence Engine.
 *
 * Raw evidence preserved:
 *   - Original headline
 *   - Original snippet
 *   - Source URL
 *   - Published date
 *   - Collection date
 *   - Source reliability score
 */

import { db } from '@/lib/db';
import { webSearch } from '@/lib/ai-copilot/ai-caller';
import { classifyEvidence, scoreSourceReliability, type RawEvidenceInput } from './evidence-classifier';
import { SIGNAL_HALF_LIVES } from '@/lib/scoring/freshness-ranking';

// ─── Types ─────────────────────────────────────────────────────

export interface NewsCollectionResult {
  companyId: string;
  companyName: string;
  totalSearched: number;
  evidenceCollected: number;
  signalsCreated: number;
  signalsSkipped: number;  // dedup or classification miss
  errors: string[];
  duration: number;        // ms
}

interface RawSearchResult {
  title: string;
  url: string;
  snippet: string;
}

// ─── Search Query Construction ────────────────────────────────

/**
 * Build targeted search queries for a company.
 * Focus on actionable intelligence: funding, hiring, tech changes, leadership.
 */
function buildSearchQueries(companyName: string, domain?: string | null): string[] {
  const name = companyName.replace(/\s+(Inc|Corp|Corporation|Ltd|LLC|Company|Co|Group|Holdings)\.?$/i, '').trim();
  const queries: string[] = [];

  // Query 1: Recent news with actionable keywords
  queries.push(`${name} news funding hiring expansion AI infrastructure 2025 2026`);

  // Query 2: Technology and product changes
  queries.push(`${name} announces launches cloud AI digital transformation`);

  // Query 3: Leadership and strategic moves
  if (domain) {
    queries.push(`site:${domain.replace('www.', '')} news press release`);
  }
  queries.push(`${name} CEO CTO leadership partnership acquisition`);

  return queries;
}

// ─── Deduplication ────────────────────────────────────────────

/**
 * Check if a headline is too similar to an existing signal for this company.
 * Simple approach: first 80 chars of title (case-insensitive) + companyId.
 * This prevents re-creating signals from the same news on repeated runs.
 */
async function isDuplicateSignal(companyId: string, headline: string): Promise<boolean> {
  const normalizedHeadline = headline.substring(0, 80).toLowerCase().trim();

  const existing = await db.companySignal.findFirst({
    where: {
      companyId,
      title: { contains: normalizedHeadline.substring(0, 50) },
      status: { notIn: ['archived', 'expired'] },
    },
    select: { id: true },
  });

  return existing !== null;
}

// ─── Evidence Storage (Raw Preservation) ────────────────────

/**
 * Store raw evidence exactly as received.
 * This is the "Phase B Evidence Engine" foundation — never lose the original.
 */
async function storeRawEvidence(
  companyId: string,
  evidence: RawEvidenceInput,
  sourceReliability: { score: number; quality: 'premium' | 'standard' | 'low' }
): Promise<string | null> {
  try {
    // Check for duplicate evidence by URL
    const existingEvidence = await db.evidence.findFirst({
      where: { companyId, sourceUrl: evidence.sourceUrl! },
      select: { id: true },
    });

    if (existingEvidence) {
      return existingEvidence.id; // Already stored
    }

    const created = await db.evidence.create({
      data: {
        companyId,
        sourceUrl: evidence.sourceUrl || `collected://${evidence.headline.substring(0, 50)}`,
        sourceTitle: evidence.headline,
        sourceName: evidence.sourceName || 'web_search',
        snippet: evidence.snippet,
        extractedField: 'news_intelligence',
        extractedValue: JSON.stringify({
          headline: evidence.headline,
          snippet: evidence.snippet,
          sourceName: evidence.sourceName,
          publishedDate: evidence.publishedDate,
          collectedAt: evidence.collectionDate,
          sourceReliabilityScore: sourceReliability.score,
          sourceQuality: sourceReliability.quality,
          origin: 'external_discovery',
        }),
        relevanceScore: sourceReliability.score,
        confidence: sourceReliability.score * 0.8, // Slightly below source reliability
        sourceDate: evidence.publishedDate ? new Date(evidence.publishedDate) : null,
        sourceQualityTier: sourceReliability.quality,
        status: 'active',
      },
    });

    return created.id;
  } catch (error) {
    console.error('[news-collector] Failed to store evidence:', error);
    return null;
  }
}

// ─── Signal Creation ──────────────────────────────────────────

/**
 * Create a CompanySignal from classified evidence.
 * Populates ALL Wave 8A fields for a complete Intelligence Object.
 */
async function createSignalFromEvidence(
  companyId: string,
  classified: ReturnType<typeof classifyEvidence>,
  evidence: RawEvidenceInput,
  evidenceId: string | null
): Promise<string | null> {
  if (!classified) return null;

  try {
    const signal = await db.companySignal.create({
      data: {
        companyId,
        signalType: classified.signalType,
        title: classified.title.substring(0, 300), // DB column limit
        description: classified.description?.substring(0, 1000),
        source: 'external_discovery',
        sourceUrl: evidence.sourceUrl,
        severity: classified.severity,
        impact: classified.severity === 'critical' || classified.severity === 'high' ? 'high' : classified.severity === 'medium' ? 'medium' : 'low',
        signalDate: evidence.publishedDate ? new Date(evidence.publishedDate) : new Date(evidence.collectionDate),
        confidence: classified.confidence,
        sourceQuality: scoreSourceReliability(evidence.sourceName, evidence.sourceUrl).quality,
        evidenceIds: evidenceId ? JSON.stringify([evidenceId]) : '[]',
        // Wave 8A Intelligence Object Framework fields
        businessImpact: classified.businessImpact,
        recommendedAction: classified.recommendedAction,
        timingWindow: classified.timingWindow,
        meaningCategory: classified.meaningCategory,
        // Compute expiry from half-life model
        expiresAt: computeExpiry(evidence.publishedDate || evidence.collectionDate, classified.signalType),
        status: 'active',
      },
    });

    return signal.id;
  } catch (error) {
    console.error('[news-collector] Failed to create signal:', error);
    return null;
  }
}

/**
 * Compute expiry date from the freshness model.
 * Signals expire at 2x their half-life.
 */
function computeExpiry(referenceDate: string, signalType: string): Date {
  const halfLife = SIGNAL_HALF_LIVES[signalType] || 30;
  const expiryDays = halfLife * 2;
  return new Date(new Date(referenceDate).getTime() + expiryDays * 24 * 60 * 60 * 1000);
}

// ─── Main Collection Function ─────────────────────────────────

/**
 * Collect external news for a single company.
 *
 * This is the primary entry point for the Phase 2A news pipeline.
 *
 * @param companyId - The company to collect intelligence for
 * @param maxResultsPerQuery - Max search results per query (default 5)
 * @returns Collection result with counts and any errors
 */
export async function collectNewsForCompany(
  companyId: string,
  maxResultsPerQuery: number = 5
): Promise<NewsCollectionResult> {
  const startTime = Date.now();
  const result: NewsCollectionResult = {
    companyId,
    companyName: '',
    totalSearched: 0,
    evidenceCollected: 0,
    signalsCreated: 0,
    signalsSkipped: 0,
    errors: [],
    duration: 0,
  };

  try {
    // Load company
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { id: true, rawName: true, domain: true },
    });

    if (!company) {
      result.errors.push(`Company not found: ${companyId}`);
      result.duration = Date.now() - startTime;
      return result;
    }

    result.companyName = company.rawName;

    // Build and execute search queries
    const queries = buildSearchQueries(company.rawName, company.domain);
    const searchBatches = await Promise.all(
      queries.map(q => webSearch(q, maxResultsPerQuery).catch(err => {
        console.error(`[news-collector] Search failed for "${q}":`, err);
        return [] as RawSearchResult[];
      }))
    );

    // Deduplicate by URL
    const seenUrls = new Set<string>();
    const allResults: RawSearchResult[] = [];
    for (const batch of searchBatches) {
      for (const item of batch) {
        if (item.url && !seenUrls.has(item.url)) {
          seenUrls.add(item.url);
          allResults.push(item);
        }
      }
    }

    result.totalSearched = allResults.length;

    if (allResults.length === 0) {
      result.errors.push('No search results found');
      result.duration = Date.now() - startTime;
      return result;
    }

    // Process each result: store evidence → classify → create signal
    for (const item of allResults) {
      try {
        const evidence: RawEvidenceInput = {
          headline: item.title,
          snippet: item.snippet,
          sourceName: null, // Web search doesn't always return source name
          sourceUrl: item.url,
          publishedDate: null, // Web search doesn't always return publish date
          collectionDate: new Date().toISOString(),
        };

        // Extract source name from URL
        try {
          const urlObj = new URL(item.url);
          evidence.sourceName = urlObj.hostname.replace('www.', '');
        } catch { /* ignore URL parse errors */ }

        // Check for duplicate signals
        const isDup = await isDuplicateSignal(companyId, evidence.headline);
        if (isDup) {
          result.signalsSkipped++;
          continue;
        }

        // Store raw evidence (Phase B foundation)
        const sourceReliability = scoreSourceReliability(evidence.sourceName, evidence.sourceUrl);
        const evidenceId = await storeRawEvidence(companyId, evidence, sourceReliability);
        if (evidenceId) {
          result.evidenceCollected++;
        }

        // Classify evidence → signal
        const classified = classifyEvidence(evidence);
        if (!classified) {
          result.signalsSkipped++;
          continue;
        }

        // Create CompanySignal
        const signalId = await createSignalFromEvidence(companyId, classified, evidence, evidenceId);
        if (signalId) {
          result.signalsCreated++;
        } else {
          result.signalsSkipped++;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        result.errors.push(`Error processing "${item.title.substring(0, 50)}": ${msg}`);
      }
    }

    // Update company enrichment timestamp
    await db.company.update({
      where: { id: companyId },
      data: { lastEnrichedAt: new Date() },
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Pipeline error: ${msg}`);
  }

  result.duration = Date.now() - startTime;
  return result;
}

// ─── Batch Collection ─────────────────────────────────────────

/**
 * Collect news for multiple companies in sequence.
 * Designed for background job execution.
 */
export async function collectNewsBatch(
  companyIds: string[],
  maxResultsPerQuery: number = 5
): Promise<NewsCollectionResult[]> {
  const results: NewsCollectionResult[] = [];

  for (const companyId of companyIds) {
    const result = await collectNewsForCompany(companyId, maxResultsPerQuery);
    results.push(result);
  }

  return results;
}
