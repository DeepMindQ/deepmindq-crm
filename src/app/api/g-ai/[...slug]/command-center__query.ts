import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/* ═══════════════════════════════════════════════════════════════════
   AI Command Center — Natural Language Query (v2)
   
   Two-pass LLM architecture:
     Pass 1 — "Query Planner":  parses NL → structured fetch plan
     Pass 2 — "Analyst":        raw data → rich insights + follow-ups
   
   Falls back to legacy keyword-matching if z-ai-web-dev-sdk is
   unavailable or the LLM returns unusable output.
   ═══════════════════════════════════════════════════════════════════ */

// ── Response contract ──────────────────────────────────────────────

interface QueryResult {
  query: string;
  interpretation: string;
  engine: 'company' | 'email' | 'capability' | 'general';
  data: any;
  summary: string;
  aiInsights?: string[];
  suggestedFollowUp?: string[];
  aiProcessed?: boolean;
}

// ── LLM helper (thin wrapper around z-ai-web-dev-sdk) ─────────────

async function createZAI() {
  const { ensureZaiConfig } = await import('@/lib/zai-config');
  await ensureZaiConfig();
  const Z = await import('z-ai-web-dev-sdk').then((m: any) => m.default);
  return Z.create();
}

async function llmChat(systemPrompt: string, userPrompt: string): Promise<string | null> {
  try {
    const ZAI = await createZAI();
    const completion = await ZAI.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
    });
    // The SDK returns the content string directly in certain shapes;
    // handle both { choices: [{ message: { content } }] } and plain string.
    if (typeof completion === 'string') return completion;
    const content =
      completion?.choices?.[0]?.message?.content ??
      completion?.content ??
      completion?.message?.content ??
      null;
    return typeof content === 'string' ? content : null;
  } catch (err) {
    console.error('[CommandCenter LLM]', err);
    return null;
  }
}

async function webSearch(query: string, num = 5): Promise<any[]> {
  try {
    const ZAI = await createZAI();
    const results = await ZAI.functions.invoke('web_search', { query, num });
    return Array.isArray(results) ? results : results?.results ?? [];
  } catch (err) {
    console.error('[CommandCenter WebSearch]', err);
    return [];
  }
}

// ── Query Plan (what the first LLM pass returns) ──────────────────

interface DataFetch {
  source:
    | 'companies'
    | 'contacts'
    | 'drafts'
    | 'replies'
    | 'bounces'
    | 'companySignals'
    | 'companyResearchCards'
    | 'capabilityAssets'
    | 'emailEvents'
    | 'sendQueue'
    | 'emailTemplates'
    | 'sequences';
  filters: Record<string, any>;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
  limit?: number;
  includeRelations?: string[];
}

interface QueryPlan {
  engine: 'company' | 'email' | 'capability' | 'general';
  interpretation: string;
  dataFetches: DataFetch[];
  needsWebSearch: boolean;
  webSearchQuery?: string;
}

// ── Pass 1: Query Planner ─────────────────────────────────────────

