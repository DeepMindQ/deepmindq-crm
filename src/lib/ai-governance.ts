/**
 * Common AI Governance Layer
 *
 * Every AI engine in DeepMindQ CRM MUST inherit from this layer before
 * producing output. It provides:
 *
 *   1. Confidence gates — per-generation-type thresholds
 *   2. Governance checks — pre-generation validation
 *   3. Hallucination prevention — mandatory LLM grounding rules
 *   4. Evidence grounding — contextual warnings injected into prompts
 *   5. Audit trail — every generation recorded in AIGenerationAudit
 *
 * Non-throwing design: governance checks return results, never throw.
 * AI routes inspect the result and decide whether to proceed or reject.
 *
 * S5 INTEGRATION:
 *   6. Prompt Registry — resolves system prompts from centralized registry (3.4)
 *   7. A/B Testing — variant assignment for running experiments (3.5)
 *   8. Unified Cost Tracking — records token/cost after every LLM call (3.6)
 */

import { db } from '@/lib/db';
import type { ResearchContext } from '@/lib/intelligence-contract';
import { AICacheLayer } from '@/lib/ai-cache-layer';
import { getSystemPrompt as getRegistrySystemPrompt, getPrompt } from '@/lib/ai-prompt-registry';
import { assignVariant as assignABVariant, getVariant as getABVariant, listExperiments as listABExperiments, type ExperimentVariant as ABExperimentVariant } from '@/lib/prompt-ab-testing';
import { recordUnifiedCost } from '@/lib/unified-ai-cost-tracking';

// ── Types ────────────────────────────────────────────────────────────────────

export interface GovernanceConfig {
  /** Minimum average field confidence to proceed (0-1). Varies by generation type. */
  minResearchConfidence: number;
  /** Minimum freshness score to proceed (0-100). */
  minFreshnessScore: number;
  /** Whether at least one capability asset must match. */
  requireCapabilityMatch: boolean;
  /** Reject if no research intelligence exists (freshness.status === 'none'). */
  requireRecentIntelligence: boolean;
  /** Reject if data is older than this many days. */
  maxStalenessDays: number;
}

export interface GovernanceCheckDetail {
  passed: boolean;
  message: string;
  value: unknown;
}

export interface GovernanceResult {
  /** True if ALL checks passed. */
  passed: boolean;
  /** Per-check breakdown for debugging and audit. */
  checks: Record<string, GovernanceCheckDetail>;
  /** Human-readable summary of the overall outcome. */
  overallMessage: string;
  /** Alias for `passed` — explicit intent signal for callers. */
  canProceed: boolean;
  /** If !canProceed, a user-facing explanation. */
  rejectionReason: string | null;
}

export interface GovernanceContext {
  companyId?: string;
  contactId?: string;
  /** Generation type key (e.g. 'email_draft', 'conversation_plan'). */
  generationType: string;
  /** Pre-loaded research context. If absent, checks will flag missing data. */
  researchContext?: ResearchContext | null;
  /** Number of capability assets that matched (if applicable). */
  capabilityMatchCount?: number;
}

// ── Confidence Gate Configurations ───────────────────────────────────────────

