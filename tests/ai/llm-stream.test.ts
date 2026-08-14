/**
 * Tests for LLM Streaming Client.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/lib/ai-config', () => ({
  getLLMChain: vi.fn().mockResolvedValue([
    {
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'test-key',
      model: 'test-model',
      label: 'TestProvider',
    },
  ]),
}));

vi.mock('@/lib/ai-governance', () => ({
  checkRateLimit: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/ai-copilot/usage-tracker', () => ({
  logAIUsage: vi.fn().mockResolvedValue(undefined),
  estimateCost: vi.fn().mockReturnValue(0.001),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/llm-client', () => ({
  getZAI: vi.fn().mockResolvedValue({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'Z.ai fallback response' } }],
        }),
      },
    },
  }),
}));

import { createAIStream } from '@/lib/llm-stream';

describe('LLM Streaming Client', () => {
  describe('createAIStream', () => {
    it('returns a ReadableStream', () => {
      const stream = createAIStream({
        feature: 'test-stream',
        systemPrompt: 'You are helpful.',
        userPrompt: 'Hello',
      });
      expect(stream).toBeInstanceOf(ReadableStream);
    });

    it('stream can be read (integration with mocked fetch)', async () => {
      // Mock global fetch for streaming
      const mockStream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          const chunks = [
            'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
            'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
            'data: [DONE]\n\n',
          ];
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        },
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const stream = createAIStream({
        feature: 'test-stream',
        systemPrompt: 'You are helpful.',
        userPrompt: 'Hello',
      });

      const reader = stream.getReader();
      const decoder = new TextDecoder();
      const chunks: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value));
      }

      // Should contain at least token and done chunks
      const allText = chunks.join('');
      expect(allText).toContain('data: ');
      expect(allText).toContain('"token"');
    });

    it('handles rate limiting', async () => {
      const { checkRateLimit } = await import('@/lib/ai-governance');
      vi.mocked(checkRateLimit).mockReturnValueOnce(false);

      const stream = createAIStream({
        feature: 'rate-limited',
        systemPrompt: 'You are helpful.',
        userPrompt: 'Hello',
      });

      const reader = stream.getReader();
      const decoder = new TextDecoder();
      const { value } = await reader.read();
      const text = decoder.decode(value);

      expect(text).toContain('"error"');
      expect(text).toContain('Rate limit');
    });
  });
});
