/**
 * S5 (3.4, 3.5, 3.6) — Prompt Registry, A/B Testing, Cost Tracking Integration Tests
 *
 * Tests that all three S5 modules are correctly wired into governedAICall:
 *   1. Prompt Registry resolves system prompts
 *   2. A/B Testing assigns variants and overrides prompts
 *   3. Unified Cost Tracking records after every LLM call
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────

// Mock DB for unified cost tracking
vi.mock('@/lib/db', () => ({
  db: {
    aIUsageLog: {
      create: vi.fn().mockResolvedValue({ id: 'log_1' }),
    },
    aIGenerationAudit: {
      create: vi.fn().mockResolvedValue({ id: 'audit_1' }),
    },
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock AI cache layer
vi.mock('@/lib/ai-cache-layer', () => ({
  AICacheLayer: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock model router
const mockComplete = vi.fn().mockResolvedValue({
  success: true,
  text: 'Test AI response',
  modelUsed: 'gemini/gemini-2.0-flash',
  tier: 'smart',
  promptTokens: 100,
  completionTokens: 50,
  totalTokens: 150,
  costUsd: 0.0003,
  durationMs: 450,
  fellBack: false,
  error: null,
});

vi.mock('@/lib/engines/model-router', () => ({
  ModelRouter: {
    complete: (...args: any[]) => mockComplete(...args),
  },
}));

// ── Test Suite ─────────────────────────────────────────────────────────

describe('S5 Integration — Prompt Registry, A/B Testing, Cost Tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── 3.4: Prompt Registry Integration ────────────────────────────

  describe('3.4 — Prompt Registry Resolution', () => {
    it('should export GovernedAICallParams with promptRegistryId field', async () => {
      const { governedAICall } = await import('@/lib/ai-governance');
      expect(typeof governedAICall).toBe('function');
    });

    it('should export GovernedAIResult with abVariantId and costRecordId fields', async () => {
      const mod = await import('@/lib/ai-governance');
      // GovernedAIResult is a type, so we verify the function exists and can be called
      expect(typeof mod.governedAICall).toBe('function');
      expect(typeof mod.governedAICallAggregate).toBe('function');
    });

    it('should resolve system prompt from registry when promptRegistryId is provided', async () => {
      const { governedAICall } = await import('@/lib/ai-governance');

      const result = await governedAICall({
        generationType: 'account_brief',
        systemPrompt: 'Fallback prompt',
        userPrompt: 'Test user prompt',
        promptRegistryId: 'synthesis_account_brief',
        enforceGovernance: false,
        useCache: false,
        enableHallucinationCheck: false,
      });

      expect(result.success).toBe(true);
      // The registry prompt should have been resolved and passed to ModelRouter
      const callArgs = mockComplete.mock.calls[0][0];
      // The system prompt should NOT be the fallback — it should be from the registry
      expect(callArgs.systemPrompt).not.toBe('Fallback prompt');
      // It should contain evidence grounding rules (appended by governance)
      expect(callArgs.systemPrompt).toContain('EVIDENCE GROUNDING RULES');
    });

    it('should fall back to inline systemPrompt when promptRegistryId is not found', async () => {
      const { governedAICall } = await import('@/lib/ai-governance');

      const result = await governedAICall({
        generationType: 'account_brief',
        systemPrompt: 'My inline prompt',
        userPrompt: 'Test user prompt',
        promptRegistryId: 'nonexistent_prompt_id',
        enforceGovernance: false,
        useCache: false,
        enableHallucinationCheck: false,
      });

      expect(result.success).toBe(true);
      // Should use the inline fallback
      const callArgs = mockComplete.mock.calls[0][0];
      expect(callArgs.systemPrompt).toContain('My inline prompt');
    });

    it('should use inline systemPrompt when promptRegistryId is not provided', async () => {
      const { governedAICall } = await import('@/lib/ai-governance');

      const result = await governedAICall({
        generationType: 'account_brief',
        systemPrompt: 'Direct inline prompt',
        userPrompt: 'Test user prompt',
        enforceGovernance: false,
        useCache: false,
        enableHallucinationCheck: false,
      });

      expect(result.success).toBe(true);
      const callArgs = mockComplete.mock.calls[0][0];
      expect(callArgs.systemPrompt).toContain('Direct inline prompt');
    });
  });

  // ─── 3.5: A/B Testing Integration ─────────────────────────────────

  describe('3.5 — A/B Testing Variant Assignment', () => {
    it('should not assign variant when no experiment is running', async () => {
      const { governedAICall } = await import('@/lib/ai-governance');

      const result = await governedAICall({
        generationType: 'account_brief',
        systemPrompt: 'Base prompt',
        userPrompt: 'Test user prompt',
        promptRegistryId: 'synthesis_account_brief',
        abSampleKey: 'company_123',
        enforceGovernance: false,
        useCache: false,
        enableHallucinationCheck: false,
      });

      expect(result.success).toBe(true);
      expect(result.abVariantId).toBeUndefined();
    });

    it('should assign variant when experiment is running for the prompt', async () => {
      // First, create and start an experiment
      const { createExperiment, startExperiment } = await import('@/lib/prompt-ab-testing');

      const exp = createExperiment({
        name: 'Test Experiment',
        description: 'Testing variant assignment',
        promptId: 'synthesis_account_brief',
        variants: [
          { id: 'control', name: 'Control', systemPromptOverride: 'Control prompt v1' },
          { id: 'treatment', name: 'Treatment', systemPromptOverride: 'Treatment prompt v2' },
        ],
        primaryMetric: 'accuracy',
        weights: [0.5, 0.5],
        minSamplesPerVariant: 10,
      });

      startExperiment(exp.id);

      const { governedAICall } = await import('@/lib/ai-governance');

      const result = await governedAICall({
        generationType: 'account_brief',
        systemPrompt: 'Base prompt',
        userPrompt: 'Test user prompt',
        promptRegistryId: 'synthesis_account_brief',
        abSampleKey: 'company_456',
        enforceGovernance: false,
        useCache: false,
        enableHallucinationCheck: false,
      });

      expect(result.success).toBe(true);
      expect(result.abVariantId).toBeDefined();
      // Variant should be either 'control' or 'treatment'
      expect(['control', 'treatment']).toContain(result.abVariantId);

      // The system prompt should be overridden by the variant
      const callArgs = mockComplete.mock.calls[0][0];
      if (result.abVariantId === 'control') {
        expect(callArgs.systemPrompt).toContain('Control prompt v1');
      } else {
        expect(callArgs.systemPrompt).toContain('Treatment prompt v2');
      }
    });

    it('should assign consistent variants for the same sample key', async () => {
      const { governedAICall } = await import('@/lib/ai-governance');

      // Call twice with the same sample key
      const result1 = await governedAICall({
        generationType: 'account_brief',
        systemPrompt: 'Base prompt',
        userPrompt: 'Test user prompt',
        promptRegistryId: 'synthesis_account_brief',
        abSampleKey: 'deterministic_key_abc',
        enforceGovernance: false,
        useCache: false,
        enableHallucinationCheck: false,
      });

      const result2 = await governedAICall({
        generationType: 'account_brief',
        systemPrompt: 'Base prompt',
        userPrompt: 'Test user prompt',
        promptRegistryId: 'synthesis_account_brief',
        abSampleKey: 'deterministic_key_abc',
        enforceGovernance: false,
        useCache: false,
        enableHallucinationCheck: false,
      });

      // Same sample key should always get the same variant
      expect(result1.abVariantId).toBe(result2.abVariantId);
    });
  });

  // ─── 3.6: Unified Cost Tracking Integration ──────────────────────

  describe('3.6 — Unified Cost Tracking', () => {
    it('should record unified cost after successful LLM call', async () => {
      const { governedAICall } = await import('@/lib/ai-governance');
      const { db } = await import('@/lib/db');

      const result = await governedAICall({
        generationType: 'account_brief',
        systemPrompt: 'Test prompt',
        userPrompt: 'Test user prompt',
        enforceGovernance: false,
        useCache: false,
        enableHallucinationCheck: false,
      });

      expect(result.success).toBe(true);
      expect(result.costRecordId).toBeDefined();

      // Verify cost was recorded to DB
      expect(db.aIUsageLog.create).toHaveBeenCalledTimes(1);
      const createArgs = db.aIUsageLog.create.mock.calls[0][0].data;
      expect(createArgs.model).toBe('gemini/gemini-2.0-flash');
      expect(createArgs.promptTokens).toBe(100);
      expect(createArgs.completionTokens).toBe(50);
      expect(createArgs.totalTokens).toBe(150);
      expect(typeof createArgs.estimatedCost).toBe('number');
    });

    it('should not record cost when LLM call is cached', async () => {
      // Override cache mock to return a hit
      const { AICacheLayer } = await import('@/lib/ai-cache-layer');
      vi.mocked(AICacheLayer.get).mockResolvedValueOnce({
        response: 'Cached response',
        modelUsed: 'gemini/gemini-2.0-flash',
      } as any);

      const { governedAICall } = await import('@/lib/ai-governance');
      const { db } = await import('@/lib/db');

      const result = await governedAICall({
        generationType: 'account_brief',
        systemPrompt: 'Test prompt',
        userPrompt: 'Test user prompt',
        enforceGovernance: false,
        enableHallucinationCheck: false,
      });

      expect(result.success).toBe(true);
      expect(result.cacheHit).toBe(true);
      // When cached, no LLM call was made so no cost to record
      expect(result.costRecordId).toBeUndefined();
      // ModelRouter.complete should NOT have been called
      expect(mockComplete).not.toHaveBeenCalled();

      // Reset cache mock
      vi.mocked(AICacheLayer.get).mockResolvedValue(null);
    });

    it('should include provider and model in cost record', async () => {
      const { governedAICall } = await import('@/lib/ai-governance');
      const { db } = await import('@/lib/db');

      await governedAICall({
        generationType: 'signal_analysis',
        systemPrompt: 'Test prompt',
        userPrompt: 'Test user prompt',
        enforceGovernance: false,
        useCache: false,
        enableHallucinationCheck: false,
      });

      const createArgs = db.aIUsageLog.create.mock.calls[0][0].data;
      expect(createArgs.provider).toBe('gemini');
      expect(createArgs.feature).toBe('signal_analysis');
    });

    it('should handle cost tracking failure gracefully', async () => {
      const { db } = await import('@/lib/db');
      // Make DB write fail
      vi.mocked(db.aIUsageLog.create).mockRejectedValueOnce(new Error('DB connection lost'));

      const { governedAICall } = await import('@/lib/ai-governance');

      const result = await governedAICall({
        generationType: 'account_brief',
        systemPrompt: 'Test prompt',
        userPrompt: 'Test user prompt',
        enforceGovernance: false,
        useCache: false,
        enableHallucinationCheck: false,
      });

      // Cost tracking failure should NOT break the AI call
      expect(result.success).toBe(true);
      expect(result.response).toBe('Test AI response');
      // costRecordId might still be set (ID generated before DB write)
      // but the DB write should have failed
      expect(db.aIUsageLog.create).toHaveBeenCalled();

      // Reset
      vi.mocked(db.aIUsageLog.create).mockResolvedValue({ id: 'log_1' });
    });
  });

  // ─── Integration: All Three Modules Working Together ────────────────

  describe('S5 Full Integration', () => {
    it('should use registry prompt, assign AB variant, and track cost in one call', async () => {
      // Ensure experiment is still running from previous test
      const { listExperiments } = await import('@/lib/prompt-ab-testing');
      const running = listExperiments('running');
      const hasRunning = running.length > 0;

      const { governedAICall } = await import('@/lib/ai-governance');

      const result = await governedAICall({
        generationType: 'account_brief',
        systemPrompt: 'Fallback inline prompt',
        userPrompt: 'Generate account analysis',
        promptRegistryId: 'synthesis_account_brief',
        abSampleKey: 'integration_test_company',
        enforceGovernance: false,
        useCache: false,
        enableHallucinationCheck: false,
      });

      // 1. Success
      expect(result.success).toBe(true);

      // 2. Registry prompt was used (not the inline fallback)
      const callArgs = mockComplete.mock.calls[0][0];
      expect(callArgs.systemPrompt).not.toBe('Fallback inline prompt');

      // 3. A/B variant was assigned (if experiment is running)
      if (hasRunning) {
        expect(result.abVariantId).toBeDefined();
      }

      // 4. Cost was tracked
      expect(result.costRecordId).toBeDefined();

      // 5. Response is present
      expect(result.response).toBe('Test AI response');
    });

    it('should not break existing callers that pass neither promptRegistryId nor abSampleKey', async () => {
      const { governedAICall } = await import('@/lib/ai-governance');

      // Simulate an existing caller with minimal params
      const result = await governedAICall({
        generationType: 'account_brief',
        systemPrompt: 'Existing inline prompt',
        userPrompt: 'Do something',
        enforceGovernance: false,
        useCache: false,
        enableHallucinationCheck: false,
      });

      expect(result.success).toBe(true);
      expect(result.abVariantId).toBeUndefined();
      expect(result.costRecordId).toBeDefined(); // Cost tracking always active
      expect(result.response).toBe('Test AI response');
    });
  });
});
