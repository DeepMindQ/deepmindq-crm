import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiSuccess, validateBody } from '@/lib/apiHelpers';
import { callLLM, webSearch as webSearchHelper } from '@/lib/zai-helpers';
import type { WebSearchResult as WebSearchResultType } from '@/lib/zai-helpers';
import {
  getResearchContext,
  buildResearchContextText,
} from '@/lib/intelligence-contract';
import {
  runGovernanceChecks,
  recordGeneration,
  HALLUCINATION_PREVENTION_RULES,
  buildGovernancePromptAddon,
  buildEvidenceGroundingNote,
} from '@/lib/ai-governance';
import type { ResearchContext } from '@/lib/intelligence-contract';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const conversationPlanSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  executiveRole: z.string().min(1, 'Executive role is required'),
  executiveName: z.string().optional(),
  industry: z.string().optional().default(''),
  context: z.string().optional().default(''),
  yourCapabilities: z.string().optional(),
  companyId: z.string().optional(),
});

type ConversationPlanInput = z.infer<typeof conversationPlanSchema>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConversationPlan {
  executiveProfile: {
    likelyPriorities: string[];
    communicationStyle: string;
    decisionMakingStyle: string;
  };
  conversationPlan: {
    suggestedOpening: string;
    keyTopics: string[];
    topicsToAvoid: string[];
    valueProposition: string;
    questionsToAsk: string[];
    successSignals: string[];
    nextSteps: string;
  };
  approachRecommendation: {
    method: string;
    reasoning: string;
    confidence: number;
    timing: string;
  };
  aiReasoning: string;
}

// ---------------------------------------------------------------------------
// JSON parsing with regex fallback
// ---------------------------------------------------------------------------

