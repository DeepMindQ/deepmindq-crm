/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mocks ─────────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  db: {
    organization: { findUnique: vi.fn() },
    insight: { create: vi.fn() },
    signal: { create: vi.fn(), updateMany: vi.fn() },
    evidence: { updateMany: vi.fn() },
    briefing: { updateMany: vi.fn(), create: vi.fn() },
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

vi.mock('@/lib/llm-client', () => ({
  callLLM: vi.fn(),
}));

vi.mock('@/lib/ai-governance', () => ({
  governedAICall: vi.fn(),
}));

import { db } from '@/lib/db';
import { callLLM } from '@/lib/llm-client';
import { governedAICall } from '@/lib/ai-governance';
import {
  reasonAboutOrganization,
  storeInsights,
  runIntelligencePipeline,
  type ReasoningResult,
} from '@/lib/intelligence/reasoning/engine';

const mockedDb = vi.mocked(db);
const mockedCallLLM = vi.mocked(callLLM);
const mockGovernedAICall = vi.mocked(governedAICall);

// ─── Helpers ───────────────────────────────────────────────────────────

function makeMockOrg(overrides: Record<string, unknown> = {}) {
  return {
    id: 'org-1',
    name: 'Acme Corp',
    industry: null,
    domain: null,
    employeeCount: null,
    revenue: null,
    people: [],
    signals: [],
    evidence: [],
    insights: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── reasonAboutOrganization ────────────────────────────────────────────

describe('reasonAboutOrganization', () => {
  it('returns empty array when org not found', async () => {
    mockedDb.organization.findUnique.mockResolvedValue(null);

    const result = await reasonAboutOrganization('nonexistent');
    expect(result).toEqual([]);
  });

  it('uses template reasoning when no API key set', async () => {
    const originalKey = process.env.OPENAI_API_KEY;
    const originalLLMKey = process.env.LLM_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.LLM_API_KEY;

    mockedDb.organization.findUnique.mockResolvedValue(
      makeMockOrg({
        signals: [
          {
            id: 'sig-1',
            signalType: 'financial_indicator',
            severity: 'high',
            title: 'Big company',
            description: 'Large enterprise',
            confidenceScore: 85,
            impactScore: 75,
            status: 'detected',
          },
        ],
      }),
    );

    const results = await reasonAboutOrganization('org-1');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].insight.reasoningMethod).toBe('template');

    process.env.OPENAI_API_KEY = originalKey;
    process.env.LLM_API_KEY = originalLLMKey;
  });

  it('generates opportunity insight via template for org with signals and people', async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.LLM_API_KEY;

    mockedDb.organization.findUnique.mockResolvedValue(
      makeMockOrg({
        people: [{ fullName: 'Alice', title: 'CEO', role: 'executive' }],
        signals: [
          {
            id: 's1',
            signalType: 'financial_indicator',
            severity: 'high',
            title: 'Revenue $100M',
            description: 'High revenue',
            confidenceScore: 80,
            impactScore: 70,
            status: 'detected',
          },
        ],
      }),
    );

    const results = await reasonAboutOrganization('org-1');

    const opportunity = results.find((r) => r.insight.title.includes('Opportunity assessment'));
    expect(opportunity).toBeDefined();
    expect(opportunity!.insight.category).toBe('opportunity');
    expect(opportunity!.insight.confidenceScore).toBeGreaterThan(0);
    expect(opportunity!.insight.reasoningMethod).toBe('template');
  });

  it('template reasoning generates financial_indicator insight correctly', async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.LLM_API_KEY;

    mockedDb.organization.findUnique.mockResolvedValue(
      makeMockOrg({
        revenue: '$500M',
        employeeCount: 2000,
        signals: [
          {
            id: 's1',
            signalType: 'financial_indicator',
            severity: 'high',
            title: 'Revenue signal',
            description: 'Large revenue company',
            confidenceScore: 80,
            impactScore: 70,
            status: 'detected',
          },
        ],
      }),
    );

    const results = await reasonAboutOrganization('org-1');
    const financial = results.find((r) => r.insight.title === 'Financial capacity analysis');
    expect(financial).toBeDefined();
    expect(financial!.insight.category).toBe('opportunity');
    expect(financial!.insight.narrative).toContain('Acme Corp');
    expect(financial!.insight.narrative).toContain('$500M');
    expect(financial!.insight.recommendation).toBeTruthy();
  });

  it('template reasoning generates customer_signal insight for single contact', async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.LLM_API_KEY;

    mockedDb.organization.findUnique.mockResolvedValue(
      makeMockOrg({
        people: [{ fullName: 'Jane Doe', title: 'CEO', role: 'executive' }],
        signals: [
          {
            id: 's1',
            signalType: 'customer_signal',
            severity: 'medium',
            title: 'Single contact',
            description: 'Only one known contact',
            confidenceScore: 90,
            impactScore: 60,
            status: 'detected',
          },
        ],
      }),
    );

    const results = await reasonAboutOrganization('org-1');
    const customer = results.find((r) => r.insight.title === 'Relationship coverage');
    expect(customer).toBeDefined();
    expect(customer!.insight.category).toBe('risk');
    expect(customer!.insight.recommendation).toContain('Expand');
  });

  it('template reasoning generates leadership_change insight', async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.LLM_API_KEY;

    mockedDb.organization.findUnique.mockResolvedValue(
      makeMockOrg({
        people: [
          { fullName: 'Alice', title: 'CEO', role: 'executive' },
          { fullName: 'Bob', title: 'CTO', role: 'vice_president' },
        ],
        signals: [
          {
            id: 's1',
            signalType: 'leadership_change',
            severity: 'medium',
            title: 'Execs detected',
            description: 'Multiple exec contacts',
            confidenceScore: 80,
            impactScore: 70,
            status: 'detected',
          },
        ],
      }),
    );

    const results = await reasonAboutOrganization('org-1');
    const leadership = results.find((r) => r.insight.title === 'Leadership intelligence');
    expect(leadership).toBeDefined();
    expect(leadership!.insight.category).toBe('recommendation');
    expect(leadership!.insight.narrative).toContain('leadership');
  });

  it('template reasoning handles unknown signal type with default template', async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.LLM_API_KEY;

    mockedDb.organization.findUnique.mockResolvedValue(
      makeMockOrg({
        signals: [
          {
            id: 's1',
            signalType: 'social_mention',
            severity: 'low',
            title: 'Tweeted',
            description: 'Was mentioned on social',
            confidenceScore: 40,
            impactScore: 20,
            status: 'detected',
          },
        ],
      }),
    );

    const results = await reasonAboutOrganization('org-1');
    const social = results.find((r) => r.insight.title === 'social_mention analysis');
    expect(social).toBeDefined();
    expect(social!.insight.category).toBe('recommendation');
    expect(social!.insight.recommendation).toContain('Monitor');
  });

  it('template reasoning returns only opportunity insight when no signals', async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.LLM_API_KEY;

    mockedDb.organization.findUnique.mockResolvedValue(
      makeMockOrg({
        people: [{ fullName: 'Alice', title: null, role: 'employee' }],
        signals: [],
      }),
    );

    const results = await reasonAboutOrganization('org-1');
    // Only opportunity insight, no signal-type insights
    expect(results).toHaveLength(1);
    expect(results[0].insight.title).toContain('Opportunity assessment');
  });

  it('LLM reasoning path: returns parsed results from governedAICall', async () => {
    process.env.OPENAI_API_KEY = 'test-key';

    mockedDb.organization.findUnique.mockResolvedValue(
      makeMockOrg({
        signals: [
          {
            id: 's1',
            signalType: 'financial_indicator',
            severity: 'high',
            title: 'Big company',
            description: 'Large enterprise',
            confidenceScore: 80,
            impactScore: 70,
            status: 'detected',
          },
        ],
      }),
    );

    mockGovernedAICall.mockResolvedValue({
      text: JSON.stringify([
        {
          category: 'opportunity',
          title: 'LLM Insight',
          narrative: 'Generated by LLM',
          recommendation: 'Take action',
          suggestedMessage: 'Hello',
          confidence: 'high',
          confidenceScore: 82,
        },
      ]),
      rateLimited: false,
      cached: false,
      usage: null,
      provider: 'test',
      model: 'test-model',
      costUSD: 0.01,
      feature: 'reasoning',
      latencyMs: 100,
    } as any);

    const results = await reasonAboutOrganization('org-1');
    expect(results).toHaveLength(1);
    expect(results[0].insight.title).toBe('LLM Insight');
    expect(results[0].insight.reasoningMethod).toBe('llm');

    delete process.env.OPENAI_API_KEY;
  });

  it('LLM reasoning falls back to direct callLLM when rate limited', async () => {
    process.env.OPENAI_API_KEY = 'test-key';

    mockedDb.organization.findUnique.mockResolvedValue(
      makeMockOrg({
        signals: [
          {
            id: 's1',
            signalType: 'financial_indicator',
            severity: 'high',
            title: 'Big company',
            description: 'Large',
            confidenceScore: 80,
            impactScore: 70,
            status: 'detected',
          },
        ],
      }),
    );

    mockGovernedAICall.mockResolvedValue({
      text: '',
      rateLimited: true,
      cached: false,
      usage: null,
      quality: undefined,
      provider: '',
      model: '',
      costUSD: 0,
      feature: 'reasoning',
      latencyMs: 0,
      retryAfterMs: 1000,
    } as any);

    mockedCallLLM.mockResolvedValue(
      JSON.stringify([
        {
          category: 'opportunity',
          title: 'Direct LLM Insight',
          narrative: 'From direct call',
          recommendation: 'Act now',
          suggestedMessage: 'Hi',
          confidence: 'medium',
          confidenceScore: 55,
        },
      ]),
    );

    const results = await reasonAboutOrganization('org-1');
    expect(results).toHaveLength(1);
    expect(results[0].insight.reasoningMethod).toBe('llm');
    expect(mockedCallLLM).toHaveBeenCalled();

    delete process.env.OPENAI_API_KEY;
  });

  it('LLM reasoning falls back to templates on parse failure', async () => {
    process.env.OPENAI_API_KEY = 'test-key';

    mockedDb.organization.findUnique.mockResolvedValue(
      makeMockOrg({
        signals: [
          {
            id: 's1',
            signalType: 'financial_indicator',
            severity: 'high',
            title: 'Big company',
            description: 'Large',
            confidenceScore: 80,
            impactScore: 70,
            status: 'detected',
          },
        ],
      }),
    );

    mockGovernedAICall.mockResolvedValue({
      text: 'This is not valid JSON at all',
      rateLimited: false,
      cached: false,
      usage: null,
      provider: 'test',
      model: 'test',
      costUSD: 0,
      feature: 'reasoning',
      latencyMs: 50,
    } as any);

    const results = await reasonAboutOrganization('org-1');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].insight.reasoningMethod).toBe('template');

    delete process.env.OPENAI_API_KEY;
  });

  it('LLM reasoning falls back to templates when governedAICall throws', async () => {
    process.env.OPENAI_API_KEY = 'test-key';

    mockedDb.organization.findUnique.mockResolvedValue(
      makeMockOrg({
        signals: [
          {
            id: 's1',
            signalType: 'financial_indicator',
            severity: 'high',
            title: 'Big company',
            description: 'Large',
            confidenceScore: 80,
            impactScore: 70,
            status: 'detected',
          },
        ],
      }),
    );

    mockGovernedAICall.mockRejectedValue(new Error('Governance down'));
    mockedCallLLM.mockRejectedValue(new Error('LLM down'));

    const results = await reasonAboutOrganization('org-1');
    expect(results.length).toBeGreaterThan(0);
    // Both LLM paths failed, should fall back to templates
    expect(results[0].insight.reasoningMethod).toBe('template');

    delete process.env.OPENAI_API_KEY;
  });
});

