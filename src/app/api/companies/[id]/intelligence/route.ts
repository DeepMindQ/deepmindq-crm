import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

interface AiInsights {
  businessOverview: string;
  keyDevelopments: string[];
  potentialChallenges: string[];
  outreachAngle: string;
  techStack: string[];
  competitors: string[];
}

/* ═══════════════════════════════════════════════════════════════
   AI Provider helpers
   ═══════════════════════════════════════════════════════════════ */

async function callGroq(prompt: string, systemPrompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Groq API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function callOpenAI(prompt: string, systemPrompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenAI API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function callGemini(prompt: string, systemPrompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const fullPrompt = `${systemPrompt}\n\n${prompt}`;

  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' +
      apiKey,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gemini API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

/**
 * Try AI providers in order: Groq → OpenAI → Gemini
 * Returns parsed AI insights or null on failure.
 */
async function generateAiInsights(prompt: string, systemPrompt: string): Promise<AiInsights | null> {
  const providers = [
    { name: 'Groq', fn: callGroq, key: 'GROQ_API_KEY' },
    { name: 'OpenAI', fn: callOpenAI, key: 'OPENAI_API_KEY' },
    { name: 'Gemini', fn: callGemini, key: 'GEMINI_API_KEY' },
  ];

  for (const provider of providers) {
    if (!process.env[provider.key]) continue;

    try {
      const raw = await provider.fn(prompt, systemPrompt);
      return parseAiResponse(raw);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[intelligence] ${provider.name} call failed: ${msg}`);
      // Try next provider
    }
  }

  return null;
}

/**
 * Parse the LLM text response into the AiInsights shape.
 * Handles JSON wrapped in markdown code fences or raw JSON.
 */
function parseAiResponse(raw: string): AiInsights | null {
  // Strip markdown code fences
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      businessOverview: String(parsed.businessOverview ?? ''),
      keyDevelopments: Array.isArray(parsed.keyDevelopments)
        ? parsed.keyDevelopments.map(String)
        : [],
      potentialChallenges: Array.isArray(parsed.potentialChallenges)
        ? parsed.potentialChallenges.map(String)
        : [],
      outreachAngle: String(parsed.outreachAngle ?? ''),
      techStack: Array.isArray(parsed.techStack) ? parsed.techStack.map(String) : [],
      competitors: Array.isArray(parsed.competitors) ? parsed.competitors.map(String) : [],
    };
  } catch {
    // Try regex-based extraction as a fallback
  }

  // Fallback: regex extraction
  const insights: AiInsights = {
    businessOverview: '',
    keyDevelopments: [],
    potentialChallenges: [],
    outreachAngle: '',
    techStack: [],
    competitors: [],
  };

  const boMatch = cleaned.match(/"businessOverview"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (boMatch) insights.businessOverview = boMatch[1].replace(/\\"/g, '"');

  const oaMatch = cleaned.match(/"outreachAngle"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (oaMatch) insights.outreachAngle = oaMatch[1].replace(/\\"/g, '"');

  const extractArrayItems = (key: string, target: string[]) => {
    const re = new RegExp('"' + key + '"\\s*:\\s*\\[([^\\]]*)\\]', 'g');
    let match: RegExpExecArray | null;
    while ((match = re.exec(cleaned)) !== null) {
      const items = match[1].match(/"((?:[^"\\]|\\.)*)"/g);
      if (items) target.push(...items.map((s) => s.replace(/"/g, '').replace(/\\"/g, '"')));
    }
  };

  extractArrayItems('keyDevelopments', insights.keyDevelopments);
  extractArrayItems('potentialChallenges', insights.potentialChallenges);
  extractArrayItems('techStack', insights.techStack);
  extractArrayItems('competitors', insights.competitors);

  // Only return if we got at least the businessOverview
  if (insights.businessOverview) return insights;
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   GET /api/companies/[id]/intelligence
   ═══════════════════════════════════════════════════════════════ */

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

    // 2-7. Fetch related data in parallel
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

    // 8. AI Enhancement
    let aiInsights: AiInsights | null = null;

    const hasAiKey =
      !!process.env.GROQ_API_KEY || !!process.env.OPENAI_API_KEY || !!process.env.GEMINI_API_KEY;

    if (hasAiKey) {
      // Build the context prompt
      const signalSummaries = signals
        .map((s) => `[${s.signalType}] ${s.title}${s.description ? ': ' + s.description : ''}`)
        .join('\n');

      const existingResearch = researchCard
        ? [
            researchCard.businessOverview && `Business Overview: ${researchCard.businessOverview}`,
            researchCard.techLandscape && `Tech Landscape: ${researchCard.techLandscape}`,
            researchCard.potentialChallenges && `Potential Challenges: ${researchCard.potentialChallenges}`,
            researchCard.techStack && `Known Tech Stack: ${researchCard.techStack}`,
          ]
            .filter(Boolean)
            .join('\n')
        : 'No existing research card.';

      const userPrompt = `Analyze the following company and generate intelligence insights.

Company Name: ${company.rawName}
Industry: ${company.industry || 'Unknown'}
Domain: ${company.domain || 'Unknown'}
Location: ${company.location || 'Unknown'}
Country: ${company.country || 'Unknown'}
Size Range: ${company.sizeRange || 'Unknown'}
Status: ${company.status}
Intelligence Score: ${company.intelligenceScore}/100
Engagement Score: ${company.engagementScore}/100

Existing Research Card:
${existingResearch}

Recent Signals (${signals.length}):
${signalSummaries || 'No recent signals.'}

Top Contacts (${contacts.length}):
${contacts.map((c) => `${c.rawName} — ${c.title || c.role || 'Unknown role'} (lead score: ${c.leadScore})`).join('\n') || 'No contacts.'}

Respond ONLY with valid JSON (no markdown, no code fences) in this exact format:
{
  "businessOverview": "2-3 sentence overview of what this company likely does",
  "keyDevelopments": ["development 1", "development 2", "development 3"],
  "potentialChallenges": ["challenge 1", "challenge 2"],
  "outreachAngle": "Suggested B2B outreach angle (1-2 sentences)",
  "techStack": ["technology 1", "technology 2", "technology 3"],
  "competitors": ["competitor 1", "competitor 2", "competitor 3"]
}

Provide 3-5 key developments, 2-3 potential challenges, and 3-5 likely competitors.`;

      const systemPrompt =
        'You are a B2B sales intelligence analyst. Your job is to analyze company data and generate actionable insights for sales outreach. Be specific, concise, and data-driven. Always respond with valid JSON only.';

      aiInsights = await generateAiInsights(userPrompt, systemPrompt);
    }

    // 10. Return the combined response
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
    console.error('[intelligence] Error generating company intelligence:', error);
    return NextResponse.json(
      { error: 'Failed to generate company intelligence' },
      { status: 500 },
    );
  }
}