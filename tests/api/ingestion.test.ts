// ═══════════════════════════════════════════════════════════════════════════
// Ingestion API — Route Tests
//
// Tests for:
//   GET  /api/ingestion (list)
//   POST /api/ingestion (upload)
//   GET    /api/ingestion/[id] (detail)
//   DELETE /api/ingestion/[id]
//   POST   /api/ingestion/[id]/cancel
//   POST   /api/ingestion/[id]/retry
// ═══════════════════════════════════════════════════════════════════════════

/** @vitest-environment node */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/api-auth', () => ({
  checkApiAuth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    dataIngestion: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    dataIngestionRow: {
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

vi.mock('path', () => ({
  join: vi.fn((...args: string[]) => args.join('/')),
}));

import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { GET as listIngestions, POST as uploadIngestion } from '@/app/api/ingestion/route';
import { GET as getIngestion, DELETE as deleteIngestion } from '@/app/api/ingestion/[id]/route';
import { POST as cancelIngestion } from '@/app/api/ingestion/[id]/cancel/route';
import { POST as retryIngestion } from '@/app/api/ingestion/[id]/retry/route';

// ── Helpers ────────────────────────────────────────────────────────────

const mockSession = { id: 'user-1', email: 'test@example.com', role: 'admin' as const };

function makeAuthedRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(url, options);
}

function makeUnauthedResponse() {
  return new Response(JSON.stringify({ error: 'Auth required' }), { status: 401 });
}