// ─── storeInsights ──────────────────────────────────────────────────────

describe('storeInsights', () => {
  it('stores each insight via db.insight.create', async () => {
    mockedDb.insight.create.mockResolvedValue({} as any);

    const results: ReasoningResult[] = [
      {
        insight: {
          category: 'opportunity',
          title: 'Test insight 1',
          narrative: 'Narrative 1',
          recommendation: 'Rec 1',
          suggestedMessage: 'Msg 1',
          confidence: 'high',
          confidenceScore: 80,
          evidenceIds: ['e1'],
          reasoningMethod: 'template',
        },
      },
      {
        insight: {
          category: 'risk',
          title: 'Test insight 2',
          narrative: 'Narrative 2',
          recommendation: 'Rec 2',
          suggestedMessage: 'Msg 2',
          confidence: 'medium',
          confidenceScore: 55,
          evidenceIds: ['e2'],
          reasoningMethod: 'template',
        },
      },
    ];

    const count = await storeInsights('org-1', results);
    expect(count).toBe(2);
    expect(mockedDb.insight.create).toHaveBeenCalledTimes(2);
  });

  it('returns 0 for empty results', async () => {
    const count = await storeInsights('org-1', []);
    expect(count).toBe(0);
    expect(mockedDb.insight.create).not.toHaveBeenCalled();
  });

  it('passes correct data to db.insight.create', async () => {
    mockedDb.insight.create.mockResolvedValue({} as any);

    const results: ReasoningResult[] = [
      {
        insight: {
          category: 'opportunity',
          title: 'Title',
          narrative: 'N',
          recommendation: 'R',
          suggestedMessage: 'M',
          confidence: 'high',
          confidenceScore: 80,
          evidenceIds: ['e1', 'e2'],
          reasoningMethod: 'llm',
        },
      },
    ];

    await storeInsights('org-1', results);

    expect(mockedDb.insight.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          category: 'opportunity',
          title: 'Title',
          confidence: 'high',
          confidenceScore: 80,
          reasoningMethod: 'llm',
          status: 'active',
        }),
      }),
    );
  });
});