const PLANNER_SYSTEM = `You are a query planner for a B2B sales intelligence platform called DeepMindQ.
Given a user's natural language question, produce a JSON plan that tells the system which database tables to query and how.

Available data sources and their filterable fields:

1. **companies** — filters: industry (string), status (prospect|researching|active|engaged|paused|closed_won|closed_lost), lifecycleStage (discovery|qualification|proposal|negotiation|closed), sizeRange, location, country, assignedTo, tags (JSON string). orderBy: intelligenceScore, engagementScore, createdAt, updatedAt, lastActivityAt, lastEnrichedAt. Useful includeRelations: ["researchCard", "signals", "contacts"]

2. **contacts** — filters: status (imported|cleaned|duplicate|drafted|queued|sent|replied|bounced|suppressed|archived), emailHealth (unknown|valid|risky|invalid), consentStatus, assignedTo, source, companyId. orderBy: leadScore, companyFitScore, engagementScore, enrichmentScore, aiConversionScore, createdAt.

3. **drafts** — filters: status (pending_review|approved|rejected|sent), variantLabel, sequenceId. orderBy: confidenceScore, createdAt.

4. **replies** — filters: category (positive|negative|out_of_office|unsubscribe|other), contactId, draftId. orderBy: receivedAt.

5. **bounces** — filters: bounceType (hard|soft), contactId. orderBy: bouncedAt.

6. **companySignals** — filters: signalType (funding|hiring|leadership_change|tech_change|news|mention|partnership|expansion), severity (low|medium|high|critical), isRead. orderBy: createdAt.

7. **companyResearchCards** — no specific filters, always fetched via company include. Has: revenue, employeeCount, fundingStage, techStack, businessOverview.

8. **capabilityAssets** — filters: category (service_line|case_study|proof_point|objection_response|cta), serviceLine, targetIndustries (string match), isActive (boolean). orderBy: upvotes, usedInEmails, createdAt.

9. **emailEvents** — filters: eventType (open|click|reply|bounce|unsubscribe|complaint), contactId, draftId. orderBy: createdAt.

10. **sendQueue** — filters: status (pending|scheduled|sent|failed|paused), provider. orderBy: scheduledAt, sentAt.

11. **emailTemplates** — filters: serviceLine, tone (professional|casual|executive), category, isActive.

12. **sequences** — filters: serviceLine, isActive.

IMPORTANT RULES:
- Set "needsWebSearch" to true ONLY if the user is asking about external/industry information (news, trends, competitors, market data) that cannot be answered from the database.
- For comparisons between industries/sectors, fetch companies from both and the AI will compare them.
- For "funding" or "recent" company questions, include companySignals with signalType "funding" and also fetch companies with researchCards.
- For "underutilized capabilities" queries, fetch capabilityAssets and emailEvents to cross-reference usage.
- For "reply rate" or "trend" queries, fetch both replies AND sendQueue (to calculate rates).
- For pipeline/engagement questions, fetch companies and emailEvents.
- Always include a clear "interpretation" of what the user wants.
- Return ONLY valid JSON, no markdown fences.`;

function buildPlannerPrompt(query: string): string {
  return `User query: "${query}"

Produce a JSON object with this exact shape:
{
  "engine": "company" | "email" | "capability" | "general",
  "interpretation": "your understanding of what the user wants",
  "dataFetches": [
    {
      "source": "<table name from list above>",
      "filters": { ... },
      "orderBy": "<field name or omit>",
      "orderDir": "asc" | "desc",
      "limit": <number, max 200>,
      "includeRelations": ["<relation names if needed>"]
    }
  ],
  "needsWebSearch": false,
  "webSearchQuery": "<only if needsWebSearch is true>"
}

Respond with ONLY the JSON object.`;
}

function parsePlan(raw: string | null): QueryPlan | null {
  if (!raw) return null;
  try {
    // Strip markdown fences if the LLM wraps them
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }
    const plan = JSON.parse(cleaned) as QueryPlan;
    if (!plan.engine || !Array.isArray(plan.dataFetches)) return null;
    return plan;
  } catch {
    return null;
  }
}

// ── Data Fetcher (translates plan → Prisma calls) ─────────────────

function asSafeArray(val: unknown): any[] {
  return Array.isArray(val) ? val : [];
}

