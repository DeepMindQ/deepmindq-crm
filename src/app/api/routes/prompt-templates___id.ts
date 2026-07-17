import { NextRequest, NextResponse } from 'next/server';
import { _templatesStore } from '../route';

/* ═══════════════════════════════════════════════════════════════
   PATCH — Update a template by ID
   ═══════════════════════════════════════════════════════════════ */

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const index = _templatesStore.findIndex((t) => t.id === id);
    if (index === -1) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const template = _templatesStore[index];
    if (template.isBuiltIn) {
      return NextResponse.json({ error: 'Cannot modify built-in templates' }, { status: 403 });
    }

    // Apply updates
    if (body.name !== undefined) template.name = String(body.name).trim();
    if (body.category !== undefined) template.category = String(body.category);
    if (body.description !== undefined) template.description = body.description?.trim() || null;
    if (body.systemPrompt !== undefined) template.systemPrompt = String(body.systemPrompt).trim();
    if (body.userPromptTemplate !== undefined) template.userPromptTemplate = String(body.userPromptTemplate).trim();
    if (Array.isArray(body.variables)) template.variables = body.variables;

    template.updatedAt = new Date().toISOString();

    return NextResponse.json(template);
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

/* ═══════════════════════════════════════════════════════════════
   DELETE — Remove a template by ID
   ═══════════════════════════════════════════════════════════════ */

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const index = _templatesStore.findIndex((t) => t.id === id);
    if (index === -1) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const template = _templatesStore[index];
    if (template.isBuiltIn) {
      return NextResponse.json({ error: 'Cannot delete built-in templates' }, { status: 403 });
    }

    const removed = _templatesStore.splice(index, 1);

    return NextResponse.json(removed[0]);
  } catch {
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}