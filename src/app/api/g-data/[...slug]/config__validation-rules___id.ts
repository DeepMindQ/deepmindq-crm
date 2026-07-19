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

    if (body.config && typeof body.config === 'object') {
      body.config = JSON.stringify(body.config);
    }

    const rule = await db.fieldValidationRule.update({ where: { id }, data: body });
    invalidateCache();
    return NextResponse.json(rule);
  } catch (error: any) {
    console.error('[config/validation-rules PUT]', error.message);
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
    await db.fieldValidationRule.delete({ where: { id } });
    invalidateCache();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[config/validation-rules DELETE]', error.message);
    return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 });
  }
}