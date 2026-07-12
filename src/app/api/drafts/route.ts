import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';

    const where: Prisma.DraftWhereInput = {};
    if (status) {
      where.status = status;
    }

    const drafts = await db.draft.findMany({
      where,
      include: {
        contact: {
          include: { company: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(drafts);
  } catch (error) {
    console.error('Drafts error:', error);
    return NextResponse.json(
      { error: 'Failed to load drafts' },
      { status: 500 }
    );
  }
}