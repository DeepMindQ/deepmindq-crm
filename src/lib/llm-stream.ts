/**
 * LLM Streaming Client — SSE-based streaming for AI calls.
 *
 * Uses the same provider chain as callLLM (from llm-client.ts) but returns
 * a ReadableStream with SSE-formatted text chunks for real-time delivery.
 *
 * DESIGN:
 *   - Uses OpenAI-compatible `stream: true` API
 *   - Parses SSE `data:` lines from the response
 *   - Handles cancellation via AbortController
 *   - Handles timeout with default 60s
 *   - Error recovery: returns error as a final SSE event
 */

import { getLLMChain } from '@/lib/ai-config'
import { logger } from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────

export interface StreamAICallOptions {
  /** Override model (otherwise uses provider's default) */
  model?: string
  /** Temperature for generation (default 0.7) */
  temperature?: number
  /** Maximum tokens (default 8192) */
  maxTokens?: number
  /** Timeout in milliseconds (default 60000) */
  timeoutMs?: number
  /** External AbortSignal for request cancellation */
  signal?: AbortSignal
  /** Optional feature tag for logging */
  feature?: string
}

interface SSEChunk {
  event: 'chunk' | 'done' | 'error'
  data: string
}

/**
 * Format an SSE line.
 * Each event is `event: <type>\ndata: <json>\n\n`
 */
function formatSSE(chunk: SSEChunk): string {
  return `event: ${chunk.event}\ndata: ${JSON.stringify(chunk.data)}\n\n`
}

/**
 * Stream an AI call through the LLM provider chain.
 *
 * Tries providers in priority order (same as callLLM). On success, streams
 * SSE-formatted chunks. On failure, emits a single error event.
 *
 * @returns ReadableStream<string> with SSE-formatted text
 */
