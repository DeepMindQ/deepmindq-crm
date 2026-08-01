import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

export async function GET() {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

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