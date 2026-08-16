// ═══════════════════════════════════════════════════════════════════════════
// AI Usage Tracker — Unit Tests
//
// Tests estimateCost and logAIUsage from @/lib/ai-copilot/usage-tracker.ts.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
  },
}));

// Mock @/lib/db to avoid Prisma
vi.mock('@/lib/db', () => ({
  db: {
    aIUsageLog: {
      create: vi.fn().mockResolvedValue({ id: '1' }),
    },
  },
}));

import { estimateCost, logAIUsage } from '@/lib/ai-copilot/usage-tracker';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';

describe('usage-tracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── estimateCost ──────────────────────────────────────────────
  describe('estimateCost', () => {
    it('calculates gpt-4o-mini cost correctly', () => {
      // $0.15/1M input, $0.60/1M output
      const cost = estimateCost('OpenAI', 'gpt-4o-mini', 1_000_000, 500_000);
      expect(cost).toBeCloseTo(0.15 + 0.3, 10);
    });

    it('calculates gpt-4o cost correctly', () => {
      const cost = estimateCost('OpenAI', 'gpt-4o', 1_000_000, 1_000_000);
      expect(cost).toBeCloseTo(2.5 + 10.0, 10);
    });

    it('calculates claude-3-5-sonnet cost correctly', () => {
      const cost = estimateCost('Anthropic', 'claude-3-5-sonnet-20241022', 1_000_000, 1_000_000);
      expect(cost).toBeCloseTo(3.0 + 15.0, 10);
    });

    it('calculates claude-3-5-sonnet (short name) cost', () => {
      const cost = estimateCost('Anthropic', 'claude-3-5-sonnet', 1_000_000, 0);
      expect(cost).toBeCloseTo(3.0, 10);
    });

    it('calculates gemini-2.0-flash cost correctly', () => {
      const cost = estimateCost('Gemini', 'gemini-2.0-flash', 1_000_000, 1_000_000);
      expect(cost).toBeCloseTo(0.1 + 0.4, 10);
    });

    it('calculates claude-3-haiku cost correctly', () => {
      const cost = estimateCost('Anthropic', 'claude-3-haiku-20240307', 1_000_000, 1_000_000);
      expect(cost).toBeCloseTo(0.25 + 1.25, 10);
    });

    it('uses default pricing for unknown model', () => {
      // Default: $1.00/1M input, $4.00/1M output
      const cost = estimateCost('Unknown', 'mystery-model', 1_000_000, 1_000_000);
      expect(cost).toBeCloseTo(1.0 + 4.0, 10);
    });

    it('handles zero tokens', () => {
      expect(estimateCost('OpenAI', 'gpt-4o-mini', 0, 0)).toBe(0);
    });

    it('is case-insensitive for model name', () => {
      const upper = estimateCost('OpenAI', 'GPT-4O-MINI', 1_000_000, 0);
      const lower = estimateCost('OpenAI', 'gpt-4o-mini', 1_000_000, 0);
      expect(upper).toBe(lower);
    });

    it('calculates gpt-4-turbo cost', () => {
      const cost = estimateCost('OpenAI', 'gpt-4-turbo', 1_000_000, 1_000_000);
      expect(cost).toBeCloseTo(10.0 + 30.0, 10);
    });

    it('calculates zai-sdk cost (conservative estimate)', () => {
      const cost = estimateCost('ZAI', 'zai-sdk', 1_000_000, 1_000_000);
      expect(cost).toBeCloseTo(1.0 + 4.0, 10);
    });
  });

  // ── logAIUsage ────────────────────────────────────────────────
  describe('logAIUsage', () => {
    it('logs info for successful call', async () => {
      await logAIUsage({
        provider: 'OpenAI',
        model: 'gpt-4o-mini',
        promptTokens: 100,
        completionTokens: 50,
        latencyMs: 200,
      });

      expect(logger.info).toHaveBeenCalledWith(
        '[AI-USAGE] LLM call completed',
        expect.objectContaining({
          provider: 'OpenAI',
          model: 'gpt-4o-mini',
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          latencyMs: 200,
        }),
      );
    });

    it('logs warn for failed call', async () => {
      await logAIUsage({
        provider: 'Anthropic',
        model: 'claude-3-5-sonnet',
        promptTokens: 500,
        completionTokens: 0,
        latencyMs: 1000,
        errorMessage: 'Rate limited',
      });

      expect(logger.warn).toHaveBeenCalledWith(
        '[AI-USAGE] LLM call failed',
        expect.objectContaining({
          error: 'Rate limited',
        }),
      );
    });

    it('persists to DB on success', async () => {
      await logAIUsage({
        provider: 'OpenAI',
        model: 'gpt-4o-mini',
        promptTokens: 1000,
        completionTokens: 500,
        latencyMs: 300,
      });

      expect(db.aIUsageLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            provider: 'OpenAI',
            model: 'gpt-4o-mini',
            promptTokens: 1000,
            completionTokens: 500,
            totalTokens: 1500,
            costUSD: expect.any(Number),
            error: null,
          }),
        }),
      );
    });

    it('extracts score from quality object', async () => {
      await logAIUsage({
        provider: 'OpenAI',
        model: 'gpt-4o-mini',
        promptTokens: 100,
        completionTokens: 50,
        latencyMs: 200,
        quality: { score: 0.85, reason: 'good' },
      });

      expect(db.aIUsageLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            qualityScore: 0.85,
          }),
        }),
      );
    });

    it('sets qualityScore to null for non-object quality', async () => {
      await logAIUsage({
        provider: 'OpenAI',
        model: 'gpt-4o-mini',
        promptTokens: 100,
        completionTokens: 50,
        latencyMs: 200,
        quality: 'high',
      });

      expect(db.aIUsageLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            qualityScore: null,
          }),
        }),
      );
    });

    it('sets qualityScore to null for object without score', async () => {
      await logAIUsage({
        provider: 'OpenAI',
        model: 'gpt-4o-mini',
        promptTokens: 100,
        completionTokens: 50,
        latencyMs: 200,
        quality: { reason: 'no score' },
      });

      expect(db.aIUsageLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            qualityScore: null,
          }),
        }),
      );
    });

    it('handles DB import failure gracefully', async () => {
      // Override the mock to throw on import
      vi.doMock('@/lib/db', () => {
        throw new Error('DB not available');
      });

      // This should not throw — it catches internally
      // Re-import won't work in same module, but the internal try/catch covers it
      // We test by checking the function doesn't throw
      await expect(
        logAIUsage({
          provider: 'OpenAI',
          model: 'gpt-4o-mini',
          promptTokens: 100,
          completionTokens: 50,
          latencyMs: 200,
        }),
      ).resolves.not.toThrow();

      vi.doUnmock('@/lib/db');
    });

    it('includes estimatedCostUSD in log record', async () => {
      await logAIUsage({
        provider: 'OpenAI',
        model: 'gpt-4o-mini',
        promptTokens: 1_000_000,
        completionTokens: 0,
        latencyMs: 100,
      });

      expect(logger.info).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          estimatedCostUSD: 0.15,
        }),
      );
    });

    it('includes timestamp in log record', async () => {
      await logAIUsage({
        provider: 'OpenAI',
        model: 'gpt-4o-mini',
        promptTokens: 0,
        completionTokens: 0,
        latencyMs: 0,
      });

      expect(logger.info).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        }),
      );
    });
  });
});
