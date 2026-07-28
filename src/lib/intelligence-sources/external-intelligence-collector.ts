/**
 * Sprint 1 — External Intelligence Collector (Enhanced)
 *
 * The intelligence collection pipeline. Source-agnostic. Today: web search.
 * The source can change. The pipeline should not.
 *
 * Sprint 1 Enhancements:
 *   1. Three-date evidence model: eventDate + discoveryDate + sourcePublishedDate
 *   2. AI Evidence Engine: AI classification with rule-based fallback + toggle
 *   3. Mid-market sensor: Multi-channel intelligence for 200-2000 employee companies
 *   4. Small company mode: Internal memory + limited external signal weighting
 *   5. Enhanced evidence storage: Three-date model in extractedValue JSON
 *
 * Multi-sensor approach:
 *   Sensor 1: News/Announcements (enterprise-focused)
 *   Sensor 2: Mid-Market Intelligence Sensor (careers, hiring, leadership, technology)
 *   Sensor 3: Default balanced sensor (fallback)
 *
 * Company-size adaptive strategy:
 *   Enterprise (5001+): News-focused queries (announcements, partnerships, acquisitions)
 *   Mid-market (200-5000): Mid-market sensor (careers, hiring, leadership, technology)
 *   Small (<200): Limited external + internal memory emphasis
 *   Default: Balanced mix
 *
 * Critical principle: Preserve raw evidence EXACTLY as received.
 * This evidence becomes the Evidence Engine foundation.
 */

import { db } from '@/lib/db';
import { webSearch } from '@/lib/ai-copilot/ai-caller';
import { classifyEvidence, scoreSourceReliability, type RawEvidenceInput, type ClassifiedSignal } from './evidence-classifier';
import { classifyEvidenceWithAI } from './ai-evidence-engine';
import { buildThreeDateModel, serializeThreeDateModel, dateModelQuality, type EvidenceDates } from './three-date-model';
import { runMidMarketSensor, type SensorConfig } from './mid-market-sensor';

// ─── Search Provider Interface (Phase B swap point) ──────

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

export interface SearchProvider {
  search(query: string, maxResults: number): Promise<SearchResult[]>;
}

class WebSearchProvider implements SearchProvider {
  async search(query: string, maxResults: number): Promise<SearchResult[]> {
    return webSearch(query, maxResults).catch(err => {
      console.error(`[search-provider] webSearch failed for "${query.substring(0, 60)}":`, err);
      return [];
    });
  }
}

const defaultSearchProvider = new WebSearchProvider();

// ─── Types ─────────────────────────────────────────────

export interface IntelligenceCollectionResult {
  companyId: string;
  companyName: string;
  companySizeRange: string | null;
  companySizeTier: string;
  totalSearched: number;
  evidenceCollected: number;
  signalsCreated: number;
  signalsSkipped: number;
  aiClassifiedCount: number;
  ruleClassifiedCount: number;
  dateQualityAvg: number;
  midMarketChannels?: {
    careers: { queriesRun: number; evidenceCollected: number; signalsCreated: number };
    hiring: { queriesRun: number; evidenceCollected: number; signalsCreated: number };
    leadership: { queriesRun: number; evidenceCollected: number; signalsCreated: number };
    technology: { queriesRun: number; evidenceCollected: number; signalsCreated: number };
  };
  errors: string[];
  duration: number;
}

type RawSearchResult = SearchResult;

// ─── Company Size Classification ────────────────────────────────

type CompanySizeTier = 'enterprise' | 'mid_market' | 'small' | 'default';

function classifyCompanySize(sizeRange: string | null | undefined): CompanySizeTier {
  if (!sizeRange) return 'default';
  const s = sizeRange.toLowerCase().trim();
  const n = s.replace(/,/g, '');

  // Enterprise: 5001+ employees
  const bigNum = n.match(/(\d{4,})/);
  if (bigNum) {
    const num = parseInt(bigNum[1], 10);
    if (num >= 5001) return 'enterprise';
  }
  if (s.includes('enterprise') || s === '10000+' || s === '50000+') return 'enterprise';

  // Mid-market: 200–5000 employees
  // Check mid-market FIRST before small, because "Mid-Market (1,000-5,000)" contains
  // numbers that look like small-company ranges if checked in wrong order
  if (s.includes('mid-market') || s.includes('mid market')) return 'mid_market';
  if (/\d{3,4}/.test(n)) {
    const num = parseInt(n.match(/(\d{3,4})/)?.[1] || '0', 10);
    if (num >= 200 && num <= 5000) return 'mid_market';
  }
  if (s.includes('200') || s.includes('500') || s.includes('1,001') || s.includes('1001') ||
      s.includes('5,000') || s.includes('5000') || s.includes('2,000') || s.includes('2000') ||
      s.includes('1000') || s === '200-500' || s === '500-1000' || s === '1000-2000' ||
      s === '200-2000' || s === '1,001-5,000') {
    return 'mid_market';
  }

  // Small: <200 employees (check AFTER mid-market)
  const smallNum = n.match(/(\d{1,3})/);
  if (smallNum) {
    const num = parseInt(smallNum[1], 10);
    if (num < 200) return 'small';
  }
  if (s.includes('1-10') || s.includes('11-50') || s.includes('51-200') ||
      s.includes('1-49') || s.includes('50-99') || s.includes('100-199') ||
      s === '1-200' || s.includes('nov') || s.includes('jan')) {
    return 'small';
  }

  return 'default';
}

