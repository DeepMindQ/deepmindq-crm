/**
 * LLM Streaming Client — Governed streaming AI responses via SSE.
 *
 * Phase 5 of the governance architecture: streaming AI responses that:
 *   - Go through the governance layer (rate limiting, audit logging)
 *   - Stream tokens as Server-Sent Events (SSE)
 *   - Support multi-provider failover for streaming
 *   - Track usage/cost after stream completion
 *   - Work with both direct provider streaming and Z.ai SDK
 *
 * Architecture:
 *   Route Handler → streamAICall() → Provider SSE → TransformStream → Response
 *
 * The ESLint governance rule (no-ungoverned-llm.mjs) permits this file
 * in ALLOWED_GOVERNANCE_FILES.
 */

import { logger } from '@/lib/logger';
import { getLLMChain } from '@/lib/ai-config';
import { checkRateLimit } from '@/lib/ai-governance';
import { logAIUsage, estimateCost } from '@/lib/ai-copilot/usage-tracker';

// ─── Types ──────────────────────────────────────────────────────────────

export interface StreamConfig {
  /** Feature name for rate limiting and audit */
  feature: string;
  /** User ID for per-user rate limiting */
  userId?: string;
  /** System prompt */
  systemPrompt: string;
  /** User prompt */
  userPrompt: string;
  /** LLM temperature (default: 0.7) */
  temperature?: number;
  /** Max tokens for response (default: 4096) */
  maxTokens?: number;
  /** Rate limit override */
  rateLimit?: number;
}

export interface StreamChunk {
  type: 'token' | 'done' | 'error' | 'usage';
  token?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  costUSD?: number;
  error?: string;
}

// ─── Provider Streaming ────────────────────────────────────────────────

interface LLMChainEntry {
  baseUrl: string;
  apiKey: string;
  model: string;
  label: string;
}

/**
 * Stream from an OpenAI-compatible provider using SSE.
 * Parses the SSE stream and yields tokens.
 */
async function* streamFromProvider(
  provider: LLMChainEntry,
  messages: Array<{ role: string; content: string }>,
  temperature: number,
  maxTokens: number,
): AsyncGenerator<string, void, unknown> {
  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${provider.model}: ${response.status} — ${errorText.slice(0, 150)}`);
  }

  if (!response.body) {
    throw new Error('No response body from streaming provider');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue; // skip comments
        if (trimmed === 'data: [DONE]') return;

        if (trimmed.startsWith('data: ')) {
          try {
            const json = JSON.parse(trimmed.slice(6));
            const token = json.choices?.[0]?.delta?.content;
            if (token) yield token;
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ─── Z.ai SDK Streaming Fallback ──────────────────────────────────────

async function* streamFromZaiSDK(
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  maxTokens: number,
): AsyncGenerator<string, void, unknown> {
  // Z.ai SDK doesn't support native streaming, so we fall back to
  // a regular call and yield the complete response as one chunk
  const { getZAI } = await import('@/lib/llm-client');
  const zai = await getZAI();

  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    thinking: { type: 'disabled' },
    temperature,
    max_tokens: maxTokens,
  });

  const text = completion.choices?.[0]?.message?.content ?? '';
  if (text) yield text;
}

// ─── Main Streaming Entry Point ────────────────────────────────────────

/**
 * Stream an AI response as SSE chunks.
 *
 * Enforces rate limiting before streaming. Tracks usage after completion.
 * Tries external providers first, falls back to Z.ai SDK.
 *
 * Usage in route handler:
 *   const stream = streamAICall({ feature: 'chat', systemPrompt, userPrompt });
 *   const encoder = new TextEncoder();
 *   const readable = new ReadableStream({
 *     async start(controller) {
 *       for await (const chunk of stream) {
 *         controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
 *       }
 *       controller.close();
 *     },
 *   });
 *   return new Response(readable, { headers: { 'Content-Type': 'text/event-stream' } });
 */
export async function* streamAICall(
  config: StreamConfig,
): AsyncGenerator<StreamChunk, void, unknown> {
  const startTime = Date.now();
  const temperature = config.temperature ?? 0.7;
  const maxTokens = config.maxTokens ?? 4096;

  // Step 1: Rate limiting
  if (!checkRateLimit(config.feature, config.userId, config.rateLimit)) {
    yield { type: 'error', error: 'Rate limit exceeded. Please try again later.' };
    return;
  }

  const messages = [
    { role: 'system', content: config.systemPrompt },
    { role: 'user', content: config.userPrompt },
  ];

  let fullText = '';
  let provider = 'unknown';
  let model = 'unknown';
  let usedProvider = false;

  try {
    // Step 2: Try external providers (streaming)
    const chain = (await getLLMChain()) as LLMChainEntry[] | null;
    if (chain && Array.isArray(chain) && chain.length > 0) {
      for (const prov of chain) {
        try {
          for await (const token of streamFromProvider(prov, messages, temperature, maxTokens)) {
            fullText += token;
            yield { type: 'token', token };
            provider = prov.label;
            model = prov.model;
            usedProvider = true;
          }
          break; // Success — exit provider loop
        } catch (err) {
          logger.warn(
            `[llm-stream] Streaming failed for ${prov.label}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    // Step 3: Z.ai SDK fallback (non-streaming)
    if (!usedProvider) {
      logger.info('[llm-stream] All providers failed — falling back to Z.ai SDK');
      provider = 'zai-sdk';
      model = 'zai-sdk';

      for await (const token of streamFromZaiSDK(
        config.systemPrompt,
        config.userPrompt,
        temperature,
        maxTokens,
      )) {
        fullText += token;
        yield { type: 'token', token };
      }
    }

    // Step 4: Track usage
    const latencyMs = Date.now() - startTime;
    const estimatedTokens = Math.ceil(fullText.length / 4); // rough estimate
    const costUSD = estimateCost(provider, model, 0, estimatedTokens);

    yield {
      type: 'usage',
      usage: {
        promptTokens: 0,
        completionTokens: estimatedTokens,
        totalTokens: estimatedTokens,
      },
      costUSD,
    };

    // Fire-and-forget usage logging
    logAIUsage({
      provider,
      model,
      promptTokens: 0,
      completionTokens: estimatedTokens,
      latencyMs,
    }).catch(() => {});

    yield { type: 'done' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[llm-stream] Fatal streaming error: ${msg}`);
    yield { type: 'error', error: msg };

    // Log failed usage
    logAIUsage({
      provider,
      model,
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: Date.now() - startTime,
      errorMessage: msg,
    }).catch(() => {});
  }
}

/**
 * Convenience: Convert a streamAICall generator into a Web ReadableStream
 * suitable for use as a Next.js Response body.
 */
export function createAIStream(config: StreamConfig): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamAICall(config)) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error';
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`),
        );
        controller.close();
      }
    },
    cancel() {
      logger.debug('[llm-stream] Client disconnected from stream');
    },
  });
}