const GOVERNANCE_CONFIGS: Record<string, GovernanceConfig> = {
  email_draft: {
    // Phase 3 Hardening: 60% confidence threshold for emails
    minResearchConfidence: 0.6,
    minFreshnessScore: 25,
    requireCapabilityMatch: true,
    requireRecentIntelligence: true,
    maxStalenessDays: 60,
  },
  conversation_plan: {
    // Phase 3 Hardening: 60% confidence threshold for exec conversation plans
    minResearchConfidence: 0.6,
    minFreshnessScore: 25,
    requireCapabilityMatch: false,
    requireRecentIntelligence: true,
    maxStalenessDays: 60,
  },
  account_brief: {
    minResearchConfidence: 0.2,
    minFreshnessScore: 10,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 180,
  },
  signal_analysis: {
    minResearchConfidence: 0.2,
    minFreshnessScore: 10,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 365,
  },
  suggested_contacts: {
    minResearchConfidence: 0.3,
    minFreshnessScore: 15,
    requireCapabilityMatch: false,
    requireRecentIntelligence: true,
    maxStalenessDays: 90,
  },
  enrichment: {
    minResearchConfidence: 0.2,
    minFreshnessScore: 10,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 180,
  },
  insights: {
    minResearchConfidence: 0.3,
    minFreshnessScore: 15,
    requireCapabilityMatch: false,
    requireRecentIntelligence: true,
    maxStalenessDays: 120,
  },
  // Phase 3 Hardening: 50% confidence threshold for opportunity identification
  opportunities: {
    minResearchConfidence: 0.5,
    minFreshnessScore: 20,
    requireCapabilityMatch: false,
    requireRecentIntelligence: true,
    maxStalenessDays: 90,
  },
  recommendations: {
    minResearchConfidence: 0.4,
    minFreshnessScore: 15,
    requireCapabilityMatch: false,
    requireRecentIntelligence: true,
    maxStalenessDays: 120,
  },
  // Phase 3 Hardening: 50% confidence threshold for lead scoring
  score_leads: {
    minResearchConfidence: 0.5,
    minFreshnessScore: 20,
    requireCapabilityMatch: false,
    requireRecentIntelligence: true,
    maxStalenessDays: 90,
  },
  // Phase 3 Hardening: PDF report generation (reads from research card)
  pdf_report: {
    minResearchConfidence: 0.2,
    minFreshnessScore: 10,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 180,
  },
  // Intelligence API — Reasoning engine (30-step composite analysis)
  reasoning: {
    minResearchConfidence: 0.3,
    minFreshnessScore: 15,
    requireCapabilityMatch: false,
    requireRecentIntelligence: true,
    maxStalenessDays: 90,
  },
  // Intelligence API — Mindmap generation (DB-derived, no LLM)
  mindmap: {
    minResearchConfidence: 0.1,
    minFreshnessScore: 5,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 365,
  },
  // Phase 3 Hardening: PPT slide generation
  ppt_generation: {
    minResearchConfidence: 0.2,
    minFreshnessScore: 10,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 180,
  },
  // Phase 3 Hardening: CRM query parsing (non-company, advisory)
  query_parsing: {
    minResearchConfidence: 0,
    minFreshnessScore: 0,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 9999,
  },
  // Phase 3 Hardening: Company/contact summarization
  summarize: {
    minResearchConfidence: 0.2,
    minFreshnessScore: 10,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 180,
  },
  // Phase 3 Hardening: Knowledge base enrichment from URL (non-company)
  knowledge_enrichment: {
    minResearchConfidence: 0,
    minFreshnessScore: 0,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 9999,
  },
  // Phase 3 Hardening: Command center query planning (non-company)
  command_center_query: {
    minResearchConfidence: 0,
    minFreshnessScore: 0,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 9999,
  },
  // Phase 3 Hardening: Command center analysis (may or may not be company-specific)
  command_center_analysis: {
    minResearchConfidence: 0.2,
    minFreshnessScore: 10,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 180,
  },
  // Phase 3 Hardening: Research agent (person lookup path — non-company)
  research_agent_person: {
    minResearchConfidence: 0,
    minFreshnessScore: 0,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 9999,
  },
  // Phase 3 Hardening: A/B test subject line generation
  ab_test_variant: {
    minResearchConfidence: 0.3,
    minFreshnessScore: 10,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 120,
  },
  // Phase 3 Hardening: Data health analysis (aggregate, non-company)
  data_health_analysis: {
    minResearchConfidence: 0,
    minFreshnessScore: 0,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 9999,
  },
  // Phase 3 Hardening: Playbook generation (generic, non-company)
  playbook_generation: {
    minResearchConfidence: 0,
    minFreshnessScore: 0,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 9999,
  },
  // Phase 3 Hardening: Strategy room (company-specific when companyId present)
  strategy_generation: {
    minResearchConfidence: 0.2,
    minFreshnessScore: 10,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 180,
  },
  // Phase 4 A4: Chat with company context (advisory — never blocks, but provides quality signals)
  chat: {
    minResearchConfidence: 0.2,
    minFreshnessScore: 10,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 365,
  },
  // Phase 3 Hardening: Relationship memory — portfolio-wide analysis
  relationship_memory: {
    minResearchConfidence: 0,
    minFreshnessScore: 0,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 9999,
  },
  // Phase 3 Hardening: Research engine internal extraction
  research_extraction: {
    minResearchConfidence: 0,
    minFreshnessScore: 0,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 9999,
  },
  // Phase 3 Hardening: Research engine signal detection
  signal_detection: {
    minResearchConfidence: 0,
    minFreshnessScore: 0,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 9999,
  },
  // Phase 3 Hardening: Workflow email generation job
  workflow_email_generation: {
    minResearchConfidence: 0.5,
    minFreshnessScore: 20,
    requireCapabilityMatch: false,
    requireRecentIntelligence: true,
    maxStalenessDays: 90,
  },
  // Revenue intelligence — engagement wording generation
  revenue_engagement_wording: {
    minResearchConfidence: 0.2,
    minFreshnessScore: 10,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 180,
  },
  // Revenue intelligence — account brief summary
  account_brief_summary: {
    minResearchConfidence: 0.2,
    minFreshnessScore: 10,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 180,
  },
  // Revenue intelligence — account brief engagement
  account_brief_engagement: {
    minResearchConfidence: 0.2,
    minFreshnessScore: 10,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 180,
  },
  // Company research card generation
  company_research: {
    minResearchConfidence: 0.2,
    minFreshnessScore: 10,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 365,
  },
  // ── Engine-level generation types (Ticket 3 deep audit) ──────────────
  // Synthesis engine brief types (registered via synthesis_${briefType})
  synthesis_account_brief: {
    minResearchConfidence: 0.2,
    minFreshnessScore: 10,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 180,
  },
  synthesis_deal_strategy: {
    minResearchConfidence: 0.3,
    minFreshnessScore: 15,
    requireCapabilityMatch: false,
    requireRecentIntelligence: true,
    maxStalenessDays: 120,
  },
  synthesis_exec_summary: {
    minResearchConfidence: 0.2,
    minFreshnessScore: 10,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 180,
  },
  synthesis_contact_brief: {
    minResearchConfidence: 0.2,
    minFreshnessScore: 10,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 180,
  },
  synthesis_opportunity_brief: {
    minResearchConfidence: 0.3,
    minFreshnessScore: 15,
    requireCapabilityMatch: false,
    requireRecentIntelligence: true,
    maxStalenessDays: 120,
  },
  // Scoring engine
  scoring_narrative: {
    minResearchConfidence: 0.2,
    minFreshnessScore: 10,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 180,
  },
  // Action engine
  action_strategy: {
    minResearchConfidence: 0.3,
    minFreshnessScore: 15,
    requireCapabilityMatch: false,
    requireRecentIntelligence: true,
    maxStalenessDays: 120,
  },
  // Conversation engine
  conversation_briefing: {
    minResearchConfidence: 0.3,
    minFreshnessScore: 15,
    requireCapabilityMatch: false,
    requireRecentIntelligence: true,
    maxStalenessDays: 120,
  },
  // Opportunity recommendation engine
  opportunity_recommendation: {
    minResearchConfidence: 0.4,
    minFreshnessScore: 15,
    requireCapabilityMatch: false,
    requireRecentIntelligence: true,
    maxStalenessDays: 120,
  },
  // Capability intelligence engine
  capability_matching: {
    minResearchConfidence: 0.2,
    minFreshnessScore: 10,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 180,
  },
  opportunity_generation: {
    minResearchConfidence: 0.4,
    minFreshnessScore: 15,
    requireCapabilityMatch: false,
    requireRecentIntelligence: true,
    maxStalenessDays: 120,
  },
  win_probability: {
    minResearchConfidence: 0.3,
    minFreshnessScore: 15,
    requireCapabilityMatch: false,
    requireRecentIntelligence: true,
    maxStalenessDays: 120,
  },
  // Intelligence pipeline
  company_intelligence: {
    minResearchConfidence: 0.2,
    minFreshnessScore: 10,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 180,
  },
  company_enrichment: {
    minResearchConfidence: 0.2,
    minFreshnessScore: 10,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 180,
  },
  // Signal sequence engine
  sequence_generation: {
    minResearchConfidence: 0.2,
    minFreshnessScore: 10,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 180,
  },
  // Multi-agent orchestrator
  agent_scorer: {
    minResearchConfidence: 0.2,
    minFreshnessScore: 10,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 180,
  },
  agent_strategist: {
    minResearchConfidence: 0.3,
    minFreshnessScore: 15,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 180,
  },
  agent_executive_brief: {
    minResearchConfidence: 0.3,
    minFreshnessScore: 15,
    requireCapabilityMatch: false,
    requireRecentIntelligence: true,
    maxStalenessDays: 120,
  },
  // Knowledge ingestion pipeline
  knowledge_classify: {
    minResearchConfidence: 0,
    minFreshnessScore: 0,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 9999,
  },
  // Website monitoring engine
  website_change_analysis: {
    minResearchConfidence: 0.2,
    minFreshnessScore: 10,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 180,
  },
  // Competitive intelligence engine
  competitive_intel_collection: {
    minResearchConfidence: 0.2,
    minFreshnessScore: 10,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 180,
  },
  competitive_impact_analysis: {
    minResearchConfidence: 0.3,
    minFreshnessScore: 15,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 180,
  },
  // AI evidence engine
  evidence_classification: {
    minResearchConfidence: 0,
    minFreshnessScore: 0,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 9999,
  },
  // People enrichment engine
  people_enrichment: {
    minResearchConfidence: 0.2,
    minFreshnessScore: 10,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 180,
  },
  // Intelligence API route types
  full_pipeline: {
    minResearchConfidence: 0.2,
    minFreshnessScore: 10,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 180,
  },
  // Intelligence API route types (knowledge + mindmap)
  knowledge_retrieval: {
    minResearchConfidence: 0,
    minFreshnessScore: 0,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 9999,
  },
  grounding: {
    minResearchConfidence: 0.2,
    minFreshnessScore: 10,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 180,
  },
  retrieval: {
    minResearchConfidence: 0,
    minFreshnessScore: 0,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 9999,
  },
  // Enterprise reasoning engine (dynamic step names — base type)
  reasoning_default: {
    minResearchConfidence: 0.2,
    minFreshnessScore: 10,
    requireCapabilityMatch: false,
    requireRecentIntelligence: false,
    maxStalenessDays: 180,
  },
};

