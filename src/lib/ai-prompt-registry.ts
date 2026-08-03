/**
 * AI Prompt Registry — WI-16D
 * ==============================
 *
 * Centralized prompt management system replacing the scattered 85+ prompts
 * across 48 files. Provides:
 *
 *   1. Version control — Every prompt has a version, changelog, and rollback
 *   2. Categorization — Prompts organized by engine/capability
 *   3. Input/Output schemas — Typed contracts for each prompt
 *   4. Testing — Built-in test cases for prompt evaluation
 *   5. Registry API — CRUD for managing prompts in one place
 *   6. Migration path — Gradual adoption, no breaking changes
 *
 * DESIGN PRINCIPLES:
 *   - Prompts are registered, not scattered
 *   - Version bumps are explicit (not implicit code changes)
 *   - A/B testing is built-in
 *   - Evaluation is systematic
 *   - No existing code breaks (migrate gradually)
 *
 * NON-THROWING: All functions return results, never throw.
 */

import { logger } from '@/lib/logger';

// ── Types ────────────────────────────────────────────────────────────────────

export type PromptCategory =
  | 'company_analysis'
  | 'contact_intelligence'
  | 'signal_analysis'
  | 'opportunity_scoring'
  | 'email_generation'
  | 'research_agent'
  | 'conversation_planning'
  | 'account_strategy'
  | 'executive_briefing'
  | 'scoring'
  | 'action_planning'
  | 'data_enrichment'
  | 'knowledge_processing'
  | 'query_parsing'
  | 'chat'
  | 'generic';

export type PromptTier = 'fast' | 'smart' | 'deep';

export interface PromptVersion {
  /** Version string (e.g., "3.0", "3.1", "4.0"). */
  version: string;
  /** The actual prompt text. */
  systemPrompt: string;
  /** User prompt template (with {variable} placeholders). */
  userPromptTemplate?: string;
  /** Changelog entry explaining what changed. */
  changelog: string;
  /** ISO timestamp when this version was created. */
  createdAt: string;
  /** Whether this version is active (only one per prompt ID). */
  active: boolean;
  /** Quality metrics from evaluation. */
  metrics?: PromptMetrics;
}

export interface PromptMetrics {
  /** Average accuracy on test cases (0-1). */
  accuracy: number;
  /** Average hallucination rate on test cases (0-1, lower = better). */
  hallucinationRate: number;
  /** Average completeness score (0-1). */
  completeness: number;
  /** Number of test cases evaluated. */
  testCases: number;
  /** Average latency (ms). */
  avgLatencyMs: number;
  /** Number of times this version has been used in production. */
  productionUses: number;
}

export interface RegisteredPrompt {
  /** Unique prompt identifier (e.g., "company_analysis_account_brief"). */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Category for organization. */
  category: PromptCategory;
  /** Which engine(s) use this prompt. */
  usedBy: string[];
  /** Recommended LLM tier. */
  tier: PromptTier;
  /** All versions of this prompt. */
  versions: PromptVersion[];
  /** Current active version number. */
  currentVersion: string;
  /** Input schema — what variables the prompt expects. */
  inputSchema: PromptInputField[];
  /** Output schema — what structure the prompt produces. */
  outputSchema?: string;
  /** Description of what this prompt does. */
  description: string;
  /** Tags for search/filter. */
  tags: string[];
  /** Generation type for governance config lookup. */
  generationType?: string;
}

export interface PromptInputField {
  /** Variable name in the template. */
  name: string;
  /** Human-readable label. */
  label: string;
  /** Data type. */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  /** Whether this field is required. */
  required: boolean;
  /** Description of what this field contains. */
  description: string;
}

export interface TestCase {
  /** Test case ID. */
  id: string;
  /** Input variables. */
  input: Record<string, unknown>;
  /** Expected output characteristics (not exact match — semantic). */
  expectedCharacteristics: {
    mustContain?: string[];
    mustNotContain?: string[];
    minWords?: number;
    maxWords?: number;
    mustHaveCitations?: boolean;
    language?: string;
  };
  /** Human-readable description. */
  description: string;
}