async function executeFetch(fetch: DataFetch): Promise<{ source: string; data: any[] }> {
  try {
    const where: Record<string, any> = {};
    const filters = fetch.filters ?? {};

    // Map filter values to Prisma-compatible where clauses
    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null) continue;
      if (typeof value === 'boolean') {
        where[key] = value;
      } else if (typeof value === 'number') {
        if (key.endsWith('Min')) {
          const field = key.replace(/Min$/, '');
          where[field] = { ...where[field], gte: value };
        } else if (key.endsWith('Max')) {
          const field = key.replace(/Max$/, '');
          where[field] = { ...where[field], lte: value };
        } else {
          where[key] = value;
        }
      } else if (typeof value === 'string') {
        // Support comma-separated OR values
        if (value.includes(',')) {
          const vals = value.split(',').map((v) => v.trim());
          if (vals.length === 1) {
            where[key] = vals[0];
          } else {
            where[key] = { in: vals };
          }
        } else {
          where[key] = { contains: value, mode: 'insensitive' };
        }
      } else if (Array.isArray(value)) {
        where[key] = { in: value };
      }
    }

    const limit = Math.min(fetch.limit ?? 50, 200);

    // Order
    let orderBy: any = undefined;
    if (fetch.orderBy) {
      orderBy = { [fetch.orderBy]: fetch.orderDir ?? 'desc' };
    }

    // Include relations
    const include: any = {};
    if (fetch.includeRelations?.includes('researchCard')) {
      include.researchCard = true;
    }
    if (fetch.includeRelations?.includes('signals')) {
      include.signals = { take: 5, orderBy: { createdAt: 'desc' } };
    }
    if (fetch.includeRelations?.includes('contacts')) {
      include.contacts = { take: 10 };
    }
    if (fetch.includeRelations?.includes('company')) {
      include.company = true;
    }

    const args: any = { where, take: limit };
    if (orderBy) args.orderBy = orderBy;
    if (Object.keys(include).length > 0) args.include = include;

    let result: any[] = [];
    const modelMap: Record<string, any> = {
      companies: db.company,
      contacts: db.contact,
      drafts: db.draft,
      replies: db.reply,
      bounces: db.bounce,
      companySignals: db.companySignal,
      companyResearchCards: db.companyResearchCard,
      capabilityAssets: db.capabilityAsset,
      emailEvents: db.emailEvent,
      sendQueue: db.sendQueue,
      emailTemplates: db.emailTemplate,
      sequences: db.emailSequence,
    };

    const model = modelMap[fetch.source];
    if (!model) {
      console.warn(`[CommandCenter] Unknown data source: ${fetch.source}`);
      return { source: fetch.source, data: [] };
    }

    result = asSafeArray(await model.findMany(args));

    // Flatten for JSON serialization (strip circular refs from relations)
    const serialized = result.map((row: any) => {
      const flat: any = { ...row };
      // Serialize researchCard from company includes
      if (flat.researchCard) {
        flat.researchCard = { ...flat.researchCard };
        delete flat.researchCard.company;
      }
      if (flat.signals) {
        flat.signals = flat.signals.map((s: any) => {
          const { company, ...rest } = s;
          return rest;
        });
      }
      if (flat.contacts) {
        flat.contacts = flat.contacts.map((c: any) => {
          const { company, drafts, replies, bounces, ...rest } = c;
          return rest;
        });
      }
      if (flat.company) {
        const { contacts, signals, timeline, notes, researchCard, ...rest } = flat.company;
        flat.company = rest;
      }
      return flat;
    });

    return { source: fetch.source, data: serialized };
  } catch (err) {
    console.error(`[CommandCenter] Fetch error for ${fetch.source}:`, err);
    return { source: fetch.source, data: [] };
  }
}

// ── Pass 2: Analyst (generates summary + insights) ────────────────