// Track which generation types have been registered
const REGISTERED_TYPES = new Set(Object.keys(GOVERNANCE_CONFIGS));

const DEFAULT_CONFIG: GovernanceConfig = {
  // Phase 3 Hardening: default 40% confidence, stricter than before
  minResearchConfidence: 0.4,
  minFreshnessScore: 20,
  requireCapabilityMatch: false,
  requireRecentIntelligence: true,
  maxStalenessDays: 60,
};

// ── Freshness Lifecycle Configuration ─────────────────────────────────────
// Defines how many days each intelligence type remains "fresh" before
// the system starts degrading AI behavior.

export const FRESHNESS_LIFECYCLE_DAYS = {
  profile: 90,    // Company profile intelligence: 90 day lifecycle
  signals: 14,    // Buying signals: 14 day lifecycle
  technology: 60, // Technology intelligence: 60 day lifecycle
  contacts: 45,   // Contact intelligence: 45 day lifecycle
} as const;

export type FreshnessDomain = keyof typeof FRESHNESS_LIFECYCLE_DAYS;

/**
 * Evaluate freshness for a specific domain and return a status:
 *   'fresh'    -- within lifecycle, no action needed
 *   'aging'    -- past lifecycle but within 2x, generate with warning
 *   'stale'    -- past 2x lifecycle, confidence reduction or refresh required
 */
export function evaluateDomainFreshness(
  lastRefreshedAt: Date | null | undefined,
  domain: FreshnessDomain,
): { status: 'fresh' | 'aging' | 'stale'; daysSinceRefresh: number } {
  if (!lastRefreshedAt) {
    return { status: 'stale', daysSinceRefresh: Infinity };
  }

  const daysSinceRefresh = Math.floor(
    (Date.now() - new Date(lastRefreshedAt).getTime()) / (24 * 60 * 60 * 1000),
  );

  const lifecycle = FRESHNESS_LIFECYCLE_DAYS[domain];

  if (daysSinceRefresh <= lifecycle) {
    return { status: 'fresh', daysSinceRefresh };
  } else if (daysSinceRefresh <= lifecycle * 2) {
    return { status: 'aging', daysSinceRefresh };
  } else {
    return { status: 'stale', daysSinceRefresh };
  }
}

/**
 * Build a freshness warning string to inject into LLM prompts.
 * Returns empty string if all domains are fresh.
 */
export function buildFreshnessWarning(
  researchCard: { profileFreshnessAt?: Date | null; signalFreshnessAt?: Date | null; techFreshnessAt?: Date | null; contactFreshnessAt?: Date | null } | null,
): string {
  if (!researchCard) return '';

  const warnings: string[] = [];

  const profileFreshness = evaluateDomainFreshness(researchCard.profileFreshnessAt, 'profile');
  if (profileFreshness.status === 'aging') {
    warnings.push(`Company profile intelligence is ${profileFreshness.daysSinceRefresh} days old (lifecycle: ${FRESHNESS_LIFECYCLE_DAYS.profile} days). Claims about company strategy may be outdated.`);
  } else if (profileFreshness.status === 'stale') {
    warnings.push(`Company profile intelligence is ${profileFreshness.daysSinceRefresh} days old and STALE. Reduce confidence in strategic claims. Recommend running a research refresh before generating outputs.`);
  }

  const signalFreshness = evaluateDomainFreshness(researchCard.signalFreshnessAt, 'signals');
  if (signalFreshness.status === 'aging') {
    warnings.push(`Buying signals are ${signalFreshness.daysSinceRefresh} days old. New signals may have emerged since last research.`);
  } else if (signalFreshness.status === 'stale') {
    warnings.push(`Buying signals are severely outdated (${signalFreshness.daysSinceRefresh} days). Do NOT reference signals in output -- they may no longer be relevant.`);
  }

  const techFreshness = evaluateDomainFreshness(researchCard.techFreshnessAt, 'technology');
  if (techFreshness.status === 'aging') {
    warnings.push(`Technology intelligence is ${techFreshness.daysSinceRefresh} days old. Tech stack information may be outdated.`);
  } else if (techFreshness.status === 'stale') {
    warnings.push(`Technology intelligence is severely outdated (${techFreshness.daysSinceRefresh} days). Do NOT make claims about current technology usage.`);
  }

  const contactFreshness = evaluateDomainFreshness(researchCard.contactFreshnessAt, 'contacts');
  if (contactFreshness.status === 'aging') {
    warnings.push(`Contact information is ${contactFreshness.daysSinceRefresh} days old. Contact details may have changed.`);
  } else if (contactFreshness.status === 'stale') {
    warnings.push(`Contact information is severely outdated (${contactFreshness.daysSinceRefresh} days). Do NOT assume current contact details are accurate.`);
  }

  if (warnings.length === 0) return '';

  return `\n\nFRESHNESS WARNINGS:\n${warnings.map(w => `- ${w}`).join('\n')}\n\n`;
}

// ── Hallucination Prevention Rules ───────────────────────────────────────────

/**
 * Mandatory evidence grounding rules to inject into every LLM system prompt.
 * This is the single source of truth for anti-hallucination instructions.
 */
export const HALLUCINATION_PREVENTION_RULES = `
EVIDENCE GROUNDING RULES (Mandatory):
1. Only reference facts, figures, and data points that appear in the provided intelligence context.
2. If the intelligence says "Not found" for a field, NEVER fabricate a value. Say "Data not available" instead.
3. Never extrapolate revenue, employee count, or other metrics from partial data.
4. Never claim a company uses a technology unless it appears in their tech stack or tech landscape data.
5. Never invent quotes, press releases, or announcements.
6. If intelligence is stale (>30 days), preface claims with "Based on data from [date]...".
7. Never state confidence levels higher than what the field confidence scores indicate.
8. If asked about something not in the intelligence, say "I don't have current data on that. Consider running a research refresh."
9. Never assume company strategy, transformation plans, or business priorities not explicitly stated in the intelligence.
10. Never invent technology usage, customer references, or partnership details.
11. Never mention capabilities that are not present in the provided capability library.
12. Clearly state when information is unavailable rather than guessing.
13. Reduce stated confidence when intelligence quality is low or evidence is weak.
14. Mention uncertainty explicitly when evidence is from a single source or has low confidence.
15. Never create fake business problems or pain points — only reference those derived from signals or evidence.
`.trim();

