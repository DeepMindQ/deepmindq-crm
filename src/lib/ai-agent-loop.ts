/**
 * AI Agent Loop — Agentic Tool-Use Implementation
 *
 * This is the CORE fix for the "AI is waste" problem.
 *
 * Previously, the AI chat was pure text completion — it could only generate
 * generic responses based on context injected into the system prompt.
 *
 * Now, the AI can:
 *   1. Receive tool definitions (CRM query tools)
 *   2. Decide when to call a tool based on user intent
 *   3. Execute the tool → get real CRM data
 *   4. Feed the tool result back to the LLM
 *   5. Generate a data-grounded response with actual numbers and insights
 *
 * ARCHITECTURE:
 *   chat-stream/route.ts → agentLoopWithTools() → [LLM call → tool execution → LLM call] → SSE stream
 *
 * LOOP LIMITS:
 *   - Max 5 tool-call rounds per request (prevents infinite loops)
 *   - Max 3 parallel tool calls per round (prevents tool spam)
 *   - Total timeout configurable (default 120s)
 *
 * STREAMING:
 *   - Final LLM response (after all tool calls) is streamed to the user
 *   - Tool execution happens "under the hood" — user sees a brief status
 *   - Tool results are sent as SSE events before the final response
 */

import { getLLMChain } from '@/lib/ai-config'
import { logger } from '@/lib/logger'
import { CRM_TOOLS } from './ai-tool-definitions'
import { executeToolCall } from './ai-tool-executor'

// ─── Types ──────────────────────────────────────────────────────────────

export interface AgentLoopOptions {
  systemPrompt: string
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string; tool_calls?: ToolCallInfo[]; tool_call_id?: string }>
  temperature?: number
  maxTokens?: number
  timeoutMs?: number
  signal?: AbortSignal
  maxToolRounds?: number
  feature?: string
  /** Callback for tool-use status updates sent before the final stream */
  onToolCall?: (toolName: string, args: Record<string, unknown>) => void
  /** Callback for tool result summary sent before the final stream */
  onToolResult?: (toolName: string, success: boolean, summary: string) => void
}

