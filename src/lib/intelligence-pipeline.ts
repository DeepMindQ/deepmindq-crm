/**
 * AI Intelligence Enrichment Factory
 * ====================================
 * THE CORE PRODUCT PIPELINE
 *
 * Flow: Company → Web Search (Tavily) → Signal Extraction (NVIDIA LLM)
 *       → CompanySignal Records → Evidence Records → Research Card → Score
 *
 * Every signal has:
 *   - Type (funding, hiring, leadership, technology, expansion, etc.)
 *   - Severity (low/medium/high/critical)
 *   - Confidence (0-1)
 *   - Business Impact
 *   - Recommended Action
 *   - Timing Window
 *   - Source + URL + Date
 *
 * Evidence chain: every signal is backed by a web source.
 *
 * Used by: Import pipeline (auto-trigger), Manual enrichment, Batch processing
 */

import { db } from '@/lib/db';
import { webSearch } from '@/lib/llm-client';
import { extractJSON } from '@/lib/llm-client';
import { governedAICall } from '@/lib/ai-governance';
import type { SignalType, SignalSeverity, SignalImpact } from '@prisma/client';
import { logger } from '@/lib/logger';

// ─── Types ──────────────────────────────────────────────────────────────

export interface EnrichmentResult {
  companyId: string;
  companyName: string;
  success: boolean;
  signalsCreated: number;
  evidenceCreated: number;
  researchCardUpdated: boolean;
  score: number | null;
  error?: string;
  searchQueriesRun: number;
  llmProviderUsed: string;
  capabilitiesMatched?: number;
  opportunitiesGenerated?: number;
}

interface LLMSignal {
  type: string;
  title: string;
  description?: string;
  severity?: string;
  confidence?: number;
  businessImpact?: string;
  recommendedAction?: string;
  timingWindow?: string;
  source?: string;
  sourceUrl?: string;
  sourceDate?: string;
}

interface LLMResearchData {
  businessOverview?: string;
  industry?: string;
  techStack?: string;
  revenue?: string;
  employeeCount?: string;
  fundingStage?: string;
  keyPeople?: Array<{ name: string; title: string; department?: string }>;
  recentNews?: Array<{ title: string; snippet?: string; source?: string; url?: string; signalType?: string; impact?: string }>;
}

// ─── Search Query Templates ───────────────────────────────────────────

function buildSearchQueries(companyName: string, domain?: string): string[] {
  const domainStr = domain || '';
  return [
    // Business signals: funding, expansion, leadership, partnerships
    `"${companyName}" ${domainStr} recent news funding expansion leadership 2025 2026`,
    // Technology signals: AI, cloud, digital transformation, hiring
    `"${companyName}" ${domainStr} technology AI digital transformation cloud hiring engineers`,
  ];
}

// ─── LLM System Prompt ────────────────────────────────────────────────

const ENRICHMENT_SYSTEM_PROMPT = `You are an expert B2B sales intelligence analyst working for DeepMindQ, an AI Revenue Intelligence Operating System.

Your job: Analyze web search results about a company and extract actionable intelligence that helps an enterprise salesperson know WHO to target, WHY NOW, and WHAT to say.

OUTPUT FORMAT — Return ONLY valid JSON with this structure:
{
  "signals": [
    {
      "type": "funding|hiring|leadership|technology|expansion|partnership|product|risk",
      "title": "Brief signal title (max 100 chars)",
      "description": "Detailed explanation of the signal",
      "severity": "low|medium|high|critical",
      "confidence": 0.0-1.0,
      "businessImpact": "high|medium|low",
      "recommendedAction": "Specific action a sales rep should take NOW",
      "timingWindow": "immediate|this_week|this_month|this_quarter|ongoing",
      "source": "Source publication name",
      "sourceUrl": "URL from search results",
      "sourceDate": "Date from context or best estimate"
    }
  ],
  "research": {
    "businessOverview": "2-3 sentence company overview",
    "industry": "Primary industry sector",
    "techStack": "Detected technologies (comma separated)",
    "revenue": "Revenue estimate or range, or 'Unknown'",
    "employeeCount": "Employee count or range, or 'Unknown'",
    "fundingStage": "Funding stage if known, or 'Unknown'",
    "keyPeople": [
      {"name": "Person Name", "title": "Job Title", "department": "Department"}
    ],
    "recentNews": [
      {"title": "News headline", "snippet": "Summary", "source": "Source name", "url": "URL", "signalType": "type", "impact": "high|medium|low"}
    ]
  }
}

RULES:
1. Only extract signals backed by ACTUAL search results. Never fabricate.
2. Each signal MUST have a real source from the search results.
3. Confidence reflects how reliable and specific the source information is.
4. Recommended actions must be specific and actionable — not generic.
5. Severity "critical" = immediate revenue opportunity. "high" = strong signal. "medium" = worth monitoring. "low" = informational.
6. Return 0-10 signals depending on what the search results actually contain.
7. If no meaningful signals found, return empty signals array but still provide research overview.
8. Return ONLY the JSON object. No markdown fences, no commentary.`;

