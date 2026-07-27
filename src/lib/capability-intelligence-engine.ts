/**
 * CapabilityIntelligenceEngine — Internal Intelligence Graph Core
 * ================================================================
 *
 * The CORE MOAT of DeepMindQ. This engine transforms raw organizational
 * knowledge (services, case studies, IP, whitepapers, capabilities) into
 * structured, searchable, matchable intelligence that feeds EVERY AI engine.
 *
 * ARCHITECTURE:
 *   1. Knowledge Ingestion — Accepts structured knowledge → CapabilityAsset + KnowledgeEntry
 *   2. Auto-Embedding — Every asset gets embedded via RetrievalEngine for semantic search
 *   3. Signal-Capability Matching — When signals are detected, finds matching capabilities
 *   4. Opportunity Generation — Signal + Capability Match → OpportunityRecommendation
 *   5. Feed-All Pattern — Every composition engine pulls capabilities via RetrievalEngine
 *
 * THE INTELLIGENCE FLOW:
 *   External Signal (prospect hiring AI engineers)
 *       ↓
 *   Capability Match (our AI/ML service line matches)
 *       ↓
 *   Business Problem (legacy AI infrastructure, scaling challenges)
 *       ↓
 *   Case Study Match (Fortune 500 Document Automation case)
 *       ↓
 *   Proof Points (150+ implementations, 85% time reduction)
 *       ↓
 *   Opportunity Recommendation (pursue with CTO, position AI practice)
 *       ↓
 *   Win Probability (high — signal + capability + evidence alignment)
 *       ↓
 *   Next Best Action (schedule discovery call within 14 days)
 *
 * NON-THROWING CONTRACT:
 *   Every public method returns a structured result. Failures are surfaced
 *   as success:false + error:message rather than thrown.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ModelRouter, type CompletionResult } from '@/lib/engines/model-router';
import { RetrievalEngine, embedEntity, type RetrievalResult } from '@/lib/engines/retrieval-engine';

// ─── Types ──────────────────────────────────────────────────────────────

export type KnowledgeCategory =
  | 'service_line'
  | 'solution'
  | 'accelerator'
  | 'case_study'
  | 'proof_point'
  | 'objection_response'
  | 'cta'
  | 'technology'
  | 'industry_expertise'
  | 'whitepaper'
  | 'blog'
  | 'sales_deck'
  | 'proposal_template'
  | 'ip_platform'
  | 'certification'
  | 'delivery_capability'
  | 'messaging';

export interface CapabilityInput {
  title: string;
  summary: string;
  category: KnowledgeCategory;
  serviceLine?: string;
  solution?: string;
  accelerator?: string;
  technology?: string;
  industry?: string;
  businessProblem?: string;
  customerOutcome?: string;
  differentiator?: string;
  targetIndustries?: string[];    // ["Financial Services", "Healthcare"]
  targetRoles?: string[];         // ["CTO", "VP Engineering"]
  targetCompanySizes?: string[];  // ["Enterprise", "Mid-Market"]
  caseStudyRef?: Array<{ title: string; url?: string; industry: string; outcome: string }>;
  proofPointRef?: Array<{ metric: string; value: string; context: string }>;
  keywords?: string[];
  content?: string;
  evidence?: string;
  tags?: string[];
  parentAssetId?: string;
  isActive?: boolean;
}

export interface IngestResult {
  success: boolean;
  assetId: string;
  embedded: boolean;
  error: string | null;
}

export interface BulkIngestResult {
  success: boolean;
  total: number;
  created: number;
  skipped: number;
  errors: number;
  details: Array<{ title: string; status: string; reason?: string }>;
}

export interface SignalMatchResult {
  success: boolean;
  companyId: string;
  signalId: string;
  matches: Array<{
    capabilityId: string;
    capabilityTitle: string;
    capabilityCategory: string;
    matchScore: number;
    reason: string;
    businessProblem: string;
    expectedOutcome: string;
    salesAngle: string;
  }>;
  error: string | null;
}

export interface OpportunityGenResult {
  success: boolean;
  opportunityId?: string;
  opportunityTitle?: string;
  opportunityScore?: number;
  confidence?: number;
  priority?: string;
  error: string | null;
}

export interface WinProbabilityResult {
  success: boolean;
  probability: number;          // 0-100
  factors: {
    signalStrength: number;     // 0-100
    capabilityFit: number;      // 0-100
    evidenceStrength: number;   // 0-100
    timingScore: number;        // 0-100
    competitivePosition: number; // 0-100
  };
  reasoning: string;
  recommendation: string;
  error: string | null;
}

// ─── Constants ──────────────────────────────────────────────────────────

const VALID_CATEGORIES: string[] = [
  'service_line', 'solution', 'accelerator', 'case_study', 'proof_point',
  'objection_response', 'cta', 'technology', 'industry_expertise',
  'whitepaper', 'blog', 'sales_deck', 'proposal_template', 'ip_platform',
  'certification', 'delivery_capability', 'messaging',
];

// ─── Helper: JSON field serialization ────────────────────────────────────

function toJsonArray<T>(val: T[] | undefined | null): string | null {
  if (!val || !Array.isArray(val) || val.length === 0) return null;
  return JSON.stringify(val);
}

function fromJsonArray<T>(val: string | null | undefined): T[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return val.split(',').map(s => s.trim()).filter(Boolean) as unknown as T[];
  }
}

// ═══════════════════════════════════════════════════════════════════════
// CapabilityIntelligenceEngine
// ═══════════════════════════════════════════════════════════════════════

export const CapabilityIntelligenceEngine = {

  // ─── 1. KNOWLEDGE INGESTION ──────────────────────────────────────────

  /**
   * Ingest a single capability asset into the Internal Intelligence Graph.
   * Creates the CapabilityAsset record + auto-embeds for semantic search.
   */
  async ingest(input: CapabilityInput): Promise<IngestResult> {
    try {
      // Validate category
      const category = VALID_CATEGORIES.includes(input.category)
        ? input.category
        : 'service_line';

      // Dedup check: title + category
      const existing = await db.capabilityAsset.findFirst({
        where: { title: input.title, category },
      });
      if (existing) {
        return {
          success: true,
          assetId: existing.id,
          embedded: false,
          error: `Asset "${input.title}" already exists (id: ${existing.id})`,
        };
      }

      // Create the capability asset
      const asset = await db.capabilityAsset.create({
        data: {
          title: input.title,
          summary: input.summary,
          category,
          serviceLine: input.serviceLine || null,
          solution: input.solution || null,
          accelerator: input.accelerator || null,
          technology: input.technology || null,
          industry: input.industry || null,
          businessProblem: input.businessProblem || null,
          customerOutcome: input.customerOutcome || null,
          differentiator: input.differentiator || null,
          targetIndustries: toJsonArray(input.targetIndustries),
          targetRoles: toJsonArray(input.targetRoles),
          targetCompanySizes: toJsonArray(input.targetCompanySizes),
          caseStudyRef: input.caseStudyRef ? toJsonArray(input.caseStudyRef) : null,
          proofPointRef: input.proofPointRef ? toJsonArray(input.proofPointRef) : null,
          keywords: toJsonArray(input.keywords),
          content: input.content || null,
          evidence: input.evidence || null,
          tags: toJsonArray(input.tags),
          parentAssetId: input.parentAssetId || null,
          isActive: input.isActive !== false,
          version: 1,
        },
      });

      // Auto-embed: build semantic vector for RetrievalEngine
      let embedded = false;
      try {
        const embedText = [
          asset.title,
          asset.summary,
          asset.businessProblem || '',
          asset.customerOutcome || '',
          asset.differentiator || '',
          asset.technology || '',
          asset.industry || '',
          asset.keywords || '',
        ].filter(Boolean).join('\n');

        if (embedText.trim()) {
          await embedEntity('capability_asset', asset.id, embedText);
          embedded = true;
          logger.info(`[capability-engine] embedded asset "${asset.title}" (${asset.id})`);
        }
      } catch (embedErr) {
        logger.warn(`[capability-engine] embedding failed for "${asset.title}": ${embedErr instanceof Error ? embedErr.message : embedErr}`);
      }

      return { success: true, assetId: asset.id, embedded, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[capability-engine] ingest failed: ${msg}`);
      return { success: false, assetId: '', embedded: false, error: msg };
    }
  },

  /**
   * Bulk ingest multiple capabilities (from JSON, CSV, or structured data).
   * Returns detailed results for each asset.
   */
  async bulkIngest(inputs: CapabilityInput[]): Promise<BulkIngestResult> {
    const result: BulkIngestResult = {
      success: true,
      total: inputs.length,
      created: 0,
      skipped: 0,
      errors: 0,
      details: [],
    };

    for (const input of inputs) {
      if (!input.title || !input.summary) {
        result.skipped++;
        result.details.push({
          title: input.title || 'Untitled',
          status: 'skipped',
          reason: 'Missing title or summary',
        });
        continue;
      }

      const ingestResult = await this.ingest(input);
      if (ingestResult.success && ingestResult.embedded) {
        result.created++;
        result.details.push({
          title: input.title,
          status: 'created',
        });
      } else if (ingestResult.success && !ingestResult.embedded) {
        result.skipped++;
        result.details.push({
          title: input.title,
          status: 'skipped',
          reason: ingestResult.error || 'Already exists',
        });
      } else {
        result.errors++;
        result.details.push({
          title: input.title,
          status: 'error',
          reason: ingestResult.error || 'Unknown error',
        });
      }
    }

    // Rebuild the retrieval index after bulk ingestion
    try {
      await RetrievalEngine.buildIndexFromRawEntities();
      logger.info(`[capability-engine] index rebuilt after bulk ingest (${result.created} new assets)`);
    } catch (err) {
      logger.warn(`[capability-engine] index rebuild failed: ${err instanceof Error ? err.message : err}`);
    }

    return result;
  },

  /**
   * Get all capability assets, optionally filtered by category.
   * Returns parsed JSON fields.
   */
  async getAssets(category?: string): Promise<Array<Record<string, unknown>>> {
    try {
      const where: Record<string, unknown> = {};
      if (category && category !== 'all') {
        where.category = category;
      }

      const assets = await db.capabilityAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      return assets.map(asset => ({
        ...asset,
        targetIndustries: fromJsonArray(asset.targetIndustries),
        targetRoles: fromJsonArray(asset.targetRoles),
        targetCompanySizes: fromJsonArray(asset.targetCompanySizes),
        caseStudyRef: fromJsonArray(asset.caseStudyRef),
        proofPointRef: fromJsonArray(asset.proofPointRef),
        keywords: fromJsonArray(asset.keywords),
        tags: fromJsonArray(asset.tags),
      }));
    } catch (err) {
      logger.error(`[capability-engine] getAssets failed: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  },

  /**
   * Search capabilities by semantic query.
   * Returns ranked results from RetrievalEngine.
   */
  async searchCapabilities(query: string, topK = 5): Promise<RetrievalResult[]> {
    try {
      return await RetrievalEngine.search(query, topK, { type: 'capability_asset' });
    } catch (err) {
      logger.error(`[capability-engine] searchCapabilities failed: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  },

  // ─── 2. SIGNAL → CAPABILITY MATCHING ─────────────────────────────────

  /**
   * Match a detected signal against all internal capabilities.
   * This is THE core AI reasoning step: "Company X is hiring AI engineers"
   * → "Our AI/ML service line matches because they likely need ML infrastructure"
   * → "Our Fortune 500 Document Automation case study is relevant"
   * → "CTO and Head of Data should be prioritized"
   *
   * Uses LLM reasoning + semantic retrieval for maximum matching quality.
   */
  async matchSignalToCapabilities(
    companyId: string,
    signalId: string,
  ): Promise<SignalMatchResult> {
    try {
      // Fetch the signal
      const signal = await db.companySignal.findUnique({
        where: { id: signalId },
        include: {
          company: {
            select: {
              rawName: true,
              industry: true,
              sizeRange: true,
              country: true,
            },
          },
        },
      });

      if (!signal) {
        return { success: false, companyId, signalId, matches: [], error: 'Signal not found' };
      }

      // Fetch active capabilities
      const capabilities = await db.capabilityAsset.findMany({
        where: { isActive: true },
      });

      if (capabilities.length === 0) {
        return {
          success: true,
          companyId,
          signalId,
          matches: [],
          error: null,
        };
      }

      // Build capability context for LLM
      const capabilityContext = capabilities.map(cap => {
        const problems = fromJsonArray<string>(cap.problems);
        const outcomes = fromJsonArray<string>(cap.proofPointRef);
        const industries = fromJsonArray<string>(cap.targetIndustries);
        const roles = fromJsonArray<string>(cap.targetRoles);

        return `CAPABILITY: ${cap.title}
  Category: ${cap.category}
  Service Line: ${cap.serviceLine || 'N/A'}
  Technology: ${cap.technology || 'N/A'}
  Industry: ${cap.industry || 'N/A'}
  Summary: ${cap.summary}
  Business Problem: ${cap.businessProblem || 'N/A'}
  Customer Outcome: ${cap.customerOutcome || 'N/A'}
  Differentiator: ${cap.differentiator || 'N/A'}
  Target Industries: ${industries.join(', ') || 'All'}
  Target Roles: ${roles.join(', ') || 'All'}
  Evidence: ${cap.evidence || 'N/A'}
  Keywords: ${fromJsonArray<string>(cap.keywords).join(', ') || 'None'}`;
      }).join('\n\n');

      // LLM matching
      const systemPrompt = `You are an expert sales intelligence matching engine for DeepMindQ.
Your job: Analyze a detected buying signal from a prospect company and match it to the most relevant INTERNAL capabilities.

Think step by step:
1. What business problem does this signal reveal?
2. Which of our capabilities directly address this problem?
3. What evidence/case studies support the match?
4. What sales angle should be used?
5. Who should we target?

Return ONLY valid JSON array (max 3 matches, sorted by relevance):
[
  {
    "capabilityIndex": <0-based index from the capability list>,
    "matchScore": 0.0-1.0,
    "reason": "Why this capability matches this signal (2-3 sentences)",
    "businessProblem": "The identified business problem this signal reveals",
    "expectedOutcome": "What the customer would achieve with our capability",
    "salesAngle": "Recommended opening angle for outreach"
  }
]

Rules:
- Only match capabilities with matchScore >= 0.3
- Be specific — reference actual capability details, not generic matches
- Consider industry alignment, technology fit, and problem-solution alignment
- If no strong match exists, return empty array []`;

      const userPrompt = `SIGNAL DETECTED:
  Company: ${signal.company.rawName}
  Industry: ${signal.company.industry || 'Unknown'}
  Size: ${signal.company.sizeRange || 'Unknown'}
  Country: ${signal.company.country || 'Unknown'}
  Signal Type: ${signal.signalType}
  Title: ${signal.title}
  Description: ${signal.description || 'No description'}
  Severity: ${signal.severity}
  Business Impact: ${signal.businessImpact || 'Not specified'}
  Recommended Action: ${signal.recommendedAction || 'Not specified'}
  Confidence: ${signal.confidence}

AVAILABLE CAPABILITIES:
${capabilityContext}

Match this signal to the most relevant capabilities.`;

      const llmResult = await ModelRouter.complete({
        systemPrompt,
        userPrompt,
        tier: 'smart',
        maxTokens: 3000,
        temperature: 0.3,
        genType: 'capability_matching',
        companyId,
      });

      if (!llmResult.success) {
        logger.warn(`[capability-engine] LLM matching failed: ${llmResult.error}`);
        return { success: false, companyId, signalId, matches: [], error: llmResult.error };
      }

      // Parse matches
      const matches: SignalMatchResult['matches'] = [];
      try {
        const cleaned = llmResult.text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);

        if (Array.isArray(parsed)) {
          for (const match of parsed) {
            const capIndex = typeof match.capabilityIndex === 'number' ? match.capabilityIndex : -1;
            if (capIndex < 0 || capIndex >= capabilities.length) continue;

            const capability = capabilities[capIndex];
            const matchScore = typeof match.matchScore === 'number'
              ? Math.min(1, Math.max(0, match.matchScore))
              : 0.5;

            if (matchScore < 0.3) continue;

            matches.push({
              capabilityId: capability.id,
              capabilityTitle: capability.title,
              capabilityCategory: capability.category,
              matchScore,
              reason: String(match.reason || 'Capability aligns with detected signal'),
              businessProblem: String(match.businessProblem || ''),
              expectedOutcome: String(match.expectedOutcome || ''),
              salesAngle: String(match.salesAngle || ''),
            });
          }
        }
      } catch (parseErr) {
        logger.warn(`[capability-engine] match parsing failed: ${parseErr instanceof Error ? parseErr.message : parseErr}`);
      }

      // Persist SignalCapabilityMatch records
      for (const match of matches) {
        try {
          await db.signalCapabilityMatch.create({
            data: {
              companyId,
              signalId,
              capabilityId: match.capabilityId,
              matchScore: match.matchScore,
              reason: match.reason,
              businessProblem: match.businessProblem,
              expectedOutcome: match.expectedOutcome,
              salesAngle: match.salesAngle,
            },
          });
        } catch (persistErr) {
          logger.warn(`[capability-engine] failed to persist match: ${persistErr instanceof Error ? persistErr.message : persistErr}`);
        }
      }

      logger.info(`[capability-engine] matched ${matches.length} capabilities for signal "${signal.title}" in ${signal.company.rawName}`);

      return { success: true, companyId, signalId, matches, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[capability-engine] matchSignalToCapabilities failed: ${msg}`);
      return { success: false, companyId, signalId, matches: [], error: msg };
    }
  },

  // ─── 3. OPPORTUNITY GENERATION ───────────────────────────────────────

  /**
   * Generate an OpportunityRecommendation from a Signal + Capability Match.
   * This transforms raw intelligence into actionable sales opportunities.
   *
   * Flow: Signal + CapabilityMatch → LLM reasoning → OpportunityRecommendation
   */
  async generateOpportunity(
    companyId: string,
    signalId: string,
    capabilityMatchId: string,
  ): Promise<OpportunityGenResult> {
    try {
      // Fetch signal + match + capability (split to avoid using `match` before declaration)
      const [signal, capabilityMatch] = await Promise.all([
        db.companySignal.findUnique({ where: { id: signalId } }),
        db.signalCapabilityMatch.findUnique({ where: { id: capabilityMatchId } }),
      ]);
      const capability = await db.capabilityAsset.findUnique({
        where: { id: capabilityMatch?.capabilityId || '' },
      });
      const match = capabilityMatch;

      if (!signal || !match || !capability) {
        return { success: false, error: 'Signal, match, or capability not found' };
      }

      // Fetch company + contacts for context
      const company = await db.company.findUnique({
        where: { id: companyId },
        include: {
          contacts: {
            select: { rawName: true, title: true, email: true, leadScore: true, role: true },
            take: 10,
            orderBy: { leadScore: 'desc' },
          },
          evidence: { select: { id: true, snippet: true, sourceName: true } },
        },
      });

      if (!company) {
        return { success: false, error: 'Company not found' };
      }

      // Fetch related case studies and proof points
      const relatedCaseStudies = await db.capabilityAsset.findMany({
        where: {
          isActive: true,
          category: 'case_study',
          OR: [
            { serviceLine: capability.serviceLine },
            { technology: capability.technology },
            { industry: company.industry || undefined },
          ],
        },
        take: 5,
      });

      const relatedProofPoints = await db.capabilityAsset.findMany({
        where: {
          isActive: true,
          category: 'proof_point',
        },
        take: 5,
      });

      // LLM reasoning for opportunity
      const systemPrompt = `You are an enterprise revenue intelligence analyst for DeepMindQ.
Generate a strategic opportunity recommendation based on the intelligence below.

Think step by step:
1. Why is this company attractive NOW? (signal timing)
2. What specific business problem does this signal reveal?
3. Which capability should be positioned and why?
4. Which case studies and proof points support this?
5. Who should we target? (based on contacts and signal type)
6. What should the first conversation be about?
7. How confident are we? What's the win probability?

Return ONLY valid JSON:
{
  "opportunityTitle": "Compelling title for this opportunity (max 100 chars)",
  "businessTrigger": "What event triggered this opportunity",
  "whyNow": "Why pursue this company RIGHT NOW (2-3 sentences)",
  "businessProblem": "The core business problem identified",
  "recommendedCapability": "Title of the capability to position",
  "recommendedStakeholders": ["Role 1", "Role 2"],
  "suggestedConversation": "Strategic conversation topics to initiate (3-4 sentences)",
  "opportunityScore": 0-100,
  "confidenceScore": 0.0-1.0,
  "priority": "high|medium|low",
  "reasoning": "Full reasoning chain (3-4 sentences)"
}`;

      const contactsContext = company.contacts.slice(0, 5).map(c =>
        `  - ${c.rawName} (${c.title || c.role || 'Unknown'}, score: ${c.leadScore})`
      ).join('\n');

      const caseStudyContext = relatedCaseStudies.map(cs =>
        `  - ${cs.title}: ${cs.summary}`
      ).join('\n');

      const proofPointContext = relatedProofPoints.map(pp =>
        `  - ${pp.title}: ${pp.summary}`
      ).join('\n');

      const userPrompt = `COMPANY INTELLIGENCE:
  Company: ${company.rawName}
  Industry: ${company.industry || 'Unknown'}
  Size: ${company.sizeRange || 'Unknown'}
  Status: ${company.status}
  Intelligence Score: ${company.intelligenceScore}

DETECTED SIGNAL:
  Type: ${signal.signalType}
  Title: ${signal.title}
  Description: ${signal.description || 'N/A'}
  Severity: ${signal.severity}
  Business Impact: ${signal.businessImpact || 'N/A'}
  Confidence: ${signal.confidence}

CAPABILITY MATCH:
  Capability: ${capability.title}
  Category: ${capability.category}
  Match Score: ${match.matchScore}
  Match Reason: ${match.reason}
  Business Problem: ${match.businessProblem}
  Expected Outcome: ${match.expectedOutcome}
  Sales Angle: ${match.salesAngle}

DECISION MAKERS:
${contactsContext || 'No contacts found'}

SUPPORTING CASE STUDIES:
${caseStudyContext || 'No case studies loaded yet'}

PROOF POINTS:
${proofPointContext || 'No proof points loaded yet'}

EVIDENCE RECORDS: ${company.evidence.length} pieces of evidence

Generate the opportunity recommendation.`;

      const llmResult = await ModelRouter.complete({
        systemPrompt,
        userPrompt,
        tier: 'smart',
        maxTokens: 3000,
        temperature: 0.3,
        genType: 'opportunity_generation',
        companyId,
      });

      if (!llmResult.success) {
        return { success: false, error: llmResult.error };
      }

      // Parse and persist
      const cleaned = llmResult.text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      const opportunity = await db.opportunityRecommendation.create({
        data: {
          companyId,
          signalId,
          capabilityMatchId,
          opportunityTitle: parsed.opportunityTitle || `${capability.title} opportunity at ${company.rawName}`,
          businessTrigger: parsed.businessTrigger || signal.title,
          whyNow: parsed.whyNow || 'Signal detected indicating buying intent',
          businessProblem: parsed.businessProblem || match.businessProblem || 'Unknown',
          recommendedCapability: parsed.recommendedCapability || capability.title,
          recommendedStakeholders: toJsonArray(parsed.recommendedStakeholders) || '[]',
          suggestedConversation: parsed.suggestedConversation || match.salesAngle || '',
          evidenceIds: toJsonArray(company.evidence.slice(0, 5).map(e => e.id)) || '[]',
          confidenceScore: typeof parsed.confidenceScore === 'number'
            ? Math.min(1, Math.max(0, parsed.confidenceScore))
            : match.matchScore,
          freshnessScore: signal.confidence || 80,
          matchScore: match.matchScore,
          opportunityScore: typeof parsed.opportunityScore === 'number'
            ? Math.min(100, Math.max(0, parsed.opportunityScore))
            : Math.round(match.matchScore * signal.confidence * 100),
          priority: ['high', 'medium', 'low'].includes(parsed.priority) ? parsed.priority : 'medium',
          status: 'pending_review',
          confidenceBreakdown: {
            signalStrength: signal.confidence,
            capabilityFit: match.matchScore,
            evidenceCount: company.evidence.length,
            contactCount: company.contacts.length,
            reasoning: parsed.reasoning || '',
          },
          confidenceFactors: {
            positiveFactors: [
              `Signal detected: ${signal.title}`,
              `Capability match: ${capability.title} (${Math.round(match.matchScore * 100)}%)`,
              company.evidence.length > 0 ? `${company.evidence.length} evidence records` : null,
              company.contacts.length > 0 ? `${company.contacts.length} contacts identified` : null,
            ].filter(Boolean),
            negativeFactors: [
              company.evidence.length === 0 ? 'No evidence records yet' : null,
              company.contacts.length === 0 ? 'No contacts identified' : null,
            ].filter(Boolean),
          },
        },
      });

      logger.info(`[capability-engine] generated opportunity "${opportunity.opportunityTitle}" (score: ${opportunity.opportunityScore}, priority: ${opportunity.priority})`);

      return {
        success: true,
        opportunityId: opportunity.id,
        opportunityTitle: opportunity.opportunityTitle,
        opportunityScore: opportunity.opportunityScore,
        confidence: opportunity.confidenceScore,
        priority: opportunity.priority,
        error: null,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[capability-engine] generateOpportunity failed: ${msg}`);
      return { success: false, error: msg };
    }
  },

  // ─── 4. WIN PROBABILITY ───────────────────────────────────────────────

  /**
   * Calculate win probability for a company based on signal + capability + evidence alignment.
   * This answers: "Why will we win?" with a structured reasoning chain.
   */
  async calculateWinProbability(companyId: string): Promise<WinProbabilityResult> {
    try {
      // Fetch company with full intelligence context
      const company = await db.company.findUnique({
        where: { id: companyId },
        include: {
          signals: { take: 10, orderBy: { createdAt: 'desc' } },
          signalCapabilityMatches: {
            include: {
              capability: true,
              signal: true,
            },
            take: 5,
            orderBy: { matchScore: 'desc' },
          },
          evidence: { take: 10 },
          contacts: { take: 10, orderBy: { leadScore: 'desc' } },
          opportunityRecommendations: {
            take: 3,
            orderBy: { opportunityScore: 'desc' },
          },
        },
      });

      if (!company) {
        return { success: false, probability: 0, factors: { signalStrength: 0, capabilityFit: 0, evidenceStrength: 0, timingScore: 0, competitivePosition: 0 }, reasoning: 'Company not found', recommendation: '', error: 'Company not found' };
      }

      // Calculate raw scores
      const signalStrength = company.signals.length > 0
        ? Math.min(100, company.signals.reduce((sum, s) => sum + s.confidence, 0) / company.signals.length)
        : 0;

      const capabilityFit = company.signalCapabilityMatches.length > 0
        ? Math.min(100, company.signalCapabilityMatches.reduce((sum, m) => sum + m.matchScore, 0) / company.signalCapabilityMatches.length * 100)
        : 0;

      const evidenceStrength = Math.min(100, company.evidence.length * 10);
      const timingScore = company.signals.some(s => s.severity === 'critical') ? 90
        : company.signals.some(s => s.severity === 'high') ? 70
        : company.signals.length > 0 ? 50 : 0;

      // LLM reasoning for competitive position and overall probability
      const topMatches = company.signalCapabilityMatches.slice(0, 3).map(m =>
        `  - ${m.capability.title} (match: ${Math.round(m.matchScore * 100)}%): ${m.reason}`
      ).join('\n');

      const topSignals = company.signals.slice(0, 3).map(s =>
        `  - [${s.severity}] ${s.title}: ${s.businessImpact || 'No impact specified'}`
      ).join('\n');

      const systemPrompt = `You are a competitive intelligence analyst for DeepMindQ.
Analyze the intelligence data below and provide:
1. Competitive position assessment (0-100)
2. Overall win probability (0-100)
3. Reasoning (why we'll win or why it's risky)
4. Strategic recommendation

Return ONLY valid JSON:
{
  "competitivePosition": 0-100,
  "probability": 0-100,
  "reasoning": "2-3 sentence reasoning chain",
  "recommendation": "What we should do next (1-2 sentences)"
}`;

      const userPrompt = `COMPANY: ${company.rawName}
Industry: ${company.industry || 'Unknown'}
Size: ${company.sizeRange || 'Unknown'}
Intelligence Score: ${company.intelligenceScore}

SIGNALS (${company.signals.length} total):
${topSignals || 'No signals detected'}

CAPABILITY MATCHES (${company.signalCapabilityMatches.length} total):
${topMatches || 'No capability matches yet'}

EVIDENCE: ${company.evidence.length} records
CONTACTS: ${company.contacts.length} identified
OPPORTUNITIES: ${company.opportunityRecommendations.length} generated

Analyze win probability.`;

      const llmResult = await ModelRouter.complete({
        systemPrompt,
        userPrompt,
        tier: 'fast',
        maxTokens: 1000,
        temperature: 0.3,
        genType: 'win_probability',
        companyId,
      });

      let competitivePosition = 50; // default
      let probability = 0;
      let reasoning = 'Insufficient intelligence data for accurate probability assessment';
      let recommendation = 'Enrich company data to improve probability assessment';

      if (llmResult.success) {
        try {
          const cleaned = llmResult.text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleaned);
          competitivePosition = typeof parsed.competitivePosition === 'number'
            ? Math.min(100, Math.max(0, parsed.competitivePosition))
            : competitivePosition;
          reasoning = parsed.reasoning || reasoning;
          recommendation = parsed.recommendation || recommendation;
        } catch {
          // Use defaults
        }
      }

      // Weighted composite probability
      probability = Math.round(
        (signalStrength * 0.25) +
        (capabilityFit * 0.30) +
        (evidenceStrength * 0.20) +
        (timingScore * 0.15) +
        (competitivePosition * 0.10)
      );

      // Use LLM probability if it was parsed and seems reasonable
      if (llmResult.success) {
        try {
          const cleaned = llmResult.text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleaned);
          if (typeof parsed.probability === 'number') {
            const llmProb = Math.min(100, Math.max(0, parsed.probability));
            // Blend: 60% composite, 40% LLM
            probability = Math.round(probability * 0.6 + llmProb * 0.4);
          }
        } catch {
          // Use composite only
        }
      }

      return {
        success: true,
        probability,
        factors: {
          signalStrength: Math.round(signalStrength),
          capabilityFit: Math.round(capabilityFit),
          evidenceStrength: Math.round(evidenceStrength),
          timingScore: Math.round(timingScore),
          competitivePosition: Math.round(competitivePosition),
        },
        reasoning,
        recommendation,
        error: null,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[capability-engine] calculateWinProbability failed: ${msg}`);
      return {
        success: false,
        probability: 0,
        factors: { signalStrength: 0, capabilityFit: 0, evidenceStrength: 0, timingScore: 0, competitivePosition: 0 },
        reasoning: '',
        recommendation: '',
        error: msg,
      };
    }
  },

  // ─── 5. FULL INTELLIGENCE PIPELINE ───────────────────────────────────

  /**
   * Run the complete intelligence pipeline for a company:
   *   1. Enrich (if needed)
   *   2. Signal Detection (via intelligence-pipeline)
   *   3. Signal → Capability Matching
   *   4. Opportunity Generation
   *   5. Win Probability
   *
   * This is what fires when a new company is imported or enrichment runs.
   */
  async runFullPipeline(companyId: string): Promise<{
    success: boolean;
    signalsMatched: number;
    opportunitiesGenerated: number;
    winProbability: number;
    error: string | null;
  }> {
    try {
      // Step 1: Get all signals for this company
      const signals = await db.companySignal.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
      });

      if (signals.length === 0) {
        return {
          success: true,
          signalsMatched: 0,
          opportunitiesGenerated: 0,
          winProbability: 0,
          error: 'No signals to match — run intelligence enrichment first',
        };
      }

      let signalsMatched = 0;
      let opportunitiesGenerated = 0;

      // Step 2: Match each signal to capabilities
      for (const signal of signals) {
        // Check if already matched
        const existingMatches = await db.signalCapabilityMatch.count({
          where: { signalId: signal.id },
        });

        if (existingMatches > 0) {
          signalsMatched++;
          continue;
        }

        const matchResult = await this.matchSignalToCapabilities(companyId, signal.id);
        if (matchResult.success && matchResult.matches.length > 0) {
          signalsMatched++;

          // Step 3: Generate opportunities from best match
          const bestMatch = matchResult.matches[0];
          if (bestMatch) {
            // Find the persisted match record
            const persistedMatch = await db.signalCapabilityMatch.findFirst({
              where: {
                signalId: signal.id,
                capabilityId: bestMatch.capabilityId,
              },
            });

            if (persistedMatch) {
              const oppResult = await this.generateOpportunity(
                companyId,
                signal.id,
                persistedMatch.id,
              );
              if (oppResult.success) {
                opportunitiesGenerated++;
              }
            }
          }
        }
      }

      // Step 4: Calculate win probability
      const winResult = await this.calculateWinProbability(companyId);

      // Step 5: Update company intelligence score if opportunities exist
      if (opportunitiesGenerated > 0) {
        const topOpp = await db.opportunityRecommendation.findFirst({
          where: { companyId },
          orderBy: { opportunityScore: 'desc' },
        });

        const currentCompany = await db.company.findUnique({ where: { id: companyId } });
        if (topOpp && currentCompany && topOpp.opportunityScore > currentCompany.intelligenceScore) {
          await db.company.update({
            where: { id: companyId },
            data: { intelligenceScore: topOpp.opportunityScore },
          });
        }
      }

      return {
        success: true,
        signalsMatched,
        opportunitiesGenerated,
        winProbability: winResult.success ? winResult.probability : 0,
        error: null,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[capability-engine] runFullPipeline failed: ${msg}`);
      return { success: false, signalsMatched: 0, opportunitiesGenerated: 0, winProbability: 0, error: msg };
    }
  },

  // ─── 6. INTELLIGENCE GRAPH STATUS ───────────────────────────────────

  /**
   * Get the current state of the Internal Intelligence Graph.
   * How many capabilities, matches, opportunities, etc.
   */
  async getGraphStatus(): Promise<{
    totalCapabilities: number;
    capabilitiesByCategory: Record<string, number>;
    totalSignalMatches: number;
    totalOpportunities: number;
    opportunitiesByPriority: Record<string, number>;
    totalPursuits: number;
    embeddedCount: number;
    graphHealth: string;
  }> {
    try {
      const [
        totalCapabilities,
        capabilitiesByCategory,
        totalSignalMatches,
        totalOpportunities,
        opportunitiesByPriorityRaw,
        totalPursuits,
        embeddedCount,
      ] = await Promise.all([
        db.capabilityAsset.count({ where: { isActive: true } }),
        db.capabilityAsset.groupBy({
          by: ['category'],
          where: { isActive: true },
          _count: true,
        }),
        db.signalCapabilityMatch.count(),
        db.opportunityRecommendation.count(),
        db.opportunityRecommendation.groupBy({
          by: ['priority'],
          _count: true,
        }),
        db.pursuit.count(),
        db.embedding.count({ where: { entityType: 'capability_asset' } }),
      ]);

      const capabilitiesByCat: Record<string, number> = {};
      for (const group of capabilitiesByCategory) {
        capabilitiesByCat[group.category] = group._count;
      }

      const opportunitiesByPriority: Record<string, number> = {};
      for (const group of opportunitiesByPriorityRaw) {
        opportunitiesByPriority[group.priority] = group._count;
      }

      let graphHealth = 'empty';
      if (totalCapabilities >= 5 && totalSignalMatches > 0) {
        graphHealth = 'active';
      } else if (totalCapabilities >= 3) {
        graphHealth = 'partial';
      } else if (totalCapabilities > 0) {
        graphHealth = 'minimal';
      }

      return {
        totalCapabilities,
        capabilitiesByCategory: capabilitiesByCat,
        totalSignalMatches,
        totalOpportunities,
        opportunitiesByPriority,
        totalPursuits,
        embeddedCount,
        graphHealth,
      };
    } catch (err) {
      logger.error(`[capability-engine] getGraphStatus failed: ${err instanceof Error ? err.message : err}`);
      return {
        totalCapabilities: 0,
        capabilitiesByCategory: {},
        totalSignalMatches: 0,
        totalOpportunities: 0,
        opportunitiesByPriority: {},
        totalPursuits: 0,
        embeddedCount: 0,
        graphHealth: 'error',
      };
    }
  },
};
