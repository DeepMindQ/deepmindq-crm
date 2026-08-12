import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { checkApiAuth } from '@/lib/api-auth'
import { logger } from '@/lib/logger'
import { withApiLogging } from '@/lib/api-logging-middleware'
import { agentLoopWithTools, agentLoopZaiFallback, TOOL_USE_SYSTEM_ADDON } from '@/lib/ai-agent-loop'
import { getToolDefinitions } from '@/lib/ai-tool-definitions'
import { governedStreamAICall } from '@/lib/ai-governance'

// ─── Types ──────────────────────────────────────────────────────────────

interface ChatStreamMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatStreamRequest {
  messages: ChatStreamMessage[]
  context?: {
    companyId?: string
    contactId?: string
    opportunityId?: string
  }
  model?: string
  temperature?: number
  maxTokens?: number
  /** Enable tool-use (default: true). Set false to use legacy non-tool streaming. */
  enableTools?: boolean
}

// ─── System Prompt — much improved, CRM-specific ────────────────────────

const CRM_SYSTEM_PROMPT = `You are DeepMindQ AI Assistant — an intelligent revenue CRM copilot.

Your job is to help sales and intelligence teams make data-driven decisions. You have access to real-time CRM data through tools.

## Core Capabilities:
1. **Lead Intelligence** — Find top leads by score, identify hot prospects, analyze who needs follow-up
2. **Company Analysis** — Deep-dive into any company's signals, scores, opportunities, and intelligence
3. **Pipeline Management** — Track pursuits, summarize pipeline health, identify at-risk deals
4. **Signal Detection** — Surface buying signals, tech triggers, funding events, leadership changes
5. **Engagement Analytics** — Track email opens, clicks, replies, and engagement trends
6. **Knowledge Retrieval** — Search the knowledge base for research, insights, and briefings

## Response Style:
- Be **direct and data-driven** — lead with numbers and specific findings
- Use **bullet points** for lists of items (companies, contacts, signals)
- Use **bold** for key metrics: scores, names, dates, amounts
- Always **suggest next steps** when you have data
- When you find interesting patterns, **highlight them proactively**
- Be concise — users want insights, not walls of text
- If the user asks something you can answer with tools, ALWAYS use the tools first

## Example Responses:
User: "What are my hottest leads?"
→ Use get_top_leads tool → present ranked list with scores, companies, and suggested actions

User: "Tell me about Acme Corp"
→ Use get_company_details → present company overview, signals, contacts, scores

User: "Any recent buying signals?"
→ Use get_signals_digest → present signals ranked by severity with recommended actions`

// ─── Context builder — fetches entity data when context IDs are provided ──

