import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logAction } from '@/lib/audit';

/* ═══════════════════════════════════════════════════
   GET /api/contacts/[id]/notes — List notes
   POST /api/contacts/[id]/notes — Create note
   PUT /api/contacts/[id]/notes — Update note
   DELETE /api/contacts/[id]/notes — Delete note
   ═══════════════════════════════════════════════════ */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const notes = await db.contactNote.findMany({
      where: { contactId: id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(notes);
  } catch (error) {
    console.error('Notes GET error:', error);
    return NextResponse.json({ error: 'Failed to load notes' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { body: noteBody } = body;

    if (!noteBody || typeof noteBody !== 'string' || noteBody.trim().length === 0) {
      return NextResponse.json({ error: 'Note body is required' }, { status: 400 });
    }

    const note = await db.contactNote.create({
      data: {
        contactId: id,
        body: noteBody.trim(),
      },
    });

    await logAction('note_added', 'Contact', id, { noteId: note.id, body: noteBody.trim().slice(0, 100) });

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error('Notes POST error:', error);
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contactId } = await params;
    const body = await request.json();
    const { noteId, body: noteBody } = body;

    if (!noteId) return NextResponse.json({ error: 'noteId is required' }, { status: 400 });
    if (!noteBody || typeof noteBody !== 'string' || noteBody.trim().length === 0) {
      return NextResponse.json({ error: 'Note body is required' }, { status: 400 });
    }

    const note = await db.contactNote.update({
      where: { id: noteId, contactId },
      data: { body: noteBody.trim() },
    });

    await logAction('note_updated', 'Contact', contactId, { noteId, body: noteBody.trim().slice(0, 100) });

    return NextResponse.json(note);
  } catch (error) {
    console.error('Notes PUT error:', error);
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contactId } = await params;
    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get('noteId');

    if (!noteId) return NextResponse.json({ error: 'noteId query param is required' }, { status: 400 });

    await db.contactNote.delete({
      where: { id: noteId, contactId },
    });

    await logAction('note_deleted', 'Contact', contactId, { noteId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Notes DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}