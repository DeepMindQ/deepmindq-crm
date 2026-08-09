/**
 * EnterpriseReasoningEngine — Phase 9: Cumulative Reasoning System
 * ==============================================================
 *
 * THE CORE INTELLIGENCE DIFFERENTIATOR of DeepMindQ.
 *
 * Instead of running isolated pipeline stages, this engine builds a
 * CUMULATIVE reasoning context per company. Each step reasons on top
 * of ALL previous steps. The full context is persisted and reused.
 *
 * ARCHITECTURE:
 *   1. Build or load ReasoningContext for a company
 *   2. Execute 30 reasoning steps in dependency order
 *   3. Each step reads previous step outputs + fresh data
 *   4. Results are persisted in ReasoningStep records
 *   5. Derived outputs (win probability, actions) computed at the end
 *
 * THE 30-STEP REASONING CHAIN:
 *   Phase A — External Intelligence (Steps 1-18):
 *     1.  Company Profile Analysis
 *     2.  Industry Context & Trends
 *     3.  Market Position Assessment
 *     4.  Technology Landscape Mapping
 *     5.  Existing Vendor Ecosystem
 *     6.  Digital Maturity Evaluation
 *     7.  Funding & Financial Health
 *     8.  Growth Trajectory Analysis
 *     9.  Risk Signal Detection
 *     10. Leadership & Org Structure
 *     11. Buying Committee Mapping
 *     12. Key Decision Maker Profiling
 *     13. Strategic Initiative Identification
 *     14. Pain Area & Business Problem Analysis
 *     15. Business Problem Prioritization
 *     16. Signal Intelligence Synthesis
 *     17. Signal Meaning & Buying Stage
 *     18. Opportunity Window Assessment
 *
 *   Phase B — Internal Intelligence Fusion (Steps 19-24):
 *     19. Capability Matching (services, solutions, accelerators)
 *     20. Case Study Matching (similar engagements, outcomes)
 *     21. Accelerator & IP Matching
 *     22. Delivery Experience Matching
 *     23. Pricing & Commercial Alignment
 *     24. Proposal Component Assembly
 *
 *   Phase C — Strategy & Action (Steps 25-30):
 *     25. Win Probability Computation
 *     26. Competitive Position Analysis
 *     27. Objection Preparation
 *     28. Conversation Strategy Design
 *     29. Next Best Action Recommendation
 *     30. Engagement Plan Generation
 *
 * COST OPTIMIZATION:
 *   - Steps 1-3: Use stored research card (no AI if data exists)
 *   - Steps 4-6: Use stored tech landscape (no AI if data exists)
 *   - Steps 7-9: Use stored signals (no AI if recent signals exist)
 *   - Steps 10-12: Use stored key people (no AI if data exists)
 *   - Steps 16-18: Require AI (always fresh analysis)
 *   - Steps 19-24: Use RetrievalEngine (no AI call needed)
 *   - Steps 25-30: Require AI (synthesis needs LLM)
 *   Total AI calls: 6-10 (down from 20+ in the old pipeline)
 *
 * NON-THROWING CONTRACT:
 *   Returns ReasoningResult with success:boolean.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { governedAICall } from '@/lib/ai-governance';
import { RetrievalEngine } from '@/lib/engines/retrieval-engine';
import { GroundingEngine } from '@/lib/engines/grounding-engine';
import {
  getReasoningStrategy,
  shouldSkipStep,
  assessReasoningGaps,
  type ReasoningStrategy,
  type ReasoningPath,
} from '@/lib/reasoning-strategy-router';
import { classifyCompany } from '@/lib/company-size-profiles';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ReasoningResult {
  success: boolean;
  reasoningContextId: string | null;
  companyId: string;
  totalSteps: number;
  completedSteps: number;
  skippedSteps: number;
  failedSteps: number;
  totalAIcalls: number;
  totalTokensUsed: number;
  totalCostUsd: number;
  durationMs: number;
  overallConfidence: number;
  winProbability: number | null;
  error: string | null;
  /** Phase 1: Adaptive reasoning metadata */
  segment?: string;
  path?: ReasoningPath;
  adaptiveEnabled?: boolean;
  reasoningGaps?: string[];
}

interface StepDefinition {
  stepNumber: number;
  stepName: string;
  stepGroup: 'external_intel' | 'internal_match' | 'fusion' | 'strategy';
  dependsOn: number[];
  requiresAI: boolean;
  description: string;
}

// ─── Step Definitions ──────────────────────────────────────────────────