async function buildContextString(context: {
  companyId?: string
  contactId?: string
  opportunityId?: string
}): Promise<{ contextStr: string; sources: string[] }> {
  const parts: string[] = []
  const sources: string[] = []

  if (context.companyId) {
    try {
      const company = await db.company.findUnique({
        where: { id: context.companyId },
        include: {
          contacts: { take: 5, orderBy: { leadScore: 'desc' } },
          researchCard: true,
          timeline: { take: 3, orderBy: { createdAt: 'desc' } },
          signals: { take: 5, orderBy: { extractedAt: 'desc' } },
        },
      })
      if (company) {
        sources.push(`Company: ${company.rawName}`)
        const contactList =
          company.contacts.length > 0
            ? company.contacts.map((c) => `- ${c.rawName} (${c.title || 'Unknown'}, ${c.email || 'no email'}, lead score: ${c.leadScore ?? 'N/A'})`).join('\n')
            : '  - No contacts added yet.'
        parts.push(
          `## Company: ${company.rawName}\n` +
            `- Industry: ${company.industry || 'Unknown'}\n` +
            `- Domain: ${company.domain || 'Unknown'}\n` +
            `- Website: ${company.website || 'Unknown'}\n` +
            `- Size: ${company.sizeRange || 'Unknown'}\n` +
            `- Country: ${company.country || 'Unknown'}\n` +
            `- Location: ${company.location || 'Unknown'}\n` +
            `- Status: ${company.status}\n` +
            `- Intelligence Score: ${company.intelligenceScore ?? 'N/A'}/100\n` +
            `- Priority: ${company.priorityTier || 'N/A'}\n` +
            `- Engagement Score: ${company.engagementScore ?? 'N/A'}/100\n\n` +
            `### Top Contacts:\n${contactList}`,
        )
        if (company.researchCard) {
          parts.push(
            `### Research Summary:\n` +
              `- Overview: ${company.researchCard.businessOverview || 'N/A'}\n` +
              `- Tech Landscape: ${company.researchCard.techLandscape || 'N/A'}\n` +
              `- Challenges: ${company.researchCard.potentialChallenges || 'N/A'}\n` +
              `- Opportunities: ${company.researchCard.possibleOpportunities || 'N/A'}`,
          )
        }
        if (company.signals.length > 0) {
          parts.push(
            `### Active Signals:\n` +
              company.signals
                .map((s) => `- [${s.severity?.toUpperCase() || 'N/A'}] ${s.signalType}: ${s.description || 'No description'} (detected ${s.extractedAt ? new Date(s.extractedAt).toLocaleDateString() : 'N/A'})`)
                .join('\n'),
          )
        }
        if (company.timeline.length > 0) {
          parts.push(
            `### Recent Activity:\n` +
              company.timeline
                .map((t) => `- ${t.eventType || 'Event'} on ${t.createdAt ? new Date(t.createdAt).toLocaleDateString() : 'N/A'}`)
                .join('\n'),
          )
        }
      }
    } catch (err) {
      logger.warn('[chat-stream] Failed to load company context:', { error: err instanceof Error ? err.message : err })
    }
  }

  if (context.contactId) {
    try {
      const contact = await db.contact.findUnique({
        where: { id: context.contactId },
        include: { company: true, drafts: { take: 3, orderBy: { createdAt: 'desc' } } },
      })
      if (contact) {
        sources.push(`Contact: ${contact.rawName}`)
        parts.push(
          `## Contact: ${contact.rawName}\n` +
            `- Company: ${contact.company?.rawName || 'Unknown'}\n` +
            `- Job Title: ${contact.title || 'Unknown'}\n` +
            `- Email: ${contact.email || 'Unknown'}\n` +
            `- Email Health: ${contact.emailHealth}\n` +
            `- Status: ${contact.status}\n` +
            `- Lead Score: ${contact.leadScore ?? 'N/A'}/100\n` +
            `- Last Contacted: ${contact.lastContactedAt ? new Date(contact.lastContactedAt).toLocaleDateString() : 'Never'}\n` +
            `- LinkedIn: ${contact.linkedinUrl || 'N/A'}`,
        )
        if (contact.drafts.length > 0) {
          parts.push(
            `### Recent Drafts:\n` +
              contact.drafts.map((d) => `- "${d.subject}" (${d.status})`).join('\n'),
          )
        }
      }
    } catch (err) {
      logger.warn('[chat-stream] Failed to load contact context:', { error: err instanceof Error ? err.message : err })
    }
  }

  if (context.opportunityId) {
    try {
      const opp = await db.pursuit.findUnique({
        where: { id: context.opportunityId },
        include: { company: true, opportunity: true },
      })
      if (opp) {
        sources.push(`Opportunity: ${opp.opportunity?.opportunityTitle || opp.status}`)
        parts.push(
          `## Opportunity: ${opp.opportunity?.opportunityTitle || opp.status}\n` +
            `- Company: ${opp.company?.rawName || 'Unknown'}\n` +
            `- Status: ${opp.status}\n` +
            `- Priority: ${opp.priority || 'N/A'}\n` +
            `- Next Action: ${opp.nextAction || 'N/A'}\n` +
            `- Owner: ${opp.owner || 'Unassigned'}`,
        )
      }
    } catch (err) {
      logger.warn('[chat-stream] Failed to load opportunity context:', { error: err instanceof Error ? err.message : err })
    }
  }

  return { contextStr: parts.join('\n\n'), sources }
}

// ─── POST /api/ai/chat-stream ───────────────────────────────────────────

