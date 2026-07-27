import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ModelRouter } from '@/lib/engines/model-router';

/* ═══════════════════════════════════════════════════════════════════════════
   COMMAND CENTER — Personalized Morning Intelligence Brief
   
   NOT a metrics dashboard. An executive brief that tells a VP Sales:
   - Which companies to attack today
   - Why now (signals, evidence)
   - Who to contact (decision makers)
   - What to say (recommended actions)
   - What evidence supports this
   
   "Can a VP Sales open DeepMindQ every morning and immediately know 
    where to focus and why?"
   
   AI insights cached 5 minutes. Graceful fallback to rule-based data.
   ═══════════════════════════════════════════════════════════════════════════ */

// ── Cache ──
let aiCache: { data: MorningBriefAI; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface MorningBriefAI {
  greeting: string;
  executiveSummary: string;
  topTargets: Array<{
    companyId: string;
    companyName: string;
    industry: string;
    intelligenceScore: number;
    whyNow: string[];
    decisionMakers: Array<{ name: string; title: string; email: string }>;
    recommendedAction: string;
    suggestedMessage: string;
    evidenceCount: number;
    signalCount: number;
    confidence: number;
  }>;
  newIntelligence: Array<{
    companyId: string;
    companyName: string;
    signal: string;
    severity: string;
    date: string;
  }>;
  actionsDue: Array<{
    companyId: string;
    companyName: string;
    action: string;
    urgency: string;
  }>;
  pipelineHealth: {
    totalCompanies: number;
    enriched: number;
    totalSignals: number;
    totalContacts: number;
    highValueTargets: number;
  };
}

// ── LLM helper ──
async function callBriefAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const result = await ModelRouter.complete({
    systemPrompt,
    userPrompt,
    tier: 'smart',
    maxTokens: 4096,
    temperature: 0.5,
    genType: 'command_center_morning_brief',
  });
  if (!result.success) throw new Error(result.error || 'AI brief failed');
  return result.text;
}

