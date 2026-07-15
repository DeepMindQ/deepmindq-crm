import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════
   GET — List notes for a company
   ═══════════════════════════════════════════════════ */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: companyId } = await params;
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    // Verify company exists
    const company = await db.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const where: Record<string, any> = { companyId };
    if (category) {
      where.category = category;
    }

    const notes = await db.companyNote.findMany({
      where,
      orderBy: [
        { pinned: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({ notes });
  } catch (error) {
    console.error('Company notes list error:', error);
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}

/* ═══════════════════════════════════════════════════
   POST — Create a note for a company
   ═══════════════════════════════════════════════════ */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: companyId } = await params;
    const body = await request.json();
    const { title, category, body: noteBody, author, pinned } = body;

    if (!noteBody || typeof noteBody !== 'string' || noteBody.trim().length === 0) {
      return NextResponse.json({ error: 'Note body is required' }, { status: 400 });
    }

    // Verify company exists
    const company = await db.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const validCategories = ['research', 'call', 'meeting', 'general', 'swot', 'competitive', 'discovery'];
    const noteCategory = validCategories.includes(category) ? category : 'general';

    const note = await db.companyNote.create({
      data: {
        companyId,
        title: title?.trim() || '',
        category: noteCategory,
        body: noteBody.trim(),
        author: author || null,
        pinned: Boolean(pinned),
      },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error('Company note create error:', error);
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }
}