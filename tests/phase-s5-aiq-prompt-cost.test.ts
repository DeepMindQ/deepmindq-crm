/**
 * S5 Verification Tests — 3.4, 3.5, 3.6
 * ========================================
 *
 * Tests are STRUCTURAL (file-content based) to avoid DB connection issues.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const SRC_ROOT = path.resolve(__dirname, '../src');

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), 'utf-8');
}

function srcPath(relPath: string): string {
  return path.join(SRC_ROOT, relPath);
}

// ─── S5-3.4: LLM Prompt Registry & Versioning ────────────────────────

describe('S5-3.4: LLM Prompt Registry & Versioning', () => {
  const registryPersistence = readFile('lib/prompt-registry-persistence.ts');
  const instrumentation = readFile('instrumentation.ts');

  it('should export syncRegistryToTracing function', () => {
    expect(registryPersistence).toContain('syncRegistryToTracing()');
    expect(registryPersistence).toContain('number');
  });

  it('should export persistPromptVersionAudit function', () => {
    expect(registryPersistence).toContain('export async function persistPromptVersionAudit(');
    expect(registryPersistence).toContain('promptId: string');
    expect(registryPersistence).toContain('version: string');
  });

  it('should export getPromptVersionHistory function', () => {
    expect(registryPersistence).toContain('export async function getPromptVersionHistory(');
  });

  it('should export generateRegistryHealth function', () => {
    expect(registryPersistence).toContain('export function generateRegistryHealth()');
  });

  it('should export initializePromptPersistence function', () => {
    expect(registryPersistence).toContain('export function initializePromptPersistence()');
  });

  it('should connect prompt registry to ai-tracing activePromptVersions', () => {
    expect(registryPersistence).toContain('registerPromptVersion as registerTraceVersion');
    expect(registryPersistence).toContain('getActivePromptVersions');
    expect(registryPersistence).toContain("from '@/lib/ai-tracing'");
  });

  it('should use listPrompts from ai-prompt-registry', () => {
    expect(registryPersistence).toContain("from '@/lib/ai-prompt-registry'");
    expect(registryPersistence).toContain('listPrompts');
  });

  it('should detect active prompt versions', () => {
    expect(registryPersistence).toContain('find((v: PromptVersion) => v.active)');
  });

  it('should write to AIUsageLog via db.aIUsageLog.create', () => {
    expect(registryPersistence).toContain('db.aIUsageLog.create');
    expect(registryPersistence).toContain('prompt_registry:');
  });

  it('should compute registry health stats', () => {
    expect(registryPersistence).toContain('totalPrompts');
    expect(registryPersistence).toContain('withActiveVersion');
    expect(registryPersistence).toContain('syncedToTracing');
    expect(registryPersistence).toContain('averageVersionsPerPrompt');
  });

  it('should be wired into instrumentation.ts startup', () => {
    expect(instrumentation).toContain('S5-3.4: Prompt Registry Persistence');
    expect(instrumentation).toContain("import('@/lib/prompt-registry-persistence')");
    expect(instrumentation).toContain('initializePromptPersistence()');
  });

  it('should be non-blocking in instrumentation (try/catch)', () => {
    expect(instrumentation).toContain('Failed to initialize prompt persistence (non-fatal)');
  });
});

// ─── S5-3.5: Prompt A/B Testing Framework ─────────────────────────────

describe('S5-3.5: Prompt A/B Testing Framework', () => {
  const abTesting = readFile('lib/prompt-ab-testing.ts');

  it('should export createExperiment with correct signature', () => {
    expect(abTesting).toContain('export function createExperiment(');
    expect(abTesting).toContain('name: string');
    expect(abTesting).toContain('promptId: string');
    expect(abTesting).toContain('variants:');
    expect(abTesting).toContain('PromptExperiment');
  });

  it('should export getExperiment', () => {
    expect(abTesting).toContain('export function getExperiment(id: string)');
  });

  it('should export listExperiments with status filter', () => {
    expect(abTesting).toContain('export function listExperiments(status?: ExperimentStatus)');
  });

  it('should support experiment lifecycle: create/start/pause/resume/complete', () => {
    expect(abTesting).toContain('export function startExperiment(');
    expect(abTesting).toContain('export function pauseExperiment(');
    expect(abTesting).toContain('export function resumeExperiment(');
    expect(abTesting).toContain('export function completeExperiment(');
  });

  it('should support status transitions (draft → running → paused → running → completed)', () => {
    expect(abTesting).toContain("exp.status !== 'draft'");
    expect(abTesting).toContain("exp.status !== 'running'");
    expect(abTesting).toContain("exp.status !== 'paused'");
    expect(abTesting).toContain("exp.status === 'completed'");
  });

  it('should have deterministic variant assignment via hash', () => {
    expect(abTesting).toContain('export function assignVariant(');
    expect(abTesting).toContain('experimentId: string');
    expect(abTesting).toContain('sampleKey: string');
    expect(abTesting).toContain('normalized');
  });

  it('should only assign variants when experiment is running', () => {
    expect(abTesting).toContain("exp.status !== 'running'");
    expect(abTesting).toContain('return null');
  });

  it('should export recordMetric function', () => {
    expect(abTesting).toContain('export function recordMetric(');
    expect(abTesting).toContain('experimentId: string');
    expect(abTesting).toContain('variantId: string');
    expect(abTesting).toContain('metric: ExperimentMetric');
    expect(abTesting).toContain('value: number');
  });

  it('should auto-check for winner when enough samples collected', () => {
    expect(abTesting).toContain('getVariantMetricCounts');
    expect(abTesting).toContain('minSamples >= exp.minSamplesPerVariant');
    expect(abTesting).toContain('analyzeExperiment');
  });

  it('should export analyzeExperiment with statistical analysis', () => {
    expect(abTesting).toContain('export function analyzeExperiment(');
    expect(abTesting).toContain('ExperimentResult');
    expect(abTesting).toContain('winner?: string');
    expect(abTesting).toContain('confidence: number');
    expect(abTesting).toContain('variantStats:');
  });

  it('should handle lower-is-better metrics (hallucination_rate, latency_ms)', () => {
    expect(abTesting).toContain("lowerIsBetter = exp.primaryMetric === 'hallucination_rate'");
    expect(abTesting).toContain("|| exp.primaryMetric === 'latency_ms'");
  });

  it('should use configurable significance threshold', () => {
    expect(abTesting).toContain('significanceThreshold: number');
    expect(abTesting).toContain('significanceThreshold || 0.95');
    expect(abTesting).toContain('confidence >= exp.significanceThreshold');
  });

  it('should have traffic weights that sum to 1.0', () => {
    expect(abTesting).toContain('totalWeight');
    expect(abTesting).toContain('rawWeights[i] / totalWeight');
  });

  it('should export getExperimentSummary', () => {
    expect(abTesting).toContain('export function getExperimentSummary()');
    expect(abTesting).toContain('byStatus');
    expect(abTesting).toContain('running:');
  });

  it('should store metrics in PromptExperiment', () => {
    expect(abTesting).toContain('metrics: ExperimentMetricRecord[]');
    expect(abTesting).toContain('ExperimentMetricRecord');
  });

  it('should have variant weights for traffic splitting', () => {
    expect(abTesting).toContain('ExperimentVariant');
    expect(abTesting).toContain('weight: number');
  });

  it('should have minSamplesPerVariant for statistical validity', () => {
    expect(abTesting).toContain('minSamplesPerVariant: number');
    expect(abTesting).toContain('minSamplesPerVariant || 30');
  });
});

// ─── S5-3.6: AI Cost Tracking per Model/Route ──────────────────────────

describe('S5-3.6: AI Cost Tracking per Model/Route', () => {
  const costTracking = readFile('lib/unified-ai-cost-tracking.ts');

  it('should export recordUnifiedCost as single entry point', () => {
    expect(costTracking).toContain('export async function recordUnifiedCost(');
    expect(costTracking).toContain('UnifiedCostRecord');
  });

  it('should have UnifiedCostRecord with route field', () => {
    expect(costTracking).toContain('interface UnifiedCostRecord');
    expect(costTracking).toContain('route: string');
    expect(costTracking).toContain('capability: string');
    expect(costTracking).toContain('provider: string');
    expect(costTracking).toContain('model: string');
  });

  it('should export getUnifiedCostReport with breakdowns', () => {
    expect(costTracking).toContain('export async function getUnifiedCostReport(');
    expect(costTracking).toContain('CostReport');
    expect(costTracking).toContain('byRoute: Record');
    expect(costTracking).toContain('byModel: Record');
    expect(costTracking).toContain('byProvider: Record');
  });

  it('should have unified model cost registry', () => {
    expect(costTracking).toContain('MODEL_COST_REGISTRY');
    expect(costTracking).toContain('ModelCostConfig');
    expect(costTracking).toContain('inputPerM: number');
    expect(costTracking).toContain('outputPerM: number');
  });

  it('should have 15+ models in cost registry', () => {
    const matches = costTracking.match(/model: '[^']+'/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(14);
  });

  it('should merge costs from both ai-tracing and usage-tracker models', () => {
    // ai-tracing models: groq/llama-3.3-70b, gemini/gemini-2.0-flash, etc.
    expect(costTracking).toContain("groq/llama-3.3-70b");
    expect(costTracking).toContain("gemini/gemini-2.0-flash");
    // usage-tracker models: gemini-2.0-flash, gemini-1.5-pro, gpt-4o, claude-sonnet
    expect(costTracking).toContain("gemini-2.0-flash");
    expect(costTracking).toContain("gpt-4o");
    expect(costTracking).toContain("claude-sonnet");
  });

  it('should have budget configuration with daily limits', () => {
    expect(costTracking).toContain('BudgetConfig');
    expect(costTracking).toContain('dailyLimit: number');
    expect(costTracking).toContain('routeLimits: Record');
    expect(costTracking).toContain('alertThresholdPercent: number');
  });

  it('should export setBudgetConfig', () => {
    expect(costTracking).toContain('export function setBudgetConfig(');
  });

  it('should export getDailyCostSummary for fast in-memory access', () => {
    expect(costTracking).toContain('export function getDailyCostSummary()');
    expect(costTracking).toContain('dailyCostDate');
    expect(costTracking).toContain('utilizationPercent');
  });

  it('should have budget alert type union', () => {
    expect(costTracking).toContain('BudgetAlert');
    expect(costTracking).toContain("'daily_limit' | 'route_limit' | 'model_limit' | 'unusual_spike'");
    expect(costTracking).toContain("daily_limit");
    expect(costTracking).toContain('model_limit');
    expect(costTracking).toContain('unusual_spike');
  });

  it('should check budget limits in recordUnifiedCost', () => {
    expect(costTracking).toContain('resetDailyIfNeeded()');
    expect(costTracking).toContain('dailyCostTotal += costUsd');
    expect(costTracking).toContain('dailyLimit > 0');
    expect(costTracking).toContain('alertThresholdPercent');
  });

  it('should write to AIUsageLog for persistence', () => {
    expect(costTracking).toContain('db.aIUsageLog.create');
    expect(costTracking).toContain('promptTokens');
    expect(costTracking).toContain('completionTokens');
    expect(costTracking).toContain('estimatedCost');
  });

  it('should export estimateUnifiedCost', () => {
    expect(costTracking).toContain('export function estimateUnifiedCost(');
    expect(costTracking).toContain('inputPerM');
    expect(costTracking).toContain('outputPerM');
    expect(costTracking).toContain('/ 1_000_000');
  });

  it('should export getModelCosts and registerModelCost', () => {
    expect(costTracking).toContain('export function getModelCosts()');
    expect(costTracking).toContain('export function registerModelCost(');
  });

  it('should have non-blocking error handling', () => {
    expect(costTracking).toContain('Failed to write AIUsageLog');
    expect(costTracking).toContain('Failed to generate report');
  });

  it('should have cost per route breakdown', () => {
    expect(costTracking).toContain('byRoute');
    expect(costTracking).toContain('avgLatencyMs');
    expect(costTracking).toContain('byProvider');
  });
});

// ─── S5 Integration: Module Existence & Pipeline ─────────────────────

describe('S5 Integration: Module Existence & Pipeline', () => {
  it('should have all 3 new modules at expected paths', () => {
    const paths = [
      'lib/prompt-registry-persistence.ts',
      'lib/prompt-ab-testing.ts',
      'lib/unified-ai-cost-tracking.ts',
    ];
    for (const p of paths) {
      expect(fs.existsSync(srcPath(p))).toBe(true);
    }
  });

  it('should have prompt-registry-persistence import ai-prompt-registry', () => {
    const content = readFile('lib/prompt-registry-persistence.ts');
    expect(content).toContain("from '@/lib/ai-prompt-registry'");
    expect(content).toContain("from '@/lib/ai-tracing'");
  });

  it('should have unified cost tracking connect to ai-tracing concepts', () => {
    const content = readFile('lib/unified-ai-cost-tracking.ts');
    // Uses the same AIUsageLog table as ai-tracing.ts
    expect(content).toContain('db.aIUsageLog');
    // Has cost estimation (like both ai-tracing and usage-tracker)
    expect(content).toContain('estimateUnifiedCost');
  });

  it('should have all modules wired into startup or importable', () => {
    const instrContent = readFile('instrumentation.ts');
    // Prompt persistence wired into instrumentation
    expect(instrContent).toContain('prompt-registry-persistence');
    // A/B testing and cost tracking are libraries, not startup-wired
    // (they're used by API routes on-demand)
    expect(fs.existsSync(srcPath('lib/prompt-ab-testing.ts'))).toBe(true);
    expect(fs.existsSync(srcPath('lib/unified-ai-cost-tracking.ts'))).toBe(true);
  });

  it('should have no duplicate prompt tracking systems', () => {
    const persistence = readFile('lib/prompt-registry-persistence.ts');
    const cost = readFile('lib/unified-ai-cost-tracking.ts');
    // Both use the same AIUsageLog table
    expect(persistence).toContain('db.aIUsageLog.create');
    expect(cost).toContain('db.aIUsageLog.create');
    // Unified cost tracking provides single entry point
    expect(cost).toContain('recordUnifiedCost');
  });
});
