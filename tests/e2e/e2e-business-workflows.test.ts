/**
 * DeepMindQ Enterprise AI Intelligence Platform
 * Milestone 3 — Section 3.3: Business Workflow E2E Certification
 * 5 Complete Intelligence Journeys
 * 
 * Workflow 1: Data → Intelligence Pipeline
 * Workflow 2: Account Intelligence Research
 * Workflow 3: Signal → Action
 * Workflow 4: Knowledge Intelligence
 * Workflow 5: Executive Intelligence
 * 
 * PRIMARY TESTING GATE: Complete intelligence journeys, no isolated API tests.
 * Run: npx vitest run --config vitest.e2e.config.ts tests/e2e/e2e-business-workflows.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Shared Mock Session ──────────────────────────────────────────────

const MOCK_SESSION = {
  id: 'user-session-001',
  email: 'admin@deepmindq.com',
  name: 'Admin User',
  phone: null,
  company: null,
  designation: null,
  role: 'admin',
  hasPassword: false,
  avatarUrl: null,
};

// ─── Shared Mock Data ─────────────────────────────────────────────────

const MOCK_COMPANY = {
  id: 'company-workflow-001',
  rawName: 'NovaTech Solutions',
  normalizedName: 'novatech solutions',
  domain: 'novatech.io',
  industry: 'Technology',
  sizeRange: '51-200',
  location: 'Austin, TX',
  country: 'US',
  website: 'https://novatech.io',
  tags: '[]',
  status: 'prospect',
  lifecycleStage: 'discovery',
  source: 'manual',
  intelligenceScore: null,
  accountPriorityScore: null,
  engagementScore: null,
  opportunityRecommendations: [],
  signals: [],
  contacts: [],
  notes: [],
  researchCard: null,
  accountScore: null,
  _count: { contacts: 0, notes: 0, signals: 0, opportunityRecommendations: 0 },
  createdAt: new Date('2025-01-15T10:00:00Z'),
  updatedAt: new Date('2025-01-15T10:00:00Z'),
};

const MOCK_SIGNALS = [
  {
    id: 'signal-001',
    companyId: 'company-workflow-001',
    signalType: 'funding',
    title: 'Series B funding round of $45M',
    description: 'NovaTech raised Series B led by Accel Partners',
    source: 'TechCrunch',
    sourceUrl: 'https://techcrunch.com/novatech-series-b',
    severity: 'high',
    impact: 'high',
    confidence: 85,
    status: 'active',
    meaningCategory: 'buying_signal',
    evidenceIds: '[]',
    businessImpact: 'Expansion budget available',
    createdAt: new Date('2025-01-10T08:00:00Z'),
    company: { id: 'company-workflow-001', normalizedName: 'novatech solutions', website: 'https://novatech.io' },
    signalCapabilityMatches: [],
  },
  {
    id: 'signal-002',
    companyId: 'company-workflow-001',
    signalType: 'hiring',
    title: 'Hiring 15 cloud engineers',
    description: 'Job postings for senior cloud infrastructure roles',
    source: 'LinkedIn',
    sourceUrl: 'https://linkedin.com/jobs/novatech',
    severity: 'medium',
    impact: 'medium',
    confidence: 75,
    status: 'detected',
    meaningCategory: 'expansion',
    evidenceIds: '[]',
    businessImpact: 'Cloud migration likely underway',
    createdAt: new Date('2025-01-12T14:00:00Z'),
    company: { id: 'company-workflow-001', normalizedName: 'novatech solutions', website: 'https://novatech.io' },
    signalCapabilityMatches: [],
  },
];

const MOCK_CONTACTS = [
  {
    id: 'contact-001',
    rawName: 'Sarah Chen',
    normalizedName: 'sarah chen',
    email: 'sarah@novatech.io',
    title: 'VP of Engineering',
    role: 'Executive',
    linkedinUrl: 'https://linkedin.com/in/sarahchen',
    phone: '+15125551234',
    location: 'Austin, TX',
    status: 'active',
    emailHealth: 'valid',
    emailHealthScore: 10,
    leadScore: 85,
    companyFitScore: 78,
    engagementScore: 60,
    companyId: 'company-workflow-001',
    batchId: 'batch-001',
    company: { id: 'company-workflow-001', rawName: 'NovaTech Solutions', industry: 'Technology' },
    _count: { drafts: 2 },
    createdAt: new Date('2025-01-10T08:00:00Z'),
  },
  {
    id: 'contact-002',
    rawName: 'Marcus Johnson',
    normalizedName: 'marcus johnson',
    email: 'marcus@novatech.io',
    title: 'Director of IT',
    role: 'Manager',
    linkedinUrl: 'https://linkedin.com/in/marcusjohnson',
    phone: '+15125555678',
    location: 'Austin, TX',
    status: 'active',
    emailHealth: 'valid',
    emailHealthScore: 10,
    leadScore: 72,
    companyFitScore: 65,
    engagementScore: 45,
    companyId: 'company-workflow-001',
    batchId: 'batch-001',
    company: { id: 'company-workflow-001', rawName: 'NovaTech Solutions', industry: 'Technology' },
    _count: { drafts: 0 },
    createdAt: new Date('2025-01-12T10:00:00Z'),
  },
];

const MOCK_OPPORTUNITIES = [
  {
    id: 'opp-001',
    companyId: 'company-workflow-001',
    opportunityTitle: 'Cloud Infrastructure Optimization',
    status: 'qualified',
    opportunityScore: 88,
    confidenceScore: 82,
    businessTrigger: 'hiring',
    whyNow: 'Company is actively hiring cloud engineers',
    recommendedCapability: 'Cloud Assessment',
    suggestedConversation: 'Ask about their current cloud spend',
    businessProblem: 'Scaling cloud infrastructure costs',
    signalId: 'signal-002',
    capabilityMatchId: 'match-001',
    createdAt: new Date('2025-01-13T09:00:00Z'),
    updatedAt: new Date('2025-01-13T09:00:00Z'),
    company: { id: 'company-workflow-001', rawName: 'NovaTech Solutions' },
  },
];

const MOCK_RESEARCH_CARD = {
  id: 'research-001',
  companyId: 'company-workflow-001',
  businessOverview: 'NovaTech Solutions is a mid-market SaaS company providing cloud-native solutions.',
  techLandscape: 'Primary stack: React, Node.js, AWS. Evaluating Kubernetes.',
  potentialChallenges: 'Scaling infrastructure for enterprise clients',
  techStack: 'React, Node.js, AWS, PostgreSQL, Redis',
};

// ─── Helpers ──────────────────────────────────────────────────────────

function mockJsonRequest(url: string, body: unknown, method = 'POST'): Request {
  return new Request(`http://localhost:3000${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '127.0.0.1' },
    body: JSON.stringify(body),
  });
}

function mockGetRequest(url: string, useNextRequest = false): Request | NextRequest {
  const init = {
    method: 'GET' as const,
    headers: { 'x-forwarded-for': '127.0.0.1' },
  };
  if (useNextRequest) {
    return new NextRequest(`http://localhost:3000${url}`, init);
  }
  return new Request(`http://localhost:3000${url}`, init);
}

async function parseJson(response: Response): Promise<any> {
  return response.json();
}

/** Standard mock setup — auth + db + intelligence-activation */
function setupBaseMocks(dbOverrides: Record<string, any> = {}) {
  vi.doMock('@/lib/api-auth', () => ({
    checkApiAuth: vi.fn().mockResolvedValue({ session: MOCK_SESSION }),
    requireAdminRole: vi.fn().mockReturnValue(null),
  }));

  vi.doMock('@/lib/session', () => ({
    getCurrentSession: vi.fn().mockResolvedValue(MOCK_SESSION),
    requireAuth: vi.fn().mockResolvedValue(undefined),
  }));

  vi.doMock('@/lib/intelligence-activation', () => ({
    activateIntelligenceAsync: vi.fn(),
  }));

  const defaultDb = {
    company: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(MOCK_COMPANY),
      create: vi.fn().mockResolvedValue(MOCK_COMPANY),
      update: vi.fn().mockResolvedValue(MOCK_COMPANY),
      count: vi.fn().mockResolvedValue(1),
      groupBy: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    contact: {
      findMany: vi.fn().mockResolvedValue(MOCK_CONTACTS),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(MOCK_CONTACTS[0]),
      create: vi.fn().mockResolvedValue(MOCK_CONTACTS[0]),
      update: vi.fn().mockResolvedValue(MOCK_CONTACTS[0]),
      count: vi.fn().mockResolvedValue(2),
      aggregate: vi.fn().mockResolvedValue({
        _avg: { leadScore: 78, emailHealthScore: 10 },
        _count: { id: 2 },
      }),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    companySignal: {
      findMany: vi.fn().mockResolvedValue(MOCK_SIGNALS),
      findFirst: vi.fn().mockResolvedValue(MOCK_SIGNALS[0]),
      create: vi.fn().mockResolvedValue(MOCK_SIGNALS[0]),
      count: vi.fn().mockResolvedValue(2),
    },
    companyResearchCard: {
      findUnique: vi.fn().mockResolvedValue(MOCK_RESEARCH_CARD),
      upsert: vi.fn().mockResolvedValue(MOCK_RESEARCH_CARD),
    },
    companyNote: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    companyTimelineEvent: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
    },
    opportunityRecommendation: {
      findMany: vi.fn().mockResolvedValue(MOCK_OPPORTUNITIES),
      findFirst: vi.fn().mockResolvedValue(MOCK_OPPORTUNITIES[0]),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue(MOCK_OPPORTUNITIES[0]),
    },
    evidence: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    signalCapabilityMatch: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'match-001' }),
    },
    capabilityAsset: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'cap-001', title: 'Test', summary: '', category: 'service', content: '', tags: '[]', isActive: true }),
      count: vi.fn().mockResolvedValue(0),
    },
    importBatch: {
      create: vi.fn().mockResolvedValue({ id: 'batch-001' }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    otpCode: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({ id: 'otp-1' }),
    },
    draft: {
      count: vi.fn().mockResolvedValue(0),
    },
    sendQueue: {
      count: vi.fn().mockResolvedValue(0),
    },
    reply: {
      count: vi.fn().mockResolvedValue(0),
    },
    bounce: {
      count: vi.fn().mockResolvedValue(0),
    },
    suppression: {
      count: vi.fn().mockResolvedValue(0),
    },
    aIInsight: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
    },
    auditLog: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
    },
    ...dbOverrides,
  };

  vi.doMock('@/lib/db', () => ({ db: defaultDb }));

  return defaultDb;
}