// ── Fetch data for the morning brief ──
async function fetchMorningBriefData() {
  const [
    // User info
    user,
    // Top-scored companies with signals and contacts
    topCompanies,
    // Recent signals (last 7 days)
    recentSignals,
    // Pipeline stats
    totalCompanies,
    enrichedCount,
    totalSignals,
    totalContacts,
  ] = await Promise.all([
    db.user.findFirst({ select: { name: true, email: true } }),
    // Top companies by intelligence score that have signals
    db.company.findMany({
      where: {
        intelligenceScore: { gt: 0 },
        signals: { some: {} },
      },
      include: {
        signals: {
          where: { severity: { in: ['high', 'critical'] } },
          select: { title: true, severity: true, recommendedAction: true, signalType: true, confidence: true },
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
        contacts: {
          select: { rawName: true, title: true, email: true, leadScore: true, role: true },
          take: 5,
          orderBy: { leadScore: 'desc' },
        },
        evidence: { select: { id: true } },
        researchCard: {
          select: { businessOverview: true, keyDecisionMakers: true, industry: true },
        },
      },
      orderBy: { intelligenceScore: 'desc' },
      take: 10,
    }),
    // Latest unread signals across all companies
    db.companySignal.findMany({
      where: { isRead: false },
      include: {
        company: { select: { id: true, rawName: true, industry: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    db.company.count(),
    db.company.count({ where: { lastEnrichedAt: { not: null } } }),
    db.companySignal.count(),
    db.contact.count(),
  ]);

  // If no scored companies yet, get companies with most contacts
  let displayCompanies = topCompanies;
  if (displayCompanies.length === 0) {
    displayCompanies = await db.company.findMany({
      include: {
        signals: {
          select: { title: true, severity: true, recommendedAction: true, signalType: true, confidence: true },
          take: 3,
          orderBy: { createdAt: 'desc' },
        },
        contacts: {
          select: { rawName: true, title: true, email: true, leadScore: true, role: true },
          take: 5,
          orderBy: { leadScore: 'desc' },
        },
        evidence: { select: { id: true } },
        researchCard: { select: { businessOverview: true, keyDecisionMakers: true, industry: true } },
      },
      orderBy: { intelligenceScore: 'desc' },
      take: 10,
    });
  }

  return {
    user,
    topCompanies: displayCompanies,
    recentSignals,
    stats: {
      totalCompanies,
      enriched: enrichedCount,
      totalSignals,
      totalContacts,
      highValueTargets: displayCompanies.filter(c => c.intelligenceScore >= 70).length,
    },
  };
}

// ── Generate AI morning brief ──
async function generateMorningBrief(data: Awaited<ReturnType<typeof fetchMorningBriefData>>): Promise<MorningBriefAI> {
  const userName = data.user?.name || 'User';
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  // Build company context for AI
  const companyContexts = data.topCompanies.slice(0, 5).map((c, i) => {
    const signals = c.signals.map(s => `  - [${s.severity.toUpperCase()}] ${s.title} (action: ${s.recommendedAction || 'Monitor'})`).join('\n');
    const contacts = c.contacts.slice(0, 3).map(ct => `  - ${ct.rawName} (${ct.title || ct.role || 'Unknown'}, ${ct.email}, score: ${ct.leadScore})`).join('\n');

    return `#${i + 1} ${c.rawName}
  Industry: ${c.industry || 'Unknown'}
  Intelligence Score: ${c.intelligenceScore}/100
  Contacts: ${c.contacts.length}
  Evidence Records: ${c.evidence.length}
  Signals:\n${signals || '  (none)'}
  Decision Makers:\n${contacts || '  (none)'}`;
  }).join('\n\n');

  const recentSignalsContext = data.recentSignals.slice(0, 5).map(s =>
    `  - [${s.severity.toUpperCase()}] ${s.company.rawName}: ${s.title}`
  ).join('\n');

  const systemPrompt = `You are the AI intelligence briefing officer for DeepMindQ, an AI Revenue Intelligence Operating System.

Generate a personalized morning intelligence brief for an enterprise sales leader. This brief must be ACTIONABLE and SPECIFIC — the leader should know exactly who to call and why.

Return ONLY valid JSON:
{
  "greeting": "${timeGreeting} ${userName}!",
  "executiveSummary": "2-3 sentence executive summary of today's revenue intelligence. Reference specific companies, signals, and data. Be direct and actionable.",
  "topTargets": [
    {
      "companyId": "company_id_from_input",
      "companyName": "from input",
      "industry": "from input",
      "intelligenceScore": "from input",
      "whyNow": ["reason1", "reason2", "reason3"],
      "decisionMakers": [{"name": "from input", "title": "from input", "email": "from input"}],
      "recommendedAction": "Specific action to take TODAY",
      "suggestedMessage": "Opening line for outreach — personalized, reference a signal",
      "evidenceCount": "from input",
      "signalCount": "from input",
      "confidence": 0.0-1.0
    }
  ],
  "newIntelligence": [
    {
      "companyId": "id",
      "companyName": "name",
      "signal": "signal title",
      "severity": "severity",
      "date": "recent date"
    }
  ],
  "actionsDue": [
    {
      "companyId": "id",
      "companyName": "name",
      "action": "what to do",
      "urgency": "immediate|this_week|this_month"
    }
  ]
}

RULES:
- topTargets: Max 5 companies. Pick the highest-value targets based on intelligence score and signal quality.
- whyNow: Extract specific "why now" reasons from signals. Not generic.
- suggestedMessage: Write a real opening line referencing the specific signal.
- newIntelligence: Include recently detected signals the user may not have seen.
- actionsDue: Based on recommendedActions from signals.
- Be specific, not generic. Reference actual company names, signal types, and data.`;

  const userPrompt = `TODAY'S INTELLIGENCE DATA:

PIPELINE STATUS:
- Total companies: ${data.stats.totalCompanies}
- Companies enriched: ${data.stats.enriched}
- Total signals detected: ${data.stats.totalSignals}
- Total contacts: ${data.stats.totalContacts}
- High-value targets (score >= 70): ${data.stats.highValueTargets}

TOP TARGET COMPANIES (ranked by intelligence score):
${companyContexts || 'No enriched companies yet. Run intelligence enrichment to generate signals.'}

RECENT SIGNALS (newest first):
${recentSignalsContext || 'No recent signals detected.'}

Generate the morning intelligence brief.`;

  const rawText = await callBriefAI(systemPrompt, userPrompt);

  // Parse response
  const cleaned = rawText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned) as MorningBriefAI;

  return {
    greeting: parsed.greeting || `${timeGreeting} ${userName}!`,
    executiveSummary: parsed.executiveSummary || 'Intelligence data is loading. Enrich companies to activate intelligence.',
    topTargets: Array.isArray(parsed.topTargets) ? parsed.topTargets.slice(0, 5) : [],
    newIntelligence: Array.isArray(parsed.newIntelligence) ? parsed.newIntelligence.slice(0, 10) : [],
    actionsDue: Array.isArray(parsed.actionsDue) ? parsed.actionsDue.slice(0, 5) : [],
    pipelineHealth: data.stats,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// GET handler
// ═══════════════════════════════════════════════════════════════════════════

export async function GET() {
  try {
    // Fetch data and check cache in parallel
    const [data, cachedAI] = await Promise.all([
      fetchMorningBriefData(),
      Promise.resolve(aiCache && Date.now() - aiCache.ts < CACHE_TTL ? aiCache.data : null),
    ]);

    let brief = cachedAI;

    if (!brief) {
      try {
        brief = await generateMorningBrief(data);
        aiCache = { data: brief, ts: Date.now() };
      } catch (aiError) {
        console.error('[Command Center] AI morning brief failed, returning rule-based fallback:', aiError);

        // Rule-based fallback
        const userName = data.user?.name || 'User';
        const hour = new Date().getHours();
        const timeGreeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

        brief = {
          greeting: `${timeGreeting} ${userName}!`,
          executiveSummary: `Your intelligence pipeline covers ${data.stats.totalCompanies} companies with ${data.stats.totalContacts} contacts. ${data.stats.totalSignals > 0 ? `${data.stats.totalSignals} signals have been detected.` : 'Run intelligence enrichment on your companies to activate AI signals.'} ${data.stats.enriched < data.stats.totalCompanies ? `${data.stats.totalCompanies - data.stats.enriched} companies are waiting for enrichment.` : 'All companies have been enriched.'}`,
          topTargets: data.topCompanies.slice(0, 5).map(c => ({
            companyId: c.id,
            companyName: c.rawName,
            industry: c.industry || 'Unknown',
            intelligenceScore: c.intelligenceScore || 0,
            whyNow: c.signals.slice(0, 3).map(s => s.title),
            decisionMakers: c.contacts.slice(0, 3).map(ct => ({
              name: ct.rawName,
              title: ct.title || ct.role || 'Unknown',
              email: ct.email,
            })),
            recommendedAction: c.signals[0]?.recommendedAction || 'Research this account',
            suggestedMessage: '',
            evidenceCount: c.evidence.length,
            signalCount: c.signals.length,
            confidence: c.signals[0]?.confidence || 0,
          })),
          newIntelligence: data.recentSignals.slice(0, 5).map(s => ({
            companyId: s.companyId,
            companyName: s.company.rawName,
            signal: s.title,
            severity: s.severity,
            date: s.createdAt.toISOString().split('T')[0],
          })),
          actionsDue: data.topCompanies
            .flatMap(c => c.signals.map(s => ({
              companyId: c.id,
              companyName: c.rawName,
              action: s.recommendedAction || s.title,
              urgency: s.severity === 'critical' ? 'immediate' : s.severity === 'high' ? 'this_week' : 'this_month',
            })))
            .slice(0, 5),
          pipelineHealth: data.stats,
        };
      }
    }

    return NextResponse.json(brief);
  } catch (error) {
    console.error('[Command Center]', error);
    return NextResponse.json({ error: 'Failed to generate morning brief' }, { status: 500 });
  }
}
