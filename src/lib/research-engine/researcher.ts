/**
 * Multi-Step Research Workflow — Research Intelligence Engine (Phase 3)
 *
 * 6-step pipeline replacing the monolithic researchCompany() in zai-helpers.ts:
 *
 *   Step 1: Search — 4 parallel Tavily queries (business, tech, people, news)
 *   Step 2: Evidence Collection — store each result with source, relevance, snippet
 *   Step 3: LLM Extraction — structured data from evidence with grounding
 *   Step 4: Field Validation — cross-reference extracted data against evidence
 *   Step 5: Confidence Scoring — per-field: high/medium/low based on evidence
 *   Step 6: Intelligence Storage — research card + evidence records + signals
 *
 * Key differences from Phase 2 enrichment:
 * - Every extracted fact links to its source evidence
 * - Per-field confidence (not a single overall score)
 * - Signal detection with impact assessment
 * - Evidence is queryable for downstream phases (scoring, strategy)
 */

import { db } from '@/lib/db';
import { webSearch, callLLM, extractJSON, findKeyPeople, type KeyPerson, type NewsSignal } from '@/lib/zai-helpers';
import { storeEvidenceFromResults, cleanupOldEvidence, linkEvidenceToFields, type FieldConfidence, type RawEvidence } from './evidence';
import { detectSignals, storeSignals, type DetectedSignal, type SignalDetectionResult } from './signals';

// ── Types ──

export interface ResearchResult {
  companyId: string;
  companyName: string;

  // Extracted data (same shape as CompanyResearch for backward compat)
  businessOverview: string;
  revenue: string;
  employeeCount: string;
  fundingStage: string;
  techStack: string;
  industry: string;
  website: string;
  socialProfiles: Record<string, string>;
  keyPeople: KeyPerson[];
  recentNews: NewsSignal[];

  // Phase 3 additions
  fieldConfidence: FieldConfidence;
  overallConfidence: number; // 0-1
  evidenceCount: number;
  signals: SignalDetectionResult;

  // Social URLs found during search
  linkedInUrl: string;
  twitterUrl: string;
}

export interface ResearchStepProgress {
  step: number;       // 1-6
  label: string;
  progress: number;   // 0-100
  message: string;
}

type ProgressCallback = (progress: ResearchStepProgress) => void;

// ── Main Research Pipeline ──

/**
 * Full 6-step research pipeline for a company.
 * Replaces processEnrichmentJob's inline logic.
 */
