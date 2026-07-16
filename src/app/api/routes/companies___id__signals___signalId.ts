import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════
   PATCH — Update a signal (mark as read, etc.)
   ═══════════════════════════════════════════════════ */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; signalId: string }> }
) {
  try {
    const { id: companyId, signalId } = await params;
    const body = await request.json();

    // Verify signal belongs to company
    const existing = await db.companySignal.findFirst({
      where: { id: signalId, companyId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Signal not found' }, { status: 404 });
    }

    const data: Record<string, any> = {};

    if (body.title !== undefined) {
      data.title = typeof body.title === 'string' ? body.title.trim() : body.title;
    }
    if (body.description !== undefined) {
      data.description = body.description !== null && typeof body.description === 'string'
        ? body.description.trim()
        : body.description;
    }
    if (body.source !== undefined) {
      data.source = body.source;
    }
    if (body.sourceUrl !== undefined) {
      data.sourceUrl = body.sourceUrl;
    }
    if (body.severity !== undefined) {
      const validSeverities = ['low', 'medium', 'high', 'critical'];
      data.severity = validSeverities.includes(body.severity) ? body.severity : 'medium';
    }
    if (body.isRead !== undefined) {
      data.isRead = Boolean(body.isRead);
    }

    const signal = await db.companySignal.update({
      where: { id: signalId },
      data,
    });

    return NextResponse.json({ signal });
  } catch (error) {
    console.error('Signal update error:', error);
    return NextResponse.json({ error: 'Failed to update signal' }, { status: 500 });
  }
}

/* ═══════════════════════════════════════════════════
   DELETE — Delete a signal
   ═══════════════════════════════════════════════════ */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; signalId: string }> }
) {
  try {
    const { id: companyId, signalId } = await params;

    // Verify signal belongs to company
    const existing = await db.companySignal.findFirst({
      where: { id: signalId, companyId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Signal not found' }, { status: 404 });
    }

    await db.companySignal.delete({ where: { id: signalId } });

    return NextResponse.json({ success: true, deletedId: signalId });
  } catch (error) {
    console.error('Signal delete error:', error);
    return NextResponse.json({ error: 'Failed to delete signal' }, { status: 500 });
  }
}