/**
 * Tests for AI Governance — rate limiting, cost budgets, governedAICall wrapper.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/lib/llm-client', () => ({
  callLLM: vi.fn().mockResolvedValue('LLM response'),
  callAI: vi.fn().mockResolvedValue({
    raw: 'AI response',
    parsed: null,
    quality: { score: 85, issues: [], passed: true },
    success: true,
    latencyMs: 100,
  }),
  callLLMWithUsage: vi.fn().mockResolvedValue({
    text: 'LLM response',
    usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
  }),
}));

vi.mock('@/lib/ai-copilot/quality-gates', () => ({
  runQualityGates: vi.fn().mockResolvedValue({ score: 85, issues: [], passed: true }),
  formatQualityReportForLog: vi.fn().mockReturnValue('quality:pass:85'),
}));

vi.mock('@/lib/ai-cache-layer', () => ({
  AICacheLayer: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/ai-copilot/usage-tracker', () => ({
  logAIUsage: vi.fn().mockResolvedValue(undefined),
  estimateCost: vi.fn().mockReturnValue(0.001),
}));

vi.mock('@/lib/token-counter', () => ({
  countTokens: vi.fn().mockResolvedValue(50),
}));

vi.mock('@/lib/ai-config', () => ({
  getLLMChain: vi.fn().mockResolvedValue([
    {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'test-key',
      model: 'gpt-4o-mini',
      label: 'OpenAI',
    },
  ]),
}));

import { checkRateLimit, governedAICall } from '@/lib/ai-governance';

describe('AI Governance', () => {
  describe('Rate Limiting', () => {
    beforeEach(() => {
      // Rate limit state is module-scoped — we can't easily reset it between tests
      // but we can use unique feature names to avoid cross-test interference
    });

    it('allows calls within rate limit', () => {
      const result = checkRateLimit('unique-feature-test-1', 'user-1', 5, 60000);
      expect(result).toBe(true);
    });

    it('rate limits when threshold exceeded', () => {
      // Exhaust the limit
      for (let i = 0; i < 5; i++) {
        checkRateLimit('unique-feature-test-2', 'user-2', 5, 60000);
      }
      // Next call should be rate limited
      const result = checkRateLimit('unique-feature-test-2', 'user-2', 5, 60000);
      expect(result).toBe(false);
    });

    it('separates rate limits by user', () => {
      // Exhaust limit for user-1
      for (let i = 0; i < 5; i++) {
        checkRateLimit('unique-feature-test-3', 'user-a', 5, 60000);
      }
      // User-2 should still be allowed
      const result = checkRateLimit('unique-feature-test-3', 'user-b', 5, 60000);
      expect(result).toBe(true);
    });

    it('separates rate limits by feature', () => {
      // Exhaust limit for feature-a
      for (let i = 0; i < 5; i++) {
        checkRateLimit('unique-feature-test-4', 'user-1', 5, 60000);
      }
      // feature-b should still be allowed
      const result = checkRateLimit('unique-feature-test-5', 'user-1', 5, 60000);
      expect(result).toBe(true);
    });
  });

  describe('Governed AI Call', () => {
    it('returns rate limited result when rate limit exceeded', async () => {
      // Exhaust rate limit
      for (let i = 0; i < 60; i++) {
        checkRateLimit('rate-limit-test', 'user-rl', 60, 60000);
      }
      const result = await governedAICall({
        feature: 'rate-limit-test',
        userId: 'user-rl',
        systemPrompt: 'You are helpful.',
        userPrompt: 'Hello',
      });
      expect(result.rateLimited).toBe(true);
      if (result.rateLimited) {
        expect(result.retryAfterMs).toBeGreaterThan(0);
      }
    });

    it('returns LLM response when within rate limit', async () => {
      const result = await governedAICall({
        feature: 'governed-call-test',
        systemPrompt: 'You are helpful.',
        userPrompt: 'Say hello',
        cacheResponse: false, // skip cache for this test
      });

      if (!result.rateLimited) {
        expect(result.text).toBe('LLM response');
        expect(result.latencyMs).toBeGreaterThanOrEqual(0);
        expect(result.feature).toBe('governed-call-test');
      }
    });
  });
});
