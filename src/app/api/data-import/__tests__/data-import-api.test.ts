/**
 * Ticket 11 — Data Import API Route Tests
 *
 * Tests cover all API endpoints:
 * - GET  /api/data-import          — List uploads
 * - POST /api/data-import/upload   — Upload + auto-analyze
 * - POST /api/data-import/confirm-mapping
 * - POST /api/data-import/validate
 * - POST /api/data-import/normalize
 * - POST /api/data-import/commit
 * - GET  /api/data-import/[id]     — Get upload detail
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════
// Mock the pipeline and db modules
// ═══════════════════════════════════════════════════════════════

const {
  mockCreateDataUpload,
  mockAutoMapColumns,
  mockValidateRows,
  mockNormalizeRows,
  mockCommitImport,
  mockGetUploadWithDetails,
  mockListUploads,
} = vi.hoisted(() => ({
  mockCreateDataUpload: vi.fn(),
  mockAutoMapColumns: vi.fn(),
  mockValidateRows: vi.fn(),
  mockNormalizeRows: vi.fn(),
  mockCommitImport: vi.fn(),
  mockGetUploadWithDetails: vi.fn(),
  mockListUploads: vi.fn(),
}));

vi.mock('@/lib/data-import/pipeline', () => ({
  createDataUpload: mockCreateDataUpload,
  autoMapColumns: mockAutoMapColumns,
  validateRows: mockValidateRows,
  normalizeRows: mockNormalizeRows,
  commitImport: mockCommitImport,
  getUploadWithDetails: mockGetUploadWithDetails,
  listUploads: mockListUploads,
}));

const {
  mockDbUploadRowCreateMany,
  mockDbDataUploadFindUnique,
  mockDbDataUploadUpdate,
  mockDbUploadRowFindMany,
} = vi.hoisted(() => ({
  mockDbUploadRowCreateMany: vi.fn(),
  mockDbDataUploadFindUnique: vi.fn(),
  mockDbDataUploadUpdate: vi.fn(),
  mockDbUploadRowFindMany: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    uploadRow: {
      createMany: mockDbUploadRowCreateMany,
      findMany: mockDbUploadRowFindMany,
    },
    dataUpload: {
      findUnique: mockDbDataUploadFindUnique,
      update: mockDbDataUploadUpdate,
    },
  },
}));

// ═══════════════════════════════════════════════════════════════
// GET /api/data-import — List uploads
// ═══════════════════════════════════════════════════════════════

describe('GET /api/data-import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated uploads in apiSuccess envelope', async () => {
    const { GET } = await import('../route');

    mockListUploads.mockResolvedValue({
      items: [
        { id: 'u1', fileName: 'test.csv', status: 'completed', createdAt: new Date() },
        { id: 'u2', fileName: 'leads.csv', status: 'review_ready', createdAt: new Date() },
      ],
      total: 5,
    });

    const req = new Request('http://localhost/api/data-import?page=1&limit=20');
    const res = await GET(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.items).toHaveLength(2);
    expect(json.data.pagination.total).toBe(5);
    expect(json.data.pagination.totalPages).toBe(1);
    expect(json.timestamp).toBeDefined();
  });

  it('clamps page to minimum 1', async () => {
    const { GET } = await import('../route');

    mockListUploads.mockResolvedValue({ items: [], total: 0 });

    const req = new Request('http://localhost/api/data-import?page=-3');
    await GET(req as any);

    expect(mockListUploads).toHaveBeenCalledWith(1, 20);
  });

  it('returns 500 when list fails', async () => {
    const { GET } = await import('../route');

    mockListUploads.mockRejectedValue(new Error('DB connection error'));

    const req = new Request('http://localhost/api/data-import');
    const res = await GET(req as any);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.success).toBe(false);
    expect(json.error).toContain('DB connection error');
  });
});

// ═══════════════════════════════════════════════════════════════
// POST /api/data-import/upload — Upload + auto-analyze
// ═══════════════════════════════════════════════════════════════

describe('POST /api/data-import (action: upload)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates upload and auto-maps columns', async () => {
    const { POST } = await import('../route');

    mockCreateDataUpload.mockResolvedValue({
      id: 'u1', fileName: 'leads.csv', totalRows: 10, status: 'created',
    });
    mockAutoMapColumns.mockResolvedValue({
      'First Name': 'name',
      'Email': 'email',
      'Company': 'company',
    });
    mockDbUploadRowCreateMany.mockResolvedValue({ count: 10 });

    const req = new Request('http://localhost/api/data-import', {
      method: 'POST',
      body: JSON.stringify({
        action: 'upload',
        fileName: 'leads.csv',
        totalRows: 10,
        headers: ['First Name', 'Email', 'Company'],
        rows: [
          { 'First Name': 'John', 'Email': 'j@x.com', 'Company': 'Acme' },
          { 'First Name': 'Jane', 'Email': 'j@y.com', 'Company': 'Beta' },
        ],
      }),
    });
    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.upload.id).toBe('u1');
    expect(json.data.columnMapping).toBeDefined();
    expect(json.data.rowsCreated).toBe(2);
  });

  it('returns 400 when fileName is missing', async () => {
    const { POST } = await import('../route');

    const req = new Request('http://localhost/api/data-import', {
      method: 'POST',
      body: JSON.stringify({ action: 'upload', totalRows: 10 }),
    });
    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toContain('fileName');
  });

  it('returns 400 when totalRows is invalid', async () => {
    const { POST } = await import('../route');

    const req = new Request('http://localhost/api/data-import', {
      method: 'POST',
      body: JSON.stringify({ action: 'upload', fileName: 'test.csv', totalRows: -5 }),
    });
    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(400);
  });

  it('returns 400 for unknown action', async () => {
    const { POST } = await import('../route');

    const req = new Request('http://localhost/api/data-import', {
      method: 'POST',
      body: JSON.stringify({ action: 'destroy' }),
    });
    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain('Unknown action');
  });
});

// ═══════════════════════════════════════════════════════════════
// POST /api/data-import/confirm-mapping
// ═══════════════════════════════════════════════════════════════

describe('POST /api/data-import (action: confirm-mapping)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('confirms column mapping and updates status', async () => {
    const { POST } = await import('../route');

    mockDbDataUploadFindUnique.mockResolvedValue({ id: 'u1', status: 'created' });
    mockDbDataUploadUpdate.mockResolvedValue({ id: 'u1', status: 'mapping_confirmed' });

    const mapping = { 'First Name': 'name', Email: 'email' };
    const req = new Request('http://localhost/api/data-import', {
      method: 'POST',
      body: JSON.stringify({
        action: 'confirm-mapping',
        uploadId: 'u1',
        columnMapping: mapping,
      }),
    });
    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockDbDataUploadUpdate).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: expect.objectContaining({
        columnMapping: JSON.stringify(mapping),
        status: 'mapping_confirmed',
      }),
    });
  });

  it('returns 404 when upload not found', async () => {
    const { POST } = await import('../route');

    mockDbDataUploadFindUnique.mockResolvedValue(null);

    const req = new Request('http://localhost/api/data-import', {
      method: 'POST',
      body: JSON.stringify({
        action: 'confirm-mapping',
        uploadId: 'missing',
        columnMapping: {},
      }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(404);
  });

  it('returns 400 when status is not created', async () => {
    const { POST } = await import('../route');

    mockDbDataUploadFindUnique.mockResolvedValue({ id: 'u1', status: 'processing' });

    const req = new Request('http://localhost/api/data-import', {
      method: 'POST',
      body: JSON.stringify({
        action: 'confirm-mapping',
        uploadId: 'u1',
        columnMapping: {},
      }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════
// POST /api/data-import/validate
// ═══════════════════════════════════════════════════════════════

describe('POST /api/data-import (action: validate)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates rows and returns counts', async () => {
    const { POST } = await import('../route');

    mockDbDataUploadFindUnique.mockResolvedValue({ id: 'u1' });
    mockDbDataUploadUpdate.mockResolvedValue({});
    mockDbUploadRowFindMany.mockResolvedValue([
      { mappedData: JSON.stringify({ name: 'A', email: 'a@x.com' }) },
      { mappedData: JSON.stringify({ name: '', email: '' }) },
    ]);
    mockValidateRows.mockResolvedValue([
      { rowIndex: 0, issues: [], suggestedCorrections: [], status: 'pending' },
      { rowIndex: 1, issues: [{ field: 'email', severity: 'error', message: 'Required' }], suggestedCorrections: [], status: 'failed' },
    ]);

    const req = new Request('http://localhost/api/data-import', {
      method: 'POST',
      body: JSON.stringify({ action: 'validate', uploadId: 'u1' }),
    });
    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.totalRows).toBe(2);
    expect(json.data.failedRows).toBe(1);
    expect(json.data.pendingRows).toBe(1);
  });

  it('returns 404 when upload not found for validate', async () => {
    const { POST } = await import('../route');

    mockDbDataUploadFindUnique.mockResolvedValue(null);

    const req = new Request('http://localhost/api/data-import', {
      method: 'POST',
      body: JSON.stringify({ action: 'validate', uploadId: 'missing' }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════
// POST /api/data-import/normalize
// ═══════════════════════════════════════════════════════════════

describe('POST /api/data-import (action: normalize)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes rows and returns counts', async () => {
    const { POST } = await import('../route');

    mockDbDataUploadFindUnique.mockResolvedValue({ id: 'u1' });
    mockDbDataUploadUpdate.mockResolvedValue({});
    mockDbUploadRowFindMany.mockResolvedValue([
      { mappedData: JSON.stringify({ industry: 'IT', country: 'USA' }) },
      { mappedData: JSON.stringify({ industry: 'Healthcare' }) },
    ]);
    mockNormalizeRows.mockResolvedValue([
      { rowIndex: 0, normalizedData: { industry: 'Technology', country: 'US' }, appliedCorrections: [{ field: 'industry' }] },
      { rowIndex: 1, normalizedData: { industry: 'Healthcare' }, appliedCorrections: [] },
    ]);

    const req = new Request('http://localhost/api/data-import', {
      method: 'POST',
      body: JSON.stringify({ action: 'normalize', uploadId: 'u1' }),
    });
    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.normalizedRows).toBe(1);
    expect(json.data.unchangedRows).toBe(1);
  });

  it('updates upload status to review_ready after normalize', async () => {
    const { POST } = await import('../route');

    mockDbDataUploadFindUnique.mockResolvedValue({ id: 'u1' });
    mockDbDataUploadUpdate.mockResolvedValue({});
    mockDbUploadRowFindMany.mockResolvedValue([]);
    mockNormalizeRows.mockResolvedValue([]);

    const req = new Request('http://localhost/api/data-import', {
      method: 'POST',
      body: JSON.stringify({ action: 'normalize', uploadId: 'u1' }),
    });
    await POST(req as any);

    // Last update call should set status to review_ready
    const calls = mockDbDataUploadUpdate.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[0].data.status).toBe('review_ready');
  });
});

// ═══════════════════════════════════════════════════════════════
// POST /api/data-import/commit
// ═══════════════════════════════════════════════════════════════

describe('POST /api/data-import (action: commit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('commits import and returns counts', async () => {
    const { POST } = await import('../route');

    mockCommitImport.mockResolvedValue({
      companiesCreated: 5,
      contactsCreated: 10,
      duplicatesSkipped: 2,
      failedRows: 1,
    });

    const req = new Request('http://localhost/api/data-import', {
      method: 'POST',
      body: JSON.stringify({ action: 'commit', uploadId: 'u1' }),
    });
    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.companiesCreated).toBe(5);
    expect(json.data.contactsCreated).toBe(10);
    expect(json.data.duplicatesSkipped).toBe(2);
    expect(json.data.failedRows).toBe(1);
    expect(mockCommitImport).toHaveBeenCalledWith('u1');
  });

  it('returns 400 when uploadId missing for commit', async () => {
    const { POST } = await import('../route');

    const req = new Request('http://localhost/api/data-import', {
      method: 'POST',
      body: JSON.stringify({ action: 'commit' }),
    });
    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain('uploadId');
  });

  it('returns 404 when commit fails with not found', async () => {
    const { POST } = await import('../route');

    mockCommitImport.mockRejectedValue(new Error('DataUpload with id "missing" not found.'));

    const req = new Request('http://localhost/api/data-import', {
      method: 'POST',
      body: JSON.stringify({ action: 'commit', uploadId: 'missing' }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/data-import/[id] — Upload detail
// ═══════════════════════════════════════════════════════════════

describe('GET /api/data-import/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns upload with rows and quality scores', async () => {
    const { GET } = await import('../[id]/route');

    mockGetUploadWithDetails.mockResolvedValue({
      upload: {
        id: 'u1', fileName: 'test.csv', totalRows: 10, status: 'completed',
        rows: [
          { id: 'r1', rowIndex: 0, status: 'accepted' },
          { id: 'r2', rowIndex: 1, status: 'failed' },
        ],
      },
      qualityScores: [
        { id: 'qs1', totalScore: 95, rowIndex: 0 },
        { id: 'qs2', totalScore: 40, rowIndex: 1 },
      ],
    });

    const req = new Request('http://localhost/api/data-import/u1');
    const res = await GET(req as any, { params: Promise.resolve({ id: 'u1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.upload.id).toBe('u1');
    expect(json.data.qualityScores).toHaveLength(2);
    expect(json.timestamp).toBeDefined();
  });

  it('returns 404 when upload not found', async () => {
    const { GET } = await import('../[id]/route');

    mockGetUploadWithDetails.mockRejectedValue(new Error('DataUpload with id "missing" not found.'));

    const req = new Request('http://localhost/api/data-import/missing');
    const res = await GET(req as any, { params: Promise.resolve({ id: 'missing' }) });

    expect(res.status).toBe(404);
    expect(res.json).toBeDefined();
  });

  it('returns 500 for unexpected errors', async () => {
    const { GET } = await import('../[id]/route');

    mockGetUploadWithDetails.mockRejectedValue(new Error('DB error'));

    const req = new Request('http://localhost/api/data-import/u1');
    const res = await GET(req as any, { params: Promise.resolve({ id: 'u1' }) });

    expect(res.status).toBe(500);
  });
});