// ─── Core Enrichment Function ─────────────────────────────────────────

export async function enrichCompany(companyId: string): Promise<EnrichmentResult> {
  // Fetch company with contacts
  const company = await db.company.findUnique({
    where: { id: companyId },
    include: {
      contacts: {
        select: { email: true, title: true, rawName: true, role: true },
        take: 15,
      },
      signals: { select: { id: true }, take: 1 }, // just to check if any exist
      researchCard: { select: { id: true } },
    },
  });

  if (!company) {
    return {
      companyId,
      companyName: '',
      success: false,
      signalsCreated: 0,
      evidenceCreated: 0,
      researchCardUpdated: false,
      score: null,
      error: 'Company not found',
      searchQueriesRun: 0,
      llmProviderUsed: 'none',
    };
  }

  try {
    // ── Step 1: Web Search (2 parallel Tavily queries) ──
    const queries = buildSearchQueries(company.rawName, company.domain || undefined);
    const searchResults = await Promise.all(
      queries.map(q => webSearch(q, 5).catch(() => [])),
    );
    const allResults = [...searchResults[0], ...searchResults[1]].filter(r => r.title || r.snippet);

    if (allResults.length === 0) {
      // No search results — mark as enriched but no signals
      await db.company.update({
        where: { id: companyId },
        data: { lastEnrichedAt: new Date() },
      });
      return {
        companyId,
        companyName: company.rawName,
        success: true,
        signalsCreated: 0,
        evidenceCreated: 0,
        researchCardUpdated: false,
        score: null,
        error: 'No web search results found for this company',
        searchQueriesRun: queries.length,
        llmProviderUsed: 'none',
      };
    }

    // ── Step 2: LLM Analysis ──
    const searchContext = allResults
      .map((r, i) => `[${i + 1}] ${r.title}\n    Source: ${r.url}\n    ${r.snippet || r.description || ''}`)
      .join('\n\n');

    const contactContext =
      company.contacts.length > 0
        ? company.contacts
            .map(c => `- ${c.rawName} (${c.title || 'Unknown role'}, ${c.email})`)
            .join('\n')
        : 'No contacts available';

    const userPrompt = `Company: ${company.rawName}
Domain: ${company.domain || 'Unknown'}
Website: ${company.website || 'Unknown'}
Industry: ${company.industry || 'Unknown'}
Location: ${company.location || 'Unknown'}
Country: ${company.country || 'Unknown'}
Employees: ${company.sizeRange || 'Unknown'}
Contacts at this company:
${contactContext}

WEB SEARCH RESULTS (chronologically recent):
${searchContext}

Analyze these search results and extract ALL actionable intelligence signals and company research data.`;

    const llmResult = await governedAICall({
      generationType: 'company_enrichment',
      systemPrompt: ENRICHMENT_SYSTEM_PROMPT,
      userPrompt,
      tier: 'smart',
      maxTokens: 4096,
      temperature: 0.3, // Lower temperature for factual extraction
      companyId,
      enforceGovernance: false,
    });

    if (!llmResult.success) {
      return {
        companyId,
        companyName: company.rawName,
        success: false,
        signalsCreated: 0,
        evidenceCreated: 0,
        researchCardUpdated: false,
        score: null,
        error: llmResult.rejectionReason || 'LLM call failed',
        searchQueriesRun: queries.length,
        llmProviderUsed: 'none',
      };
    }

    // Parse LLM response
    const parsed = extractJSON(llmResult.response ?? '') as {
      signals?: LLMSignal[];
      research?: LLMResearchData;
    } | null;

    if (!parsed || !parsed.signals) {
      // Try to salvage research data even if signals parse failed
      if (parsed && parsed.research) {
        await upsertResearchCard(companyId, parsed.research);
        await db.company.update({
          where: { id: companyId },
          data: { lastEnrichedAt: new Date() },
        });
      }
      return {
        companyId,
        companyName: company.rawName,
        success: false,
        signalsCreated: 0,
        evidenceCreated: 0,
        researchCardUpdated: !!parsed?.research,
        score: null,
        error: 'Failed to parse LLM response structure',
        searchQueriesRun: queries.length,
        llmProviderUsed: 'governed',
      };
    }

    // ── Step 3: Create CompanySignal + Evidence records ──
    const validSignals = parsed.signals.filter(
      s => s.title && ['funding', 'hiring', 'leadership', 'technology', 'expansion', 'partnership', 'product', 'risk', 'other'].includes(s.type || 'other'),
    );

    let signalsCreated = 0;
    let evidenceCreated = 0;

    for (const signal of validSignals.slice(0, 10)) {
      // Create CompanySignal
      const createdSignal = await db.companySignal.create({
        data: {
          companyId,
          signalType: (signal.type || 'news') as SignalType,
          title: signal.title!.substring(0, 200),
          description: (signal.description || '').substring(0, 2000) || null,
          severity: (['low', 'medium', 'high', 'critical'].includes(signal.severity || '')
            ? signal.severity!
            : 'medium') as SignalSeverity,
          impact: (['high', 'medium', 'low'].includes(signal.businessImpact || '')
            ? signal.businessImpact!
            : 'medium') as SignalImpact,
          businessImpact: (signal.businessImpact || 'medium') + ' — ' + (signal.description || '').substring(0, 200),
          recommendedAction: (signal.recommendedAction || '').substring(0, 500) || null,
          signalDate: signal.sourceDate ? new Date(signal.sourceDate) : new Date(),
          confidence: typeof signal.confidence === 'number'
            ? Math.min(1, Math.max(0, signal.confidence))
            : 0.7,
          source: (signal.source || 'web_search').substring(0, 200),
          sourceUrl: (signal.sourceUrl || '').substring(0, 500),
          isRead: false,
        },
      });
      signalsCreated++;

      // Create Evidence record for this signal
      if (signal.source || signal.sourceUrl) {
        await db.evidence.create({
          data: {
            companyId,
            sourceUrl: signal.sourceUrl || 'https://web.search',
            sourceName: signal.source || 'web_search',
            snippet: signal.title!,
            extractedField: 'signal_intelligence',
            extractedValue: signal.title!,
            confidence: typeof signal.confidence === 'number'
              ? signal.confidence
              : 0.7,
          },
        });
        evidenceCreated++;
      }
    }

    // ── Step 4: Create/Update CompanyResearchCard ──
    if (parsed.research) {
      await upsertResearchCard(companyId, parsed.research);
    }

    // ── Step 5: Update company timestamps ──
    await db.company.update({
      where: { id: companyId },
      data: { lastEnrichedAt: new Date() },
    });

    // ── Step 6: Internal Intelligence Graph — Signal → Capability Matching ──
    // This is the CORE MOAT: match detected signals to our internal capabilities
    let capabilitiesMatched = 0;
    let opportunitiesGenerated = 0;
    try {
      const { CapabilityIntelligenceEngine } = await import('@/lib/capability-intelligence-engine');
      
      // Get the signals we just created for this company
      const newSignals = await db.companySignal.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      for (const signal of newSignals) {
        const matchResult = await CapabilityIntelligenceEngine.matchSignalToCapabilities(
          companyId, signal.id
        );
        if (matchResult.success && matchResult.matches.length > 0) {
          capabilitiesMatched += matchResult.matches.length;

          // Generate opportunity from best match
          const bestMatch = matchResult.matches[0];
          const persistedMatch = await db.signalCapabilityMatch.findFirst({
            where: { signalId: signal.id, capabilityId: bestMatch.capabilityId },
          });
          if (persistedMatch) {
            const oppResult = await CapabilityIntelligenceEngine.generateOpportunity(
              companyId, signal.id, persistedMatch.id
            );
            if (oppResult.success) opportunitiesGenerated++;
          }
        }
      }

      // Calculate win probability if we have matches
      if (capabilitiesMatched > 0) {
        const winResult = await CapabilityIntelligenceEngine.calculateWinProbability(companyId);
        if (winResult.success && winResult.probability > 0) {
          // Boost intelligence score based on win probability
          const currentScore = company.intelligenceScore || 0;
          const boostedScore = Math.max(currentScore, Math.round(winResult.probability * 0.8));
          await db.company.update({
            where: { id: companyId },
            data: { intelligenceScore: boostedScore },
          });
        }
      }
    } catch (capErr) {
      logger.warn(`[IntelligencePipeline] Capability matching failed (non-blocking): ${capErr instanceof Error ? capErr.message : capErr}`);
    }

    return {
      companyId,
      companyName: company.rawName,
      success: true,
      signalsCreated,
      evidenceCreated,
      researchCardUpdated: !!parsed.research,
      score: null, // ScoringEngine computes separately
      searchQueriesRun: queries.length,
      llmProviderUsed: 'governed',
      capabilitiesMatched,
      opportunitiesGenerated,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`[IntelligencePipeline] Failed for company ${company.rawName}:`, { detail: msg });
    return {
      companyId,
      companyName: company.rawName,
      success: false,
      signalsCreated: 0,
      evidenceCreated: 0,
      researchCardUpdated: false,
      score: null,
      error: msg,
      searchQueriesRun: 0,
      llmProviderUsed: 'none',
    };
  }
}

