import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// DELETE /api/playbooks/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.playbook.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.code === 'P2025' || error?.code === 'P2021') {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}

// PATCH /api/playbooks/[id] — update playbook
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const updated = await db.playbook.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.category !== undefined && { category: body.category }),
        ...(body.steps !== undefined && { steps: JSON.stringify(body.steps) }),
        ...(body.aiTips !== undefined && { aiTips: body.aiTips }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });
    return NextResponse.json({ ...updated, steps: JSON.parse(updated.steps || '[]') });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}