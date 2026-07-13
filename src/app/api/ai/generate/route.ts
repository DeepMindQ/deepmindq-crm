import { NextResponse } from 'next/server';
import { generateEmailDraft } from '@/lib/email-generation';

/* ═══════════════════════════════════════════════════
   POST /api/ai/generate
   AI-powered email draft generation.

   Delegates entirely to the shared generateEmailDraft()
   in src/lib/email-generation.ts to avoid duplicate code.

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
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const draft = await generateEmailDraft({
      name,
      email,
      title,
      company,
      industry,
      companySize,
      tone,
      additionalContext,
      serviceLine,
      problems,
      searchMode: knowledgeSearchMode || 'hybrid',
      minScore: knowledgeMinScore ?? 20,
    });

    return NextResponse.json({ success: true, draft });
  } catch (error) {
    console.error('AI generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate draft: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}