async function postHandler(request: NextRequest) {
  // ── Authentication Guard ──
  const { errorResponse, session } = await checkApiAuth(request)
  if (errorResponse) return errorResponse

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
  const { messages, context, temperature, maxTokens, enableTools = true } = body

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

  // ── Build system prompt ──
  const userSystemMessage = messages.find((m) => m.role === 'system')
  let systemPrompt = userSystemMessage?.content || CRM_SYSTEM_PROMPT

  // ── Build context from CRM data if context IDs are provided ──
  let sources: string[] = []
  if (context && (context.companyId || context.contactId || context.opportunityId)) {
    const ctx = await buildContextString(context)
    if (ctx.contextStr) {
      systemPrompt += `\n\n## Current View Context\nThe user is currently viewing this in the CRM. Use this context plus your tools to provide relevant answers:\n\n${ctx.contextStr}`
      sources = ctx.sources
    }
  }

  // ── Extract non-system messages for the conversation ──
  const nonSystemMessages = messages.filter((m) => m.role !== 'system')
  if (nonSystemMessages.length === 0) {
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

  const logCtx = `user=${session?.email ?? 'unknown'}, messages=${messages.length}, tools=${enableTools}, context=${sources.length ? sources.join(', ') : 'none'}`
  logger.info(`[chat-stream] Starting agent loop: ${logCtx}`)

  // ── Decide: Agentic tool-use loop vs. legacy streaming ──
  // Use agent loop when tools are enabled (default) and at least one provider is available
  const useAgentLoop = enableTools

  if (useAgentLoop) {
    // ═══════════════════════════════════════════════════════════════════
    // NEW PATH: Agentic Tool-Use Loop
    //
    // 1. Send messages + CRM tools to LLM
    // 2. LLM decides if it needs to call tools
    // 3. Execute tools → get real CRM data
    // 4. Feed results back to LLM
    // 5. LLM generates final, data-grounded response
    // ═══════════════════════════════════════════════════════════════════
    try {
      const result = await agentLoopWithTools({
        systemPrompt,
        messages: nonSystemMessages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        temperature: temperature ?? 0.7,
        maxTokens: maxTokens ?? 4096,
        timeoutMs: 120_000,
        signal: request.signal,
        maxToolRounds: 5,
        feature: 'chat-stream',
        onToolCall: (toolName, args) => {
          logger.info(`[chat-stream] Tool call: ${toolName}(${JSON.stringify(args).slice(0, 100)})`)
        },
        onToolResult: (toolName, success, summary) => {
          logger.info(`[chat-stream] Tool result: ${toolName} → ${success ? 'OK' : 'FAIL'} — ${summary}`)
        },
      })

      logger.info(
        `[chat-stream] Agent loop completed: ${result.totalRounds} rounds, ${result.toolCallsExecuted.length} tools executed`,
      )

      return new Response(result.stream, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
          'X-Tool-Calls': String(result.toolCallsExecuted.length),
          'X-Agent-Rounds': String(result.totalRounds),
        },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error(`[chat-stream] Agent loop error: ${msg}`)

      // Fall back to legacy streaming on error
      logger.info('[chat-stream] Falling back to legacy streaming')
      return await legacyStreamingCall(systemPrompt, nonSystemMessages, temperature, maxTokens, request)
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // LEGACY PATH: Non-tool streaming (used when enableTools=false)
  // ═══════════════════════════════════════════════════════════════════
  return await legacyStreamingCall(systemPrompt, nonSystemMessages, temperature, maxTokens, request)
}

/**
 * Legacy streaming call — used as fallback when tools are disabled.
 * Preserves backward compatibility with the previous chat-stream implementation.
 */
async function legacyStreamingCall(
  systemPrompt: string,
  nonSystemMessages: ChatStreamMessage[],
  temperature?: number,
  maxTokens?: number,
  request?: NextRequest,
): Promise<Response> {
  // Flatten multi-turn into a single user prompt (legacy behavior)
  const userPrompt = nonSystemMessages
    .map((m) => {
      const role = m.role === 'assistant' ? 'Assistant' : 'User'
      return `${role}: ${m.content}`
    })
    .join('\n\n')

  const governed = await governedStreamAICall({
    generationType: 'chat_stream',
    systemPrompt,
    userPrompt,
    temperature: temperature ?? 0.7,
    maxTokens: maxTokens ?? 4096,
    signal: request?.signal,
    feature: 'chat-stream-legacy',
  })

  if (!governed.governanceResult.canProceed) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Governance check failed',
        reason: governed.governanceResult.rejectionReason,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  return new Response(governed.stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

export const POST = withApiLogging(postHandler, '/api/ai/chat-stream');
