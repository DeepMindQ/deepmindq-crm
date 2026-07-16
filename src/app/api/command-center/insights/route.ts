import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/* ═══════════════════════════════════════════════════════════════════════════
   AI-powered Command Center Insights
   ───────────────────────────────────────────────────────────────────────────
   All DB queries are preserved verbatim. After gathering raw metrics, the
   z-ai-web-dev-sdk LLM analyses cross-engine patterns and produces an
   executive summary, strategic insights, and a health-score explanation.
   AI results are cached in-memory for 3 minutes; on failure the route
   returns the rule-based response without AI fields (graceful fallback).
   ═══════════════════════════════════════════════════════════════════════════ */

// ── In-memory AI cache (3 min TTL) ──
let aiCache: { data: AIResult; ts: number } | null = null;
const AI_CACHE_TTL = 3 * 60 * 1000; // 3 minutes

// ── Types ──
interface AIResult {
  aiSummary: string;
  aiStrategicInsights: Array<{ insight: string; impact: 'high' | 'medium' | 'low'; action: string }>;
  aiHealthAnalysis: string;
}

// ── LLM helper (same pattern used across the project) ──
async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const ZAI = await import('z-ai-web-dev-sdk').then(m => m.default).then(Z => Z.create());
  const completion = await ZAI.chat.completions.create({
    messages: [
      { role: 'assistant', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    thinking: { type: 'disabled' },
  });
  return completion.choices?.[0]?.message?.content ?? '';
}

// ── Build a metrics context string for the AI ──
function buildMetricsContext(ctx: {
  totalCompanies: number;
  totalContacts: number;
  topScoredCompanies: any[];
  companiesByStatus: Record<string, number>;
  companiesByIndustry: Record<string, number>;
  companiesByLifecycle: Record<string, number>;
  companiesByCountry: Record<string, number>;
  unreadSignalCount: number;
  criticalSignalCount: number;
  latestSignals: any[];
  pendingDrafts: number;
  pendingQueue: number;
  totalReplies: number;
  positiveReplies: number;
  replyRate: number;
  contactsByStatus: Record<string, number>;
  avgLeadScore: number;
  highValueLeads: any[];
  activeSequences: number;
  totalCapabilities: number;
  capabilitiesByCategory: Record<string, number>;
  capabilitiesByServiceLine: Record<string, number>;
  topCapabilities: any[];
  healthScore: number;
}): string {
  const topCompanies = ctx.topScoredCompanies
    .map((c: any) => `  - ${c.name} (industry: ${c.industry || 'N/A'}, score: ${c.score}, status: ${c.status}, lifecycle: ${c.lifecycleStage || 'N/A'})`)
    .join('\n');

  const topLeads = ctx.highValueLeads
    .map((c: any) => `  - ${c.name} <${c.email}> (score: ${c.score}, status: ${c.status})`)
    .join('\n');

  const topCaps = ctx.topCapabilities
    .map((c: any) => `  - "${c.title}" (category: ${c.category}, serviceLine: ${c.serviceLine || 'N/A'}, usedInEmails: ${c.usedInEmails}, upvotes: ${c.upvotes})`)
    .join('\n');

  const recentSignals = ctx.latestSignals
    .map((s: any) => `  - [${s.severity}] ${s.title} (company: ${s.companyId}, type: ${s.type})`)
    .join('\n');

  return `
PLATFORM METRICS SNAPSHOT
=========================

COMPANY ENGINE
- Total companies: ${ctx.totalCompanies}
- Companies by status: ${JSON.stringify(ctx.companiesByStatus)}
- Companies by industry: ${JSON.stringify(ctx.companiesByIndustry)}
- Companies by lifecycle stage: ${JSON.stringify(ctx.companiesByLifecycle)}
- Companies by country: ${JSON.stringify(ctx.companiesByCountry)}
- Unread signals: ${ctx.unreadSignalCount} (critical/high: ${ctx.criticalSignalCount})
- Recent signals:\n${recentSignals || '  (none)'}
- Top-scored companies:\n${topCompanies || '  (none)'}

EMAIL ENGINE
- Total contacts: ${ctx.totalContacts}
- Contacts by status: ${JSON.stringify(ctx.contactsByStatus)}
- Average lead score: ${ctx.avgLeadScore}/100
- Pending drafts awaiting review: ${ctx.pendingDrafts}
- Emails in send queue: ${ctx.pendingQueue}
- Total replies (recent): ${ctx.totalReplies}
- Positive replies: ${ctx.positiveReplies}
- Reply rate: ${ctx.replyRate}%
- Active sequences: ${ctx.activeSequences}
- High-value leads (score >= 70):\n${topLeads || '  (none)'}

CAPABILITY ENGINE
- Total active capabilities: ${ctx.totalCapabilities}
- Capabilities by category: ${JSON.stringify(ctx.capabilitiesByCategory)}
- Capabilities by service line: ${JSON.stringify(ctx.capabilitiesByServiceLine)}
- Most-used capabilities:\n${topCaps || '  (none)'}

COMPUTED HEALTH SCORE: ${ctx.healthScore}/100
`.trim();
}

// ── Call the AI for all three enriched fields at once ──
async function generateAIInsights(healthScore: number, metricsContext: string): Promise<AIResult> {
  const systemPrompt = `You are an expert sales-operations analyst inside "DeepMindQ", an AI-powered B2B outbound sales platform. You have three engines:
1. **Company Engine** — enriches target accounts, tracks intelligence scores, monitors signals (funding, leadership, tech shifts).
2. **Email Engine** — generates AI drafts, manages send queues, tracks replies and lead scores.
3. **Capability Engine** — maintains a library of proof points, case studies, and objection responses used to personalize emails.

Your job is to analyse the provided platform metrics and return a JSON object with exactly three fields:

1. "aiSummary" (string) — A 3-5 sentence executive briefing of the platform's current state. Reference specific company names, metrics, and cross-engine patterns. Write in a professional, direct tone. No markdown.

2. "aiStrategicInsights" (array) — 3-6 strategic insights. Each object has:
   - "insight" (string): The observation, referencing specific data points.
   - "impact" (string): "high", "medium", or "low".
   - "action" (string): A concrete, actionable next step the user should take.
   Look for hidden opportunities (e.g. verticals with high reply rates, under-utilised capabilities, signal clusters), cross-engine relationships (e.g. signals in an industry with no capabilities), and bottlenecks.

3. "aiHealthAnalysis" (string) — A 2-3 sentence explanation of why the health score is ${healthScore}/100, what's dragging it down, and the single highest-impact action to raise it. No markdown.

IMPORTANT: Return ONLY valid JSON. No markdown fences, no commentary.`;

  const raw = await callAI(systemPrompt, `Here are the current platform metrics:\n\n${metricsContext}`);

  // Parse — tolerate optional markdown code fences
  const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned) as AIResult;

  // Validate shape (best-effort — fall back to empty on parse error)
  return {
    aiSummary: typeof parsed.aiSummary === 'string' ? parsed.aiSummary : 'AI summary unavailable.',
    aiStrategicInsights: Array.isArray(parsed.aiStrategicInsights)
      ? parsed.aiStrategicInsights
          .filter((i: any) => typeof i.insight === 'string' && typeof i.action === 'string')
          .map((i: any) => ({
            insight: i.insight,
            impact: ['high', 'medium', 'low'].includes(i.impact) ? i.impact : 'medium' as const,
            action: i.action,
          }))
      : [],
    aiHealthAnalysis: typeof parsed.aiHealthAnalysis === 'string' ? parsed.aiHealthAnalysis : 'AI health analysis unavailable.',
  };
}