function buildAnalystPrompt(
  query: string,
  interpretation: string,
  engine: string,
  fetchedData: Record<string, any[]>,
  webResults: any[]
): { system: string; user: string } {
  const dataSummary = Object.entries(fetchedData)
    .map(([source, rows]) => {
      const preview = JSON.stringify(rows.slice(0, 30), null, 0);
      return `**${source}** (${rows.length} records):\n${preview}`;
    })
    .join('\n\n');

  const webSection =
    webResults.length > 0
      ? `\n\n**Web Search Results:**\n${JSON.stringify(webResults.slice(0, 5), null, 2)}`
      : '';

  const system = `You are a senior sales intelligence analyst. Given the user's query and the raw data fetched from the database, produce a JSON response with:

1. **summary** (string): A concise, data-rich summary answering the user's question. Cite specific numbers, company names, scores, and percentages. Use markdown formatting (bold, lists) for readability. Be specific — never vague.

2. **aiInsights** (string[]): 3-5 strategic insights the user didn't explicitly ask for but would find valuable based on the data patterns. These should be actionable, surprising, or strategically relevant. Examples:
   - "Acme Corp has a 92 intelligence score but zero email engagement — consider a different outreach channel."
   - "Your healthcare pipeline is 3x your fintech pipeline but converting at half the rate."
   - "3 companies in your prospect list recently raised Series B funding — high-priority targets."

3. **suggestedFollowUp** (string[]): 2-4 specific follow-up questions the user might want to ask next, building on this analysis. These should be natural next steps. Examples:
   - "Show me the top 5 healthcare companies by engagement score"
   - "What capabilities should I pitch to fintech prospects?"
   - "Which drafts have been pending review the longest?"

RULES:
- Cite specific data: company names, scores, counts, percentages. Never say "several" when you can say "14".
- If the data is empty for a source, say so clearly and suggest what the user can do.
- Keep the summary under 300 words but information-dense.
- Return ONLY valid JSON, no markdown fences.`;

  const user = `## User's Question
${query}

## AI's Interpretation
${interpretation}

## Engine
${engine}

## Fetched Data
${dataSummary}
${webSection}

Produce a JSON object:
{
  "summary": "...",
  "aiInsights": ["...", "...", "..."],
  "suggestedFollowUp": ["...", "...", "..."]
}

Return ONLY the JSON object.`;

  return { system, user };
}

function parseAnalysis(raw: string | null): { summary: string; aiInsights: string[]; suggestedFollowUp: string[] } | null {
  if (!raw) return null;
  try {
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }
    const parsed = JSON.parse(cleaned);
    if (!parsed.summary) return null;
    return {
      summary: parsed.summary,
      aiInsights: Array.isArray(parsed.aiInsights) ? parsed.aiInsights : [],
      suggestedFollowUp: Array.isArray(parsed.suggestedFollowUp) ? parsed.suggestedFollowUp : [],
    };
  } catch {
    return null;
  }
}

// ── Legacy keyword-matching fallback (preserved verbatim) ──────────

