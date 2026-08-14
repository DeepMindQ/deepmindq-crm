/**
 * Tests for Prompt Registry — versioned prompt management.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB
vi.mock('@/lib/db', () => ({
  db: {
    promptTemplate: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  getPrompt,
  getPromptWithVariables,
  listPrompts,
  seedDefaultPrompts,
} from '@/lib/prompt-registry';

describe('Prompt Registry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPrompt', () => {
    it('returns hardcoded fallback for "brief_summary"', async () => {
      const result = await getPrompt('brief_summary');
      expect(result.systemPrompt).toContain('revenue intelligence analyst');
      expect(result.label).toBe('Executive Brief Summary');
    });

    it('returns hardcoded fallback for "engagement_approach"', async () => {
      const result = await getPrompt('engagement_approach');
      expect(result.systemPrompt).toContain('STRUCTURED FACTS');
      expect(result.label).toBe('Engagement Approach');
    });

    it('returns hardcoded fallback for "reasoning_analyst"', async () => {
      const result = await getPrompt('reasoning_analyst');
      expect(result.systemPrompt).toContain('DeepMindQ');
      expect(result.systemPrompt).toContain('Enterprise Intelligence OS');
    });

    it('returns ultimate fallback for unknown keys', async () => {
      const result = await getPrompt('unknown_prompt_key');
      expect(result.systemPrompt).toBe('You are a helpful AI assistant.');
      expect(result.label).toBe('Default Fallback');
    });

    it('returns consistent structure', async () => {
      const result = await getPrompt('brief_summary');
      expect(result).toHaveProperty('systemPrompt');
      expect(result).toHaveProperty('label');
      expect(typeof result.systemPrompt).toBe('string');
    });
  });

  describe('getPromptWithVariables', () => {
    it('returns system prompt and empty user prompt when no template', async () => {
      const result = await getPromptWithVariables('brief_summary', {
        companyName: 'Acme Corp',
      });
      expect(result.systemPrompt).toContain('revenue intelligence');
      expect(result.userPrompt).toBe('');
    });

    it('interpolates variables into template', async () => {
      // Mock a DB prompt with template
      const { db } = await import('@/lib/db');
      vi.mocked(db.promptTemplate.findMany).mockResolvedValueOnce([
        {
          id: 'test-id',
          key: 'test_template',
          label: 'Test Template',
          systemPrompt: 'You are helpful.',
          userPromptTemplate: 'Analyze {{companyName}} in {{industry}}.',
          version: 1,
          isActive: true,
          isDefault: true,
          feature: null,
          model: null,
        },
      ]);

      const result = await getPromptWithVariables('test_template', {
        companyName: 'Acme Corp',
        industry: 'Technology',
      });
      expect(result.userPrompt).toBe('Analyze Acme Corp in Technology.');
    });
  });

  describe('listPrompts', () => {
    it('returns hardcoded prompts as virtual versions when DB empty', async () => {
      const result = await listPrompts();
      // Should include at least the 3 hardcoded prompts
      const keys = result.map((p) => p.key);
      expect(keys).toContain('brief_summary');
      expect(keys).toContain('engagement_approach');
      expect(keys).toContain('reasoning_analyst');
    });
  });

  describe('seedDefaultPrompts', () => {
    it('seeds prompts when none exist', async () => {
      const { db } = await import('@/lib/db');
      vi.mocked(db.promptTemplate.findUnique).mockResolvedValueOnce(null);
      vi.mocked(db.promptTemplate.create).mockResolvedValueOnce({});

      const count = await seedDefaultPrompts();
      expect(count).toBeGreaterThan(0);
    });

    it('skips prompts that already exist', async () => {
      const { db } = await import('@/lib/db');
      vi.mocked(db.promptTemplate.findUnique).mockResolvedValue({ id: 'existing' });

      const count = await seedDefaultPrompts();
      expect(count).toBe(0);
    });
  });
});
