/**
 * Reasoning Strategy Router — Phase 1 Enterprise Readiness
 * ========================================================
 *
 * Routes companies to appropriate reasoning strategies based on
 * their size segment. This is the entry point for adaptive reasoning.
 *
 * FLOWS:
 *   classifyCompany() → getStrategy() → executeWithStrategy()
 *
 * The router does NOT execute reasoning itself. It provides the
 * configuration that the EnterpriseReasoningEngine uses to adapt
 * its behavior per company.
 *
 * DESIGN:
 *   - Non-throwing: all functions return results, never throw
 *   - Cacheable: strategy configs are deterministic per segment
 *   - Feature-flagged: ENABLE_ADAPTIVE_REASONING env var
 */

import { logger } from '@/lib/logger';
import {
  classifyCompany,
  getProfile,
  type CompanySegment,
  type CompanyClassification,
  type ReasoningDepth,
} from '@/lib/company-size-profiles';

// ── Types ──────────────────────────────────────────────────────────

/** Reasoning path type — selected after step 3 based on early signals. */
export type ReasoningPath = 'growth' | 'distress' | 'expansion' | 'unknown';

/** Step execution configuration for a single reasoning step. */
export interface StepConfig {
  /** Step number (1-30) */
  stepNumber: number;
  /** Execution depth */
  depth: ReasoningDepth;
  /** Whether to skip this step */
  skip: boolean;
  /** Reason for skipping (if skip=true) */
  skipReason?: string;
  /** Maximum tokens for this step */
  maxTokens: number;
  /** LLM tier for this step */
  tier: 'deep' | 'smart' | 'fast';
}

/** Full reasoning strategy for a company. */
export interface ReasoningStrategy {
  /** Company segment */
  segment: CompanySegment;
  /** Reasoning path (determined after step 3) */
  path: ReasoningPath;
  /** Configuration for each of the 30 steps */
  stepConfigs: StepConfig[];
  /** Steps that will actually execute (not skipped) */
  activeSteps: number[];
  /** Steps that are skipped */
  skippedSteps: number[];
  /** Total estimated tokens for this strategy */
  estimatedTotalTokens: number;
  /** Description of this strategy */
  description: string;
  /** Feature flag status */
  adaptiveEnabled: boolean;
}

/** Input for strategy resolution. */
export interface StrategyInput {
  companyId: string;
  employeeCount?: number | null;
  revenue?: number | null;
  companyType?: string | null;
  fundingRounds?: number;
  hiringSignals?: number;
  /** Early reasoning results (from steps 1-3) for path selection */
  earlySignals?: {
    detectedGrowthSignals: boolean;
    detectedDistressSignals: boolean;
    detectedExpansionSignals: boolean;
    signalCount: number;
  };
}

/** Path selection result after step 3. */
export interface PathSelection {
  path: ReasoningPath;
  confidence: number;
  reasoning: string;
}

// ── Feature Flag ───────────────────────────────────────────────────

const ENABLE_ADAPTIVE_REASONING = process.env.ENABLE_ADAPTIVE_REASONING !== 'false';

// ── Default Step Config (used when adaptive reasoning is disabled) ─

function getDefaultStepConfigs(): StepConfig[] {
  return Array.from({ length: 30 }, (_, i) => ({
    stepNumber: i + 1,
    depth: 'standard' as ReasoningDepth,
    skip: false,
    maxTokens: 2000,
    tier: 'smart' as const,
  }));
}

// ── Main Strategy Resolution ────────────────────────────────────────

/**
 * Resolve the reasoning strategy for a company.
 *
 * When adaptive reasoning is disabled (default = enabled):
 *   Returns standard 30-step strategy for all companies.
 *
 * When adaptive reasoning is enabled:
 *   1. Classify company by size segment
 *   2. Build step configs based on segment profile
 *   3. Select reasoning path based on early signals (if available)
 *   4. Return fully configured strategy
 */