async function legacyKeywordQuery(query: string): Promise<QueryResult> {
  const q = query.toLowerCase();

  // ── Company Engine Queries ──
  if (q.includes('compan') && (q.includes('high') || q.includes('score') || q.includes('top') || q.includes('best'))) {
    const companies = await db.company.findMany({ take: 50, orderBy: { intelligenceScore: 'desc' } });
    const safe = asSafeArray(companies);
    const filtered = safe.filter((c: any) => (c.intelligenceScore || 0) >= 50).slice(0, 10);
    return {
      query, interpretation: 'Finding highest-scoring companies',
      engine: 'company',
      data: filtered.map((c: any) => ({ id: c.id, name: c.rawName || c.normalizedName, industry: c.industry, score: c.intelligenceScore || 0, status: c.status, location: c.location })),
      summary: `Found ${filtered.length} high-score companies (score >= 50). ${filtered.length > 0 ? `Top: ${filtered[0]?.name} (${filtered[0]?.score})` : 'No companies meet the threshold yet.'}`,
      aiProcessed: false,
    };
  } else if (q.includes('compan') && (q.includes('signal') || q.includes('alert') || q.includes('news') || q.includes('trigger'))) {
    const signals = await db.companySignal.findMany({ take: 20, orderBy: { createdAt: 'desc' } });
    const safe = asSafeArray(signals);
    return {
      query, interpretation: 'Fetching recent company signals and alerts',
      engine: 'company',
      data: safe.map((s: any) => ({ id: s.id, type: s.signalType, title: s.title, severity: s.severity, source: s.source, createdAt: s.createdAt })),
      summary: `${safe.length} recent signals found. ${safe.filter((s: any) => s.severity === 'high' || s.severity === 'critical').length} are high/critical priority.`,
      aiProcessed: false,
    };
  } else if (q.includes('compan') && (q.includes('industr') || q.includes('sector') || q.includes('vertical'))) {
    const companies = await db.company.findMany({ take: 100 });
    const safe = asSafeArray(companies);
    const byIndustry: Record<string, any[]> = {};
    safe.forEach((c: any) => {
      const ind = c.industry || 'Unknown';
      if (!byIndustry[ind]) byIndustry[ind] = [];
      byIndustry[ind].push({ id: c.id, name: c.rawName || c.normalizedName, score: c.intelligenceScore || 0, status: c.status });
    });
    const industryBreakdown = Object.entries(byIndustry).map(([industry, comps]) => ({
      industry, count: comps.length, avgScore: Math.round(comps.reduce((s: number, c: any) => s + c.score, 0) / comps.length), topCompany: comps.sort((a: any, b: any) => b.score - a.score)[0]?.name,
    }));
    return {
      query, interpretation: 'Breaking down companies by industry/sector',
      engine: 'company',
      data: industryBreakdown,
      summary: `${safe.length} companies across ${industryBreakdown.length} industries. ${industryBreakdown.length > 0 ? `Largest sector: ${industryBreakdown.sort((a, b) => b.count - a.count)[0]?.industry} (${industryBreakdown.sort((a, b) => b.count - a.count)[0]?.count} companies)` : 'No data.'}`,
      aiProcessed: false,
    };
  } else if (q.includes('compan') && (q.includes('engaged') || q.includes('active') || q.includes('warm') || q.includes('hot'))) {
    const companies = await db.company.findMany({ take: 50 });
    const safe = asSafeArray(companies);
    const engaged = safe.filter((c: any) => c.status === 'engaged' || c.status === 'active');
    return {
      query, interpretation: 'Finding engaged and active companies',
      engine: 'company',
      data: engaged.map((c: any) => ({ id: c.id, name: c.rawName || c.normalizedName, status: c.status, score: c.intelligenceScore || 0, engagementScore: c.engagementScore || 0, industry: c.industry })),
      summary: `${engaged.length} engaged/active companies out of ${safe.length} total. These are your warmest prospects.`,
      aiProcessed: false,
    };

  // ── Email Engine Queries ──
  } else if (q.includes('draft') || q.includes('pending') || q.includes('review')) {
    const drafts = await db.draft.findMany({ take: 30, orderBy: { createdAt: 'desc' } });
    const safe = asSafeArray(drafts);
    const pending = safe.filter((d: any) => d.status === 'pending_review');
    return {
      query, interpretation: 'Checking email draft status',
      engine: 'email',
      data: pending.slice(0, 10).map((d: any) => ({ id: d.id, subject: d.subject, confidence: d.confidenceScore, status: d.status, createdAt: d.createdAt })),
      summary: `${pending.length} drafts pending review out of ${safe.length} total. ${pending.filter((d: any) => (d.confidenceScore || 0) >= 80).length} have high confidence scores (>= 80).`,
      aiProcessed: false,
    };
  } else if (q.includes('reply') || q.includes('response') || q.includes('replied')) {
    const replies = await db.reply.findMany({ take: 30, orderBy: { receivedAt: 'desc' } });
    const safe = asSafeArray(replies);
    return {
      query, interpretation: 'Analyzing email replies',
      engine: 'email',
      data: safe.slice(0, 10).map((r: any) => ({ id: r.id, contactId: r.contactId, category: r.category, subject: r.subject, receivedAt: r.receivedAt })),
      summary: `${safe.length} replies found. ${safe.filter((r: any) => r.category === 'positive').length} positive, ${safe.filter((r: any) => r.category === 'negative').length} negative, ${safe.filter((r: any) => r.category === 'out_of_office').length} out-of-office.`,
      aiProcessed: false,
    };
  } else if (q.includes('bounce') || q.includes('deliver') || q.includes('fail')) {
    const bounces = await db.bounce.findMany({ take: 20, orderBy: { bouncedAt: 'desc' } });
    const safe = asSafeArray(bounces);
    return {
      query, interpretation: 'Checking email delivery and bounces',
      engine: 'email',
      data: safe.slice(0, 10).map((b: any) => ({ id: b.id, contactId: b.contactId, type: b.bounceType, reason: b.reason, bouncedAt: b.bouncedAt })),
      summary: `${safe.length} bounces found. ${safe.filter((b: any) => b.bounceType === 'hard').length} hard bounces (remove these contacts), ${safe.filter((b: any) => b.bounceType === 'soft').length} soft bounces (may retry).`,
      aiProcessed: false,
    };
  } else if (q.includes('lead') && (q.includes('not') || q.includes('uncontacted') || q.includes('never') || q.includes('yet'))) {
    const contacts = await db.contact.findMany({ take: 200 });
    const safe = asSafeArray(contacts);
    const uncontacted = safe.filter((c: any) => c.status === 'imported' || c.status === 'cleaned');
    const sorted = uncontacted.sort((a: any, b: any) => (b.leadScore || 0) - (a.leadScore || 0)).slice(0, 10);
    return {
      query, interpretation: 'Finding leads that haven\'t been contacted yet',
      engine: 'email',
      data: sorted.map((c: any) => ({ id: c.id, name: c.rawName || c.normalizedName, email: c.email, score: c.leadScore || 0, company: c.companyId })),
      summary: `${uncontacted.length} leads not yet contacted. Top priority: ${(sorted[0] as any)?.rawName || (sorted[0] as any)?.normalizedName || 'N/A'} (score: ${(sorted[0] as any)?.leadScore || 0}).`,
      aiProcessed: false,
    };

  // ── Capability Engine Queries ──
  } else if (q.includes('capabil') && (q.includes('match') || q.includes('suggest') || q.includes('recommend'))) {
    const capabilities = await db.capabilityAsset.findMany({ where: { isActive: true }, take: 50 });
    const safe = asSafeArray(capabilities);
    return {
      query, interpretation: 'Finding best-matching capabilities',
      engine: 'capability',
      data: safe.sort((a: any, b: any) => (b.upvotes || 0) - (a.upvotes || 0)).slice(0, 10).map((c: any) => ({ id: c.id, title: c.title, category: c.category, serviceLine: c.serviceLine, upvotes: c.upvotes || 0, usedInEmails: c.usedInEmails || 0 })),
      summary: `${safe.length} active capabilities. Top recommended: ${(safe[0] as any)?.title || 'N/A'} (${(safe[0] as any)?.usedInEmails || 0} uses, ${(safe[0] as any)?.upvotes || 0} upvotes).`,
      aiProcessed: false,
    };
  } else if (q.includes('case stud') || q.includes('proof point') || q.includes('evidence')) {
    const capabilities = await db.capabilityAsset.findMany({ where: { isActive: true }, take: 100 });
    const safe = asSafeArray(capabilities);
    const caseStudies = safe.filter((c: any) => c.category === 'case_study');
    const proofPoints = safe.filter((c: any) => c.category === 'proof_point');
    return {
      query, interpretation: 'Finding case studies and proof points',
      engine: 'capability',
      data: [...caseStudies, ...proofPoints].slice(0, 10).map((c: any) => ({ id: c.id, title: c.title, category: c.category, serviceLine: c.serviceLine, summary: c.summary })),
      summary: `${caseStudies.length} case studies, ${proofPoints.length} proof points available.`,
      aiProcessed: false,
    };

  // ── General / Fallback ──
  } else {
    const [companies, contacts, drafts, replies] = await Promise.all([
      db.company.findMany({ take: 20 }),
      db.contact.findMany({ take: 50 }),
      db.draft.findMany({ where: { status: 'pending_review' }, take: 10 }),
      db.reply.findMany({ take: 10 }),
    ]);
    const c = asSafeArray(companies);
    const co = asSafeArray(contacts);
    const dr = asSafeArray(drafts);
    const re = asSafeArray(replies);

    return {
      query, interpretation: 'Generating comprehensive platform summary',
      engine: 'general',
      data: {
        companies: c.length, contacts: co.length, pendingDrafts: dr.length, recentReplies: re.length,
        topCompanies: c.sort((a: any, b: any) => (b.intelligenceScore || 0) - (a.intelligenceScore || 0)).slice(0, 3).map((x: any) => ({ name: x.rawName, score: x.intelligenceScore || 0 })),
        contactsByStatus: co.reduce((acc: any, x: any) => { acc[x.status] = (acc[x.status] || 0) + 1; return acc; }, {}),
      },
      summary: `Platform has ${c.length} companies, ${co.length} contacts, ${dr.length} pending drafts, and ${re.length} recent replies. Ask about specific engines for deeper insights.`,
      aiProcessed: false,
    };
  }
}

