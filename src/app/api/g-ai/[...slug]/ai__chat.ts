import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiError, apiSuccess } from '@/lib/apiHelpers'

// ---------------------------------------------------------------------------
// LLM helper — uses z-ai-web-dev-sdk (auth handled internally)
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

async function callAI(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
  const { ensureZaiConfig } = await import('@/lib/zai-config');
  await ensureZaiConfig();
  const ZAI = await import('z-ai-web-dev-sdk').then(m => m.default).then(Z => Z.create())
  const completion = await ZAI.chat.completions.create({
    messages: [
      { role: 'assistant', content: systemPrompt },
      ...messages,
    ],
    thinking: { type: 'disabled' },
  })
  return completion.choices?.[0]?.message?.content ?? ''
}

// ---------------------------------------------------------------------------
// Context builder — fetches entity data when context IDs are provided
// ---------------------------------------------------------------------------

async function buildContextString(context: {
  companyId?: string
  contactId?: string
  opportunityId?: string
}): Promise<{ contextStr: string; sources: string[] }> {
  const parts: string[] = []
  const sources: string[] = []

  if (context.companyId) {
    const company = await db.company.findUnique({
      where: { id: context.companyId },
      include: {
        contacts: { where: { archivedAt: null }, take: 5, orderBy: { createdAt: 'desc' } },
        researchCard: true,
        opportunities: { take: 3, orderBy: { updatedAt: 'desc' } },
      },
    })
    if (company) {
      sources.push(`Company: ${company.name}`)
      const contactList =
        company.contacts.length > 0
          ? company.contacts.map((c) => `  - ${c.name} (${c.jobTitle || 'Unknown'}, ${c.email || 'no email'}, status: ${c.status})`).join('\n')
          : '  - No contacts added yet.'
      parts.push(
        `## Company: ${company.name}\n` +
          `- Industry: ${company.industry || 'Unknown'}\n` +
          `- Domain: ${company.domain || 'Unknown'}\n` +
          `- Website: ${company.website || 'Unknown'}\n` +
          `- Employees: ${company.employeeSize || 'Unknown'}\n` +
          `- Country: ${company.country || 'Unknown'}\n` +
          `- Location: ${company.location || 'Unknown'}\n` +
          `- Status: ${company.status}\n` +
          `- Intelligence Score: ${company.intelligenceScore ?? 'N/A'}/100\n` +
          `- Data Freshness: ${company.dataFreshness || 'Unknown'}\n\n` +
          `### Contacts:\n${contactList}`,
      )
      if (company.researchCard) {
        parts.push(
          `### Research Summary:\n` +
            `- Overview: ${company.researchCard.businessOverview || 'N/A'}\n` +
            `- Tech Landscape: ${company.researchCard.currentTechLandscape || 'N/A'}\n` +
            `- Challenges: ${company.researchCard.potentialChallenges || 'N/A'}\n` +
            `- Opportunities: ${company.researchCard.possibleOpportunities || 'N/A'}\n` +
            `- Next Action: ${company.researchCard.nextAction || 'N/A'}`,
        )
      }
      if (company.opportunities.length > 0) {
        parts.push(
          `### Opportunities:\n` +
            company.opportunities
              .map((o) => `  - "${o.title}" (${o.status}) — Next: ${o.nextAction || 'N/A'}`)
              .join('\n'),
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
      sources.push(`Contact: ${contact.name}`)
      parts.push(
        `## Contact: ${contact.name}\n` +
          `- Company: ${contact.company?.name || 'Unknown'}\n` +
          `- Job Title: ${contact.jobTitle || 'Unknown'}\n` +
          `- Role Bucket: ${contact.roleBucket || 'Unknown'}\n` +
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
              .map((d) => `  - "${d.subject}" (${d.status}, match: ${d.matchScore ?? 'N/A'})`)
              .join('\n'),
        )
      }
    }
  }

  if (context.opportunityId) {
    const opp = await db.opportunity.findUnique({
      where: { id: context.opportunityId },
      include: { company: true, targetContact: true },
    })
    if (opp) {
      sources.push(`Opportunity: ${opp.title}`)
      parts.push(
        `## Opportunity: ${opp.title}\n` +
          `- Company: ${opp.company?.name || 'Unknown'}\n` +
          `- Status: ${opp.status}\n` +
          `- Target Contact: ${opp.targetContact?.name || 'None assigned'}\n` +
          `- Description: ${opp.description || 'N/A'}\n` +
          `- Next Action: ${opp.nextAction || 'N/A'}`,
      )
    }
  }

  return { contextStr: parts.join('\n\n'), sources }
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
    if (context && (context.companyId || context.contactId || context.opportunityId)) {
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

    // 3. Build messages array
    const messages: ChatMessage[] = [...(conversationHistory || []), { role: 'user', content: message }]

    // 4. Try LLM call
    try {
      const response = await callAI(systemPrompt, messages)

      if (response) {
        return apiSuccess({ message: response, sources: sources.length > 0 ? sources : undefined })
      }
    } catch (llmErr: unknown) {
      const msg = llmErr instanceof Error ? llmErr.message : String(llmErr)
      console.error('[ai/chat] LLM call failed:', msg)
      // Fall through to template
    }

    // 5. Fallback to template response
    const fallbackMessage = generateTemplateResponse(message)
    return apiSuccess({ message: fallbackMessage })
  } catch {
    return apiError('Failed to process chat message')
  }
}