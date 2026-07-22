import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════
   PATCH — Update a specific note
   ═══════════════════════════════════════════════════ */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const { id: companyId, noteId } = await params;
    const body = await request.json();

    // Verify note belongs to company
    const existing = await db.companyNote.findFirst({
      where: { id: noteId, companyId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    const data: Record<string, any> = {};

    if (body.title !== undefined) {
      data.title = typeof body.title === 'string' ? body.title.trim() : body.title;
    }
    if (body.category !== undefined) {
      const validCategories = ['research', 'call', 'meeting', 'general', 'swot', 'competitive', 'discovery'];
      data.category = validCategories.includes(body.category) ? body.category : 'general';
    }
    if (body.body !== undefined) {
      data.body = typeof body.body === 'string' ? body.body.trim() : body.body;
    }
    if (body.author !== undefined) {
      data.author = body.author;
    }
    if (body.pinned !== undefined) {
      data.pinned = Boolean(body.pinned);
    }

    const note = await db.companyNote.update({
      where: { id: noteId },
      data,
    });

    return NextResponse.json({ note });
  } catch (error) {
    console.error('Note update error:', error);
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
  }
}

/* ═══════════════════════════════════════════════════
   DELETE — Delete a specific note
   ═══════════════════════════════════════════════════ */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const { id: companyId, noteId } = await params;

    // Verify note belongs to company
    const existing = await db.companyNote.findFirst({
      where: { id: noteId, companyId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    await db.companyNote.delete({ where: { id: noteId } });

    return NextResponse.json({ success: true, deletedId: noteId });
  } catch (error) {
    console.error('Note delete error:', error);
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}