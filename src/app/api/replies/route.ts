import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

export async function GET() {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

try {
    const replies = await db.reply.findMany({
      include: {
        contact: {
          include: { company: true },
        },
      },
      orderBy: { receivedAt: 'desc' },
    });

    return NextResponse.json(replies);
  } catch (error) {
    logger.error('Replies error:', { error: error });
    return NextResponse.json(
      { error: 'Failed to load replies' },
      { status: 500 }
    );
  }
}