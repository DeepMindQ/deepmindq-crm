// ═══════════════════════════════════════════════════════════════════════════
// Prompt Templates API — Route Tests
//
// Tests for:
//   GET  /api/prompt-templates (list with filters + pagination)
//   POST /api/prompt-templates (create new version)
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
    promptTemplate: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prompt-registry', () => ({
  invalidatePromptCache: vi.fn(),
}));

import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { invalidatePromptCache } from '@/lib/prompt-registry';
import { GET as listTemplates, POST as createTemplate } from '@/app/api/prompt-templates/route';

// ── Helpers ────────────────────────────────────────────────────────────

const mockSession = { id: 'user-1', email: 'test@example.com', role: 'admin' as const };

function makeUnauthedResponse() {
  return new Response(JSON.stringify({ error: 'Auth required' }), { status: 401 });
}

const mockTemplate = {
  id: 'tpl-1',
  key: 'reasoning_chain',
  label: 'Reasoning Chain',
  description: 'Multi-step reasoning',
  systemPrompt: 'You are an analyst.',
  userPromptTemplate: 'Analyze {company}',
  version: 1,
  isActive: true,
  isDefault: true,
  feature: 'reasoning',
  model: 'gpt-4',
  createdAt: '2025-01-15',
  updatedAt: '2025-01-15',
};

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/prompt-templates
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/prompt-templates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      session: null,
      errorResponse: makeUnauthedResponse(),
    });
    const res = await listTemplates(new NextRequest('http://localhost/api/prompt-templates'));
    expect(res.status).toBe(401);
  });

  it('returns templates with pagination', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.promptTemplate.findMany).mockResolvedValue([mockTemplate]);
    vi.mocked(db.promptTemplate.count).mockResolvedValue(1);

    const res = await listTemplates(new NextRequest('http://localhost/api/prompt-templates'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.pagination).toEqual({ page: 1, limit: 100, total: 1, totalPages: 1 });
  });

  it('filters by feature', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.promptTemplate.findMany).mockResolvedValue([]);
    vi.mocked(db.promptTemplate.count).mockResolvedValue(0);

    const res = await listTemplates(
      new NextRequest('http://localhost/api/prompt-templates?feature=reasoning'),
    );

    const callArgs = vi.mocked(db.promptTemplate.findMany).mock.calls[0][0] as any;
    expect(callArgs.where.feature).toBe('reasoning');
  });

  it('filters by isActive=true', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.promptTemplate.findMany).mockResolvedValue([]);
    vi.mocked(db.promptTemplate.count).mockResolvedValue(0);

    const res = await listTemplates(
      new NextRequest('http://localhost/api/prompt-templates?isActive=true'),
    );

    const callArgs = vi.mocked(db.promptTemplate.findMany).mock.calls[0][0] as any;
    expect(callArgs.where.isActive).toBe(true);
  });

  it('filters by isActive=false', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.promptTemplate.findMany).mockResolvedValue([]);
    vi.mocked(db.promptTemplate.count).mockResolvedValue(0);

    const res = await listTemplates(
      new NextRequest('http://localhost/api/prompt-templates?isActive=false'),
    );

    const callArgs = vi.mocked(db.promptTemplate.findMany).mock.calls[0][0] as any;
    expect(callArgs.where.isActive).toBe(false);
  });

  it('respects page and limit params', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.promptTemplate.findMany).mockResolvedValue([]);
    vi.mocked(db.promptTemplate.count).mockResolvedValue(25);

    const res = await listTemplates(
      new NextRequest('http://localhost/api/prompt-templates?page=2&limit=10'),
    );
    const body = await res.json();

    expect(db.promptTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
    expect(body.pagination.page).toBe(2);
    expect(body.pagination.totalPages).toBe(3);
  });

  it('returns 400 for invalid limit', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const res = await listTemplates(
      new NextRequest('http://localhost/api/prompt-templates?limit=abc'),
    );
    expect(res.status).toBe(400);
  });

  it('orders by key asc then version desc', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.promptTemplate.findMany).mockResolvedValue([]);
    vi.mocked(db.promptTemplate.count).mockResolvedValue(0);

    await listTemplates(new NextRequest('http://localhost/api/prompt-templates'));

    expect(db.promptTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ key: 'asc' }, { version: 'desc' }],
      }),
    );
  });

  it('returns 500 on database error', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.promptTemplate.findMany).mockRejectedValue(new Error('DB down'));

    const res = await listTemplates(new NextRequest('http://localhost/api/prompt-templates'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to list prompt templates');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/prompt-templates
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/prompt-templates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      session: null,
      errorResponse: makeUnauthedResponse(),
    });
    const req = new NextRequest('http://localhost/api/prompt-templates', { method: 'POST' });
    const res = await createTemplate(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing key', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const req = new NextRequest('http://localhost/api/prompt-templates', {
      method: 'POST',
      body: JSON.stringify({ label: 'Test', systemPrompt: 'Hello' }),
    });
    const res = await createTemplate(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid key format (must be snake_case)', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const req = new NextRequest('http://localhost/api/prompt-templates', {
      method: 'POST',
      body: JSON.stringify({ key: 'InvalidKey', label: 'Test', systemPrompt: 'Hello' }),
    });
    const res = await createTemplate(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for key starting with number', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const req = new NextRequest('http://localhost/api/prompt-templates', {
      method: 'POST',
      body: JSON.stringify({ key: '1invalid', label: 'Test', systemPrompt: 'Hello' }),
    });
    const res = await createTemplate(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing systemPrompt', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const req = new NextRequest('http://localhost/api/prompt-templates', {
      method: 'POST',
      body: JSON.stringify({ key: 'test_prompt', label: 'Test' }),
    });
    const res = await createTemplate(req);
    expect(res.status).toBe(400);
  });

  it('creates a new template at version 1 when no existing versions', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.promptTemplate.findMany).mockResolvedValue([]);
    vi.mocked(db.promptTemplate.create).mockResolvedValue(mockTemplate);

    const req = new NextRequest('http://localhost/api/prompt-templates', {
      method: 'POST',
      body: JSON.stringify({
        key: 'new_prompt',
        label: 'New Prompt',
        systemPrompt: 'You are helpful.',
      }),
    });
    const res = await createTemplate(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(db.promptTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ version: 1, key: 'new_prompt' }) }),
    );
  });

  it('auto-increments version when existing versions exist', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.promptTemplate.findMany).mockResolvedValue([{ version: 3 }]);
    vi.mocked(db.promptTemplate.create).mockResolvedValue({ ...mockTemplate, version: 4 });

    const req = new NextRequest('http://localhost/api/prompt-templates', {
      method: 'POST',
      body: JSON.stringify({
        key: 'existing_prompt',
        label: 'Updated',
        systemPrompt: 'Updated prompt.',
      }),
    });
    const res = await createTemplate(req);

    expect(res.status).toBe(201);
    expect(db.promptTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ version: 4 }) }),
    );
  });

  it('invalidates prompt cache after creation', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.promptTemplate.findMany).mockResolvedValue([]);
    vi.mocked(db.promptTemplate.create).mockResolvedValue(mockTemplate);

    const req = new NextRequest('http://localhost/api/prompt-templates', {
      method: 'POST',
      body: JSON.stringify({
        key: 'cached_prompt',
        label: 'Cached',
        systemPrompt: 'Cache me.',
      }),
    });
    await createTemplate(req);

    expect(invalidatePromptCache).toHaveBeenCalledWith('cached_prompt');
  });

  it('defaults isActive to true and isDefault to false', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.promptTemplate.findMany).mockResolvedValue([]);
    vi.mocked(db.promptTemplate.create).mockResolvedValue(mockTemplate);

    const req = new NextRequest('http://localhost/api/prompt-templates', {
      method: 'POST',
      body: JSON.stringify({
        key: 'defaults_prompt',
        label: 'Defaults',
        systemPrompt: 'Test defaults.',
      }),
    });
    await createTemplate(req);

    const createData = vi.mocked(db.promptTemplate.create).mock.calls[0][0] as any;
    expect(createData.data.isActive).toBe(true);
    expect(createData.data.isDefault).toBe(false);
  });

  it('returns 500 on database error', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.promptTemplate.findMany).mockRejectedValue(new Error('DB down'));

    const req = new NextRequest('http://localhost/api/prompt-templates', {
      method: 'POST',
      body: JSON.stringify({
        key: 'error_prompt',
        label: 'Error',
        systemPrompt: 'Will fail.',
      }),
    });
    const res = await createTemplate(req);
    expect(res.status).toBe(500);
  });
});
