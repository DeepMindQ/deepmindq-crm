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
    const mapping = await db.normalizationMapping.update({ where: { id }, data: body });
    invalidateCache();
    return NextResponse.json(mapping);
  } catch (error: any) {
    console.error('[config/normalization PUT]', error.message);
    return NextResponse.json({ error: 'Failed to update mapping' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await params;
    const id = slug[slug.length - 1];
    await db.normalizationMapping.delete({ where: { id } });
    invalidateCache();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[config/normalization DELETE]', error.message);
    return NextResponse.json({ error: 'Failed to delete mapping' }, { status: 500 });
  }
}