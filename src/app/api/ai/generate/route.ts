import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════
   POST /api/ai/generate
   AI-powered email draft generation.

   Uses z-ai-web-dev-sdk when available (local),
   falls back to a template engine on Vercel where
   the SDK's internal API is unreachable.

   Body parameters:
   - name (required): Contact name
   - email: Contact email
   - title: Job title
   - company: Company name
   - industry: Industry
   - companySize: Startup | Mid-Market | Enterprise
   - tone: professional | casual | executive
   - additionalContext: Extra context about the prospect
   - serviceLine: Preferred service line to pitch
   - problems: Known pain points / problems to address
   - knowledgeSearchMode: keyword | semantic | hybrid
   - knowledgeMinScore: Minimum relevance score for knowledge results
   - excludeCategories: Categories to exclude from knowledge search
   ═══════════════════════════════════════════════════ */

/* ── Internal: call knowledge retrieval API ── */
async function retrieveKnowledge(params: {
  query: string;
  industry?: string;
  role?: string;
  companySize?: string;
  serviceLine?: string;
  problems?: string;
  searchMode?: string;
  minRelevanceScore?: number;
  category?: string;
  excludeCategories?: string[];
  includeContent?: boolean;
  limit?: number;
}) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
    const url = baseUrl
      ? `${baseUrl}/api/knowledge/search`
      : 'http://localhost:3000/api/knowledge/search';

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: params.query,
        industry: params.industry,
        role: params.role,
        companySize: params.companySize,
        serviceLine: params.serviceLine,
        problems: params.problems,
        searchMode: params.searchMode || 'hybrid',
        minRelevanceScore: params.minRelevanceScore ?? 20,
        category: params.category,
        excludeCategories: params.excludeCategories,
        includeContent: params.includeContent ?? true,
        limit: params.limit || 8,
      }),
    });
    const data = await res.json();
    return data.results || [];
  } catch (err) {
    console.error('Knowledge retrieval failed, using fallback:', err);
    return [];
  }
}

