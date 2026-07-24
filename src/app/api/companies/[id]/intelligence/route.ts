import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════════════════════════════
   Types — AI Evidence Framework Compliant
   
   Every AI output must be:
   - Evidence-backed (web source + URL)
   - Confidence-scored (0-100%)
   - Actionable (specific recommended sales action)
   - Explainable (why this was detected)
   ═══════════════════════════════════════════════════════════════════════════ */

interface EvidenceBackedSignal {
  signal: string;
  whyDetected: string;
  evidenceSource: string;
  evidenceUrl: string;
  sourceDate: string;
  confidence: number; // 0-100
  businessImpact: string;
  recommendedAction: string;
  timing: string;      // Intelligence Object: timing window
  owner: string;       // Intelligence Object: who should act
  expiresAt: string | null; // Intelligence Object: when intelligence decays
}

interface EnhancedAiInsights {
  // Company Understanding
  companyUnderstanding: {
    overview: string;
    industryClassification: string;
    businessModel: string;
    revenueIndicators: string[];
    employeeSignals: string[];
    geographicPresence: string;
  };
  // Technology Intelligence
  technologyIntelligence: {
    techStack: string[];
    cloudUsage: string;
    digitalMaturity: string; // low | medium | high | advanced
    engineeringSignals: EvidenceBackedSignal[];
  };
  // Business Signals — evidence-backed with full chain
  businessSignals: EvidenceBackedSignal[];
  // Key Developments — each with evidence
  keyDevelopments: EvidenceBackedSignal[];
  // Outreach Intelligence
  outreachAngle: {
    angle: string;
    rationale: string;
    evidence: string;
    recommendedApproach: string;
    targetStakeholders: Array<{ role: string; focus: string; whyRelevant: string }>;
  };
  // Competitive Landscape
  competitors: Array<{ name: string; threat: 'low' | 'medium' | 'high'; evidence: string }>;
  // Web findings
  webFindings: Array<{ title: string; url: string; snippet: string; relevanceScore: number }>;
  // Metadata
  generatedAt: string;
  dataQuality: {
    webSourcesUsed: number;
    crmSignalsUsed: number;
    contactsAnalyzed: number;
    overallConfidence: number; // 0-100
  };
  // Wave 8A: Quality gate results
  qualityReport?: {
    overallStatus: string;
    overallScore: number;
    gates: Array<{ gate: string; status: string; score: number; message: string }>;
    objectCompleteness: number;
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Z-AI SDK helpers
   ═══════════════════════════════════════════════════════════════════════════ */

async function webSearch(query: string, num = 5) {
  const { webSearch: search } = await import('@/lib/ai-copilot/ai-caller');
  return search(query, num);
}

async function aiChat(systemPrompt: string, userPrompt: string): Promise<string> {
  const { callAI } = await import('@/lib/ai-copilot/ai-caller');
  const result = await callAI({ systemPrompt, userPrompt, feature: 'company_intelligence', runQualityCheck: false });
  return result.raw;
}

/**
 * Parse the LLM text response into the EnhancedAiInsights shape.
 */
function parseAiResponse(raw: string): EnhancedAiInsights | null {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    return normalizeInsights(parsed);
  } catch {
    // Regex fallback for partial parse
  }

  try {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return normalizeInsights(parsed);
    }
  } catch {
    // Fall through
  }

  return null;
}