// ── Current prompt version hash (bump when rules change) ──
// Bumped whenever HALLUCINATION_PREVENTION_RULES or governance configs change.
// This is a content-hash prefix to detect drift between deployments.
export const GOVERNANCE_PROMPT_VERSION = 'v3-t3-deep-audit-complete';

// ── Public Functions ─────────────────────────────────────────────────────────

/**
 * Returns the governance configuration for a given generation type.
 * Falls back to the default config for unknown types.
 */
export function getGovernanceConfig(generationType: string): GovernanceConfig {
  const config = GOVERNANCE_CONFIGS[generationType];
  if (!config) {
    // Handle dynamic reasoning step types (e.g., reasoning_signal_analysis, reasoning_competitive_positioning)
    // These use the 'reasoning' parent config
    if (generationType.startsWith('reasoning_')) {
      const parentConfig = GOVERNANCE_CONFIGS['reasoning'];
      if (parentConfig) {
        return { ...parentConfig };
      }
    }
    // Log warning for unknown generation types — helps detect typos and missing registrations
    logger.warn(`[ai-governance] Unknown generation type: '${generationType}'. Using default config. Registered types: ${REGISTERED_TYPES.size}`);
    return { ...DEFAULT_CONFIG };
  }
  return { ...config };
}

/** Returns the set of registered generation type keys. Useful for testing and introspection. */
export function getRegisteredGenerationTypes(): ReadonlySet<string> {
  return REGISTERED_TYPES;
}

/**
 * Run all governance checks for an AI generation request.
 *
 * This function is NON-THROWING — it always returns a GovernanceResult.
 * The caller inspects `canProceed` to decide whether to generate or reject.
 *
 * Checks performed (in order):
 *   1. research_exists   — Does a research card exist?
 *   2. research_confidence — Average field confidence >= threshold?
 *   3. freshness_score   — Freshness score >= threshold?
 *   4. staleness         — Days since research <= max?
 *   5. capability_match  — At least one capability matched? (if required)
 *   6. recent_intelligence — Freshness status is not 'none'? (if required)
 */
export async function runGovernanceChecks(
  context: GovernanceContext,
): Promise<GovernanceResult> {
  const config = getGovernanceConfig(context.generationType);
  const checks: GovernanceResult['checks'] = {};
  const ctx = context.researchContext ?? null;

  // ── 1. Research exists check ──
  const researchExists = !!ctx?.researchCard?.exists;
  checks.research_exists = {
    passed: researchExists,
    message: researchExists
      ? 'Research card found.'
      : 'No research card exists for this company. Run research first.',
    value: researchExists,
  };

  // ── 2. Research confidence check ──
  if (ctx && ctx.fieldConfidence) {
    const confidenceValues = Object.values(ctx.fieldConfidence);
    const avgConfidence =
      confidenceValues.length > 0
        ? confidenceValues.reduce((sum, v) => sum + v, 0) / confidenceValues.length
        : 0;
    const passed = avgConfidence >= config.minResearchConfidence;
    checks.research_confidence = {
      passed,
      message: passed
        ? `Average field confidence ${(avgConfidence * 100).toFixed(1)}% meets threshold ${(config.minResearchConfidence * 100).toFixed(0)}%.`
        : `Average field confidence ${(avgConfidence * 100).toFixed(1)}% is below threshold ${(config.minResearchConfidence * 100).toFixed(0)}%.`,
      value: Math.round(avgConfidence * 1000) / 1000,
    };
  } else {
    // No research context available — pass if threshold is 0 (advisory types), fail otherwise
    const noDataPassed = config.minResearchConfidence === 0;
    checks.research_confidence = {
      passed: noDataPassed,
      message: noDataPassed
        ? 'No field confidence data available (threshold is 0 — advisory mode).'
        : 'No field confidence data available.',
      value: 0,
    };
  }

  // ── 3. Freshness score check ──
  if (ctx) {
    const freshnessScore = ctx.freshness?.score ?? 0;
    const passed = freshnessScore >= config.minFreshnessScore;
    checks.freshness_score = {
      passed,
      message: passed
        ? `Freshness score ${freshnessScore}/100 meets threshold ${config.minFreshnessScore}.`
        : `Freshness score ${freshnessScore}/100 is below threshold ${config.minFreshnessScore}.`,
      value: freshnessScore,
    };
  } else {
    const noDataPassed = config.minFreshnessScore === 0;
    checks.freshness_score = {
      passed: noDataPassed,
      message: noDataPassed
        ? 'No freshness data available (threshold is 0 — advisory mode).'
        : 'No freshness data available.',
      value: 0,
    };
  }

  // ── 4. Staleness check ──
  if (ctx?.freshness?.daysSinceResearch != null) {
    const daysSince = ctx.freshness.daysSinceResearch;
    const passed = daysSince <= config.maxStalenessDays;
    checks.staleness = {
      passed,
      message: passed
        ? `Research is ${daysSince} days old, within ${config.maxStalenessDays}-day limit.`
        : `Research is ${daysSince} days old, exceeds ${config.maxStalenessDays}-day limit.`,
      value: daysSince,
    };
  } else if (ctx?.freshness?.status === 'none') {
    const noDataPassed = !config.requireRecentIntelligence;
    checks.staleness = {
      passed: noDataPassed,
      message: noDataPassed
        ? 'No research has ever been run (advisory mode — staleness not required).'
        : 'No research has ever been run for this company.',
      value: null,
    };
  } else {
    // No context at all — covered by research_exists check
    const noDataPassed = !config.requireRecentIntelligence;
    checks.staleness = {
      passed: noDataPassed,
      message: noDataPassed
        ? 'Cannot determine staleness without research data (advisory mode).'
        : 'Cannot determine staleness without research data.',
      value: null,
    };
  }

  // ── 5. Capability match check (conditional) ──
  if (config.requireCapabilityMatch) {
    const matchCount = context.capabilityMatchCount ?? 0;
    const passed = matchCount > 0;
    checks.capability_match = {
      passed,
      message: passed
        ? `${matchCount} capability asset(s) matched.`
        : 'No capability assets matched. At least one is required for this generation type.',
      value: matchCount,
    };
  } else {
    checks.capability_match = {
      passed: true,
      message: 'Capability match not required for this generation type.',
      value: context.capabilityMatchCount ?? 0,
    };
  }

  // ── 6. Recent intelligence check (conditional) ──
  if (config.requireRecentIntelligence) {
    const status = ctx?.freshness?.status ?? 'none';
    const passed = status !== 'none';
    checks.recent_intelligence = {
      passed,
      message: passed
        ? `Research intelligence exists (status: ${status}).`
        : 'No research intelligence found. This generation type requires at least one research run.',
      value: status,
    };
  } else {
    checks.recent_intelligence = {
      passed: true,
      message: 'Recent intelligence not required for this generation type.',
      value: ctx?.freshness?.status ?? 'none',
    };
  }

  // ── Compute overall result ──
  const failedChecks = Object.entries(checks).filter(([, c]) => !c.passed);
  const allPassed = failedChecks.length === 0;

  const overallMessage = allPassed
    ? `All governance checks passed for ${context.generationType}.`
    : `Governance blocked ${context.generationType}: ${failedChecks.map(([, c]) => c.message).join(' ')}`;

  const rejectionReason = allPassed
    ? null
    : failedChecks.map(([, c]) => c.message).join(' ');

  return {
    passed: allPassed,
    checks,
    overallMessage,
    canProceed: allPassed,
    rejectionReason,
  };
}

