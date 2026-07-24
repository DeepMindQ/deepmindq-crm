import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiError, apiSuccess } from '@/lib/apiHelpers'

// ---------------------------------------------------------------------------
// Types — VP Sales-Ready Executive Brief
//
// "Would a VP Sales use this before a strategic customer meeting?"
// Every section must be specific, evidence-backed, and actionable.
// ---------------------------------------------------------------------------

interface ExecutiveBriefSection {
  title: string;
  content: string;
  evidence?: string;
  confidence: number; // 0-100
  actionItems?: string[];
}

interface TargetStakeholder {
  role: string;
  focus: string;
  whyApproach: string;
  conversationAngle: string;
  evidence: string;
  priority: 'primary' | 'secondary' | 'tertiary';
}

interface DiscoveryQuestion {
  category: string;
  question: string;
  whyAsk: string;
  idealResponse: string;
}

interface ConversationStarter {
  context: string;
  opening: string;
  evidence: string;
  expectedReaction: string;
}

interface AccountBrief {
  // Executive Summary — 3-4 sentences a VP Sales reads first
  executiveSummary: string;
  executiveSummaryConfidence: number;

  // Current State — What is happening NOW in the company
  currentState: ExecutiveBriefSection;

  // Business Challenges — Evidence-backed problems
  businessChallenges: ExecutiveBriefSection;

  // Technology Challenges — Evidence-backed technical gaps
  technologyChallenges: ExecutiveBriefSection;

  // Strategic Opportunities — Why NOW
  strategicOpportunities: ExecutiveBriefSection;

  // Technology Landscape — Their tech world
  technologyLandscape: {
    techStack: string[];
    cloudProvider: string;
    digitalMaturity: string;
    engineeringSignals: Array<{ signal: string; evidence: string; confidence: number }>;
  };

  // Target Stakeholders — Who to talk to
  targetStakeholders: TargetStakeholder[];

  // Discovery Questions — For the first meeting
  discoveryQuestions: DiscoveryQuestion[];

  // Executive Conversation Starters — High-level openers
  conversationStarters: ConversationStarter[];

  // Recommended Engagement Strategy
  recommendedEngagement: {
    approach: string;
    timeline: string;
    firstMeetingGoal: string;
    successCriteria: string[];
    evidence: string;
  };

  // Strategic Priority & Confidence
  strategicPriority: string;
  keySignals: Array<{ signal: string; evidence: string; confidence: number }>;
  overallConfidence: number;

  // Sources used
  sources: Array<{ title: string; url: string; snippet: string }>;
}