const REASONING_STEPS: StepDefinition[] = [
  // Phase A: External Intelligence
  { stepNumber: 1, stepName: 'company_profile', stepGroup: 'external_intel', dependsOn: [], requiresAI: false, description: 'Analyze company profile, industry, size, location' },
  { stepNumber: 2, stepName: 'industry_context', stepGroup: 'external_intel', dependsOn: [1], requiresAI: false, description: 'Map industry context, trends, regulations' },
  { stepNumber: 3, stepName: 'market_position', stepGroup: 'external_intel', dependsOn: [1, 2], requiresAI: false, description: 'Assess market position, competitive standing' },
  { stepNumber: 4, stepName: 'technology_landscape', stepGroup: 'external_intel', dependsOn: [1], requiresAI: false, description: 'Map technology stack, cloud, data, AI platforms' },
  { stepNumber: 5, stepName: 'vendor_ecosystem', stepGroup: 'external_intel', dependsOn: [4], requiresAI: false, description: 'Identify existing vendors, partnerships, integrations' },
  { stepNumber: 6, stepName: 'digital_maturity', stepGroup: 'external_intel', dependsOn: [4, 5], requiresAI: false, description: 'Evaluate digital transformation maturity' },
  { stepNumber: 7, stepName: 'financial_health', stepGroup: 'external_intel', dependsOn: [1], requiresAI: false, description: 'Assess funding, revenue, financial signals' },
  { stepNumber: 8, stepName: 'growth_trajectory', stepGroup: 'external_intel', dependsOn: [7], requiresAI: true, description: 'Analyze growth trajectory, hiring, expansion patterns' },
  { stepNumber: 9, stepName: 'risk_signals', stepGroup: 'external_intel', dependsOn: [7, 8], requiresAI: false, description: 'Detect risk signals: budget cuts, layoffs, vendor issues' },
  { stepNumber: 10, stepName: 'leadership_org', stepGroup: 'external_intel', dependsOn: [1], requiresAI: false, description: 'Map leadership team, org structure, reporting lines' },
  { stepNumber: 11, stepName: 'buying_committee', stepGroup: 'external_intel', dependsOn: [10], requiresAI: true, description: 'Map buying committee: champions, influencers, blockers, decision makers' },
  { stepNumber: 12, stepName: 'decision_makers', stepGroup: 'external_intel', dependsOn: [10, 11], requiresAI: false, description: 'Profile key decision makers: priorities, pain points, communication style' },
  { stepNumber: 13, stepName: 'strategic_initiatives', stepGroup: 'external_intel', dependsOn: [2, 4, 6], requiresAI: true, description: 'Identify strategic initiatives from signals, news, tech investments' },
  { stepNumber: 14, stepName: 'pain_areas', stepGroup: 'external_intel', dependsOn: [3, 5, 13], requiresAI: true, description: 'Analyze pain areas and business problems from signals + tech gaps' },
  { stepNumber: 15, stepName: 'problem_prioritization', stepGroup: 'external_intel', dependsOn: [14], requiresAI: false, description: 'Prioritize business problems by urgency, impact, budget alignment' },
  { stepNumber: 16, stepName: 'signal_synthesis', stepGroup: 'external_intel', dependsOn: [7, 8, 9, 13], requiresAI: true, description: 'Synthesize all signals into coherent intelligence picture' },
  { stepNumber: 17, stepName: 'signal_meaning', stepGroup: 'external_intel', dependsOn: [16], requiresAI: true, description: 'Interpret signal meaning: buying stage, timing, budget signals' },
  { stepNumber: 18, stepName: 'opportunity_windows', stepGroup: 'external_intel', dependsOn: [15, 17], requiresAI: true, description: 'Identify opportunity windows: timing, budget, decision timeline' },

  // Phase B: Internal Intelligence Fusion
  { stepNumber: 19, stepName: 'capability_match', stepGroup: 'internal_match', dependsOn: [14, 15], requiresAI: false, description: 'Match company problems to our services, solutions, accelerators' },
  { stepNumber: 20, stepName: 'case_study_match', stepGroup: 'internal_match', dependsOn: [1, 2, 19], requiresAI: false, description: 'Find relevant case studies by industry, technology, problem, size' },
  { stepNumber: 21, stepName: 'accelerator_match', stepGroup: 'internal_match', dependsOn: [4, 19], requiresAI: false, description: 'Match relevant accelerators and IP to the opportunity' },
  { stepNumber: 22, stepName: 'delivery_experience', stepGroup: 'internal_match', dependsOn: [2, 19, 20], requiresAI: false, description: 'Find relevant delivery experience, SME knowledge, methodologies' },
  { stepNumber: 23, stepName: 'pricing_alignment', stepGroup: 'internal_match', dependsOn: [7, 19], requiresAI: false, description: 'Assess pricing alignment based on company size, budget, engagement type' },
  { stepNumber: 24, stepName: 'proposal_components', stepGroup: 'fusion', dependsOn: [19, 20, 21, 22, 23], requiresAI: true, description: 'Assemble proposal components: approach, team, timeline, pricing' },

  // Phase C: Strategy & Action
  { stepNumber: 25, stepName: 'win_probability', stepGroup: 'strategy', dependsOn: [18, 19, 20], requiresAI: true, description: 'Compute win probability based on signal strength + capability fit + evidence' },
  { stepNumber: 26, stepName: 'competitive_position', stepGroup: 'strategy', dependsOn: [5, 19, 25], requiresAI: true, description: 'Analyze competitive position: strengths, weaknesses, differentiation' },
  { stepNumber: 27, stepName: 'objection_prep', stepGroup: 'strategy', dependsOn: [19, 26], requiresAI: false, description: 'Prepare objection handling based on capability gaps and competitive threats' },
  { stepNumber: 28, stepName: 'conversation_strategy', stepGroup: 'strategy', dependsOn: [11, 12, 18, 24, 26], requiresAI: true, description: 'Design conversation strategy: messaging, angles, value props per persona' },
  { stepNumber: 29, stepName: 'next_best_action', stepGroup: 'strategy', dependsOn: [25, 26, 28], requiresAI: true, description: 'Recommend next best action with priority, timing, and rationale' },
  { stepNumber: 30, stepName: 'engagement_plan', stepGroup: 'strategy', dependsOn: [28, 29], requiresAI: true, description: 'Generate full engagement plan: sequence, touchpoints, milestones' },
];

// ─── Contrarian Reasoning (Phase 2: Item 1.7) ─────────────────────────────

const ENABLE_CONTRARIAN = process.env.ENABLE_CONTRARIAN_REASONING === 'true';

/** Steps that get a contrarian re-analysis for enterprise companies */
const CONTRARIAN_STEPS = [8, 13, 14, 16, 17, 18];

/** System prompt for contrarian reasoning — actively challenges primary analysis */
const CONTRARIAN_SYSTEM_PROMPT = `You are a contrarian analyst. Your job is to CHALLENGE and QUESTION the primary analysis.

Given the same data, provide the BEAR CASE:
- What evidence contradicts the primary conclusions?
- What risks is the primary analysis ignoring or downplaying?
- What alternative explanations exist for the observed signals?
- Why might the buying window be CLOSED rather than open?
- What could make this company a BAD FIT?

Be specific and evidence-based. Do NOT be contrarian for its own sake — only challenge
conclusions that have credible contradictory evidence.

Output format: Same JSON structure as the primary analysis, but with contrarian perspectives.`;

// ─── Cache Helpers ──────────────────────────────────────────────────────

async function getOrCreateContext(companyId: string) {
  return db.reasoningContext.upsert({
    where: { companyId },
    create: {
      companyId,
      status: 'building',
      reasoningState: '{}',
    },
    update: {
      status: 'building',
    },
  });
}

async function hashContext(text: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return text.slice(0, 64);
  }
}

// ─── Step Executors ────────────────────────────────────────────────────

/**
 * Execute a single reasoning step. Steps that don't require AI
 * gather data from DB. Steps requiring AI call ModelRouter.
 */