/**
 * Build a warning text block to inject into LLM system prompts when
 * governance passes but with caveats (e.g. stale data, low evidence).
 *
 * Returns an empty string if all checks fully passed with no warnings.
 */
export function buildGovernancePromptAddon(result: GovernanceResult, generationType?: string): string {
  const warnings: string[] = [];

  // Use the generation type's config for marginal pass detection, fallback to email_draft
  const config = generationType ? getGovernanceConfig(generationType) : getGovernanceConfig('email_draft');
  for (const [key, check] of Object.entries(result.checks)) {
    if (check.passed) {
      // Still flag marginal passes using config-derived thresholds
      const numVal = check.value as number | null;
      if (key === 'staleness' && typeof numVal === 'number' && numVal > config.maxStalenessDays / 2) {
        warnings.push(`Research data is ${numVal} days old. Claims about recent developments may be outdated.`);
      }
      if (key === 'research_confidence' && typeof numVal === 'number' && numVal < config.minResearchConfidence) {
        warnings.push(`Signal confidence is below ${(config.minResearchConfidence * 100).toFixed(0)}%. Claims should be hedged appropriately.`);
      }
      if (key === 'freshness_score' && typeof numVal === 'number' && numVal < config.minFreshnessScore * 2) {
        warnings.push('Freshness score is low. Data may not reflect the current state of the company.');
      }
      // Flag when research exists but with minimal evidence
      if (key === 'research_exists' && typeof numVal === 'boolean' && !numVal) {
        // This check passes when not required, but still worth noting
      }
      // Flag when recent intelligence status is marginal
      if (key === 'recent_intelligence' && typeof numVal === 'string' && numVal === 'aging') {
        warnings.push('Intelligence data is aging. Some signals may be outdated.');
      }
    } else if (key === 'capability_match' && result.passed) {
      // This check can be skipped (not required) but still worth noting
      const capVal = check.value as number | null;
      if (typeof capVal === 'number' && capVal === 0) {
        warnings.push('No capability assets matched. Personalization may be generic.');
      }
    }
  }

  if (warnings.length === 0) return '';

  return `\n\nGOVERNANCE WARNINGS:\n${warnings.map((w) => `- ${w}`).join('\n')}\n\n`;
}

/**
 * Build a contextual evidence grounding note based on the research context.
 * This helps the LLM understand the quality and recency of the data it is
 * working with, reducing hallucination risk.
 */
export function buildEvidenceGroundingNote(
  ctx: ResearchContext | null | undefined,
): string {
  if (!ctx) {
    return 'No research intelligence available. All output should be flagged as low-confidence.';
  }

  const notes: string[] = [];

  // Freshness-based warnings
  if (ctx.freshness.status === 'none') {
    return 'No research has been conducted for this company. All output is speculative and should be clearly marked as such.';
  }

  if (ctx.freshness.daysSinceResearch != null) {
    if (ctx.freshness.daysSinceResearch > 90) {
      notes.push(
        `Research is ${ctx.freshness.daysSinceResearch} days old. Data may be significantly outdated. Avoid claims about recent events, leadership changes, or funding rounds.`,
      );
    } else if (ctx.freshness.daysSinceResearch > 30) {
      notes.push(
        `Research is ${ctx.freshness.daysSinceResearch} days old. Some data may be outdated. Preface time-sensitive claims appropriately.`,
      );
    }
  }

  // Evidence volume warnings
  const evidenceCount = ctx.evidenceSummary?.totalEvidence ?? 0;
  if (evidenceCount === 0) {
    notes.push('No evidence sources found. All claims should be heavily hedged.');
  } else if (evidenceCount <= 3) {
    notes.push(
      `Limited evidence (${evidenceCount} source${evidenceCount === 1 ? '' : 's'}). Claims should be hedged appropriately.`,
    );
  }

  // Signal-based warnings
  if (ctx.signals.length === 0 && ctx.freshness.signalCount === 0) {
    notes.push('No buying signals detected. Do not fabricate or imply buying intent.');
  }

  // Field confidence warning for low-confidence fields
  if (ctx.fieldConfidence) {
    const lowConfidenceFields = Object.entries(ctx.fieldConfidence)
      .filter(([, v]) => v < 0.4)
      .map(([k]) => k);

    if (lowConfidenceFields.length > 0) {
      notes.push(
        `Low confidence fields: ${lowConfidenceFields.join(', ')}. Do not present these as established facts.`,
      );
    }
  }

  if (notes.length === 0) {
    return `Research data available: ${evidenceCount} evidence sources, ${ctx.freshness.score}/100 freshness. Claims should be grounded in the provided intelligence.`;
  }

  return `EVIDENCE GROUNDING NOTES:\n${notes.map((n) => `- ${n}`).join('\n')}`;
}

// ── Record Generation (Audit Trail) ──────────────────────────────────────────

interface RecordGenerationParams {
  generationType: string;
  companyId?: string;
  contactId?: string;
  researchContext?: ResearchContext | null;
  evidenceIds?: string[];
  signalIds?: string[];
  capabilityAssetIds?: string[];
  governanceResult: GovernanceResult;
  outputSummary?: string;
  inputParams?: Record<string, unknown>;
  /** Actual model used — populated from ModelRouter.complete() result (B8 fix) */
  modelUsed?: string;
}

/**
 * Record an AI generation in the AIGenerationAudit table.
 *
 * Every AI route MUST call this after generating output (or after rejecting
 * due to governance failure). This provides full traceability:
 *   - What was generated and for whom
 *   - What intelligence data was available
 *   - Whether governance passed and which checks failed
 *   - What evidence/signals were used as grounding
 *
 * This function is fire-and-forget: errors are logged but never thrown.
 */
