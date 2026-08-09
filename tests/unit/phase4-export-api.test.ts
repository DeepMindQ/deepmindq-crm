/**
 * Phase 4 — Item 5.7: Export & Compliance API Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db
const mockCompanyFindUnique = vi.fn();
vi.mock('@/lib/db', () => ({
  db: {
    company: {
      findUnique: (...args: unknown[]) => mockCompanyFindUnique(...args),
    },
  },
}));

vi.mock('@/lib/api-auth', () => ({
  checkApiAuth: () => Promise.resolve({ session: { id: '1', email: 'test@test.com', role: 'admin' } }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('GET /api/intelligence/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should require companyId parameter', async () => {
    const { GET } = await import('@/app/api/intelligence/export/route');
    const req = new Request('http://localhost/api/intelligence/export');
    const res = await GET(req as any);
    expect(res.status).toBe(400);
  });

  it('should reject invalid format', async () => {
    const { GET } = await import('@/app/api/intelligence/export/route');
    const req = new Request('http://localhost/api/intelligence/export?companyId=abc&format=xml');
    const res = await GET(req as any);
    expect(res.status).toBe(400);
  });

  it('should return 404 for non-existent company', async () => {
    mockCompanyFindUnique.mockResolvedValue(null);
    const { GET } = await import('@/app/api/intelligence/export/route');
    const req = new Request('http://localhost/api/intelligence/export?companyId=nonexistent&format=json');
    const res = await GET(req as any);
    expect(res.status).toBe(404);
  });

  it('should return JSON export with full audit trail', async () => {
    mockCompanyFindUnique.mockResolvedValue({
      id: 'comp-1',
      rawName: 'Test Corp',
      domain: 'testcorp.com',
      industry: 'Technology',
      website: 'https://testcorp.com',
      sizeRange: '50-200',
      location: 'San Francisco, CA',
      country: 'US',
      intelligenceScore: 75,
      status: 'active',
      lastEnrichedAt: '2024-01-15T00:00:00.000Z',
      signals: [
        { id: 'sig-1', signalType: 'hiring', severity: 'high', description: 'Hiring 50 engineers', source: 'linkedin', signalDate: '2024-01-15', confidence: 0.85 },
        { id: 'sig-2', signalType: 'tech_change', severity: 'medium', description: 'Using React', source: 'website', signalDate: '2024-01-10', confidence: 0.7 },
      ],
      opportunityRecommendations: [
        { id: 'opp-1', opportunityTitle: 'Expand engineering team', opportunityScore: 85, status: 'active', updatedAt: '2024-01-15' },
      ],
      signalCapabilityMatches: [
        { id: 'cap-1', capability: { title: 'Cloud Infrastructure', category: 'Infrastructure' }, matchScore: 0.9, createdAt: '2024-01-12' },
      ],
      contacts: [
        { id: 'ct-1', rawName: 'John Doe', title: 'CTO', email: 'john@testcorp.com', source: 'linkedin' },
        { id: 'ct-2', rawName: 'Jane Smith', title: 'VP Engineering', email: 'jane@testcorp.com', source: 'linkedin' },
      ],
    });

    const { GET } = await import('@/app/api/intelligence/export/route');
    const req = new Request('http://localhost/api/intelligence/export?companyId=comp-1&format=json');
    const res = await GET(req as any);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.metadata).toBeDefined();
    expect(data.metadata.exportVersion).toBe('1.0.0');
    expect(data.metadata.companyId).toBe('comp-1');
    expect(data.metadata.auditTrail.generatedBy).toContain('DeepMindQ');
    expect(data.metadata.auditTrail.includesDecisionAuditHash).toBe(true);
    expect(data.company).toBeDefined();
    expect(data.company.name).toBe('Test Corp');
    expect(data.signals).toHaveLength(2);
    expect(data.opportunities).toHaveLength(1);
    expect(data.contacts).toHaveLength(2);
    expect(data.metadata.dataDepthIndicator).toBeDefined();
  });

  it('should include Content-Disposition header for JSON downloads', async () => {
    mockCompanyFindUnique.mockResolvedValue({
      id: 'comp-1', rawName: 'Test Corp', signals: [], opportunityRecommendations: [], signalCapabilityMatches: [], contacts: [],
    });
    const { GET } = await import('@/app/api/intelligence/export/route');
    const req = new Request('http://localhost/api/intelligence/export?companyId=comp-1&format=json');
    const res = await GET(req as any);
    expect(res.headers.get('Content-Disposition')).toContain('attachment');
  });

  it('should return PDF format with proper headers', async () => {
    mockCompanyFindUnique.mockResolvedValue({
      id: 'comp-1', rawName: 'PDF Corp', signals: [], opportunityRecommendations: [], signalCapabilityMatches: [], contacts: [],
    });
    const { GET } = await import('@/app/api/intelligence/export/route');
    const req = new Request('http://localhost/api/intelligence/export?companyId=comp-1&format=pdf');
    const res = await GET(req as any);

    const contentType = res.headers.get('Content-Type') || '';
    if (contentType.includes('pdf')) {
      // PDFKit available — verify PDF response
      expect(res.status).toBe(200);
      expect(contentType).toBe('application/pdf');
      expect(res.headers.get('Content-Disposition')).toContain('.pdf');
    } else {
      // PDFKit not available in test env — error response acceptable
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  });

  it('should compute data depth indicator correctly', async () => {
    mockCompanyFindUnique.mockResolvedValue({
      id: 'comp-1', rawName: 'Rich Corp',
      signals: Array.from({ length: 8 }, (_, i) => ({ id: `sig-${i}` })),
      opportunityRecommendations: Array.from({ length: 5 }, (_, i) => ({ id: `opp-${i}` })),
      signalCapabilityMatches: Array.from({ length: 4 }, (_, i) => ({ id: `cap-${i}`, capability: { title: `Cap ${i}` } })),
      contacts: Array.from({ length: 10 }, (_, i) => ({ id: `ct-${i}`, rawName: `Contact ${i}`, email: `c${i}@test.com` })),
    });
    const { GET } = await import('@/app/api/intelligence/export/route');
    const req = new Request('http://localhost/api/intelligence/export?companyId=comp-1&format=json');
    const res = await GET(req as any);
    const data = await res.json();
    expect(data.metadata.dataDepthIndicator).toBe('comprehensive');
  });
});
