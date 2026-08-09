import { NextRequest, NextResponse } from 'next/server';
import { templates, generateId } from '@/lib/prompt-templates-store';
import { checkApiAuth } from '@/lib/api-auth';

const now = () => new Date().toISOString();

export async function GET(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

const { searchParams } = request.nextUrl;
  const category = searchParams.get('category');

  let result = templates;
  if (category && category !== 'all') {
    result = templates.filter((t) => t.category === category);
  }

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

try {
    const body = await request.json();

    if (!body.name?.trim() || !body.systemPrompt?.trim() || !body.userPromptTemplate?.trim()) {
      return NextResponse.json(
        { error: 'Name, systemPrompt, and userPromptTemplate are required' },
        { status: 400 }
      );
    }

    const newTemplate = {
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
