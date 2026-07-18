import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiError, apiSuccess } from '@/lib/apiHelpers'
// ── GOVERNANCE ENFORCEMENT ──
// This route MUST go through the governance layer.
// Direct access to callLLM / callChatLLM is FORBIDDEN.
import { governedAICallAggregate, governedAICall } from '@/lib/ai-governance'
import type { ResearchContext } from '@/lib/intelligence-contract'

// ---------------------------------------------------------------------------
// GOVERNANCE ARCHITECTURE NOTE
// ---------------------------------------------------------------------------
// All AI generation in this application must flow through the governance layer
// (ai-governance.ts). The governance layer provides:
//   - Hallucination prevention rules injection
//   - Audit logging in AIGenerationAudit
//   - Evidence grounding and traceability
//
// No route, module, or future engine may directly access LLM primitives
// (callLLM, callChatLLM, or any third-party AI SDK).
// A build-time guard (scripts/check-governance.sh) enforces this.
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// ---------------------------------------------------------------------------
// Context builder — fetches entity data when context IDs are provided
// ---------------------------------------------------------------------------

async function buildContextString(context: {
  companyId?: string
  contactId?: string
}): Promise<{ contextStr: string; sources: string[] }> {
  const parts: string[] = []
  const sources: string[] = []

  if (context.companyId) {
    const company = await db.company.findUnique({
      where: { id: context.companyId },
      include: {
        contacts: { where: { status: { not: 'archived' } }, take: 5, orderBy: { createdAt: 'desc' } },
        researchCard: true,
      },
    })
    if (company) {
      sources.push(`Company: ${company.rawName}`)
      const contactList =
        company.contacts.length > 0
          ? company.contacts.map((c) => `  - ${c.rawName} (${c.title || 'Unknown'}, ${c.email || 'no email'}, status: ${c.status})`).join('\n')
          : '  - No contacts added yet.'
      parts.push(
        `## Company: ${company.rawName}\n` +
          `- Industry: ${company.industry || 'Unknown'}\n` +
          `- Domain: ${company.domain || 'Unknown'}\n` +
          `- Website: ${company.website || 'Unknown'}\n` +
          `- Employees: ${company.sizeRange || 'Unknown'}\n` +
          `- Country: ${company.country || 'Unknown'}\n` +
          `- Location: ${company.location || 'Unknown'}\n` +
          `- Status: ${company.status}\n` +
          `- Intelligence Score: ${company.intelligenceScore ?? 'N/A'}/100\n\n` +
          `### Contacts:\n${contactList}`,
      )
      if (company.researchCard) {
        parts.push(
          `### Research Summary:\n` +
            `- Overview: ${company.researchCard.businessOverview || 'N/A'}\n` +
            `- Tech Landscape: ${(company.researchCard as any).techLandscape || (company.researchCard as any).currentTechLandscape || 'N/A'}\n` +
            `- Challenges: ${company.researchCard.potentialChallenges || 'N/A'}\n` +
            `- Opportunities: ${company.researchCard.possibleOpportunities || 'N/A'}\n` +
            `- Next Action: ${(company.researchCard as any).nextAction || 'N/A'}`,
        )
      }

    }
  }

  if (context.contactId) {
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
          `- Role: ${contact.role || 'Unknown'}\n` +
          `- Email: ${contact.email || 'Unknown'}\n` +
          `- Email Health: ${contact.emailHealth}\n` +
          `- Status: ${contact.status}\n` +
          `- Last Contacted: ${contact.lastContactedAt ? new Date(contact.lastContactedAt).toLocaleDateString() : 'Never'}\n` +
          `- LinkedIn: ${contact.linkedinUrl || 'N/A'}`,
      )
      if (contact.drafts.length > 0) {
        parts.push(
          `### Recent Drafts:\n` +
            contact.drafts
              .map((d) => `  - "${d.subject}" (${d.status}, match: ${(d as any).matchScore ?? d.confidenceScore ?? 'N/A'})`)
              .join('\n'),
        )
      }
    }
  }

  return { contextStr: parts.join('\n\n'), sources }
}

/**
 * Load research context for governance when companyId is present.
 * Returns null if no research card exists (governance will flag this).
 */
