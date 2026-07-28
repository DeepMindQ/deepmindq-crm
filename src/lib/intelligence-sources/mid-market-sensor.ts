/**
 * Sprint 1 — Mid-Market Intelligence Sensor
 *
 * Vision: DeepMindQ must create intelligence value for ALL company sizes.
 * For mid-market (200-2000 employees), traditional news sensors fail because:
 *   - No Reuters articles, no Bloomberg coverage, no analyst reports
 *   - But strong signals exist in non-traditional sources:
 *     * Hiring patterns (careers pages, job boards, LinkedIn postings)
 *     * Technology adoption signals (job descriptions, tech stack pages)
 *     * Leadership movement (executive appointments, LinkedIn profiles)
 *     * Website positioning changes (Sprint 2 — HTML diffing)
 *
 * The mid-market sensor is NOT just a careers scraper.
 * It's a multi-channel company intelligence sensor that discovers signals
 * where traditional news search finds nothing.
 *
 * Sensor channels (Sprint 1):
 *   1. Careers Intelligence — Structured job posting analysis
 *   2. Hiring Intelligence — Role pattern detection from web search
 *   3. Leadership Intelligence — Executive movement detection
 *   4. Technology Intelligence — Tech stack adoption from hiring + announcements
 *
 * Architecture:
 *   - Each channel produces ClassifiedSignal objects (same interface as news collector)
 *   - Channels are independent — if one fails, others still produce
 *   - All channels feed into the same evidence → reasoning pipeline
 */

import { classifyEvidence, scoreSourceReliability, type ClassifiedSignal, type RawEvidenceInput } from './evidence-classifier';
import { buildThreeDateModel, type EvidenceDates } from './three-date-model';
import type { SearchResult, SearchProvider } from './external-intelligence-collector';

// ─── Types ──────────────────────────────────────────────────────

export interface MidMarketSensorResult {
  companyId: string;
  companyName: string;
  domain: string | null;
  channels: {
    careers: ChannelResult;
    hiring: ChannelResult;
    leadership: ChannelResult;
    technology: ChannelResult;
  };
  totalEvidence: number;
  totalSignals: number;
  duration: number;
}

export interface ChannelResult {
  queriesRun: number;
  evidenceCollected: number;
  signalsCreated: number;
  queries: string[];
}

export interface SensorConfig {
  companyId: string;
  companyName: string;
  domain: string | null;
  industry: string | null;
  sizeRange: string | null;
  searchProvider?: SearchProvider;
  maxResultsPerQuery?: number;
}

// ─── Default Search Provider ───────────────────────────────────

async function createDefaultSearchProvider(): Promise<SearchProvider> {
  const { webSearch } = await import('@/lib/llm-client');
  return {
    async search(query: string, maxResults: number): Promise<SearchResult[]> {
      return webSearch(query, maxResults).catch(err => {
        console.error(`[midmarket-sensor] search failed:`, err);
        return [];
      });
    },
  };
}

// ─── Channel 1: Careers Intelligence ─────────────────────────────

/**
 * Build careers-focused search queries.
 * Target: Job postings, careers pages, hiring announcements.
 *
 * For mid-market companies, the strongest signals are WHO they're hiring
 * and WHAT roles they're creating. This reveals:
 *   - Department growth (new teams being built)
 *   - Technology investment (hiring cloud/AI engineers)
 *   - Strategic priorities (new VP roles, new functions)
 */
function buildCareersQueries(companyName: string, domain: string | null): string[] {
  const name = companyName.replace(/\s+(Inc|Corp|Corporation|Ltd|LLC|Company|Co|Group|Holdings)\.?$/i, '').trim();
  const queries: string[] = [];

  // Structured careers page detection
  if (domain) {
    queries.push(`site:${domain} careers jobs openings positions`);
    queries.push(`site:${domain} "we're hiring" OR "join our team" OR "open positions"`);
  }

  // Greenhouse/Lever/Workday hosted careers
  queries.push(`"${name}" greenhouse.com jobs careers`);
  queries.push(`"${name}" lever.co careers jobs`);
  queries.push(`"${name}" workday.com jobs careers`);

  // General job posting detection
  queries.push(`"${name}" "now hiring" OR "job opening" OR "open position" OR "career opportunity"`);

  // LinkedIn job postings
  queries.push(`site:linkedin.com/jobs "${name}" engineer OR architect OR director OR manager`);

  return queries;
}

// ─── Channel 2: Hiring Intelligence ─────────────────────────────

/**
 * Build hiring pattern queries.
 * Target: Specific role types that indicate business direction.
 *
 * The key insight: WHAT roles a company is hiring reveals WHERE they're investing.
 *   - 5 cloud engineers → cloud migration
 *   - 3 data engineers → data platform build
 *   - New VP Engineering → technical leadership investment
 *   - Cybersecurity roles → security infrastructure
 */