// ─── Search Query Construction ───────────────────────────────

function buildEnterpriseQueries(companyName: string, domain?: string | null): string[] {
  const name = cleanCompanyName(companyName);
  return [
    `${name} announces partnership acquisition investment strategy 2025 2026`,
    `${name} acquires expansion new market regulatory transformation`,
    `${name} CEO CTO CIO CCO leadership appointed new`,
    `${name} launches platform technology digital transformation AI cloud`,
    `${name} earnings revenue growth investor relations quarterly`,
  ];
}

function buildDefaultQueries(companyName: string, domain?: string | null): string[] {
  const name = cleanCompanyName(companyName);
  return [
    `${name} news funding hiring expansion AI infrastructure 2025 2026`,
    `${name} announces partnership technology cloud digital transformation`,
    `${name} CIO CTO leadership appointed new engineer hiring`,
    `${name} careers jobs hiring cloud engineer data architect`,
  ];
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
      // Mid-market uses the dedicated sensor — but keep a light news query as supplement
      const name = cleanCompanyName(companyName);
      return [
        `${name} news partnership acquisition investment`,
        `${name} announces technology cloud AI digital transformation`,
      ];
    case 'small':
      // Small companies get minimal external queries — focus on what's available
      const sName = cleanCompanyName(companyName);
      return [
        `${sName} hiring jobs careers news`,
      ];
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

// ─── Evidence Storage (Sprint 1: Three-Date Enhanced) ───

async function storeRawEvidence(
  companyId: string,
  evidence: RawEvidenceInput,
  sourceReliability: { score: number; quality: 'premium' | 'standard' | 'low' },
  dates: EvidenceDates
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
          // Sprint 1: Three-date model serialized in extractedValue
          ...serializeThreeDateModel(dates),
        }),
        relevanceScore: sourceReliability.score,
        confidence: sourceReliability.score * 0.8,
        sourceDate: dates.sourcePublishedDate ? new Date(dates.sourcePublishedDate) : (dates.eventDate ? new Date(dates.eventDate) : null),
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

// ─── Signal Creation (Sprint 1: Enhanced) ──────────────

import { SIGNAL_HALF_LIVES } from '@/lib/scoring/freshness-ranking';

async function createSignalFromEvidence(
  companyId: string,
  classified: ClassifiedSignal,
  evidence: RawEvidenceInput,
  evidenceId: string | null,
  dates: EvidenceDates
): Promise<string | null> {
  if (!classified) return null;

  try {
    // Sprint 1: Use best available date for signalDate
    const signalDate = dates.eventDate || dates.sourcePublishedDate || dates.discoveryDate;
    const bestRefDate = signalDate;

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
        signalDate: new Date(bestRefDate),
        // Sprint 1: Store sourcePublishedDate for freshness ranking
        publicationDate: dates.sourcePublishedDate ? new Date(dates.sourcePublishedDate) : null,
        confidence: classified.confidence,
        sourceQuality: scoreSourceReliability(evidence.sourceName, evidence.sourceUrl).quality,
        evidenceIds: evidenceId ? JSON.stringify([evidenceId]) : '[]',
        businessImpact: classified.businessImpact,
        recommendedAction: classified.recommendedAction,
        timingWindow: classified.timingWindow,
        meaningCategory: classified.meaningCategory,
        expiresAt: computeExpiry(bestRefDate, classified.signalType),
        status: 'active',
      },
    });
    return signal.id;
  } catch (error) {
    console.error('[intel-collector] Failed to create signal:', error);
    return null;
  }
}

function computeExpiry(referenceDate: string, signalType: string): Date {
  const halfLife = SIGNAL_HALF_LIVES[signalType] || 30;
  const expiryDays = halfLife * 2;
  return new Date(new Date(referenceDate).getTime() + expiryDays * 24 * 60 * 60 * 1000);
}

