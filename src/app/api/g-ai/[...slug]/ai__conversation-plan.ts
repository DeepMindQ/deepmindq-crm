import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiSuccess, validateBody } from '@/lib/apiHelpers';

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
});

type ConversationPlanInput = z.infer<typeof conversationPlanSchema>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

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
// SDK helpers
// ---------------------------------------------------------------------------

async function createZAI() {
  const { ensureZaiConfig } = await import('@/lib/zai-config');
  await ensureZaiConfig();
  return import('z-ai-web-dev-sdk').then((m) => m.default).then((Z) => Z.create());
}

async function webSearch(query: string): Promise<WebSearchResult[]> {
  try {
    const zai = await createZAI();
    const results = await zai.functions.invoke('web_search', { query, num: 5 });
    return (results || [])
      .slice(0, 5)
      .map((r: Record<string, string>) => ({
        title: r.name || '',
        url: r.url || '',
        snippet: r.snippet || '',
      }));
  } catch (e) {
    console.error('[conversation-plan] Web search failed:', e);
    return [];
  }
}

async function aiChat(systemPrompt: string, userPrompt: string): Promise<string> {
  const zai = await createZAI();
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    thinking: { type: 'disabled' },
  });
  return completion.choices?.[0]?.message?.content ?? '';
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
// Main generation logic
// ---------------------------------------------------------------------------

async function generateConversationPlan(
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

  // Step 1: Web search for real context
  const searchQuery = `${companyName} ${executiveRole} strategy priorities 2025`;
  const searchResults = await webSearch(searchQuery);
  const sources = searchResults.map((r) => r.url).filter(Boolean);

  // Step 2: Build user prompt with search context
  const webContext = searchResults.length > 0
    ? searchResults
        .map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}\n   URL: ${r.url}`)
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

── LIVE WEB RESEARCH ──
${webContext}

Generate a highly specific, actionable conversation plan. Use the web research to make the plan current and relevant. Reference real developments when available.`;

  // Step 3: Call LLM
  const raw = await aiChat(SYSTEM_PROMPT, userPrompt);
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

    const result = await generateConversationPlan(parsed);

    return apiSuccess({
      plan: result.plan,
      sources: result.sources,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate conversation plan';
    console.error('[conversation-plan] Error:', message);

    // Graceful fallback: return a generic but useful plan
    return apiError(message, 500);
  }
}