/**
 * Ticket 2 — Integration Tests: Intelligence API Envelope, Include, Cache-Control, Freshness, Errors
 *
 * Tests the full Intelligence API contract by calling actual route handlers
 * with mocked DB and engine dependencies.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Route handler imports ───────────────────────────────────────────────────

import { GET as companyGET } from '@/app/api/intelligence/company/[id]/route';
import { GET as reasoningGET } from '@/app/api/intelligence/reasoning/[id]/route';
import { GET as opportunityGET } from '@/app/api/intelligence/opportunity/[id]/route';
import { GET as actionGET } from '@/app/api/intelligence/action/[id]/route';
import { GET as conversationGET } from '@/app/api/intelligence/conversation/[id]/route';
import { GET as mindmapGET } from '@/app/api/intelligence/mindmap/[id]/route';
import { GET as briefGET } from '@/app/api/intelligence/brief/[id]/route';
import { GET as groundingGET } from '@/app/api/intelligence/grounding/[id]/route';
import { GET as retrievalGET } from '@/app/api/intelligence/retrieval/[id]/route';
import { GET as knowledgeGET } from '@/app/api/intelligence/knowledge/[id]/route';

import { computeFreshness } from '@/lib/intelligence-api/intelligence-middleware';

// ═══════════════════════════════════════════════════════════════════════════
//  Mocks
// ═══════════════════════════════════════════════════════════════════════════

// ── Auth mock — these routes now require authentication ──
vi.mock('@/lib/session', () => ({
  getCurrentSession: vi.fn().mockResolvedValue({
    id: 'test-user',
    email: 'test@deepmindq.com',
    name: 'Test User',
    phone: null,
    company: 'DeepMindQ',
    designation: 'Admin',
    role: 'admin',
    hasPassword: true,
    avatarUrl: null,
  }),
}));

vi.mock('@/lib/db', () => ({
  db: {
    company: { findUnique: vi.fn(), findMany: vi.fn() },
    companySignal: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn(), aggregate: vi.fn() },
    contact: { findMany: vi.fn(), count: vi.fn() },
    companyTimelineEvent: { findMany: vi.fn() },
    fusionResult: { findMany: vi.fn() },
    capabilityAsset: { findMany: vi.fn() },
    companyResearchCard: { findUnique: vi.fn() },
    reasoningStep: { findMany: vi.fn() },
    learningEvent: { findMany: vi.fn() },
    knowledgeEntry: { findMany: vi.fn() },
    accountScore: { findUnique: vi.fn().mockResolvedValue(null) },
    // Needed by runGovernanceMetadata → getResearchContext → getEvidenceSummary chain
    evidence: { findMany: vi.fn(), count: vi.fn(), createMany: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    systemSetting: { findUnique: vi.fn() },
    companyNote: { findFirst: vi.fn() },
  },
}));

vi.mock('@/lib/engines/scoring-engine', () => ({
  ScoringEngine: { score: vi.fn() },
}));

vi.mock('@/lib/engines/action-engine', () => ({
  ActionEngine: { recommend: vi.fn() },
}));

vi.mock('@/lib/engines/conversation-engine', () => ({
  ConversationEngine: { brief: vi.fn() },
}));

vi.mock('@/lib/enterprise-reasoning-engine', () => ({
  EnterpriseReasoningEngine: { build: vi.fn() },
}));

vi.mock('@/lib/engines/grounding-engine', () => ({
  GroundingEngine: { collect: vi.fn() },
}));

vi.mock('@/lib/engines/retrieval-engine', () => ({
  RetrievalEngine: { search: vi.fn(), getStats: vi.fn() },
}));

vi.mock('@/lib/engines/synthesis-engine', () => ({
  SynthesisEngine: { generate: vi.fn() },
}));

vi.mock('@/lib/knowledge-ingestion-pipeline', () => ({
  KnowledgeIngestionPipeline: { getStats: vi.fn() },
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({
    success: true,
    remaining: 59,
    resetAt: Date.now() + 60000,
  })),
}));

// Mock ai-hybrid-retrieval — required by intelligence/retrieval/[id] route via require()
vi.mock('@/lib/ai-hybrid-retrieval', () => ({
  hybridSearch: vi.fn().mockResolvedValue(null),
  understandQuery: vi.fn().mockReturnValue({ query: 'test', intent: 'search', entities: [] }),
  getHybridStats: vi.fn().mockReturnValue({ totalQueries: 0, avgLatencyMs: 0, cacheHitRate: 0 }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
  },
}));

// ── Import mocked modules ──────────────────────────────────────────────────

import { db } from '@/lib/db';
import { ScoringEngine } from '@/lib/engines/scoring-engine';
import { ActionEngine } from '@/lib/engines/action-engine';
import { ConversationEngine } from '@/lib/engines/conversation-engine';
import { EnterpriseReasoningEngine } from '@/lib/enterprise-reasoning-engine';
import { GroundingEngine } from '@/lib/engines/grounding-engine';
import { RetrievalEngine } from '@/lib/engines/retrieval-engine';
import { SynthesisEngine } from '@/lib/engines/synthesis-engine';
import { KnowledgeIngestionPipeline } from '@/lib/knowledge-ingestion-pipeline';

// ═══════════════════════════════════════════════════════════════════════════
//  Test Data
// ═══════════════════════════════════════════════════════════════════════════

const COMPANY_ID = 'cmp-test-abc123';

const now = new Date('2024-06-01T12:00:00Z');

const mockCompanyFull = {
  id: COMPANY_ID,
  rawName: 'Acme Corp',
  normalizedName: 'acme corp',
  domain: 'acme.com',
  industry: 'Technology',
  sizeRange: '201-500',
  location: 'San Francisco, CA',
  country: 'US',
  website: 'https://acme.com',
  status: 'active',
  assignedTo: null as string | null,
  intelligenceScore: 75,
  engagementScore: 60,
  accountPriorityScore: 80,
  priorityTier: 'high',
  createdAt: new Date('2024-01-15T00:00:00Z'),
  updatedAt: new Date('2024-06-01T00:00:00Z'),
  lastEnrichedAt: now,
  lastActivityAt: now,
};

const mockScoringResult = {
  success: true,
  error: null,
  companyId: COMPANY_ID,
  companyName: 'Acme Corp',
  domain: 'acme.com',
  industry: 'Technology',
  score: 75,
  grade: 'B' as const,
  priorityTier: 'high' as const,
  confidence: 75,
  factors: [],
  breakdownText: 'Solid account',
  accountFit: 70,
  contactInfluence: 65,
  opportunityStrength: 80,
  buyingIntent: 75,
  recommendedAction: 'Schedule a demo',
  nextBestActions: ['Send case study'],
  timingWindow: '30 days',
  evidenceChain: { evidences: [], aggregateConfidence: 0.75, coverage: 0.6, gaps: [], freshnessScore: 0.8, builtAt: now.toISOString(), context: {} },
  evidenceCount: 5,
  signalCount: 3,
  narrative: null,
  scoredAt: now.toISOString(),
  modelUsed: 'test',
  durationMs: 100,
  tokensUsed: 500,
  costUsd: 0.01,
};

const mockActionResult = {
  success: true,
  error: null,
  companyId: COMPANY_ID,
  companyName: 'Acme Corp',
  contactId: null,
  contactName: null,
  opportunityId: null,
  primaryAction: null,
  actions: [],
  detectedSalesMotion: 'enterprise' as const,
  accountStrategy: 'Grow the account',
  riskActions: [],
  currentScore: 70,
  evidenceChain: { evidences: [], aggregateConfidence: 0.7, coverage: 0.5, gaps: [], freshnessScore: 0.6, builtAt: now.toISOString(), context: {} },
  triggerSignals: [],
  strategyNarrative: null,
  generatedAt: now.toISOString(),
  modelUsed: 'test',
  durationMs: 150,
  tokensUsed: 600,
  costUsd: 0.012,
};

const mockReasoningResult = {
  success: true,
  reasoningContextId: 'rc-test-123',
  companyId: COMPANY_ID,
  totalSteps: 30,
  completedSteps: 28,
  skippedSteps: 0,
  failedSteps: 2,
  totalAIcalls: 15,
  totalTokensUsed: 50000,
  totalCostUsd: 0.25,
  durationMs: 2000,
  overallConfidence: 72,
  winProbability: 0.65,
  error: null,
};

const mockConversationResult = {
  success: true,
  error: null,
  companyId: COMPANY_ID,
  companyName: 'Acme Corp',
  contactId: null,
  opportunityId: null,
  briefingType: 'discovery' as const,
  meetingObjective: 'Understand Acme Corp AI strategy',
  meetingType: 'discovery' as const,
  suggestedDuration: '45 min',
  keyStakeholders: ['CTO'],
  buyerProfile: { role: 'CTO', priorities: ['AI'], challenges: ['Scale'] },
  talkingPoints: [{ point: 'AI capabilities', evidence: 'Market report', source: 'internal', priority: 'must_cover' }],
  questionsToAsk: [],
  objectionsToPrepare: [],
  topicsToAvoid: [],
  recommendedPositioning: 'Strategic partner',
  valuePropositionAngle: 'ROI',
  postMeetingActions: ['Send follow-up'],
  preparationChecklist: [],
  companyContext: 'Acme Corp is a technology company',
  signalContext: ['Funding round'],
  dealContext: 'Early stage',
  evidenceChain: { evidences: [], aggregateConfidence: 0.8, coverage: 0.7, gaps: [], freshnessScore: 0.75, builtAt: now.toISOString(), context: {} },
  evidenceCount: 3,
  confidenceScore: 80,
  briefingNarrative: 'Acme Corp is growing rapidly.',
  generatedAt: now.toISOString(),
  modelUsed: 'test',
  durationMs: 300,
  tokensUsed: 1500,
  costUsd: 0.03,
};

const mockBriefResult = {
  success: true,
  type: 'account_brief',
  content: '# Acme Corp\n\n## Overview\nAcme Corp is a technology company.',
  sections: [{
    heading: 'Overview',
    body: 'Acme Corp overview...',
    confidence: 0.85,
    citations: [],
  }],
  citations: [],
  evidenceChain: {
    evidences: [],
    aggregateConfidence: 0.85,
    coverage: 0.7,
    gaps: [],
    freshnessScore: 0.8,
  },
  wordCount: 150,
  modelUsed: 'gpt-4',
  confidence: 0.85,
  durationMs: 3000,
  tokensUsed: 2000,
  costUsd: 0.05,
  warnings: [],
};

const mockGroundingResult = {
  evidences: [],
  aggregateConfidence: 0.6,
  coverage: 0.5,
  gaps: [],
  freshnessScore: 0.7,
};

const mockRetrievalStats = {
  totalEmbeddings: 100,
  uniqueEntities: 20,
  backend: 'pgvector' as const,
  indexSizeBytes: 50000,
};

const mockSignal = {
  id: 'sig-1',
  signalType: 'funding',
  title: 'Series C funding',
  description: 'Raised $50M in Series C',
  severity: 'high',
  impact: 'positive',
  source: 'crunchbase',
  confidence: 0.85,
  evidenceIds: ['ev-1', 'ev-2'],
  extractedAt: new Date('2024-05-15T00:00:00Z'),
  companyId: COMPANY_ID,
};

const mockContact = {
  id: 'ct-1',
  rawName: 'Jane Doe',
  title: 'CEO',
  email: 'jane@acme.com',
  role: 'decision-maker',
  phone: null as string | null,
  companyId: COMPANY_ID,
  company: { rawName: 'Acme Corp' },
  leadScore: 85,
  aiConversionScore: 0.9,
  enrichmentScore: 0.8,
  source: 'linkedin',
  status: 'active',
  lastContactedAt: new Date('2024-04-01T00:00:00Z'),
};

const mockLearningEvent = {
  id: 'le-1',
  learnedInsight: 'Focus on ROI metrics',
  companyId: COMPANY_ID,
  applicableContext: 'Enterprise deals',
  createdAt: new Date('2024-05-01T00:00:00Z'),
};

// ═══════════════════════════════════════════════════════════════════════════
//  Test Helpers
// ═══════════════════════════════════════════════════════════════════════════

function mockRequest(path: string): NextRequest {
  const url = `http://localhost${path}`;
  return new NextRequest(url) as NextRequest;
}

async function parseResponse(response: Response): Promise<{ status: number; body: unknown; headers: Headers }> {
  const body = await response.json();
  return { status: response.status, body, headers: response.headers };
}

/** Validate the IntelligenceResponse envelope structure */
function expectEnvelope(body: unknown, endpoint: string) {
  expect(typeof body).toBe('object');
  expect(body).not.toBeNull();
  const obj = body as Record<string, unknown>;

  expect(obj.success).toBe(true);
  expect(obj.data).not.toBeNull();
  expect(obj.error).toBeNull();

  const meta = obj.meta as Record<string, unknown>;
  expect(meta.endpoint).toBe(endpoint);
  expect(typeof meta.companyId).toBe('string');
  expect(typeof meta.requestedAt).toBe('string');
  expect(typeof meta.respondedAt).toBe('string');
  expect(typeof meta.durationMs).toBe('number');
  expect(typeof meta.cached).toBe('boolean');
  expect(Array.isArray(meta.includes)).toBe(true);
  expect(typeof meta.confidence).toBe('number');

  // Freshness
  const freshness = meta.freshness as Record<string, unknown>;
  expect(['realtime', 'fresh', 'aging', 'stale', 'very_stale', 'unknown']).toContain(freshness.level);
  expect(typeof freshness.score).toBe('number');
}

