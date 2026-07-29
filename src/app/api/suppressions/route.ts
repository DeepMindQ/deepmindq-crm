import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const suppressions = await db.suppression.findMany({
      include: {
        contact: {
          include: { company: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(suppressions);
  } catch (error) {
    logger.error('Suppressions error:', { error: error });
    return NextResponse.json(
      { error: 'Failed to load suppressions' },
      { status: 500 }
    );
  }
}