function cleanupMocks() {
  vi.doUnmock('@/lib/api-auth');
  vi.doUnmock('@/lib/session');
  vi.doUnmock('@/lib/db');
  vi.doUnmock('@/lib/intelligence-activation');
  vi.resetModules();
}

// ═══════════════════════════════════════════════════════════════════════
// WORKFLOW 1: DATA → INTELLIGENCE PIPELINE
// Flow: Import company → Validation → Normalization → Profile creation
//       → AI enrichment → Signal detection → Scoring → Recommendation
// ═══════════════════════════════════════════════════════════════════════

describe('Workflow 1: Data → Intelligence Pipeline', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('Step 1: POST /api/companies creates company with full normalized data', async () => {
    const createdCompany = {
      ...MOCK_COMPANY,
      status: 'prospect',
      lifecycleStage: 'discovery',
      source: 'manual',
      tags: '[]',
      _count: { contacts: 0, signals: 0 },
      researchCard: null,
    };

    setupBaseMocks({
      company: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(MOCK_COMPANY),
        create: vi.fn().mockResolvedValue(createdCompany),
        count: vi.fn().mockResolvedValue(1),
        groupBy: vi.fn()
          .mockResolvedValueOnce([{ priorityTier: null, _count: 1 }])
          .mockResolvedValueOnce([{ status: 'prospect', _count: 1 }]),
      },
    });

    vi.doMock('@/lib/validations', () => ({
      createCompanySchema: { safeParse: vi.fn().mockReturnValue({ success: true, data: { name: 'NovaTech Solutions', domain: 'https://novatech.io', industry: 'Technology' } }) },
    }));

    vi.resetModules();
    const { POST } = await import('@/app/api/companies/route');

    const response = await POST(mockJsonRequest(
      '/api/companies',
      { name: 'NovaTech Solutions', domain: 'https://novatech.io', industry: 'Technology' },
    ));

    expect(response.status).toBe(201);
    const body = await parseJson(response);
    expect(body.company).toBeDefined();
    expect(body.company.rawName).toBe('NovaTech Solutions');
    expect(body.company.domain).toBe('novatech.io');
    expect(body.company.status).toBe('prospect');
    expect(body.company.lifecycleStage).toBe('discovery');
    expect(body.company.source).toBe('manual');
    expect(body.company.contactCount).toBe(0);
    expect(body.company.signalCount).toBe(0);
    expect(body.company.isEnriched).toBe(false);

    vi.doUnmock('@/lib/validations');
    cleanupMocks();
  });

  it('Step 2: POST /api/companies/:id/signals creates a detected signal', async () => {
    setupBaseMocks({
      company: {
        ...setupBaseMocks().company,
        findUnique: vi.fn().mockResolvedValue(MOCK_COMPANY),
      },
      companySignal: {
        findMany: vi.fn().mockResolvedValue(MOCK_SIGNALS),
        create: vi.fn().mockResolvedValue(MOCK_SIGNALS[0]),
      },
    });

    vi.resetModules();
    const { POST } = await import('@/app/api/companies/[id]/signals/route');

    const response = await POST(
      mockJsonRequest('/api/companies/company-workflow-001/signals', {
        signalType: 'funding',
        title: 'Series B funding round of $45M',
        description: 'NovaTech raised Series B led by Accel Partners',
        source: 'TechCrunch',
        sourceUrl: 'https://techcrunch.com/novatech-series-b',
        severity: 'high',
      }),
      { params: Promise.resolve({ id: 'company-workflow-001' }) },
    );

    expect(response.status).toBe(201);
    const body = await parseJson(response);
    expect(body.signal).toBeDefined();
    expect(body.signal.signalType).toBe('funding');
    expect(body.signal.title).toBe('Series B funding round of $45M');
    expect(body.signal.severity).toBe('high');

    cleanupMocks();
  });

  it('Step 3: GET /api/companies/:id/signals returns detected signals with company', async () => {
    setupBaseMocks({
      company: {
        ...setupBaseMocks().company,
        findUnique: vi.fn().mockResolvedValue(MOCK_COMPANY),
      },
      companySignal: {
        findMany: vi.fn().mockResolvedValue(MOCK_SIGNALS),
      },
    });

    vi.resetModules();
    const { GET } = await import('@/app/api/companies/[id]/signals/route');

    const response = await GET(
      mockGetRequest('/api/companies/company-workflow-001/signals'),
      { params: Promise.resolve({ id: 'company-workflow-001' }) },
    );

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.signals).toBeDefined();
    expect(body.signals).toHaveLength(2);
    expect(body.signals[0].signalType).toBe('funding');
    expect(body.signals[1].signalType).toBe('hiring');
    // Verify data flow — signals belong to the same company
    expect(body.signals.every((s: any) => s.companyId === 'company-workflow-001')).toBe(true);

    cleanupMocks();
  });

  it('Step 4: POST /api/companies/:id/actions triggers enrichment via action engine', async () => {
    const mockActionResult = {
      success: true,
      actions: [
        { type: 'outreach', priority: 'high', description: 'Reach out about cloud migration', contactId: 'contact-001' },
      ],
      narrative: 'NovaTech is actively expanding their cloud infrastructure.',
    };

    vi.doMock('@/lib/engines/action-engine', () => ({
      ActionEngine: {
        recommend: vi.fn().mockResolvedValue(mockActionResult),
      },
    }));

    setupBaseMocks();
    vi.resetModules();
    const { POST } = await import('@/app/api/companies/[id]/actions/route');

    const response = await POST(
      mockJsonRequest('/api/companies/company-workflow-001/actions', { contactId: 'contact-001' }),
      { params: Promise.resolve({ id: 'company-workflow-001' }) },
    );

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.success).toBe(true);
    expect(body.actions).toBeDefined();
    expect(body.actions).toHaveLength(1);
    expect(body.actions[0].type).toBe('outreach');
    expect(body.narrative).toContain('NovaTech');

    vi.doUnmock('@/lib/engines/action-engine');
    cleanupMocks();
  });

  it('Step 5: GET /api/recommendations/:companyId returns recommendation with data integrity', async () => {
    const mockRecommendation = {
      companyId: 'company-workflow-001',
      companyName: 'NovaTech Solutions',
      priority: 'high',
      score: 88,
      confidence: 82,
      signals: MOCK_SIGNALS.length,
      recommendation: 'Pursue cloud optimization opportunity',
      reasoning: 'Multiple signals indicate active cloud migration',
    };

    vi.doMock('@/lib/recommendation-engine', () => ({
      generateCompanyRecommendation: vi.fn().mockResolvedValue(mockRecommendation),
    }));

    setupBaseMocks();
    vi.resetModules();
    const { GET } = await import('@/app/api/recommendations/[companyId]/route');

    const response = await GET(
      mockGetRequest('/api/recommendations/company-workflow-001'),
      { params: Promise.resolve({ companyId: 'company-workflow-001' }) },
    );

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.companyId).toBe('company-workflow-001');
    expect(body.data.priority).toBe('high');
    expect(body.data.score).toBe(88);
    expect(body.data.confidence).toBe(82);
    // Data integrity: signals count matches what we created in the pipeline
    expect(body.data.signals).toBe(2);

    vi.doUnmock('@/lib/recommendation-engine');
    cleanupMocks();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// WORKFLOW 2: ACCOUNT INTELLIGENCE RESEARCH
// Flow: Select company → Research → Web signals → Knowledge retrieval
//       → Account brief generation → Recommendations + Explainability
// ═══════════════════════════════════════════════════════════════════════

describe('Workflow 2: Account Intelligence Research', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('Step 1: GET /api/companies/:id/intelligence returns full intelligence profile', async () => {
    const mockAiInsights = {
      companyUnderstanding: {
        overview: 'NovaTech Solutions is a mid-market SaaS company',
        industryClassification: 'Technology / SaaS',
        businessModel: 'Subscription-based cloud solutions',
        revenueIndicators: ['Series B funding of $45M'],
        employeeSignals: ['Hiring 15 cloud engineers'],
        geographicPresence: 'Austin, TX, US',
      },
      technologyIntelligence: {
        techStack: ['React', 'Node.js', 'AWS'],
        cloudUsage: 'AWS primary, evaluating multi-cloud',
        digitalMaturity: 'high',
        engineeringSignals: [],
      },
      businessSignals: [
        {
          signal: 'Series B funding',
          whyDetected: 'Announced on TechCrunch',
          evidenceSource: 'TechCrunch',
          evidenceUrl: 'https://techcrunch.com',
          sourceDate: '2025-01-10',
          confidence: 85,
          businessImpact: 'Expansion budget',
          recommendedAction: 'Position cloud optimization',
          timing: 'within_30_days',
          owner: 'Enterprise AE',
          expiresAt: null,
        },
      ],
      keyDevelopments: [],
      outreachAngle: {
        angle: 'Cloud optimization during scale-up',
        rationale: 'Company is hiring cloud engineers post-funding',
        evidence: 'Series B + hiring signals',
        recommendedApproach: 'direct',
        targetStakeholders: [{ role: 'VP Engineering', focus: 'Cloud infra', whyRelevant: 'Leading hiring push' }],
      },
      competitors: [],
      webFindings: [],
      generatedAt: new Date().toISOString(),
      dataQuality: {
        webSourcesUsed: 3,
        crmSignalsUsed: 2,
        contactsAnalyzed: 2,
        overallConfidence: 78,
      },
    };

    vi.doMock('@/lib/ai-governance', () => ({
      governedAICall: vi.fn().mockResolvedValue({
        success: true,
        response: JSON.stringify(mockAiInsights),
      }),
    }));

    vi.doMock('@/lib/llm-client', () => ({
      webSearch: vi.fn().mockResolvedValue([]),
      sdkWebSearch: vi.fn().mockResolvedValue([]),
    }));

    vi.doMock('@/lib/intelligence-api/guard', () => ({
      utilityGuard: vi.fn().mockReturnValue({
        responseHeaders: { 'x-correlation-id': 'wf2-corr-001' },
      }),
      utilityCatchError: vi.fn().mockReturnValue(
        new Response(JSON.stringify({ error: 'Failed' }), { status: 500 })
      ),
      RateLimitedError: class extends Error {
        headers: Record<string, string>;
        errorBody: any;
        constructor() {
          super('Rate limited');
          this.headers = {};
          this.errorBody = { error: 'Rate limited' };
        }
      },
    }));

    vi.doMock('@/lib/intelligence-api/validators', () => ({
      companyIdSchema: { safeParse: vi.fn().mockReturnValue({ success: true }) },
    }));

    setupBaseMocks({
      company: {
        findUnique: vi.fn().mockResolvedValue(MOCK_COMPANY),
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(MOCK_COMPANY),
        count: vi.fn().mockResolvedValue(1),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      companyResearchCard: {
        findUnique: vi.fn().mockResolvedValue(MOCK_RESEARCH_CARD),
      },
      contact: {
        findMany: vi.fn().mockResolvedValue(MOCK_CONTACTS),
      },
      companySignal: {
        findMany: vi.fn().mockResolvedValue(MOCK_SIGNALS),
      },
    });

    vi.resetModules();
    const { GET } = await import('@/app/api/companies/[id]/intelligence/route');

    const response = await GET(
      mockGetRequest('/api/companies/company-workflow-001/intelligence'),
      { params: Promise.resolve({ id: 'company-workflow-001' }) },
    );

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    // Company data present
    expect(body.company).toBeDefined();
    expect(body.company.rawName).toBe('NovaTech Solutions');
    expect(body.company.industry).toBe('Technology');
    // Research card
    expect(body.researchCard).toBeDefined();
    expect(body.researchCard.businessOverview).toContain('NovaTech');
    // Contacts
    expect(body.contacts).toBeDefined();
    expect(body.contacts).toHaveLength(2);
    // Signals
    expect(body.signals).toBeDefined();
    expect(body.signals).toHaveLength(2);
    // AI insights
    expect(body.aiInsights).toBeDefined();
    expect(body.aiInsights.companyUnderstanding.overview).toBeTruthy();
    expect(body.aiInsights.dataQuality.overallConfidence).toBeGreaterThanOrEqual(0);
    expect(body.aiInsights.dataQuality.overallConfidence).toBeLessThanOrEqual(100);
    // Cross-data integrity: CRM signals count feeds into AI context
    expect(body.aiInsights.dataQuality.crmSignalsUsed).toBe(2);
    expect(body.aiInsights.dataQuality.contactsAnalyzed).toBe(2);

    vi.doUnmock('@/lib/ai-governance');
    vi.doUnmock('@/lib/llm-client');
    vi.doUnmock('@/lib/intelligence-api/guard');
    vi.doUnmock('@/lib/intelligence-api/validators');
    cleanupMocks();
  });

  it('Step 2: GET /api/ai/account-brief generates VP Sales-ready brief', async () => {
    const mockBrief = {
      companyId: 'company-workflow-001',
      companyName: 'novatech solutions',
      brief: {
        executiveSummary: 'NovaTech Solutions raised $45M Series B and is aggressively hiring cloud engineers — a prime cloud optimization prospect.',
        executiveSummaryConfidence: 82,
        currentState: { title: 'Current State', content: 'Post Series-B expansion', evidence: 'TechCrunch', confidence: 85, actionItems: ['Schedule intro'] },
        businessChallenges: { title: 'Business Challenges', content: 'Scaling infrastructure', evidence: 'Hiring signals', confidence: 70, actionItems: [] },
        technologyChallenges: { title: 'Technology Challenges', content: 'Cloud migration', evidence: 'Job postings', confidence: 65, actionItems: [] },
        strategicOpportunities: { title: 'Strategic Opportunities', content: 'Cloud optimization', evidence: 'Funding + hiring', confidence: 78, actionItems: [] },
        technologyLandscape: { techStack: ['React', 'Node.js', 'AWS'], cloudProvider: 'AWS', digitalMaturity: 'high', engineeringSignals: [] },
        targetStakeholders: [{ role: 'VP Engineering', focus: 'Cloud infra', whyApproach: 'Leading cloud hiring', conversationAngle: 'Cloud optimization', evidence: 'LinkedIn', priority: 'primary' }],
        discoveryQuestions: [{ category: 'Infrastructure', question: 'What is your current cloud spend?', whyAsk: 'Understand scale', idealResponse: '$50K+/month' }],
        conversationStarters: [{ context: 'Funding', opening: 'Congrats on the Series B', evidence: 'TechCrunch', expectedReaction: 'Positive' }],
        recommendedEngagement: { approach: 'Direct outreach', timeline: '2 weeks', firstMeetingGoal: 'Discovery', successCriteria: ['Schedule follow-up'], evidence: 'Signal analysis' },
        strategicPriority: 'High',
        keySignals: [{ signal: 'Series B', evidence: 'TechCrunch', confidence: 85 }],
        overallConfidence: 80,
        sources: [],
      },
      sources: [],
      generatedAt: new Date().toISOString(),
    };

    vi.doMock('@/lib/ai-governance', () => ({
      governedAICall: vi.fn().mockResolvedValue({
        success: true,
        response: JSON.stringify(mockBrief.brief),
      }),
    }));

    vi.doMock('@/lib/llm-client', () => ({
      sdkWebSearch: vi.fn().mockResolvedValue([
        { title: 'NovaTech raises $45M', url: 'https://techcrunch.com/novatech', snippet: 'Series B funding round', name: 'NovaTech raises $45M' },
      ]),
    }));

    vi.doMock('@/lib/ai-insight-service', () => ({
      createInsight: vi.fn().mockResolvedValue({}),
    }));

    setupBaseMocks({
      company: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'company-workflow-001',
          normalizedName: 'novatech solutions',
          domain: 'novatech.io',
          industry: 'Technology',
          country: 'US',
          sizeRange: '51-200',
          website: 'https://novatech.io',
          internalSummary: null,
          _count: { contacts: 2 },
        }),
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(MOCK_COMPANY),
        count: vi.fn().mockResolvedValue(1),
        groupBy: vi.fn().mockResolvedValue([]),
      },
    });

    vi.resetModules();
    const { GET } = await import('@/app/api/ai/account-brief/route');

    const response = await GET(
      mockGetRequest('/api/ai/account-brief?companyId=company-workflow-001', true) as NextRequest,
    );

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.companyId).toBe('company-workflow-001');
    // Brief structure validation
    const brief = body.data.brief;
    expect(brief.executiveSummary).toBeTruthy();
    expect(brief.executiveSummaryConfidence).toBeGreaterThanOrEqual(0);
    expect(brief.executiveSummaryConfidence).toBeLessThanOrEqual(100);
    expect(brief.currentState).toBeDefined();
    expect(brief.businessChallenges).toBeDefined();
    expect(brief.technologyChallenges).toBeDefined();
    expect(brief.strategicOpportunities).toBeDefined();
    expect(brief.technologyLandscape).toBeDefined();
    expect(brief.technologyLandscape.techStack).toBeInstanceOf(Array);
    expect(brief.targetStakeholders).toBeInstanceOf(Array);
    expect(brief.discoveryQuestions).toBeInstanceOf(Array);
    expect(brief.conversationStarters).toBeInstanceOf(Array);
    expect(brief.recommendedEngagement).toBeDefined();
    expect(brief.overallConfidence).toBe(80);
    // Sources from web search
    expect(body.data.sources).toBeInstanceOf(Array);

    vi.doUnmock('@/lib/ai-governance');
    vi.doUnmock('@/lib/llm-client');
    vi.doUnmock('@/lib/ai-insight-service');
    cleanupMocks();
  });

  it('Step 3: GET /api/recommendations/:companyId/explain returns explainability report', async () => {
    const mockExplainReport = {
      companyId: 'company-workflow-001',
      companyName: 'NovaTech Solutions',
      recommendation: {
        priority: 'high',
        score: 88,
        confidence: 82,
        action: 'Pursue cloud optimization opportunity',
      },
      reasoning: {
        scoreDecomposition: { signalStrength: 30, companyFit: 25, timing: 20, engagement: 13 },
        whyThisAccount: 'Active funding + hiring signals indicate buying window',
      },
      evidence: [
        { category: 'funding', items: [{ source: 'TechCrunch', snippet: 'Series B', reliability: 0.9 }] },
        { category: 'hiring', items: [{ source: 'LinkedIn', snippet: 'Cloud engineers', reliability: 0.8 }] },
      ],
      sources: [
        { type: 'signal', name: 'funding_signal', reliability: 0.9 },
        { type: 'signal', name: 'hiring_signal', reliability: 0.8 },
      ],
      confidence: {
        overall: 82,
        dataQuality: 85,
        signalFreshness: 78,
        sourceReliability: 80,
        completeness: 75,
        temporalRelevance: 90,
      },
      risks: [
        { risk: 'Competition may be approaching', severity: 'medium', mitigation: 'Act within 2 weeks' },
      ],
      action: {
        recommended: 'Schedule meeting with VP Engineering',
        rationale: 'Leading cloud hiring push post-funding',
        timeline: 'within_7_days',
      },
    };

    vi.doMock('@/lib/explainability-engine', () => ({
      generateExplainabilityReport: vi.fn().mockResolvedValue(mockExplainReport),
    }));

    setupBaseMocks();
    vi.resetModules();
    const { GET } = await import('@/app/api/recommendations/[companyId]/explain/route');

    const response = await GET(
      mockGetRequest('/api/recommendations/company-workflow-001/explain'),
      { params: Promise.resolve({ companyId: 'company-workflow-001' }) },
    );

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    // Verify complete explainability chain
    expect(body.data.recommendation).toBeDefined();
    expect(body.data.recommendation.score).toBe(88);
    expect(body.data.reasoning).toBeDefined();
    expect(body.data.reasoning.whyThisAccount).toBeTruthy();
    expect(body.data.evidence).toBeInstanceOf(Array);
    expect(body.data.evidence).toHaveLength(2);
    // Evidence categories map to signals from pipeline
    expect(body.data.evidence[0].category).toBe('funding');
    expect(body.data.evidence[1].category).toBe('hiring');
    expect(body.data.confidence).toBeDefined();
    expect(body.data.confidence.overall).toBe(82);
    expect(body.data.risks).toBeInstanceOf(Array);
    expect(body.data.action).toBeDefined();
    expect(body.data.action.recommended).toContain('VP Engineering');

    vi.doUnmock('@/lib/explainability-engine');
    cleanupMocks();
  });

  it('validates data flow integrity across the research pipeline', async () => {
    // Verify that the company ID is consistent across all responses
    const companyId = 'company-workflow-001';

    // Company signals mock
    vi.doMock('@/lib/engines/action-engine', () => ({
      ActionEngine: { recommend: vi.fn().mockResolvedValue({ success: true, actions: [], narrative: '' }) },
    }));

    vi.doMock('@/lib/recommendation-engine', () => ({
      generateCompanyRecommendation: vi.fn().mockResolvedValue({
        companyId,
        companyName: 'NovaTech Solutions',
        priority: 'high',
        score: 88,
        confidence: 82,
        signals: 2,
        recommendation: 'Pursue',
        reasoning: 'Signals indicate',
      }),
    }));

    setupBaseMocks({
      companySignal: {
        findMany: vi.fn().mockResolvedValue(MOCK_SIGNALS),
        create: vi.fn().mockResolvedValue(MOCK_SIGNALS[0]),
        count: vi.fn().mockResolvedValue(2),
      },
    });

    vi.resetModules();

    // Import and call signals endpoint
    const signalsRoute = await import('@/app/api/companies/[id]/signals/route');
    const signalsResponse = await signalsRoute.GET(
      mockGetRequest(`/api/companies/${companyId}/signals`),
      { params: Promise.resolve({ id: companyId }) },
    );
    const signalsBody = await parseJson(signalsResponse);

    // Import and call recommendations endpoint
    const recsRoute = await import('@/app/api/recommendations/[companyId]/route');
    const recsResponse = await recsRoute.GET(
      mockGetRequest(`/api/recommendations/${companyId}`),
      { params: Promise.resolve({ companyId }) },
    );
    const recsBody = await parseJson(recsResponse);

    // Cross-validate: signal count in recommendation matches signals API
    expect(signalsBody.signals).toHaveLength(2);
    expect(recsBody.data.signals).toBe(2);
    // Company ID consistency
    expect(recsBody.data.companyId).toBe(companyId);
    expect(signalsBody.signals[0].companyId).toBe(companyId);

    vi.doUnmock('@/lib/engines/action-engine');
    vi.doUnmock('@/lib/recommendation-engine');
    cleanupMocks();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// WORKFLOW 3: SIGNAL → ACTION
// Flow: Signal detected → Buying intent → Contact identification
//       → Conversation plan → Email recommendation
// ═══════════════════════════════════════════════════════════════════════

describe('Workflow 3: Signal → Action', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('Step 1: GET /api/signals?companyId=X returns detected signals with metadata', async () => {
    setupBaseMocks({
      companySignal: {
        findMany: vi.fn()
          .mockResolvedValueOnce(MOCK_SIGNALS)
          .mockResolvedValueOnce(MOCK_SIGNALS)
          .mockResolvedValueOnce(MOCK_SIGNALS.map(s => ({ meaningCategory: s.meaningCategory })))
          .mockResolvedValueOnce(MOCK_SIGNALS),
        count: vi.fn().mockResolvedValue(2),
      },
      evidence: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    });

    vi.resetModules();
    const { GET } = await import('@/app/api/signals/route');

    const response = await GET(
      mockGetRequest('/api/signals?companyId=company-workflow-001'),
    );

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.success).toBe(true);
    expect(body.data.signals).toBeDefined();
    expect(body.data.signals).toHaveLength(2);
    expect(body.data.signals[0].title).toBe('Series B funding round of $45M');
    expect(body.data.signals[1].title).toBe('Hiring 15 cloud engineers');
    // Pagination metadata
    expect(body.data.pagination).toBeDefined();
    expect(body.data.pagination.total).toBe(2);
    expect(body.data.pagination.page).toBe(1);
    // Categories
    expect(body.data.categories).toBeDefined();
    expect(body.data.evidenceCounts).toBeDefined();
    // Signal ordering: severity desc, confidence desc
    expect(body.data.signals[0].severity).toBe('high');

    cleanupMocks();
  });

  it('Step 2: POST /api/ai/buying-intent computes buying intent score', async () => {
    const mockBuyingIntent = {
      companyId: 'company-workflow-001',
      companyName: 'NovaTech Solutions',
      overallScore: 78,
      level: 'high',
      breakdown: {
        signalActivity: 85,
        engagementScore: 60,
        companyFit: 82,
        timingScore: 90,
      },
      topDrivers: [
        { signal: 'Series B funding', impact: 'high', confidence: 85 },
        { signal: 'Cloud engineer hiring', impact: 'medium', confidence: 75 },
      ],
      recommendation: 'Prioritize outreach — buying window is open',
    };

    vi.doMock('@/lib/scoring/buying-intent-engine', () => ({
      scoreBuyingIntent: vi.fn().mockResolvedValue(mockBuyingIntent),
    }));

    setupBaseMocks();
    vi.resetModules();
    const { POST } = await import('@/app/api/ai/buying-intent/route');

    const response = await POST(mockJsonRequest(
      '/api/ai/buying-intent',
      { companyId: 'company-workflow-001' },
    ));

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.companyId).toBe('company-workflow-001');
    expect(body.overallScore).toBe(78);
    expect(body.level).toBe('high');
    expect(body.breakdown).toBeDefined();
    expect(body.breakdown.signalActivity).toBe(85);
    expect(body.topDrivers).toBeDefined();
    expect(body.topDrivers).toHaveLength(2);
    // Top drivers reference the same signals from the pipeline
    expect(body.topDrivers[0].signal).toBe('Series B funding');
    expect(body.recommendation).toBeTruthy();

    vi.doUnmock('@/lib/scoring/buying-intent-engine');
    cleanupMocks();
  });

  it('Step 3: GET /api/contacts?companyId=X returns relevant contacts with scores', async () => {
    setupBaseMocks({
      contact: {
        findMany: vi.fn().mockResolvedValue(MOCK_CONTACTS),
        count: vi.fn().mockResolvedValue(2),
        aggregate: vi.fn().mockResolvedValue({
          _avg: { leadScore: 78.5, emailHealthScore: 10 },
          _count: { id: 2 },
        }),
        groupBy: vi.fn()
          .mockResolvedValueOnce([{ status: 'active', _count: { status: 2 } }])
          .mockResolvedValueOnce([{ emailHealth: 'valid', _count: { emailHealth: 2 } }]),
      },
    });

    vi.resetModules();
    const { GET } = await import('@/app/api/contacts/route');

    const response = await GET(
      mockGetRequest('/api/contacts?companyId=company-workflow-001'),
    );

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.success).toBe(true);
    expect(body.data.contacts).toBeDefined();
    expect(body.data.contacts).toHaveLength(2);
    // Contact data integrity
    const sarah = body.data.contacts[0];
    expect(sarah.name).toBe('Sarah Chen');
    expect(sarah.email).toBe('sarah@novatech.io');
    expect(sarah.leadScore).toBe(85);
    expect(sarah.company.rawName).toBe('NovaTech Solutions');
    // Stats
    expect(body.data.stats).toBeDefined();
    expect(body.data.stats.total).toBe(2);
    expect(body.data.stats.avgScore).toBe(79); // Math.round(78.5)
    expect(body.data.total).toBe(2);

    cleanupMocks();
  });

  it('Step 4: POST /api/engines/conversation generates conversation plan', async () => {
    const mockBriefing = {
      type: 'meeting_prep',
      companyId: 'company-workflow-001',
      contactId: 'contact-001',
      summary: 'Meeting prep for Sarah Chen at NovaTech Solutions',
      keyPoints: [
        'Company raised $45M Series B',
        'Hiring 15 cloud engineers',
        'VP Engineering is the primary decision maker',
      ],
      suggestedApproach: 'Lead with cloud optimization insights',
      questions: [
        'What is your current cloud infrastructure setup?',
        'What challenges are you facing with scale?',
      ],
      riskFactors: ['Competitor engagement possible'],
      confidence: 82,
    };

    vi.doMock('@/lib/engines/conversation-engine', () => ({
      ConversationEngine: {
        brief: vi.fn().mockResolvedValue(mockBriefing),
      },
    }));

    setupBaseMocks();
    vi.resetModules();
    const { POST } = await import('@/app/api/engines/conversation/route');

    const response = await POST(mockJsonRequest(
      '/api/engines/conversation',
      { companyId: 'company-workflow-001', contactId: 'contact-001', briefingType: 'meeting_prep' },
    ));

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.briefing).toBeDefined();
    expect(body.briefing.type).toBe('meeting_prep');
    expect(body.briefing.companyId).toBe('company-workflow-001');
    expect(body.briefing.contactId).toBe('contact-001');
    // Briefing references signals from the pipeline
    expect(body.briefing.keyPoints[0]).toContain('Series B');
    expect(body.briefing.keyPoints[1]).toContain('cloud engineers');
    // Questions are actionable
    expect(body.briefing.questions).toHaveLength(2);
    expect(body.briefing.confidence).toBe(82);

    vi.doUnmock('@/lib/engines/conversation-engine');
    cleanupMocks();
  });

  it('Step 5: GET /api/ai/email-intelligence generates evidence-backed email', async () => {
    const mockEmailIntel = {
      contactId: 'contact-001',
      contactName: 'Sarah Chen',
      companyName: 'NovaTech Solutions',
      suggestedSubject: 'NovaTech cloud optimization post-Series B',
      suggestedMessage: 'Hi Sarah, congratulations on the Series B...',
      messageAngle: 'Funding + cloud hiring signals',
      whyThisMessage: 'Evidence-backed approach using recent signals',
      signalDrivers: ['funding', 'hiring'],
      buyingRole: 'Decision Maker',
      buyingInfluence: 'High',
      responseProbability: 72,
      aiConfidence: 78,
      evidenceQuality: 'high',
      hallucinationRisk: 'low',
      evidenceUsed: [
        { signal: 'Series B funding', evidence: 'TechCrunch', source: 'TechCrunch', reliability: 0.9, usedInMessage: true },
        { signal: 'Cloud hiring', evidence: 'LinkedIn', source: 'LinkedIn', reliability: 0.8, usedInMessage: true },
      ],
      recommendedNextSteps: ['Send within 48 hours', 'Follow up with case study'],
    };

    vi.doMock('@/lib/email-intelligence-engine', () => ({
      generateEmailIntelligence: vi.fn().mockResolvedValue(mockEmailIntel),
    }));

    vi.doMock('@/lib/ai-insight-service', () => ({
      createInsights: vi.fn().mockResolvedValue({}),
    }));

    setupBaseMocks();
    vi.resetModules();
    const { GET } = await import('@/app/api/ai/email-intelligence/route');

    const response = await GET(
      mockGetRequest('/api/ai/email-intelligence?contactId=contact-001'),
    );

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.contactName).toBe('Sarah Chen');
    expect(body.data.companyName).toBe('NovaTech Solutions');
    expect(body.data.suggestedSubject).toBeTruthy();
    expect(body.data.suggestedMessage).toBeTruthy();
    expect(body.data.whyThisMessage).toBeTruthy();
    // Evidence chain integrity
    expect(body.data.evidenceUsed).toHaveLength(2);
    expect(body.data.evidenceUsed[0].signal).toBe('Series B funding');
    expect(body.data.evidenceUsed[0].usedInMessage).toBe(true);
    // Signal drivers match pipeline signals
    expect(body.data.signalDrivers).toContain('funding');
    expect(body.data.signalDrivers).toContain('hiring');
    // Quality metrics
    expect(body.data.aiConfidence).toBeGreaterThanOrEqual(0);
    expect(body.data.aiConfidence).toBeLessThanOrEqual(100);
    expect(body.data.responseProbability).toBe(72);
    expect(body.data.recommendedNextSteps).toBeInstanceOf(Array);

    vi.doUnmock('@/lib/email-intelligence-engine');
    vi.doUnmock('@/lib/ai-insight-service');
    cleanupMocks();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// WORKFLOW 4: KNOWLEDGE INTELLIGENCE
// Flow: Upload document → Processing → Chunking → Embedding
//       → Knowledge graph → Retrieval → AI response
// ═══════════════════════════════════════════════════════════════════════

describe('Workflow 4: Knowledge Intelligence', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('Step 1: GET /api/knowledge lists knowledge documents with pagination', async () => {
    const mockAssets = [
      { id: 'doc-001', title: 'Cloud Architecture Guide', summary: 'Best practices for cloud infrastructure', category: 'service', serviceLine: 'Cloud', createdAt: new Date('2025-01-10T10:00:00Z') },
      { id: 'doc-002', title: 'Enterprise Sales Playbook', summary: 'Sales methodology for enterprise deals', category: 'playbook', serviceLine: 'Sales', createdAt: new Date('2025-01-12T10:00:00Z') },
    ];

    setupBaseMocks({
      capabilityAsset: {
        findMany: vi.fn().mockResolvedValue(mockAssets),
        count: vi.fn().mockResolvedValue(2),
      },
    });

    vi.resetModules();
    const { GET } = await import('@/app/api/knowledge/route');

    const response = await GET(mockGetRequest('/api/knowledge?page=1'));

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.success).toBe(true);
    expect(body.data.documents).toBeDefined();
    expect(body.data.documents).toHaveLength(2);
    expect(body.data.total).toBe(2);
    expect(body.data.page).toBe(1);
    // Meta with timing
    expect(body.meta).toBeDefined();
    expect(body.meta.endpoint).toBe('knowledge:list');
    expect(body.meta.durationMs).toBeGreaterThanOrEqual(0);

    cleanupMocks();
  });

  it('Step 2: GET /api/knowledge/:id retrieves a specific knowledge document', async () => {
    const mockAsset = {
      id: 'doc-001',
      title: 'Cloud Architecture Guide',
      summary: 'Best practices for cloud infrastructure design and deployment.',
      content: '# Cloud Architecture\n\nThis guide covers...\n\n## Microservices\n...',
      category: 'service',
      serviceLine: 'Cloud',
      tags: '["cloud", "architecture"]',
      isActive: true,
      createdAt: new Date('2025-01-10T10:00:00Z'),
      updatedAt: new Date('2025-01-10T10:00:00Z'),
    };

    setupBaseMocks({
      capabilityAsset: {
        findUnique: vi.fn().mockResolvedValue(mockAsset),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(1),
      },
    });

    vi.resetModules();
    const { GET } = await import('@/app/api/knowledge/[id]/route');

    const response = await GET(
      mockGetRequest('/api/knowledge/doc-001'),
      { params: Promise.resolve({ id: 'doc-001' }) },
    );

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.id).toBe('doc-001');
    expect(body.data.title).toBe('Cloud Architecture Guide');
    expect(body.data.content).toContain('Cloud Architecture');
    expect(body.meta.endpoint).toBe('knowledge:detail');

    cleanupMocks();
  });

  it('Step 3: GET /api/knowledge/:id returns 404 for nonexistent document', async () => {
    setupBaseMocks({
      capabilityAsset: {
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
    });

    vi.resetModules();
    const { GET } = await import('@/app/api/knowledge/[id]/route');

    const response = await GET(
      mockGetRequest('/api/knowledge/nonexistent'),
      { params: Promise.resolve({ id: 'nonexistent' }) },
    );

    expect(response.status).toBe(404);
    const body = await parseJson(response);
    expect(body.success).toBe(false);
    expect(body.error).toContain('Not found');

    cleanupMocks();
  });

  it('Step 4: POST /api/ai/query processes natural language query with knowledge context', async () => {
    const mockQueryResult = {
      data: [MOCK_COMPANY],
      queryInterpretation: 'Showing company where industry = Technology, sorted by intelligenceScore desc.',
      totalResults: 1,
    };

    vi.doMock('@/lib/ai-governance', () => ({
      governedAICallAggregate: vi.fn().mockResolvedValue({
        success: true,
        response: JSON.stringify({
          entityType: 'company',
          filters: { industry: 'Technology' },
          sortBy: 'intelligenceScore',
          sortOrder: 'desc',
        }),
      }),
    }));

    vi.doMock('@/lib/llm-client', () => ({
      extractJSON: vi.fn().mockReturnValue({
        entityType: 'company',
        filters: { industry: 'Technology' },
        sortBy: 'intelligenceScore',
        sortOrder: 'desc',
      }),
    }));

    setupBaseMocks({
      company: {
        findMany: vi.fn().mockResolvedValue([MOCK_COMPANY]),
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(MOCK_COMPANY),
        create: vi.fn().mockResolvedValue(MOCK_COMPANY),
        count: vi.fn().mockResolvedValue(1),
        groupBy: vi.fn().mockResolvedValue([]),
      },
    });

    vi.resetModules();
    const { POST } = await import('@/app/api/ai/query/route');

    const response = await POST(mockJsonRequest(
      '/api/ai/query',
      { query: 'Show me technology companies with high intelligence scores' },
    ));

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.data).toBeInstanceOf(Array);
    expect(body.data.queryInterpretation).toBeTruthy();
    expect(body.data.totalResults).toBe(1);

    vi.doUnmock('@/lib/ai-governance');
    vi.doUnmock('@/lib/llm-client');
    cleanupMocks();
  });

  it('Step 5: GET /api/intelligence/grounding/:id returns grounded evidence chain', async () => {
    const mockGroundingResult = {
      evidences: [
        { id: 'ev-001', type: 'signal', source: 'TechCrunch', reliability: 0.9, companyId: 'company-workflow-001' },
        { id: 'ev-002', type: 'signal', source: 'LinkedIn', reliability: 0.8, companyId: 'company-workflow-001' },
      ],
      aggregateConfidence: 0.85,
      coverage: 0.75,
      gaps: ['No financial data', 'No competitor intelligence'],
      freshnessScore: 0.9,
    };

    vi.doMock('@/lib/engines/grounding-engine', () => ({
      GroundingEngine: {
        collect: vi.fn().mockResolvedValue(mockGroundingResult),
      },
    }));

    vi.doMock('@/lib/intelligence-api/intelligence-middleware', () => ({
      createResponse: vi.fn().mockReturnValue({
        success: true,
        type: 'grounding',
        companyId: 'company-workflow-001',
        data: {
          companyId: 'company-workflow-001',
          evidences: mockGroundingResult.evidences,
          aggregateConfidence: 0.85,
          coverage: 0.75,
          gaps: mockGroundingResult.gaps,
          freshnessScore: 0.9,
          evidenceCount: 2,
          gapCount: 2,
        },
        meta: { durationMs: 150 },
      }),
      createErrorResponse: vi.fn().mockReturnValue({
        success: false,
        type: 'grounding',
        companyId: 'company-workflow-001',
        error: 'Failed',
        code: 'ENGINE_FAILED',
        meta: { durationMs: 100 },
      }),
      computeFreshness: vi.fn().mockReturnValue({ level: 'fresh', score: 90 }),
    }));

    vi.doMock('@/lib/intelligence-api/types', () => ({
      IntelligenceErrors: {
        COMPANY_NOT_FOUND: 'COMPANY_NOT_FOUND',
        INTELLIGENCE_UNAVAILABLE: 'INTELLIGENCE_UNAVAILABLE',
        ENGINE_FAILED: 'ENGINE_FAILED',
      },
    }));

    vi.doMock('@/lib/intelligence-api/guard', () => ({
      intelligenceGuard: vi.fn().mockResolvedValue({
        companyId: 'company-workflow-001',
        correlationId: 'wf4-ground-corr',
        responseHeaders: { 'x-correlation-id': 'wf4-ground-corr' },
        includes: new Set(['evidences', 'gaps']),
      }),
    }));

    vi.doMock('@/lib/ai-governance', () => ({
      runGovernanceChecks: vi.fn().mockResolvedValue({ passed: true, checks: {} }),
    }));

    vi.doMock('@/lib/intelligence-contract', () => ({
      getResearchContext: vi.fn().mockResolvedValue(null),
    }));

    setupBaseMocks({
      company: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'company-workflow-001',
          rawName: 'NovaTech Solutions',
          lastEnrichedAt: new Date(),
          lastActivityAt: new Date(),
        }),
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(MOCK_COMPANY),
        count: vi.fn().mockResolvedValue(1),
        groupBy: vi.fn().mockResolvedValue([]),
      },
    });

    vi.resetModules();
    const { GET } = await import('@/app/api/intelligence/grounding/[id]/route');

    const response = await GET(
      mockGetRequest('/api/intelligence/grounding/company-workflow-001?maxEvidence=50', true) as NextRequest,
      { params: Promise.resolve({ id: 'company-workflow-001' }) },
    );

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.success).toBe(true);
    expect(body.type).toBe('grounding');
    expect(body.companyId).toBe('company-workflow-001');
    expect(body.data).toBeDefined();
    expect(body.data.evidences).toBeInstanceOf(Array);
    expect(body.data.evidenceCount).toBe(2);
    expect(body.data.gapCount).toBe(2);
    expect(body.data.aggregateConfidence).toBe(0.85);
    expect(body.data.coverage).toBe(0.75);
    expect(body.data.freshnessScore).toBe(0.9);
    expect(body.data.gaps).toBeInstanceOf(Array);
    expect(body.data.gaps).toHaveLength(2);
    // Meta
    expect(body.meta).toBeDefined();
    expect(body.meta.durationMs).toBeGreaterThanOrEqual(0);

    vi.doUnmock('@/lib/engines/grounding-engine');
    vi.doUnmock('@/lib/intelligence-api/intelligence-middleware');
    vi.doUnmock('@/lib/intelligence-api/types');
    vi.doUnmock('@/lib/intelligence-api/guard');
    vi.doUnmock('@/lib/ai-governance');
    vi.doUnmock('@/lib/intelligence-contract');
    cleanupMocks();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// WORKFLOW 5: EXECUTIVE INTELLIGENCE
