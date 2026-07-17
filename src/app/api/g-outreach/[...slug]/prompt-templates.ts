import { NextRequest, NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════════════════
   In-memory prompt template storage
   ═══════════════════════════════════════════════════════════════ */

interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  description: string | null;
  systemPrompt: string;
  userPromptTemplate: string;
  variables: string[];
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}

const now = () => new Date().toISOString();

let templates: PromptTemplate[] = [
  {
    id: 'builtin-cold-intro',
    name: 'Cold Introduction',
    category: 'email',
    description: 'For first-time outreach to new prospects',
    systemPrompt: 'You are a professional B2B sales writer. Write concise, personalized cold outreach emails that feel human, not salesy. Keep the tone conversational and respect the reader\'s time. Focus on one clear value proposition.',
    userPromptTemplate: 'Write a cold introduction email to {{contactName}} at {{companyName}} ({{industry}}). The company has {{employeeSize}} employees and is based in {{location}}. Reference a relevant pain point for their industry and suggest a brief call.',
    variables: ['contactName', 'companyName', 'industry', 'employeeSize', 'location'],
    isBuiltIn: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'builtin-follow-up-meeting',
    name: 'Follow-Up After Meeting',
    category: 'email',
    description: 'Post-meeting follow-up to keep momentum going',
    systemPrompt: 'You are a professional B2B sales writer. Write warm, concise follow-up emails that recap key discussion points and clearly state next steps. Reference specific details from the meeting to show attentiveness.',
    userPromptTemplate: 'Write a follow-up email to {{contactName}} at {{companyName}} after a meeting about {{researchContext}}. Summarize the key points discussed, reiterate the value proposition, and propose concrete next steps with a call-to-action.',
    variables: ['contactName', 'companyName', 'researchContext'],
    isBuiltIn: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'builtin-case-study-share',
    name: 'Case Study Share',
    category: 'email',
    description: 'Sharing relevant case studies with prospects',
    systemPrompt: 'You are a professional B2B sales writer. Write emails that share case studies and social proof. Connect the case study directly to the prospect\'s specific challenges. Be specific about results achieved and keep the email focused.',
    userPromptTemplate: 'Write an email to {{contactName}} at {{companyName}} ({{industry}}) sharing a relevant case study. The prospect\'s context: {{researchContext}}. Highlight specific results and metrics, and suggest a brief discussion about how similar outcomes could apply to their situation.',
    variables: ['contactName', 'companyName', 'industry', 'researchContext'],
    isBuiltIn: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'builtin-re-engagement',
    name: 'Re-Engagement',
    category: 'email',
    description: 'Re-engaging cold prospects who went silent',
    systemPrompt: 'You are a professional B2B sales writer. Write re-engagement emails that are brief, empathetic, and low-pressure. Acknowledge the silence naturally without guilt. Offer a fresh angle or new information to reignite interest.',
    userPromptTemplate: 'Write a re-engagement email to {{contactName}} at {{companyName}} ({{industry}}) who hasn\'t responded to previous outreach. Context: {{researchContext}}. Keep it short, offer a new perspective or timely reason to reconnect, and include a soft call-to-action.',
    variables: ['contactName', 'companyName', 'industry', 'researchContext'],
    isBuiltIn: true,
    createdAt: now(),
    updatedAt: now(),
  },
];

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

function generateId(): string {
  return `tmpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ═══════════════════════════════════════════════════════════════
   GET — List all templates (optionally filtered by category)
   ═══════════════════════════════════════════════════════════════ */

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const category = searchParams.get('category');

  let result = templates;
  if (category && category !== 'all') {
    result = templates.filter((t) => t.category === category);
  }

  return NextResponse.json(result);
}

/* ═══════════════════════════════════════════════════════════════
   POST — Create a new template
   ═══════════════════════════════════════════════════════════════ */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name?.trim() || !body.systemPrompt?.trim() || !body.userPromptTemplate?.trim()) {
      return NextResponse.json(
        { error: 'Name, systemPrompt, and userPromptTemplate are required' },
        { status: 400 }
      );
    }

    const newTemplate: PromptTemplate = {
      id: generateId(),
      name: body.name.trim(),
      category: body.category || 'email',
      description: body.description?.trim() || null,
      systemPrompt: body.systemPrompt.trim(),
      userPromptTemplate: body.userPromptTemplate.trim(),
      variables: Array.isArray(body.variables) ? body.variables : [],
      isBuiltIn: false,
      createdAt: now(),
      updatedAt: now(),
    };

    templates.push(newTemplate);

    return NextResponse.json(newTemplate, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

/* ═══════════════════════════════════════════════════════════════
   Export for use by [id] route
   ═══════════════════════════════════════════════════════════════ */

export { templates as _templatesStore, generateId };