// ── Fetch DB metrics (all existing queries preserved) ──
async function fetchDBMetrics() {
  const safe = (arr: any[] | undefined) => Array.isArray(arr) ? arr : [];

  const [
    totalCompanies,
    totalContacts,
    companies,
    contacts,
    drafts,
    queueItems,
    replies,
    capabilities,
    sequences,
    signals,
    contactsByStatusRaw,
    companiesByIndustryRaw,
    companiesByStatusRaw,
    companiesByLifecycleRaw,
    capsByCategoryRaw,
    capsByServiceLineRaw,
    companiesByCountryRaw,
  ] = await Promise.all([
    db.company.count(),
    db.contact.count(),
    db.company.findMany({ take: 50, orderBy: { intelligenceScore: 'desc' } }),
    db.contact.findMany({ take: 100, orderBy: { leadScore: 'desc' } }),
    db.draft.findMany({ where: { status: 'pending_review' } }),
    db.sendQueue.findMany({ where: { status: 'pending' } }),
    db.reply.findMany({ take: 50, orderBy: { receivedAt: 'desc' } }),
    db.capabilityAsset.findMany({ where: { isActive: true } }),
    db.emailSequence.findMany({ where: { isActive: true } }),
    db.companySignal.findMany({ where: { isRead: false }, take: 20, orderBy: { createdAt: 'desc' } }),
    db.contact.groupBy({ by: ['status'], _count: true }),
    db.company.groupBy({ by: ['industry'], where: { industry: { not: null } }, _count: true, orderBy: { _count: { industry: 'desc' } }, take: 12 }),
    db.company.groupBy({ by: ['status'], _count: true }),
    db.company.groupBy({ by: ['lifecycleStage'], _count: true }),
    db.capabilityAsset.groupBy({ by: ['category'], where: { isActive: true }, _count: true }),
    db.capabilityAsset.groupBy({ by: ['serviceLine'], where: { isActive: true, serviceLine: { not: null } }, _count: true }),
    db.company.groupBy({ by: ['country'], where: { country: { not: null } }, _count: true, orderBy: { _count: { country: 'desc' } }, take: 8 }),
  ]);

  // ── Company Engine ──
  const companiesByStatus: Record<string, number> = {};
  companiesByStatusRaw.forEach((r: any) => { companiesByStatus[r.status] = r._count; });

  const companiesByIndustry: Record<string, number> = {};
  companiesByIndustryRaw.forEach((r: any) => { companiesByIndustry[r.industry] = r._count; });

  const companiesByLifecycle: Record<string, number> = {};
  companiesByLifecycleRaw.forEach((r: any) => { companiesByLifecycle[r.lifecycleStage] = r._count; });

  const companiesByCountry: Record<string, number> = {};
  companiesByCountryRaw.forEach((r: any) => { companiesByCountry[r.country] = r._count; });

  const topScoredCompanies = safe(companies).slice(0, 5).map((c: any) => ({
    id: c.id, name: c.rawName || c.normalizedName, industry: c.industry,
    score: c.intelligenceScore || 0, status: c.status, lifecycleStage: c.lifecycleStage,
  }));

  const unreadSignals = safe(signals);
  const criticalSignals = unreadSignals.filter((s: any) => s.severity === 'critical' || s.severity === 'high');

  // ── Email Engine ──
  const pendingDrafts = drafts.length;
  const pendingQueue = queueItems.length;
  const totalReplies = replies.length;
  const positiveReplies = replies.filter((r: any) => r.category === 'positive').length;
  const sentCount = contactsByStatusRaw.find((r: any) => r.status === 'sent')?._count || 0;
  const replyRate = sentCount > 0 ? Math.round((positiveReplies / sentCount) * 100) : 0;

  const contactsByStatus: Record<string, number> = {};
  contactsByStatusRaw.forEach((r: any) => { contactsByStatus[r.status] = r._count; });

  const avgLeadScore = totalContacts > 0
    ? Math.round(safe(contacts).reduce((sum: number, c: any) => sum + (c.leadScore || 0), 0) / safe(contacts).length)
    : 0;

  const highValueLeads = safe(contacts).filter((c: any) => (c.leadScore || 0) >= 70).slice(0, 5).map((c: any) => ({
    id: c.id, name: c.rawName, email: c.email, score: c.leadScore, company: c.companyId, status: c.status,
  }));

  // ── Capability Engine ──
  const totalCapabilities = capabilities.length;
  const capabilitiesByCategory: Record<string, number> = {};
  capsByCategoryRaw.forEach((r: any) => { capabilitiesByCategory[r.category] = r._count; });

  const capabilitiesByServiceLine: Record<string, number> = {};
  capsByServiceLineRaw.forEach((r: any) => { capabilitiesByServiceLine[r.serviceLine] = r._count; });

  const topCapabilities = safe(capabilities).sort((a: any, b: any) => (b.usedInEmails || 0) - (a.usedInEmails || 0)).slice(0, 5).map((c: any) => ({
    id: c.id, title: c.title, category: c.category, serviceLine: c.serviceLine,
    usedInEmails: c.usedInEmails || 0, upvotes: c.upvotes || 0,
  }));

  const activeSequences = sequences.length;

  // ── Recommendations (rule-based, preserved exactly) ──
  const recommendations: Array<{ type: string; priority: 'high' | 'medium' | 'low'; engine: string; title: string; description: string; actionScreen?: string }> = [];

  if (criticalSignals.length > 0)
    recommendations.push({ type: 'signal', priority: 'high', engine: 'company', title: `${criticalSignals.length} Critical Signals Detected`, description: `Act on ${criticalSignals.length} high-severity company signals (funding, leadership changes, tech shifts).`, actionScreen: 'companies' });
  if (pendingDrafts > 10)
    recommendations.push({ type: 'draft', priority: 'high', engine: 'email', title: `${pendingDrafts} Drafts Awaiting Review`, description: 'AI-generated drafts need your review before sending. Prioritize top-scoring drafts.', actionScreen: 'drafts' });
  if (pendingQueue > 0)
    recommendations.push({ type: 'queue', priority: 'medium', engine: 'email', title: `${pendingQueue} Emails in Send Queue`, description: 'Emails are scheduled for delivery. Monitor for bounces and replies.', actionScreen: 'queue' });
  if (highValueLeads.length > 0)
    recommendations.push({ type: 'lead', priority: 'high', engine: 'email', title: `${highValueLeads.length} High-Value Leads Ready for Outreach`, description: `Top lead: ${highValueLeads[0].name} (score: ${highValueLeads[0].score}). Generate drafts for these contacts.`, actionScreen: 'leads' });
  if (positiveReplies > 0)
    recommendations.push({ type: 'reply', priority: 'high', engine: 'email', title: `${positiveReplies} Positive Replies to Process`, description: 'Positive responses detected. Review and plan follow-up actions for warm leads.', actionScreen: 'replies' });
  if (totalCapabilities < 15)
    recommendations.push({ type: 'capability', priority: 'medium', engine: 'capability', title: 'Build Out Capability Library', description: `Only ${totalCapabilities} capabilities. Add case studies, proof points, and objection responses to improve email quality.`, actionScreen: 'capabilities' });
  if (avgLeadScore < 50)
    recommendations.push({ type: 'scoring', priority: 'low', engine: 'company', title: 'Lead Scores Below Average', description: `Average lead score is ${avgLeadScore}/100. Enrich company data to improve scoring.`, actionScreen: 'companies' });

  // ── Health Score (rule-based, preserved exactly) ──
  const healthScore = Math.min(100, Math.round(
    Math.min(totalCompanies / 500, 20) +
    Math.min(avgLeadScore / 5, 25) +
    Math.min(replyRate * 2, 20) +
    Math.min(totalCapabilities / 1, 15) +
    (pendingDrafts === 0 ? 10 : Math.max(10 - pendingDrafts / 50, 0)) +
    (criticalSignals.length === 0 ? 10 : Math.max(10 - criticalSignals.length, 0))
  ));

  const metricsCtx = {
    totalCompanies, totalContacts, topScoredCompanies,
    companiesByStatus, companiesByIndustry, companiesByLifecycle, companiesByCountry,
    unreadSignalCount: unreadSignals.length, criticalSignalCount: criticalSignals.length,
    latestSignals: unreadSignals.slice(0, 5).map((s: any) => ({ companyId: s.companyId, type: s.signalType, title: s.title, severity: s.severity })),
    pendingDrafts, pendingQueue, totalReplies, positiveReplies, replyRate,
    contactsByStatus, avgLeadScore, highValueLeads, activeSequences,
    totalCapabilities, capabilitiesByCategory, capabilitiesByServiceLine, topCapabilities,
    healthScore,
  };

  return {
    companyEngine: {
      totalCompanies, companiesByStatus, companiesByIndustry, companiesByLifecycle, companiesByCountry,
      topScoredCompanies, unreadSignalCount: unreadSignals.length, criticalSignalCount: criticalSignals.length,
      latestSignals: unreadSignals.slice(0, 5).map((s: any) => ({ id: s.id, companyId: s.companyId, type: s.signalType, title: s.title, severity: s.severity, createdAt: s.createdAt })),
    },
    emailEngine: { totalContacts, contactsByStatus, pendingDrafts, pendingQueue, totalReplies, positiveReplies, replyRate, avgLeadScore, highValueLeads, activeSequences },
    capabilityEngine: { totalCapabilities, capabilitiesByCategory, capabilitiesByServiceLine, topCapabilities },
    recommendations: recommendations.sort((a, b) => ({ high: 0, medium: 1, low: 2 } as any)[a.priority] - ({ high: 0, medium: 1, low: 2 } as any)[b.priority]),
    healthScore,
    metricsCtx, // internal — used for AI prompt, stripped before response
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// GET handler
// ═══════════════════════════════════════════════════════════════════════════

export async function GET() {
  try {
    // ── Run DB queries and cache check IN PARALLEL via Promise.all ──
    //    On cache hit, the AI result is available the instant DB queries finish.
    //    On cache miss, we fall through to an AI call after DB data arrives.
    const [dbResult, cachedAI] = await Promise.all([
      fetchDBMetrics(),
      // Synchronous cache probe — resolves in a microtask alongside the DB round-trip
      Promise.resolve(aiCache && Date.now() - aiCache.ts < AI_CACHE_TTL ? aiCache.data : null),
    ] as const);

    let aiResult = cachedAI;

    // ── Cache miss → run AI analysis with the freshly gathered metrics ──
    if (!aiResult) {
      try {
        const metricsContext = buildMetricsContext(dbResult.metricsCtx);
        aiResult = await generateAIInsights(dbResult.healthScore, metricsContext);
        aiCache = { data: aiResult, ts: Date.now() };
      } catch (aiError) {
        console.error('[Command Center Insights] AI analysis failed, returning rule-based data:', aiError);
        aiResult = null; // Graceful fallback — response just omits AI fields
      }
    }

    // ── Build response — same shape + optional AI fields ──
    const { metricsCtx, ...responseData } = dbResult;
    const response: Record<string, any> = { ...responseData };

    if (aiResult) {
      response.aiSummary = aiResult.aiSummary;
      response.aiStrategicInsights = aiResult.aiStrategicInsights;
      response.aiHealthAnalysis = aiResult.aiHealthAnalysis;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Command Center Insights]', error);
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 });
  }
}