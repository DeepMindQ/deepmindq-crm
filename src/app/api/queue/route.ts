import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const queue = await db.sendQueue.findMany({
      include: {
        draft: {
          include: {
            contact: {
              include: { company: true },
            },
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    return NextResponse.json(queue);
  } catch (error) {
    console.error('Queue error:', error);
    return NextResponse.json(
      { error: 'Failed to load queue' },
      { status: 500 }
    );
  }
}