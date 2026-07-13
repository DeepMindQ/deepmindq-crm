import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════
   GET /api/capabilities/[id]/children
   C-08: Get child assets linked to a parent
   ═══════════════════════════════════════════════════ */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify parent exists
    const parent = await db.capabilityAsset.findUnique({ where: { id } });
    if (!parent) {
      return NextResponse.json({ error: 'Parent capability not found' }, { status: 404 });
    }

    const children = await db.capabilityAsset.findMany({
      where: { parentAssetId: id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      parent: {
        id: parent.id,
        title: parent.title,
        category: parent.category,
        serviceLine: parent.serviceLine,
      },
      children,
      count: children.length,
    });
  } catch (error) {
    console.error('Children fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch children' }, { status: 500 });
  }
}