function parseConversationPlan(raw: string): ConversationPlan | null {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed.executiveProfile && parsed.conversationPlan) {
      return parsed as ConversationPlan;
    }
  } catch {
    // fall through to regex
  }

  // Regex fallback: try to extract the full JSON object
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.executiveProfile && parsed.conversationPlan) {
        return parsed as ConversationPlan;
      }
    } catch {
      // give up
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert executive engagement strategist specializing in enterprise B2B consulting and technology services. Generate a conversation plan for approaching a specific executive at a specific company.

${HALLUCINATION_PREVENTION_RULES}

Return ONLY valid JSON (no markdown fences) with this structure:
{
  "executiveProfile": {
    "likelyPriorities": ["3-4 things this executive likely cares about"],
    "communicationStyle": "Formal/Direct/Relationship-driven/Technical",
    "decisionMakingStyle": "Data-driven/Consensus/Authority-based"
  },
  "conversationPlan": {
    "suggestedOpening": "Specific, personalized opening line (2-3 sentences)",
    "keyTopics": ["3-4 topics to discuss in order"],
    "topicsToAvoid": ["1-2 topics to stay away from"],
    "valueProposition": "How to frame your value in their language",
    "questionsToAsk": ["3-4 insightful questions to understand their needs"],
    "successSignals": ["signs the conversation is going well"],
    "nextSteps": "What to propose at the end of the conversation"
  },
  "approachRecommendation": {
    "method": "Direct/Warm Introduction/Event-based/Referral/Content-led",
    "reasoning": "Why this approach is recommended",
    "confidence": 82,
    "timing": "Best time to reach out"
  },
  "aiReasoning": "Brief explanation of why this plan was generated"
}`;

// ---------------------------------------------------------------------------
// Evidence URL extraction helpers
// ---------------------------------------------------------------------------

/**
 * Collect all evidence URLs from a ResearchContext for the sources array.
 */
function extractEvidenceUrls(ctx: ResearchContext): string[] {
  const urls: Set<string> = new Set();

  // From signals
  for (const signal of ctx.signals) {
    if (signal.sourceUrl) urls.add(signal.sourceUrl);
  }

  // From recent news
  for (const news of ctx.recentNews) {
    if (news.url) urls.add(news.url);
  }

  // From social profiles
  if (ctx.researchCard?.socialProfiles) {
    for (const profileUrl of Object.values(ctx.researchCard.socialProfiles)) {
      if (profileUrl) urls.add(profileUrl);
    }
  }

  // Website itself
  if (ctx.researchCard?.website) {
    urls.add(ctx.researchCard.website);
  } else if (ctx.website) {
    urls.add(ctx.website);
  }

  return Array.from(urls).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Main generation logic — Phase 3 intelligence path
// ---------------------------------------------------------------------------

async function generateConversationPlanPhase3(
  input: ConversationPlanInput,
  researchCtx: ResearchContext,
): Promise<{ plan: ConversationPlan; sources: string[] }> {
  const {
    companyName,
    executiveRole,
    executiveName,
    industry,
    context,
    yourCapabilities,
    companyId,
  } = input;

  const capabilities = yourCapabilities || 'AI Automation, Data Analytics, Cloud Modernization, Digital Transformation';
  const execLabel = executiveName
    ? `${executiveName}, ${executiveRole} at ${companyName}`
    : `${executiveRole} at ${companyName}`;

  // Run governance checks
  const governanceResult = await runGovernanceChecks({
    companyId,
    generationType: 'conversation_plan',
    researchContext: researchCtx,
  });

  if (!governanceResult.canProceed) {
    // Record the rejection in the audit trail before returning
    await recordGeneration({
      generationType: 'conversation_plan',
      companyId,
      researchContext: researchCtx,
      signalIds: researchCtx.signals.map((s) => s.id),
      governanceResult,
      inputParams: input as unknown as Record<string, unknown>,
    });

    throw new Error(
      `Governance check failed: ${governanceResult.rejectionReason}`,
    );
  }

  // Build intelligence text and governance context for the prompt
  const intelligenceText = buildResearchContextText(researchCtx);
  const groundingNote = buildEvidenceGroundingNote(researchCtx);
  const governanceAddon = buildGovernancePromptAddon(governanceResult);

  const userPrompt = `Generate a conversation plan for engaging with ${execLabel}.

── TARGET INFO ──
Company: ${companyName}
Industry: ${industry || researchCtx.industry || 'Not specified'}
Executive Role: ${executiveRole}
${executiveName ? `Executive Name: ${executiveName}` : '(Executive name not provided — keep the plan role-focused)'}

Additional Context: ${context || 'None provided'}

── YOUR CAPABILITIES ──
${capabilities}

── COMPANY INTELLIGENCE ──
${intelligenceText}

${groundingNote}
${governanceAddon}
Generate a highly specific, actionable conversation plan. Ground every claim in the intelligence provided above. Reference real developments, signals, and data points when available.`;

  // Call LLM
  const raw = await callLLM(SYSTEM_PROMPT, userPrompt);
  const plan = parseConversationPlan(raw);

  if (!plan) {
    throw new Error('Failed to parse AI response into a valid conversation plan');
  }

  // Extract evidence URLs for the sources array
  const sources = extractEvidenceUrls(researchCtx);

  // Record the successful generation in the audit trail
  await recordGeneration({
    generationType: 'conversation_plan',
    companyId,
    researchContext: researchCtx,
    signalIds: researchCtx.signals.map((s) => s.id),
    governanceResult,
    outputSummary: `Conversation plan for ${execLabel}. Method: ${plan.approachRecommendation.method}. Confidence: ${plan.approachRecommendation.confidence}%.`,
    inputParams: input as unknown as Record<string, unknown>,
  });

  return { plan, sources };
}

// ---------------------------------------------------------------------------
// Main generation logic — fallback web search path
// ---------------------------------------------------------------------------

async function generateConversationPlanFallback(
  input: ConversationPlanInput,
): Promise<{ plan: ConversationPlan; sources: string[] }> {
  const {
    companyName,
    executiveRole,
    executiveName,
    industry,
    context,
    yourCapabilities,
  } = input;

  const capabilities = yourCapabilities || 'AI Automation, Data Analytics, Cloud Modernization, Digital Transformation';
  const execLabel = executiveName
    ? `${executiveName}, ${executiveRole} at ${companyName}`
    : `${executiveRole} at ${companyName}`;

  // Step 1: Web search for real context (fallback path)
  const searchQuery = `${companyName} ${executiveRole} strategy priorities 2025`;
  const searchResults = (await webSearchHelper(searchQuery)) as WebSearchResultType[];
  const sources = searchResults.map((r) => r.url).filter(Boolean);

  // Step 2: Build user prompt with search context
  const webContext =
    searchResults.length > 0
      ? searchResults
          .map(
            (r, i) =>
              `${i + 1}. ${r.title}\n   ${r.snippet}\n   URL: ${r.url}`,
          )
          .join('\n\n')
      : 'No web results found for this company.';

  const userPrompt = `Generate a conversation plan for engaging with ${execLabel}.

── TARGET INFO ──
Company: ${companyName}
Industry: ${industry || 'Not specified'}
Executive Role: ${executiveRole}
${executiveName ? `Executive Name: ${executiveName}` : '(Executive name not provided — keep the plan role-focused)'}

Additional Context: ${context || 'None provided'}

── YOUR CAPABILITIES ──
${capabilities}

── LIVE WEB RESEARCH (fallback — no companyId linked) ──
${webContext}

Generate a highly specific, actionable conversation plan. Use the web research to make the plan current and relevant. Reference real developments when available.`;

  // Step 3: Call LLM
  const raw = await callLLM(SYSTEM_PROMPT, userPrompt);
  const plan = parseConversationPlan(raw);

  if (!plan) {
    throw new Error('Failed to parse AI response into a valid conversation plan');
  }

  return { plan, sources };
}

// ---------------------------------------------------------------------------
// POST /api/ai/conversation-plan
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = validateBody(conversationPlanSchema, body);
    if (parsed instanceof Response) return parsed;

    const intelligenceSource = parsed.companyId ? 'phase3' as const : 'fallback_web' as const;

    let result: { plan: ConversationPlan; sources: string[] };

    if (parsed.companyId) {
      // ── Phase 3 Intelligence Path ──
      let researchCtx: ResearchContext;
      try {
        researchCtx = await getResearchContext(parsed.companyId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error('[conversation-plan] Failed to load research context:', msg);
        return apiError(
          `Could not load company intelligence for companyId "${parsed.companyId}": ${msg}. Ensure the company exists and has been researched.`,
          422,
        );
      }

      result = await generateConversationPlanPhase3(parsed, researchCtx);
    } else {
      // ── Fallback Web Search Path ──
      result = await generateConversationPlanFallback(parsed);
    }

    return apiSuccess({
      plan: result.plan,
      sources: result.sources,
      intelligenceSource,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to generate conversation plan';
    console.error('[conversation-plan] Error:', message);

    // Graceful fallback: return a generic but useful plan
    return apiError(message, 500);
  }
}