// ── Main Route Handler ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // ── Attempt AI-powered two-pass pipeline ──
    try {
      // Pass 1: Query Planning
      const plannerRaw = await llmChat(PLANNER_SYSTEM, buildPlannerPrompt(query));
      const plan = parsePlan(plannerRaw);

      if (!plan || plan.dataFetches.length === 0) {
        console.warn('[CommandCenter] LLM plan was empty or unparseable, falling back to keyword matching');
        const fallback = await legacyKeywordQuery(query);
        return NextResponse.json(fallback);
      }

      // Execute all data fetches in parallel
      const fetchResults = await Promise.all(plan.dataFetches.map(executeFetch));
      const fetchedData: Record<string, any[]> = {};
      for (const r of fetchResults) {
        fetchedData[r.source] = r.data;
      }

      // Web search if the planner requested it
      let webResults: any[] = [];
      if (plan.needsWebSearch && plan.webSearchQuery) {
        webResults = await webSearch(plan.webSearchQuery);
      }

      // Pass 2: AI Analysis
      const { system: analystSystem, user: analystUser } = buildAnalystPrompt(
        query,
        plan.interpretation,
        plan.engine,
        fetchedData,
        webResults
      );
      const analysisRaw = await llmChat(analystSystem, analystUser);
      const analysis = parseAnalysis(analysisRaw);

      // If analysis failed, build a basic summary from the data
      const summary = analysis?.summary ?? buildBasicSummary(plan, fetchedData, webResults);
      const aiInsights = analysis?.aiInsights ?? [];
      const suggestedFollowUp = analysis?.suggestedFollowUp ?? [];

      // Flatten fetched data into a single object for the response
      const dataPayload: any = {};
      for (const [source, rows] of Object.entries(fetchedData)) {
        dataPayload[source] = rows.slice(0, 50); // cap at 50 per source
      }
      if (webResults.length > 0) {
        dataPayload.webResults = webResults;
      }

      const result: QueryResult = {
        query,
        interpretation: plan.interpretation,
        engine: plan.engine,
        data: dataPayload,
        summary,
        aiInsights,
        suggestedFollowUp,
        aiProcessed: true,
      };

      return NextResponse.json(result);
    } catch (aiError) {
      // AI pipeline failed — fall back to keyword matching
      console.error('[CommandCenter] AI pipeline failed, falling back:', aiError);
      const fallback = await legacyKeywordQuery(query);
      return NextResponse.json(fallback);
    }
  } catch (error) {
    console.error('[Command Center Query]', error);
    return NextResponse.json({ error: 'Query processing failed' }, { status: 500 });
  }
}

// ── Emergency summary builder (if Pass 2 LLM fails) ───────────────

function buildBasicSummary(
  plan: QueryPlan,
  fetchedData: Record<string, any[]>,
  webResults: any[]
): string {
  const parts: string[] = [];
  for (const [source, rows] of Object.entries(fetchedData)) {
    if (rows.length === 0) {
      parts.push(`No data found in **${source}**.`);
    } else {
      parts.push(`Found **${rows.length}** records in **${source}**.`);
      // Show top 3 items
      rows.slice(0, 3).forEach((row: any) => {
        const name = row.rawName || row.normalizedName || row.title || row.subject || row.signalType || 'item';
        const score = row.intelligenceScore ?? row.leadScore ?? row.confidenceScore ?? row.upvotes;
        const detail = score !== undefined ? ` (score: ${score})` : '';
        parts.push(`- ${name}${detail}`);
      });
    }
  }
  if (webResults.length > 0) {
    parts.push(`Also retrieved **${webResults.length}** web search results for external context.`);
  }
  return parts.join('\n');
}