async function loadResearchContext(companyId: string): Promise<ResearchContext | null> {
  try {
    const company = await db.company.findUnique({
      where: { id: companyId },
      include: {
        researchCard: true,
        evidences: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        signals: {
          where: { lifecycleStatus: { in: ['detected', 'validated', 'active'] } },
          orderBy: { detectedAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!company?.researchCard) return null;

    // Count active capability matches
    const capabilityMatchCount = await db.signalCapabilityMatch.count({
      where: { companyId, matchScore: { gte: 0.4 } },
    });

    return {
      company: {
        rawName: company.rawName,
        domain: company.domain,
        industry: company.industry,
        website: company.website,
        sizeRange: company.sizeRange,
        country: company.country,
        location: company.location,
        intelligenceScore: company.intelligenceScore,
      },
      researchCard: company.researchCard,
      evidences: company.evidences,
      signals: company.signals,
      capabilityMatchCount,
    } as unknown as ResearchContext;
  } catch (err) {
    console.error('[ai/chat] Failed to load research context:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Template fallback responses
// ---------------------------------------------------------------------------

function generateTemplateResponse(message: string): string {
  const lower = message.toLowerCase()

  if (lower.includes('hot') && (lower.includes('lead') || lower.includes('company'))) {
    return "To find your hottest leads, I'd recommend sorting your companies by intelligence score in descending order and filtering for 'Active' status. Navigate to the Companies page and use the saved view 'Active Accounts' sorted by intelligence score. You can also look for companies with research cards that have high confidence scores."
  }

  if (lower.includes('follow-up') || lower.includes('follow up')) {
    return "For contacts needing follow-up, check your Contacts page and sort by 'Last Contacted' date. Look for contacts with status 'Active' that haven't been contacted recently. You can also check the email generation screen for contacts with drafts that haven't been sent yet."
  }

  if (lower.includes('summar') && (lower.includes('activity') || lower.includes('recent'))) {
    return "For a summary of recent activity, check your Dashboard — it shows recent timeline entries, quick stats, and activity across companies, contacts, and opportunities. The notification bell in the header also shows the latest events."
  }

  if (lower.includes('technology') || lower.includes('tech')) {
    return "To view companies in the Technology industry, go to the Companies page and use the Industry filter to select 'Technology'. You can save this as a custom view for quick access later. Consider generating research cards for the most promising ones."
  }

  if (lower.includes('email') && (lower.includes('generat') || lower.includes('write') || lower.includes('draft'))) {
    return "To generate emails, navigate to the Email Generation screen. Select a contact, choose your preferred tone and CTA style, then generate. Make sure your AI provider and API key are configured in Settings for AI-powered generation — otherwise, template-based emails will be used."
  }

  if (lower.includes('research') || lower.includes('intelligence')) {
    return "To generate company research, go to a Company's profile page and click 'Generate Research'. This uses AI (if configured in Settings) to analyze the company and produce a research card with business overview, tech landscape, challenges, and opportunities. Companies with higher intelligence scores have more complete data."
  }

  if (lower.includes('opportunity') || lower.includes('deal') || lower.includes('pipeline')) {
    return "Track your opportunities on the Opportunities page. You can filter by status (Researching, Qualified, Proposal, Negotiation, Won, Lost). Each opportunity is linked to a company and optionally a target contact. Use the pipeline view to see where deals are in your sales process."
  }

  return "I'm your DeepMindQ AI Assistant. I can help you with:\n\n" +
    "• **Companies** — Find leads, analyze industries, understand research cards\n" +
    "• **Contacts** — Identify decision makers, check email health, plan follow-ups\n" +
    "• **Opportunities** — Track deals, review pipeline status\n" +
    "• **Email** — Generate personalized outreach emails\n" +
    "• **Research** — Generate AI-powered company intelligence\n\n" +
    "Tip: Configure your AI provider and API key in **Settings** for intelligent, contextual responses. Without AI configured, I provide guided help based on your question.\n\n" +
    "Try asking me something specific about your CRM data!"
}

// ---------------------------------------------------------------------------
// POST /api/ai/chat
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, context, conversationHistory } = body

    if (!message || typeof message !== 'string') {
      return apiError('Message is required', 400)
    }

    // 1. Build context string if context IDs provided
    let contextStr = ''
    let sources: string[] = []
    if (context && (context.companyId || context.contactId)) {
      const ctx = await buildContextString(context)
      contextStr = ctx.contextStr
      sources = ctx.sources
    }

    // 2. Build system prompt
    const systemPrompt = `You are DeepMindQ AI Assistant, an intelligent sales CRM assistant.
You have access to the user's CRM data including companies, contacts, opportunities, and research.

Be helpful, concise, and actionable. Suggest next steps when relevant. Use markdown formatting for readability when appropriate (bold, lists, etc.).

When referencing specific data points, be precise. When you don't have enough information, say so clearly and suggest how the user can find it.

${
  contextStr
    ? `The user is currently viewing the following CRM context. Use this information to provide relevant, contextual answers:\n\n${contextStr}`
    : 'No specific CRM context is currently active. Answer based on the user\'s general question about their sales CRM data and workflows.'
}`

    // 3. Serialize multi-turn conversation into user prompt for governance layer.
    //    The governance layer uses single-prompt (system + user), so we flatten
    //    the conversation history into the user prompt with clear turn markers.
    const historyBlock = (conversationHistory || [])
      .filter((m: ChatMessage) => m.role === 'user' || m.role === 'assistant')
      .map((m: ChatMessage) => `[${m.role.toUpperCase()}]: ${m.content}`)
      .join('\n\n')

    const userPrompt = historyBlock
      ? `## Previous Conversation\n${historyBlock}\n\n## Current User Message\n${message}`
      : message

    // 4. Call through GOVERNANCE LAYER
    //    - Company context: use governedAICall (full confidence/freshness/capability checks)
    //    - No company context: use governedAICallAggregate (advisory governance, no blocking)
    try {
      let result;

      if (context?.companyId) {
        // Company-specific chat: full governance with confidence gates
        const researchContext = await loadResearchContext(context.companyId);
        result = await governedAICall({
          generationType: 'chat',
          companyId: context.companyId,
          contactId: context.contactId,
          researchContext,
          systemPrompt,
          userPrompt,
          enforceGovernance: false, // Chat is advisory, never block the user
          inputParams: {
            hasCompanyContext: true,
            hasContactContext: !!context?.contactId,
            conversationTurns: (conversationHistory || []).length,
            messageLength: message.length,
            researchConfidence: researchContext?.researchCard?.averageConfidence ?? null,
            freshnessScore: researchContext?.researchCard?.freshnessScore ?? null,
          },
        });
      } else {
        // General chat: aggregate governance (no company-specific checks)
        result = await governedAICallAggregate({
          generationType: 'chat',
          systemPrompt,
          userPrompt,
          inputParams: {
            hasCompanyContext: false,
            hasContactContext: !!context?.contactId,
            conversationTurns: (conversationHistory || []).length,
            messageLength: message.length,
          },
        });
      }

      if (result.success && result.response) {
        // If company context existed, include governance metadata in response
        const response: Record<string, unknown> = {
          message: result.response,
          sources: sources.length > 0 ? sources : undefined,
        };

        // Add governance quality indicators when company context is active
        if (context?.companyId && result.governanceResult) {
          const checks = result.governanceResult.checks;
          response.governance = {
            passed: result.governanceResult.passed,
            confidence: checks?.confidence?.value ?? null,
            freshness: checks?.freshness?.value ?? null,
            stalenessWarning: checks?.freshness?.passed === false,
            capabilityMatches: checks?.capabilityMatch?.value ?? null,
          };
        }

        return apiSuccess(response);
      }

      // Governance blocked or LLM failed — fall through to template
      console.warn('[ai/chat] Governance result:', result.governanceResult?.overallMessage, result.rejectionReason)
    } catch (llmErr: unknown) {
      const msg = llmErr instanceof Error ? llmErr.message : String(llmErr)
      console.error('[ai/chat] Governance call failed:', msg)
      // Fall through to template
    }

    // 5. Fallback to template response
    const fallbackMessage = generateTemplateResponse(message)
    return apiSuccess({ message: fallbackMessage })
  } catch {
    return apiError('Failed to process chat message')
  }
}