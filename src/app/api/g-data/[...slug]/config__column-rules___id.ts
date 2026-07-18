import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invalidateCache } from '@/lib/data-intelligence';

/**
 * PUT /api/g-data/config/column-rules/[id]
 * DELETE /api/g-data/config/column-rules/[id]
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await params;
    const id = slug[slug.length - 1];
    const body = await request.json();

    if (body.pattern) {
      try { new RegExp(body.pattern, 'i'); } catch {
        return NextResponse.json({ error: 'Invalid regex pattern' }, { status: 400 });
      }
    }

    const rule = await db.columnMappingRule.update({
      where: { id },
      data: body,
    });

    invalidateCache();
    return NextResponse.json(rule);
  } catch (error: any) {
    console.error('[config/column-rules PUT]', error.message);
    return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await params;
    const id = slug[slug.length - 1];

    await db.columnMappingRule.delete({ where: { id } });
    invalidateCache();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[config/column-rules DELETE]', error.message);
    return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 });
  }
}