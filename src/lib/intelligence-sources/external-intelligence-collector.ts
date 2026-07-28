/**
 * Phase 2A — External Intelligence Collector
 *
 * Source-agnostic intelligence collection interface. Today: web search via z-ai-web-dev-sdk.
 * Tomorrow: APIs, crawlers, enterprise connectors. The source can change.
 * The intelligence pipeline should not.
 *
 * Multi-sensor approach:
 *   Sensor 1: External Business Intelligence (announcements, partnerships, strategic news)
 *   Sensor 2: Hiring Intelligence (careers pages, job postings, talent signals)
 *   Sensor 3: People / Leadership Intelligence (appointments, organizational changes)
 *
 * Company-size adaptive strategy:
 *   Enterprise (10k+): News-focused queries (announcements, partnerships, acquisitions)
 *   Mid-market (200-2k): Hiring/people-focused queries (careers, jobs, technology)
 *   Default: Balanced mix of both strategies
 *
 * Critical principle: Preserve raw evidence EXACTLY as received.
 * This evidence becomes the Phase B Evidence Engine foundation.
 */

import { db } from '@/lib/db';
import { webSearch } from '@/lib/ai-copilot/ai-caller';
import { classifyEvidence, scoreSourceReliability, type RawEvidenceInput } from './evidence-classifier';

// ─── Types ─────────────────────────────────────────────

export interface IntelligenceCollectionResult {
  companyId: string;
  companyName: string;
  companySizeRange: string | null;
  totalSearched: number;
  evidenceCollected: number;
  signalsCreated: number;
  signalsSkipped: number;
  errors: string[];
  duration: number;
}

interface RawSearchResult {
  title: string;
  url: string;
  snippet: string;
}

// ─── Company Size Classification ────────────────────────────────

type CompanySizeTier = 'enterprise' | 'mid_market' | 'default';

function classifyCompanySize(sizeRange: string | null | undefined): CompanySizeTier {
  if (!sizeRange) return 'default';
  const s = sizeRange.toLowerCase();
  // Enterprise patterns
  if (s.includes('10000') || s.includes('10,000') || s.includes('10001') || s.includes('10,001') ||
      s.includes('50000') || s.includes('50,000') || s === '10000+' || s === '50000+') {
    return 'enterprise';
  }
  // Mid-market patterns
  if (s.includes('200') || s.includes('500') || s.includes('1000') || s.includes('2,000') ||
      s === '200-500' || s === '500-1000' || s === '1000-2000' || s === '200-2000') {
    return 'mid_market';
  }
  return 'default';
}

// ─── Search Query Construction ───────────────────────────────

/**
 * Build targeted search queries based on company size and industry.
 *
 * Enterprise (10k+ employees): Rich public signals → news, partnerships, acquisitions
 * Mid-market (200-2k employees): Sparse public data → hiring, careers, people, technology
 * Default: Balanced mix
 */
function buildEnterpriseQueries(companyName: string, domain?: string | null): string[] {
  const name = cleanCompanyName(companyName);
  const queries: string[] = [];

  // Query 1: Strategic announcements and partnerships
  queries.push(`${name} announces partnership acquisition investment strategy 2025 2026`);

  // Query 2: Acquisitions and expansion
  queries.push(`${name} acquires expansion new market regulatory transformation`);

  // Query 3: Leadership and organizational changes
  queries.push(`${name} CEO CTO CIO CCO leadership appointed new`);

  // Query 4: Technology and product announcements
  queries.push(`${name} launches platform technology digital transformation AI cloud`);

  // Query 5: Investor and financial signals (for public companies)
  queries.push(`${name} earnings revenue growth investor relations quarterly`);

  return queries;
}