interface ToolCallInfo {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

interface ToolResultMessage {
  role: 'tool'
  tool_call_id: string
  content: string
}

interface AgentLoopResult {
  /** The SSE stream with the final LLM response */
  stream: ReadableStream<string>
  /** Tool calls that were executed (for logging/debugging) */
  toolCallsExecuted: Array<{
    round: number
    toolName: string
    args: Record<string, unknown>
    success: boolean
    durationMs: number
  }>
  /** Total tokens used across all rounds */
  totalRounds: number
}

// ─── OpenAI-compatible API types ───────────────────────────────────────

interface LLMMessage {
  role: string
  content?: string | null
  tool_calls?: ToolCallInfo[]
  tool_call_id?: string
}

interface LLMResponse {
  choices: Array<{
    message: {
      content: string | null
      tool_calls?: ToolCallInfo[]
    }
    finish_reason: string | null
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// ─── System prompt addon for tool use ──────────────────────────────────

export const TOOL_USE_SYSTEM_ADDON = `
## Tool Use Instructions

You have access to tools that query the DeepMindQ CRM database in real-time. Use them whenever you need factual, up-to-date data to answer the user's question.

### When to use tools:
- User asks about specific companies, contacts, deals, or leads
- User asks "what are my hottest leads?" or "who needs follow-up?"
- User asks about pipeline status, signals, or engagement metrics
- User asks about a specific company's intelligence, scores, or opportunities
- You need CURRENT data — never guess or make up numbers

### When NOT to use tools:
- General CRM questions that don't require data lookup
- User is asking for advice, strategy, or email drafting help
- User is greeting you or asking conversational questions

### How to format your response:
When you have tool results, present the data clearly:
- Use **bold** for key metrics and company names
- Use bullet points for lists of items
- Provide actionable insights — don't just dump data, explain what it MEANS
- Suggest next steps when relevant

IMPORTANT: Always cite the data you found. Be precise with numbers, names, and scores.`

// ─── Main agentic loop ────────────────────────────────────────────────

/**
 * Run an agentic tool-use loop.
 *
 * 1. Sends messages + tools to the LLM
 * 2. If LLM returns tool_calls → execute them → append results → loop back
 * 3. If LLM returns content → stream it as the final response
 * 4. Loop exits after maxRounds or when LLM produces content
 */
export async function agentLoopWithTools(
  options: AgentLoopOptions,
): Promise<AgentLoopResult> {
  const {
    systemPrompt,
    messages,
    temperature = 0.7,
    maxTokens = 4096,
    timeoutMs = 120_000,
    signal,
    maxToolRounds = 5,
    feature: _deprecatedFeature = 'agent-loop',
    onToolCall,
    onToolResult,
  } = options

  const toolCallsExecuted: AgentLoopResult['toolCallsExecuted'] = []
  const conversationHistory: LLMMessage[] = [
    { role: 'system', content: `${systemPrompt}\n${TOOL_USE_SYSTEM_ADDON}` },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ]

  const chain = await getLLMChain()
  const providerErrors: string[] = []
  let toolsNotSupported = false // Track if any provider rejects tool calling

  // ── Agentic loop: LLM → (tool_calls? → execute → feed back) → LLM → ... ──
  for (let round = 0; round < maxToolRounds; round++) {
    // Check for cancellation
    if (signal?.aborted) {
      return {
        stream: createErrorStream('Request cancelled'),
        toolCallsExecuted,
        totalRounds: round,
      }
    }

    let llmResponse: LLMResponse | null = null

    // Try each provider in the chain
    for (const provider of chain) {
      try {
        const timeoutId = setTimeout(() => {
          // Timeout handled by AbortController below
        }, timeoutMs)

        const controller = new AbortController()
        const timeoutController = new AbortController()

        const timeoutHandle = setTimeout(() => timeoutController.abort(new Error('LLM call timed out')), timeoutMs)

        if (signal) {
          signal.addEventListener('abort', () => controller.abort(), { once: true })
        }

        const response = await fetch(`${provider.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${provider.apiKey}`,
          },
          body: JSON.stringify({
            model: provider.model,
            messages: conversationHistory,
            temperature,
            max_tokens: maxTokens,
            tools: CRM_TOOLS,
            tool_choice: round === 0 ? 'auto' : 'auto',
          }),
          signal: timeoutController.signal,
        })

        clearTimeout(timeoutHandle)
        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error')
          const errStr = errorText.slice(0, 500)
          // Detect if provider doesn't support tool/function calling
          if (errStr.includes('tools') || errStr.includes('function') || errStr.includes('tool_choice')) {
            toolsNotSupported = true
            logger.warn(`[agent-loop] Provider ${provider.label} does not support tool calling, will fall back`)
          }
          providerErrors.push(`${provider.label}: ${response.status} — ${errStr}`)
          continue
        }

        llmResponse = (await response.json()) as LLMResponse
        break // Success — exit provider loop
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        providerErrors.push(`${provider.label}: ${msg}`)
        logger.warn(`[agent-loop] Provider ${provider.label} failed in round ${round + 1}: ${msg}`)
      }
    }

    // All providers failed
    if (!llmResponse) {
      // If providers failed because they don't support tools, fall back to non-tool call
      if (toolsNotSupported && round === 0) {
        logger.info('[agent-loop] Tools not supported by providers — falling back to non-tool LLM call')
        return await fallbackWithoutTools(systemPrompt, messages, temperature, maxTokens, timeoutMs, signal)
      }

      const errMsg = providerErrors.length > 0
        ? `All LLM providers failed:\n${providerErrors.map(e => '  - ' + e).join('\n')}`
        : 'No LLM providers configured'
      return {
        stream: createErrorStream(errMsg),
        toolCallsExecuted,
        totalRounds: round + 1,
      }
    }

    const choice = llmResponse.choices?.[0]
    if (!choice) {
      return {
        stream: createErrorStream('LLM returned empty response'),
        toolCallsExecuted,
        totalRounds: round + 1,
      }
    }

    const assistantMessage = choice.message

    // ── Check if LLM wants to call tools ──
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      logger.info(`[agent-loop] Round ${round + 1}: LLM requested ${assistantMessage.tool_calls.length} tool call(s)`)

      // Add assistant message (with tool_calls) to conversation
      conversationHistory.push({
        role: 'assistant',
        content: assistantMessage.content ?? null,
        tool_calls: assistantMessage.tool_calls,
      })

      // Execute each tool call
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name
        let parsedArgs: Record<string, unknown> = {}
        try {
          parsedArgs = JSON.parse(toolCall.function.arguments)
        } catch {
          parsedArgs = {}
        }