// ─── Evidence Processing Pipeline ──────────────────────

/**
 * Process a raw search result through the full Sprint 1 pipeline:
 *   1. Extract dates (three-date model)
 *   2. Classify (AI with rule fallback)
 *   3. Store evidence
 *   4. Create signal
 */
async function processResult(
  companyId: string,
  result: RawSearchResult,
  discoveryDate: string,
  useAI: boolean,
  resultObj: IntelligenceCollectionResult
): Promise<void> {
  // Build three-date model
  const dates = buildThreeDateModel({
    snippet: result.snippet,
    url: result.url,
    discoveryDate,
  });

  // Build evidence input
  const evidence: RawEvidenceInput = {
    headline: result.title,
    snippet: result.snippet,
    sourceName: null,
    sourceUrl: result.url,
    publishedDate: dates.sourcePublishedDate,
    collectionDate: discoveryDate,
  };

  // Extract source name from URL
  try {
    const urlObj = new URL(result.url.startsWith('http') ? result.url : `https://${result.url}`);
    evidence.sourceName = urlObj.hostname.replace('www.', '');
  } catch { /* ignore */ }

  // Dedup check
  const isDup = await isDuplicateSignal(companyId, evidence.headline);
  if (isDup) { resultObj.signalsSkipped++; return; }

  // Score source reliability
  const sourceReliability = scoreSourceReliability(evidence.sourceName, evidence.sourceUrl);

  // Store raw evidence with three-date model
  const evidenceId = await storeRawEvidence(companyId, evidence, sourceReliability, dates);
  if (evidenceId) resultObj.evidenceCollected++;

  // Classify: Sprint 1 — AI is default for high-value signals, rules for bulk
  let classified: ClassifiedSignal | null;
  const shouldUseAI = useAI || (!useAI && (
    // Auto-enable AI for premium sources and enterprise/mid-market signals
    sourceReliability.quality === 'premium' ||
    resultObj.companySizeTier === 'enterprise'
  ));

  if (shouldUseAI) {
    classified = await classifyEvidenceWithAI(evidence);
    if (classified) {
      resultObj.aiClassifiedCount++;
    } else {
      // AI failed — fallback to rules
      classified = classifyEvidence(evidence);
      if (classified) resultObj.ruleClassifiedCount++;
    }
  } else {
    classified = classifyEvidence(evidence);
    if (classified) resultObj.ruleClassifiedCount++;
  }

  if (!classified) { resultObj.signalsSkipped++; return; }

  // Create signal with three-date context
  const signalId = await createSignalFromEvidence(companyId, classified, evidence, evidenceId, dates);
  if (signalId) {
    resultObj.signalsCreated++;
  } else {
    resultObj.signalsSkipped++;
  }
}

// ─── Main Collection Function ────────────────────────────────

export interface CollectionOptions {
  maxResultsPerQuery?: number;
  searchProvider?: SearchProvider;
/**
 * Sprint 1: Toggle AI classification.
 * When true: AI Evidence Engine for ALL signals.
 * When false (default): AI is auto-enabled for premium sources and enterprise tier.
 *                Rule-based for standard/low sources and small/default tiers.
 */
  useAIClassification?: boolean;
}

/**
 * Collect external intelligence for a single company.
 *
 * Sprint 1 Pipeline:
 *   1. Determine company size tier
 *   2. For enterprise: news-focused search queries
 *   3. For mid-market: news supplement + dedicated mid-market sensor
 *   4. For small: minimal external + internal memory emphasis note
 *   5. For all: three-date model, AI classification (optional), evidence storage
 *
 * @param companyId - The company to collect intelligence for
 * @param optionsOrMaxResults - Options or legacy maxResults number
 * @returns Collection result with counts, channel breakdown, and any errors
 */
