/**
 * WI-16D Tests — Prompt Registry
 */

import { describe, it, expect } from 'vitest';
import {
  getPrompt,
  getSystemPrompt,
  buildUserPrompt,
  listPrompts,
  listCategories,
  addPromptVersion,
  rollbackPromptVersion,
  getRegistryStats,
} from '@/lib/ai-prompt-registry';

describe('WI-16D: Prompt Registry', () => {
  describe('getPrompt', () => {
    it('retrieves registered prompts', () => {
      const prompt = getPrompt('synthesis_account_brief');
      expect(prompt).not.toBeNull();
      expect(prompt!.id).toBe('synthesis_account_brief');
      expect(prompt!.category).toBe('company_analysis');
      expect(prompt!.tier).toBe('deep');
    });

    it('returns null for non-existent prompts', () => {
      const prompt = getPrompt('non_existent_prompt');
      expect(prompt).toBeNull();
    });
  });

  describe('getSystemPrompt', () => {
    it('returns the active version system prompt', () => {
      const prompt = getSystemPrompt('synthesis_account_brief');
      expect(typeof prompt).toBe('string');
      expect(prompt!.length).toBeGreaterThan(50);
      expect(prompt).toContain('senior account strategist');
    });

    it('returns null for non-existent prompts', () => {
      const prompt = getSystemPrompt('non_existent');
      expect(prompt).toBeNull();
    });
  });

  describe('buildUserPrompt', () => {
    it('returns null for prompts without user template', () => {
      const prompt = buildUserPrompt('synthesis_account_brief', {});
      expect(prompt).toBeNull();
    });
  });

  describe('listPrompts', () => {
    it('lists all prompts', () => {
      const prompts = listPrompts();
      expect(prompts.length).toBeGreaterThanOrEqual(10);
    });

    it('filters by category', () => {
      const prompts = listPrompts({ category: 'email_generation' });
      expect(prompts.length).toBeGreaterThanOrEqual(1);
      expect(prompts.every(p => p.category === 'email_generation')).toBe(true);
    });
  });

  describe('listCategories', () => {
    it('returns category summary', () => {
      const categories = listCategories();
      expect(categories.length).toBeGreaterThan(0);
      expect(categories[0].count).toBeGreaterThan(0);
    });
  });

  describe('addPromptVersion', () => {
    it('adds a new version and deactivates old', () => {
      const prompt = getPrompt('synthesis_account_brief')!;
      const oldActiveCount = prompt.versions.filter(v => v.active).length;
      expect(oldActiveCount).toBe(1);

      const result = addPromptVersion('synthesis_account_brief', {
        version: '2.0',
        systemPrompt: 'Updated prompt for testing versioning.',
        changelog: 'Test version upgrade',
      });
      expect(result).toBe(true);

      const updated = getPrompt('synthesis_account_brief')!;
      expect(updated.currentVersion).toBe('2.0');
      const activeVersions = updated.versions.filter(v => v.active);
      expect(activeVersions).toHaveLength(1);
      expect(activeVersions[0].version).toBe('2.0');

      // Rollback for test cleanup
      rollbackPromptVersion('synthesis_account_brief', '1.0');
    });
  });

  describe('rollbackPromptVersion', () => {
    it('rolls back to a previous version', () => {
      addPromptVersion('scoring_narrative', {
        version: '2.0',
        systemPrompt: 'New version',
        changelog: 'Test',
      });

      const result = rollbackPromptVersion('scoring_narrative', '1.0');
      expect(result).toBe(true);

      const prompt = getPrompt('scoring_narrative')!;
      expect(prompt.currentVersion).toBe('1.0');
    });

    it('returns false for non-existent version', () => {
      const result = rollbackPromptVersion('scoring_narrative', 'v99');
      expect(result).toBe(false);
    });
  });

  describe('getRegistryStats', () => {
    it('returns registry statistics', () => {
      const stats = getRegistryStats();
      expect(stats.totalPrompts).toBeGreaterThan(0);
      expect(stats.totalVersions).toBeGreaterThanOrEqual(stats.totalPrompts);
      expect(stats.categories.length).toBeGreaterThan(0);
    });
  });
});