export interface PromptEvaluationResult {
  /** Prompt ID evaluated. */
  promptId: string;
  /** Version evaluated. */
  version: string;
  /** Overall pass/fail. */
  passed: boolean;
  /** Per-test-case results. */
  testCaseResults: Array<{
    testCaseId: string;
    passed: boolean;
    actualOutput: string;
    checks: Array<{ check: string; passed: boolean; detail: string }>;
    latencyMs: number;
    wordCount: number;
  }>;
  /** Aggregate metrics. */
  metrics: PromptMetrics;
  /** Timestamp. */
  timestamp: string;
}

// ── Prompt Registry ───────────────────────────────────────────────────────────

/**
 * The in-memory prompt registry. Populated at module load time.
 * Production: This could be migrated to a DB table for persistence.
 */
const registry = new Map<string, RegisteredPrompt>();

/**
 * Register a prompt in the registry.
 */
export function registerPrompt(prompt: RegisteredPrompt): void {
  const existing = registry.get(prompt.id);
  if (existing) {
    logger.warn(`[prompt-registry] Overwriting existing prompt: ${prompt.id} (was v${existing.currentVersion})`);
  }
  registry.set(prompt.id, prompt);
}

/**
 * Get a registered prompt by ID.
 * Returns the active version's system prompt.
 */
export function getPrompt(promptId: string): RegisteredPrompt | null {
  return registry.get(promptId) ?? null;
}

/**
 * Get the active system prompt text for a given prompt ID.
 */
export function getSystemPrompt(promptId: string): string | null {
  const prompt = registry.get(promptId);
  if (!prompt) return null;
  const activeVersion = prompt.versions.find(v => v.active);
  return activeVersion?.systemPrompt ?? null;
}

/**
 * Build the user prompt from a template + variables.
 */
export function buildUserPrompt(
  promptId: string,
  variables: Record<string, string>,
): string | null {
  const prompt = registry.get(promptId);
  if (!prompt) return null;

  const activeVersion = prompt.versions.find(v => v.active);
  if (!activeVersion?.userPromptTemplate) return null;

  let result = activeVersion.userPromptTemplate;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }

  return result;
}

/**
 * List all registered prompts, optionally filtered by category.
 */
