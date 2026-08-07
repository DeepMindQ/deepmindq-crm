import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logAction } from '@/lib/audit';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

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
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

try {
    const { id } = await params;

    const notes = await db.contactNote.findMany({
      where: { contactId: id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(notes);
  } catch (error) {
    logger.error('Notes GET error:', { error: error });
    return NextResponse.json({ error: 'Failed to load notes' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
    // ── Authentication Guard ──
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

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

    await logAction('note_added', 'Contact', id, { noteId: note.id, body: noteBody.trim().slice(0, 100) }, session!.id);

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    logger.error('Notes POST error:', { error: error });
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
    // ── Authentication Guard ──
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

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

    await logAction('note_updated', 'Contact', contactId, { noteId, body: noteBody.trim().slice(0, 100) }, session!.id);

    return NextResponse.json(note);
  } catch (error) {
    logger.error('Notes PUT error:', { error: error });
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
    // ── Authentication Guard ──
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

try {
    const { id: contactId } = await params;
    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get('noteId');

    if (!noteId) return NextResponse.json({ error: 'noteId query param is required' }, { status: 400 });

    await db.contactNote.delete({
      where: { id: noteId, contactId },
    });

    await logAction('note_deleted', 'Contact', contactId, { noteId }, session!.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Notes DELETE error:', { error: error });
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}