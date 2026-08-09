/**
 * Activation Persistence — Phase 2 Tests
 *
 * Tests the persistence of IntelligenceActivationEvent records to PostgreSQL,
 * feature flag gating, hydration from PG, and the non-blocking fire-and-forget
 * contract (failures never affect activation flow).
 */

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock db
const mockActivationEventCreate = jest.fn().mockResolvedValue({});
const mockActivationEventFindMany = jest.fn();
const mockCompanyFindMany = jest.fn();
const mockContactFindMany = jest.fn();
const mockCompanySignalFindMany = jest.fn();
const mockCompanyUpdate = jest.fn();
const mockEvidenceFindMany = jest.fn();
const mockAiInsightFindMany = jest.fn();
const mockCompanyFindUnique = jest.fn();

jest.mock('@/lib/db', () => ({
  db: {
    intelligenceActivationEvent: {
      create: (...args: unknown[]) => mockActivationEventCreate(...args),
      findMany: (...args: unknown[]) => mockActivationEventFindMany(...args),
    },
    company: {
      findMany: (...args: unknown[]) => mockCompanyFindMany(...args),
      findUnique: (...args: unknown[]) => mockCompanyFindUnique(...args),
      update: (...args: unknown[]) => mockCompanyUpdate(...args),
      count: jest.fn().mockResolvedValue(0),
    },
    contact: {
      findMany: (...args: unknown[]) => mockContactFindMany(...args),
    },
    companySignal: {
      findMany: (...args: unknown[]) => mockCompanySignalFindMany(...args),
    },
    evidence: {
      findMany: (...args: unknown[]) => mockEvidenceFindMany(...args),
    },
    aiInsight: {
      findMany: (...args: unknown[]) => mockAiInsightFindMany(...args),
    },
  },
}));

// Mock other dependencies
jest.mock('@/lib/engines/grounding-engine', () => ({
  GroundingEngine: { collect: jest.fn().mockResolvedValue({ evidences: [], gaps: [], aggregateConfidence: 0, coverage: 0, freshnessScore: 0, builtAt: new Date().toISOString(), context: {} }) },
}));
jest.mock('@/lib/ai-unified-confidence', () => ({
  computeUnifiedConfidence: jest.fn().mockReturnValue({ score: 50, grade: 'C', trustClass: 'speculative', enterpriseReady: false, factors: [], summary: '', recommendations: [], timestamp: new Date().toISOString(), modelVersion: '2.0' }),
}));
jest.mock('@/lib/engines/retrieval-engine', () => ({
  RetrievalEngine: { retrieve: jest.fn().mockResolvedValue([]) },
}));
jest.mock('@/lib/knowledge-ingestion-pipeline', () => ({
  ingestKnowledge: jest.fn().mockResolvedValue([]),
}));
jest.mock('@/lib/ai-knowledge-graph', () => ({
  KnowledgeGraph: { extractAndLink: jest.fn().mockResolvedValue([]) },
}));
jest.mock('@/lib/embeddings', () => ({
  generateEmbedding: jest.fn().mockResolvedValue(new Float64Array(384)),
}));

