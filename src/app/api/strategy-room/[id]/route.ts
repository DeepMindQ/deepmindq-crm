import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// DELETE /api/strategy-room/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.accountStrategy.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.code === 'P2025' || error?.code === 'P2021') {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}

// PATCH /api/strategy-room/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const updated = await db.accountStrategy.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.objective !== undefined && { objective: body.objective }),
        ...(body.currentSituation !== undefined && { currentSituation: body.currentSituation }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.nextSteps !== undefined && { nextSteps: body.nextSteps }),
        ...(body.swotAnalysis !== undefined && { swotAnalysis: JSON.stringify(body.swotAnalysis) }),
        ...(body.keyInitiatives !== undefined && { keyInitiatives: JSON.stringify(body.keyInitiatives) }),
        ...(body.stakeholderMap !== undefined && { stakeholderMap: JSON.stringify(body.stakeholderMap) }),
        ...(body.competitivePosition !== undefined && { competitivePosition: body.competitivePosition }),
      },
    });
    return NextResponse.json({
      ...updated,
      swotAnalysis: updated.swotAnalysis ? JSON.parse(updated.swotAnalysis) : null,
      keyInitiatives: updated.keyInitiatives ? JSON.parse(updated.keyInitiatives) : null,
      stakeholderMap: updated.stakeholderMap ? JSON.parse(updated.stakeholderMap) : null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}