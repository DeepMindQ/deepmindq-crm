import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

/* ═══════════════════════════════════════════════════
   GET /api/templates
   List all templates with optional filters
   ═══════════════════════════════════════════════════ */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceLine = searchParams.get('serviceLine') || '';
    const tone = searchParams.get('tone') || '';
    const category = searchParams.get('category') || '';

    const where: Prisma.EmailTemplateWhereInput = { isActive: true };
    if (serviceLine) where.serviceLine = serviceLine;
    if (tone) where.tone = tone;
    if (category) where.category = category;

    const templates = await db.emailTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error('Templates GET error:', error);
    return NextResponse.json([]);
  }
}

/* ═══════════════════════════════════════════════════
   POST /api/templates
   Create a new email template
   ═══════════════════════════════════════════════════ */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, subject, body: templateBody, cta, serviceLine, tone, category } = body;

    if (!name || !subject || !templateBody) {
      return NextResponse.json({ error: 'name, subject, and body are required' }, { status: 400 });
    }

    // Extract {{variable}} placeholders from subject + body
    const placeholderRegex = /\{\{(\w+)\}\}/g;
    const variables: string[] = [];
    let match;
    const fullText = subject + ' ' + templateBody + ' ' + (cta || '');
    while ((match = placeholderRegex.exec(fullText)) !== null) {
      if (!variables.includes(match[1])) variables.push(match[1]);
    }

    const template = await db.emailTemplate.create({
      data: {
        name,
        subject,
        body: templateBody,
        cta: cta || null,
        serviceLine: serviceLine || null,
        tone: tone || 'professional',
        category: category || null,
        variables: JSON.stringify(variables),
      },
    });

    return NextResponse.json({ success: true, template });
  } catch (error) {
    console.error('Templates POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create template: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}

/* ═══════════════════════════════════════════════════
   PUT /api/templates
   Update an existing template
   ═══════════════════════════════════════════════════ */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, subject, body: templateBody, cta, serviceLine, tone, category, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const fullText = (subject || '') + ' ' + (templateBody || '') + ' ' + (cta || '');
    const placeholderRegex = /\{\{(\w+)\}\}/g;
    const variables: string[] = [];
    let match;
    while ((match = placeholderRegex.exec(fullText)) !== null) {
      if (!variables.includes(match[1])) variables.push(match[1]);
    }

    const updateData: Record<string, unknown> = { variables: JSON.stringify(variables) };
    if (name !== undefined) updateData.name = name;
    if (subject !== undefined) updateData.subject = subject;
    if (templateBody !== undefined) updateData.body = templateBody;
    if (cta !== undefined) updateData.cta = cta;
    if (serviceLine !== undefined) updateData.serviceLine = serviceLine;
    if (tone !== undefined) updateData.tone = tone;
    if (category !== undefined) updateData.category = category;
    if (isActive !== undefined) updateData.isActive = isActive;

    const template = await db.emailTemplate.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, template });
  } catch (error) {
    console.error('Templates PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update template: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}

/* ═══════════════════════════════════════════════════
   DELETE /api/templates
   Soft-delete (deactivate) a template
   ═══════════════════════════════════════════════════ */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await db.emailTemplate.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Templates DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}