/**
 * @vitest-environment node
 *
 * AI Advisor Pipeline — Route Tests
 *
 * Tests POST /api/advisor/pipeline — Run intelligence pipeline for an organization.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/api-auth', () => ({
  checkApiAuth: vi.fn(),
}));

vi.mock('@/lib/intelligence/reasoning', () => ({
  runIntelligencePipeline: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { checkApiAuth } from '@/lib/api-auth';
import { runIntelligencePipeline } from '@/lib/intelligence/reasoning';
import { logger } from '@/lib/logger';
import { POST } from '@/app/api/advisor/pipeline/route';

// ── Helpers ────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/advisor/pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── Test Data ──────────────────────────────────────────────────────────

const mockPipelineResult = {
  signalsGenerated: 5,
  insightsCreated: 3,
  recommendationsMade: 2,
  durationMs: 1500,
};

// ── POST /api/advisor/pipeline ────────────────────────────────────────

describe('POST /api/advisor/pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Authentication ─────────────────────────────────────────────────

  it('returns 401 when no session is provided', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      errorResponse: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });

    const req = makeRequest({ organizationId: 'org-1' });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  // ── Validation ─────────────────────────────────────────────────────

  it('returns 400 when organizationId is missing', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});

    const req = makeRequest({});
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid request body');
  });

  it('returns 400 when organizationId is empty string', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});

    const req = makeRequest({ organizationId: '' });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('returns 200 when organizationId is valid', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(runIntelligencePipeline).mockResolvedValue(mockPipelineResult);

    const req = makeRequest({ organizationId: 'org-1' });
    const res = await POST(req);

    expect(res.status).toBe(200);
  });

  // ── Successful pipeline run ────────────────────────────────────────

  it('returns success: true on successful pipeline run', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(runIntelligencePipeline).mockResolvedValue(mockPipelineResult);

    const req = makeRequest({ organizationId: 'org-42' });
    const res = await POST(req);
    const body = await res.json();

    expect(body.success).toBe(true);
  });

  it('returns pipeline result data in response', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(runIntelligencePipeline).mockResolvedValue(mockPipelineResult);

    const req = makeRequest({ organizationId: 'org-42' });
    const res = await POST(req);
    const body = await res.json();

    expect(body.data).toEqual(mockPipelineResult);
    expect(body.data.signalsGenerated).toBe(5);
    expect(body.data.insightsCreated).toBe(3);
    expect(body.data.recommendationsMade).toBe(2);
  });

  it('calls runIntelligencePipeline with the provided organizationId', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(runIntelligencePipeline).mockResolvedValue(mockPipelineResult);

    const req = makeRequest({ organizationId: 'org-abc-123' });
    await POST(req);

    expect(runIntelligencePipeline).toHaveBeenCalledWith('org-abc-123');
  });

  // ── Logging ───────────────────────────────────────────────────────

  it('logs pipeline start with organizationId', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(runIntelligencePipeline).mockResolvedValue(mockPipelineResult);

    const req = makeRequest({ organizationId: 'org-log-test' });
    await POST(req);

    expect(logger.info).toHaveBeenCalledWith('[PIPELINE] Running intelligence pipeline', {
      organizationId: 'org-log-test',
    });
  });

  // ── Pipeline result variations ────────────────────────────────────

  it('handles pipeline returning empty results', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(runIntelligencePipeline).mockResolvedValue({
      signalsGenerated: 0,
      insightsCreated: 0,
      recommendationsMade: 0,
      durationMs: 200,
    });

    const req = makeRequest({ organizationId: 'org-empty' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.signalsGenerated).toBe(0);
  });

  it('handles pipeline returning partial results', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(runIntelligencePipeline).mockResolvedValue({
      signalsGenerated: 10,
      insightsCreated: 0,
    });

    const req = makeRequest({ organizationId: 'org-partial' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.signalsGenerated).toBe(10);
    expect(body.data.insightsCreated).toBe(0);
  });

  // ── Error handling ────────────────────────────────────────────────

  it('returns 500 when pipeline fails with a known error', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(runIntelligencePipeline).mockRejectedValue(new Error('AI provider unavailable'));

    const req = makeRequest({ organizationId: 'org-fail' });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Intelligence pipeline failed');
    expect(logger.error).toHaveBeenCalledWith('[PIPELINE] Pipeline failed', {
      error: 'AI provider unavailable',
    });
  });

  it('returns 500 when pipeline fails with unknown error', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(runIntelligencePipeline).mockRejectedValue('string error');

    const req = makeRequest({ organizationId: 'org-fail2' });
    const res = await POST(req);

    expect(res.status).toBe(500);
    expect(logger.error).toHaveBeenCalledWith('[PIPELINE] Pipeline failed', { error: 'Unknown' });
  });

  it('returns 500 when JSON parsing fails', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});

    const req = new NextRequest('http://localhost/api/advisor/pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
  });

  // ── Edge cases ────────────────────────────────────────────────────

  it('accepts organizationId with special characters', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(runIntelligencePipeline).mockResolvedValue(mockPipelineResult);

    const req = makeRequest({ organizationId: 'org_abc-123.xyz' });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(runIntelligencePipeline).toHaveBeenCalledWith('org_abc-123.xyz');
  });
});