// ─── runIntelligencePipeline ───────────────────────────────────────────

describe('runIntelligencePipeline', () => {
  it('runs full pipeline and returns counts', async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.LLM_API_KEY;

    // detectSignalsForOrganization returns signals
    mockedDb.organization.findUnique
      .mockResolvedValueOnce(
        makeMockOrg({
          employeeCount: 1000,
          signals: [],
          people: [],
        }),
      )
      // reasonAboutOrganization queries org
      .mockResolvedValueOnce(
        makeMockOrg({
          signals: [
            {
              id: 's1',
              signalType: 'financial_indicator',
              severity: 'high',
              title: 'Big co',
              description: 'Large',
              confidenceScore: 85,
              impactScore: 75,
              status: 'detected',
            },
          ],
        }),
      )
      // generateBriefing queries org
      .mockResolvedValueOnce(
        makeMockOrg({
          signals: [
            {
              id: 's1',
              signalType: 'financial_indicator',
              severity: 'high',
              title: 'Big co',
              description: 'Large',
              confidenceScore: 85,
              impactScore: 75,
              status: 'detected',
            },
          ],
          insights: [
            {
              id: 'i1',
              title: 'Test insight',
              recommendation: 'Do X',
              confidenceScore: 70,
              status: 'active',
            },
          ],
        }),
      );

    mockedDb.signal.create.mockResolvedValue({} as any);
    mockedDb.insight.create.mockResolvedValue({} as any);
    mockedDb.briefing.updateMany.mockResolvedValue({ count: 0 } as any);
    mockedDb.briefing.create.mockResolvedValue({} as any);

    const result = await runIntelligencePipeline('org-1');

    expect(result).toHaveProperty('signalsDetected');
    expect(result).toHaveProperty('insightsGenerated');
    expect(result).toHaveProperty('briefingGenerated');
    expect(result.briefingGenerated).toBe(true);
  });

  it('handles briefing generation failure gracefully', async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.LLM_API_KEY;

    // First call: signal detection (org exists)
    mockedDb.organization.findUnique
      .mockResolvedValueOnce(makeMockOrg({ employeeCount: 1000, signals: [], people: [] }))
      // Second call: reasoning (org exists)
      .mockResolvedValueOnce(makeMockOrg({ signals: [] }))
      // Third call: briefing (org not found → throws)
      .mockResolvedValueOnce(null);

    mockedDb.signal.create.mockResolvedValue({} as any);
    mockedDb.insight.create.mockResolvedValue({} as any);

    const result = await runIntelligencePipeline('org-1');
    expect(result.briefingGenerated).toBe(false);
  });
});

// ─── reasoning/index.ts exports ────────────────────────────────────────

describe('reasoning/index exports', () => {
  it('re-exports reasonAboutOrganization', async () => {
    const mod = await import('@/lib/intelligence/reasoning');
    expect(mod.reasonAboutOrganization).toBe(reasonAboutOrganization);
  });

  it('re-exports runIntelligencePipeline', async () => {
    const mod = await import('@/lib/intelligence/reasoning');
    expect(mod.runIntelligencePipeline).toBe(runIntelligencePipeline);
  });

  it('re-exports storeInsights', async () => {
    const mod = await import('@/lib/intelligence/reasoning');
    expect(mod.storeInsights).toBe(storeInsights);
  });
});

// ─── reasoning/signals.ts re-exports ───────────────────────────────────

describe('reasoning/signals.ts re-exports', () => {
  it('re-exports detectSignalsForOrganization from signals engine', async () => {
    const mod = await import('@/lib/intelligence/reasoning/signals');
    expect(typeof mod.detectSignalsForOrganization).toBe('function');
  });

  it('re-exports storeSignals from signals engine', async () => {
    const mod = await import('@/lib/intelligence/reasoning/signals');
    expect(typeof mod.storeSignals).toBe('function');
  });
});
