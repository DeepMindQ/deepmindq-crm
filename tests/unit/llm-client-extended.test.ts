/**
 * @vitest-environment node
 * LLM Client — Extended Tests (ONLY uncovered lines)
 *
 * Existing tests/ai/llm-client.test.ts covers:
 *   - extractJSON basics, verifyEmailBasic, generateExecutiveSummary,
 *     generateEngagementApproach, webSearch/parallelWebSearch with no provider
 *
 * This file covers:
 *   - callAI: success, JSON parsing, quality gates
 *   - callLLMWithUsage: provider chain, fallback, Z.ai SDK fallback
 *   - revenueLLMCall: never-throws, fallback
 *   - webSearch: Tavily provider, URL parsing
 *   - sdkWebSearch / parallelWebSearch: with results
 *   - tavilyAIAnswer: provider, error, no provider
 *   - getZAI / resetZAI: singleton, TTL
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────

const { mockChatCreate, mockFunctionsInvoke } = vi.hoisted(() => ({
  mockChatCreate: vi.fn(),
  mockFunctionsInvoke: vi.fn(),
}));

vi.mock('@/lib/ai-config', () => ({
  getLLMChain: vi.fn(),
  getSearchProvider: vi.fn(),
}));

vi.mock('@/lib/ai-copilot/quality-gates', () => ({
  runQualityGates: vi.fn().mockResolvedValue({ score: 90, issues: [], passed: true }),
  formatQualityReportForLog: vi.fn().mockReturnValue('quality:pass:90'),
}));

vi.mock('@/lib/ai-copilot/usage-tracker', () => ({
  logAIUsage: vi.fn().mockResolvedValue(undefined),
  estimateCost: vi.fn().mockReturnValue(0.001),
}));

vi.mock('@/lib/token-counter', () => ({
  countTokens: vi.fn().mockResolvedValue(50),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/zai-config', () => ({
  ensureZaiConfig: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('z-ai-web-dev-sdk', () => ({
  default: {
    create: vi.fn().mockImplementation(() =>
      Promise.resolve({
        chat: { completions: { create: mockChatCreate } },
        functions: { invoke: mockFunctionsInvoke },
      }),
    ),
  },
}));

// Mock global fetch
const originalFetch = globalThis.fetch;

import {
  getZAI,
  resetZAI,
  callAI,
  callLLM,
  callLLMWithUsage,
  revenueLLMCall,
  webSearch,
  sdkWebSearch,
  parallelWebSearch,
  tavilyAIAnswer,
} from '@/lib/llm-client';

import { getLLMChain, getSearchProvider } from '@/lib/ai-config';

const standardProvider = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: 'sk-test',
  model: 'gpt-4',
  label: 'OpenAI',
};

const geminiProvider = {
  baseUrl: 'https://generativelanguage.googleapis.com/v1',
  apiKey: 'gemini-key',
  model: 'gemini-2.0-flash',
  label: 'Gemini Pro',
};

function mockFetchResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as unknown as Response;
}

describe('llm-client — extended coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChatCreate.mockReset();
    mockFunctionsInvoke.mockReset();
    globalThis.fetch = vi.fn() as any;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    resetZAI();
  });

  // ── getZAI / resetZAI ─────────────────────────────────────────

  describe('getZAI / resetZAI', () => {
    it('creates a new instance on first call', async () => {
      const zai = await getZAI();
      expect(zai).toBeDefined();
      expect(zai.chat).toBeDefined();
    });

    it('caches the instance for subsequent calls', async () => {
      const zai1 = await getZAI();
      const zai2 = await getZAI();
      expect(zai1).toBe(zai2);
    });

    it('calls create again after resetZAI', async () => {
      await getZAI();
      const createSpy = vi.mocked((await import('z-ai-web-dev-sdk')).default.create);
      const callsBefore = createSpy.mock.calls.length;

      resetZAI();
      await getZAI();

      expect(createSpy.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  // ── callAI ─────────────────────────────────────────────────────

  describe('callAI', () => {
    it('returns parsed JSON from AI response', async () => {
      mockChatCreate.mockResolvedValue({
        choices: [{ message: { content: '{"key": "value"}' } }],
      });

      const result = await callAI({
        systemPrompt: 'sys',
        userPrompt: 'usr',
        feature: 'test',
        maxRetries: 0,
      });

      expect(result.success).toBe(true);
      expect(result.parsed).toEqual({ key: 'value' });
      expect(result.raw).toBe('{"key": "value"}');
    });

    it('extracts JSON from markdown-wrapped response', async () => {
      mockChatCreate.mockResolvedValue({
        choices: [{ message: { content: '```json\n{"a": 1}\n```' } }],
      });

      const result = await callAI({
        systemPrompt: 'sys',
        userPrompt: 'usr',
        feature: 'test',
        maxRetries: 0,
      });

      expect(result.parsed).toEqual({ a: 1 });
    });

    it('sets parsed to null for non-JSON response', async () => {
      mockChatCreate.mockResolvedValue({
        choices: [{ message: { content: 'This is plain text.' } }],
      });

      const result = await callAI({
        systemPrompt: 'sys',
        userPrompt: 'usr',
        feature: 'test',
        maxRetries: 0,
      });

      expect(result.parsed).toBeNull();
      expect(result.raw).toBe('This is plain text.');
    });

    it('handles empty AI response content', async () => {
      mockChatCreate.mockResolvedValue({ choices: [{}] });

      const result = await callAI({
        systemPrompt: 'sys',
        userPrompt: 'usr',
        feature: 'test',
        maxRetries: 0,
      });

      expect(result.raw).toBe('');
      expect(result.parsed).toBeNull();
      expect(result.success).toBe(true);
    });

    it('returns failure when all retries exhausted', async () => {
      mockChatCreate.mockRejectedValue(new Error('always fails'));

      const result = await callAI({
        systemPrompt: 'sys',
        userPrompt: 'usr',
        feature: 'all-fail',
        maxRetries: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('always fails');
      expect(result.raw).toBe('');
    });

    it('skips quality check when runQualityCheck=false', async () => {
      const { runQualityGates } = await import('@/lib/ai-copilot/quality-gates');
      mockChatCreate.mockResolvedValue({
        choices: [{ message: { content: '{"data": 1}' } }],
      });

      await callAI({
        systemPrompt: 'sys',
        userPrompt: 'usr',
        feature: 'no-qc',
        runQualityCheck: false,
        maxRetries: 0,
      });

      expect(runQualityGates).not.toHaveBeenCalled();
    });

    it('logs warning when quality gate fails', async () => {
      const { runQualityGates } = await import('@/lib/ai-copilot/quality-gates');
      const { logger } = await import('@/lib/logger');
      vi.mocked(runQualityGates).mockResolvedValueOnce({
        score: 30,
        issues: ['too short'],
        passed: false,
      });
      mockChatCreate.mockResolvedValue({
        choices: [{ message: { content: '{"short": 1}' } }],
      });

      const result = await callAI({
        systemPrompt: 'sys',
        userPrompt: 'usr',
        feature: 'qc-fail',
        maxRetries: 0,
      });

      expect(result.success).toBe(true);
      expect(result.quality?.passed).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Quality gate FAILED'));
    });

    it('tracks latency in result', async () => {
      mockChatCreate.mockResolvedValue({
        choices: [{ message: { content: '"data"' } }],
      });

      const result = await callAI({
        systemPrompt: 'sys',
        userPrompt: 'usr',
        feature: 'latency',
        maxRetries: 0,
      });

      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ── callLLMWithUsage / callLLM ────────────────────────────────

  describe('callLLMWithUsage', () => {
    it('calls provider and returns text with usage', async () => {
      vi.mocked(getLLMChain).mockResolvedValue([standardProvider]);
      vi.mocked(globalThis.fetch).mockResolvedValue(
        mockFetchResponse({
          choices: [{ message: { content: 'Hello world' } }],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        }),
      );

      const result = await callLLMWithUsage('sys', 'usr');
      expect(result.text).toBe('Hello world');
      expect(result.usage).toEqual({
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      });
    });

    it('returns usage=null when provider response lacks usage', async () => {
      vi.mocked(getLLMChain).mockResolvedValue([standardProvider]);
      vi.mocked(globalThis.fetch).mockResolvedValue(
        mockFetchResponse({ choices: [{ message: { content: 'no usage' } }] }),
      );

      const result = await callLLMWithUsage('sys', 'usr');
      expect(result.text).toBe('no usage');
      expect(result.usage).toBeNull();
    });

    it('falls back to next provider on failure', async () => {
      const provider2 = { ...standardProvider, label: 'Provider2', model: 'model-2' };
      vi.mocked(getLLMChain).mockResolvedValue([{ ...standardProvider, apiKey: 'bad' }, provider2]);

      vi.mocked(globalThis.fetch)
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce(
          mockFetchResponse({ choices: [{ message: { content: 'fallback' } }] }),
        );

      const result = await callLLMWithUsage('sys', 'usr');
      expect(result.text).toBe('fallback');
    });

    it('falls through Gemini models and then to Z.ai SDK', async () => {
      vi.mocked(getLLMChain).mockResolvedValue([geminiProvider]);
      vi.mocked(globalThis.fetch).mockRejectedValue(new Error('gemini fail'));
      mockChatCreate.mockResolvedValue({
        choices: [{ message: { content: 'zai fallback' } }],
      });

      const result = await callLLMWithUsage('sys', 'usr');
      expect(result.text).toBe('zai fallback');
    });

    it('throws when all providers and Z.ai SDK fail', async () => {
      vi.mocked(getLLMChain).mockResolvedValue([standardProvider]);
      vi.mocked(globalThis.fetch).mockRejectedValue(new Error('all fail'));
      mockChatCreate.mockRejectedValue(new Error('zai fail'));

      await expect(callLLMWithUsage('sys', 'usr')).rejects.toThrow('All LLM providers failed');
    });

    it('throws descriptive error when no providers configured', async () => {
      vi.mocked(getLLMChain).mockResolvedValue(null);
      mockChatCreate.mockRejectedValue(new Error('no config'));

      await expect(callLLMWithUsage('sys', 'usr')).rejects.toThrow('No LLM providers configured');
    });

    it('throws when chain is empty array', async () => {
      vi.mocked(getLLMChain).mockResolvedValue([]);
      mockChatCreate.mockRejectedValue(new Error('no config'));

      await expect(callLLMWithUsage('sys', 'usr')).rejects.toThrow('No LLM providers configured');
    });

    it('handles provider returning non-ok response', async () => {
      vi.mocked(getLLMChain).mockResolvedValue([standardProvider]);
      vi.mocked(globalThis.fetch).mockResolvedValue(
        mockFetchResponse({ error: 'bad request' }, false, 400),
      );
      mockChatCreate.mockResolvedValue({
        choices: [{ message: { content: 'zai fb' } }],
      });

      const result = await callLLMWithUsage('sys', 'usr');
      expect(result.text).toBe('zai fb');
    });

    it('respects custom temperature and maxTokens', async () => {
      vi.mocked(getLLMChain).mockResolvedValue([standardProvider]);
      vi.mocked(globalThis.fetch).mockResolvedValue(
        mockFetchResponse({ choices: [{ message: { content: 'ok' } }] }),
      );

      await callLLMWithUsage('sys', 'usr', { temperature: 0.3, maxTokens: 100 });

      const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.temperature).toBe(0.3);
      expect(body.max_tokens).toBe(100);
    });
  });

  describe('callLLM', () => {
    it('is a thin wrapper returning just the text', async () => {
      vi.mocked(getLLMChain).mockResolvedValue([standardProvider]);
      vi.mocked(globalThis.fetch).mockResolvedValue(
        mockFetchResponse({ choices: [{ message: { content: 'text-only' } }] }),
      );

      const result = await callLLM('sys', 'usr');
      expect(result).toBe('text-only');
    });
  });

  // ── revenueLLMCall ─────────────────────────────────────────────

  describe('revenueLLMCall', () => {
    it('calls provider and returns text', async () => {
      vi.mocked(getLLMChain).mockResolvedValue([standardProvider]);
      vi.mocked(globalThis.fetch).mockResolvedValue(
        mockFetchResponse({ choices: [{ message: { content: 'revenue text' } }] }),
      );

      const result = await revenueLLMCall('sys', 'usr');
      expect(result).toBe('revenue text');
    });

    it('never throws — returns empty string on total failure', async () => {
      vi.mocked(getLLMChain).mockResolvedValue([standardProvider]);
      vi.mocked(globalThis.fetch).mockRejectedValue(new Error('fail'));
      mockChatCreate.mockRejectedValue(new Error('also fail'));

      const result = await revenueLLMCall('sys', 'usr');
      expect(result).toBe('');
    });

    it('falls back to Z.ai SDK when provider fails', async () => {
      vi.mocked(getLLMChain).mockResolvedValue([standardProvider]);
      vi.mocked(globalThis.fetch).mockRejectedValue(new Error('fail'));
      mockChatCreate.mockResolvedValue({
        choices: [{ message: { content: 'zai revenue' } }],
      });

      const result = await revenueLLMCall('sys', 'usr');
      expect(result).toBe('zai revenue');
    });

    it('returns empty string when no providers configured', async () => {
      vi.mocked(getLLMChain).mockResolvedValue(null);
      mockChatCreate.mockRejectedValue(new Error('no config'));

      const result = await revenueLLMCall('sys', 'usr');
      expect(result).toBe('');
    });
  });

  // ── webSearch (Tavily configured) ─────────────────────────────

  describe('webSearch (Tavily configured)', () => {
    it('returns results when Tavily is configured', async () => {
      vi.mocked(getSearchProvider).mockResolvedValue({
        apiKey: 'tavily-key',
        provider: 'tavily',
      });

      vi.mocked(globalThis.fetch).mockResolvedValue(
        mockFetchResponse({
          results: [
            { title: 'Test', url: 'https://example.com', content: 'Snippet here' },
            { title: 'Test 2', url: 'https://other.com', content: 'Another' },
          ],
        }),
      );

      const results = await webSearch('test query', 5);
      expect(results).toHaveLength(2);
      expect(results[0].title).toBe('Test');
      expect(results[0].url).toBe('https://example.com');
      expect(results[0].host_name).toBe('example.com');
    });

    it('filters out results with no title, url, or snippet', async () => {
      vi.mocked(getSearchProvider).mockResolvedValue({
        apiKey: 'tavily-key',
        provider: 'tavily',
      });

      vi.mocked(globalThis.fetch).mockResolvedValue(
        mockFetchResponse({
          results: [
            { title: '', url: '', content: '' },
            { title: 'Valid', url: 'https://example.com', content: 'OK' },
          ],
        }),
      );

      const results = await webSearch('test', 10);
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Valid');
    });

    it('handles invalid URL gracefully', async () => {
      vi.mocked(getSearchProvider).mockResolvedValue({
        apiKey: 'tavily-key',
        provider: 'tavily',
      });

      vi.mocked(globalThis.fetch).mockResolvedValue(
        mockFetchResponse({
          results: [{ title: 'No URL', url: 'not-a-url', content: 'snippet' }],
        }),
      );

      const results = await webSearch('test', 10);
      expect(results).toHaveLength(1);
      expect(results[0].host_name).toBe('');
    });

    it('returns empty array when Tavily returns non-ok', async () => {
      vi.mocked(getSearchProvider).mockResolvedValue({
        apiKey: 'tavily-key',
        provider: 'tavily',
      });

      vi.mocked(globalThis.fetch).mockResolvedValue(
        mockFetchResponse({ error: 'unauthorized' }, false, 401),
      );

      const results = await webSearch('test', 10);
      expect(results).toEqual([]);
    });

    it('returns empty array when provider is a string', async () => {
      vi.mocked(getSearchProvider).mockResolvedValue('none');
      const results = await webSearch('test', 10);
      expect(results).toEqual([]);
    });
  });

  // ── sdkWebSearch ───────────────────────────────────────────────

  describe('sdkWebSearch', () => {
    it('returns deduplicated results', async () => {
      mockFunctionsInvoke.mockResolvedValue({
        results: [
          { title: 'A', url: 'https://a.com', snippet: 's1' },
          { title: 'B', url: 'https://b.com', snippet: 's2' },
        ],
      });

      const results = await sdkWebSearch('test', 5);
      expect(results).toHaveLength(2);
    });

    it('deduplicates by URL', async () => {
      mockFunctionsInvoke.mockResolvedValue({
        results: [
          { title: 'A', url: 'https://a.com', snippet: 's1' },
          { title: 'A dup', url: 'https://a.com', snippet: 's1' },
          { title: 'B', url: 'https://b.com', snippet: 's2' },
        ],
      });

      const results = await sdkWebSearch('test', 5);
      expect(results).toHaveLength(2);
    });

    it('returns empty array when SDK throws', async () => {
      mockFunctionsInvoke.mockRejectedValue(new Error('SDK error'));
      const results = await sdkWebSearch('test', 5);
      expect(results).toEqual([]);
    });

    it('returns empty array for non-array results', async () => {
      mockFunctionsInvoke.mockResolvedValue('not an array');
      const results = await sdkWebSearch('test', 5);
      expect(results).toEqual([]);
    });
  });

  // ── parallelWebSearch (with results) ──────────────────────────

  describe('parallelWebSearch (with results)', () => {
    it('deduplicates across multiple queries', async () => {
      mockFunctionsInvoke
        .mockResolvedValueOnce({
          results: [
            { title: 'Shared', url: 'https://shared.com', snippet: 's' },
            { title: 'Q1 Only', url: 'https://q1.com', snippet: 's' },
          ],
        })
        .mockResolvedValueOnce({
          results: [
            { title: 'Shared', url: 'https://shared.com', snippet: 's' },
            { title: 'Q2 Only', url: 'https://q2.com', snippet: 's' },
          ],
        });

      const results = await parallelWebSearch(['query 1', 'query 2'], 5);
      expect(results).toHaveLength(3);
      const urls = results.map((r) => r.url);
      expect(urls.filter((u) => u === 'https://shared.com')).toHaveLength(1);
    });

    it('returns empty array when all SDK calls fail', async () => {
      mockFunctionsInvoke.mockRejectedValue(new Error('fail'));
      const results = await parallelWebSearch(['q1', 'q2'], 5);
      expect(results).toEqual([]);
    });
  });

  // ── tavilyAIAnswer ─────────────────────────────────────────────

  describe('tavilyAIAnswer', () => {
    it('returns answer when Tavily is configured', async () => {
      vi.mocked(getSearchProvider).mockResolvedValue({
        apiKey: 'tavily-key',
        provider: 'tavily',
      });

      vi.mocked(globalThis.fetch).mockResolvedValue(
        mockFetchResponse({ answer: 'The answer is 42.' }),
      );

      const result = await tavilyAIAnswer('What is the meaning of life?');
      expect(result).toBe('The answer is 42.');
    });

    it('returns empty string when no provider configured', async () => {
      vi.mocked(getSearchProvider).mockResolvedValue(null);
      const result = await tavilyAIAnswer('test?');
      expect(result).toBe('');
    });

    it('returns empty string when Tavily returns 403 (no retry)', async () => {
      vi.mocked(getSearchProvider).mockResolvedValue({
        apiKey: 'tavily-key',
        provider: 'tavily',
      });

      // 403 doesn't trigger retry (only 429 and 5xx do)
      vi.mocked(globalThis.fetch).mockResolvedValue(
        mockFetchResponse({ error: 'forbidden' }, false, 403),
      );

      const result = await tavilyAIAnswer('test?');
      expect(result).toBe('');
    });

    it('returns empty string when no answer in response', async () => {
      vi.mocked(getSearchProvider).mockResolvedValue({
        apiKey: 'tavily-key',
        provider: 'tavily',
      });

      vi.mocked(globalThis.fetch).mockResolvedValue(mockFetchResponse({ answer: '' }));

      const result = await tavilyAIAnswer('test?');
      expect(result).toBe('');
    });

    it('handles fetch rejection after exhausting retries', async () => {
      vi.useFakeTimers();
      try {
        vi.mocked(getSearchProvider).mockResolvedValue({
          apiKey: 'tavily-key',
          provider: 'tavily',
        });

        vi.mocked(globalThis.fetch).mockRejectedValue(new Error('network error'));

        const promise = tavilyAIAnswer('test?');
        // Advance through all 3 retry delays
        await vi.advanceTimersByTimeAsync(20_000);
        const result = await promise;
        expect(result).toBe('');
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