export async function collectIntelligenceForCompany(
  companyId: string,
  optionsOrMaxResults: number | CollectionOptions = 5
): Promise<IntelligenceCollectionResult> {
  const opts: CollectionOptions = typeof optionsOrMaxResults === 'number'
    ? { maxResultsPerQuery: optionsOrMaxResults }
    : optionsOrMaxResults;
  const maxResultsPerQuery = opts.maxResultsPerQuery ?? 5;
  const searchProvider = opts.searchProvider || defaultSearchProvider;
  const useAI = opts.useAIClassification ?? false;
  const startTime = Date.now();
  const discoveryDate = new Date().toISOString();

  const result: IntelligenceCollectionResult = {
    companyId,
    companyName: '',
    companySizeRange: null,
    companySizeTier: 'default',
    totalSearched: 0,
    evidenceCollected: 0,
    signalsCreated: 0,
    signalsSkipped: 0,
    aiClassifiedCount: 0,
    ruleClassifiedCount: 0,
    dateQualityAvg: 0,
    errors: [],
    duration: 0,
  };

  try {
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { id: true, rawName: true, domain: true, sizeRange: true, industry: true },
    });

    if (!company) {
      result.errors.push(`Company not found: ${companyId}`);
      result.duration = Date.now() - startTime;
      return result;
    }

    result.companyName = company.rawName;
    result.companySizeRange = company.sizeRange;
    const sizeTier = classifyCompanySize(company.sizeRange);
    result.companySizeTier = sizeTier;

    // ── Phase 1: News-style search queries (enterprise + supplement for mid/small) ──
    const queries = buildSearchQueries(company.rawName, company.domain, company.sizeRange, company.industry);

    if (queries.length > 0) {
      const searchBatches: RawSearchResult[][] = [];
      for (let i = 0; i < queries.length; i++) {
        try {
          const results = await searchProvider.search(queries[i], maxResultsPerQuery);
          searchBatches.push(results);
          if (i < queries.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (err) {
          console.error(`[intel-collector] Query ${i + 1}/${queries.length} failed:`, err);
          searchBatches.push([]);
        }
      }

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

      result.totalSearched += allResults.length;

      // Process each result through Sprint 1 pipeline
      for (const item of allResults) {
        try {
          await processResult(companyId, item, discoveryDate, useAI, result);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          result.errors.push(`Error processing "${item.title.substring(0, 50)}": ${msg}`);
        }
      }
    }

    // ── Phase 2: Mid-Market Sensor (only for mid-market tier) ──
    if (sizeTier === 'mid_market') {
      try {
        const sensorConfig: SensorConfig = {
          companyId,
          companyName: company.rawName,
          domain: company.domain,
          industry: company.industry,
          sizeRange: company.sizeRange,
          searchProvider,
          maxResultsPerQuery: Math.min(maxResultsPerQuery, 3), // Fewer per query for mid-market (more queries)
        };

        const sensorResult = await runMidMarketSensor(sensorConfig);

        // Process mid-market sensor evidence through the same pipeline
        for (const processed of sensorResult.processedEvidence) {
          if (!processed.classified) continue;

          // Dedup check against existing signals
          const isDup = await isDuplicateSignal(companyId, processed.evidence.headline);
          if (isDup) { result.signalsSkipped++; continue; }

          // Store evidence
          const evidenceId = await storeRawEvidence(
            companyId,
            processed.evidence,
            processed.sourceReliability,
            processed.dates
          );
          if (evidenceId) result.evidenceCollected++;

          // Create signal
          const signalId = await createSignalFromEvidence(
            companyId,
            processed.classified,
            processed.evidence,
            evidenceId,
            processed.dates
          );
          if (signalId) {
            result.signalsCreated++;
          } else {
            result.signalsSkipped++;
          }
        }

        // Track channel breakdown
        result.midMarketChannels = {
          careers: sensorResult.channelResults.careers,
          hiring: sensorResult.channelResults.hiring,
          leadership: sensorResult.channelResults.leadership,
          technology: sensorResult.channelResults.technology,
        };

        result.totalSearched += sensorResult.processedEvidence.length;
        if (useAI) {
          result.aiClassifiedCount += sensorResult.processedEvidence.filter(r => r.classified).length;
        } else {
          result.ruleClassifiedCount += sensorResult.processedEvidence.filter(r => r.classified).length;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Mid-market sensor error: ${msg}`);
      }
    }

    // ── Phase 3: Small company note ──
    if (sizeTier === 'small') {
      // For small companies, we accept that external signals may be minimal.
      // The reasoning engine will weight internal memory more heavily.
      if (result.signalsCreated === 0) {
        result.errors.push(`Small company tier: Limited external signals. Recommend combining with internal memory for intelligence.`);
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
  optionsOrMaxResults: number | CollectionOptions = 5
): Promise<IntelligenceCollectionResult[]> {
  const results: IntelligenceCollectionResult[] = [];
  for (const companyId of companyIds) {
    const result = await collectIntelligenceForCompany(companyId, optionsOrMaxResults);
    results.push(result);
  }
  return results;
}

// Re-export for backward compatibility
export const collectNewsForCompany = collectIntelligenceForCompany;
export const collectNewsBatch = collectIntelligenceBatch;
export type NewsCollectionResult = IntelligenceCollectionResult;
