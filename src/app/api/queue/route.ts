import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

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

/* ═══════════════════════════════════════════════════
   PATCH /api/queue — Bulk queue operations (E-02)

   Actions:
     pause   → set status "paused" for pending/scheduled items
     resume  → set status "pending" for paused items
     retry   → reset retryCount, set status "pending" for failed items
     cancel  → set status "failed" with reason "cancelled"

   Body: { action, id?, ids? }
     - id: single item
     - ids: array of item IDs
     - if neither, applies to all matching items
   ═══════════════════════════════════════════════════ */
export async function PATCH(request: Request) {
  try {
    const body = await request.json() as {
      action: string;
      id?: string;
      ids?: string[];
    };

    const { action, id, ids } = body;

    if (!action || !['pause', 'resume', 'retry', 'cancel'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be one of: pause, resume, retry, cancel' },
        { status: 400 }
      );
    }

    let affected = 0;

    if (action === 'pause') {
      const where: Prisma.SendQueueWhereInput = id
        ? { id, status: { in: ['pending', 'scheduled'] } }
        : ids?.length
          ? { id: { in: ids }, status: { in: ['pending', 'scheduled'] } }
          : { status: { in: ['pending', 'scheduled'] } };

      const result = await db.sendQueue.updateMany({
        where,
        data: { status: 'paused' },
      });
      affected = result.count;
    }

    if (action === 'resume') {
      const where: Prisma.SendQueueWhereInput = id
        ? { id, status: 'paused' }
        : ids?.length
          ? { id: { in: ids }, status: 'paused' }
          : { status: 'paused' };

      const result = await db.sendQueue.updateMany({
        where,
        data: { status: 'pending' },
      });
      affected = result.count;
    }

    if (action === 'retry') {
      const where: Prisma.SendQueueWhereInput = id
        ? { id, status: 'failed' }
        : ids?.length
          ? { id: { in: ids }, status: 'failed' }
          : { status: 'failed' };

      const result = await db.sendQueue.updateMany({
        where,
        data: {
          status: 'pending',
          retryCount: 0,
          failureReason: null,
        },
      });
      affected = result.count;
    }

    if (action === 'cancel') {
      const where: Prisma.SendQueueWhereInput = id
        ? { id, status: { in: ['pending', 'scheduled', 'paused'] } }
        : ids?.length
          ? { id: { in: ids }, status: { in: ['pending', 'scheduled', 'paused'] } }
          : { status: { in: ['pending', 'scheduled', 'paused'] } };

      const result = await db.sendQueue.updateMany({
        where,
        data: {
          status: 'failed',
          failureReason: 'cancelled',
        },
      });
      affected = result.count;
    }

    return NextResponse.json({ success: true, action, affected });
  } catch (error) {
    console.error('Queue PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update queue' },
      { status: 500 }
    );
  }
}