function normalizeInsights(obj: Record<string, unknown>): EnhancedAiInsights {
  const safeArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map(String).filter(Boolean) : [];
  const safeStr = (v: unknown, fallback = ''): string =>
    typeof v === 'string' ? v : fallback;

  const normalizeSignal = (s: unknown): EvidenceBackedSignal => {
    const sig = (s && typeof s === 'object') ? s as Record<string, unknown> : {};
    return {
      signal: safeStr(sig.signal, 'Unknown signal'),
      whyDetected: safeStr(sig.whyDetected, 'Not specified'),
      evidenceSource: safeStr(sig.evidenceSource, 'Not specified'),
      evidenceUrl: safeStr(sig.evidenceUrl, ''),
      sourceDate: safeStr(sig.sourceDate, new Date().toISOString().split('T')[0]),
      confidence: typeof sig.confidence === 'number' ? Math.min(100, Math.max(0, Math.round(sig.confidence))) : 50,
      businessImpact: safeStr(sig.businessImpact, 'Not assessed'),
      recommendedAction: safeStr(sig.recommendedAction, 'Not specified'),
      timing: safeStr(sig.timing, 'within_30_days'),
      owner: safeStr(sig.owner, 'Unassigned'),
      expiresAt: sig.expiresAt ? String(sig.expiresAt) : null,
    };
  };

  const businessSignals = Array.isArray(obj.businessSignals)
    ? obj.businessSignals.map(normalizeSignal).slice(0, 10)
    : [];

  const keyDevelopments = Array.isArray(obj.keyDevelopments)
    ? obj.keyDevelopments.map(normalizeSignal).slice(0, 8)
    : [];

  const engSignals = Array.isArray(obj.engineeringSignals)
    ? obj.engineeringSignals.map(normalizeSignal).slice(0, 5)
    : [];

  const companyUnderstanding = (obj.companyUnderstanding && typeof obj.companyUnderstanding === 'object')
    ? obj.companyUnderstanding as Record<string, unknown>
    : {};

  const techIntel = (obj.technologyIntelligence && typeof obj.technologyIntelligence === 'object')
    ? obj.technologyIntelligence as Record<string, unknown>
    : {};

  const outreach = (obj.outreachAngle && typeof obj.outreachAngle === 'object')
    ? obj.outreachAngle as Record<string, unknown>
    : {};

  const targetStakeholders = Array.isArray(outreach.targetStakeholders)
    ? outreach.targetStakeholders
        .filter((e: unknown) => e && typeof e === 'object')
        .map((e: unknown) => {
          const t = e as Record<string, unknown>;
          return { role: safeStr(t.role), focus: safeStr(t.focus), whyRelevant: safeStr(t.whyRelevant) };
        })
        .slice(0, 6)
    : [];

  const competitors = Array.isArray(obj.competitors)
    ? obj.competitors
        .filter((c: unknown) => c && typeof c === 'object')
        .map((c: unknown) => {
          const comp = c as Record<string, unknown>;
          return {
            name: safeStr(comp.name, 'Unknown'),
            threat: (() => { const v = String(comp.threat ?? 'medium'); return (['low', 'medium', 'high'] as const).includes(v as 'low' | 'medium' | 'high') ? v as 'low' | 'medium' | 'high' : 'medium'; })(),
            evidence: safeStr(comp.evidence),
          };
        })
        .slice(0, 8)
    : [];

  const webFindings = Array.isArray(obj.webFindings)
    ? obj.webFindings
        .filter((w: unknown) => w && typeof w === 'object')
        .map((w: unknown) => {
          const wf = w as Record<string, unknown>;
          return {
            title: safeStr(wf.title),
            url: safeStr(wf.url),
            snippet: safeStr(wf.snippet),
            relevanceScore: typeof wf.relevanceScore === 'number' ? wf.relevanceScore : 0.5,
          };
        })
    : [];

  const dataQuality = (obj.dataQuality && typeof obj.dataQuality === 'object')
    ? obj.dataQuality as Record<string, unknown>
    : {};

  return {
    companyUnderstanding: {
      overview: safeStr(companyUnderstanding.overview),
      industryClassification: safeStr(companyUnderstanding.industryClassification),
      businessModel: safeStr(companyUnderstanding.businessModel),
      revenueIndicators: safeArr(companyUnderstanding.revenueIndicators),
      employeeSignals: safeArr(companyUnderstanding.employeeSignals),
      geographicPresence: safeStr(companyUnderstanding.geographicPresence),
    },
    technologyIntelligence: {
      techStack: safeArr(techIntel.techStack).slice(0, 15),
      cloudUsage: safeStr(techIntel.cloudUsage),
      digitalMaturity: ['low', 'medium', 'high', 'advanced'].includes(String(techIntel.digitalMaturity ?? '')) ? String(techIntel.digitalMaturity) : 'medium',
      engineeringSignals: engSignals,
    },
    businessSignals,
    keyDevelopments,
    outreachAngle: {
      angle: safeStr(outreach.angle, 'Not determined'),
      rationale: safeStr(outreach.rationale),
      evidence: safeStr(outreach.evidence),
      recommendedApproach: safeStr(outreach.recommendedApproach),
      targetStakeholders,
    },
    competitors,
    webFindings,
    generatedAt: new Date().toISOString(),
    dataQuality: {
      webSourcesUsed: typeof dataQuality.webSourcesUsed === 'number' ? dataQuality.webSourcesUsed : 0,
      crmSignalsUsed: typeof dataQuality.crmSignalsUsed === 'number' ? dataQuality.crmSignalsUsed : 0,
      contactsAnalyzed: typeof dataQuality.contactsAnalyzed === 'number' ? dataQuality.contactsAnalyzed : 0,
      overallConfidence: typeof dataQuality.overallConfidence === 'number' ? dataQuality.overallConfidence : 50,
    },
  };
}

/**
 * Full pipeline: web search → AI analysis with live context
 * Enhanced with Evidence Framework — every output is explainable and actionable
 */