export async function recordGeneration(
  params: RecordGenerationParams,
): Promise<void> {
  const {
    generationType,
    companyId,
    contactId,
    researchContext,
    evidenceIds,
    signalIds,
    capabilityAssetIds,
    governanceResult,
    outputSummary,
    inputParams,
    modelUsed,
  } = params;

  // Calculate research confidence and freshness for the audit record
  let researchConfidence = 0;
  let freshnessScore = 0;

  if (researchContext?.fieldConfidence) {
    const values = Object.values<number>(researchContext.fieldConfidence);
    if (values.length > 0) {
      researchConfidence =
        Math.round(
          (values.reduce((sum, v) => sum + v, 0) / values.length) * 1000,
        ) / 1000;
    }
  }

  if (researchContext?.freshness) {
    freshnessScore = researchContext.freshness.score;
  }

  try {
    await db.aIGenerationAudit.create({
      data: {
        generationType,
        companyId: companyId ?? null,
        contactId: contactId ?? null,
        researchContextVersion: researchContext?.researchCard?.enrichedAt ?? null,
        evidenceIdsUsed: JSON.stringify(evidenceIds ?? []),
        signalIdsUsed: JSON.stringify(signalIds ?? []),
        capabilityAssetIdsUsed: JSON.stringify(capabilityAssetIds ?? []),
        researchConfidence,
        freshnessScore,
        governancePassed: governanceResult.passed,
        governanceChecks: JSON.stringify(governanceResult.checks),
        outputSummary: outputSummary ?? null,
        modelUsed: modelUsed ?? 'governance-tracked',
        promptVersion: GOVERNANCE_PROMPT_VERSION,
        inputParams: JSON.stringify(inputParams ?? {}),
      },
    });
  } catch (error) {
    // Never throw — audit failures should not break the user flow
    logger.error('[ai-governance] Failed to record generation audit:', { error: error instanceof Error ? error.message : error });
  }
}

// ── Convenience: Full Pre-Flight Check ───────────────────────────────────────

/**
 * Combined pre-flight check for AI routes.
 *
 * Runs governance checks, builds the grounding note, and returns everything
 * the caller needs in one shot:
 *   - governanceResult: pass/fail decision
 *   - groundingNote: evidence context for the LLM prompt
 *   - promptAddon: governance warnings to inject
 *   - config: the resolved config for this generation type
 */
export async function preFlightCheck(context: GovernanceContext): Promise<{
  governanceResult: GovernanceResult;
  groundingNote: string;
  promptAddon: string;
  config: GovernanceConfig;
}> {
  const config = getGovernanceConfig(context.generationType);
  const governanceResult = await runGovernanceChecks(context);
  const groundingNote = buildEvidenceGroundingNote(context.researchContext);
  const promptAddon = buildGovernancePromptAddon(governanceResult, context.generationType);

  return {
    governanceResult,
    groundingNote,
    promptAddon,
    config,
  };
}

// ── MANDATORY: Centralized Governed AI Call ─────────────────────────────────
// This is the ONLY approved way for AI routes to call the LLM.
// No AI route should call callLLM() directly — all calls MUST go through this.

// Move all imports to top of file (F10 fix)
import { logger } from '@/lib/logger';
import { ModelRouter } from '@/lib/engines/model-router';
import { runHallucinationCheck, buildEvidenceContextFromChain, formatHallucinationReportForLog } from '@/lib/ai-hallucination-prevention';
import type { HallucinationCheckResult, EvidenceContext } from '@/lib/ai-hallucination-prevention';

interface GovernedAICallParams {
  /** Generation type for governance config lookup (e.g. 'email_draft', 'insights') */
  generationType: string;
  /** Company ID if company-specific generation */
  companyId?: string;
  /** Contact ID if contact-specific generation */
  contactId?: string;
  /** Pre-loaded research context (avoids double-loading) */
  researchContext?: ResearchContext | null;
  /** Number of matched capability assets */
  capabilityMatchCount?: number;
  /** System prompt (will have governance rules injected) */
  systemPrompt: string;
  /** User prompt (will have grounding notes appended) */
  userPrompt: string;
  /** Whether to enforce governance blocking (default: true).
   *  Set to false for non-company-specific routes (insights, recommendations, score-leads)
   *  where governance is advisory only. */
  enforceGovernance?: boolean;
  /** LLM tier override ('fast' | 'smart' | 'deep'). Default: 'smart'. */
  tier?: 'fast' | 'smart' | 'deep';
  /** Max tokens override. Default: 4096. */
  maxTokens?: number;
  /** Temperature override. Default: 0.7. */
  temperature?: number;
  /** Evidence IDs used for audit trail */
  evidenceIds?: string[];
  /** Signal IDs used for audit trail */
  signalIds?: string[];
  /** Capability asset IDs used for audit trail */
  capabilityAssetIds?: string[];
  /** Input parameters for audit trail (sanitized, no PII) */
  inputParams?: Record<string, unknown>;
  /** Evidence items for post-generation hallucination check (WI-16B). */
  evidenceItems?: Array<{ id: string; source: string; url: string | null; snippet: string; content: string; reliability: number; confidence: number }>;
  /** Whether to run post-generation hallucination check (default: true for company-specific, false for aggregate). */
  enableHallucinationCheck?: boolean;
  /** Whether to use AI cache for this call (default: true for cacheable generation types). */
  useCache?: boolean;
  /** S5-3.4: Prompt registry ID — if set, resolves system prompt from registry instead of inline. */
  promptRegistryId?: string;
  /** S5-3.5: A/B testing sample key — if set, assigns variant from any running experiment for this prompt. */
  abSampleKey?: string;
}

export interface GovernedAIResult {
  /** Whether governance passed and LLM call succeeded */
  success: boolean;
  /** The LLM response text */
  response: string | null;
  /** Governance result (always present) */
  governanceResult: GovernanceResult;
  /** If governance blocked, the rejection reason */
  rejectionReason: string | null;
  /** Evidence grounding note injected into the prompt */
  groundingNote: string;
  /** Governance warning addon injected into the prompt */
  promptAddon: string;
  /** Post-generation hallucination check result (WI-16B). */
  hallucinationCheck: HallucinationCheckResult | null;
  /** Whether the response was served from cache. */
  cacheHit?: boolean;
  /** S5-3.5: A/B test variant ID assigned for this call (if applicable). */
  abVariantId?: string;
  /** S5-3.6: Unified cost record ID (if cost tracking succeeded). */
  costRecordId?: string;
}

/**
 * MANDATORY centralized AI call function.
 *
 * Every AI route in the application MUST use this function instead of calling
 * callLLM() directly. This ensures:
 *
 *   1. Governance checks run BEFORE the LLM is called
 *   2. Hallucination prevention rules are injected into the system prompt
 *   3. Evidence grounding notes are appended to the user prompt
 *   4. Confidence thresholds are enforced per generation type
 *   5. Every call is recorded in AIGenerationAudit for full traceability
 *   6. If governance fails and enforceGovernance is true, the LLM is NOT called
 *
 * Usage:
 *   const result = await governedAICall({
 *     generationType: 'email_draft',
 *     companyId: 'xxx',
 *     researchContext: ctx,
 *     systemPrompt: 'You are an email writer...',
 *     userPrompt: 'Write an email for...',
 *   });
 *   if (!result.success) return apiError(result.rejectionReason!, 422);
 *   // use result.response
 */