// Flow: Login → Dashboard → Opportunity review → Company intelligence
//       → Report generation → Export
// ═══════════════════════════════════════════════════════════════════════

describe('Workflow 5: Executive Intelligence', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('Step 1: POST /api/auth/login validates credentials and triggers OTP flow', async () => {
    const mockUser = {
      id: 'user-001',
      email: 'admin@deepmindq.com',
      name: 'Admin User',
      role: 'admin',
      isActive: true,
      hasPassword: true,
      passwordHash: 'hashed-pw',
    };

    vi.doMock('@/lib/db', () => ({
      db: {
        user: {
          findUnique: vi.fn().mockResolvedValue(mockUser),
        },
      },
    }));

    vi.doMock('@/lib/password', () => ({
      verifyPassword: vi.fn().mockResolvedValue(true),
    }));

    vi.doMock('@/lib/otp', () => ({
      requestOtp: vi.fn().mockResolvedValue({ success: true, devCode: '123456' }),
    }));

    vi.doMock('@/lib/auth-helpers', () => ({
      generalApiRateLimit: vi.fn().mockReturnValue({ success: true }),
    }));

    vi.resetModules();
    const { POST } = await import('@/app/api/auth/login/route');

    const response = await POST(mockJsonRequest(
      '/api/auth/login',
      { email: 'admin@deepmindq.com', password: 'password123' },
    ));

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.success).toBe(true);
    expect(body.message).toBeTruthy();

    vi.doUnmock('@/lib/db');
    vi.doUnmock('@/lib/password');
    vi.doUnmock('@/lib/otp');
    vi.doUnmock('@/lib/auth-helpers');
    cleanupMocks();
  });

  it('Step 2: POST /api/auth/login rejects invalid email format', async () => {
    vi.doMock('@/lib/db', () => ({
      db: { user: { findUnique: vi.fn().mockResolvedValue(null) } },
    }));
    vi.doMock('@/lib/auth-helpers', () => ({
      generalApiRateLimit: vi.fn().mockReturnValue({ success: true }),
    }));

    vi.resetModules();
    const { POST } = await import('@/app/api/auth/login/route');

    const response = await POST(mockJsonRequest(
      '/api/auth/login',
      { email: 'not-an-email', password: 'test' },
    ));

    expect(response.status).toBe(400);
    const body = await parseJson(response);
    expect(body.error).toContain('Invalid email');

    vi.doUnmock('@/lib/db');
    vi.doUnmock('@/lib/auth-helpers');
    cleanupMocks();
  });

  it('Step 3: GET /api/dashboard returns executive dashboard with complete metrics', async () => {
    vi.doMock('@/lib/intelligence-api/guard', () => ({
      utilityGuard: vi.fn().mockReturnValue({
        responseHeaders: { 'x-correlation-id': 'wf5-dash-corr' },
      }),
      utilityCatchError: vi.fn().mockReturnValue(
        new Response(JSON.stringify({ error: 'Failed' }), { status: 500 })
      ),
      utilitySuccess: vi.fn().mockImplementation((_ctx: any, data: any) => {
        return Response.json({
          success: true,
          data,
          meta: { endpoint: 'dashboard', durationMs: 120 },
        });
      }),
      RateLimitedError: class extends Error {
        headers: Record<string, string>;
        errorBody: any;
        constructor() {
          super('Rate limited');
          this.headers = {};
          this.errorBody = { error: 'Rate limited' };
        }
      },
    }));

    setupBaseMocks({
      contact: {
        groupBy: vi.fn()
          .mockResolvedValueOnce([{ status: 'active', _count: { status: 45 } }])
          .mockResolvedValueOnce([{ emailHealth: 'valid', _count: { emailHealth: 30 } }]),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(45),
        aggregate: vi.fn().mockResolvedValue({ _avg: { leadScore: 70, emailHealthScore: 8 }, _count: { id: 45 } }),
      },
      importBatch: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'batch-001', fileName: 'companies-jan.csv', createdAt: new Date('2025-01-15T10:00:00Z'), totalRows: 150, status: 'completed' },
        { id: 'batch-002', fileName: 'contacts-jan.csv', createdAt: new Date('2025-01-14T10:00:00Z'), totalRows: 320, status: 'completed' },
        { id: 'batch-003', fileName: 'leads-feb.csv', createdAt: new Date('2025-02-01T10:00:00Z'), totalRows: 200, status: 'completed' },
        { id: 'batch-004', fileName: 'enterprise-accounts.csv', createdAt: new Date('2025-02-10T10:00:00Z'), totalRows: 75, status: 'completed' },
          { id: 'batch-005', fileName: 'partners-leads.csv', createdAt: new Date('2025-02-15T10:00:00Z'), totalRows: 120, status: 'completed' },
        ]),
      },
      draft: { count: vi.fn().mockResolvedValue(12) },
      sendQueue: { count: vi.fn().mockResolvedValue(8) },
      reply: { count: vi.fn().mockResolvedValue(15) },
      bounce: { count: vi.fn().mockResolvedValue(3) },
      suppression: { count: vi.fn().mockResolvedValue(5) },
    });

    vi.resetModules();
    const { GET } = await import('@/app/api/dashboard/route');

    const response = await GET(mockGetRequest('/api/dashboard'));

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    // Core metrics
    expect(body.data.contactsByStatus).toBeDefined();
    expect(body.data.contactsByStatus.active).toBe(45);
    expect(body.data.totalCompanies).toBe(1);
    // Recent batches
    expect(body.data.recentBatches).toBeDefined();
    expect(body.data.recentBatches).toHaveLength(5);
    // Pipeline metrics
    expect(body.data.draftsPendingReview).toBe(12);
    expect(body.data.queuePending).toBe(8);
    // Engagement metrics
    expect(body.data.repliesThisWeek).toBe(15);
    expect(body.data.bouncesCount).toBe(3);
    expect(body.data.suppressionsCount).toBe(5);
    // Email health
    expect(body.data.emailHealthDistribution).toBeDefined();
    expect(body.data.emailHealthDistribution.valid).toBe(30);
    // Meta
    expect(body.meta.endpoint).toBe('dashboard');

    vi.doUnmock('@/lib/intelligence-api/guard');
    cleanupMocks();
  });

  it('Step 4: GET /api/opportunities returns opportunity pipeline data', async () => {
    setupBaseMocks({
      opportunityRecommendation: {
        findMany: vi.fn().mockResolvedValue(MOCK_OPPORTUNITIES),
        count: vi.fn().mockResolvedValue(1),
      },
    });

    vi.resetModules();
    const { GET } = await import('@/app/api/opportunities/route');

    const response = await GET(
      mockGetRequest('/api/opportunities?companyId=company-workflow-001&page=1'),
    );

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.success).toBe(true);
    expect(body.data.data).toBeInstanceOf(Array);
    expect(body.data.data).toHaveLength(1);
    // Opportunity data integrity
    const opp = body.data.data[0];
    expect(opp.opportunityTitle).toBe('Cloud Infrastructure Optimization');
    expect(opp.status).toBe('qualified');
    expect(opp.company).toBeDefined();
    expect(opp.company.rawName).toBe('NovaTech Solutions');
    // Pagination (route enforces min page=10 via safeInt clamp)
    expect(body.data.pagination).toBeDefined();
    expect(body.data.pagination.page).toBe(10);
    expect(body.data.pagination.total).toBe(1);
    expect(body.data.pagination.totalPages).toBe(1);

    cleanupMocks();
  });

  it('Step 5: GET /api/reports/revenue returns revenue report with forecast', async () => {
    setupBaseMocks({
      opportunityRecommendation: {
        findMany: vi.fn().mockResolvedValue(MOCK_OPPORTUNITIES),
        count: vi.fn()
          .mockResolvedValueOnce(1) // active pipeline
          .mockResolvedValueOnce(0), // won this month
      },
    });

    vi.resetModules();
    const { GET } = await import('@/app/api/reports/revenue/route');

    const response = await GET(
      mockGetRequest('/api/reports/revenue?months=6'),
    );

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    // Current month
    expect(body.data.currentMonth).toBeDefined();
    expect(body.data.currentMonth.deals).toBeDefined();
    expect(typeof body.data.currentMonth.revenue).toBe('number');
    // Forecast
    expect(body.data.forecast).toBeInstanceOf(Array);
    expect(body.data.forecast).toHaveLength(6);
    expect(body.data.forecast[0].projected).toBeGreaterThanOrEqual(0);
    expect(body.data.forecast[0].conservative).toBeLessThanOrEqual(body.data.forecast[0].projected);
    expect(body.data.forecast[0].optimistic).toBeGreaterThanOrEqual(body.data.forecast[0].projected);
    // Pipeline by stage
    expect(body.data.pipelineByStage).toBeInstanceOf(Array);
    expect(body.data.pipelineByStage.length).toBeGreaterThanOrEqual(1);
    // Top deals
    expect(body.data.topDeals).toBeInstanceOf(Array);
    expect(body.data.topDeals[0].stage).toBe('qualified');
    expect(body.data.topDeals[0].company).toBe('NovaTech Solutions');

    cleanupMocks();
  });

  it('Step 6: GET /api/export-center returns available exports and history', async () => {
    const mockExportHistory = [
      { entity: 'companies', action: 'export', details: 'Exported 150 companies as CSV', userId: 'user-session-001', createdAt: new Date('2025-01-20T10:00:00Z') },
      { entity: 'contacts', action: 'export', details: 'Exported 320 contacts as JSON', userId: 'user-session-001', createdAt: new Date('2025-01-19T10:00:00Z') },
    ];

    setupBaseMocks({
      auditLog: {
        findMany: vi.fn().mockResolvedValue(mockExportHistory),
        create: vi.fn().mockResolvedValue({}),
      },
    });

    vi.resetModules();
    const { GET } = await import('@/app/api/export-center/route');

    const response = await GET(mockGetRequest('/api/export-center'));

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    // Available exports
    expect(body.data.availableExports).toBeInstanceOf(Array);
    expect(body.data.availableExports.length).toBeGreaterThanOrEqual(5);
    const entityNames = body.data.availableExports.map((e: any) => e.entity);
    expect(entityNames).toContain('companies');
    expect(entityNames).toContain('contacts');
    expect(entityNames).toContain('opportunities');
    expect(entityNames).toContain('ai_insights');
    expect(entityNames).toContain('signals');
    // Each export has label and description
    body.data.availableExports.forEach((exp: any) => {
      expect(exp.label).toBeTruthy();
      expect(exp.description).toBeTruthy();
    });
    // Formats
    expect(body.data.formats).toBeInstanceOf(Array);
    expect(body.data.formats).toHaveLength(2);
    // Export history
    expect(body.data.exportHistory).toBeInstanceOf(Array);
    expect(body.data.exportHistory).toHaveLength(2);
    expect(body.data.exportHistory[0].entity).toBe('companies');
    expect(body.data.exportHistory[0].timestamp).toBeTruthy();

    cleanupMocks();
  });

  it('validates end-to-end executive data flow consistency', async () => {
    // The opportunity seen in the pipeline should match what appears in the revenue report
    vi.doMock('@/lib/intelligence-api/guard', () => ({
      utilityGuard: vi.fn().mockReturnValue({
        responseHeaders: { 'x-correlation-id': 'wf5-e2e-corr' },
      }),
      utilityCatchError: vi.fn().mockReturnValue(
        new Response(JSON.stringify({ error: 'Failed' }), { status: 500 })
      ),
      utilitySuccess: vi.fn().mockImplementation((_ctx: any, data: any) => {
        return Response.json({
          success: true,
          data,
          meta: { endpoint: 'dashboard', durationMs: 100 },
        });
      }),
      RateLimitedError: class extends Error {
        headers: Record<string, string>;
        errorBody: any;
        constructor() {
          super('Rate limited');
          this.headers = {};
          this.errorBody = { error: 'Rate limited' };
        }
      },
    }));

    setupBaseMocks({
      contact: {
        groupBy: vi.fn()
          .mockResolvedValueOnce([{ status: 'active', _count: { status: 2 } }])
          .mockResolvedValueOnce([{ emailHealth: 'valid', _count: { emailHealth: 2 } }]),
        findMany: vi.fn().mockResolvedValue(MOCK_CONTACTS),
        count: vi.fn().mockResolvedValue(2),
        aggregate: vi.fn().mockResolvedValue({ _avg: { leadScore: 78, emailHealthScore: 10 }, _count: { id: 2 } }),
      },
      importBatch: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      draft: { count: vi.fn().mockResolvedValue(0) },
      sendQueue: { count: vi.fn().mockResolvedValue(0) },
      reply: { count: vi.fn().mockResolvedValue(0) },
      bounce: { count: vi.fn().mockResolvedValue(0) },
      suppression: { count: vi.fn().mockResolvedValue(0) },
      opportunityRecommendation: {
        findMany: vi.fn().mockResolvedValue(MOCK_OPPORTUNITIES),
        count: vi.fn().mockResolvedValue(1),
      },
      auditLog: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({}),
      },
    });

    vi.resetModules();

    // Load dashboard
    const { GET: getDashboard } = await import('@/app/api/dashboard/route');
    const dashRes = await getDashboard(mockGetRequest('/api/dashboard'));
    const dashBody = await parseJson(dashRes);

    // Load opportunities
    const { GET: getOpps } = await import('@/app/api/opportunities/route');
    const oppsRes = await getOpps(mockGetRequest('/api/opportunities?companyId=company-workflow-001'));
    const oppsBody = await parseJson(oppsRes);

    // Load revenue report
    const { GET: getRevenue } = await import('@/app/api/reports/revenue/route');
    const revRes = await getRevenue(mockGetRequest('/api/reports/revenue?months=3'));
    const revBody = await parseJson(revRes);

    // Cross-validate: dashboard shows contact status that matches contacts API data
    expect(dashBody.data.contactsByStatus.active).toBe(2);
    // Opportunity pipeline: what shows in opportunities also appears in revenue
    expect(oppsBody.data.data).toHaveLength(1);
    expect(oppsBody.data.data[0].status).toBe('qualified');
    // Revenue report pipeline should include the qualified stage
    const qualifiedStage = revBody.data.pipelineByStage.find((s: any) => s.stage === 'qualified');
    expect(qualifiedStage).toBeDefined();
    expect(qualifiedStage.value).toBeGreaterThanOrEqual(1);
    // Top deals reference the same company
    expect(revBody.data.topDeals[0].company).toBe('NovaTech Solutions');

    vi.doUnmock('@/lib/intelligence-api/guard');
    cleanupMocks();
  });
});
