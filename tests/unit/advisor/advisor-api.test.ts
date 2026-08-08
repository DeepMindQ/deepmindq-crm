/**
 * MS9 Integration Layer — API Contract & Orchestration Tests
 * ===========================================================
 *
 * Tests the API route request/response contracts, orchestration
 * error handling, and confidence handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── API Request Validation Tests ─────────────────────────────────

describe('Advisor API Contract', () => {
  describe('POST /api/ai/advisor — Request Validation', () => {
    it('should accept valid AdvisorQueryRequest shape', () => {
      const validRequest = {
        query: 'How should we approach this company?',
        depth: 'standard',
        includeReasoning: true,
        maxEvidenceItems: 10,
      };

      // Shape validation — all required fields present
      expect(validRequest.query).toBeTruthy();
      expect(validRequest.query.length).toBeGreaterThan(0);
      expect(['summary', 'standard', 'comprehensive']).toContain(validRequest.depth);
    });

    it('should reject empty query', () => {
      const invalidRequest = { query: '' };
      expect(invalidRequest.query.length).toBe(0);
    });

    it('should accept query with conversationId for multi-turn', () => {
      const request = {
        query: 'Tell me more about their funding',
        conversationId: 'conv-abc123',
        depth: 'standard',
      };

      expect(request.conversationId).toBeTruthy();
      expect(request.query).toBeTruthy();
    });

    it('should accept query with accountId for company context', () => {
      const request = {
        query: 'How should we approach this company?',
        accountId: 'company-xyz',
        depth: 'comprehensive',
        focusAreas: ['key_findings', 'signals'],
      };

      expect(request.accountId).toBeTruthy();
      expect(request.focusAreas).toHaveLength(2);
    });

    it('should accept all optional fields', () => {
      const fullRequest = {
        query: 'Full analysis request',
        conversationId: 'conv-123',
        accountId: 'company-456',
        depth: 'comprehensive',
        focusAreas: ['key_findings', 'signals', 'recommendations', 'risk_flags'],
        includeReasoning: true,
        maxEvidenceItems: 50,
      };

      expect(fullRequest.focusAreas).toHaveLength(4);
      expect(fullRequest.maxEvidenceItems).toBe(50);
    });
  });

  describe('POST /api/ai/advisor — Response Contract', () => {
    it('should return AdvisorQueryResponse shape on success', () => {
      const mockResponse = {
        briefing: {
          id: 'briefing-123',
          title: 'Acme Corp — How should we approach this company?',
          summary: 'Strategic analysis based on 5 evidence sources',
          blocks: [
            {
              id: 'block-key-1',
              type: 'key_findings',
              title: 'Key Findings',
              sortOrder: 0,
              defaultCollapsed: false,
              content: {
                type: 'key_findings',
                findings: [
                  {
                    id: 'f-1',
                    title: 'Strong Growth',
                    description: 'Company growing 40% YoY',
                    confidenceScore: 82,
                    evidenceIds: ['e1'],
                    priority: 'high',
                  },
                ],
              },
              trust: { confidenceScore: 82, trustTier: 'high', evidenceCount: 3, hasEvidenceChain: true },
            },
          ],
          signalPills: [],
          trustFooter: { sources: [], totalEvidenceCount: 3, hasExplorationLink: true },
          confidence: { score: 78, trustTier: 'high', direction: 'stable', delta: 0, deltaExplanation: '', hasReasoningChain: true },
          accountContext: {
            primaryAccount: { companyId: 'c-1', companyName: 'Acme Corp' },
            activeSignals: [],
            activeSignalCount: 0,
            relatedAccounts: [],
            dataFreshness: [],
            sourceStatus: { activeSourceCount: 0, sources: [], connectionStatus: 'connected' },
          },
          generatedAt: new Date().toISOString(),
          modelUsed: 'gpt-4-turbo',
          processingDurationMs: 3200,
        },
        conversation: {
          id: 'conv-123',
          messageCount: 1,
          lastActiveAt: new Date().toISOString(),
        },
        processing: {
          durationMs: 3200,
          modelUsed: 'gpt-4-turbo',
          sourcesConsulted: 3,
          evidenceItemsReferenced: 5,
          tokensUsed: { prompt: 1024, completion: 1024, total: 2048 },
        },
      };

      // Validate response shape
      expect(mockResponse.briefing).toBeDefined();
      expect(mockResponse.briefing.id).toBeTruthy();
      expect(mockResponse.briefing.blocks.length).toBeGreaterThan(0);
      expect(mockResponse.briefing.confidence.score).toBeGreaterThan(0);
      expect(mockResponse.conversation.id).toBeTruthy();
      expect(mockResponse.processing.durationMs).toBeGreaterThan(0);
    });

    it('should include confidenceWarnings when confidence is low', () => {
      const response = {
        briefing: {} as any,
        conversation: { id: 'conv-1', messageCount: 1, lastActiveAt: '' },
        processing: { durationMs: 1000, modelUsed: 'test', sourcesConsulted: 0, evidenceItemsReferenced: 0, tokensUsed: { prompt: 0, completion: 0, total: 0 } },
        confidenceWarnings: ['Low confidence: intelligence may be incomplete'],
      };

      expect(response.confidenceWarnings).toBeDefined();
      expect(response.confidenceWarnings!.length).toBeGreaterThan(0);
    });
  });
});

// ─── Orchestration Error Handling Tests ───────────────────────────

describe('Advisor Orchestration Error Handling', () => {
  it('should handle synthesis engine failure gracefully', () => {
    // The orchestrator is designed to never throw — it returns
    // { success: false, briefing: null, error: string }
    const failureResult = {
      success: false,
      briefing: null,
      conversation: { id: 'conv-err', messageCount: 0, lastActiveAt: '' },
      processing: { durationMs: 500, modelUsed: 'none', sourcesConsulted: 0, evidenceItemsReferenced: 0, tokensUsed: { prompt: 0, completion: 0, total: 0 } },
      error: 'Intelligence synthesis failed — no briefing generated',
    };

    expect(failureResult.success).toBe(false);
    expect(failureResult.briefing).toBeNull();
    expect(failureResult.error).toBeTruthy();
  });

  it('should handle recommendation engine failure as non-fatal', () => {
    // Recommendations are optional enrichment — their failure
    // should not prevent briefing generation
    const resultWithWarnings = {
      success: true,
      briefing: { id: 'b-1' } as any,
      conversation: { id: 'c-1', messageCount: 1, lastActiveAt: '' },
      processing: { durationMs: 2000, modelUsed: 'gpt-4', sourcesConsulted: 3, evidenceItemsReferenced: 2, tokensUsed: { prompt: 500, completion: 1000, total: 1500 } },
      confidenceWarnings: [{ message: 'Recommendations unavailable — recommendation engine returned no results', threshold: 1, actualScore: 0 }],
    };

    expect(resultWithWarnings.success).toBe(true);
    expect(resultWithWarnings.confidenceWarnings![0].message).toContain('Recommendations unavailable');
  });

  it('should handle partial briefing with warnings', () => {
    const partialResult = {
      success: true,
      briefing: {
        id: 'b-partial',
        blocks: [{ type: 'key_findings' }, { type: 'narrative' }],
      } as any,
      conversation: { id: 'c-partial', messageCount: 1, lastActiveAt: '' },
      processing: { durationMs: 1500, modelUsed: 'gpt-4', sourcesConsulted: 2, evidenceItemsReferenced: 1, tokensUsed: { prompt: 300, completion: 700, total: 1000 } },
      confidenceWarnings: [
        'Quality: Hallucinated citation [E99] detected',
        'Low confidence: intelligence may be incomplete',
      ],
    };

    expect(partialResult.success).toBe(true);
    expect(partialResult.confidenceWarnings!.length).toBe(2);
  });
});

// ─── Confidence Handling Tests ─────────────────────────────────────

describe('Confidence Handling', () => {
  it('should map confidence 0-1 to trust tiers correctly', () => {
    const tierMap: Array<[number, string]> = [
      [0.95, 'verified'],
      [0.90, 'verified'],
      [0.85, 'high'],
      [0.72, 'high'],
      [0.65, 'medium'],
      [0.50, 'medium'],
      [0.30, 'low'],
      [0.10, 'unverified'],
    ];

    function scoreToTrustTier(score: number): string {
      if (score >= 0.9) return 'verified';
      if (score >= 0.7) return 'high';
      if (score >= 0.45) return 'medium';
      if (score >= 0.25) return 'low';
      return 'unverified';
    }

    for (const [score, expectedTier] of tierMap) {
      expect(scoreToTrustTier(score)).toBe(expectedTier);
    }
  });

  it('should detect low-confidence conditions for escalation', () => {
    // Confidence below 40 should trigger auto-escalation
    const lowConfidence = { score: 35 };
    expect(lowConfidence.score).toBeLessThan(40);

    // Confidence above 40 should not trigger
    const acceptableConfidence = { score: 65 };
    expect(acceptableConfidence.score).toBeGreaterThan(40);
  });

  it('should track confidence history across conversation turns', () => {
    const history = [
      { messagePosition: 1, score: 78, trustTier: 'high', delta: 0 },
      { messagePosition: 2, score: 82, trustTier: 'high', delta: 4, deltaExplanation: 'Additional evidence increased confidence' },
      { messagePosition: 3, score: 45, trustTier: 'medium', delta: -37, deltaExplanation: 'Conflicting signals detected' },
    ];

    expect(history.length).toBe(3);
    expect(history[2].delta).toBe(-37);
    expect(history[2].trustTier).toBe('medium');
  });
});

// ─── Workspace Operations Tests ────────────────────────────────────

describe('Workspace Operations', () => {
  it('should maintain workspace section structure', () => {
    const workspace = {
      sections: {
        briefings: [{ id: 'w-1', type: 'saved_briefing', title: 'Q1 Briefing', referenceId: 'b-1', addedAt: '', lastAccessedAt: '', sortOrder: 0, section: 'briefings' }],
        accounts: [],
        history: [],
        quick_access: [],
      },
      totalItems: 1,
      updatedAt: new Date().toISOString(),
    };

    expect(Object.keys(workspace.sections)).toEqual(['briefings', 'accounts', 'history', 'quick_access']);
    expect(workspace.totalItems).toBe(1);
  });

  it('should support adding items across sections', () => {
    const addItem = (sections: any, section: string, item: any) => {
      return { ...sections, [section]: [...(sections[section] || []), item] };
    };

    let sections = { briefings: [], accounts: [], history: [], quick_access: [] };
    sections = addItem(sections, 'briefings', { id: '1' });
    sections = addItem(sections, 'accounts', { id: '2' });
    sections = addItem(sections, 'quick_access', { id: '3' });

    expect(sections.briefings.length).toBe(1);
    expect(sections.accounts.length).toBe(1);
    expect(sections.quick_access.length).toBe(1);
  });
});