export async function governedAICall(
  params: GovernedAICallParams,
): Promise<GovernedAIResult> {
  const {
    generationType,
    companyId,
    contactId,
    researchContext: ctx,
    capabilityMatchCount,
    systemPrompt,
    userPrompt,
    enforceGovernance = true,
    evidenceIds,
    signalIds,
    capabilityAssetIds,
    inputParams,
    promptRegistryId,
    abSampleKey,
  } = params;

  // ── Step 1: Run governance checks ──
  const governanceResult = await runGovernanceChecks({
    companyId,
    contactId,
    generationType,
    researchContext: ctx,
    capabilityMatchCount,
  });

  // ── Step 2: Build prompt addons ──
  const groundingNote = buildEvidenceGroundingNote(ctx);
  const promptAddon = buildGovernancePromptAddon(governanceResult, generationType);

  // ── Step 2.5: S5 — Prompt Registry + A/B Testing Resolution ──
  let resolvedSystemPrompt = systemPrompt;
  let abVariantId: string | undefined;

  // S5-3.4: Resolve system prompt from registry if promptRegistryId is provided
  if (promptRegistryId) {
    try {
      const registryPrompt = getRegistrySystemPrompt(promptRegistryId);
      if (registryPrompt) {
        resolvedSystemPrompt = registryPrompt;
      } else {
        logger.warn(`[ai-governance] Prompt registry ID "${promptRegistryId}" not found, falling back to inline systemPrompt`);
      }
    } catch (err) {
      logger.error(`[ai-governance] Failed to resolve prompt from registry: ${err instanceof Error ? err.message : err}`);
    }
  }

  // S5-3.5: A/B Testing — assign variant if experiment is running for this prompt
  if (promptRegistryId && abSampleKey) {
    try {
      const runningExperiments = listABExperiments('running');
      const matchingExp = runningExperiments.find(e => e.promptId === promptRegistryId);
      if (matchingExp) {
        const variantId = assignABVariant(matchingExp.id, abSampleKey);
        if (variantId) {
          abVariantId = variantId;
          const variant = getABVariant(matchingExp.id, variantId);
          if (variant?.systemPromptOverride) {
            resolvedSystemPrompt = variant.systemPromptOverride;
          }
          logger.info(`[ai-governance] A/B test "${matchingExp.name}": variant "${variantId}" assigned for sample "${abSampleKey}"`);
        }
      }
    } catch (err) {
      logger.error(`[ai-governance] A/B testing variant assignment failed (non-blocking): ${err instanceof Error ? err.message : err}`);
    }
  }

  // ── Step 3: Check if blocked ──
  if (!governanceResult.canProceed && enforceGovernance) {
    // Record the blocked generation in audit trail
    await recordGeneration({
      generationType,
      companyId,
      contactId,
      researchContext: ctx,
      evidenceIds,
      signalIds,
      capabilityAssetIds,
      governanceResult,
      outputSummary: `BLOCKED: ${governanceResult.rejectionReason}`,
      inputParams,
    });

    return {
      success: false,
      response: null,
      governanceResult,
      rejectionReason: governanceResult.rejectionReason,
      groundingNote,
      promptAddon,
      hallucinationCheck: null,
    };
  }

  // ── Freshness lifecycle warnings ──
  const freshnessWarning = ctx?.researchCard
    ? buildFreshnessWarning(ctx.researchCard)
    : '';

  // ── Staleness-based confidence modifier ──
  // If any intelligence domain is stale, reduce effective confidence
  let stalenessModifier = 0;
  if (ctx?.researchCard) {
    const card = ctx.researchCard;
    const domains: Array<[FreshnessDomain, Date | null]> = [
      ['profile', card.profileFreshnessAt],
      ['signals', card.signalFreshnessAt],
      ['technology', card.techFreshnessAt],
      ['contacts', card.contactFreshnessAt],
    ];
    for (const [domain, lastRefreshedAt] of domains) {
      const freshness = evaluateDomainFreshness(lastRefreshedAt, domain);
      if (freshness.status === 'stale') stalenessModifier += 0.15;
      else if (freshness.status === 'aging') stalenessModifier += 0.05;
    }
  }
  const stalenessWarning = stalenessModifier > 0
    ? `\n\nNOTE: Intelligence staleness detected. Effective confidence is reduced by ${Math.round(stalenessModifier * 100)}%. Be more conservative in claims and hedge appropriately.\n`
    : '';

  // ── Step 3.5: AI Cache Check (non-blocking) ──
  const cacheFingerprint = companyId
    ? `${generationType}:${companyId}:${contactId || 'none'}:${params.tier || 'smart'}`
    : `aggregate:${generationType}:${params.tier || 'smart'}`;

  const governedSystemPrompt = `${resolvedSystemPrompt}\n\n${HALLUCINATION_PREVENTION_RULES}${stalenessWarning}`;
  const governedUserPrompt = `${userPrompt}\n\n${groundingNote}\n${promptAddon}${freshnessWarning}`;

  // Check cache before LLM call (skip for conversational/unpredictable generation types)
  const cacheableTypes = ['enrichment', 'intelligence_summary', 'account_brief', 'signal_analysis', 'relationship_memory', 'research_synthesis', 'capability_matching', 'conversation_plan', 'recommendation_narrative', 'score_narrative', 'data_health_analysis'];
  const isCacheable = params.useCache !== false && cacheableTypes.some(t => generationType?.toLowerCase().includes(t));

  let response: string | null = null;
  let actualModel = 'unknown';
  let cacheHit = false;

  if (isCacheable) {
    try {
      const cached = await AICacheLayer.get(governedSystemPrompt, governedUserPrompt, cacheFingerprint);
      if (cached) {
        response = cached.response;
        actualModel = cached.modelUsed;
        cacheHit = true;
      }
    } catch {
      // Cache miss or failure — proceed to LLM call
    }
  }

  // ── Step 4: Call LLM with governed prompt (if cache miss) ──
  let llmPromptTokens = 0;
  let llmCompletionTokens = 0;
  let llmDurationMs = 0;
  if (!response) {
    try {
      const result = await ModelRouter.complete({
        systemPrompt: governedSystemPrompt,
        userPrompt: governedUserPrompt,
        tier: params.tier || 'smart',
        genType: generationType || 'governed_ai_call',
        maxTokens: params.maxTokens || 4096,
        temperature: params.temperature ?? 0.7,
        companyId,
        contactId,
      });
      if (!result.success) throw new Error(result.error ?? 'ModelRouter failed');
      response = result.text;
      actualModel = result.modelUsed;
      llmPromptTokens = result.promptTokens;
      llmCompletionTokens = result.completionTokens;
      llmDurationMs = result.durationMs;
    } catch (llmErr) {
      logger.error(`[ai-governance] LLM call failed for ${generationType}:`, { error: llmErr instanceof Error ? llmErr.message : llmErr });
      // Record failed LLM call
      await recordGeneration({
        generationType,
        companyId,
        contactId,
        researchContext: ctx,
        evidenceIds,
        signalIds,
        capabilityAssetIds,
        governanceResult,
        outputSummary: `LLM_CALL_FAILED`,
        inputParams,
      });

      return {
        success: false,
        response: null,
        governanceResult,
        rejectionReason: `LLM call failed: ${llmErr instanceof Error ? llmErr.message : 'Unknown error'}`,
        groundingNote,
        promptAddon,
        hallucinationCheck: null,
      };
    }
  } // end if (!response) — LLM call block

  // ── Step 4b: Post-generation hallucination check (WI-16B) ──
  let hallucinationCheck: HallucinationCheckResult | null = null;
  const shouldCheckHallucination = params.enableHallucinationCheck !== false;
  if (shouldCheckHallucination && response && params.evidenceItems && params.evidenceItems.length > 0) {
    try {
      const evidenceContext = buildEvidenceContextFromChain({
        evidences: params.evidenceItems,
        fieldConfidence: ctx?.fieldConfidence,
      });
      hallucinationCheck = runHallucinationCheck(response, evidenceContext);
      if (hallucinationCheck.riskLevel === 'high' || hallucinationCheck.riskLevel === 'critical') {
        logger.warn(`[ai-governance] Post-generation hallucination check: ${hallucinationCheck.riskLevel} risk (${hallucinationCheck.hallucinationRiskScore}/100) for ${generationType}`);
      }
      logger.info(formatHallucinationReportForLog(hallucinationCheck));
    } catch (hallCheckErr) {
      // Hallucination check failure should NOT break the flow
      logger.error('[ai-governance] Hallucination check failed (non-blocking):', { error: hallCheckErr instanceof Error ? hallCheckErr.message : hallCheckErr });
    }
  }

  // ── Step 4b: Store in cache on miss (non-blocking) ──
  if (!cacheHit && isCacheable && response) {
    try {
      await AICacheLayer.set(
        governedSystemPrompt,
        governedUserPrompt,
        cacheFingerprint,
        response,
        actualModel,
        params.tier || 'smart',
        params.maxTokens || 4096, // approximate tokens
        0, // cost estimate (not tracked at this level)
        7, // 7 day TTL for governed calls
      );
    } catch {
      // Cache set failure — non-blocking
    }
  }

  // ── Step 5: Record successful generation ──
  await recordGeneration({
    generationType,
    companyId,
    contactId,
    researchContext: ctx,
    evidenceIds,
    signalIds,
    capabilityAssetIds,
    governanceResult,
    outputSummary: response?.substring(0, 500),
    inputParams,
    modelUsed: actualModel,
  });

  // ── Step 5.5: S5-3.6 — Unified Cost Tracking ──
  let costRecordId: string | undefined;
  if (llmPromptTokens > 0 || llmCompletionTokens > 0) {
    try {
      costRecordId = await recordUnifiedCost({
        route: generationType || 'unknown',
        capability: generationType || 'governed_ai_call',
        provider: actualModel.split('/')[0] || 'unknown',
        model: actualModel,
        promptVersion: promptRegistryId,
        inputTokens: llmPromptTokens,
        outputTokens: llmCompletionTokens,
        latencyMs: llmDurationMs,
        success: true,
        companyId,
      });
    } catch (costErr) {
      // Cost tracking is non-blocking — must never break the AI call flow
      logger.error(`[ai-governance] Unified cost tracking failed (non-blocking): ${costErr instanceof Error ? costErr.message : costErr}`);
    }
  }

  return {
    success: true,
    response,
    governanceResult,
    rejectionReason: null,
    groundingNote,
    promptAddon,
    hallucinationCheck,
    cacheHit,
    abVariantId,
    costRecordId,
  };
}