async function executeStep(
  companyId: string,
  step: StepDefinition,
  contextId: string,
  previousSteps: Map<number, { output: string; confidence: number }>,
  options?: { tier?: 'deep' | 'smart' | 'fast'; maxTokens?: number; customSystemPrompt?: string },
): Promise<{ output: string; summary: string; confidence: number; evidenceIds: string[]; knowledgeIds: string[]; aiCalls: number; tokensUsed: number; costUsd: number; durationMs: number }> {

  const started = Date.now();
  const defaults = { output: '{}', summary: '', confidence: 0.5, evidenceIds: [] as string[], knowledgeIds: [] as string[], aiCalls: 0, tokensUsed: 0, costUsd: 0, durationMs: 0 };
  const tier = options?.tier || 'smart';
  const maxTokens = options?.maxTokens || 2048;
  const customSystemPrompt = options?.customSystemPrompt;

  try {
    // Build context from previous steps
    const priorContext: Record<string, unknown> = {};
    for (const [stepNum, stepData] of previousSteps) {
      if (step.dependsOn.includes(stepNum)) {
        try {
          priorContext[`step_${stepNum}`] = JSON.parse(stepData.output);
        } catch {
          priorContext[`step_${stepNum}`] = stepData.output;
        }
      }
    }

    switch (step.stepName) {
      // ─── Data-Only Steps (no AI) ────────────────────────────────
      case 'company_profile': {
        const company = await db.company.findUnique({ where: { id: companyId }, include: { researchCard: true } });
        if (!company) return { ...defaults, confidence: 0 };
        const output = {
          name: company.normalizedName,
          domain: company.domain,
          industry: company.industry,
          sizeRange: company.sizeRange,
          location: company.location,
          country: company.country,
          website: company.website,
          status: company.status,
          lifecycleStage: company.lifecycleStage,
          internalSummary: company.internalSummary || company.researchCard?.businessOverview || null,
          researchCard: company.researchCard ? {
            revenue: company.researchCard.revenue,
            employeeCount: company.researchCard.employeeCount,
            fundingStage: company.researchCard.fundingStage,
            techStack: company.researchCard.techStack,
            industry: company.researchCard.industry,
          } : null,
        };
        return { output: JSON.stringify(output), summary: `${company.normalizedName} — ${company.industry || 'Unknown industry'}, ${company.sizeRange || 'Unknown size'}`, confidence: company.industry ? 0.8 : 0.4, evidenceIds: [], knowledgeIds: [], aiCalls: 0, tokensUsed: 0, costUsd: 0, durationMs: Date.now() - started };
      }

      case 'technology_landscape': {
        const rc = await db.companyResearchCard.findUnique({ where: { companyId } });
        if (!rc) return { ...defaults, summary: 'No technology data available', confidence: 0.2 };
        let techLandscape: unknown = {};
        try { techLandscape = JSON.parse(rc.structuredTechLandscape as string || '{}'); } catch { /* empty */ }
        const output = { structuredTechLandscape: techLandscape, techStack: rc.techStack };
        return { output: JSON.stringify(output), summary: `Tech landscape: ${rc.techStack ? 'data available' : 'no data'}`, confidence: rc.techStack ? 0.7 : 0.3, evidenceIds: [], knowledgeIds: [], aiCalls: 0, tokensUsed: 0, costUsd: 0, durationMs: Date.now() - started };
      }

      case 'vendor_ecosystem': {
        const evidence = await db.evidence.findMany({ where: { companyId, extractedField: { contains: 'vendor' } }, take: 10 });
        const output = { vendors: evidence.map(e => ({ value: e.extractedValue, source: e.sourceUrl, confidence: e.confidence })) };
        return { output: JSON.stringify(output), summary: `${evidence.length} vendor references found`, confidence: Math.min(0.8, evidence.length * 0.15 + 0.2), evidenceIds: evidence.map(e => e.id), knowledgeIds: [], aiCalls: 0, tokensUsed: 0, costUsd: 0, durationMs: Date.now() - started };
      }

      case 'financial_health': {
        const rc = await db.companyResearchCard.findUnique({ where: { companyId } });
        if (!rc) return { ...defaults, summary: 'No financial data', confidence: 0.2 };
        const output = { revenue: rc.revenue, fundingStage: rc.fundingStage, employeeCount: rc.employeeCount };
        return { output: JSON.stringify(output), summary: `Financial: ${rc.revenue || 'unknown revenue'}, ${rc.fundingStage || 'unknown stage'}`, confidence: rc.revenue ? 0.7 : 0.4, evidenceIds: [], knowledgeIds: [], aiCalls: 0, tokensUsed: 0, costUsd: 0, durationMs: Date.now() - started };
      }

      case 'risk_signals': {
        const signals = await db.companySignal.findMany({ where: { companyId, impact: { in: ['low', 'medium'] }, status: { not: 'archived' } }, take: 20, orderBy: { createdAt: 'desc' } });
        const riskSignals = signals.filter(s => s.severity === 'high' || s.severity === 'critical' || s.meaningCategory !== 'budget_available');
        const output = { totalSignals: signals.length, riskSignals: riskSignals.map(s => ({ type: s.signalType, title: s.title, severity: s.severity, meaning: s.meaningCategory })) };
        return { output: JSON.stringify(output), summary: `${riskSignals.length} risk signals from ${signals.length} total`, confidence: signals.length > 0 ? 0.6 : 0.3, evidenceIds: signals.map(s => s.id), knowledgeIds: [], aiCalls: 0, tokensUsed: 0, costUsd: 0, durationMs: Date.now() - started };
      }

      case 'leadership_org': {
        const rc = await db.companyResearchCard.findUnique({ where: { companyId } });
        let keyPeople: unknown[] = [];
        if (rc) { try { keyPeople = JSON.parse(rc.keyPeople as string || '[]'); } catch { /* empty */ } }
        const contacts = await db.contact.findMany({ where: { companyId }, take: 20, orderBy: { leadScore: 'desc' } });
        const output = { keyPeople, contacts: contacts.map(c => ({ name: c.normalizedName, title: c.title, role: c.role, email: c.email, leadScore: c.leadScore })) };
        return { output: JSON.stringify(output), summary: `${keyPeople.length} key people, ${contacts.length} contacts`, confidence: keyPeople.length > 0 ? 0.7 : 0.3, evidenceIds: [], knowledgeIds: [], aiCalls: 0, tokensUsed: 0, costUsd: 0, durationMs: Date.now() - started };
      }

      case 'decision_makers': {
        const contacts = await db.contact.findMany({ where: { companyId }, orderBy: { leadScore: 'desc' }, take: 10 });
        const output = { decisionMakers: contacts.filter(c => c.leadScore >= 50).map(c => ({ name: c.normalizedName, title: c.title, role: c.role, leadScore: c.leadScore, aiScore: c.aiConversionScore })) };
        return { output: JSON.stringify(output), summary: `${output.decisionMakers.length} potential decision makers identified`, confidence: output.decisionMakers.length > 0 ? 0.6 : 0.2, evidenceIds: [], knowledgeIds: [], aiCalls: 0, tokensUsed: 0, costUsd: 0, durationMs: Date.now() - started };
      }

      case 'problem_prioritization': {
        const painStep = previousSteps.get(14);
        if (!painStep) return { ...defaults, summary: 'No pain areas to prioritize', confidence: 0.2 };
        try {
          const painData = JSON.parse(painStep.output);
          const problems = Array.isArray(painData.problems) ? painData.problems : [];
          const sorted = problems.sort((a: { urgency: number }, b: { urgency: number }) => (b.urgency || 0) - (a.urgency || 0));
          return { output: JSON.stringify({ prioritizedProblems: sorted }), summary: `${sorted.length} problems prioritized`, confidence: 0.6, evidenceIds: [], knowledgeIds: [], aiCalls: 0, tokensUsed: 0, costUsd: 0, durationMs: Date.now() - started };
        } catch { return { ...defaults, summary: 'Failed to parse pain data', confidence: 0.2 }; }
      }

      // ─── Capability Match (RetrievalEngine, no AI) ─────────────
      case 'capability_match': {
        const painStep = previousSteps.get(14);
        const problemStep = previousSteps.get(15);
        const painText = painStep ? painStep.output : '';
        const problemText = problemStep ? problemStep.output : '';
        const query = `${painText} ${problemText}`;
        const results = await RetrievalEngine.search(query, 15, { type: 'capability_asset' });
        const capabilities = results.filter(r => r.score > 0.3);
        return {
          output: JSON.stringify({ matchedCapabilities: capabilities.map(c => ({ id: c.entityId, score: c.score, snippet: c.snippet })) }),
          summary: `${capabilities.length} capabilities matched (from ${results.length} searched)`,
          confidence: capabilities.length > 0 ? Math.min(0.9, capabilities[0].score + 0.2) : 0.2,
          evidenceIds: [],
          knowledgeIds: capabilities.map(c => c.entityId),
          aiCalls: 0, tokensUsed: 0, costUsd: 0, durationMs: Date.now() - started,
        };
      }

      case 'case_study_match': {
        const profileStep = previousSteps.get(1);
        const capStep = previousSteps.get(19);
        const industry = profileStep ? (() => { try { return JSON.parse(profileStep.output).industry || ''; } catch { return ''; } })() : '';
        const query = `case study ${industry} success outcome`;
        const results = await RetrievalEngine.search(query, 10, { type: 'capability_asset' });
        const caseStudies = results.filter(r => r.score > 0.25);
        return {
          output: JSON.stringify({ matchedCaseStudies: caseStudies.map(c => ({ id: c.entityId, score: c.score, snippet: c.snippet })) }),
          summary: `${caseStudies.length} relevant case studies found`,
          confidence: caseStudies.length > 0 ? Math.min(0.85, caseStudies[0].score + 0.15) : 0.2,
          evidenceIds: [],
          knowledgeIds: caseStudies.map(c => c.entityId),
          aiCalls: 0, tokensUsed: 0, costUsd: 0, durationMs: Date.now() - started,
        };
      }

      case 'accelerator_match': {
        const techStep = previousSteps.get(4);
        const techText = techStep ? techStep.output : '';
        const query = `accelerator framework IP ${techText}`;
        const results = await RetrievalEngine.search(query, 10, { type: 'capability_asset' });
        const accelerators = results.filter(r => r.score > 0.2);
        return {
          output: JSON.stringify({ matchedAccelerators: accelerators.map(a => ({ id: a.entityId, score: a.score, snippet: a.snippet })) }),
          summary: `${accelerators.length} accelerators matched`,
          confidence: accelerators.length > 0 ? 0.7 : 0.2,
          evidenceIds: [],
          knowledgeIds: accelerators.map(a => a.entityId),
          aiCalls: 0, tokensUsed: 0, costUsd: 0, durationMs: Date.now() - started,
        };
      }

      case 'delivery_experience': {
        const industryStep = previousSteps.get(2);
        const industryText = industryStep ? industryStep.output : '';
        const query = `delivery experience methodology ${industryText}`;
        const results = await RetrievalEngine.search(query, 8, { type: 'capability_asset' });
        const delivery = results.filter(r => r.score > 0.2);
        return {
          output: JSON.stringify({ deliveryExperience: delivery.map(d => ({ id: d.entityId, score: d.score, snippet: d.snippet })) }),
          summary: `${delivery.length} delivery experience references found`,
          confidence: delivery.length > 0 ? 0.65 : 0.2,
          evidenceIds: [],
          knowledgeIds: delivery.map(d => d.entityId),
          aiCalls: 0, tokensUsed: 0, costUsd: 0, durationMs: Date.now() - started,
        };
      }

      case 'pricing_alignment': {
        const finStep = previousSteps.get(7);
        const capStep = previousSteps.get(19);
        const query = 'pricing strategy commercial model engagement pricing';
        const results = await RetrievalEngine.search(query, 5, { type: 'capability_asset' });
        const pricing = results.filter(r => r.score > 0.2);
        return {
          output: JSON.stringify({ pricingReferences: pricing.map(p => ({ id: p.entityId, score: p.score, snippet: p.snippet })), financialContext: finStep ? finStep.output : null }),
          summary: `${pricing.length} pricing references found`,
          confidence: pricing.length > 0 ? 0.5 : 0.2,
          evidenceIds: [],
          knowledgeIds: pricing.map(p => p.entityId),
          aiCalls: 0, tokensUsed: 0, costUsd: 0, durationMs: Date.now() - started,
        };
      }

      case 'objection_prep': {
        const capStep = previousSteps.get(19);
        const compStep = previousSteps.get(26);
        const query = 'objection response handling competitive concern';
        const results = await RetrievalEngine.search(query, 8, { type: 'capability_asset' });
        const objections = results.filter(r => r.score > 0.2);
        return {
          output: JSON.stringify({ objectionResponses: objections.map(o => ({ id: o.entityId, score: o.score, snippet: o.snippet })) }),
          summary: `${objections.length} objection responses available`,
          confidence: objections.length > 0 ? 0.7 : 0.3,
          evidenceIds: [],
          knowledgeIds: objections.map(o => o.entityId),
          aiCalls: 0, tokensUsed: 0, costUsd: 0, durationMs: Date.now() - started,
        };
      }

      // ─── AI-Powered Steps ────────────────────────────────────────
      default: {
        if (!step.requiresAI) {
          return { ...defaults, summary: `Step ${step.stepName} has no data-source executor`, confidence: 0.1 };
        }

        // AI-powered step — use custom system prompt if provided (e.g., contrarian pass)
        const systemPrompt = customSystemPrompt || `You are a senior enterprise sales intelligence analyst. Analyze the company data provided and produce a structured JSON output for the "${step.stepName}" step. Focus on actionable intelligence that helps a sales team engage this prospect. Output ONLY valid JSON.`;
        const govResult = await governedAICall({
          generationType: `reasoning_${step.stepName}`,
          companyId,
          systemPrompt,
          userPrompt: `Step: ${step.stepName}\nDescription: ${step.description}\n\nPrevious reasoning context:\n${JSON.stringify(priorContext, null, 2)}\n\nAnalyze this data and produce your structured assessment.`,
          tier,
          maxTokens,
          temperature: customSystemPrompt ? 0.6 : 0.4,
          enforceGovernance: false,
        });

        if (!govResult.success) {
          return { ...defaults, summary: `AI call failed for ${step.stepName}`, confidence: 0.1 };
        }

        // Try to parse as JSON, fall back to raw text
        const responseText = govResult.response ?? '';
        let output = responseText;
        let summary = responseText.slice(0, 200);
        try {
          const parsed = JSON.parse(responseText);
          output = JSON.stringify(parsed);
          summary = parsed.summary || parsed.conclusion || responseText.slice(0, 200);
        } catch {
          // Not JSON — store as raw text in output
        }

        return {
          output,
          summary,
          confidence: 0.7, // AI-generated, moderate confidence
          evidenceIds: [],
          knowledgeIds: [],
          aiCalls: 1,
          tokensUsed: 0,
          costUsd: 0,
          durationMs: Date.now() - started,
        };
      }
    }
  } catch (err) {
    logger.error(`[reasoning-engine] step ${step.stepName} failed: ${err instanceof Error ? err.message : err}`);
    return { ...defaults, summary: `Failed: ${err instanceof Error ? err.message : 'unknown error'}`, confidence: 0.1, durationMs: Date.now() - started };
  }
}