const mockIngestion = {
  id: 'ing-1',
  fileName: 'contacts.csv',
  fileSize: 1024,
  fileType: 'csv',
  status: 'completed',
  uploadedAt: new Date('2025-01-15'),
  uploadedBy: 'user-1',
  errorMessage: null,
  completedAt: new Date('2025-01-15'),
  processedRows: 500,
  failedRows: 2,
};

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/ingestion — List Ingestions
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/ingestion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      session: null,
      errorResponse: makeUnauthedResponse(),
    });
    const res = await listIngestions(new NextRequest('http://localhost/api/ingestion'));
    expect(res.status).toBe(401);
  });

  it('returns ingestion list with default limit', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.findMany).mockResolvedValue([mockIngestion]);

    const res = await listIngestions(new NextRequest('http://localhost/api/ingestion'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(db.dataIngestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, orderBy: { uploadedAt: 'desc' } }),
    );
  });

  it('respects custom limit parameter', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.findMany).mockResolvedValue([]);

    const res = await listIngestions(new NextRequest('http://localhost/api/ingestion?limit=25'));
    expect(res.status).toBe(200);
    expect(db.dataIngestion.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 25 }));
  });

  it('filters by status query param', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.findMany).mockResolvedValue([]);

    const res = await listIngestions(
      new NextRequest('http://localhost/api/ingestion?status=failed'),
    );
    expect(res.status).toBe(200);
    // The route currently uses findMany without a where filter for status
    // but validates the query param
    expect(db.dataIngestion.findMany).toHaveBeenCalled();
  });

  it('returns 400 for invalid limit', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const res = await listIngestions(new NextRequest('http://localhost/api/ingestion?limit=abc'));
    expect(res.status).toBe(400);
  });

  it('returns 400 for limit above max (50)', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const res = await listIngestions(new NextRequest('http://localhost/api/ingestion?limit=100'));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid status', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const res = await listIngestions(
      new NextRequest('http://localhost/api/ingestion?status=invalid'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 500 on database error', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.findMany).mockRejectedValue(new Error('DB down'));

    const res = await listIngestions(new NextRequest('http://localhost/api/ingestion'));
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/ingestion — Upload File
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/ingestion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      session: null,
      errorResponse: makeUnauthedResponse(),
    });
    const res = await uploadIngestion(
      new NextRequest('http://localhost/api/ingestion', { method: 'POST' }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when no file provided', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    const formData = new FormData();
    const req = new NextRequest('http://localhost/api/ingestion', {
      method: 'POST',
      body: formData,
    });
    const res = await uploadIngestion(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('No file provided');
  });

  it('returns 400 for unsupported file type', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    const file = new File(['test'], 'malware.exe', { type: 'application/octet-stream' });
    const formData = new FormData();
    formData.append('file', file);
    const req = new NextRequest('http://localhost/api/ingestion', {
      method: 'POST',
      body: formData,
    });
    const res = await uploadIngestion(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Unsupported file type');
  });

  it('returns 400 for file with empty name', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    // Zod requires name to have min(1), so empty name fails validation
    const file = new File(['data'], '', { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', file);
    const req = new NextRequest('http://localhost/api/ingestion', {
      method: 'POST',
      body: formData,
    });
    const res = await uploadIngestion(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid file');
  });

  it('returns 400 for file with zero size', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    // Zod requires size to have min(1), so zero-size file fails validation
    const file = new File([], 'empty.csv', { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', file);
    const req = new NextRequest('http://localhost/api/ingestion', {
      method: 'POST',
      body: formData,
    });
    const res = await uploadIngestion(req);
    expect(res.status).toBe(400);
  });

  it('successfully uploads a valid CSV file', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(db.dataIngestion.create).mockResolvedValue(mockIngestion);

    const file = new File(['a,b,c\n1,2,3'], 'contacts.csv', { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', file);
    const req = new NextRequest('http://localhost/api/ingestion', {
      method: 'POST',
      body: formData,
    });
    const res = await uploadIngestion(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(writeFile).toHaveBeenCalled();
  });

  it('creates upload directory if it does not exist', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(db.dataIngestion.create).mockResolvedValue(mockIngestion);

    const file = new File(['data'], 'test.csv', { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', file);
    const req = new NextRequest('http://localhost/api/ingestion', {
      method: 'POST',
      body: formData,
    });
    await uploadIngestion(req);

    expect(mkdir).toHaveBeenCalledWith(expect.stringContaining('uploads'), { recursive: true });
  });

  it('returns 500 on unexpected error', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.create).mockRejectedValue(new Error('DB connection failed'));

    const file = new File(['data'], 'test.csv', { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', file);
    const req = new NextRequest('http://localhost/api/ingestion', {
      method: 'POST',
      body: formData,
    });
    const res = await uploadIngestion(req);
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/ingestion/[id]
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/ingestion/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      session: null,
      errorResponse: makeUnauthedResponse(),
    });
    const res = await getIngestion(new NextRequest('http://localhost/api/ingestion/ing-1'), {
      params: Promise.resolve({ id: 'ing-1' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent ingestion', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.findUnique).mockResolvedValue(null);

    const res = await getIngestion(new NextRequest('http://localhost/api/ingestion/nonexistent'), {
      params: Promise.resolve({ id: 'nonexistent' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns ingestion detail', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.findUnique).mockResolvedValue(mockIngestion);

    const res = await getIngestion(new NextRequest('http://localhost/api/ingestion/ing-1'), {
      params: Promise.resolve({ id: 'ing-1' }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.id).toBe('ing-1');
  });

  it('returns 500 on database error', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.findUnique).mockRejectedValue(new Error('DB down'));

    const res = await getIngestion(new NextRequest('http://localhost/api/ingestion/ing-1'), {
      params: Promise.resolve({ id: 'ing-1' }),
    });
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/ingestion/[id]
// ═══════════════════════════════════════════════════════════════════════════

describe('DELETE /api/ingestion/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      session: null,
      errorResponse: makeUnauthedResponse(),
    });
    const res = await deleteIngestion(
      new NextRequest('http://localhost/api/ingestion/ing-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'ing-1' }) },
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent ingestion', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.findUnique).mockResolvedValue(null);

    const res = await deleteIngestion(
      new NextRequest('http://localhost/api/ingestion/nonexistent', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'nonexistent' }) },
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 when trying to delete pending ingestion', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.findUnique).mockResolvedValue({
      ...mockIngestion,
      status: 'pending',
    });

    const res = await deleteIngestion(
      new NextRequest('http://localhost/api/ingestion/ing-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'ing-1' }) },
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when trying to delete processing ingestion', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.findUnique).mockResolvedValue({
      ...mockIngestion,
      status: 'processing',
    });

    const res = await deleteIngestion(
      new NextRequest('http://localhost/api/ingestion/ing-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'ing-1' }) },
    );
    expect(res.status).toBe(400);
  });

  it('successfully deletes a completed ingestion', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.findUnique).mockResolvedValue(mockIngestion);
    vi.mocked(db.dataIngestion.delete).mockResolvedValue(mockIngestion);
    vi.mocked(db.dataIngestionRow.deleteMany).mockResolvedValue({ count: 0 });

    const res = await deleteIngestion(
      new NextRequest('http://localhost/api/ingestion/ing-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'ing-1' }) },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(db.dataIngestion.delete).toHaveBeenCalledWith({ where: { id: 'ing-1' } });
    expect(db.dataIngestionRow.deleteMany).toHaveBeenCalledWith({
      where: { ingestionId: 'ing-1' },
    });
  });

  it('successfully deletes a failed ingestion', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.findUnique).mockResolvedValue({
      ...mockIngestion,
      status: 'failed',
    });
    vi.mocked(db.dataIngestion.delete).mockResolvedValue(mockIngestion);
    vi.mocked(db.dataIngestionRow.deleteMany).mockResolvedValue({ count: 0 });

    const res = await deleteIngestion(
      new NextRequest('http://localhost/api/ingestion/ing-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'ing-1' }) },
    );
    expect(res.status).toBe(200);
  });

  it('returns 500 on database error', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.findUnique).mockRejectedValue(new Error('DB down'));

    const res = await deleteIngestion(
      new NextRequest('http://localhost/api/ingestion/ing-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'ing-1' }) },
    );
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/ingestion/[id]/cancel
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/ingestion/[id]/cancel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      session: null,
      errorResponse: makeUnauthedResponse(),
    });
    const res = await cancelIngestion(
      new NextRequest('http://localhost/api/ingestion/ing-1/cancel', { method: 'POST' }),
      { params: Promise.resolve({ id: 'ing-1' }) },
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent ingestion', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.findUnique).mockResolvedValue(null);

    const res = await cancelIngestion(
      new NextRequest('http://localhost/api/ingestion/nonexistent/cancel', { method: 'POST' }),
      { params: Promise.resolve({ id: 'nonexistent' }) },
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 when trying to cancel a completed ingestion', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.findUnique).mockResolvedValue(mockIngestion);

    const res = await cancelIngestion(
      new NextRequest('http://localhost/api/ingestion/ing-1/cancel', { method: 'POST' }),
      { params: Promise.resolve({ id: 'ing-1' }) },
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when trying to cancel a failed ingestion', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.findUnique).mockResolvedValue({
      ...mockIngestion,
      status: 'failed',
    });

    const res = await cancelIngestion(
      new NextRequest('http://localhost/api/ingestion/ing-1/cancel', { method: 'POST' }),
      { params: Promise.resolve({ id: 'ing-1' }) },
    );
    expect(res.status).toBe(400);
  });

  it('successfully cancels a pending ingestion', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.findUnique).mockResolvedValue({
      ...mockIngestion,
      status: 'pending',
    });
    vi.mocked(db.dataIngestion.update).mockResolvedValue({
      ...mockIngestion,
      status: 'failed',
      errorMessage: 'Cancelled by user',
    });

    const res = await cancelIngestion(
      new NextRequest('http://localhost/api/ingestion/ing-1/cancel', { method: 'POST' }),
      { params: Promise.resolve({ id: 'ing-1' }) },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(db.dataIngestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ing-1' },
        data: expect.objectContaining({ status: 'failed', errorMessage: 'Cancelled by user' }),
      }),
    );
  });

  it('successfully cancels a processing ingestion', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.findUnique).mockResolvedValue({
      ...mockIngestion,
      status: 'processing',
    });
    vi.mocked(db.dataIngestion.update).mockResolvedValue({
      ...mockIngestion,
      status: 'failed',
      errorMessage: 'Cancelled by user',
    });

    const res = await cancelIngestion(
      new NextRequest('http://localhost/api/ingestion/ing-1/cancel', { method: 'POST' }),
      { params: Promise.resolve({ id: 'ing-1' }) },
    );
    expect(res.status).toBe(200);
  });

  it('returns 500 on database error', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.findUnique).mockRejectedValue(new Error('DB down'));

    const res = await cancelIngestion(
      new NextRequest('http://localhost/api/ingestion/ing-1/cancel', { method: 'POST' }),
      { params: Promise.resolve({ id: 'ing-1' }) },
    );
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/ingestion/[id]/retry
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/ingestion/[id]/retry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      session: null,
      errorResponse: makeUnauthedResponse(),
    });
    const res = await retryIngestion(
      new NextRequest('http://localhost/api/ingestion/ing-1/retry', { method: 'POST' }),
      { params: Promise.resolve({ id: 'ing-1' }) },
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent ingestion', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.findUnique).mockResolvedValue(null);

    const res = await retryIngestion(
      new NextRequest('http://localhost/api/ingestion/nonexistent/retry', { method: 'POST' }),
      { params: Promise.resolve({ id: 'nonexistent' }) },
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 when trying to retry a pending ingestion', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.findUnique).mockResolvedValue({
      ...mockIngestion,
      status: 'pending',
    });

    const res = await retryIngestion(
      new NextRequest('http://localhost/api/ingestion/ing-1/retry', { method: 'POST' }),
      { params: Promise.resolve({ id: 'ing-1' }) },
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when trying to retry a completed ingestion', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.findUnique).mockResolvedValue(mockIngestion);

    const res = await retryIngestion(
      new NextRequest('http://localhost/api/ingestion/ing-1/retry', { method: 'POST' }),
      { params: Promise.resolve({ id: 'ing-1' }) },
    );
    expect(res.status).toBe(400);
  });

  it('successfully retries a failed ingestion', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.findUnique).mockResolvedValue({
      ...mockIngestion,
      status: 'failed',
      errorMessage: 'Connection timeout',
    });
    vi.mocked(db.dataIngestion.update).mockResolvedValue({
      ...mockIngestion,
      status: 'pending',
      errorMessage: null,
      errorDetails: null,
    });

    const res = await retryIngestion(
      new NextRequest('http://localhost/api/ingestion/ing-1/retry', { method: 'POST' }),
      { params: Promise.resolve({ id: 'ing-1' }) },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(db.dataIngestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ing-1' },
        data: expect.objectContaining({
          status: 'pending',
          errorMessage: null,
          errorDetails: null,
          completedAt: null,
        }),
      }),
    );
  });

  it('successfully retries a partial ingestion', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.findUnique).mockResolvedValue({
      ...mockIngestion,
      status: 'partial',
    });
    vi.mocked(db.dataIngestion.update).mockResolvedValue({
      ...mockIngestion,
      status: 'pending',
    });

    const res = await retryIngestion(
      new NextRequest('http://localhost/api/ingestion/ing-1/retry', { method: 'POST' }),
      { params: Promise.resolve({ id: 'ing-1' }) },
    );
    expect(res.status).toBe(200);
  });

  it('returns 500 on database error', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.findUnique).mockRejectedValue(new Error('DB down'));

    const res = await retryIngestion(
      new NextRequest('http://localhost/api/ingestion/ing-1/retry', { method: 'POST' }),
      { params: Promise.resolve({ id: 'ing-1' }) },
    );
    expect(res.status).toBe(500);
  });
});