async function generateIntelligence(
  companyName: string,
  industry: string | null,
  domain: string | null,
  location: string | null,
  country: string | null,
  sizeRange: string | null,
  existingResearch: string,
  signalSummaries: string,
  contactSummaries: string,
): Promise<EnhancedAiInsights | null> {
  try {
    // Step 1: Search the web for real-time company data
    const searchQueries = [
      `${companyName} ${industry || ''} company overview recent news 2025 2026`,
      `${companyName || ''} ${domain || ''} technology stack cloud engineering`,
      `${companyName || ''} competitors ${industry || ''} market landscape`,
      `${companyName || ''} hiring growth funding revenue employees`,
    ];

    const searchResults = await Promise.all(
      searchQueries.map(q => webSearch(q, 5)),
    );

    // Flatten and deduplicate
    const allResults = searchResults.flat();
    const seen = new Set<string>();
    const uniqueResults = allResults.filter(r => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });

    // Step 2: Build context from web results
    const webContext = uniqueResults
      .slice(0, 15)
      .map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}\n   URL: ${r.url}`)
      .join('\n\n');

    // Step 3: Enhanced AI analysis — Evidence Framework + Intelligence Object prompt
    const systemPrompt = `You are a senior enterprise sales intelligence analyst. Your outputs must be evidence-backed, specific, and actionable.

CRITICAL RULES:
1. Every signal MUST include the complete Intelligence Object (8 fields): signal, evidence, confidence, businessImpact, recommendedAction, timing, owner, expiresAt.
2. NEVER output vague statements like "Company may need X". Instead: "Company hired 15 cloud engineers in Q1 2026 according to LinkedIn job postings (source URL). Confidence: 85%. Impact: Cloud migration opportunity. Action: Position cloud optimization assessment. Timing: within_7_days."
3. Ground every claim in the web search results. If information is sparse, lower confidence scores accordingly.
4. Be specific about technology, timing, and business context.
5. Every competitor mention must include evidence of why they are a competitor.
6. The outreach angle must be specific enough for a sales rep to use in a first meeting.

TIMING OPTIONS: "immediate" (act now), "within_7_days", "within_30_days", "within_90_days", "ongoing" (continuous), "expired" (past window)
OWNER: Specify who should act — role or team (e.g., "Enterprise AE — West Region", "SDR Team", "VP Sales")
EXPIRY: ISO date when intelligence becomes stale (typically 90 days from source date, or null for ongoing)

OUTPUT FORMAT: Valid JSON only.`;

    const userPrompt = `Analyze this company using BOTH the web search results and the CRM data.

── CRM DATA ──
Company Name: ${companyName}
Industry: ${industry || 'Unknown'}
Domain: ${domain || 'Unknown'}
Location: ${location || 'Unknown'}, ${country || 'Unknown'}
Size: ${sizeRange || 'Unknown'}

Existing Research:
${existingResearch}

Recent Signals (from CRM):
${signalSummaries || 'No recent signals in CRM.'}

Top Contacts (from CRM):
${contactSummaries || 'No contacts in CRM.'}

── LIVE WEB RESULTS (${uniqueResults.length} sources) ──
${webContext || 'No web results found.'}

── REQUIRED OUTPUT FORMAT ──
Generate evidence-backed intelligence. Return valid JSON:

{
  "companyUnderstanding": {
    "overview": "2-3 sentence overview grounded in web + CRM data",
    "industryClassification": "primary + secondary industry",
    "businessModel": "how they make money",
    "revenueIndicators": ["revenue signal 1 with source", "revenue signal 2 with source"],
    "employeeSignals": ["hiring/firing signal 1 with source", "signal 2 with source"],
    "geographicPresence": "where they operate"
  },
  "technologyIntelligence": {
    "techStack": ["tech 1", "tech 2", ...],
    "cloudUsage": "cloud provider and maturity description",
    "digitalMaturity": "low|medium|high|advanced",
    "engineeringSignals": [
      {
        "signal": "specific engineering signal",
        "whyDetected": "why we know this",
        "evidenceSource": "source name",
        "evidenceUrl": "https://...",
        "sourceDate": "YYYY-MM-DD",
        "confidence": 85,
        "businessImpact": "what this means for sales",
        "recommendedAction": "specific action sales team should take",
        "timing": "within_7_days",
        "owner": "Enterprise AE",
        "expiresAt": "2026-09-15"
      }
    ]
  },
  "businessSignals": [
    {
      "signal": "specific business signal",
      "whyDetected": "why this was detected",
      "evidenceSource": "source name with URL reference",
      "evidenceUrl": "https://...",
      "sourceDate": "YYYY-MM-DD",
      "confidence": 80,
      "businessImpact": "specific business impact",
      "recommendedAction": "specific recommended sales action",
      "timing": "within_30_days",
      "owner": "SDR Team",
      "expiresAt": "2026-10-15"
    }
  ],
  "keyDevelopments": [
    {
      "signal": "specific recent development",
      "whyDetected": "why this matters",
      "evidenceSource": "source",
      "evidenceUrl": "https://...",
      "sourceDate": "YYYY-MM-DD",
      "confidence": 90,
      "businessImpact": "impact description",
      "recommendedAction": "what to do about it",
      "timing": "immediate",
      "owner": "VP Sales",
      "expiresAt": "2026-08-15"
    }
  ],
  "outreachAngle": {
    "angle": "Best B2B outreach angle based on evidence",
    "rationale": "Why this angle works NOW",
    "evidence": "Evidence supporting this angle",
    "recommendedApproach": "warm intro | direct | event-based | referral | content-based",
    "targetStakeholders": [
      { "role": "CIO", "focus": "what they care about", "whyRelevant": "why approach this person" }
    ]
  },
  "competitors": [
    { "name": "Competitor Name", "threat": "low|medium|high", "evidence": "evidence of competition" }
  ],
  "webFindings": ${JSON.stringify(uniqueResults.slice(0, 10))},
  "dataQuality": {
    "webSourcesUsed": ${uniqueResults.length},
    "crmSignalsUsed": ${(signalSummaries || '').split('\n').filter(Boolean).length},
    "contactsAnalyzed": ${(contactSummaries || '').split('\n').filter(Boolean).length},
    "overallConfidence": <0-100>
  }
}

Be SPECIFIC. Reference real information from web results. Every signal needs evidence.`;

    const raw = await aiChat(systemPrompt, userPrompt);
    const insights = parseAiResponse(raw);

    if (insights) {
      insights.webFindings = uniqueResults.slice(0, 10).map(r => ({
        ...r,
        relevanceScore: r.snippet ? 0.5 : 0.3,
      }));
      insights.dataQuality.webSourcesUsed = uniqueResults.length;
    }

    return insights;
  } catch (e) {
    console.error('[intelligence] AI generation failed:', e);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   GET /api/companies/[id]/intelligence
   ═══════════════════════════════════════════════════════════════════════════ */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: companyId } = await params;

    // 1. Fetch the company
    const company = await db.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 2. Fetch related data in parallel
    const [researchCard, contacts, signals, notes, timeline] = await Promise.all([
      db.companyResearchCard.findUnique({ where: { companyId } }),
      db.contact.findMany({
        where: { companyId },
        take: 5,
        orderBy: { leadScore: 'desc' },
      }),
      db.companySignal.findMany({
        where: { companyId },
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
      db.companyNote.findMany({
        where: { companyId },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
      db.companyTimelineEvent.findMany({
        where: { companyId },
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // 3. AI Intelligence via z-ai-web-dev-sdk (web search + LLM)
    const signalSummaries = signals
      .map((s) => `[${s.signalType}] ${s.title}${s.description ? ': ' + s.description : ''}`)
      .join('\n');

    const existingResearch = researchCard
      ? [
          researchCard.businessOverview && `Business Overview: ${researchCard.businessOverview}`,
          researchCard.techLandscape && `Tech Landscape: ${researchCard.techLandscape}`,
          researchCard.potentialChallenges && `Challenges: ${researchCard.potentialChallenges}`,
          researchCard.techStack && `Known Tech: ${researchCard.techStack}`,
        ]
          .filter(Boolean)
          .join('\n')
      : 'No existing research card.';

    const contactSummaries = contacts
      .map((c) => `${c.rawName} — ${c.title || c.role || 'Unknown role'} (score: ${c.leadScore})`)
      .join('\n');

    // Generate enhanced intelligence with Evidence Framework
    const aiInsights = await generateIntelligence(
      company.rawName,
      company.industry,
      company.domain,
      company.location,
      company.country,
      company.sizeRange,
      existingResearch,
      signalSummaries,
      contactSummaries,
    );

    return NextResponse.json({
      company: {
        id: company.id,
        rawName: company.rawName,
        industry: company.industry,
        domain: company.domain,
        location: company.location,
        country: company.country,
        sizeRange: company.sizeRange,
        status: company.status,
        intelligenceScore: company.intelligenceScore,
        engagementScore: company.engagementScore,
        website: company.website,
      },
      researchCard,
      contacts,
      signals,
      notes,
      timeline,
      aiInsights,
    });
  } catch (error) {
    console.error('[intelligence] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate company intelligence' },
      { status: 500 },
    );
  }
}