/* ── Template-based draft generator (fallback when AI SDK is unavailable) ── */
function generateTemplateDraft(
  name: string,
  title: string | undefined,
  company: string | undefined,
  industry: string | undefined,
  companySize: string | undefined,
  tone: string,
  capabilities: Array<{
    id: string;
    title: string;
    summary: string;
    category: string;
    relevanceScore: number;
    serviceLine?: string;
    content?: string;
  }>
) {
  // Find best matching service line and case study
  const serviceLines = capabilities
    .filter(c => c.category === 'service_line')
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
  const caseStudies = capabilities
    .filter(c => c.category === 'case_study')
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
  const proofPoints = capabilities
    .filter(c => c.category === 'proof_point')
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
  const ctas = capabilities
    .filter(c => c.category === 'cta')
    .sort((a, b) => b.relevanceScore - a.relevanceScore);

  const bestSL = serviceLines[0];
  const bestCS = caseStudies[0];
  const bestPP = proofPoints[0];
  const bestCTA = ctas[0] || { title: '15-Minute Discovery Call', summary: 'Would you be open to a brief 15-minute call to explore how this might apply to your team?' };

  // Build company-specific observation
  let observation = '';
  if (industry) {
    const industryInsights: Record<string, string> = {
      'financial services': 'the increasing regulatory pressure and the need for faster processing',
      'healthcare': 'the shift toward value-based care and data interoperability requirements',
      'technology': 'the challenge of scaling engineering teams while maintaining quality',
      'manufacturing': 'the pressure to digitize operations and improve supply chain visibility',
      'retail': 'the need for real-time inventory intelligence and personalization at scale',
      'energy': 'the transition to renewable sources and grid modernization challenges',
      'media': 'content monetization challenges and the shift to streaming models',
      'government': 'modernization of legacy systems and improving citizen service delivery',
    };
    observation = industryInsights[industry.toLowerCase()] || `the evolving landscape in ${industry}`;
  } else if (company) {
    observation = `the growth trajectory at ${company}`;
  }

  // Build tone-adjusted openings
  const openings: Record<string, string[]> = {
    professional: [
      `Hi ${name},`,
      `Dear ${name},`,
    ],
    casual: [
      `Hey ${name},`,
      `Hi ${name} —`,
    ],
    executive: [
      `${name},`,
      `Hi ${name},`,
    ],
  };
  const toneOpenings = openings[tone] || openings.professional;
  const opening = toneOpenings[Math.floor(Math.random() * toneOpenings.length)];

  // Build the subject line
  let subject = '';
  if (bestSL && bestCS) {
    subject = `${bestSL.title} for ${company || 'your team'} — ${bestCS.evidence || 'a proven approach'}`;
  } else if (bestSL) {
    subject = `How ${company || 'your organization'} could benefit from ${bestSL.title}`;
  } else {
    subject = `A relevant approach for ${company || 'your team'}`;
  }
  // Truncate subject if too long
  if (subject.length > 100) subject = subject.slice(0, 97) + '...';

  // Build the body
  let body = `${opening}\n\n`;

  // Opening observation
  if (title && company) {
    body += `Given your role as ${title} at ${company} and ${observation}, I thought this might be relevant.\n\n`;
  } else if (company) {
    body += `Given ${observation}, I thought this might be relevant to ${company}.\n\n`;
  } else {
    body += `Given ${observation}, I thought this might be relevant to you.\n\n`;
  }

  // Service line pitch
  if (bestSL) {
    body += `We specialize in ${bestSL.summary.toLowerCase()} `;
    if (bestPP) {
      body += `— ${bestPP.summary.toLowerCase()} `;
    }
    body += '\n\n';
  }

  // Case study evidence
  if (bestCS) {
    body += `For example, ${bestCS.summary.charAt(0).toLowerCase() + bestCS.summary.slice(1)}`;
    if (bestCS.evidence) {
      body += ` (${bestCS.evidence})`;
    }
    body += '\n\n';
  }

  // CTA
  const ctaText = bestCTA.summary || 'Would you be open to a brief 15-minute call to explore how this might apply to your team?';
  body += ctaText;

  // Clean up double spaces and excessive newlines
  body = body.replace(/\n{3,}/g, '\n\n').trim();

  // Confidence score based on how much we matched
  let confidence = 50;
  if (bestSL) confidence += 10;
  if (bestCS) confidence += 15;
  if (industry) confidence += 5;
  if (title) confidence += 5;
  if (company) confidence += 5;
  if (bestPP) confidence += 5;
  confidence = Math.min(95, confidence);

  // Assumptions
  const assumptions: string[] = [];
  if (!industry) assumptions.push('Industry not specified — used general approach');
  if (!title) assumptions.push('Job title not provided — could not tailor to role-specific pain points');
  if (!company) assumptions.push('Company name not provided — could not reference specific context');
  if (companySize) assumptions.push(`Assumed needs typical for ${companySize} companies`);
  if (bestCS && industry && !bestCS.targetIndustries?.toLowerCase().includes(industry.toLowerCase())) {
    assumptions.push(`Case study is from a different industry — may need adaptation`);
  }
  if (assumptions.length === 0) assumptions.push('All key parameters provided — high confidence match');

  // Source snippets
  const sourceSnippets = capabilities.slice(0, 5).map(cap => ({
    id: cap.id,
    title: cap.title,
    snippetType: cap.category,
    relevanceScore: cap.relevanceScore,
  }));

  return {
    subject,
    body,
    cta: ctaText,
    confidenceScore: confidence,
    assumptions,
    sourceSnippets,
    generatedAt: new Date().toISOString(),
    generationMethod: 'template' as const,
  };
}