export function getReasoningStrategy(input: StrategyInput): ReasoningStrategy {
  // If adaptive reasoning disabled, return default strategy
  if (!ENABLE_ADAPTIVE_REASONING) {
    logger.info(`[strategy-router] Adaptive reasoning disabled — using default 30-step strategy`);
    const defaultConfigs = getDefaultStepConfigs();
    return {
      segment: 'mid_market', // neutral default
      path: 'unknown',
      stepConfigs: defaultConfigs,
      activeSteps: defaultConfigs.map(c => c.stepNumber),
      skippedSteps: [],
      estimatedTotalTokens: 30 * 2000,
      description: 'Standard 30-step reasoning (adaptive reasoning disabled)',
      adaptiveEnabled: false,
    };
  }

  // Step 1: Classify company
  const classification = classifyCompany({
    employeeCount: input.employeeCount,
    revenue: input.revenue,
    companyType: input.companyType,
    fundingRounds: input.fundingRounds,
    hiringSignals: input.hiringSignals,
  });

  const profile = classification.profile;

  logger.info(
    `[strategy-router] Company ${input.companyId} → segment=${classification.segment} ` +
    `(confidence=${classification.confidence}, based_on=${classification.basedOn.join(',')})`
  );

  // Step 2: Build step configs from segment profile
  const stepConfigs = buildStepConfigs(profile);

  // Step 3: Select reasoning path (if early signals available)
  const path = selectPath(input.earlySignals);

  // Step 4: Apply path-specific overrides
  applyPathOverrides(stepConfigs, path);

  // Compute summary
  const activeSteps = stepConfigs.filter(c => !c.skip).map(c => c.stepNumber);
  const skippedSteps = stepConfigs.filter(c => c.skip).map(c => c.stepNumber);
  const estimatedTotalTokens = stepConfigs
    .filter(c => !c.skip)
    .reduce((sum, c) => sum + c.maxTokens, 0);

  logger.info(
    `[strategy-router] Strategy for ${input.companyId}: ` +
    `path=${path}, active=${activeSteps.length}, skipped=${skippedSteps.length}, ` +
    `est_tokens=${estimatedTotalTokens}`
  );

  return {
    segment: classification.segment,
    path,
    stepConfigs,
    activeSteps,
    skippedSteps,
    estimatedTotalTokens,
    description:
      `${profile.label} strategy via ${path} path — ` +
      `${activeSteps.length} active steps, ${skippedSteps.length} skipped`,
    adaptiveEnabled: true,
  };
}

// ── Step Config Builder ────────────────────────────────────────────

/**
 * Build step configurations from a company size profile.
 * Applies segment-specific depth overrides and skip rules.
 */
function buildStepConfigs(profile: ReturnType<typeof getProfile>): StepConfig[] {
  const configs: StepConfig[] = [];

  for (let i = 1; i <= 30; i++) {
    // Check if this step should be skipped by default for this segment
    const isSkipped = profile.defaultSkipSteps.includes(i);

    // Get depth override (or default to "standard")
    const depthOverride = profile.stepDepthOverrides[i];
    const depth = isSkipped ? 'skip' : (depthOverride || 'standard');

    // Determine tier based on depth
    const tier = depth === 'deep' ? profile.llmTier as 'deep' :
                 depth === 'quick' ? 'fast' :
                 profile.llmTier === 'deep' ? 'smart' : profile.llmTier;

    // Determine max tokens based on depth
    const maxTokens = depth === 'deep' ? profile.maxTokensPerStep :
                      depth === 'quick' ? Math.round(profile.maxTokensPerStep * 0.3) :
                      depth === 'skip' ? 0 :
                      Math.round(profile.maxTokensPerStep * 0.6);

    configs.push({
      stepNumber: i,
      depth,
      skip: isSkipped,
      skipReason: isSkipped ? `No data expected for ${profile.segment} segment` : undefined,
      maxTokens,
      tier: tier as 'deep' | 'smart' | 'fast',
    });
  }

  return configs;
}

// ── Path Selection ──────────────────────────────────────────────────