describe('Activation Persistence', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    mockActivationEventCreate.mockReset().mockResolvedValue({});
    mockActivationEventFindMany.mockReset();
    mockCompanyFindUnique.mockReset().mockResolvedValue({
      id: 'c1',
      rawName: 'Test Corp',
      normalizedName: 'test corp',
      domain: 'test.com',
      industry: null,
      sizeRange: null,
      location: null,
      country: null,
      website: null,
      status: 'active',
      source: null,
      intelligenceScore: 75,
      lastEnrichedAt: new Date('2024-01-01'),
      createdAt: new Date(),
      contacts: [],
    });
    mockCompanyFindMany.mockReset();
    mockCompanySignalFindMany.mockReset().mockResolvedValue([]);
    mockContactFindMany.mockReset().mockResolvedValue([]);
    mockEvidenceFindMany.mockReset().mockResolvedValue([]);
    mockAiInsightFindMany.mockReset().mockResolvedValue([]);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ════════════════════════════════════════════════════════════
  // Feature Flag OFF → no DB writes
  // ════════════════════════════════════════════════════════════

  describe('feature flag OFF', () => {
    it('should not write IntelligenceActivationEvent when flag is off', async () => {
      process.env.ENABLE_ACTIVATION_PERSISTENCE = 'false';

      const mod = await import('@/lib/intelligence-activation');
      await mod.activateIntelligence({ companyId: 'c1', trigger: 'manual' });

      expect(mockActivationEventCreate).not.toHaveBeenCalled();
    });

    it('should not attempt hydration when flag is off', async () => {
      process.env.ENABLE_ACTIVATION_PERSISTENCE = '';

      const mod = await import('@/lib/intelligence-activation');
      await mod.hydrateActivationHistory();

      expect(mockActivationEventFindMany).not.toHaveBeenCalled();
    });
  });

  // ════════════════════════════════════════════════════════════
  // Feature Flag ON → writes IntelligenceActivationEvent
  // ════════════════════════════════════════════════════════════

  describe('feature flag ON', () => {
    it('should write IntelligenceActivationEvent records when flag is on', async () => {
      process.env.ENABLE_ACTIVATION_PERSISTENCE = 'true';

      const mod = await import('@/lib/intelligence-activation');
      await mod.activateIntelligence({ companyId: 'c1', trigger: 'manual' });

      expect(mockActivationEventCreate).toHaveBeenCalled();
    });

    it('should persist all 6 activation steps', async () => {
      process.env.ENABLE_ACTIVATION_PERSISTENCE = 'true';

      const mod = await import('@/lib/intelligence-activation');
      await mod.activateIntelligence({ companyId: 'c1', trigger: 'manual' });

      const steps = mockActivationEventCreate.mock.calls.map(
        (call: unknown[]) => (call[0] as Record<string, Record<string, unknown>>).data?.step,
      );

      const expectedSteps = [
        'entity_resolution',
        'knowledge_graph_update',
        'retrieval_indexing',
        'memory_creation',
        'signal_extraction',
        'confidence_scoring',
      ];

      for (const step of expectedSteps) {
        expect(steps).toContain(step);
      }
    });

    it('should include companyId and trigger in each event', async () => {
      process.env.ENABLE_ACTIVATION_PERSISTENCE = 'true';

      const mod = await import('@/lib/intelligence-activation');
      await mod.activateIntelligence({ companyId: 'c1', trigger: 'cron' });

      for (const call of mockActivationEventCreate.mock.calls) {
        const data = (call[0] as Record<string, Record<string, unknown>>).data;
        expect(data.companyId).toBe('c1');
        expect(data.trigger).toBe('cron');
      }
    });

    it('should include status (completed/failed/skipped) in each event', async () => {
      process.env.ENABLE_ACTIVATION_PERSISTENCE = 'true';

      const mod = await import('@/lib/intelligence-activation');
      await mod.activateIntelligence({ companyId: 'c1', trigger: 'manual' });

      for (const call of mockActivationEventCreate.mock.calls) {
        const data = (call[0] as Record<string, Record<string, unknown>>).data;
        expect(['completed', 'failed', 'skipped']).toContain(data.status);
      }
    });

    it('should include durationMs in each event', async () => {
      process.env.ENABLE_ACTIVATION_PERSISTENCE = 'true';

      const mod = await import('@/lib/intelligence-activation');
      await mod.activateIntelligence({ companyId: 'c1', trigger: 'manual' });

      for (const call of mockActivationEventCreate.mock.calls) {
        const data = (call[0] as Record<string, Record<string, unknown>>).data;
        expect(typeof data.durationMs).toBe('number');
        expect((data.durationMs as number)).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ════════════════════════════════════════════════════════════
  // hydrateActivationHistory
  // ════════════════════════════════════════════════════════════

  describe('hydrateActivationHistory', () => {
    it('should load events from PostgreSQL', async () => {
      process.env.ENABLE_ACTIVATION_PERSISTENCE = 'true';

      mockActivationEventFindMany.mockResolvedValue([
        { id: 'e1', companyId: 'c1', step: 'confidence_scoring', status: 'completed', durationMs: 150, createdAt: new Date() },
        { id: 'e2', companyId: 'c1', step: 'entity_resolution', status: 'completed', durationMs: 80, createdAt: new Date() },
      ]);

      const mod = await import('@/lib/intelligence-activation');
      await mod.hydrateActivationHistory();

      expect(mockActivationEventFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should handle hydration failure gracefully', async () => {
      process.env.ENABLE_ACTIVATION_PERSISTENCE = 'true';
      mockActivationEventFindMany.mockRejectedValue(new Error('PG connection failed'));

      const mod = await import('@/lib/intelligence-activation');
      await expect(mod.hydrateActivationHistory()).resolves.not.toThrow();
    });
  });

  // ════════════════════════════════════════════════════════════
  // Non-blocking: failure doesn't affect activation flow
  // ════════════════════════════════════════════════════════════

  describe('failure isolation', () => {
    it('should not affect activation when DB write fails', async () => {
      process.env.ENABLE_ACTIVATION_PERSISTENCE = 'true';
      mockActivationEventCreate.mockReset().mockRejectedValue(new Error('DB down'));

      const mod = await import('@/lib/intelligence-activation');
      const result = await mod.activateIntelligence({ companyId: 'c1', trigger: 'manual' });

      expect(result).toBeDefined();
      expect(result.companyId).toBe('c1');
    });
  });
});