function buildMidMarketQueries(companyName: string, domain?: string | null): string[] {
  const name = cleanCompanyName(companyName);
  const queries: string[] = [];

  // Query 1: Hiring intelligence — careers pages and job postings
  queries.push(`"${name}" careers jobs hiring engineer architect director`);

  // Query 2: Technology adoption signals from hiring
  queries.push(`${name} hiring "cloud engineer" OR "data engineer" OR "AI engineer" OR "cybersecurity" OR "devops"`);

  // Query 3: Leadership and organizational changes
  queries.push(`${name} CIO OR CTO OR "VP engineering" OR "digital transformation" OR "head of" appointed joined`);

  // Query 4: Technology and platform adoption
  queries.push(`${name} cloud OR AI OR "data platform" OR "modernization" OR "digital transformation"`);

  // Query 5: Partnerships and growth signals
  queries.push(`${name} partnership OR integrates with OR collaborates OR "growth strategy"`);

  return queries;
}

function buildDefaultQueries(companyName: string, domain?: string | null): string[] {
  const name = cleanCompanyName(companyName);
  const queries: string[] = [];

  queries.push(`${name} news funding hiring expansion AI infrastructure 2025 2026`);
  queries.push(`${name} announces partnership technology cloud digital transformation`);
  queries.push(`${name} CIO CTO leadership appointed new engineer hiring`);
  queries.push(`${name} careers jobs hiring cloud engineer data architect`);

  return queries;
}

function cleanCompanyName(name: string): string {
  return name.replace(/\s+(Inc|Corp|Corporation|Ltd|LLC|Company|Co|Group|Holdings)\.?$/i, '').trim();
}

function buildSearchQueries(
  companyName: string,
  domain?: string | null,
  sizeRange?: string | null,
  industry?: string | null
): string[] {
  const tier = classifyCompanySize(sizeRange);

  switch (tier) {
    case 'enterprise':
      return buildEnterpriseQueries(companyName, domain);
    case 'mid_market':
      return buildMidMarketQueries(companyName, domain);
    default:
      return buildDefaultQueries(companyName, domain);
  }
}

// ─── Deduplication ────────────────────────────────────

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

// ─── Evidence Storage ────────────────────────────────────

async function storeRawEvidence(
  companyId: string,
  evidence: RawEvidenceInput,
  sourceReliability: { score: number; quality: 'premium' | 'standard' | 'low' }
): Promise<string | null> {
  try {
    const existingEvidence = await db.evidence.findFirst({
      where: { companyId, sourceUrl: evidence.sourceUrl! },
      select: { id: true },
    });
    if (existingEvidence) return existingEvidence.id;

    const created = await db.evidence.create({
      data: {
        companyId,
        sourceUrl: evidence.sourceUrl || `collected://${evidence.headline.substring(0, 50)}`,
        sourceTitle: evidence.headline,
        sourceName: evidence.sourceName || 'external_intelligence',
        snippet: evidence.snippet,
        extractedField: 'external_intelligence',
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
        confidence: sourceReliability.score * 0.8,
        sourceDate: evidence.publishedDate ? new Date(evidence.publishedDate) : null,
        sourceQualityTier: sourceReliability.quality,
        status: 'active',
      },
    });
    return created.id;
  } catch (error) {
    console.error('[intel-collector] Failed to store evidence:', error);
    return null;
  }
}

// ─── Signal Creation ──────────────────────────────────

import { SIGNAL_HALF_LIVES } from '@/lib/scoring/freshness-ranking';

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
        title: classified.title.substring(0, 300),
        description: classified.description?.substring(0, 1000),
        source: 'external_discovery',
        sourceUrl: evidence.sourceUrl,
        severity: classified.severity,
        impact: classified.severity === 'critical' || classified.severity === 'high' ? 'high' : classified.severity === 'medium' ? 'medium' : 'low',
        signalDate: evidence.publishedDate ? new Date(evidence.publishedDate) : new Date(evidence.collectionDate),
        confidence: classified.confidence,
        sourceQuality: scoreSourceReliability(evidence.sourceName, evidence.sourceUrl).quality,
        evidenceIds: evidenceId ? JSON.stringify([evidenceId]) : '[]',
        businessImpact: classified.businessImpact,
        recommendedAction: classified.recommendedAction,
        timingWindow: classified.timingWindow,
        meaningCategory: classified.meaningCategory,
        expiresAt: computeExpiry(evidence.publishedDate || evidence.collectionDate, classified.signalType),
        status: 'active',
      },
    });
    return signal.id;
  } catch (error) {
    console.error('[intel-collector] Failed to create signal:', error);
    return null;
  }
}