// ─── Research Card Upsert ──────────────────────────────────────────────

async function upsertResearchCard(companyId: string, data: LLMResearchData): Promise<void> {
  const cardData: Record<string, unknown> = {};

  if (data.businessOverview) cardData.businessOverview = data.businessOverview.substring(0, 3000);
  if (data.industry) cardData.industry = data.industry.substring(0, 200);
  if (data.techStack) cardData.techStack = JSON.stringify(data.techStack.split(',').map(s => s.trim()).filter(Boolean));
  if (data.revenue) cardData.revenue = data.revenue.substring(0, 200);
  if (data.employeeCount) cardData.employeeCount = data.employeeCount.substring(0, 100);
  if (data.fundingStage) cardData.fundingStage = data.fundingStage.substring(0, 100);
  if (data.keyPeople) cardData.keyPeople = JSON.stringify(data.keyPeople.slice(0, 10));
  if (data.recentNews) cardData.recentNews = JSON.stringify(data.recentNews.slice(0, 10));
  cardData.enrichmentSource = 'intelligence_pipeline';
  cardData.enrichmentDate = new Date();

  await db.companyResearchCard.upsert({
    where: { companyId },
    update: cardData,
    create: { companyId, ...cardData },
  });
}

// ─── Pipeline Orchestration ───────────────────────────────────────────

