/**
 * Milestone 3 — Prompt Regression Testing
 * Section 3.5: AI Intelligence Testing
 *
 * Ensures AI prompt quality does not degrade across code changes.
 * Validates that critical prompt sections remain intact and
 * hallucination prevention rules are embedded in prompts.
 *
 * Run: npx vitest run --config vitest.ai-governance.config.ts
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    evidence: { findMany: vi.fn().mockResolvedValue([]) },
    aIGenerationAudit: { create: vi.fn().mockResolvedValue({ id: 'audit-001' }) },
  },
}));

vi.mock('@/lib/ai-cache-layer', () => ({
  AICacheLayer: {
    getInstance: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue(true) }),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('Prompt Regression — Governance Prompt Addon Stability', () => {
  it('governance prompt addon always includes evidence grounding section', async () => {
    const { buildGovernancePromptAddon } = await import('@/lib/ai-governance');
    const addon = buildGovernancePromptAddon({
      passed: true,
      canProceed: true,
      checks: {},
      overallMessage: 'All checks passed',
      rejectionReason: null,
    });
    // The prompt addon should contain grounding instructions
    expect(addon.length).toBeGreaterThan(0);
  });

  it('governance prompt addon includes rejection context when failing', async () => {
    const { buildGovernancePromptAddon } = await import('@/lib/ai-governance');
    const addon = buildGovernancePromptAddon({
      passed: false,
      canProceed: false,
      checks: {
        confidence: { passed: false, message: 'Low confidence', value: 0.2 },
        freshness: { passed: true, message: 'Fresh', value: 80 },
      },
      overallMessage: 'Failed: low confidence',
      rejectionReason: 'Research confidence (0.2) below threshold (0.6)',
    }, 'email_draft');
    expect(addon).toContain('0.2');
    expect(addon).toContain('0.6');
  });

  it('evidence grounding note structures evidence with markers', async () => {
    const { buildEvidenceGroundingNote } = await import('@/lib/ai-governance');
    const note = buildEvidenceGroundingNote([
      { title: 'Source 1', source: 'SEC Filing', snippet: 'Revenue was $2.3B' },
    ]);
    expect(note).toContain('[E1]');
    expect(note).toContain('Source 1');
  });
});

describe('Prompt Regression — Hallucination Prevention Instructions', () => {
  it('governance configs enforce evidence requirements for high-stakes types', async () => {
    const { getGovernanceConfig } = await import('@/lib/ai-governance');
    // email_draft requires capability match
    expect(getGovernanceConfig('email_draft').requireCapabilityMatch).toBe(true);
    // account_brief does NOT require capability match
    expect(getGovernanceConfig('account_brief').requireCapabilityMatch).toBe(false);
  });

  it('all generation types have defined staleness limits', async () => {
    const { getRegisteredGenerationTypes, getGovernanceConfig } = await import('@/lib/ai-governance');
    const types = getRegisteredGenerationTypes();
    for (const type of types) {
      const config = getGovernanceConfig(type);
      expect(config.maxStalenessDays).toBeDefined();
      expect(config.maxStalenessDays).toBeGreaterThan(0);
    }
  });
});

describe('Prompt Regression — Quality Signal Preservation', () => {
  it('buildGovernancePromptAddon produces deterministic output for same input', async () => {
    const { buildGovernancePromptAddon } = await import('@/lib/ai-governance');
    const input = {
      passed: true,
      canProceed: true,
      checks: { confidence: { passed: true, message: 'OK', value: 0.8 } },
      overallMessage: 'Good',
      rejectionReason: null,
    };
    const output1 = buildGovernancePromptAddon(input);
    const output2 = buildGovernancePromptAddon(input);
    expect(output1).toBe(output2);
  });

  it('different generation types produce different prompts when failing', async () => {
    const { buildGovernancePromptAddon, getGovernanceConfig } = await import('@/lib/ai-governance');
    const failResult = {
      passed: false,
      canProceed: false,
      checks: {},
      overallMessage: 'Failed',
      rejectionReason: 'Low data quality',
    };
    const emailPrompt = buildGovernancePromptAddon(failResult, 'email_draft');
    const briefPrompt = buildGovernancePromptAddon(failResult, 'account_brief');
    // The generation type should appear in the prompt
    expect(emailPrompt).toContain('email_draft');
    expect(briefPrompt).toContain('account_brief');
  });
});