export async function researchCompany(
  companyId: string,
  companyName: string,
  domain: string | null,
  existingIndustry: string | null,
  jobId: string | null,
  force: boolean = false,
  onProgress?: ProgressCallback,
): Promise<ResearchResult> {
  const result: ResearchResult = {
    companyId,
    companyName,
    businessOverview: '',
    revenue: 'Not found',
    employeeCount: 'Not found',
    fundingStage: 'Not found',
    techStack: '',
    industry: existingIndustry || 'Not found',
    website: domain ? `https://${domain}` : '',
    socialProfiles: {},
    keyPeople: [],
    recentNews: [],
    fieldConfidence: {},
    overallConfidence: 0,
    evidenceCount: 0,
    signals: { signals: [], signalCount: 0, highImpactCount: 0 },
    linkedInUrl: '',
    twitterUrl: '',
  };

  // ═══════════════════════════════════════════════════
  // STEP 1: Multi-Query Search (0-25%)
  // ═══════════════════════════════════════════════════
  onProgress?.({ step: 1, label: 'Searching', progress: 5, message: 'Running 4 parallel web searches...' });

  const searchQueries = [
    { key: 'business', query: `${companyName} ${domain || ''} revenue employees funding 2024 2025 overview` },
    { key: 'tech', query: `${companyName} technology stack products services digital transformation` },
    { key: 'people', query: `${companyName} CEO CTO CIO COO CFO leadership team executives LinkedIn` },
    { key: 'news', query: `${companyName} news 2025 funding hiring expansion partnership acquisition` },
  ];

  const searchSettled = await Promise.allSettled(
    searchQueries.map(sq => webSearch(sq.query, 8)),
  );

  type SearchResult = { title: string; snippet: string; url: string; source: string; date: string };
  const searchResultsByCategory: Record<string, SearchResult[]> = {};
  const allSearchResults: SearchResult[] = [];

  searchQueries.forEach((sq, i) => {
    const settled = searchSettled[i];
    if (settled.status === 'fulfilled' && settled.value.length > 0) {
      searchResultsByCategory[sq.key] = settled.value.map(r => ({
        title: r.title,
        snippet: r.snippet || r.description || '',
        url: r.url,
        source: r.host_name || r.name || '',
        date: r.date || '',
      }));
      allSearchResults.push(...searchResultsByCategory[sq.key]);
    } else {
      searchResultsByCategory[sq.key] = [];
    }
  });

  // Extract social URLs
  for (const r of allSearchResults) {
    if (r.url?.includes('linkedin.com/company') && !result.linkedInUrl) result.linkedInUrl = r.url;
    if ((r.url?.includes('twitter.com') || r.url?.includes('x.com')) && !result.twitterUrl) result.twitterUrl = r.url;
  }

  onProgress?.({ step: 1, label: 'Searching', progress: 25, message: `Found ${allSearchResults.length} search results across 4 queries` });

  // ═══════════════════════════════════════════════════
  // STEP 2: Evidence Collection (25-40%)
  // Store pre-fetched search results as evidence (no re-searching)
  // ═══════════════════════════════════════════════════
  onProgress?.({ step: 2, label: 'Collecting evidence', progress: 28, message: 'Storing evidence from search results...' });

  // Cleanup old evidence before storing new (GAP 21)
  if (force) {
    const deleted = await cleanupOldEvidence(companyId, jobId);
    if (deleted > 0) {
      console.log(`[researcher] Cleaned up ${deleted} old evidence records for ${companyName}`);
    }
  }

  const allEvidence: RawEvidence[] = [];
  for (const sq of searchQueries) {
    const results = searchResultsByCategory[sq.key] || [];
    if (results.length > 0) {
      // Use pre-fetched results — no duplicate web searches (GAP 15)
      const evidence = await storeEvidenceFromResults(companyId, jobId, sq.query, results);
      allEvidence.push(...evidence);
    }
  }

  result.evidenceCount = allEvidence.length;

  onProgress?.({ step: 2, label: 'Collecting evidence', progress: 40, message: `Stored ${allEvidence.length} evidence records` });

  // ═══════════════════════════════════════════════════
  // STEP 3: LLM Extraction (40-65%)
  // ═══════════════════════════════════════════════════
  onProgress?.({ step: 3, label: 'Extracting intelligence', progress: 42, message: 'Finding key people...' });

  // 3a: Key people (parallel with main extraction)
  let keyPeople: KeyPerson[] = [];
  try {
    keyPeople = await findKeyPeople(companyName);
    if (keyPeople.length > 0) {
      result.keyPeople = keyPeople.slice(0, 10);
    }
  } catch (err) {
    console.warn('[researcher] Key people search failed, continuing');
  }

  onProgress?.({ step: 3, label: 'Extracting intelligence', progress: 52, message: `${keyPeople.length} key people found, running AI extraction...` });

  // 3b: Main data extraction
  const searchContext = allSearchResults.slice(0, 30).map(s =>
    `[${s.title}] ${s.snippet}`
  ).join('\n');

  const systemPrompt = `You are a senior business intelligence analyst. Based ONLY on the web search results provided, extract accurate, factual company data.

CRITICAL RULES:
- Only include information DIRECTLY supported by the search results
- If a field cannot be determined, write "Not found"
- NEVER fabricate or guess values
- Use real numbers and data from the search results

Return ONLY valid JSON:
{
  "businessOverview": "2-3 sentence factual description",
  "revenue": "revenue or range from search results, or 'Not found'",
  "employeeCount": "employee count or range, or 'Not found'",
  "fundingStage": "Bootstrap/Seed/Series A/Series B/Series C+/PE-backed/Public/Not found",
  "techStack": "comma-separated technologies mentioned",
  "industry": "primary industry",
  "website": "official website URL"
}`;

  const userPrompt = `Company: ${companyName}
Domain: ${domain || 'Unknown'}
Current Industry: ${existingIndustry || 'Unknown'}

Web Search Results (${allSearchResults.length} sources):
${searchContext || 'No results found.'}

Extract accurate company data as JSON. Ground everything in the search results above.`;

  let extractedData: Record<string, string> | null = null;

  try {
    const response = await callLLM(systemPrompt, userPrompt);
    extractedData = extractJSON(response) as Record<string, string> | null;
  } catch (err) {
    console.warn('[researcher] LLM extraction failed, trying Tavily fallback');
  }

  // Fallback: Tavily AI answer
  if (!extractedData || typeof extractedData !== 'object') {
    try {
      const { tavilyAIAnswer } = await import('@/lib/zai-helpers');
      const answer = await tavilyAIAnswer(`${companyName} ${domain || ''} revenue employees funding industry overview`);
      if (answer) {
        extractedData = {
          businessOverview: answer.slice(0, 500),
          revenue: 'Not found',
          employeeCount: 'Not found',
          fundingStage: 'Not found',
          techStack: '',
          industry: existingIndustry || 'Not found',
          website: domain ? `https://${domain}` : '',
        };
      }
    } catch { /* fall through */ }
  }

  if (extractedData) {
    result.businessOverview = String(extractedData.businessOverview || `${companyName} operates in the ${existingIndustry || 'technology'} sector.`);
    result.revenue = String(extractedData.revenue || 'Not found');
    result.employeeCount = String(extractedData.employeeCount || 'Not found');
    result.fundingStage = String(extractedData.fundingStage || 'Not found');
    result.techStack = String(extractedData.techStack || '');
    result.industry = String(extractedData.industry || existingIndustry || 'Not found');
    result.website = String(extractedData.website || result.website);
  }

  onProgress?.({ step: 3, label: 'Extracting intelligence', progress: 65, message: 'AI extraction complete' });

  // ═══════════════════════════════════════════════════
  // STEP 4: Field Validation — Cross-Reference (65-75%)
  // ═══════════════════════════════════════════════════
  onProgress?.({ step: 4, label: 'Validating fields', progress: 67, message: 'Cross-referencing extracted data with evidence...' });

  const extractedFields: Record<string, string> = {
    businessOverview: result.businessOverview,
    revenue: result.revenue,
    employeeCount: result.employeeCount,
    fundingStage: result.fundingStage,
    techStack: result.techStack,
    industry: result.industry,
    website: result.website,
  };

  const { fieldConfidence, updatedEvidence } = await linkEvidenceToFields(companyId, extractedFields);
  result.fieldConfidence = fieldConfidence;

  onProgress?.({ step: 4, label: 'Validating fields', progress: 75, message: `Linked ${updatedEvidence} evidence records to fields` });

  // ═══════════════════════════════════════════════════
  // STEP 5: Confidence Scoring (75-85%)
  // ═══════════════════════════════════════════════════
  onProgress?.({ step: 5, label: 'Scoring confidence', progress: 78, message: 'Calculating per-field confidence...' });

  // Calculate overall confidence
  const confidences = Object.values(fieldConfidence);
  const avgConfidence = confidences.length > 0
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0;

  // Boost for having key people and evidence
  const evidenceBoost = Math.min(allEvidence.length / 10, 1) * 0.1;
  const peopleBoost = keyPeople.length > 0 ? 0.05 : 0;
  result.overallConfidence = Math.min(1, Math.round((avgConfidence + evidenceBoost + peopleBoost) * 100) / 100);

  onProgress?.({ step: 5, label: 'Scoring confidence', progress: 85, message: `Overall confidence: ${Math.round(result.overallConfidence * 100)}%` });

  // ═══════════════════════════════════════════════════
  // STEP 6: Intelligence Storage (85-100%)
  // ═══════════════════════════════════════════════════
  onProgress?.({ step: 6, label: 'Storing intelligence', progress: 88, message: 'Detecting signals...' });

  // 6a: Signal detection
  const signalResult = await detectSignals(companyName, allSearchResults);
  result.signals = signalResult;

  // Convert signals to NewsSignal format for backward compat
  result.recentNews = signalResult.signals.slice(0, 8).map(s => ({
    title: s.title,
    snippet: s.description,
    source: s.source,
    url: s.sourceUrl,
    date: s.signalDate || undefined,
    signalType: s.signalType as NewsSignal['signalType'],
    impact: s.impact,
  }));

  onProgress?.({ step: 6, label: 'Storing intelligence', progress: 92, message: `Found ${signalResult.signalCount} signals (${signalResult.highImpactCount} high-impact)` });

  // 6b: Store signals
  await storeSignals(companyId, signalResult.signals, jobId);

  // 6c: Store research card
  if (result.linkedInUrl) result.socialProfiles.linkedin = result.linkedInUrl;
  if (result.twitterUrl) result.socialProfiles.twitter = result.twitterUrl;

  // Build all research card fields (schema now includes industry, website, keyPeople, recentNews)
  const researchCardData = {
    businessOverview: result.businessOverview,
    revenue: result.revenue !== 'Not found' ? result.revenue : null,
    employeeCount: result.employeeCount !== 'Not found' ? result.employeeCount : null,
    fundingStage: result.fundingStage !== 'Not found' ? result.fundingStage : null,
    techStack: result.techStack || null,
    socialProfiles: Object.keys(result.socialProfiles).length > 0
      ? JSON.stringify(result.socialProfiles) : null,
    keyPeople: result.keyPeople.length > 0
      ? JSON.stringify(result.keyPeople) : undefined, // uses schema default "[]"
    recentNews: result.recentNews.length > 0
      ? JSON.stringify(result.recentNews) : undefined, // uses schema default "[]"
    industry: result.industry !== 'Not found' ? result.industry : null,
    website: result.website || null,
    enrichmentSource: 'research_engine_v3',
    enrichmentDate: new Date(),
    fieldConfidence: JSON.stringify(fieldConfidence),
  };

  await db.companyResearchCard.upsert({
    where: { companyId },
    create: {
      companyId,
      ...researchCardData,
    },
    update: {
      ...researchCardData,
    },
  });

  // 6d: Update company fields
  const companyUpdate: Record<string, unknown> = {};
  if (result.industry && result.industry !== 'Not found') companyUpdate.industry = result.industry;
  if (result.website) companyUpdate.website = result.website;

  // Intelligence score based on confidence and field coverage
  let intScore = Math.round(result.overallConfidence * 80);
  if (result.keyPeople.length > 0) intScore += 5;
  if (signalResult.highImpactCount > 0) intScore += 5;
  if (result.evidenceCount > 10) intScore += 5;
  if (result.techStack) intScore += 3;
  companyUpdate.intelligenceScore = Math.min(100, intScore);
  companyUpdate.lastEnrichedAt = new Date();

  await db.company.update({ where: { id: companyId }, data: companyUpdate });

  // 6e: Update contacts' enrichment data
  await db.contact.updateMany({
    where: { companyId },
    data: {
      enrichmentScore: Math.round(result.overallConfidence * 100),
      enrichmentData: JSON.stringify({
        businessOverview: result.businessOverview,
        revenue: result.revenue,
        employeeCount: result.employeeCount,
        fundingStage: result.fundingStage,
        techStack: result.techStack,
        industry: result.industry,
        website: result.website,
        fieldConfidence: result.fieldConfidence,
        overallConfidence: result.overallConfidence,
        evidenceCount: result.evidenceCount,
      }),
    },
  });

  // 6f: Timeline event
  await db.companyTimelineEvent.create({
    data: {
      companyId,
      eventType: 'enrichment',
      title: `Research completed (${Math.round(result.overallConfidence * 100)}% confidence)`,
      description: `${result.evidenceCount} evidence sources, ${signalResult.signalCount} signals detected`,
      metadata: JSON.stringify({
        confidence: result.overallConfidence,
        evidenceCount: result.evidenceCount,
        signalCount: signalResult.signalCount,
        highImpactSignals: signalResult.highImpactCount,
        fieldConfidence: result.fieldConfidence,
      }),
    },
  });

  onProgress?.({ step: 6, label: 'Storing intelligence', progress: 100, message: 'Research complete' });

  return result;
}

// ── Re-exports for backward compatibility ──
export type { RawEvidence, ExtractedField, FieldConfidence } from './evidence';
export type { DetectedSignal, SignalDetectionResult } from './signals';