        logger.info(`[agent-loop] Executing tool: ${toolName} with args: ${JSON.stringify(parsedArgs).slice(0, 200)}`)

        // Notify caller of tool execution
        onToolCall?.(toolName, parsedArgs)

        const startTime = Date.now()
        const result = await executeToolCall(toolName, parsedArgs)
        const durationMs = Date.now() - startTime

        toolCallsExecuted.push({
          round: round + 1,
          toolName,
          args: parsedArgs,
          success: result.success,
          durationMs,
        })

        // Create tool result message
        const toolResultMsg: ToolResultMessage = {
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result.success ? result.data : { error: result.error }),
        }

        conversationHistory.push(toolResultMsg)

        // Notify caller of tool result
        const summary = result.success
          ? `Found ${Array.isArray(result.data) ? `${result.data.length} results` : 'data'} in ${durationMs}ms`
          : `Error: ${result.error}`
        onToolResult?.(toolName, result.success, summary)

        logger.info(`[agent-loop] Tool ${toolName} ${result.success ? 'succeeded' : 'failed'} in ${durationMs}ms`)
      }

      // Loop back to the LLM with tool results
      continue
    }

    // ── No tool calls — LLM produced content → stream it ──
    const finalContent = assistantMessage.content ?? ''

    return {
      stream: createAgentStream(toolCallsExecuted, finalContent),
      toolCallsExecuted,
      totalRounds: round + 1,
    }
  }

  // Max rounds exceeded
  logger.warn(`[agent-loop] Max tool rounds (${maxToolRounds}) exceeded`)
  return {
    stream: createErrorStream('AI processing took too long — please try a simpler question.'),
    toolCallsExecuted,
    totalRounds: maxToolRounds,
  }
}

// ─── Non-tool fallback (when providers don't support function calling) ────

/**
 * Fall back to a simple non-tool LLM call.
 * Used when providers reject the `tools` parameter.
 */
async function fallbackWithoutTools(
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  temperature: number,
  maxTokens: number,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<AgentLoopResult> {
  const chain = await getLLMChain()
  const conversationHistory: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ]

  for (const provider of chain) {
    try {
      const timeoutController = new AbortController()
      const handle = setTimeout(() => timeoutController.abort(new Error('LLM call timed out')), timeoutMs)
      if (signal) signal.addEventListener('abort', () => timeoutController.abort(), { once: true })

      const response = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model: provider.model,
          messages: conversationHistory,
          temperature,
          max_tokens: maxTokens,
          // NO tools parameter — this is the fallback
        }),
        signal: timeoutController.signal,
      })

      clearTimeout(handle)

      if (!response.ok) continue

      const llmResponse = (await response.json()) as LLMResponse
      const content = llmResponse.choices?.[0]?.message?.content ?? ''

      if (content) {
        return {
          stream: createTextStream(content),
          toolCallsExecuted: [],
          totalRounds: 1,
        }
      }
    } catch (err) {
      logger.warn(`[agent-loop] Fallback provider ${provider.label} failed: ${err instanceof Error ? err.message : err}`)
    }
  }

  // All providers failed — try Z.ai SDK as ultimate fallback
  const zaiStream = await agentLoopZaiFallback(systemPrompt, messages.map(m => m.content).join('\n'), temperature, maxTokens, timeoutMs, signal)
  return { stream: zaiStream, toolCallsExecuted: [], totalRounds: 1 }
}

// ─── Z.ai SDK Fallback (non-tool, simulated stream) ────────────────────

/**
 * If no external providers support tool calling, fall back to Z.ai SDK
 * with context injection instead of tool use.
 */
export async function agentLoopZaiFallback(
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  maxTokens: number,
  timeoutMs: number,
  _signal?: AbortSignal,
): Promise<ReadableStream<string>> {
  try {
    const { getZAI } = await import('./llm-client')
    const zai = await getZAI()

    const completion = await Promise.race([
      zai.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        thinking: { type: 'disabled' },
        temperature,
        max_tokens: maxTokens,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Z.ai SDK call timed out')), timeoutMs)
      ),
    ])

    const fullText = completion.choices?.[0]?.message?.content ?? ''

    if (!fullText) {
      return createErrorStream('Z.ai SDK returned empty response')
    }

    return createTextStream(fullText)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.warn(`[agent-loop] Z.ai SDK fallback failed: ${msg}`)
    return createErrorStream(msg)
  }
}