export const IntelligencePipeline = {
  /**
   * Enrich a single company. Returns full result.
   */
  enrichCompany,

  /**
   * Enrich multiple companies sequentially (respects rate limits).
   * Creates Job records for tracking.
   */
  async enrichBatch(
    companyIds: string[],
    options?: {
      batchId?: string;
      onProgress?: (completed: number, total: number, result: EnrichmentResult) => void;
    },
  ): Promise<{ results: EnrichmentResult[]; jobId: string }> {
    // Create a parent Job for tracking
    const job = await db.job.create({
      data: {
        type: 'enrichment',
        status: 'running',
        priority: 3,
        payload: JSON.stringify({ total: companyIds.length, companyIds }),
        progress: 0,
        currentStep: 'Starting batch enrichment',
        startedAt: new Date(),
        batchId: options?.batchId,
      },
    });

    const results: EnrichmentResult[] = [];

    for (let i = 0; i < companyIds.length; i++) {
      const companyId = companyIds[i];

      try {
        await db.job.update({
          where: { id: job.id },
          data: {
            progress: Math.round((i / companyIds.length) * 100),
            currentStep: `Enriching company ${i + 1} of ${companyIds.length}`,
          },
        });

        const result = await enrichCompany(companyId);
        results.push(result);

        if (options?.onProgress) {
          options.onProgress(i + 1, companyIds.length, result);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({
          companyId,
          companyName: '',
          success: false,
          signalsCreated: 0,
          evidenceCreated: 0,
          researchCardUpdated: false,
          score: null,
          error: msg,
          searchQueriesRun: 0,
          llmProviderUsed: 'none',
        });
      }
    }

    // Mark job complete
    await db.job.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        progress: 100,
        currentStep: 'Batch enrichment complete',
        completedAt: new Date(),
        result: JSON.stringify({
          total: companyIds.length,
          succeeded: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          signalsCreated: results.reduce((sum, r) => sum + r.signalsCreated, 0),
          evidenceCreated: results.reduce((sum, r) => sum + r.evidenceCreated, 0),
        }),
      },
    });

    return { results, jobId: job.id };
  },

  /**
   * Get companies that have never been enriched (for batch processing).
   * Prioritizes companies with more contacts.
   */
  async getCompaniesNeedingEnrichment(limit = 50): Promise<Array<{ id: string; rawName: string; contactCount: number }>> {
    const companies = await db.company.findMany({
      where: { lastEnrichedAt: null },
      include: { _count: { select: { contacts: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return companies
      .map(c => ({ id: c.id, rawName: c.rawName, contactCount: c._count.contacts }))
      .sort((a, b) => b.contactCount - a.contactCount);
  },

  /**
   * Get enrichment pipeline statistics.
   */
  async getStats(): Promise<{
    totalCompanies: number;
    enriched: number;
    notEnriched: number;
    totalSignals: number;
    totalEvidence: number;
    totalResearchCards: number;
  }> {
    const [totalCompanies, enriched, notEnriched, totalSignals, totalEvidence, totalResearchCards] = await Promise.all([
      db.company.count(),
      db.company.count({ where: { lastEnrichedAt: { not: null } } }),
      db.company.count({ where: { lastEnrichedAt: null } }),
      db.companySignal.count(),
      db.evidence.count(),
      db.companyResearchCard.count(),
    ]);

    return { totalCompanies, enriched, notEnriched, totalSignals, totalEvidence, totalResearchCards };
  },
};