function buildHiringQueries(companyName: string, domain: string | null): string[] {
  const name = companyName.replace(/\s+(Inc|Corp|Corporation|Ltd|LLC|Company|Co|Group|Holdings)\.?$/i, '').trim();
  const queries: string[] = [];

  // Technology hiring patterns
  queries.push(`"${name}" hiring "cloud engineer" OR "cloud architect" OR "AWS" OR "Azure" OR "GCP"`);
  queries.push(`"${name}" hiring "data engineer" OR "data scientist" OR "machine learning" OR "AI"`);
  queries.push(`"${name}" hiring "devops" OR "site reliability" OR "platform engineer" OR "kubernetes"`);

  // Security hiring (growing priority for many companies)
  queries.push(`"${name}" hiring "cybersecurity" OR "security engineer" OR "CISO" OR "information security"`);

  // Leadership hiring patterns
  queries.push(`"${name}" "VP Engineering" OR "VP Product" OR "VP Sales" OR "head of" OR "director of" hired OR joined`);

  // Growth/operations hiring
  queries.push(`"${name}" hiring "sales" OR "account executive" OR "business development" OR "revenue"`);

  return queries;
}

// ─── Channel 3: Leadership Intelligence ─────────────────────────

/**
 * Build leadership movement queries.
 * Target: Executive appointments, departures, organizational changes.
 *
 * Leadership changes are among the strongest buying signals because:
 *   - New leaders bring new priorities and vendor preferences
 *   - First 90 days is the window of maximum openness
 *   - Organizational changes often precede technology evaluation
 */
function buildLeadershipQueries(companyName: string, domain: string | null): string[] {
  const name = companyName.replace(/\s+(Inc|Corp|Corporation|Ltd|LLC|Company|Co|Group|Holdings)\.?$/i, '').trim();
  const queries: string[] = [];

  // C-suite changes
  queries.push(`"${name}" CEO OR CTO OR CIO OR CFO OR COO appointed OR "joins" OR "named" OR "promoted"`);
  queries.push(`"${name}" "new CEO" OR "new CTO" OR "new CIO" OR "new president"`);

  // VP/Director level changes
  queries.push(`"${name}" "VP" OR "vice president" OR "senior director" appointed OR joins OR hired`);

  // LinkedIn executive profiles
  queries.push(`site:linkedin.com "${name}" "VP" OR "CTO" OR "CIO" OR "director"`);
  queries.push(`site:linkedin.com "${name}" "joined" OR "started" OR "announced"`);

  return queries;
}

// ─── Channel 4: Technology Intelligence ──────────────────────────

/**
 * Build technology adoption queries.
 * Target: Tech stack signals from job descriptions and announcements.
 *
 * Technology adoption is detected through:
 *   - Job descriptions mentioning specific tools (Kubernetes, Snowflake, etc.)
 *   - Company announcements about modernization
 *   - Integration/partnership announcements
 */
function buildTechnologyQueries(companyName: string, domain: string | null): string[] {
  const name = companyName.replace(/\s+(Inc|Corp|Corporation|Ltd|LLC|Company|Co|Group|Holdings)\.?$/i, '').trim();
  const queries: string[] = [];

  // Modernization signals
  queries.push(`"${name}" "digital transformation" OR "cloud migration" OR "modernization" OR "tech stack"`);

  // Specific tech adoption
  queries.push(`"${name}" "implements" OR "adopts" OR "deploys" OR "migrates to" kubernetes OR snowflake OR databricks OR aws OR azure`);
  queries.push(`"${name}" "standardizes on" OR "chooses" OR "selects" servicenow OR salesforce OR workday OR hubspot`);

  // Partner ecosystem signals
  queries.push(`"${name}" "partners with" OR "integrates with" OR "certified" OR "implementation partner"`);

  return queries;
}

// ─── Evidence-to-Signal Conversion ──────────────────────────────

interface ProcessedEvidence {
  evidence: RawEvidenceInput;
  dates: EvidenceDates;
  classified: ClassifiedSignal | null;
  sourceReliability: { score: number; quality: 'premium' | 'standard' | 'low' };
}

/**
 * Convert a raw search result into evidence + signal using the three-date model.
 */
function processSearchResult(
  result: SearchResult,
  discoveryDate: string
): ProcessedEvidence {
  // Build three-date model
  const dates = buildThreeDateModel({
    snippet: result.snippet,
    url: result.url,
    discoveryDate,
  });

  // Build evidence input with extracted dates
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

  // Score source reliability
  const sourceReliability = scoreSourceReliability(evidence.sourceName, evidence.sourceUrl);

  // Classify using rule-based classifier (AI classification happens in the collector pipeline)
  const classified = classifyEvidence(evidence);

  return { evidence, dates, classified, sourceReliability };
}