function scoreSourceReliability(sourceName: string | null, sourceUrl: string | null) {
  return (classifyEvidence as any).scoreSourceReliability
    ? (classifyEvidence as any).scoreSourceReliability(sourceName, sourceUrl)
    : { score: 0.5, quality: 'low' as const };
}

function computeExpiry(referenceDate: string, signalType: string): Date {
  const halfLife = SIGNAL_HALF_LIVES[signalType] || 30;
  const expiryDays = halfLife * 2;
  return new Date(new Date(referenceDate).getTime() + expiryDays * 24 * 60 * 60 * 1000);
}

// ─── Main Collection Function ────────────────────────────────

/**
 * Collect external intelligence for a single company.
 *
 * This is the primary entry point for the Phase 2A intelligence pipeline.
 * Adapts collection strategy based on company size.
 *
 * @param companyId - The company to collect intelligence for
 * @param maxResultsPerQuery - Max search results per query (default 5)
 * @returns Collection result with counts and any errors
 */
export async function collectIntelligenceForCompany(
  companyId: string,
  maxResultsPerQuery: number = 5
): Promise<IntelligenceCollectionResult> {
  const startTime = Date.now();
  const result: IntelligenceCollectionResult = {
    companyId,
    companyName: '',
    companySizeRange: null,
    totalSearched: 0,
    evidenceCollected: 0,
    signalsCreated: 0,
    signalsSkipped: 0,
    errors: [],
    duration: 0,
  };

  try {
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { id: true, rawName: true, domain: true, sizeRange: true },
    });

    if (!company) {
      result.errors.push(`Company not found: ${companyId}`);
      result.duration = Date.now() - startTime;
      return result;
    }

    result.companyName = company.rawName;
    result.companySizeRange = company.sizeRange;

    // Build size-adaptive queries
    const queries = buildSearchQueries(company.rawName, company.domain, company.sizeRange);
    const searchBatches = await Promise.all(
      queries.map(q => webSearch(q, maxResultsPerQuery).catch(err => {
        console.error(`[intel-collector] Search failed for "${q}":`, err);
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

    // Process each result
    for (const item of allResults) {
      try {
        const evidence: RawEvidenceInput = {
          headline: item.title,
          snippet: item.snippet,
          sourceName: null,
          sourceUrl: item.url,
          publishedDate: null,
          collectionDate: new Date().toISOString(),
        };

        // Extract source name from URL
        try {
          const urlObj = new URL(item.url);
          evidence.sourceName = urlObj.hostname.replace('www.', '');
        } catch { /* ignore */ }

        // Dedup check
        const isDup = await isDuplicateSignal(companyId, evidence.headline);
        if (isDup) { result.signalsSkipped++; continue; }

        // Store raw evidence (Phase B foundation)
        const sourceReliability = scoreSourceReliability(evidence.sourceName, evidence.sourceUrl);
        const evidenceId = await storeRawEvidence(companyId, evidence, sourceReliability);
        if (evidenceId) result.evidenceCollected++;

        // Classify evidence → signal
        const classified = classifyEvidence(evidence);
        if (!classified) { result.signalsSkipped++; continue; }

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

/**
 * Batch collection for multiple companies. Designed for background job execution.
 */
export async function collectIntelligenceBatch(
  companyIds: string[],
  maxResultsPerQuery: number = 5
): Promise<IntelligenceCollectionResult[]> {
  const results: IntelligenceCollectionResult[] = [];
  for (const companyId of companyIds) {
    const result = await collectIntelligenceForCompany(companyId, maxResultsPerQuery);
    results.push(result);
  }
  return results;
}

// Re-export for backward compatibility during transition
export const collectNewsForCompany = collectIntelligenceForCompany;
export const collectNewsBatch = collectIntelligenceBatch;
export type NewsCollectionResult = IntelligenceCollectionResult;