interface CachedBrief {
  companyId: string;
  companyName: string;
  brief: AccountBrief;
  sources: Array<{ title: string; url: string; snippet: string }>;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// In-memory cache with 2-hour TTL
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 2 * 60 * 60 * 1000
const briefCache = new Map<string, { data: CachedBrief; expiresAt: number }>()

// ---------------------------------------------------------------------------
// SDK helpers
// ---------------------------------------------------------------------------

type ZAIInstance = any

async function createZAI() {
  const { ensureZaiConfig } = await import('@/lib/zai-config');
  await ensureZaiConfig();
  const ZAI = await import('z-ai-web-dev-sdk').then((m) => m.default)
  return ZAI.create()
}

async function webSearch(zai: ZAIInstance, query: string): Promise<Array<{ title: string; url: string; snippet: string }>> {
  try {
    const results = await zai.functions.invoke('web_search', { query, num: 10 })
    const items = results?.results ?? results?.data ?? results
    if (!Array.isArray(items)) return []
    return items
      .filter((r: Record<string, unknown>) => r.title || r.url)
      .map((r: Record<string, unknown>) => ({
        title: String(r.title ?? ''),
        url: String(r.url ?? ''),
        snippet: String(r.snippet ?? r.description ?? r.content ?? ''),
      }))
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[account-brief] Search failed for "${query}": ${msg}`)
    return []
  }
}

async function callLLM(zai: ZAIInstance, systemPrompt: string, userPrompt: string): Promise<string> {
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    thinking: { type: 'disabled' },
  })
  return completion.choices?.[0]?.message?.content ?? ''
}

// ---------------------------------------------------------------------------
// JSON extraction
// ---------------------------------------------------------------------------

function parseBriefJson(raw: string): AccountBrief | null {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  const tryParse = (text: string) => { try { return JSON.parse(text) } catch { return null } }
  const obj = tryParse(cleaned) ?? (cleaned.match(/\{[\s\S]*\}/) ? tryParse(cleaned.match(/\{[\s\S]*\}/)![0]) : null)
  if (!obj || typeof obj !== 'object') return null
  return normalizeBrief(obj)
}

const safeStr = (v: unknown, fallback = ''): string => typeof v === 'string' ? v : fallback
const safeStrArr = (v: unknown): string[] => Array.isArray(v) ? v.map(String).filter(Boolean) : []

function normalizeSection(s: unknown): ExecutiveBriefSection {
  const sec = (s && typeof s === 'object') ? s as Record<string, unknown> : {}
  return {
    title: safeStr(sec.title, 'Section'),
    content: safeStr(sec.content),
    evidence: safeStr(sec.evidence),
    confidence: typeof sec.confidence === 'number' ? Math.min(100, Math.max(0, Math.round(sec.confidence))) : 50,
    actionItems: safeStrArr(sec.actionItems),
  }
}

function normalizeBrief(o: Record<string, unknown>): AccountBrief {
  const stakeholders = Array.isArray(o.targetStakeholders)
    ? o.targetStakeholders
        .filter((e: unknown) => e && typeof e === 'object')
        .map((e: unknown) => {
          const r = e as Record<string, unknown>
          return {
            role: safeStr(r.role), focus: safeStr(r.focus), whyApproach: safeStr(r.whyApproach),
            conversationAngle: safeStr(r.conversationAngle), evidence: safeStr(r.evidence),
            priority: (['primary', 'secondary', 'tertiary'].includes(String(r.priority)) ? String(r.priority) : 'secondary') as 'primary' | 'secondary' | 'tertiary',
          }
        })
        .filter(s => s.role)
    : []

  const questions = Array.isArray(o.discoveryQuestions)
    ? o.discoveryQuestions
        .filter((q: unknown) => q && typeof q === 'object')
        .map((q: unknown) => {
          const r = q as Record<string, unknown>
          return {
            category: safeStr(r.category), question: safeStr(r.question), whyAsk: safeStr(r.whyAsk), idealResponse: safeStr(r.idealResponse),
          }
        })
        .filter(q => q.question)
    : []

  const starters = Array.isArray(o.conversationStarters)
    ? o.conversationStarters
        .filter((c: unknown) => c && typeof c === 'object')
        .map((c: unknown) => {
          const r = c as Record<string, unknown>
          return { context: safeStr(r.context), opening: safeStr(r.opening), evidence: safeStr(r.evidence), expectedReaction: safeStr(r.expectedReaction) }
        })
        .filter(c => c.opening)
    : []

  const engagement = (o.recommendedEngagement && typeof o.recommendedEngagement === 'object')
    ? o.recommendedEngagement as Record<string, unknown> : {}

  const techLandscape = (o.technologyLandscape && typeof o.technologyLandscape === 'object')
    ? o.technologyLandscape as Record<string, unknown> : {}

  const keySignals = Array.isArray(o.keySignals)
    ? o.keySignals
        .filter((s: unknown) => s && typeof s === 'object')
        .map((s: unknown) => {
          const sig = s as Record<string, unknown>
          return { signal: safeStr(sig.signal), evidence: safeStr(sig.evidence), confidence: typeof sig.confidence === 'number' ? sig.confidence : 50 }
        })
    : []

  return {
    executiveSummary: safeStr(o.executiveSummary, 'No summary available'),
    executiveSummaryConfidence: typeof o.executiveSummaryConfidence === 'number' ? o.executiveSummaryConfidence : 50,
    currentState: normalizeSection(o.currentState),
    businessChallenges: normalizeSection(o.businessChallenges),
    technologyChallenges: normalizeSection(o.technologyChallenges),
    strategicOpportunities: normalizeSection(o.strategicOpportunities),
    technologyLandscape: {
      techStack: safeStrArr(techLandscape.techStack),
      cloudProvider: safeStr(techLandscape.cloudProvider, 'Unknown'),
      digitalMaturity: safeStr(techLandscape.digitalMaturity, 'medium'),
      engineeringSignals: Array.isArray(techLandscape.engineeringSignals)
        ? (techLandscape.engineeringSignals as Array<Record<string, unknown>>)
            .filter(s => typeof s?.signal === 'string')
            .map(s => ({ signal: String(s.signal), evidence: safeStr(s.evidence), confidence: typeof s.confidence === 'number' ? s.confidence : 50 }))
        : [],
    },
    targetStakeholders: stakeholders,
    discoveryQuestions: questions,
    conversationStarters: starters,
    recommendedEngagement: {
      approach: safeStr(engagement.approach, 'Not determined'),
      timeline: safeStr(engagement.timeline, 'Not determined'),
      firstMeetingGoal: safeStr(engagement.firstMeetingGoal, 'Discovery'),
      successCriteria: safeStrArr(engagement.successCriteria),
      evidence: safeStr(engagement.evidence),
    },
    strategicPriority: safeStr(o.strategicPriority, 'Medium'),
    keySignals,
    overallConfidence: typeof o.overallConfidence === 'number' ? Math.min(100, Math.max(0, Math.round(o.overallConfidence))) : 50,
    sources: [],
  }
}

function buildFallbackBrief(errorMsg: string): AccountBrief {
  return {
    executiveSummary: `AI generation failed: ${errorMsg}. Raw search results are available in sources.`,
    executiveSummaryConfidence: 0,
    currentState: { title: 'Current State', content: 'Unable to determine current state.', evidence: errorMsg, confidence: 0 },
    businessChallenges: { title: 'Business Challenges', content: 'Unable to identify challenges.', evidence: '', confidence: 0 },
    technologyChallenges: { title: 'Technology Challenges', content: 'Unable to identify technology gaps.', evidence: '', confidence: 0 },
    strategicOpportunities: { title: 'Strategic Opportunities', content: 'Unable to identify opportunities.', evidence: '', confidence: 0 },
    technologyLandscape: { techStack: [], cloudProvider: 'Unknown', digitalMaturity: 'unknown', engineeringSignals: [] },
    targetStakeholders: [],
    discoveryQuestions: [],
    conversationStarters: [],
    recommendedEngagement: { approach: 'Manual review required', timeline: 'N/A', firstMeetingGoal: 'Discovery', successCriteria: [], evidence: '' },
    strategicPriority: 'Medium',
    keySignals: [],
    overallConfidence: 0,
    sources: [],
  }
}

// ---------------------------------------------------------------------------
// System prompt — VP Sales-Ready
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a senior enterprise sales strategist preparing an intelligence brief for a VP of Sales before a strategic customer meeting.

YOUR AUDIENCE: A VP Sales or enterprise account executive who will use this brief to prepare for a high-value customer interaction. Every word must add value. No filler. No hedging. No generic statements.

CRITICAL QUALITY RULES:
1. EXECUTIVE SUMMARY must read like what a VP tells their CEO: "Here's why we should pursue this account and what we're walking into."
2. CURRENT STATE must reference SPECIFIC recent events — funding rounds, product launches, leadership changes, hiring patterns — with evidence.
3. BUSINESS CHALLENGES must be evidence-backed. NOT "may face challenges" but "facing X because of Y (source URL)".
4. TECHNOLOGY CHALLENGES must cite specific tech gaps, migration needs, or outdated systems with evidence.
5. STRATEGIC OPPORTUNITIES must explain WHY NOW — what recent trigger makes this the right time.
6. TARGET STAKEHOLDERS must explain WHY to approach each person and what conversation angle works.
7. DISCOVERY QUESTIONS must be specific enough for a sales rep to use verbatim in a first meeting.
8. CONVERSATION STARTERS must feel natural — not salesy.
9. RECOMMENDED ENGAGEMENT must include timeline, first meeting goal, and success criteria.
10. CONFIDENCE SCORES: If evidence is thin, say so. 0-100 for each section.

FORBIDDEN:
- "Company may benefit from..." → Instead: "Company is hiring 20 engineers for X (source). Recommended: position Y."
- "Consider reaching out to..." → Instead: "Approach [Name], [Title] because [specific reason]. Opening: [specific line]."
- Generic pain points → Evidence-backed challenges only.

Return ONLY valid JSON with this structure:
{
  "executiveSummary": "2-3 sentence strategic assessment a VP Sales reads first",
  "executiveSummaryConfidence": 75,
  "currentState": { "title": "Current State", "content": "...", "evidence": "...", "confidence": 80, "actionItems": ["..."] },
  "businessChallenges": { "title": "Business Challenges", "content": "...", "evidence": "...", "confidence": 70, "actionItems": ["..."] },
  "technologyChallenges": { "title": "Technology Challenges", "content": "...", "evidence": "...", "confidence": 65, "actionItems": ["..."] },
  "strategicOpportunities": { "title": "Strategic Opportunities", "content": "...", "evidence": "...", "confidence": 75, "actionItems": ["..."] },
  "technologyLandscape": {
    "techStack": ["tech1", "tech2"],
    "cloudProvider": "AWS/GCP/Azure/Unknown",
    "digitalMaturity": "low|medium|high|advanced",
    "engineeringSignals": [{ "signal": "...", "evidence": "...", "confidence": 80 }]
  },
  "targetStakeholders": [
    { "role": "CIO", "focus": "what they care about", "whyApproach": "why", "conversationAngle": "opening angle", "evidence": "source", "priority": "primary" }
  ],
  "discoveryQuestions": [
    { "category": "Infrastructure", "question": "specific question", "whyAsk": "what you learn", "idealResponse": "what good sounds like" }
  ],
  "conversationStarters": [
    { "context": "when to use", "opening": "specific opening line", "evidence": "backing data", "expectedReaction": "what you expect" }
  ],
  "recommendedEngagement": {
    "approach": "how to engage",
    "timeline": "suggested timeline",
    "firstMeetingGoal": "discovery|technical|executive_alignment",
    "successCriteria": ["criterion 1", "criterion 2"],
    "evidence": "supporting evidence"
  },
  "strategicPriority": "High|Medium|Low with brief reasoning",
  "keySignals": [{ "signal": "detected signal", "evidence": "source", "confidence": 80 }],
  "overallConfidence": 75
}

Be SPECIFIC. Reference REAL information from search results. Every claim needs evidence.`

// ---------------------------------------------------------------------------
// GET /api/ai/account-brief?companyId=xxx
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get('companyId')
  if (!companyId) return apiError('companyId query parameter is required', 400)

  // Check cache
  const cached = briefCache.get(companyId)
  if (cached) {
    if (cached.expiresAt > Date.now()) return apiSuccess(cached.data)
    briefCache.delete(companyId)
  }

  // 1. Fetch company from DB
  let company: {
    id: string; normalizedName: string; domain: string | null; industry: string | null
    country: string | null; sizeRange: string | null; website: string | null
    internalSummary: string | null; _count: { contacts: number }
  } | null
  try {
    company = await db.company.findUnique({
      where: { id: companyId },
      select: {
        id: true, normalizedName: true, domain: true, industry: true, country: true,
        sizeRange: true, website: true, internalSummary: true,
        _count: { select: { contacts: true } },
      },
    })
  } catch (err: unknown) {
    console.error(`[account-brief] DB lookup failed:`, err instanceof Error ? err.message : err)
    return apiError('Failed to look up company', 500)
  }
  if (!company) return apiError('Company not found', 404)

  const name = company.normalizedName

  // 2. Initialize SDK
  let zai: ZAIInstance
  try {
    zai = await createZAI()
  } catch (err: unknown) {
    console.error('[account-brief] SDK init failed:', err instanceof Error ? err.message : err)
    return apiError('Failed to initialize AI SDK', 500)
  }

  // 3. Run 5 parallel web searches for comprehensive coverage
  const queries = [
    `${name} business overview revenue employees 2025 2026`,
    `${name} technology stack cloud migration digital transformation`,
    `${name} challenges industry trends problems 2025`,
    `${name} leadership CIO CTO CEO executives strategy`,
    `${name} hiring growth funding partnerships news`,
  ]
  const searchResults = await Promise.all(queries.map((q) => webSearch(zai, q)))

  // Deduplicate sources by URL
  const seenUrls = new Set<string>()
  const sources: Array<{ title: string; url: string; snippet: string }> = []
  for (const batch of searchResults) {
    for (const src of batch) {
      if (src.url && !seenUrls.has(src.url)) { seenUrls.add(src.url); sources.push(src) }
    }
  }

  // 4. Build user prompt with DB data + search context
  const searchContext = searchResults
    .flatMap((batch, i) => batch.map((r) => `[Search ${i + 1}] ${r.title}\n  URL: ${r.url}\n  ${r.snippet}`))
    .join('\n\n')
  const dbContext = [
    `Company Name: ${name}`, `Domain: ${company.domain ?? 'Unknown'}`,
    `Industry: ${company.industry ?? 'Unknown'}`, `Country: ${company.country ?? 'Unknown'}`,
    `Company Size: ${company.sizeRange ?? 'Unknown'}`, `Website: ${company.website ?? 'Unknown'}`,
    `Known Contacts in CRM: ${company._count.contacts}`, `Internal Notes: ${company.internalSummary ?? 'None'}`,
  ].join('\n')

  const userPrompt = `## Company Data (from CRM)\n${dbContext}\n\n## Web Search Results (${sources.length} sources)\n${searchContext || 'No search results returned.'}\n\nBased on the above, generate the VP Sales-Ready Executive Intelligence Brief as JSON. Remember: every claim needs evidence, every recommendation needs specificity.`

  // 5. Generate brief via LLM
  let brief: AccountBrief
  try {
    const raw = await callLLM(zai, SYSTEM_PROMPT, userPrompt)
    const parsed = parseBriefJson(raw)
    brief = parsed ?? (() => { console.error('[account-brief] Unparseable LLM JSON'); return buildFallbackBrief('LLM response was not valid JSON') })()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[account-brief] LLM generation failed: ${msg}`)
    brief = buildFallbackBrief(msg)
  }

  // Attach sources to brief
  brief.sources = sources

  // 6. Build response, cache, and prune stale entries
  const response: CachedBrief = {
    companyId: company.id, companyName: name, brief, sources,
    generatedAt: new Date().toISOString(),
  }
  briefCache.set(companyId, { data: response, expiresAt: Date.now() + CACHE_TTL_MS })
  for (const [key, val] of briefCache.entries()) { if (val.expiresAt <= Date.now()) briefCache.delete(key) }

  return apiSuccess(response)
}
