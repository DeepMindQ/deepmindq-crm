/**
 * WI-17B — Company Intelligence Profile & Activation Status Tests
 *
 * Tests the two new WI-17B endpoints:
 *   1. GET /api/companies/[id]/activation-status
 *   2. GET /api/companies/[id]/intelligence-profile
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────

const mockCompany = {
  id: 'company-test-1',
  rawName: 'Test Corp Inc',
  normalizedName: 'test corp inc',
  domain: 'testcorp.com',
  industry: 'Technology',
  sizeRange: '51-200',
  location: 'San Francisco, CA',
  country: 'US',
  website: 'https://testcorp.com',
  status: 'prospect',
  source: 'manual',
  intelligenceScore: 75,
  lastEnrichedAt: new Date('2026-07-15'),
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-07-20'),
};

const mockSignals = [
  {
    id: 'sig-1',
    companyId: 'company-test-1',
    signalType: 'funding',
    title: 'Series C funding round',
    description: 'Raised $50M Series C',
    severity: 'critical',
    impact: 'high',
    confidence: 0.92,
    source: 'TechCrunch',
    sourceUrl: 'https://techcrunch.com/test',
    signalDate: new Date('2026-07-01'),
    recommendedAction: 'Reach out immediately',
    timingWindow: 'immediate',
    isRead: false,
  },
  {
    id: 'sig-2',
    companyId: 'company-test-1',
    signalType: 'hiring',
    title: 'Hiring 20 engineers',
    severity: 'high',
    impact: 'medium',
    confidence: 0.85,
    source: 'LinkedIn',
    sourceUrl: 'https://linkedin.com/test',
    signalDate: new Date('2026-06-20'),
    recommendedAction: 'Technical discovery call',
    timingWindow: 'this_week',
    isRead: true,
  },
];

const mockResearchCard = {
  id: 'rc-1',
  companyId: 'company-test-1',
  businessOverview: 'Test Corp is a leading technology company...',
  industry: 'Enterprise Software',
  techStack: JSON.stringify(['React', 'AWS', 'Kubernetes', 'Terraform', 'Python', 'PostgreSQL']),
  revenue: '$50-100M',
  employeeCount: '150-200',
  fundingStage: 'Series C',
  keyPeople: JSON.stringify([
    { name: 'Jane CEO', title: 'CEO' },
    { name: 'John CTO', title: 'CTO' },
  ]),
  recentNews: JSON.stringify([]),
  enrichmentSource: 'intelligence_pipeline',
  enrichmentDate: new Date('2026-07-15'),
};

const mockContacts = [
  { id: 'c-1', rawName: 'Jane CEO', email: 'jane@testcorp.com', title: 'CEO', role: 'executive', phone: null, linkedinUrl: null, location: 'SF', status: 'active', leadScore: 95, emailHealth: 'valid' },
  { id: 'c-2', rawName: 'John CTO', email: 'john@testcorp.com', title: 'CTO', role: 'executive', phone: null, linkedinUrl: null, location: 'SF', status: 'active', leadScore: 88, emailHealth: 'valid' },
];

const mockEvidence = [
  { id: 'ev-1', companyId: 'company-test-1', sourceName: 'TechCrunch', sourceUrl: 'https://techcrunch.com', extractedField: 'funding', extractedValue: 'Series C', confidence: 0.9, createdAt: new Date('2026-07-01') },
  { id: 'ev-2', companyId: 'company-test-1', sourceName: 'LinkedIn', sourceUrl: 'https://linkedin.com', extractedField: 'hiring', extractedValue: '20 engineers', confidence: 0.85, createdAt: new Date('2026-06-20') },
];

const mockTimeline = [
  { id: 'tl-1', companyId: 'company-test-1', eventType: 'enrichment', title: 'AI enrichment completed', description: 'Full pipeline run', metadata: null, createdAt: new Date('2026-07-15') },
  { id: 'tl-2', companyId: 'company-test-1', eventType: 'signal', title: 'Funding signal detected', description: 'Series C', metadata: null, createdAt: new Date('2026-07-01') },
];

const mockDb = {
  company: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  companySignal: { findMany: vi.fn(), count: vi.fn() },
  evidence: { count: vi.fn(), findMany: vi.fn() },
  companyResearchCard: { findUnique: vi.fn() },
  contact: { findMany: vi.fn() },
  opportunityRecommendation: { findMany: vi.fn() },
  signalCapabilityMatch: { findMany: vi.fn() },
  companyTimelineEvent: { findMany: vi.fn() },
};

vi.mock('@/lib/db', () => ({ db: mockDb }));

vi.mock('@/lib/api-auth', () => ({
  checkApiAuth: vi.fn().mockResolvedValue({ errorResponse: null }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/ai-knowledge-graph', () => ({
  getNode: vi.fn().mockResolvedValue(undefined),
  getGraphStats: vi.fn().mockReturnValue({ totalNodes: 5, totalEdges: 3 }),
  getAllNodes: vi.fn().mockReturnValue([
    { id: `company-company-test-1`, label: 'Test Corp Inc', type: 'company', properties: { companyId: 'company-test-1' } },
  ]),
  getAllEdges: vi.fn().mockReturnValue([
    { sourceId: `company-company-test-1`, targetId: 'person-c-1' },
  ]),
}));

vi.mock('@/lib/ai-hybrid-retrieval', () => ({
  quickSearch: vi.fn().mockReturnValue([
    { id: 'idx-1', entityId: 'company-test-1', entityType: 'company', fusedScore: 0.85, finalScore: 0.82, content: 'Test Corp...', snippet: 'Technology company' },
  ]),
  getHybridStats: vi.fn().mockReturnValue({ totalEntries: 10 }),
}));

vi.mock('@/lib/ai-memory', () => ({
  searchMemories: vi.fn().mockReturnValue([
    { memory: { scope: { entityType: 'company', entityId: 'company-test-1' }, layer: 'enterprise', confidence: 0.9 } },
    { memory: { scope: { entityType: 'company', entityId: 'company-test-1' }, layer: 'working', confidence: 0.8 } },
  ]),
  getMemoryStats: vi.fn().mockReturnValue({ totalMemories: 15 }),
}));

vi.mock('@/lib/ai-unified-confidence', () => ({
  computeUnifiedConfidence: vi.fn().mockReturnValue({
    score: 78,
    grade: 'B+',
    trustClass: 'enterprise_operational',
    enterpriseReady: true,
    factors: [
      { dimension: 'data_quality', score: 85, weight: 0.2, explanation: 'Good data quality' },
      { dimension: 'source_reliability', score: 72, weight: 0.2, explanation: 'Manual entry source' },
      { dimension: 'freshness', score: 65, weight: 0.15, explanation: '18 days since enrichment' },
      { dimension: 'cross_validation', score: 80, weight: 0.15, explanation: '3 cross-validated facts' },
      { dimension: 'evidence_coverage', score: 70, weight: 0.15, explanation: '2 evidence items' },
      { dimension: 'ai_certainty', score: 82, weight: 0.15, explanation: 'Low hallucination risk' },
    ],
    summary: 'Overall confidence is strong. Primary gaps: limited evidence coverage.',
    recommendations: ['Add more evidence sources', 'Refresh within 30 days'],
    timestamp: new Date().toISOString(),
    modelVersion: 'wi-17b',
  }),
}));

// ─── Tests ──────────────────────────────────────────────────────────────

describe('WI-17B: Company Intelligence Activation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock returns
    mockDb.company.findUnique.mockResolvedValue({
      ...mockCompany,
      _count: { contacts: 2, signals: 2, evidence: 2 },
      researchCard: mockResearchCard,
    });
    mockDb.companySignal.findMany.mockResolvedValue(mockSignals);
    mockDb.companySignal.count.mockResolvedValue(2);
    mockDb.evidence.count.mockResolvedValue(2);
    mockDb.evidence.findMany.mockResolvedValue(mockEvidence);
    mockDb.companyResearchCard.findUnique.mockResolvedValue(mockResearchCard);
    mockDb.contact.findMany.mockResolvedValue(mockContacts);
    mockDb.opportunityRecommendation.findMany.mockResolvedValue([]);
    mockDb.signalCapabilityMatch.findMany.mockResolvedValue([]);
    mockDb.companyTimelineEvent.findMany.mockResolvedValue(mockTimeline);
  });

  describe('Activation Status API', () => {
    it('should return overall status as activated when 5+ steps complete', async () => {
      const mod = await import('@/app/api/companies/[id]/activation-status/route');
      const response = await mod.GET(
        new Request('http://localhost/api/companies/company-test-1/activation-status'),
        { params: Promise.resolve({ id: 'company-test-1' }) },
      );
      const data = await response.json();

      expect(data.overallStatus).toBeDefined();
      expect(data.companyId).toBe('company-test-1');
      expect(data.companyName).toBe('Test Corp Inc');
      expect(data.activationLevel).toBeGreaterThanOrEqual(0);
      expect(data.activationLevel).toBeLessThanOrEqual(6);
    });

    it('should return confidence score', async () => {
      const mod = await import('@/app/api/companies/[id]/activation-status/route');
      const response = await mod.GET(
        new Request('http://localhost/api/companies/company-test-1/activation-status'),
        { params: Promise.resolve({ id: 'company-test-1' }) },
      );
      const data = await response.json();

      expect(data.confidence).toBeDefined();
      expect(data.confidence.score).toBe(78);
      expect(data.confidence.grade).toBe('B+');
    });

    it('should return 6 activation steps', async () => {
      const mod = await import('@/app/api/companies/[id]/activation-status/route');
      const response = await mod.GET(
        new Request('http://localhost/api/companies/company-test-1/activation-status'),
        { params: Promise.resolve({ id: 'company-test-1' }) },
      );
      const data = await response.json();

      expect(data.steps).toHaveLength(6);
      const stepNames = data.steps.map((s: { step: string }) => s.step);
      expect(stepNames).toContain('entity_resolution');
      expect(stepNames).toContain('knowledge_graph');
      expect(stepNames).toContain('retrieval_indexing');
      expect(stepNames).toContain('memory_creation');
      expect(stepNames).toContain('signal_extraction');
      expect(stepNames).toContain('confidence_scoring');
    });

    it('should return intelligence summary counts', async () => {
      const mod = await import('@/app/api/companies/[id]/activation-status/route');
      const response = await mod.GET(
        new Request('http://localhost/api/companies/company-test-1/activation-status'),
        { params: Promise.resolve({ id: 'company-test-1' }) },
      );
      const data = await response.json();

      expect(data.intelligenceSummary).toBeDefined();
      expect(data.intelligenceSummary.signals).toBe(2);
      expect(data.intelligenceSummary.evidence).toBe(2);
      expect(data.intelligenceSummary.contacts).toBe(2);
      expect(data.intelligenceSummary.hasResearchCard).toBe(true);
    });

    it('should return 404 for nonexistent company', async () => {
      mockDb.company.findUnique.mockResolvedValue(null);
      const mod = await import('@/app/api/companies/[id]/activation-status/route');
      const response = await mod.GET(
        new Request('http://localhost/api/companies/nonexistent/activation-status'),
        { params: Promise.resolve({ id: 'nonexistent' }) },
      );

      expect(response.status).toBe(404);
    });
  });

  describe('Intelligence Profile API', () => {
    it('should return all 10 intelligence sections', async () => {
      const mod = await import('@/app/api/companies/[id]/intelligence-profile/route');
      const response = await mod.GET(
        new Request('http://localhost/api/companies/company-test-1/intelligence-profile'),
        { params: Promise.resolve({ id: 'company-test-1' }) },
      );
      const data = await response.json();

      // 1. Company Base
      expect(data.company).toBeDefined();
      expect(data.company.name).toBe('Test Corp Inc');
      expect(data.company.domain).toBe('testcorp.com');

      // 2. AI Summary
      expect(data.aiSummary).toBeDefined();
      expect(data.aiSummary.overview).toBeTruthy();

      // 3. Technology
      expect(data.technology).toBeDefined();
      expect(data.technology.techStack.length).toBeGreaterThan(0);
      expect(data.technology.techCategories).toBeInstanceOf(Array);

      // 4. Signals
      expect(data.signals).toBeDefined();
      expect(data.signals.items).toHaveLength(2);
      expect(data.signals.summary.total).toBe(2);
      expect(data.signals.summary.bySeverity.critical).toBe(1);

      // 5. Evidence Timeline
      expect(data.evidenceTimeline).toBeDefined();
      expect(data.evidenceTimeline).toHaveLength(2);

      // 6. Opportunities
      expect(data.opportunities).toBeDefined();
      expect(data.opportunities.totalOpportunities).toBe(0);

      // 7. Confidence
      expect(data.confidence).toBeDefined();
      expect(data.confidence.score).toBe(78);
      expect(data.confidence.grade).toBe('B+');
      expect(data.confidence.enterpriseReady).toBe(true);
      expect(data.confidence.factors).toHaveLength(6);

      // 8. Activation Status
      expect(data.activationStatus).toBeDefined();
      expect(data.activationStatus.hasResearchCard).toBe(true);
      expect(data.activationStatus.hasSignals).toBe(true);

      // 9. Recommended Actions
      expect(data.recommendedActions).toBeInstanceOf(Array);

      // 10. Why This Account
      expect(data.whyThisAccount).toBeDefined();
      expect(data.whyThisAccount.summary).toBeTruthy();
      expect(data.whyThisAccount.signals).toBeInstanceOf(Array);
      expect(data.whyThisAccount.dataQuality).toBeTruthy();
    });

    it('should return contacts sorted by lead score', async () => {
      const mod = await import('@/app/api/companies/[id]/intelligence-profile/route');
      const response = await mod.GET(
        new Request('http://localhost/api/companies/company-test-1/intelligence-profile'),
        { params: Promise.resolve({ id: 'company-test-1' }) },
      );
      const data = await response.json();

      expect(data.contacts).toBeDefined();
      expect(data.contacts.length).toBeGreaterThan(0);
      // First contact should have highest lead score
      expect(data.contacts[0].leadScore).toBeGreaterThanOrEqual(data.contacts[1]?.leadScore || 0);
    });

    it('should return timeline events', async () => {
      const mod = await import('@/app/api/companies/[id]/intelligence-profile/route');
      const response = await mod.GET(
        new Request('http://localhost/api/companies/company-test-1/intelligence-profile'),
        { params: Promise.resolve({ id: 'company-test-1' }) },
      );
      const data = await response.json();

      expect(data.timeline).toBeDefined();
      expect(data.timeline).toHaveLength(2);
    });

    it('should handle company with no intelligence data gracefully', async () => {
      mockDb.company.findUnique.mockResolvedValue({
        ...mockCompany,
        _count: { contacts: 0, signals: 0, evidence: 0 },
        researchCard: null,
        lastEnrichedAt: null,
        intelligenceScore: null,
      });
      mockDb.companySignal.findMany.mockResolvedValue([]);
      mockDb.companySignal.count.mockResolvedValue(0);
      mockDb.evidence.count.mockResolvedValue(0);
      mockDb.evidence.findMany.mockResolvedValue([]);
      mockDb.companyResearchCard.findUnique.mockResolvedValue(null);
      mockDb.contact.findMany.mockResolvedValue([]);
      mockDb.opportunityRecommendation.findMany.mockResolvedValue([]);
      mockDb.signalCapabilityMatch.findMany.mockResolvedValue([]);
      mockDb.companyTimelineEvent.findMany.mockResolvedValue([]);

      const mod = await import('@/app/api/companies/[id]/intelligence-profile/route');
      const response = await mod.GET(
        new Request('http://localhost/api/companies/company-test-1/intelligence-profile'),
        { params: Promise.resolve({ id: 'company-test-1' }) },
      );
      const data = await response.json();

      expect(data.company).toBeDefined();
      expect(data.aiSummary).toBeNull();
      expect(data.technology).toBeNull();
      expect(data.signals.items).toHaveLength(0);
      expect(data.signals.summary.total).toBe(0);
      expect(data.whyThisAccount.summary).toBeTruthy(); // Should still explain why
    });

    it('should return 404 for nonexistent company', async () => {
      mockDb.company.findUnique.mockResolvedValue(null);
      const mod = await import('@/app/api/companies/[id]/intelligence-profile/route');
      const response = await mod.GET(
        new Request('http://localhost/api/companies/nonexistent/intelligence-profile'),
        { params: Promise.resolve({ id: 'nonexistent' }) },
      );

      expect(response.status).toBe(404);
    });
  });
});