export async function streamAICall(
  systemPrompt: string,
  userPrompt: string,
  options?: StreamAICallOptions,
): Promise<ReadableStream<string>> {
  const {
    temperature = 0.7,
    maxTokens = 8192,
    timeoutMs = 60000,
    feature = 'stream-ai-call',
  } = options ?? {}

  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  // Get the provider chain
  const chain = await getLLMChain()
  const errors: string[] = []

  for (const provider of chain) {
    try {
      const stream = await streamFromProvider(
        provider.baseUrl,
        provider.apiKey,
        options?.model ?? provider.model,
        messages,
        temperature,
        maxTokens,
        timeoutMs,
        options?.signal,
      )
      return stream
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${provider.label}: ${msg}`)
      logger.warn(`[llm-stream] Provider ${provider.label} failed: ${msg}`)
    }
  }

  // All providers failed — return a stream with a single error event
  const errorMessage = errors.length > 0
    ? `All LLM providers failed:\n${errors.map(e => '  - ' + e).join('\n')}`
    : 'No LLM providers configured. Add API keys in Settings > AI Providers.'

  logger.error(`[llm-stream] ${feature} failed: ${errorMessage}`)

  return new ReadableStream<string>({
    start(controller) {
      controller.enqueue(formatSSE({ event: 'error', data: errorMessage }))
      controller.close()
    },
  })
}

/**
 * Stream from a single OpenAI-compatible provider.
 */
async function streamFromProvider(
  baseURL: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  temperature: number,
  maxTokens: number,
  timeoutMs: number,
  externalSignal?: AbortSignal,
): Promise<ReadableStream<string>> {
  // Create a combined abort controller (external + timeout)
  const abortController = new AbortController()
  const timeoutId = setTimeout(() => abortController.abort(new Error('Stream timed out')), timeoutMs)

  // If external signal fires, also abort
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timeoutId)
      throw new Error('Request was already aborted')
    }
    externalSignal.addEventListener('abort', () => {
      abortController.abort(new Error('Request cancelled by client'))
    }, { once: true })
  }

  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
    signal: abortController.signal,
  })

  clearTimeout(timeoutId)

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new Error(`${model}: ${response.status} — ${errorText.slice(0, 200)}`)
  }

  if (!response.body) {
    throw new Error(`${model}: Response body is null — streaming not supported`)
  }

  // Transform the fetch response body into SSE-formatted chunks
  return createSSEStream(response.body, abortController.signal)
}

/**
 * Parse an OpenAI-compatible SSE stream and re-emit as our own SSE format.
 *
 * OpenAI streaming format:
 *   data: {"choices":[{"delta":{"content":"Hello"}}]}
 *   data: {"choices":[{"delta":{"content":" world"}}]}
 *   data: [DONE]
 *
 * Our SSE format:
 *   event: chunk
 *   data: "Hello"
 *
 *   event: chunk
 *   data: " world"
 *
 *   event: done
 *   data: ""
 */
function createSSEStream(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): ReadableStream<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  return new ReadableStream<string>({
    async pull(controller) {
      // Check if already aborted
      if (signal.aborted) {
        controller.enqueue(formatSSE({ event: 'error', data: 'Stream cancelled' }))
        controller.close()
        reader.cancel().catch(() => {})
        return
      }

      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            // Flush any remaining buffer
            if (buffer.trim()) {
              const parsed = parseSSELines(buffer)
              for (const chunk of parsed) {
                controller.enqueue(formatSSE(chunk))
              }
            }
            controller.enqueue(formatSSE({ event: 'done', data: '' }))
            controller.close()
            return
          }

          // Append to buffer and try to parse complete SSE lines
          buffer += decoder.decode(value, { stream: true })
          const lines = extractCompleteLines(buffer)
          buffer = lines.remainder

          const parsed = parseSSELines(lines.complete)
          for (const chunk of parsed) {
            if (chunk.event === 'chunk' && chunk.data) {
              controller.enqueue(formatSSE(chunk))
            } else if (chunk.event === 'done') {
              controller.enqueue(formatSSE({ event: 'done', data: '' }))
              controller.close()
              reader.cancel().catch(() => {})
              return
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream read error'
        controller.enqueue(formatSSE({ event: 'error', data: msg }))
        controller.close()
        reader.cancel().catch(() => {})
      }
    },

    cancel() {
      reader.cancel().catch(() => {})
    },
  })
}

/**
 * Extract complete lines (ending with \n) from a buffer.
 * Returns the complete lines and the leftover remainder.
 */
function extractCompleteLines(buffer: string): { complete: string; remainder: string } {
  const lastIndex = buffer.lastIndexOf('\n')
  if (lastIndex === -1) {
    return { complete: '', remainder: buffer }
  }
  return {
    complete: buffer.slice(0, lastIndex + 1),
    remainder: buffer.slice(lastIndex + 1),
  }
}

/**
 * Parse SSE data lines from OpenAI-compatible streaming format.
 * Returns an array of SSEChunk objects.
 */
function parseSSELines(lines: string): SSEChunk[] {
  const chunks: SSEChunk[] = []
  const lineList = lines.split('\n')

  for (const line of lineList) {
    const trimmed = line.trim()

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith(':')) continue

    // Only process "data:" lines
    if (!trimmed.startsWith('data:')) continue

    const dataStr = trimmed.slice(5).trim()

    // Check for [DONE] sentinel
    if (dataStr === '[DONE]') {
      chunks.push({ event: 'done', data: '' })
      continue
    }

    try {
      const parsed = JSON.parse(dataStr) as {
        choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>
        error?: { message?: string }
      }

      // Handle error objects in the stream
      if (parsed.error?.message) {
        chunks.push({ event: 'error', data: parsed.error.message })
        continue
      }

      // Extract content delta
      const content = parsed.choices?.[0]?.delta?.content
      if (content) {
        chunks.push({ event: 'chunk', data: content })
      }

      // Check for finish_reason (stream completion)
      const finishReason = parsed.choices?.[0]?.finish_reason
      if (finishReason && finishReason !== 'null') {
        chunks.push({ event: 'done', data: '' })
      }
    } catch {
      // Malformed JSON line — skip it
      continue
    }
  }

  return chunks
}