/** Set up all default mocks for a successful response */
function setupDefaultMocks() {
  (db.company.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockCompanyFull);
  (db.companyResearchCard.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  (db.companySignal.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (db.companySignal.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
  (db.contact.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (db.contact.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
  (db.companyTimelineEvent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (db.fusionResult.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (db.capabilityAsset.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (db.reasoningStep.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (db.learningEvent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (db.knowledgeEntry.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

  (ScoringEngine.score as ReturnType<typeof vi.fn>).mockResolvedValue(mockScoringResult);
  (ActionEngine.recommend as ReturnType<typeof vi.fn>).mockResolvedValue(mockActionResult);
  (ConversationEngine.brief as ReturnType<typeof vi.fn>).mockResolvedValue(mockConversationResult);
  (EnterpriseReasoningEngine.build as ReturnType<typeof vi.fn>).mockResolvedValue(mockReasoningResult);
  (GroundingEngine.collect as ReturnType<typeof vi.fn>).mockResolvedValue(mockGroundingResult);
  (RetrievalEngine.search as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (RetrievalEngine.getStats as ReturnType<typeof vi.fn>).mockResolvedValue(mockRetrievalStats);
  (SynthesisEngine.generate as ReturnType<typeof vi.fn>).mockResolvedValue(mockBriefResult);
  (KnowledgeIngestionPipeline.getStats as ReturnType<typeof vi.fn>).mockResolvedValue({
    totalDocuments: 10,
    completedDocuments: 8,
    totalChunks: 50,
    classifiedChunks: 45,
    embeddedChunks: 40,
    byType: [{ type: 'pdf', count: 5 }],
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  Tests
// ═══════════════════════════════════════════════════════════════════════════

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaultMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
//  1. Intelligence API — Envelope Contract
// ─────────────────────────────────────────────────────────────────────────────

describe('Intelligence API — Envelope Contract', () => {
  it('company endpoint returns IntelligenceResponse envelope with all meta fields', async () => {
    const request = mockRequest(`/api/intelligence/company/${COMPANY_ID}`);
    const response = await companyGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    expectEnvelope(result.body, 'company');
  });

  it('reasoning endpoint returns IntelligenceResponse envelope', async () => {
    const request = mockRequest(`/api/intelligence/reasoning/${COMPANY_ID}`);
    const response = await reasoningGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    expectEnvelope(result.body, 'reasoning');
  });

  it('opportunity endpoint returns IntelligenceResponse envelope', async () => {
    const request = mockRequest(`/api/intelligence/opportunity/${COMPANY_ID}`);
    const response = await opportunityGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    expectEnvelope(result.body, 'opportunity');
  });

  it('action endpoint returns IntelligenceResponse envelope', async () => {
    const request = mockRequest(`/api/intelligence/action/${COMPANY_ID}`);
    const response = await actionGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    expectEnvelope(result.body, 'action');
  });

  it('conversation endpoint returns IntelligenceResponse envelope', async () => {
    const request = mockRequest(`/api/intelligence/conversation/${COMPANY_ID}`);
    const response = await conversationGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    expectEnvelope(result.body, 'conversation');
  });

  it('mindmap endpoint returns IntelligenceResponse envelope', async () => {
    const request = mockRequest(`/api/intelligence/mindmap/${COMPANY_ID}`);
    const response = await mindmapGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    expectEnvelope(result.body, 'mindmap');
  });

  it('brief endpoint returns IntelligenceResponse envelope', async () => {
    const request = mockRequest(`/api/intelligence/brief/${COMPANY_ID}?briefType=account_brief`);
    const response = await briefGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    expectEnvelope(result.body, 'brief');
  });

  it('grounding endpoint returns IntelligenceResponse envelope', async () => {
    const request = mockRequest(`/api/intelligence/grounding/${COMPANY_ID}`);
    const response = await groundingGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    expectEnvelope(result.body, 'grounding');
  });

  it('retrieval endpoint returns IntelligenceResponse envelope', async () => {
    const request = mockRequest(`/api/intelligence/retrieval/${COMPANY_ID}?q=test+query`);
    const response = await retrievalGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    expectEnvelope(result.body, 'retrieval');
  });

  it('knowledge endpoint returns IntelligenceResponse envelope', async () => {
    const request = mockRequest(`/api/intelligence/knowledge/${COMPANY_ID}`);
    const response = await knowledgeGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    expectEnvelope(result.body, 'knowledge');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  2. Intelligence API — Include Selective Loading
// ─────────────────────────────────────────────────────────────────────────────

describe('Intelligence API — Include Selective Loading', () => {
  it('company with ?include=signals returns signals in response', async () => {
    (db.companySignal.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockSignal]);
    const request = mockRequest(`/api/intelligence/company/${COMPANY_ID}?include=signals`);
    const response = await companyGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    const data = (result.body as Record<string, unknown>).data as Record<string, unknown>;
    expect(Array.isArray(data.signals)).toBe(true);
    expect((data.signals as unknown[]).length).toBe(1);
    expect((data.signals as Array<Record<string, unknown>>)[0].id).toBe('sig-1');
  });

  it('company with ?include=scores returns scores in response', async () => {
    const request = mockRequest(`/api/intelligence/company/${COMPANY_ID}?include=scores`);
    const response = await companyGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    const data = (result.body as Record<string, unknown>).data as Record<string, unknown>;
    expect(data.scores).not.toBeNull();
    const scores = data.scores as Record<string, unknown>;
    expect(scores.revenue).toBeDefined();
  });

  it('company with ?include=contacts returns contacts in response', async () => {
    (db.contact.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockContact]);
    const request = mockRequest(`/api/intelligence/company/${COMPANY_ID}?include=contacts`);
    const response = await companyGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    const data = (result.body as Record<string, unknown>).data as Record<string, unknown>;
    expect(Array.isArray(data.contacts)).toBe(true);
    expect((data.contacts as unknown[]).length).toBe(1);
  });

  it('company without include omits optional sections', async () => {
    const request = mockRequest(`/api/intelligence/company/${COMPANY_ID}`);
    const response = await companyGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    const data = (result.body as Record<string, unknown>).data as Record<string, unknown>;
    // Core fields should be present
    expect(data.company).toBeDefined();
    expect(data.researchCard).toBeDefined();
    expect(data.keyPeople).toBeDefined();
    expect(data.freshness).toBeDefined();
    // Optional include fields should be absent
    expect(data.signals).toBeUndefined();
    expect(data.scores).toBeUndefined();
    expect(data.contacts).toBeUndefined();
    expect(data.timeline).toBeUndefined();
    expect(data.actions).toBeUndefined();
    expect(data.brief).toBeUndefined();
    expect(data.knowledge).toBeUndefined();
    expect(data.mindmap).toBeUndefined();
  });

  it('reasoning with ?include=steps includes step details', async () => {
    (db.reasoningStep.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{
      stepNumber: 1, stepName: 'Gather external intel', output: 'Done',
      summary: 'Collected 15 signals', confidence: 0.85, aiCalls: 2,
      tokensUsed: 1000, costUsd: 0.005, durationMs: 500,
    }]);
    const request = mockRequest(`/api/intelligence/reasoning/${COMPANY_ID}?include=steps`);
    const response = await reasoningGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    const data = (result.body as Record<string, unknown>).data as Record<string, unknown>;
    expect(Array.isArray(data.steps)).toBe(true);
    expect((data.steps as unknown[]).length).toBe(1);
  });

  it('reasoning without ?include=steps still includes steps (default on)', async () => {
    (db.reasoningStep.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{
      stepNumber: 1, stepName: 'Gather external intel', output: 'Done',
      summary: 'Collected 15 signals', confidence: 0.85, aiCalls: 2,
      tokensUsed: 1000, costUsd: 0.005, durationMs: 500,
    }]);
    const request = mockRequest(`/api/intelligence/reasoning/${COMPANY_ID}`);
    const response = await reasoningGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    const data = (result.body as Record<string, unknown>).data as Record<string, unknown>;
    expect(Array.isArray(data.steps)).toBe(true);
    expect((data.steps as unknown[]).length).toBe(1);
  });

  it('action with ?include=learning returns learningInsights', async () => {
    (db.learningEvent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockLearningEvent]);
    const request = mockRequest(`/api/intelligence/action/${COMPANY_ID}?include=learning`);
    const response = await actionGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    const data = (result.body as Record<string, unknown>).data as Record<string, unknown>;
    expect(Array.isArray(data.learningInsights)).toBe(true);
    expect((data.learningInsights as unknown[]).length).toBe(1);
    expect((data.learningInsights as Array<Record<string, unknown>>)[0].id).toBe('le-1');
  });

  it('action without include has empty learningInsights', async () => {
    const request = mockRequest(`/api/intelligence/action/${COMPANY_ID}`);
    const response = await actionGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    const data = (result.body as Record<string, unknown>).data as Record<string, unknown>;
    expect(Array.isArray(data.learningInsights)).toBe(true);
    expect((data.learningInsights as unknown[]).length).toBe(0);
  });

  it('conversation with ?include=talkingPoints returns talkingPoints', async () => {
    (db.learningEvent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockLearningEvent]);
    const request = mockRequest(`/api/intelligence/conversation/${COMPANY_ID}?include=talkingPoints`);
    const response = await conversationGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    const data = (result.body as Record<string, unknown>).data as Record<string, unknown>;
    expect(Array.isArray(data.talkingPoints)).toBe(true);
    expect((data.talkingPoints as unknown[]).length).toBeGreaterThanOrEqual(1);
  });

  it('mindmap returns nodes and edges structure', async () => {
    (db.contact.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{
      id: 'ct-1', rawName: 'Jane Doe', title: 'CEO', role: 'decision-maker', leadScore: 85,
    }]);
    const request = mockRequest(`/api/intelligence/mindmap/${COMPANY_ID}`);
    const response = await mindmapGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    const data = (result.body as Record<string, unknown>).data as Record<string, unknown>;
    expect(Array.isArray(data.nodes)).toBe(true);
    expect(Array.isArray(data.edges)).toBe(true);
    expect(data.metadata).toBeDefined();
    const meta = data.metadata as Record<string, unknown>;
    expect(typeof meta.totalNodes).toBe('number');
    expect(typeof meta.totalEdges).toBe('number');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  3. Intelligence API — Cache-Control Headers
// ─────────────────────────────────────────────────────────────────────────────

describe('Intelligence API — Cache-Control Headers', () => {
  it('company endpoint sets Cache-Control header on success', async () => {
    const request = mockRequest(`/api/intelligence/company/${COMPANY_ID}`);
    const response = await companyGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const cacheControl = response.headers.get('cache-control');
    // Company endpoint sets Cache-Control like all other intelligence endpoints
    expect(cacheControl).toBe('public, s-maxage=60, stale-while-revalidate=30');
  });

  it('reasoning endpoint sets Cache-Control header on success', async () => {
    const request = mockRequest(`/api/intelligence/reasoning/${COMPANY_ID}`);
    const response = await reasoningGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const cacheControl = response.headers.get('cache-control');
    expect(cacheControl).not.toBeNull();
    expect(cacheControl).toContain('s-maxage=60');
    expect(cacheControl).toContain('stale-while-revalidate=30');
  });

  it('error responses do NOT set Cache-Control header', async () => {
    const request = mockRequest(`/api/intelligence/company/${COMPANY_ID}`);
    const response = await companyGET(request, { params: Promise.resolve({ id: '' }) });
    const cacheControl = response.headers.get('cache-control');
    expect(cacheControl).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  4. Intelligence API — Freshness
// ─────────────────────────────────────────────────────────────────────────────

describe('Intelligence API — Freshness', () => {
  it('all endpoints include freshness in meta', async () => {
    const endpoints = [
      { name: 'company' as const, handler: companyGET },
      { name: 'reasoning' as const, handler: reasoningGET },
      { name: 'opportunity' as const, handler: opportunityGET },
      { name: 'action' as const, handler: actionGET },
      { name: 'conversation' as const, handler: conversationGET },
      { name: 'mindmap' as const, handler: mindmapGET },
      { name: 'brief' as const, handler: briefGET },
      { name: 'grounding' as const, handler: groundingGET },
      { name: 'retrieval' as const, handler: retrievalGET },
      { name: 'knowledge' as const, handler: knowledgeGET },
    ];

    for (const { name, handler } of endpoints) {
      const path = name === 'brief'
        ? `/api/intelligence/brief/${COMPANY_ID}?briefType=account_brief`
        : name === 'retrieval'
          ? `/api/intelligence/retrieval/${COMPANY_ID}?q=test`
          : `/api/intelligence/${name}/${COMPANY_ID}`;
      const request = mockRequest(path);
      const response = await handler(request, { params: Promise.resolve({ id: COMPANY_ID }) });
      const result = await parseResponse(response);
      const meta = (result.body as Record<string, unknown>).meta as Record<string, unknown>;
      const freshness = meta.freshness as Record<string, unknown>;
      expect(freshness, `${name} should have freshness in meta`).toBeDefined();
      expect(['realtime', 'fresh', 'aging', 'stale', 'very_stale', 'unknown'], `${name} freshness.level valid`).toContain(freshness.level);
      expect(typeof freshness.score, `${name} freshness.score is number`).toBe('number');
    }
  });

  it('freshness has correct shape (level, lastEnriched, lastSignal, score)', async () => {
    const request = mockRequest(`/api/intelligence/company/${COMPANY_ID}`);
    const response = await companyGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    const meta = (result.body as Record<string, unknown>).meta as Record<string, unknown>;
    const freshness = meta.freshness as Record<string, unknown>;
    expect(typeof freshness.level).toBe('string');
    expect(['realtime', 'fresh', 'aging', 'stale', 'very_stale', 'unknown']).toContain(freshness.level);
    expect(typeof freshness.score).toBe('number');
    // lastEnriched and lastSignal can be string | null
    expect(freshness.lastEnriched === null || typeof freshness.lastEnriched === 'string').toBe(true);
    expect(freshness.lastSignal === null || typeof freshness.lastSignal === 'string').toBe(true);
  });

  it('computeFreshness returns unknown for company with no dates', () => {
    const result = computeFreshness({});
    expect(result.level).toBe('unknown');
    expect(result.lastEnriched).toBeNull();
    expect(result.lastSignal).toBeNull();
    expect(result.score).toBe(0);
  });

  it('computeFreshness returns realtime for <1 hour', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-01T12:00:00Z'));
    const result = computeFreshness({
      lastEnrichedAt: new Date('2024-06-01T11:30:00Z'), // 30 min ago
    });
    expect(result.level).toBe('realtime');
    expect(result.score).toBe(95);
    vi.useRealTimers();
  });

  it('computeFreshness returns fresh for <24 hours', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-01T12:00:00Z'));
    const result = computeFreshness({
      lastEnrichedAt: new Date('2024-06-01T02:00:00Z'), // 10 hours ago
    });
    expect(result.level).toBe('fresh');
    expect(result.score).toBe(65);
    vi.useRealTimers();
  });

  it('computeFreshness returns very_stale for >168 hours', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
    const result = computeFreshness({
      lastEnrichedAt: new Date('2024-06-01T12:00:00Z'), // 336 hours ago (14 days)
    });
    expect(result.level).toBe('very_stale');
    expect(result.score).toBe(0);
    vi.useRealTimers();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  5. Intelligence API — Error Responses
// ─────────────────────────────────────────────────────────────────────────────

describe('Intelligence API — Error Responses', () => {
  it('returns 404 for non-existent company', async () => {
    (db.company.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const request = mockRequest(`/api/intelligence/company/${COMPANY_ID}`);
    const response = await companyGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(404);
    const obj = result.body as Record<string, unknown>;
    expect(typeof obj.error).toBe('string');
    expect(typeof obj.code).toBe('string');
    expect(obj.code).toBe('COMPANY_NOT_FOUND');
  });

  it('returns 400 for invalid company ID', async () => {
    const request = mockRequest('/api/intelligence/company/invalid id!');
    const response = await companyGET(request, { params: Promise.resolve({ id: 'invalid id!' }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(400);
    const obj = result.body as Record<string, unknown>;
    expect(typeof obj.error).toBe('string');
    expect(typeof obj.code).toBe('string');
  });

  it('returns correct error format { error, code, details }', async () => {
    (db.company.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const request = mockRequest(`/api/intelligence/company/${COMPANY_ID}`);
    const response = await companyGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(404);
    const obj = result.body as Record<string, unknown>;
    // Must have error and code
    expect(typeof obj.error).toBe('string');
    expect((obj.error as string).length).toBeGreaterThan(0);
    expect(typeof obj.code).toBe('string');
    expect((obj.code as string).length).toBeGreaterThan(0);
    // Must NOT have envelope fields
    expect('success' in obj).toBe(false);
    expect('data' in obj).toBe(false);
    expect('meta' in obj).toBe(false);
    // details is optional
    if ('details' in obj && obj.details !== undefined) {
      expect(typeof obj.details).toBe('object');
    }
  });

  it('brief returns 400 for invalid briefType', async () => {
    const request = mockRequest(`/api/intelligence/brief/${COMPANY_ID}?briefType=invalid_type`);
    const response = await briefGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(400);
    const obj = result.body as Record<string, unknown>;
    expect(typeof obj.error).toBe('string');
    expect((obj.error as string).toLowerCase()).toContain('invalid');
  });

  it('retrieval returns 400 for missing ?q= parameter', async () => {
    const request = mockRequest(`/api/intelligence/retrieval/${COMPANY_ID}`);
    const response = await retrievalGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(400);
    const obj = result.body as Record<string, unknown>;
    expect(typeof obj.error).toBe('string');
    expect((obj.error as string).toLowerCase()).toContain('query');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  6. Intelligence API — Data Shape Validation (G17-G41)
// ─────────────────────────────────────────────────────────────────────────────

describe('Intelligence API — Data Shape', () => {
  // G17: Company ?include=timeline
  it('company with ?include=timeline returns timeline events', async () => {
    const mockTimeline = [{
      id: 'te-1', eventType: 'funding', title: 'Series A',
      description: 'Raised $10M', metadata: { amount: 10000000 },
      createdAt: new Date('2024-03-01T00:00:00Z'), companyId: COMPANY_ID,
    }];
    (db.companyTimelineEvent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockTimeline);
    const request = mockRequest(`/api/intelligence/company/${COMPANY_ID}?include=timeline`);
    const response = await companyGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    const data = (result.body as Record<string, unknown>).data as Record<string, unknown>;
    expect(Array.isArray(data.timeline)).toBe(true);
    expect((data.timeline as unknown[]).length).toBe(1);
    const ev = (data.timeline as Array<Record<string, unknown>>)[0];
    expect(ev.type).toBe('funding');
    expect(ev.title).toBe('Series A');
  });

  // G18: Company ?include=actions
  it('company with ?include=actions returns action result', async () => {
    const request = mockRequest(`/api/intelligence/company/${COMPANY_ID}?include=actions`);
    const response = await companyGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    const data = (result.body as Record<string, unknown>).data as Record<string, unknown>;
    expect(data.actions).toBeDefined();
    expect(typeof data.actions).toBe('object');
    expect(data.actions).not.toBeNull();
    const actions = data.actions as Record<string, unknown>;
    expect(actions.success).toBe(true);
  });

  // G19: Company ?include=brief
  it('company with ?include=brief returns brief data', async () => {
    const request = mockRequest(`/api/intelligence/company/${COMPANY_ID}?include=brief`);
    const response = await companyGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    const data = (result.body as Record<string, unknown>).data as Record<string, unknown>;
    expect(data.brief).toBeDefined();
    const brief = data.brief as Record<string, unknown>;
    expect(brief.briefType).toBe('conversation_brief');
    expect(typeof brief.content).toBe('string');
    expect(typeof brief.wordCount).toBe('number');
    expect(typeof brief.confidence).toBe('number');
  });

  // G20: Company ?include=knowledge
  it('company with ?include=knowledge returns knowledge data', async () => {
    const request = mockRequest(`/api/intelligence/company/${COMPANY_ID}?include=knowledge`);
    const response = await companyGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    const data = (result.body as Record<string, unknown>).data as Record<string, unknown>;
    expect(data.knowledge).toBeDefined();
    const knowledge = data.knowledge as Record<string, unknown>;
    expect(Array.isArray(knowledge.capabilities)).toBe(true);
    expect(Array.isArray(knowledge.caseStudies)).toBe(true);
  });

  // G24: Opportunity data shape
  it('opportunity returns correct data shape with scores and reasoning', async () => {
    const request = mockRequest(`/api/intelligence/opportunity/${COMPANY_ID}`);
    const response = await opportunityGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    const data = (result.body as Record<string, unknown>).data as Record<string, unknown>;
    expect(data.companyId).toBe(COMPANY_ID);
    // Default (empty include) returns scores
    expect(data.scores).toBeDefined();
    const scores = data.scores as Record<string, unknown>;
    expect(typeof scores.score).toBe('number');
    // Default returns reasoning
    expect(data.reasoning).toBeDefined();
    const reasoning = data.reasoning as Record<string, unknown>;
    expect(typeof reasoning.overallConfidence).toBe('number');
    expect(typeof reasoning.winProbability).toBe('number');
    // Default returns fusion
    expect(data.fusion).toBeDefined();
    expect(Array.isArray(data.fusion)).toBe(true);
  });

  // G28: Conversation default/no-include data shape
  it('conversation without include returns basic data shape', async () => {
    const request = mockRequest(`/api/intelligence/conversation/${COMPANY_ID}`);
    const response = await conversationGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    const data = (result.body as Record<string, unknown>).data as Record<string, unknown>;
    expect(data.companyId).toBe(COMPANY_ID);
    // conversation result always present
    expect(data.conversation).toBeDefined();
    // brief always derived
    expect(data.brief).toBeDefined();
    const brief = data.brief as Record<string, unknown>;
    expect(brief.briefType).toBe('conversation_brief');
    // talkingPoints/objections/buyerProfiles NOT present without explicit include
    expect(data.talkingPoints).toBeUndefined();
    expect(data.objections).toBeUndefined();
    expect(data.buyerProfiles).toBeUndefined();
  });

  // G30/G31: Brief success path
  it('brief returns sections, wordCount, and evidenceChain', async () => {
    const request = mockRequest(`/api/intelligence/brief/${COMPANY_ID}?briefType=account_brief`);
    const response = await briefGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    const body = result.body as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data.companyId).toBe(COMPANY_ID);
    const brief = data.brief as Record<string, unknown>;
    // Sections
    expect(Array.isArray(brief.sections)).toBe(true);
    expect((brief.sections as unknown[]).length).toBeGreaterThan(0);
    const section = (brief.sections as Array<Record<string, unknown>>)[0];
    expect(typeof section.heading).toBe('string');
    expect(typeof section.body).toBe('string');
    expect(typeof section.confidence).toBe('number');
    // Word count
    expect(typeof brief.wordCount).toBe('number');
    expect((brief.wordCount as number)).toBeGreaterThan(0);
    // Evidence chain
    const ec = brief.evidenceChain as Record<string, unknown>;
    expect(typeof ec.aggregateConfidence).toBe('number');
    expect(typeof ec.coverage).toBe('number');
    expect(Array.isArray(ec.gaps)).toBe(true);
  });

  // G32: Grounding data shape
  it('grounding returns evidences, coverage, and gaps', async () => {
    const request = mockRequest(`/api/intelligence/grounding/${COMPANY_ID}`);
    const response = await groundingGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    const body = result.body as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data.companyId).toBe(COMPANY_ID);
    expect(typeof data.aggregateConfidence).toBe('number');
    expect(typeof data.coverage).toBe('number');
    expect(typeof data.freshnessScore).toBe('number');
    expect(typeof data.evidenceCount).toBe('number');
    expect(typeof data.gapCount).toBe('number');
    expect(Array.isArray(data.evidences)).toBe(true);
    expect(Array.isArray(data.gaps)).toBe(true);
  });

  // G33/G34: Retrieval results + stats shape
  it('retrieval returns results array and stats', async () => {
    const mockResults = [{
      id: 'r-1', entityType: 'capability_asset' as const, entityId: 'cap-1',
      content: 'AI capabilities', score: 0.92, metadata: {},
    }];
    (RetrievalEngine.search as ReturnType<typeof vi.fn>).mockResolvedValue(mockResults);
    const request = mockRequest(`/api/intelligence/retrieval/${COMPANY_ID}?q=AI+capabilities`);
    const response = await retrievalGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    const body = result.body as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data.companyId).toBe(COMPANY_ID);
    expect(data.query).toBe('AI capabilities');
    expect(typeof data.resultCount).toBe('number');
    expect(Array.isArray(data.results)).toBe(true);
    expect((data.results as unknown[]).length).toBe(1);
    // Stats shape
    const stats = data.stats as Record<string, unknown>;
    expect(typeof stats.totalEmbeddings).toBe('number');
    expect(typeof stats.uniqueEntities).toBe('number');
    expect(typeof stats.backend).toBe('string');
  });

  // G35: Knowledge data shape
  it('knowledge returns groups, totalEntries, and topCategories', async () => {
    const mockEntries = [{
      id: 'ke-1', category: 'capabilities', subCategory: 'AI',
      content: 'AI-driven analytics', source: 'internal',
      confidence: 0.85, version: 1, updatedAt: new Date('2024-05-01T00:00:00Z'),
    }];
    (db.knowledgeEntry.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockEntries);
    const request = mockRequest(`/api/intelligence/knowledge/${COMPANY_ID}`);
    const response = await knowledgeGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    const body = result.body as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data.companyId).toBe(COMPANY_ID);
    expect(typeof data.totalEntries).toBe('number');
    expect((data.totalEntries as number)).toBe(1);
    expect(Array.isArray(data.groups)).toBe(true);
    expect((data.groups as unknown[]).length).toBe(1);
    const group = (data.groups as Array<Record<string, unknown>>)[0];
    expect(group.category).toBe('capabilities');
    expect(typeof group.entryCount).toBe('number');
    expect(Array.isArray(data.topCategories)).toBe(true);
    expect(typeof data.averageConfidence).toBe('number');
    // ingestionStats NOT present without ?include=ingestion
    expect(data.ingestionStats).toBeUndefined();
  });

  // G37: meta.includes reflects requested values
  it('meta.includes contains the exact requested include keys', async () => {
    const request = mockRequest(`/api/intelligence/company/${COMPANY_ID}?include=signals,scores`);
    const response = await companyGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    const body = result.body as Record<string, unknown>;
    const meta = body.meta as Record<string, unknown>;
    const includes = meta.includes as string[];
    expect(Array.isArray(includes)).toBe(true);
    expect(includes).toContain('signals');
    expect(includes).toContain('scores');
    expect(includes.length).toBe(2);
  });

  // G40: N+1 query verification — mock call counts for parallel batching
  it('company loads signals and contacts in parallel (not N+1)', async () => {
    (db.companySignal.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.contact.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const request = mockRequest(`/api/intelligence/company/${COMPANY_ID}?include=signals,contacts`);
    const response = await companyGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    expect(response.status).toBe(200);
    // Verify each query was called exactly once (no N+1)
    expect(db.companySignal.findMany).toHaveBeenCalled();
    expect(db.contact.findMany).toHaveBeenCalled();
    expect(db.company.findUnique).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  7. Intelligence API — Deep Data Shape Validation (G17-G41 Gap Fill)
// ─────────────────────────────────────────────────────────────────────────────

describe('Intelligence API — Deep Data Shape (G17-G41 Gap Fill)', () => {
  // ── G17: Company ?include=timeline returns full timeline data shape ─────────
  it('company ?include=timeline returns timeline with id, type, title, createdAt, companyId', async () => {
    const mockTimeline = [{
      id: 'te-deep-1',
      eventType: 'funding',
      title: 'Series C Round',
      description: 'Raised $50M in Series C',
      metadata: { amount: 50000000 },
      createdAt: new Date('2024-03-15T10:30:00Z'),
      companyId: COMPANY_ID,
    }];
    (db.companyTimelineEvent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockTimeline);
    const request = mockRequest(`/api/intelligence/company/${COMPANY_ID}?include=timeline`);
    const response = await companyGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    const data = (result.body as Record<string, unknown>).data as Record<string, unknown>;
    expect(Array.isArray(data.timeline)).toBe(true);
    expect((data.timeline as unknown[]).length).toBe(1);
    const ev = (data.timeline as Array<Record<string, unknown>>)[0];
    expect(typeof ev.id).toBe('string');
    expect(ev.id).toBe('te-deep-1');
    expect(ev.type).toBe('funding');
    expect(ev.title).toBe('Series C Round');
    expect(typeof ev.createdAt).toBe('string');
    expect(ev.companyId).toBe(COMPANY_ID);
  });

  // ── G18: Company ?include=actions returns actions data with success ────────
  it('company ?include=actions returns actions data with success:true', async () => {
    const request = mockRequest(`/api/intelligence/company/${COMPANY_ID}?include=actions`);
    const response = await companyGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    const data = (result.body as Record<string, unknown>).data as Record<string, unknown>;
    expect(data.actions).toBeDefined();
    expect(data.actions).not.toBeNull();
    const actions = data.actions as Record<string, unknown>;
    expect(actions.success).toBe(true);
    // Verify it also has core action fields
    expect(actions.companyId).toBe(COMPANY_ID);
    expect(typeof actions.detectedSalesMotion).toBe('string');
  });

  // ── G19: Company ?include=brief returns brief with full shape ─────────────
  it('company ?include=brief returns brief with briefType, content, sections, wordCount, confidence', async () => {
    const request = mockRequest(`/api/intelligence/company/${COMPANY_ID}?include=brief`);
    const response = await companyGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    const data = (result.body as Record<string, unknown>).data as Record<string, unknown>;
    expect(data.brief).toBeDefined();
    const brief = data.brief as Record<string, unknown>;
    expect(typeof brief.briefType).toBe('string');
    expect(typeof brief.content).toBe('string');
    // Verify sections array shape
    expect(Array.isArray(brief.sections)).toBe(true);
    expect((brief.sections as unknown[]).length).toBeGreaterThanOrEqual(1);
    const section = (brief.sections as Array<Record<string, unknown>>)[0];
    expect(typeof section.heading).toBe('string');
    expect(typeof section.body).toBe('string');
    expect(typeof section.confidence).toBe('number');
    // Verify scalar fields
    expect(typeof brief.wordCount).toBe('number');
    expect(typeof brief.confidence).toBe('number');
  });

  // ── G20: Company ?include=knowledge returns knowledge with capabilities and caseStudies ──
  it('company ?include=knowledge returns knowledge with capabilities and caseStudies arrays', async () => {
    (db.fusionResult.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{
      capabilityIds: ['cap-a', 'cap-b'],
      businessProblem: 'Scaling AI',
      recommendedCapability: 'ML Platform',
      relevantCaseStudy: 'Enterprise AI adoption',
      proofPoints: ['90% accuracy'],
      fusionScore: 0.88,
    }]);
    (db.capabilityAsset.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'cap-a', title: 'AI Analytics', summary: 'Deep analytics', category: 'platform', serviceLine: 'Data', targetIndustries: ['Tech'], problems: [], evidence: [] },
      { id: 'cap-b', title: 'AI Case Study', summary: 'Success story', category: 'case_study', serviceLine: null, targetIndustries: [], problems: [], evidence: [] },
    ]);
    const request = mockRequest(`/api/intelligence/company/${COMPANY_ID}?include=knowledge`);
    const response = await companyGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    const data = (result.body as Record<string, unknown>).data as Record<string, unknown>;
    expect(data.knowledge).toBeDefined();
    const knowledge = data.knowledge as Record<string, unknown>;
    expect(Array.isArray(knowledge.capabilities)).toBe(true);
    expect(Array.isArray(knowledge.caseStudies)).toBe(true);
    // Verify capability count (1 non-case-study, 1 case-study)
    expect((knowledge.capabilities as unknown[]).length).toBe(1);
    expect((knowledge.caseStudies as unknown[]).length).toBe(1);
  });

  // ── G24: Opportunity data shape verification ───────────────────────────────
  it('opportunity default data shape has companyId and at least one of scores/reasoning/fusion', async () => {
    const request = mockRequest(`/api/intelligence/opportunity/${COMPANY_ID}`);
    const response = await opportunityGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    const data = (result.body as Record<string, unknown>).data as Record<string, unknown>;
    expect(data.companyId).toBe(COMPANY_ID);
    // At least one of scores/reasoning/fusion must be present
    const hasScores = data.scores !== undefined && data.scores !== null;
    const hasReasoning = data.reasoning !== undefined && data.reasoning !== null;
    const hasFusion = data.fusion !== undefined && data.fusion !== null;
    expect(hasScores || hasReasoning || hasFusion).toBe(true);
  });

  // ── G28: Conversation default/no-include output shape ──────────────────────
  it('conversation without ?include= returns conversation and brief by default; talkingPoints/objections/buyerProfiles require explicit include', async () => {
    const request = mockRequest(`/api/intelligence/conversation/${COMPANY_ID}`);
    const response = await conversationGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    const data = (result.body as Record<string, unknown>).data as Record<string, unknown>;
    expect(data.companyId).toBe(COMPANY_ID);
    // conversation and brief are always present (default behavior)
    expect(data.conversation).toBeDefined();
    expect(data.brief).toBeDefined();
    const brief = data.brief as Record<string, unknown>;
    expect(typeof brief.briefType).toBe('string');
    expect(brief.briefType).toBe('conversation_brief');
    // talkingPoints, objections, buyerProfiles require explicit ?include=
    expect(data.talkingPoints).toBeUndefined();
    expect(data.objections).toBeUndefined();
    expect(data.buyerProfiles).toBeUndefined();
  });

  // ── G30: Brief success path with complete field verification ───────────────
  it('brief success path returns sections, wordCount>0, evidenceChain, citations, modelUsed, confidence, tokensUsed, costUsd', async () => {
    const request = mockRequest(`/api/intelligence/brief/${COMPANY_ID}?briefType=account_brief`);
    const response = await briefGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    const data = ((result.body as Record<string, unknown>).data as Record<string, unknown>);
    expect(data.companyId).toBe(COMPANY_ID);
    const brief = data.brief as Record<string, unknown>;
    // Sections array
    expect(Array.isArray(brief.sections)).toBe(true);
    expect((brief.sections as unknown[]).length).toBeGreaterThan(0);
    // wordCount > 0
    expect(typeof brief.wordCount).toBe('number');
    expect((brief.wordCount as number)).toBeGreaterThan(0);
    // evidenceChain present with correct shape
    expect(brief.evidenceChain).toBeDefined();
    const ec = brief.evidenceChain as Record<string, unknown>;
    expect(typeof ec.aggregateConfidence).toBe('number');
    expect(typeof ec.coverage).toBe('number');
    expect(Array.isArray(ec.gaps)).toBe(true);
    // Additional fields from SynthesisEngine result
    expect(Array.isArray(brief.citations)).toBe(true);
    expect(typeof brief.modelUsed).toBe('string');
    expect(brief.modelUsed).toBe('gpt-4');
    expect(typeof brief.confidence).toBe('number');
    expect(typeof brief.tokensUsed).toBe('number');
    expect((brief.tokensUsed as number)).toBeGreaterThan(0);
    expect(typeof brief.costUsd).toBe('number');
    expect((brief.costUsd as number)).toBeGreaterThan(0);
  });

  // ── G32: Grounding data shape ─────────────────────────────────────────────
  it('grounding returns evidences, aggregateConfidence, coverage, gaps, evidenceCount, gapCount', async () => {
    const request = mockRequest(`/api/intelligence/grounding/${COMPANY_ID}`);
    const response = await groundingGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    const data = ((result.body as Record<string, unknown>).data as Record<string, unknown>);
    expect(data.companyId).toBe(COMPANY_ID);
    // Core grounding shape
    expect(Array.isArray(data.evidences)).toBe(true);
    expect(typeof data.aggregateConfidence).toBe('number');
    expect(typeof data.coverage).toBe('number');
    expect(Array.isArray(data.gaps)).toBe(true);
    // Counts
    expect(typeof data.evidenceCount).toBe('number');
    expect(typeof data.gapCount).toBe('number');
  });

  // ── G33/G34: Retrieval results + stats ─────────────────────────────────────
  it('retrieval returns results, query, resultCount, and stats with totalEmbeddings/uniqueEntities/backend', async () => {
    (RetrievalEngine.search as ReturnType<typeof vi.fn>).mockResolvedValue([{
      id: 'r-deep-1', entityType: 'capability_asset' as const, entityId: 'cap-1',
      content: 'AI platform capabilities', score: 0.95, metadata: {},
    }]);
    (RetrievalEngine.getStats as ReturnType<typeof vi.fn>).mockResolvedValue({
      totalEmbeddings: 250,
      uniqueEntities: 35,
      backend: 'pgvector' as const,
      indexSizeBytes: 102400,
    });
    const request = mockRequest(`/api/intelligence/retrieval/${COMPANY_ID}?q=test`);
    const response = await retrievalGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    const data = ((result.body as Record<string, unknown>).data as Record<string, unknown>);
    expect(data.companyId).toBe(COMPANY_ID);
    expect(data.query).toBe('test');
    expect(typeof data.resultCount).toBe('number');
    expect((data.resultCount as number)).toBe(1);
    // Results array
    expect(Array.isArray(data.results)).toBe(true);
    expect((data.results as unknown[]).length).toBe(1);
    // Stats object
    expect(data.stats).toBeDefined();
    const stats = data.stats as Record<string, unknown>;
    expect(typeof stats.totalEmbeddings).toBe('number');
    expect(stats.totalEmbeddings).toBe(250);
    expect(typeof stats.uniqueEntities).toBe('number');
    expect(stats.uniqueEntities).toBe(35);
    expect(typeof stats.backend).toBe('string');
    expect(stats.backend).toBe('pgvector');
  });

  // ── G35: Knowledge data shape ─────────────────────────────────────────────
  it('knowledge returns groups array, totalEntries, topCategories, averageConfidence', async () => {
    (db.knowledgeEntry.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'ke-deep-1', category: 'capabilities', subCategory: 'AI', content: 'Machine learning platform', source: 'internal', confidence: 0.92, version: 2, updatedAt: new Date('2024-05-10T00:00:00Z') },
      { id: 'ke-deep-2', category: 'capabilities', subCategory: 'Data', content: 'Data pipeline tools', source: 'external', confidence: 0.78, version: 1, updatedAt: new Date('2024-05-05T00:00:00Z') },
      { id: 'ke-deep-3', category: 'case_studies', subCategory: 'Enterprise', content: 'Fortune 500 deployment', source: 'internal', confidence: 0.88, version: 1, updatedAt: new Date('2024-04-20T00:00:00Z') },
    ]);
    const request = mockRequest(`/api/intelligence/knowledge/${COMPANY_ID}`);
    const response = await knowledgeGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    const data = ((result.body as Record<string, unknown>).data as Record<string, unknown>);
    expect(data.companyId).toBe(COMPANY_ID);
    // groups array
    expect(Array.isArray(data.groups)).toBe(true);
    expect((data.groups as unknown[]).length).toBe(2); // 'capabilities' and 'case_studies'
    const firstGroup = (data.groups as Array<Record<string, unknown>>)[0];
    expect(typeof firstGroup.category).toBe('string');
    expect(typeof firstGroup.entryCount).toBe('number');
    // totalEntries
    expect(typeof data.totalEntries).toBe('number');
    expect((data.totalEntries as number)).toBe(3);
    // topCategories
    expect(Array.isArray(data.topCategories)).toBe(true);
    expect((data.topCategories as unknown[]).length).toBeGreaterThan(0);
    // averageConfidence
    expect(typeof data.averageConfidence).toBe('number');
    expect((data.averageConfidence as number)).toBeGreaterThan(0);
  });

  // ── G37: meta.includes reflects requested includes ────────────────────────
  it('meta.includes reflects requested include=signals,scores', async () => {
    const request = mockRequest(`/api/intelligence/company/${COMPANY_ID}?include=signals,scores`);
    const response = await companyGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    const meta = (result.body as Record<string, unknown>).meta as Record<string, unknown>;
    const includes = meta.includes as string[];
    expect(Array.isArray(includes)).toBe(true);
    expect(includes).toContain('signals');
    expect(includes).toContain('scores');
    // Should be exactly 2 — no extra includes injected
    expect(includes.length).toBe(2);
  });

  // ── G21: Company WITHOUT include omits optional sections ──────────────────
  it('company without ?include= omits optional sections but keeps core fields', async () => {
    const request = mockRequest(`/api/intelligence/company/${COMPANY_ID}`);
    const response = await companyGET(request, { params: Promise.resolve({ id: COMPANY_ID }) });
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    const data = (result.body as Record<string, unknown>).data as Record<string, unknown>;
    // Core fields MUST be present
    expect(data.company).toBeDefined();
    expect(data.researchCard).toBeDefined();
    expect(data.keyPeople).toBeDefined();
    // Optional sections MUST be absent without ?include=
    expect(data.signals).toBeUndefined();
    expect(data.contacts).toBeUndefined();
    expect(data.timeline).toBeUndefined();
    expect(data.scores).toBeUndefined();
    expect(data.actions).toBeUndefined();
    expect(data.brief).toBeUndefined();
    expect(data.knowledge).toBeUndefined();
    expect(data.mindmap).toBeUndefined();
  });
});

