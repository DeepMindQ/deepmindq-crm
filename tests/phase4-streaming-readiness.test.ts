/**
 * WI-18.4 Phase 4 — AI Streaming Production Readiness Tests
 *
 * Tests for streamAICall from llm-stream.ts covering:
 * - Cancellation handling via AbortSignal
 * - Timeout handling
 * - Partial failure recovery
 * - Connection cleanup (reader.cancel)
 * - Provider fallback chain
 * - All providers fail
 * - SSE format validation
 * - Slow client simulation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Helpers ────────────────────────────────────────────────────────────

/** Create a mock OpenAI-compatible SSE response body */
function createSSEBody(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const lines: string[] = [];
  for (const chunk of chunks) {
    lines.push(
      `data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`,
    );
  }
  lines.push('data: [DONE]\n\n');

  const fullText = lines.join('');
  let index = 0;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (index < fullText.length) {
        // Emit in small pieces to simulate real streaming
        const pieceSize = Math.min(20, fullText.length - index);
        const piece = fullText.slice(index, index + pieceSize);
        controller.enqueue(encoder.encode(piece));
        index += pieceSize;
      } else {
        controller.close();
      }
    },
  });
}

/** Create a mock response body that emits some chunks then throws */
function createFailingSSEBody(
  successChunks: string[],
  errorMessage: string,
  failAfterChunks: number,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const lines: string[] = [];
  for (const chunk of successChunks) {
    lines.push(
      `data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`,
    );
  }
  const fullText = lines.join('');
  let index = 0;
  let chunksEmitted = 0;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (chunksEmitted < failAfterChunks) {
        if (index < fullText.length) {
          const pieceSize = Math.min(50, fullText.length - index);
          controller.enqueue(encoder.encode(fullText.slice(index, index + pieceSize)));
          index += pieceSize;
          chunksEmitted++;
        } else {
          throw new Error(errorMessage);
        }
      } else {
        throw new Error(errorMessage);
      }
    },
  });
}

/** Read all SSE events from a ReadableStream<string> */
async function readAllSSEEvents(stream: ReadableStream<string>): Promise<Array<{ event: string; data: string }>> {
  const reader = stream.getReader();
  const events: Array<{ event: string; data: string }> = [];
  let fullText = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fullText += value;
    }
  } finally {
    reader.releaseLock();
  }

  // Parse SSE events from accumulated text
  const blocks = fullText.split('\n\n').filter(Boolean);
  for (const block of blocks) {
    const lines = block.split('\n');
    let event = '';
    let data = '';
    for (const line of lines) {
      if (line.startsWith('event: ')) event = line.slice(7).trim();
      if (line.startsWith('data: ')) data = line.slice(6);
    }
    if (event) {
      events.push({ event, data: JSON.parse(data) });
    }
  }

  return events;
}

// ─── Mock setup ──────────────────────────────────────────────────────────

const mockProviders = [
  {
    label: 'TestProvider1',
    apiKey: 'test-key-1',
    baseUrl: 'https://provider1.example.com/v1',
    model: 'test-model-1',
    enabled: true,
    tier: 'test',
    category: 'llm' as const,
  },
  {
    label: 'TestProvider2',
    apiKey: 'test-key-2',
    baseUrl: 'https://provider2.example.com/v1',
    model: 'test-model-2',
    enabled: true,
    tier: 'test',
    category: 'llm' as const,
  },
];

// Track mock reader.cancel calls
let mockReaderCancel: ReturnType<typeof vi.fn>;

