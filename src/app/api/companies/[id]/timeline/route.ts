import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════
   GET — List timeline events for a company
   ═══════════════════════════════════════════════════ */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: companyId } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50', 10)));

    // Verify company exists
    const company = await db.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const where: Record<string, any> = { companyId };
    if (type) {
      where.eventType = type;
    }

    const events = await db.companyTimelineEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Company timeline list error:', error);
    return NextResponse.json({ error: 'Failed to fetch timeline events' }, { status: 500 });
  }
}

/* ═══════════════════════════════════════════════════
   POST — Create a timeline event for a company
   ═══════════════════════════════════════════════════ */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: companyId } = await params;
    const body = await request.json();
    const { eventType, title, description, metadata } = body;

    if (!eventType || typeof eventType !== 'string' || eventType.trim().length === 0) {
      return NextResponse.json({ error: 'eventType is required' }, { status: 400 });
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    // Verify company exists
    const company = await db.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const metadataStr = metadata
      ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata))
      : '{}';

    const event = await db.companyTimelineEvent.create({
      data: {
        companyId,
        eventType: eventType.trim(),
        title: title.trim(),
        description: description?.trim() || null,
        metadata: metadataStr,
      },
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    console.error('Company timeline create error:', error);
    return NextResponse.json({ error: 'Failed to create timeline event' }, { status: 500 });
  }
}