/**
 * Select the reasoning path based on early signals from steps 1-3.
 *
 * Paths:
 *   - growth:    Focus on funding, growth trajectory, opportunity windows
 *   - distress:  Focus on risk signals, pain areas, cost optimization
 *   - expansion: Focus on vendors, digital maturity, strategic initiatives
 *   - unknown:   No clear signal — run all active steps as-is
 */
export function selectPath(earlySignals: StrategyInput['earlySignals']): ReasoningPath {
  if (!earlySignals) return 'unknown';

  const { detectedGrowthSignals, detectedDistressSignals, detectedExpansionSignals, signalCount } = earlySignals;

  // If very few signals, can't determine path
  if (signalCount < 2) return 'unknown';

  // Priority: distress > growth > expansion (distress is most actionable)
  if (detectedDistressSignals) return 'distress';
  if (detectedGrowthSignals) return 'growth';
  if (detectedExpansionSignals) return 'expansion';

  return 'unknown';
}

/**
 * Get a human-readable explanation of why a path was selected.
 */
export function getPathSelectionExplanation(
  path: ReasoningPath,
  earlySignals: StrategyInput['earlySignals']
): PathSelection {
  if (!earlySignals || path === 'unknown') {
    return {
      path,
      confidence: 0.3,
      reasoning: path === 'unknown'
        ? 'Insufficient early signals to determine reasoning path — using default strategy.'
        : 'No early signal data provided — using default strategy.',
    };
  }

  const parts: string[] = [];

  if (earlySignals.detectedDistressSignals) {
    parts.push('distress signals detected (layoffs, risk indicators)');
  }
  if (earlySignals.detectedGrowthSignals) {
    parts.push('growth signals detected (funding, hiring expansion)');
  }
  if (earlySignals.detectedExpansionSignals) {
    parts.push('expansion signals detected (new markets, vendor changes)');
  }

  return {
    path,
    confidence: earlySignals.signalCount >= 5 ? 0.8 : 0.6,
    reasoning: `Path selected based on: ${parts.join(', ')}. ` +
      `Total signals analyzed: ${earlySignals.signalCount}.`,
  };
}

// ── Path Overrides ──────────────────────────────────────────────────

/**
 * Apply path-specific step overrides on top of segment defaults.
 * Deepens or focuses certain steps based on the selected path.
 */
function applyPathOverrides(stepConfigs: StepConfig[], path: ReasoningPath): void {
  switch (path) {
    case 'growth':
      // Deepen growth-relevant steps
      overrideStep(stepConfigs, 7, { depth: 'deep', maxTokens: 4000 });  // Funding
      overrideStep(stepConfigs, 8, { depth: 'deep', maxTokens: 4000 });  // Growth
      overrideStep(stepConfigs, 18, { depth: 'deep', maxTokens: 4000 }); // Opportunity
      break;

    case 'distress':
      // Deepen risk/pain-relevant steps
      overrideStep(stepConfigs, 9, { depth: 'deep', maxTokens: 4000 });  // Risk
      overrideStep(stepConfigs, 14, { depth: 'deep', maxTokens: 4000 }); // Pain Areas
      overrideStep(stepConfigs, 15, { depth: 'standard' });                // Problem Priority (from skip)
      break;

    case 'expansion':
      // Deepen expansion-relevant steps
      overrideStep(stepConfigs, 5, { depth: 'deep', maxTokens: 4000 });  // Vendors
      overrideStep(stepConfigs, 6, { depth: 'deep', maxTokens: 4000 });  // Digital Maturity
      overrideStep(stepConfigs, 13, { depth: 'deep', maxTokens: 4000 }); // Strategic Initiatives
      break;

    case 'unknown':
      // No overrides — use segment defaults as-is
      break;
  }
}

/**
 * Override a specific step's configuration.
 * Only overrides if the step is not already skipped by segment defaults.
 */