// ─── Channel Execution ──────────────────────────────────────────

async function executeChannel(
  queries: string[],
  searchProvider: SearchProvider,
  maxResults: number,
  discoveryDate: string,
  channelName: string
): Promise<{ results: ProcessedEvidence[]; queriesRun: number }> {
  const allResults: ProcessedEvidence[] = [];
  let queriesRun = 0;

  for (let i = 0; i < queries.length; i++) {
    queriesRun++;
    try {
      const searchResults = await searchProvider.search(queries[i], maxResults);
      for (const result of searchResults) {
        allResults.push(processSearchResult(result, discoveryDate));
      }
      // Stagger to avoid rate limiting
      if (i < queries.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (err) {
      console.error(`[midmarket-${channelName}] Query ${i + 1} failed:`, err);
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  return {
    results: allResults.filter(r => {
      if (r.evidence.sourceUrl && seen.has(r.evidence.sourceUrl)) return false;
      if (r.evidence.sourceUrl) seen.add(r.evidence.sourceUrl);
      return true;
    }),
    queriesRun,
  };
}

// ─── Main Sensor Entry Point ───────────────────────────────────

/**
 * Run the mid-market intelligence sensor for a company.
 *
 * Executes all 4 channels in parallel (with internal staggering per channel)
 * and returns evidence + signals from each channel.
 *
 * This is designed to be called by the collector pipeline.
 * The collector merges mid-market sensor results with news sensor results.
 *
 * @param config - Company configuration + optional search provider
 * @returns Sensor results with per-channel breakdown
 */
export async function runMidMarketSensor(config: SensorConfig): Promise<{
  processedEvidence: ProcessedEvidence[];
  channelResults: MidMarketSensorResult['channels'];
  duration: number;
}> {
  const startTime = Date.now();
  const discoveryDate = new Date().toISOString();
  const maxResults = config.maxResultsPerQuery ?? 5;

  const searchProvider = config.searchProvider || await createDefaultSearchProvider();

  // Build queries for each channel
  const careerQueries = buildCareersQueries(config.companyName, config.domain);
  const hiringQueries = buildHiringQueries(config.companyName, config.domain);
  const leadershipQueries = buildLeadershipQueries(config.companyName, config.domain);
  const technologyQueries = buildTechnologyQueries(config.companyName, config.domain);

  // Execute all channels in parallel
  const [careersResult, hiringResult, leadershipResult, technologyResult] = await Promise.all([
    executeChannel(careerQueries, searchProvider, maxResults, discoveryDate, 'careers'),
    executeChannel(hiringQueries, searchProvider, maxResults, discoveryDate, 'hiring'),
    executeChannel(leadershipQueries, searchProvider, maxResults, discoveryDate, 'leadership'),
    executeChannel(technologyQueries, searchProvider, maxResults, discoveryDate, 'technology'),
  ]);

  // Merge all results
  const allProcessed = [
    ...careersResult.results,
    ...hiringResult.results,
    ...leadershipResult.results,
    ...technologyResult.results,
  ];

  // Final dedup across channels
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const deduped = allProcessed.filter(item => {
    if (item.evidence.sourceUrl && seenUrls.has(item.evidence.sourceUrl)) return false;
    const titleKey = item.evidence.headline.substring(0, 60).toLowerCase();
    if (seenTitles.has(titleKey)) return false;
    if (item.evidence.sourceUrl) seenUrls.add(item.evidence.sourceUrl);
    seenTitles.add(titleKey);
    return true;
  });

  const duration = Date.now() - startTime;

  return {
    processedEvidence: deduped,
    channelResults: {
      careers: {
        queriesRun: careersResult.queriesRun,
        evidenceCollected: careersResult.results.length,
        signalsCreated: careersResult.results.filter(r => r.classified).length,
        queries: careerQueries,
      },
      hiring: {
        queriesRun: hiringResult.queriesRun,
        evidenceCollected: hiringResult.results.length,
        signalsCreated: hiringResult.results.filter(r => r.classified).length,
        queries: hiringQueries,
      },
      leadership: {
        queriesRun: leadershipResult.queriesRun,
        evidenceCollected: leadershipResult.results.length,
        signalsCreated: leadershipResult.results.filter(r => r.classified).length,
        queries: leadershipQueries,
      },
      technology: {
        queriesRun: technologyResult.queriesRun,
        evidenceCollected: technologyResult.results.length,
        signalsCreated: technologyResult.results.filter(r => r.classified).length,
        queries: technologyQueries,
      },
    },
    duration,
  };
}
