import { NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

/* ═══════════════════════════════════════════════════
   POST /api/ai/generate
   Standalone AI draft generation — no database needed.
   Accepts contact info inline and returns a generated
   email draft using the z-ai-web-dev-sdk.

   Body: {
     name: string,
     email?: string,
     title?: string,
     company?: string,
     industry?: string,
     companySize?: string,
     tone?: 'professional' | 'casual' | 'executive',
     additionalContext?: string
   }
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
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    // ── Capability Library context (embedded, no DB needed) ──
    const capabilityContext = `
[service_line] AI & Machine Learning: End-to-end ML pipeline development, model training, MLOps, and intelligent automation solutions.
[service_line] Cloud Engineering: Multi-cloud architecture design, migration strategy, and cloud-native application development on AWS, Azure, and GCP.
[service_line] Data Engineering: Enterprise data platform design, real-time analytics, data governance, and warehouse modernization.
[service_line] Digital Transformation: Legacy system modernization, process automation, and technology strategy consulting.
[case_study] Reduced processing time by 85% for a Fortune 500 financial services company through AI-powered document automation.
[case_study] Migrated 200+ microservices to cloud-native architecture for a healthcare platform, achieving 99.99% uptime.
[proof_point] 150+ successful enterprise implementations across financial services, healthcare, manufacturing, and technology sectors.
[proof_point] Average 3x ROI within 12 months for clients leveraging our AI and cloud solutions.
[cta] Would you be open to a brief 15-minute call to explore how this might apply to your team?`;

    // ── Build the AI prompt ──
    const toneInstruction: Record<string, string> = {
      professional:
        'Write in a polished, business-professional tone. Confident but not aggressive.',
      casual:
        'Write in a warm, conversational tone. Friendly and approachable, like a peer reaching out.',
      executive:
        'Write in a concise, C-suite appropriate tone. Direct, data-driven, respectful of their time.',
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

**DeepMindQ Capabilities:**
${capabilityContext}

Write the email now. Respond with JSON only.`;

    // ── Call AI via z-ai-web-dev-sdk ──
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
    });

    let aiResponse = completion.choices[0]?.message?.content || '';

    // ── Parse response ──
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
        subject:
          lines[0]?.replace(/^subject:\s*/i, '').slice(0, 100) ||
          'Introduction to DeepMindQ',
        body: lines.slice(1).join('\n').slice(0, 1000) || aiResponse,
        cta: 'Would you be open to a brief 15-minute call this week?',
        confidence_score: 50,
        assumptions: [
          'AI response was not valid JSON — content may need review',
        ],
      };
    }

    return NextResponse.json({
      success: true,
      draft: {
        subject: parsed.subject || 'Draft email',
        body: parsed.body || '',
        cta: parsed.cta || '',
        confidenceScore: Math.min(
          100,
          Math.max(0, parsed.confidence_score || 50)
        ),
        assumptions: parsed.assumptions || [],
        sourceSnippets: [
          { id: 'cap-1', title: 'AI & Machine Learning', snippetType: 'service_line' },
          { id: 'cap-2', title: 'Cloud Engineering', snippetType: 'service_line' },
          { id: 'cap-3', title: 'Fortune 500 Document Automation', snippetType: 'case_study' },
        ],
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('AI generation error:', error);
    return NextResponse.json(
      {
        error:
          'Failed to generate draft: ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      },
      { status: 500 }
    );
  }
}