import { NextRequest } from 'next/server'
import { checkApiAuth } from '@/lib/api-auth'
import { logger } from '@/lib/logger'
import { streamAICall } from '@/lib/llm-stream'

// ─── Types ──────────────────────────────────────────────────────────────

interface ChatStreamMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatStreamRequest {
  messages: ChatStreamMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
}

// ─── POST /api/ai/chat-stream ───────────────────────────────────────────

export async function POST(request: NextRequest) {
  // ── Authentication Guard ──
  const { errorResponse, session } = await checkApiAuth(request)
  if (errorResponse) return errorResponse

  // ── GOVERNANCE GATE (Phase 0: Temporary Block) ──
  // This streaming endpoint bypasses the AI Governance Layer (ai-governance.ts).
  // Until governedStreamAICall() is implemented (Phase 5), this endpoint is
  // DISABLED to prevent ungoverned AI output from reaching users.
  // Tracked: G9 in Master Product Specification.
  return new Response(
    JSON.stringify({
      success: false,
      error: 'This endpoint is temporarily disabled during Phase 0 governance hardening.',
      detail: 'The chat-stream endpoint bypasses AI governance controls (hallucination prevention, evidence grounding, audit trail, cost governance). A governed streaming implementation (governedStreamAICall) will be available in Phase 5. Use /api/ai/advisor for governed AI interactions.',
      timestamp: new Date().toISOString(),
    }),
    {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    },
  )

  // ── Parse request body ──
  let body: ChatStreamRequest
  try {
    body = await request.json()
  } catch {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Invalid JSON body',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  // ── Validate messages ──
  const { messages, model, temperature, maxTokens } = body

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'messages array is required and must not be empty',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  // Validate each message has role and content
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (!msg.role || !msg.content || typeof msg.content !== 'string') {
      return new Response(
        JSON.stringify({
          success: false,
          error: `messages[${i}] must have role and content (string)`,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }
  }

  // ── Build system/user prompts from messages array ──
  // The streamAICall expects a single system prompt and user prompt.
  // We extract the last system message as systemPrompt and concatenate
  // the remaining messages for the user prompt.
  let systemPrompt = 'You are DeepMindQ AI Assistant, an intelligent sales CRM assistant. Be helpful, concise, and actionable. Use markdown formatting for readability when appropriate.'

  const nonSystemMessages: ChatStreamMessage[] = []
  for (const msg of messages) {
    if (msg.role === 'system') {
      systemPrompt = msg.content
    } else {
      nonSystemMessages.push(msg)
    }
  }

  // Build a conversation-style user prompt from non-system messages
  const userPrompt = nonSystemMessages
    .map(m => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
    .join('\n\n')

  if (!userPrompt.trim()) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'At least one non-system message is required',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  logger.info(`[chat-stream] Starting stream for user=${session?.email ?? 'unknown'}, messages=${messages.length}`)

  try {
    // ── Create the streaming response ──
    const sseStream = await streamAICall(systemPrompt, userPrompt, {
      model,
      temperature,
      maxTokens,
      timeoutMs: 120_000, // 2 minute timeout for chat
      signal: request.signal,
      feature: 'chat-stream',
    })

    return new Response(sseStream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering (if behind proxy)
      },
    })
  } catch (err) {
    // @ts-expect-error -- unreachable code (403 block above), but TypeScript still checks
    const msg = (err instanceof Error) ? err.message : String(err)
    logger.error(`[chat-stream] Failed to create stream: ${msg}`)

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to start AI stream',
        detail: msg,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