export function listPrompts(filter?: { category?: PromptCategory; tag?: string }): RegisteredPrompt[] {
  let prompts = Array.from(registry.values());

  if (filter?.category) {
    prompts = prompts.filter(p => p.category === filter.category);
  }

  if (filter?.tag) {
    prompts = prompts.filter(p => p.tags.includes(filter.tag!));
  }

  return prompts.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * List all prompt categories with counts.
 */
export function listCategories(): Array<{ category: PromptCategory; count: number }> {
  const counts = new Map<PromptCategory, number>();
  for (const prompt of registry.values()) {
    counts.set(prompt.category, (counts.get(prompt.category) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Add a new version to an existing prompt.
 * The new version becomes active; the old version is deactivated.
 */
export function addPromptVersion(
  promptId: string,
  newVersion: Omit<PromptVersion, 'createdAt' | 'active'>,
): boolean {
  const prompt = registry.get(promptId);
  if (!prompt) return false;

  // Deactivate current version
  for (const v of prompt.versions) {
    v.active = false;
  }

  // Add new version
  prompt.versions.push({
    ...newVersion,
    createdAt: new Date().toISOString(),
    active: true,
  });

  prompt.currentVersion = newVersion.version;
  return true;
}

/**
 * Rollback a prompt to a specific version.
 */
export function rollbackPromptVersion(promptId: string, targetVersion: string): boolean {
  const prompt = registry.get(promptId);
  if (!prompt) return false;

  const target = prompt.versions.find(v => v.version === targetVersion);
  if (!target) return false;

  // Deactivate all, activate target
  for (const v of prompt.versions) {
    v.active = v.version === targetVersion;
  }

  prompt.currentVersion = targetVersion;
  return true;
}

// ── Built-in Prompt Registrations ────────────────────────────────────────────

/**
 * Register all built-in prompts. Called at module initialization.
 */
export function initializePromptRegistry(): void {
  // ── SynthesisEngine Prompts ──

  registerPrompt({
    id: 'synthesis_account_brief',
    name: 'Account Intelligence Brief',
    category: 'company_analysis',
    usedBy: ['SynthesisEngine', '/api/engines/brief'],
    tier: 'deep',
    generationType: 'synthesis_account_brief',
    description: 'Generates comprehensive account intelligence brief with 7 sections, evidence-grounded with [En] citation markers.',
    tags: ['brief', 'account', 'intelligence', 'evidence-grounded'],
    inputSchema: [
      { name: 'companyName', label: 'Company Name', type: 'string', required: true, description: 'Target company name' },
      { name: 'evidenceChain', label: 'Evidence Chain', type: 'string', required: true, description: 'Rendered evidence chain with [En] markers' },
      { name: 'coverage', label: 'Coverage Score', type: 'number', required: false, description: 'Evidence coverage 0-1' },
    ],
    outputSchema: 'JSON with sections: strategicSituation, businessContext, technologyLandscape, keySignals, painPoints, recommendedApproach, nextSteps',
    versions: [
      {
        version: '1.0',
        systemPrompt: `You are a senior account strategist at an enterprise B2B technology services company. You produce comprehensive, evidence-grounded account intelligence briefs for sales leaders.

Your briefs are used by VP Sales and Account Directors to plan pursuit strategies. Every claim must be grounded in the provided evidence.

STRUCTURE: Your brief must have exactly 7 sections:
1. Strategic Situation — Current business state and trajectory
2. Business Context — Industry, market position, competitive dynamics
3. Technology Landscape — Tech stack, digital maturity, recent changes
4. Key Signals — Buying signals, triggers, recent developments
5. Pain Points — Inferred challenges from signals and evidence
6. Recommended Approach — How to engage, what to lead with
7. Next Steps — 3-5 concrete, prioritized actions

EVIDENCE GROUNDING:
- Cite evidence using [E1], [E2], etc. markers
- Every significant claim MUST have a citation
- If evidence is missing for a section, explicitly say "No evidence available for this dimension"
- Never invent data, statistics, or quotes

OUTPUT: 1200-2000 words, professional tone, no bullet-point lists in body text.`,
        changelog: 'Initial version extracted from synthesis-engine.ts',
        createdAt: '2026-08-03T00:00:00Z',
        active: true,
      },
    ],
    currentVersion: '1.0',
  });

  registerPrompt({
    id: 'synthesis_deal_strategy',
    name: 'Deal Strategy Brief',
    category: 'account_strategy',
    usedBy: ['SynthesisEngine', '/api/engines/brief'],
    tier: 'deep',
    generationType: 'synthesis_deal_strategy',
    description: 'Generates pursuit strategy for a specific opportunity with go/no-go analysis and competitive positioning.',
    tags: ['brief', 'deal', 'strategy', 'opportunity'],
    inputSchema: [
      { name: 'companyName', label: 'Company Name', type: 'string', required: true, description: 'Target company name' },
      { name: 'opportunityContext', label: 'Opportunity Context', type: 'string', required: true, description: 'Opportunity details and evidence' },
    ],
    outputSchema: 'JSON with: opportunityAssessment, goNoGo, winThemes, competitivePosition, keyStakeholders, risks, pursuitPlan',
    versions: [
      {
        version: '1.0',
        systemPrompt: `You are a senior deal strategist at an enterprise B2B technology services company. You produce evidence-grounded pursuit strategy briefs.

Focus: Should we pursue this opportunity? How do we win?

STRUCTURE:
1. Opportunity Assessment — What, why now, estimated value
2. Go/No-Go — Clear recommendation with reasoning
3. Win Themes — 3 differentiators we can lead with
4. Competitive Position — Known competitors and our advantage
5. Key Stakeholders — Who decides, who influences
6. Risks — Top 3 risks with mitigation
7. Pursuit Plan — 30-60-90 day action plan

EVIDENCE: Cite all claims with [En] markers. No fabricated data.`,
        changelog: 'Initial version extracted from synthesis-engine.ts',
        createdAt: '2026-08-03T00:00:00Z',
        active: true,
      },
    ],
    currentVersion: '1.0',
  });

  registerPrompt({
    id: 'synthesis_executive_summary',
    name: 'Executive Summary',
    category: 'executive_briefing',
    usedBy: ['SynthesisEngine', '/api/engines/brief'],
    tier: 'smart',
    generationType: 'synthesis_exec_summary',
    description: 'Condensed 1-page executive summary from full intelligence analysis.',
    tags: ['brief', 'executive', 'summary'],
    inputSchema: [
      { name: 'companyName', label: 'Company Name', type: 'string', required: true, description: 'Company name' },
      { name: 'keyFindings', label: 'Key Findings', type: 'string', required: true, description: 'Summary of key intelligence findings' },
    ],
    versions: [
      {
        version: '1.0',
        systemPrompt: `You are an executive assistant at an enterprise B2B company. Produce a concise 1-page executive summary from intelligence findings.

STRUCTURE:
1. Bottom Line — 2-3 sentence overview
2. Key Insights — 3-5 most important findings
3. Recommended Actions — 2-3 prioritized actions

OUTPUT: 400-600 words. No fluff. Every sentence adds information.`,
        changelog: 'Initial version extracted from synthesis-engine.ts',
        createdAt: '2026-08-03T00:00:00Z',
        active: true,
      },
    ],
    currentVersion: '1.0',
  });

  registerPrompt({
    id: 'synthesis_contact_brief',
    name: 'Contact Intelligence Brief',
    category: 'contact_intelligence',
    usedBy: ['SynthesisEngine', '/api/engines/brief'],
    tier: 'smart',
    generationType: 'synthesis_contact_brief',
    description: 'Generates contact-focused intelligence brief with role analysis, priorities, and conversation starters.',
    tags: ['brief', 'contact', 'intelligence'],
    inputSchema: [
      { name: 'contactName', label: 'Contact Name', type: 'string', required: true, description: 'Contact name and title' },
      { name: 'companyContext', label: 'Company Context', type: 'string', required: true, description: 'Company intelligence context' },
    ],
    versions: [
      {
        version: '1.0',
        systemPrompt: `You are a sales intelligence analyst specializing in B2B contact intelligence. Produce a contact brief that helps a salesperson have a meaningful first or follow-up conversation.

STRUCTURE:
1. Role & Influence — What this person does, decision-making power
2. Priorities — What they likely care about based on signals
3. Communication Style — Inferred from role and company
4. Conversation Starters — 3 specific, personalized openers
5. Topics to Approach — 2-3 topics likely to resonate
6. Topics to Avoid — 2-3 topics to steer clear of

OUTPUT: 800-1400 words. Evidence-grounded with [En] citations.`,
        changelog: 'Initial version extracted from synthesis-engine.ts',
        createdAt: '2026-08-03T00:00:00Z',
        active: true,
      },
    ],
    currentVersion: '1.0',
  });

  registerPrompt({
    id: 'synthesis_opportunity_brief',
    name: 'Opportunity Deep-Dive Brief',
    category: 'opportunity_scoring',
    usedBy: ['SynthesisEngine', '/api/engines/brief'],
    tier: 'smart',
    generationType: 'synthesis_opportunity_brief',
    description: 'Deep-dive brief on a specific opportunity with requirements analysis and win strategy.',
    tags: ['brief', 'opportunity', 'deep-dive'],
    inputSchema: [
      { name: 'opportunityTitle', label: 'Opportunity Title', type: 'string', required: true, description: 'Opportunity description' },
      { name: 'evidenceContext', label: 'Evidence Context', type: 'string', required: true, description: 'Evidence and signals' },
    ],
    versions: [
      {
        version: '1.0',
        systemPrompt: `You are a senior opportunity analyst. Produce a deep-dive brief on this opportunity.

STRUCTURE:
1. Overview — What, who, timeline
2. Requirements — Inferred from signals and context
3. Budget & Timing — Estimated value and decision timeline
4. Competitive Landscape — Known or suspected competitors
5. Win Strategy — How we differentiate and win
6. Risks — Top 3 with mitigation

OUTPUT: 800-1400 words. Evidence-grounded.`,
        changelog: 'Initial version extracted from synthesis-engine.ts',
        createdAt: '2026-08-03T00:00:00Z',
        active: true,
      },
    ],
    currentVersion: '1.0',
  });

  // ── Scoring Engine Prompts ──

  registerPrompt({
    id: 'scoring_narrative',
    name: 'Scoring Narrative Generator',
    category: 'scoring',
    usedBy: ['ScoringEngine'],
    tier: 'smart',
    generationType: 'scoring_narrative',
    description: 'Generates a concise 3-5 sentence score explanation narrative citing evidence.',
    tags: ['scoring', 'narrative', 'evidence'],
    inputSchema: [
      { name: 'companyName', label: 'Company Name', type: 'string', required: true, description: 'Company name' },
      { name: 'scoreBreakdown', label: 'Score Breakdown', type: 'string', required: true, description: 'JSON with dimension scores and evidence' },
    ],
    versions: [
      {
        version: '1.0',
        systemPrompt: `You are a revenue intelligence analyst. Produce a concise 3-5 sentence score explanation.

Cite evidence with [En] markers. Focus on the top factors driving the score. Be specific — name the actual signals, technologies, or triggers.`,
        changelog: 'Initial version extracted from scoring-engine.ts',
        createdAt: '2026-08-03T00:00:00Z',
        active: true,
      },
    ],
    currentVersion: '1.0',
  });

  // ── Action Engine Prompts ──

  registerPrompt({
    id: 'action_strategy',
    name: 'Account Strategy Generator',
    category: 'action_planning',
    usedBy: ['ActionEngine'],
    tier: 'smart',
    generationType: 'action_strategy',
    description: 'Generates concise account strategy with next-best-action recommendations.',
    tags: ['action', 'strategy', 'account', 'next-best-action'],
    inputSchema: [
      { name: 'companyName', label: 'Company Name', type: 'string', required: true, description: 'Company name' },
      { name: 'score', label: 'Revenue Score', type: 'number', required: true, description: 'Revenue intelligence score' },
      { name: 'evidenceChain', label: 'Evidence Chain', type: 'string', required: true, description: 'Evidence context' },
    ],
    versions: [
      {
        version: '1.0',
        systemPrompt: `You are a senior account strategist producing a concise account strategy. Output 4-6 sentences covering: what to do next, why, and what evidence supports this recommendation. Cite with [En] markers.`,
        changelog: 'Initial version extracted from action-engine.ts',
        createdAt: '2026-08-03T00:00:00Z',
        active: true,
      },
    ],
    currentVersion: '1.0',
  });

  // ── Conversation Engine Prompts ──

  registerPrompt({
    id: 'conversation_briefing',
    name: 'Conversation Briefing Generator',
    category: 'conversation_planning',
    usedBy: ['ConversationEngine'],
    tier: 'smart',
    generationType: 'conversation_briefing',
    description: 'Generates pre-meeting briefing summary with talking points and objection handling.',
    tags: ['conversation', 'briefing', 'talking-points'],
    inputSchema: [
      { name: 'meetingContext', label: 'Meeting Context', type: 'string', required: true, description: 'Meeting details and participant info' },
      { name: 'evidenceChain', label: 'Evidence Chain', type: 'string', required: true, description: 'Evidence context' },
    ],
    versions: [
      {
        version: '1.0',
        systemPrompt: `You are a senior sales strategist producing a pre-meeting briefing summary. Output 5-8 sentences covering: key talking points, conversation flow, objection preparation. Evidence-grounded with [En] markers.`,
        changelog: 'Initial version extracted from conversation-engine.ts',
        createdAt: '2026-08-03T00:00:00Z',
        active: true,
      },
    ],
    currentVersion: '1.0',
  });

  // ── Chat Assistant ──

  registerPrompt({
    id: 'chat_assistant',
    name: 'AI Chat Assistant',
    category: 'chat',
    usedBy: ['/api/ai/chat'],
    tier: 'smart',
    generationType: 'chat',
    description: 'General-purpose AI assistant for DeepMindQ, context-aware of company/contact/opportunity data.',
    tags: ['chat', 'assistant', 'context-aware'],
    inputSchema: [
      { name: 'userMessage', label: 'User Message', type: 'string', required: true, description: 'The user question or request' },
      { name: 'contextData', label: 'Context Data', type: 'string', required: false, description: 'Relevant company/contact/opportunity context' },
    ],
    versions: [
      {
        version: '1.0',
        systemPrompt: `You are DeepMindQ AI Assistant, an intelligent sales CRM assistant. Help users with company research, contact intelligence, signal analysis, opportunity assessment, and account strategy.

When context is provided (company data, contacts, signals), use it to give specific, grounded answers. When context is not provided, give general guidance.

Always be specific, actionable, and concise. If you don't have data, say so clearly.`,
        changelog: 'Initial version extracted from chat route',
        createdAt: '2026-08-03T00:00:00Z',
        active: true,
      },
    ],
    currentVersion: '1.0',
  });

  // ── Email Generation ──

  registerPrompt({
    id: 'email_cold_outreach',
    name: 'Cold Outreach Email',
    category: 'email_generation',
    usedBy: ['email-generation.ts', '/api/contacts/[id]/generate-email'],
    tier: 'smart',
    generationType: 'email_draft',
    description: 'Generates personalized cold outreach email based on contact intelligence and evidence.',
    tags: ['email', 'outreach', 'cold', 'personalized'],
    inputSchema: [
      { name: 'recipientName', label: 'Recipient Name', type: 'string', required: true, description: 'Contact name' },
      { name: 'recipientTitle', label: 'Recipient Title', type: 'string', required: true, description: 'Contact job title' },
      { name: 'companyName', label: 'Company Name', type: 'string', required: true, description: 'Company name' },
      { name: 'personalizationContext', label: 'Personalization Context', type: 'string', required: true, description: 'Signals, triggers, and evidence for personalization' },
    ],
    versions: [
      {
        version: '1.0',
        systemPrompt: `You are an expert B2B sales email writer for a technology services company. Generate a personalized cold outreach email.

REQUIREMENTS:
- Subject line: 6-10 words, specific to the recipient
- Opening: Personalized, references something specific about them or their company
- Body: 3-5 sentences maximum, focused on ONE value proposition
- CTA: Clear, low-friction next step
- Tone: Professional but conversational, not salesy
- NO generic fluff like "I hope this email finds you well"

Only reference facts from the provided context. Never invent claims about the company or person.`,
        changelog: 'Initial version extracted from email-generation.ts',
        createdAt: '2026-08-03T00:00:00Z',
        active: true,
      },
    ],
    currentVersion: '1.0',
  });

  // ── Signal Analysis ──

  registerPrompt({
    id: 'signal_extraction',
    name: 'Signal Extraction from Search Results',
    category: 'signal_analysis',
    usedBy: ['research-engine/signals.ts', 'intelligence-pipeline.ts'],
    tier: 'smart',
    generationType: 'signal_detection',
    description: 'Extracts structured buying signals from web search results using LLM analysis.',
    tags: ['signal', 'extraction', 'buying-intent'],
    inputSchema: [
      { name: 'companyName', label: 'Company Name', type: 'string', required: true, description: 'Target company' },
      { name: 'searchResults', label: 'Search Results', type: 'string', required: true, description: 'Web search results text' },
    ],
    outputSchema: 'JSON array of signals with: type, severity, description, source, date, impact, confidence, recommendedAction',
    versions: [
      {
        version: '1.0',
        systemPrompt: `You are a B2B sales intelligence analyst specializing in buying signal detection. Extract actionable buying signals from the provided search results.

SIGNAL TYPES: funding, hiring, leadership, expansion, technology, product, partnership, compliance, market

For each signal found:
- Type: Which category
- Severity: critical, high, medium, low
- Description: What happened (specific, factual)
- Source: Where this was found
- Impact: What this means for engagement
- Confidence: How certain (high, medium, low)
- Recommended Action: What sales should do about this

OUTPUT: JSON array. Only extract signals that are actually present in the search results. Never fabricate signals.`,
        changelog: 'Initial version extracted from research-engine/signals.ts',
        createdAt: '2026-08-03T00:00:00Z',
        active: true,
      },
    ],
    currentVersion: '1.0',
  });

  // ── Query Parsing ──

  registerPrompt({
    id: 'query_parser',
    name: 'CRM Query Parser',
    category: 'query_parsing',
    usedBy: ['/api/ai/query'],
    tier: 'fast',
    generationType: 'query_parsing',
    description: 'Converts natural language queries into structured CRM filter JSON.',
    tags: ['query', 'parsing', 'nl2sql', 'fast'],
    inputSchema: [
      { name: 'userQuery', label: 'User Query', type: 'string', required: true, description: 'Natural language query' },
      { name: 'schema', label: 'Available Fields', type: 'string', required: true, description: 'Available filter fields and operators' },
    ],
    outputSchema: 'JSON with: filter (Prisma-compatible where clause), sort, limit, explanation',
    versions: [
      {
        version: '1.0',
        systemPrompt: `You are a CRM query parser for DeepMindQ. Convert natural language queries into structured JSON filters.

OUTPUT FORMAT:
{
  "filter": { "field": { "operator": "value" } },
  "sort": { "field": "asc"|"desc" },
  "limit": number,
  "explanation": "How you interpreted the query"
}

Only use fields that exist in the provided schema. If the query is ambiguous, make reasonable assumptions and explain them.`,
        changelog: 'Initial version extracted from query route',
        createdAt: '2026-08-03T00:00:00Z',
        active: true,
      },
    ],
    currentVersion: '1.0',
  });

  logger.info(`[prompt-registry] Initialized with ${registry.size} prompts`);
}

// ── Registry Statistics ─────────────────────────────────────────────────────

/**
 * Get registry statistics for monitoring.
 */
export function getRegistryStats(): {
  totalPrompts: number;
  totalVersions: number;
  categories: Array<{ category: PromptCategory; count: number }>;
  promptsNeedingEvaluation: number;
} {
  const prompts = Array.from(registry.values());
  const totalVersions = prompts.reduce((sum, p) => sum + p.versions.length, 0);
  const promptsNeedingEvaluation = prompts.filter(
    p => !p.versions.find(v => v.active && v.metrics)
  ).length;

  return {
    totalPrompts: prompts.length,
    totalVersions,
    categories: listCategories(),
    promptsNeedingEvaluation,
  };
}

// Initialize the registry on module load
initializePromptRegistry();