// ─── Contrarian Pass (Phase 2) ────────────────────────────────────────────

/**
 * Run a contrarian reasoning pass for enterprise companies.
 * Re-runs key AI-powered steps with a contrarian prompt that challenges
 * the primary analysis conclusions.
 *
 * Returns contrarian step outputs indexed by step number.
 * Non-throwing: returns empty map on failure.
 */
async function runContrarianPass(
  companyId: string,
  contextId: string,
  primarySteps: Map<number, { output: string; confidence: number }>,
  segment: string,
): Promise<Map<number, { output: string; summary: string; confidence: number; evidenceIds: string[]; knowledgeIds: string[]; aiCalls: number; tokensUsed: number; costUsd: number; durationMs: number }>> {
  if (!ENABLE_CONTRARIAN || segment !== 'enterprise') {
    return new Map();
  }

  logger.info(`[enterprise-reasoning] Running contrarian pass for company ${companyId}`);

  const contrarianSteps = new Map<number, { output: string; summary: string; confidence: number; evidenceIds: string[]; knowledgeIds: string[]; aiCalls: number; tokensUsed: number; costUsd: number; durationMs: number }>();

  for (const stepNum of CONTRARIAN_STEPS) {
    const stepDef = REASONING_STEPS.find(s => s.stepNumber === stepNum);
    if (!stepDef || !stepDef.requiresAI) continue;

    const primaryOutput = primarySteps.get(stepNum);
    if (!primaryOutput) continue;

    try {
      const contrarianResult = await executeStep(
        companyId,
        stepDef,
        contextId,
        primarySteps,
        { tier: 'fast', maxTokens: 1024, customSystemPrompt: CONTRARIAN_SYSTEM_PROMPT },
      );

      // Parse and mark as contrarian output
      const contrarianOutput = {
        ...JSON.parse(contrarianResult.output),
        _contrarian: true,
        _challenges: [
          'Primary analysis may be overly optimistic',
          'Consider bear case scenarios',
          'Check for ignored risk signals',
        ],
      };

      contrarianSteps.set(stepNum, {
        ...contrarianResult,
        output: JSON.stringify(contrarianOutput),
        summary: `[CONTRARIAN] ${contrarianResult.summary}`,
        confidence: Math.max(0.1, contrarianResult.confidence * 0.85), // Slightly lower confidence for contrarian
      });

      // Persist contrarian step to DB
      try {
        await db.reasoningStep.upsert({
          where: {
            reasoningContextId_stepNumber: {
              reasoningContextId: contextId,
              stepNumber: stepNum + 100, // Offset by 100 to avoid collision (108, 113, etc.)
            },
          },
          create: {
            reasoningContextId: contextId,
            stepNumber: stepNum + 100,
            stepName: `contrarian_${stepDef.stepName}`,
            stepGroup: 'external_intel',
            output: JSON.stringify(contrarianOutput),
            summary: `[CONTRARIAN] ${contrarianResult.summary}`,
            confidence: contrarianResult.confidence * 0.85,
            aiCalls: contrarianResult.aiCalls,
            tokensUsed: contrarianResult.tokensUsed,
            costUsd: contrarianResult.costUsd,
            durationMs: contrarianResult.durationMs,
            depth: 'quick',
            pathId: 'contrarian',
            reasoningGaps: [],
          },
          update: {
            output: JSON.stringify(contrarianOutput),
            summary: `[CONTRARIAN] ${contrarianResult.summary}`,
            confidence: contrarianResult.confidence * 0.85,
            aiCalls: contrarianResult.aiCalls,
            tokensUsed: contrarianResult.tokensUsed,
            costUsd: contrarianResult.costUsd,
            durationMs: contrarianResult.durationMs,
            pathId: 'contrarian',
          },
        });
      } catch (dbErr) {
        logger.warn(`[enterprise-reasoning] Failed to persist contrarian step ${stepNum}: ${dbErr instanceof Error ? dbErr.message : dbErr}`);
      }
    } catch (err) {
      logger.warn(`[enterprise-reasoning] Contrarian step ${stepNum} failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  logger.info(`[enterprise-reasoning] Contrarian pass complete: ${contrarianSteps.size} steps processed`);
  return contrarianSteps;
}

/**
 * Compare primary and contrarian path outputs to detect contradictions.
 * Returns array of reasoning gaps describing contradictions found.
 */
function comparePaths(
  primarySteps: Map<number, { output: string; confidence: number }>,
  contrarianSteps: Map<number, { output: string; confidence: number }>,
): string[] {
  const gaps: string[] = [];

  for (const stepNum of CONTRARIAN_STEPS) {
    const primary = primarySteps.get(stepNum);
    const contrarian = contrarianSteps.get(stepNum);

    if (!primary || !contrarian) continue;

    const confidenceDelta = Math.abs(primary.confidence - contrarian.confidence);
    if (confidenceDelta > 0.15) {
      const stepDef = REASONING_STEPS.find(s => s.stepNumber === stepNum);
      gaps.push(
        `Primary vs Contrarian disagreement on "${stepDef?.stepName || stepNum}": ` +
        `primary confidence=${primary.confidence.toFixed(2)}, contrarian confidence=${contrarian.confidence.toFixed(2)}, ` +
        `delta=${confidenceDelta.toFixed(2)}. Both perspectives should be reviewed.`
      );
    }
  }

  return gaps;
}

// ─── EnterpriseReasoningEngine ────────────────────────────────────────

export const EnterpriseReasoningEngine = {
  /**
   * Build (or rebuild) the full reasoning context for a company.
   * Non-throwing — returns ReasoningResult.
   */
  async build(companyId: string, strategyInput?: { employeeCount?: number | null; revenue?: number | null; companyType?: string | null; }): Promise<ReasoningResult> {
    const overallStarted = Date.now();
    logger.info(`[reasoning-engine] building reasoning context for company=${companyId}`);

    try {
      // Phase 1: Resolve adaptive reasoning strategy
      let strategy: ReasoningStrategy | null = null;
      let companyDataForStrategy: { employeeCount?: number | null; fundingData?: boolean; contactData?: boolean; technologyData?: boolean; signalData?: boolean; vendorData?: boolean; evidenceCount: number } = { evidenceCount: 0 };

      try {
        // Get company data for strategy resolution
        const company = await db.company.findUnique({ where: { id: companyId }, include: { researchCard: true } });
        const employeeCount = company?.researchCard?.employeeCount != null ? Number(company.researchCard.employeeCount) : (strategyInput?.employeeCount ?? null);
        const revenue = company?.researchCard?.revenue != null ? Number(company.researchCard.revenue) : (strategyInput?.revenue ?? null);

        // Check data availability for dynamic step skipping
        const [signalCount, contactCount, evidenceCount] = await Promise.all([
          db.companySignal.count({ where: { companyId, status: { not: 'archived' } } }),
          db.contact.count({ where: { companyId } }),
          db.evidence.count({ where: { companyId } }),
        ]);

        companyDataForStrategy = {
          employeeCount,
          fundingData: !!company?.researchCard?.fundingStage,
          contactData: contactCount > 0,
          technologyData: !!company?.researchCard?.techStack,
          signalData: signalCount > 0,
          vendorData: evidenceCount > 0,
          evidenceCount,
        };

        // Detect early signals for path selection (steps 1-3 equivalent)
        const highSeveritySignals = await db.companySignal.count({
          where: { companyId, severity: { in: ['high', 'critical'] }, status: { not: 'archived' } },
        });
        const growthSignals = await db.companySignal.count({
          where: { companyId, signalType: { in: ['funding', 'hiring', 'expansion'] }, status: { not: 'archived' } },
        });
        const distressSignals = await db.companySignal.count({
          where: { companyId, meaningCategory: 'unknown', status: { not: 'archived' } },
        });

        strategy = getReasoningStrategy({
          companyId,
          employeeCount,
          revenue,
          companyType: company?.sizeRange || strategyInput?.companyType || null,
          earlySignals: {
            detectedGrowthSignals: growthSignals >= 2,
            detectedDistressSignals: distressSignals >= 2 || highSeveritySignals >= 3,
            detectedExpansionSignals: signalCount >= 5,
            signalCount,
          },
        });

        logger.info(
          `[reasoning-engine] Adaptive strategy: segment=${strategy.segment}, path=${strategy.path}, ` +
          `active=${strategy.activeSteps.length}, skipped=${strategy.skippedSteps.length}`
        );
      } catch (err) {
        logger.warn(`[reasoning-engine] Strategy resolution failed (non-fatal): ${err instanceof Error ? err.message : err}`);
      }

      // Get or create context
      const context = await getOrCreateContext(companyId);

      // Check if recently built (skip if less than 6 hours old)
      if (context.status === 'ready' && context.builtAt) {
        const ageMs = Date.now() - context.builtAt.getTime();
        if (ageMs < 6 * 60 * 60 * 1000) {
          logger.info(`[reasoning-engine] context is fresh (${Math.round(ageMs / 60000)}min old), skipping rebuild`);
          return {
            success: true,
            reasoningContextId: context.id,
            companyId,
            totalSteps: REASONING_STEPS.length,
            completedSteps: context.totalSteps,
            skippedSteps: 0,
            failedSteps: 0,
            totalAIcalls: context.totalAIcalls,
            totalTokensUsed: context.totalTokensUsed,
            totalCostUsd: context.totalCostUsd,
            durationMs: 0,
            overallConfidence: context.overallConfidence,
            winProbability: context.winProbability,
            error: null,
          };
        }
      }

      // Clear existing steps
      await db.reasoningStep.deleteMany({ where: { reasoningContextId: context.id } });

      // Execute steps in dependency order (with adaptive strategy)
      const completedSteps: Map<number, { output: string; confidence: number }> = new Map();
      let totalAIcalls = 0;
      let totalTokensUsed = 0;
      let totalCostUsd = 0;
      let completedCount = 0;
      let skippedCount = 0;
      let failedCount = 0;
      const allReasoningGaps: string[] = [];

      for (const step of REASONING_STEPS) {
        // Phase 1: Check if strategy says to skip this step
        if (strategy) {
          const dynamicSkip = shouldSkipStep(step.stepNumber, strategy, {
            hasCompanyData: true, // We already have company data if we got here
            hasFundingData: companyDataForStrategy.fundingData || false,
            hasContactData: companyDataForStrategy.contactData || false,
            hasTechnologyData: companyDataForStrategy.technologyData || false,
            hasSignalData: companyDataForStrategy.signalData || false,
            hasVendorData: companyDataForStrategy.vendorData || false,
            evidenceCount: companyDataForStrategy.evidenceCount || 0,
          });

          if (dynamicSkip.skip) {
            logger.info(
              `[reasoning-engine] step ${step.stepNumber} (${step.stepName}) skipped — ${dynamicSkip.reason || 'strategy'}`
            );

            // Persist the skipped step
            await db.reasoningStep.create({
              data: {
                reasoningContextId: context.id,
                stepNumber: step.stepNumber,
                stepName: step.stepName,
                stepGroup: step.stepGroup,
                output: '{}',
                summary: `Skipped: ${dynamicSkip.reason || 'segment strategy'}`,
                evidenceIds: '[]',
                knowledgeIds: '[]',
                confidence: 0,
                dependsOnSteps: JSON.stringify(step.dependsOn),
                depth: 'skip',
                skippedReason: dynamicSkip.reason || 'Segment strategy skip',
                reasoningGaps: JSON.stringify(allReasoningGaps),
              },
            });

            skippedCount++;
            continue;
          }
        }

        // Check dependencies
        const depsMet = step.dependsOn.every(dep => completedSteps.has(dep));
        if (!depsMet) {
          logger.info(`[reasoning-engine] step ${step.stepNumber} (${step.stepName}) skipped — dependencies not met`);
          skippedCount++;
          continue;
        }

        // Phase 1: Assess reasoning gaps from low-confidence prior steps
        const prevConfidences = Array.from(completedSteps.entries()).map(([num, data]) => {
          const stepDef = REASONING_STEPS.find(s => s.stepNumber === num);
          return { step: num, confidence: data.confidence, name: stepDef?.stepName || `step_${num}` };
        });
        const stepGaps = assessReasoningGaps(step.stepNumber, prevConfidences);
        if (stepGaps.length > 0) {
          allReasoningGaps.push(...stepGaps);
        }

        // Determine depth and tier from strategy
        const stepConfig = strategy?.stepConfigs.find(c => c.stepNumber === step.stepNumber);
        const depth = stepConfig?.depth || 'standard';
        const tier = (stepConfig?.tier as 'deep' | 'smart' | 'fast') || (step.requiresAI ? 'smart' : 'fast');
        const maxTokens = stepConfig?.maxTokens || (step.requiresAI ? 2048 : 500);

        // Execute step
        const result = await executeStep(companyId, step, context.id, completedSteps, { tier, maxTokens });

        // G5 FIX: Apply confidence dampening when reasoning gaps exist
        // If this step depends on prior steps with low confidence, reduce this step's
        // confidence proportionally to prevent low-confidence data from poisoning downstream.
        let adjustedConfidence = result.confidence;
        if (stepGaps.length > 0 && result.confidence > 0) {
          const gapCount = stepGaps.length;
          const totalDeps = step.dependsOn.length || 1;
          const gapRatio = Math.min(gapCount / totalDeps, 1);
          // Dampen by up to 30% based on how many dependencies have low confidence
          const dampeningFactor = 1 - (gapRatio * 0.3);
          adjustedConfidence = Math.round(result.confidence * dampeningFactor * 1000) / 1000;
          if (adjustedConfidence !== result.confidence) {
            logger.debug(`[reasoning-engine] Step ${step.stepNumber} confidence dampened: ${result.confidence} → ${adjustedConfidence} due to ${gapCount} reasoning gaps`);
          }
        }

        // Persist step (with Phase 1 adaptive fields + G5 confidence dampening)
        await db.reasoningStep.create({
          data: {
            reasoningContextId: context.id,
            stepNumber: step.stepNumber,
            stepName: step.stepName,
            stepGroup: step.stepGroup,
            output: result.output,
            summary: result.summary,
            evidenceIds: JSON.stringify(result.evidenceIds),
            knowledgeIds: JSON.stringify(result.knowledgeIds),
            confidence: adjustedConfidence,
            aiCalls: result.aiCalls,
            tokensUsed: result.tokensUsed,
            costUsd: result.costUsd,
            durationMs: result.durationMs,
            dependsOnSteps: JSON.stringify(step.dependsOn),
            depth,
            pathId: strategy?.path || null,
            reasoningGaps: JSON.stringify(stepGaps),
          },
        });

        if (adjustedConfidence > 0.15) {
          completedSteps.set(step.stepNumber, { output: result.output, confidence: adjustedConfidence });
          completedCount++;
        } else {
          failedCount++;
        }

        totalAIcalls += result.aiCalls;
        totalTokensUsed += result.tokensUsed;
        totalCostUsd += result.costUsd;

        logger.info(`[reasoning-engine] step ${step.stepNumber}/${REASONING_STEPS.length} ${step.stepName}: confidence=${result.confidence.toFixed(2)}, ai=${result.aiCalls}, tokens=${result.tokensUsed}`);
      }

      // Compute overall confidence (weighted average of completed steps)
      const confidences = Array.from(completedSteps.values()).map(s => s.confidence);
      let overallConfidence = confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;

      // ── G5 FIX: Reduce overall confidence based on accumulated reasoning gaps ──
      // reasoningGaps represent steps where dependency confidence was too low,
      // skipped steps, or failed steps — all of which degrade result reliability.
      // Penalty: up to 15% reduction proportional to gap-to-step ratio.
      if (allReasoningGaps.length > 0 && overallConfidence > 0) {
        const gapRatio = Math.min(allReasoningGaps.length / REASONING_STEPS.length, 1);
        const gapPenalty = gapRatio * 0.15; // max 15% penalty
        overallConfidence = Math.max(0.05, overallConfidence * (1 - gapPenalty));
        logger.info(`[enterprise-reasoning] Overall confidence reduced by ${(gapPenalty * 100).toFixed(1)}% due to ${allReasoningGaps.length} reasoning gaps: ${overallConfidence.toFixed(3)}`);
      }

      // ── Phase 2: Contrarian Pass for Enterprise Companies ──
      let contrarianGaps: string[] = [];
      if (ENABLE_CONTRARIAN && strategy?.segment === 'enterprise') {
        try {
          const contrarianSteps = await runContrarianPass(companyId, context.id, completedSteps, strategy.segment);
          const gaps = comparePaths(completedSteps, contrarianSteps);
          contrarianGaps = gaps;
          
          if (gaps.length > 0) {
            logger.info(`[enterprise-reasoning] Contrarian analysis found ${gaps.length} contradictions for ${companyId}`);
            // Adjust overall confidence downward based on contradiction severity
            const avgConfidenceDelta = gaps.length * 0.03; // 3% penalty per contradiction
            overallConfidence = Math.max(0.1, overallConfidence - avgConfidenceDelta);
          }
          
          totalAIcalls += Array.from(contrarianSteps.values()).reduce((sum, s) => sum + s.aiCalls, 0);
          totalTokensUsed += Array.from(contrarianSteps.values()).reduce((sum, s) => sum + s.tokensUsed, 0);
          totalCostUsd += Array.from(contrarianSteps.values()).reduce((sum, s) => sum + s.costUsd, 0);
        } catch (err) {
          logger.warn(`[enterprise-reasoning] Contrarian pass failed (non-blocking): ${err instanceof Error ? err.message : err}`);
        }
      }

      // Extract win probability from step 25 if available
      const winStep = completedSteps.get(25);
      let winProbability: number | null = null;
      if (winStep) {
        try {
          const parsed = JSON.parse(winStep.output);
          winProbability = typeof parsed.winProbability === 'number' ? parsed.winProbability : overallConfidence;
        } catch {
          winProbability = overallConfidence;
        }
      }

      // Extract matched capabilities
      const capStep = completedSteps.get(19);
      const matchedCapabilities = capStep ? capStep.output : '[]';

      // Extract matched case studies
      const csStep = completedSteps.get(20);
      const matchedCaseStudies = csStep ? csStep.output : '[]';

      // Update context
      const now = new Date();
      const staleAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await db.reasoningContext.update({
        where: { id: context.id },
        data: {
          status: completedCount >= 20 ? 'ready' : 'partial',
          reasoningState: JSON.stringify(Object.fromEntries(completedSteps)),
          overallConfidence,
          winProbability,
          totalSteps: completedCount,
          totalAIcalls,
          totalTokensUsed,
          totalCostUsd,
          buildDurationMs: Date.now() - overallStarted,
          matchedCapabilities,
          matchedCaseStudies,
          builtAt: now,
          staleAt,
          lastRebuiltAt: now,
        },
      });

      logger.info(`[reasoning-engine] build complete: ${completedCount}/${REASONING_STEPS.length} steps, confidence=${overallConfidence.toFixed(2)}, ai_calls=${totalAIcalls}, cost=$${totalCostUsd.toFixed(4)}, duration=${Date.now() - overallStarted}ms`);

      return {
        success: true,
        reasoningContextId: context.id,
        companyId,
        totalSteps: REASONING_STEPS.length,
        completedSteps: completedCount,
        skippedSteps: skippedCount,
        failedSteps: failedCount,
        totalAIcalls,
        totalTokensUsed,
        totalCostUsd,
        durationMs: Date.now() - overallStarted,
        overallConfidence,
        winProbability,
        error: null,
        segment: strategy?.segment,
        path: strategy?.path,
        adaptiveEnabled: strategy?.adaptiveEnabled,
        reasoningGaps: [...allReasoningGaps, ...contrarianGaps].length > 0 ? [...allReasoningGaps, ...contrarianGaps] : undefined,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[reasoning-engine] build failed for company=${companyId}: ${msg}`);

      // Mark context as failed
      try {
        await db.reasoningContext.update({
          where: { companyId },
          data: { status: 'failed' },
        });
      } catch { /* ignore */ }

      return {
        success: false,
        reasoningContextId: null,
        companyId,
        totalSteps: REASONING_STEPS.length,
        completedSteps: 0,
        skippedSteps: 0,
        failedSteps: REASONING_STEPS.length,
        totalAIcalls: 0,
        totalTokensUsed: 0,
        totalCostUsd: 0,
        durationMs: Date.now() - overallStarted,
        overallConfidence: 0,
        winProbability: null,
        error: msg,
      };
    }
  },

  /**
   * Get the current reasoning context for a company (no rebuild).
   */
  async getContext(companyId: string) {
    try {
      const ctx = await db.reasoningContext.findUnique({
        where: { companyId },
        include: { steps: { orderBy: { stepNumber: 'asc' } } },
      });
      return ctx || null;
    } catch (err) {
      logger.error(`[reasoning-engine] getContext failed: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  },

  /**
   * Get reasoning status across all companies.
   */
  async getStatus() {
    try {
      const total = await db.reasoningContext.count();
      const ready = await db.reasoningContext.count({ where: { status: 'ready' } });
      const building = await db.reasoningContext.count({ where: { status: 'building' } });
      const stale = await db.reasoningContext.count({ where: { status: 'stale' } });
      const empty = await db.reasoningContext.count({ where: { status: 'empty' } });
      const failed = await db.reasoningContext.count({ where: { status: 'failed' } });
      const totalCompanies = await db.company.count();
      return {
        totalCompanies,
        contextBuilt: total,
        ready, building, stale, empty, failed,
        coverage: totalCompanies > 0 ? Math.round((total / totalCompanies) * 100) : 0,
      };
    } catch (err) {
      logger.error(`[reasoning-engine] getStatus failed: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  },
};
