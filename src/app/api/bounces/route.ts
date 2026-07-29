import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const bounces = await db.bounce.findMany({
      include: {
        contact: {
          include: { company: true },
        },
      },
      orderBy: { bouncedAt: 'desc' },
    });

    return NextResponse.json(bounces);
  } catch (error) {
    logger.error('Bounces error:', { error: error });
    return NextResponse.json(
      { error: 'Failed to load bounces' },
      { status: 500 }
    );
  }
}