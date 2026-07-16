import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.conversationPlan.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[conversation-plans DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete plan' }, { status: 500 });
  }
}