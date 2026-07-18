import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invalidateCache } from '@/lib/data-intelligence';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await params;
    const id = slug[slug.length - 1];
    const body = await request.json();
    const sw = await db.scoringWeight.update({ where: { id }, data: body });
    invalidateCache();
    return NextResponse.json(sw);
  } catch (error: any) {
    console.error('[config/scoring PUT]', error.message);
    return NextResponse.json({ error: 'Failed to update weight' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await params;
    const id = slug[slug.length - 1];
    await db.scoringWeight.delete({ where: { id } });
    invalidateCache();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[config/scoring DELETE]', error.message);
    return NextResponse.json({ error: 'Failed to delete weight' }, { status: 500 });
  }
}