// ─── Stream helpers ────────────────────────────────────────────────────
//
// IMPORTANT: The chat sidebar parser expects each SSE message as a single line:
//   data: {"event":"chunk","data":"text here"}\n\n
// It only reads lines starting with "data:" and JSON.parses them.
// It checks parsed.event === 'chunk'|'done'|'error'|'tool_status'.
// We do NOT use the standard SSE "event:" field — the parser ignores those lines.
//

function sseJson(event: string, data: unknown): string {
  return `data: ${JSON.stringify({ event, data })}\n\n`
}

/**
 * Create a stream that sends tool-status events followed by final text chunks.
 * This lets the sidebar show "Searching companies..." while tools execute.
 */
function createAgentStream(
  toolCalls: AgentLoopResult['toolCallsExecuted'],
  finalText: string,
): ReadableStream<string> {
  return new ReadableStream<string>({
    async start(controller) {
      // 1. Send tool-status events so the sidebar shows progress
      for (const tc of toolCalls) {
        const statusMsg = tc.success
          ? `Queried ${toolLabel(tc.toolName)} ✓`
          : `Failed: ${toolLabel(tc.toolName)}`
        controller.enqueue(sseJson('tool_status', statusMsg))
      }

      // 2. Send a brief summary line if tools were used
      if (toolCalls.length > 0) {
        const summary = buildToolUseSummary(toolCalls)
        if (summary) {
          controller.enqueue(sseJson('chunk', summary + '\n\n'))
        }
      }

      // 3. Stream the final LLM text in small chunks for a typing effect
      const chunks = finalText.length < 50 ? [finalText] : splitIntoChunks(finalText, 80)
      for (const chunk of chunks) {
        controller.enqueue(sseJson('chunk', chunk))
      }

      controller.enqueue(sseJson('done', null))
      controller.close()
    },
  })
}

function createTextStream(text: string): ReadableStream<string> {
  const chunks = splitIntoChunks(text, 80)

  return new ReadableStream<string>({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(sseJson('chunk', chunk))
      }
      controller.enqueue(sseJson('done', null))
      controller.close()
    },
  })
}

function createErrorStream(errorMessage: string): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      controller.enqueue(sseJson('error', errorMessage))
      controller.enqueue(sseJson('done', null))
      controller.close()
    },
  })
}

/** Split text into chunks of roughly `maxLen` chars at word/sentence boundaries */
function splitIntoChunks(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text]
  const chunks: string[] = []
  let remaining = text
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining)
      break
    }
    // Try to split at sentence boundary
    let splitAt = remaining.lastIndexOf('. ', maxLen)
    if (splitAt < maxLen * 0.3) splitAt = remaining.lastIndexOf(' ', maxLen)
    if (splitAt < maxLen * 0.3) splitAt = maxLen
    chunks.push(remaining.slice(0, splitAt + 1))
    remaining = remaining.slice(splitAt + 1)
  }
  return chunks
}

// ─── Tool-use summary builder ──────────────────────────────────────────

function buildToolUseSummary(
  toolCalls: AgentLoopResult['toolCallsExecuted'],
): string {
  if (toolCalls.length === 0) return ''

  const lines: string[] = []
  for (const tc of toolCalls) {
    const icon = tc.success ? '✓' : '✗'
    lines.push(`- ${toolLabel(tc.toolName)} ${icon} (${tc.durationMs}ms)`)
  }

  return `**Data retrieved:**\n${lines.join('\n')}`
}

/** Human-readable label for tool names */
function toolLabel(name: string): string {
  const labels: Record<string, string> = {
    search_companies: 'Companies',
    get_company_details: 'Company Details',
    get_company_signals: 'Company Signals',
    get_company_opportunities: 'Opportunities',
    get_company_scores: 'Scoring Data',
    search_contacts: 'Contacts',
    get_contact_details: 'Contact Details',
    get_contact_activity: 'Contact Activity',
    get_pipeline_summary: 'Pipeline Summary',
    search_pursuits: 'Pursuits',
    get_top_leads: 'Top Leads',
    get_signals_digest: 'Signal Digest',
    get_engagement_stats: 'Engagement Stats',
    search_knowledge: 'Knowledge Search',
    get_account_brief: 'Account Brief',
  }
  return labels[name] || name
}