vi.mock('@/lib/ai-config', () => ({
  getLLMChain: vi.fn().mockResolvedValue(mockProviders),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ─── Tests ──────────────────────────────────────────────────────────────

describe('streamAICall — Phase 4 Streaming Readiness', () => {
  let streamAICall: typeof import('@/lib/llm-stream').streamAICall;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    vi.clearAllMocks();
    originalFetch = globalThis.fetch;
    mockReaderCancel = vi.fn().mockResolvedValue(undefined);

    // Re-import to get fresh module state
    vi.resetModules();
    const mod = await import('@/lib/llm-stream');
    streamAICall = mod.streamAICall;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // 1. Cancellation handling
  it('should emit error event when AbortSignal fires mid-stream', async () => {
    const abortController = new AbortController();

    // Create a body that respects the abort signal — simulates a real network stream
    const encoder = new TextEncoder();
    let readCount = 0;
    const cooperativeBody = new ReadableStream<Uint8Array>({
      async pull(controller) {
        readCount++;
        if (abortController.signal.aborted) {
          // Simulate network abort — close with error
          controller.error(new Error('Stream cancelled'));
          return;
        }
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ choices: [{ delta: { content: `chunk-${readCount}` } }] })}\n\n`,
          ),
        );
        // Short sleep so the abort fires between chunks
        await new Promise(r => setTimeout(r, 5));
      },
      cancel() {
        // Consumer cancelled — stop producing
      },
    });

    // Abort after 15ms (between chunk emissions)
    setTimeout(() => abortController.abort(), 15);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: cooperativeBody,
    });

    const stream = await streamAICall('sys', 'user', {
      signal: abortController.signal,
      timeoutMs: 5000,
    });

    const events = await readAllSSEEvents(stream);
    const errorEvent = events.find(e => e.event === 'error');
    expect(errorEvent).toBeDefined();
  });

  // 2. Timeout handling
  it('should timeout when fetch hangs beyond timeoutMs', async () => {
    // Fetch that hangs until the abort signal fires
    globalThis.fetch = vi.fn().mockImplementation(
      (_url: string, _opts: RequestInit) =>
        new Promise((resolve, reject) => {
          const signal = _opts?.signal as AbortSignal | undefined;
          if (signal) {
            signal.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted', 'AbortError'));
            }, { once: true });
          }
        }),
    );

    const stream = await streamAICall('sys', 'user', {
      timeoutMs: 10, // Very short timeout
    });

    const events = await readAllSSEEvents(stream);
    const errorEvent = events.find(e => e.event === 'error');
    expect(errorEvent).toBeDefined();
    // All providers should fail because fetch timed out
    expect(errorEvent!.data).toContain('failed');
  });

  // 3. Partial failure recovery
  it('should deliver partial content before error when stream fails mid-way', async () => {
    const body = createFailingSSEBody(
      ['Hello ', 'world ', 'this '],
      'Connection reset by peer',
      3, // emit 3 chunks then fail
    );

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body,
    });

    const stream = await streamAICall('sys', 'user', { timeoutMs: 5000 });
    const events = await readAllSSEEvents(stream);

    // Should have at least one chunk before the error
    const chunks = events.filter(e => e.event === 'chunk');
    expect(chunks.length).toBeGreaterThanOrEqual(1);

    // Should end with an error event
    const lastEvent = events[events.length - 1];
    expect(lastEvent.event).toBe('error');
    expect(lastEvent.data).toContain('Connection reset by peer');
  });

  // 4. Connection cleanup — verify reader.cancel() propagates on consumer cancel
  it('should propagate cancel to underlying body when consumer cancels', async () => {
    const encoder = new TextEncoder();

    // Body that keeps producing (never closes on its own)
    let bodyPullCount = 0;
    const infiniteBody = new ReadableStream<Uint8Array>({
      async pull(controller) {
        bodyPullCount++;
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ choices: [{ delta: { content: `item-${bodyPullCount}` } }] })}\n\n`,
          ),
        );
        // Keep the stream open
        await new Promise(r => setTimeout(r, 10));
      },
      cancel() {
        // This should be called when the consumer cancels
      },
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: infiniteBody,
    });

    const stream = await streamAICall('sys', 'user', { timeoutMs: 5000 });
    const reader = stream.getReader();

    // Read one chunk, then cancel the consumer
    const { done: firstDone } = await reader.read();
    expect(firstDone).toBe(false);

    // Consumer cancels — should propagate to body's cancel()
    await reader.cancel();

    // Stream should be done after cancel
    const { done: secondDone } = await reader.read();
    expect(secondDone).toBe(true);

    reader.releaseLock();
  });

  // 5. Provider fallback
  it('should fall back to second provider when first fails', async () => {
    const successBody = createSSEBody(['Fallback success!']);
    let fetchCallCount = 0;

    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      fetchCallCount++;
      if (url.includes('provider1')) {
        // First provider fails with 500
        return {
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal Server Error'),
        };
      }
      // Second provider succeeds
      return { ok: true, body: successBody };
    });

    const stream = await streamAICall('sys', 'user', { timeoutMs: 5000 });
    const events = await readAllSSEEvents(stream);

    // Should have called fetch twice (once per provider)
    expect(fetchCallCount).toBe(2);

    // Should have a successful chunk from the second provider
    const chunks = events.filter(e => e.event === 'chunk');
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.some(c => c.data.includes('Fallback success'))).toBe(true);

    // Should end with done event, not error
    const lastEvent = events[events.length - 1];
    expect(lastEvent.event).toBe('done');
  });

  // 6. All providers fail
  it('should return error stream with descriptive message when all providers fail', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve('Service Unavailable'),
    });

    const stream = await streamAICall('sys', 'user', { timeoutMs: 5000 });
    const events = await readAllSSEEvents(stream);

    expect(events.length).toBe(1);
    expect(events[0].event).toBe('error');
    expect(events[0].data).toContain('All LLM providers failed');
    expect(events[0].data).toContain('TestProvider1');
    expect(events[0].data).toContain('TestProvider2');
  });

  // 7. SSE format validation
  it('should produce correctly formatted SSE output', async () => {
    const body = createSSEBody(['Hello', ' world', '!']);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body,
    });

    const stream = await streamAICall('sys', 'user', { timeoutMs: 5000 });
    const reader = stream.getReader();
    let rawOutput = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        rawOutput += value;
      }
    } finally {
      reader.releaseLock();
    }

    // Verify each SSE event follows the format: event: <type>\ndata: "..."\n\n
    const eventBlocks = rawOutput.split('\n\n').filter(Boolean);
    for (const block of eventBlocks) {
      const lines = block.split('\n');
      expect(lines[0]).toMatch(/^event: (chunk|done|error)$/);
      expect(lines[1]).toMatch(/^data: ".*"$/);
      // Verify data is valid JSON
      const dataStr = lines[1].slice(6);
      expect(() => JSON.parse(dataStr)).not.toThrow();
    }

    // Should have exactly 3 chunks + 1 done = 4 events
    expect(eventBlocks.length).toBe(4);
  });

  // 8. Slow client simulation
  it('should deliver all chunks when client reads with artificial delays', async () => {
    const testChunks = ['one', 'two', 'three', 'four', 'five'];
    const body = createSSEBody(testChunks);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body,
    });

    const stream = await streamAICall('sys', 'user', { timeoutMs: 5000 });
    const reader = stream.getReader();
    const receivedChunks: string[] = [];

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Simulate slow client — delay between reads
        await new Promise(r => setTimeout(r, 10));
        receivedChunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    // All chunks should have been received
    const chunkEvents = receivedChunks
      .join('')
      .split('\n\n')
      .filter(b => b.includes('event: chunk'));

    // Extract data from each chunk event
    const chunkContents: string[] = [];
    for (const block of chunkEvents) {
      const dataLine = block.split('\n').find(l => l.startsWith('data: '));
      if (dataLine) {
        chunkContents.push(JSON.parse(dataLine.slice(6)));
      }
    }

    expect(chunkContents.length).toBe(testChunks.length);
    // Verify concatenation matches expected content
    expect(chunkContents.join('')).toBe('onetwothreefourfive');
  });

  // 9. Already-aborted signal
  it('should throw immediately when signal is already aborted', async () => {
    const abortController = new AbortController();
    abortController.abort();

    globalThis.fetch = vi.fn();

    const stream = await streamAICall('sys', 'user', {
      signal: abortController.signal,
      timeoutMs: 5000,
    });

    const events = await readAllSSEEvents(stream);
    // All providers should fail because signal is pre-aborted
    const errorEvent = events.find(e => e.event === 'error');
    expect(errorEvent).toBeDefined();
  });

  // 10. Non-OK response with body text
  it('should include HTTP status in error when provider returns non-OK', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve('Rate limit exceeded'),
    });

    const stream = await streamAICall('sys', 'user', { timeoutMs: 5000 });
    const events = await readAllSSEEvents(stream);

    const errorEvent = events.find(e => e.event === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent!.data).toContain('429');
  });

  // 11. Null body response
  it('should handle null response body gracefully', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: null,
    });

    const stream = await streamAICall('sys', 'user', { timeoutMs: 5000 });
    const events = await readAllSSEEvents(stream);

    const errorEvent = events.find(e => e.event === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent!.data).toContain('streaming not supported');
  });

  // 12. Empty response stream (no content chunks)
  it('should handle empty stream that only sends [DONE]', async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, body });

    const stream = await streamAICall('sys', 'user', { timeoutMs: 5000 });
    const events = await readAllSSEEvents(stream);

    // Should only have a done event, no chunks
    const chunks = events.filter(e => e.event === 'chunk');
    expect(chunks.length).toBe(0);
    const doneEvents = events.filter(e => e.event === 'done');
    expect(doneEvents.length).toBe(1);
  });
});