// ── Aggregate / Non-Company Governed Call ──────────────────────────────────

/**
 * governedAICallAggregate — for LLM calls that are NOT company-specific.
 *
 * Used for: CRM query parsing, data health analysis, playbook generation,
 * portfolio-wide relationship memory, knowledge enrichment, etc.
 *
 * These calls still get:
 *   - Hallucination prevention rules injected
 *   - Audit logging in AIGenerationAudit
 *   - Governance config tracking
 *
 * But they SKIP company-specific checks (confidence, freshness, capability match)
 * since there is no company context to validate against.
 */
export async function governedAICallAggregate(params: {
  generationType: string;
  systemPrompt: string;
  userPrompt: string;
  inputParams?: Record<string, unknown>;
  /** LLM tier override. Default: 'smart'. */
  tier?: 'fast' | 'smart' | 'deep';
  /** Max tokens override. Default: 4096. */
  maxTokens?: number;
  /** Temperature override. Default: 0.7. */
  temperature?: number;
}): Promise<GovernedAIResult> {
  const { generationType, systemPrompt, userPrompt, inputParams } = params;

  // Build a minimal governance result for aggregate calls
  const governanceResult: GovernanceResult = {
    passed: true,
    checks: {
      aggregate_call: {
        passed: true,
        message: 'Aggregate/non-company call — company-specific checks skipped.',
        value: generationType,
      },
    },
    overallMessage: `Aggregate governance passed for ${generationType}.`,
    canProceed: true,
    rejectionReason: null,
  };

  // Call LLM with hallucination prevention rules injected
  const governedSystemPrompt = `${systemPrompt}\n\n${HALLUCINATION_PREVENTION_RULES}`;

  let response: string | null = null;
  try {
    const result = await ModelRouter.complete({
      systemPrompt: governedSystemPrompt,
      userPrompt,
      tier: params.tier || 'smart',
      genType: generationType || 'governed_aggregate_call',
      maxTokens: params.maxTokens || 4096,
      temperature: params.temperature ?? 0.7,
    });
    if (!result.success) throw new Error(result.error ?? 'ModelRouter failed');
    response = result.text;
  } catch (llmErr) {
    logger.error(`[ai-governance] Aggregate LLM call failed for ${generationType}:`, { error: llmErr instanceof Error ? llmErr.message : llmErr });
    await recordGeneration({
      generationType,
      governanceResult,
      outputSummary: `LLM_CALL_FAILED`,
      inputParams,
    });
    return {
      success: false,
      response: null,
      governanceResult,
      rejectionReason: `LLM call failed: ${llmErr instanceof Error ? llmErr.message : 'Unknown error'}`,
      groundingNote: '',
      promptAddon: '',
      hallucinationCheck: null,
    };
  }

  // Audit log
  await recordGeneration({
    generationType,
    governanceResult,
    outputSummary: response?.substring(0, 500),
    inputParams,
  });

  return {
    success: true,
    response,
    governanceResult,
    rejectionReason: null,
    groundingNote: '',
    promptAddon: '',
    hallucinationCheck: null,
  };
}