function overrideStep(
  configs: StepConfig[],
  stepNumber: number,
  overrides: Partial<Pick<StepConfig, 'depth' | 'maxTokens'>>
): void {
  const config = configs.find(c => c.stepNumber === stepNumber);
  if (!config || config.skip) return; // Don't un-skip steps that segment says to skip

  if (overrides.depth !== undefined) config.depth = overrides.depth;
  if (overrides.maxTokens !== undefined) config.maxTokens = overrides.maxTokens;
  // Update tier based on new depth
  if (overrides.depth === 'deep') config.tier = 'deep';
  else if (overrides.depth === 'quick') config.tier = 'fast';
}

// ── Data-Driven Step Skipping ───────────────────────────────────────

/**
 * Dynamically skip steps when prerequisite data doesn't exist.
 * This is called by the reasoning engine BEFORE each step.
 *
 * Overrides segment defaults — a step that's normally run can be
 * dynamically skipped if data is missing, and vice versa (though
 * un-skipping is rare).
 */
export function shouldSkipStep(
  stepNumber: number,
  strategy: ReasoningStrategy,
  availableData: {
    hasCompanyData: boolean;
    hasFundingData: boolean;
    hasContactData: boolean;
    hasTechnologyData: boolean;
    hasSignalData: boolean;
    hasVendorData: boolean;
    evidenceCount: number;
  }
): { skip: boolean; reason?: string } {
  const stepConfig = strategy.stepConfigs.find(c => c.stepNumber === stepNumber);
  if (!stepConfig) return { skip: false };

  // If segment already says skip, respect that
  if (stepConfig.skip) {
    return { skip: true, reason: stepConfig.skipReason };
  }

  // Dynamic skip rules based on available data
  switch (stepNumber) {
    case 1: // Company Profile
      if (!availableData.hasCompanyData) {
        return { skip: true, reason: 'No company data available' };
      }
      break;

    case 7: // Funding & Financial Health
      if (!availableData.hasFundingData) {
        return { skip: true, reason: 'No funding/financial data available' };
      }
      break;

    case 11: // Buying Committee
    case 12: // Decision Makers
      if (!availableData.hasContactData) {
        return { skip: true, reason: 'No contact/organizational data available' };
      }
      break;

    case 4: // Technology Landscape
    case 5: // Vendor Ecosystem
      if (!availableData.hasTechnologyData) {
        return { skip: true, reason: 'No technology/vendor data available' };
      }
      break;

    case 16: // Signal Synthesis
    case 17: // Signal Meaning
    case 18: // Opportunity Windows
      if (!availableData.hasSignalData) {
        return { skip: true, reason: 'No signals detected' };
      }
      break;

    case 19: // Capability Matching
    case 20: // Case Study Matching
      if (availableData.evidenceCount < 1) {
        return { skip: true, reason: 'Insufficient evidence for capability matching' };
      }
      break;
  }

  return { skip: false };
}

// ── Confidence Continuation Check ───────────────────────────────────

/**
 * Check if reasoning should continue given the confidence of
 * previous steps. This prevents building on unreliable foundations.
 *
 * Returns a list of reasoning gaps (descriptions of low-confidence
 * prior steps that subsequent steps should be aware of).
 */
export function assessReasoningGaps(
  stepNumber: number,
  previousStepConfidences: Array<{ step: number; confidence: number; name: string }>
): string[] {
  const gaps: string[] = [];
  const LOW_CONFIDENCE_THRESHOLD = 0.2; // Below 20% = unreliable

  for (const prev of previousStepConfidences) {
    if (prev.confidence < LOW_CONFIDENCE_THRESHOLD) {
      gaps.push(
        `Step ${prev.step} (${prev.name}) had low confidence (${Math.round(prev.confidence * 100)}%). ` +
        `Subsequent analysis should not rely heavily on its output.`
      );
    }
  }

  return gaps;
}

// ── Feature Flag Check ──────────────────────────────────────────────

/**
 * Check if adaptive reasoning is currently enabled.
 */
export function isAdaptiveReasoningEnabled(): boolean {
  return ENABLE_ADAPTIVE_REASONING;
}