/* ── Try AI SDK generation ── */
async function generateWithAI(
  name: string,
  email: string | undefined,
  title: string | undefined,
  company: string | undefined,
  industry: string | undefined,
  companySize: string | undefined,
  tone: string,
  additionalContext: string | undefined,
  capabilities: Array<{ id: string; title: string; summary: string; category: string; relevanceScore: number; content?: string }>
) {
  let ZAI: any;
  try {
    ZAI = (await import('z-ai-web-dev-sdk')).default;
  } catch {
    throw new Error('SDK_NOT_AVAILABLE');
  }

  const capabilityContext = capabilities
    .map(cap => `[${cap.category}] ${cap.title}: ${cap.content || cap.summary}`)
    .join('\n');

  const toneInstruction: Record<string, string> = {
    professional: 'Write in a polished, business-professional tone. Confident but not aggressive.',
    casual: 'Write in a warm, conversational tone. Friendly and approachable, like a peer reaching out.',
    executive: 'Write in a concise, C-suite appropriate tone. Direct, data-driven, respectful of their time.',
  };

  const systemPrompt = `You are an expert B2B sales email writer for DeepMindQ, a technology services company specializing in AI, Cloud Engineering, Data Engineering, and Digital Transformation.

${toneInstruction[tone] || toneInstruction.professional}

Write a personalized, concise outbound email (under 150 words) that:
- Opens with a specific, relevant observation about the prospect's company, role, or industry
- Naturally connects to a DeepMindQ capability (ONLY use the provided capability library — never invent services)
- Ends with a soft, low-friction call-to-action
- Sounds human and authentic — no buzzwords like "delve", "leverage", "synergy", "revolutionize", "paradigm shift"
- Is professional but conversational
- NEVER mention pricing or make unsubstantiated claims
- NEVER use generic templates — every email must feel unique to this specific prospect

The following capabilities were retrieved from the knowledge base based on relevance (scores shown):
${capabilities.map(c => `  - [${c.relevanceScore}%] ${c.title} (${c.category})`).join('\n')}

Prioritize the highest-scored capabilities.

You MUST respond with valid JSON in this exact format (no markdown, no code fences):
{"subject": "email subject line", "body": "email body text", "cta": "call to action text", "confidence_score": 75, "assumptions": ["any assumptions made"]}`;

  const userPrompt = `Write a personalized outreach email for this prospect:

**Contact:** ${name}
**Title:** ${title || 'Unknown'}
**Company:** ${company || 'Unknown'}
**Industry:** ${industry || 'Unknown'}
**Company Size:** ${companySize || 'Unknown'}
**Email:** ${email || 'Not provided'}
${additionalContext ? `**Additional Context:**\n${additionalContext}` : ''}

**DeepMindQ Capabilities (retrieved from knowledge base):**
${capabilityContext}

Write the email now. Respond with JSON only.`;

  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    thinking: { type: 'disabled' },
  });

  let aiResponse = completion.choices[0]?.message?.content || '';
  aiResponse = aiResponse.trim();
  if (aiResponse.startsWith('```')) {
    aiResponse = aiResponse
      .replace(/^```(?:json)?\n?/, '')
      .replace(/\n?```$/, '');
  }

  let parsed: {
    subject: string;
    body: string;
    cta: string;
    confidence_score: number;
    assumptions?: string[];
  };

  try {
    parsed = JSON.parse(aiResponse);
  } catch {
    const lines = aiResponse.split('\n').filter(Boolean);
    parsed = {
      subject: lines[0]?.replace(/^subject:\s*/i, '').slice(0, 100) || 'Introduction to DeepMindQ',
      body: lines.slice(1).join('\n').slice(0, 1000) || aiResponse,
      cta: 'Would you be open to a brief 15-minute call this week?',
      confidence_score: 50,
      assumptions: ['AI response was not valid JSON — content may need review'],
    };
  }

  return {
    subject: parsed.subject || 'Draft email',
    body: parsed.body || '',
    cta: parsed.cta || '',
    confidenceScore: Math.min(100, Math.max(0, parsed.confidence_score || 50)),
    assumptions: parsed.assumptions || [],
    sourceSnippets: capabilities.slice(0, 5).map(cap => ({
      id: cap.id,
      title: cap.title,
      snippetType: cap.category,
      relevanceScore: cap.relevanceScore,
    })),
    generatedAt: new Date().toISOString(),
    generationMethod: 'ai' as const,
  };
}

/* ═══════════════════════════════════════════════════
   Main POST handler
   ═══════════════════════════════════════════════════ */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name,
      email,
      title,
      company,
      industry,
      companySize,
      tone = 'professional',
      additionalContext,
      serviceLine,
      problems,
      knowledgeSearchMode,
      knowledgeMinScore,
      excludeCategories,
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    // ── Build a rich search query from the prospect context ──
    const searchParts = [industry, title, company, problems, additionalContext].filter(Boolean);
    const searchQuery = searchParts.length > 0
      ? searchParts.join(' ')
      : 'enterprise technology solutions';

    // ── Retrieve relevant capabilities via knowledge search with ALL parameters ──
    const retrievedCapabilities = await retrieveKnowledge({
      query: searchQuery,
      industry: industry || undefined,
      role: title || undefined,
      companySize: companySize || undefined,
      serviceLine: serviceLine || undefined,
      problems: problems || undefined,
      searchMode: knowledgeSearchMode || 'hybrid',
      minRelevanceScore: knowledgeMinScore ?? 20,
      // Don't filter by category — get all types, but exclude CTAs from AI prompt
      excludeCategories: undefined,
      includeContent: true,
      limit: 10,
    });

    // ── Try AI generation first, fall back to template engine ──
    let draft;

    try {
      draft = await generateWithAI(
        name,
        email,
        title,
        company,
        industry,
        companySize,
        tone,
        additionalContext,
        retrievedCapabilities
      );
    } catch (aiError) {
      const errMsg = aiError instanceof Error ? aiError.message : 'Unknown error';
      console.warn(`AI SDK unavailable (${errMsg}), using template engine`);

      // Template engine needs all capabilities (no excludeCategories)
      draft = generateTemplateDraft(
        name,
        title,
        company,
        industry,
        companySize,
        tone,
        retrievedCapabilities
      );
    }

    return NextResponse.json({
      success: true,
      draft,
    });
  } catch (error) {
    console.error('AI generation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate draft: ' + (error instanceof Error ? error.message : 'Unknown error'),
      },
      { status: 500 }
    );
  }
}