/**
 * Tests for Model Router — circuit breaker, task classification, model selection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock ai-config before importing model-router
vi.mock('@/lib/ai-config', () => ({
  getLLMChain: vi.fn(),
}));

import {
  classifyTask,
  isProviderAvailable,
  recordSuccess,
  recordFailure,
  resetAllCircuits,
  getPerformanceStats,
} from '@/lib/engines/model-router';

describe('Model Router', () => {
  beforeEach(() => {
    resetAllCircuits();
  });

  describe('Task Classification', () => {
    it('classifies JSON extraction tasks as "structured"', () => {
      expect(classifyTask('You are helpful.', 'Extract JSON from this data')).toBe('structured');
    });

    it('classifies classification tasks as "classification"', () => {
      expect(classifyTask('System', 'Classify the priority of this signal')).toBe('classification');
      expect(classifyTask('System', 'Categorize this company by industry')).toBe('classification');
    });

    it('classifies summarization tasks as "summarization"', () => {
      expect(classifyTask('System', 'Summarize this company profile')).toBe('summarization');
      expect(classifyTask('System', 'Create a brief executive summary')).toBe('summarization');
    });

    it('classifies analytical tasks as "analytical"', () => {
      expect(classifyTask('System', 'Analyze this intelligence and provide insights')).toBe(
        'analytical',
      );
      expect(classifyTask('System', 'Assess the risk factors')).toBe('analytical');
    });

    it('classifies creative tasks as "creative"', () => {
      expect(classifyTask('System', 'Write an outreach message to this contact')).toBe('creative');
      expect(classifyTask('System', 'Draft an engagement approach')).toBe('creative');
    });

    it('classifies unknown tasks as "conversational"', () => {
      expect(classifyTask('Hello', 'What is the weather?')).toBe('conversational');
    });
  });

  describe('Circuit Breaker', () => {
    it('starts with all providers available', () => {
      expect(isProviderAvailable('OpenAI')).toBe(true);
      expect(isProviderAvailable('Anthropic')).toBe(true);
    });

    it('remains available after a few failures', () => {
      for (let i = 0; i < 4; i++) {
        recordFailure('OpenAI');
      }
      expect(isProviderAvailable('OpenAI')).toBe(true);
    });

    it('opens circuit after threshold failures', () => {
      for (let i = 0; i < 5; i++) {
        recordFailure('OpenAI');
      }
      expect(isProviderAvailable('OpenAI')).toBe(false);
    });

    it('keeps other providers available when one opens', () => {
      for (let i = 0; i < 5; i++) {
        recordFailure('OpenAI');
      }
      expect(isProviderAvailable('Anthropic')).toBe(true);
      expect(isProviderAvailable('Gemini')).toBe(true);
    });

    it('reduces failure count on success', () => {
      recordFailure('OpenAI');
      recordFailure('OpenAI');
      recordSuccess('OpenAI');
      // Should not be open yet (was 2, decremented to 1)
      expect(isProviderAvailable('OpenAI')).toBe(true);
    });
  });

  describe('Performance Stats', () => {
    it('returns empty stats initially', () => {
      const stats = getPerformanceStats();
      expect(stats).toHaveLength(0);
    });

    it('tracks success and failure counts', () => {
      recordSuccess('OpenAI');
      recordSuccess('OpenAI');
      recordFailure('OpenAI');
      recordFailure('OpenAI');
      recordFailure('OpenAI');

      const stats = getPerformanceStats();
      expect(stats).toHaveLength(1);
      expect(stats[0].provider).toBe('OpenAI');
      expect(stats[0].successCalls).toBe(2);
      expect(stats[0].failedCalls).toBe(3);
      expect(stats[0].totalCalls).toBe(5);
    });
  });
});
