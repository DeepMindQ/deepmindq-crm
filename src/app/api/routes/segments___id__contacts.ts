import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════
   L-04: Segment Contacts API
   GET: Return contacts matching the segment
   ═══════════════════════════════════════════════════ */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const segment = await db.segment.findUnique({ where: { id } });
    if (!segment) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }

    let contacts: any[];
    let total: number;

    if (segment.isStatic) {
      // Static: get from SegmentContact table
      total = await db.segmentContact.count({ where: { segmentId: id } });
      const links = await db.segmentContact.findMany({
        where: { segmentId: id },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          contact: {
            include: {
              company: { select: { rawName: true, industry: true, domain: true } },
            },
          },
        },
        orderBy: { addedAt: 'desc' },
      });

      contacts = links.map((l: any) => l.contact);
    } else {
      // Dynamic: evaluate filters
      const filters = JSON.parse(segment.filters);
      const where: any = {};

      if (filters.industry?.length > 0) {
        where.company = { industry: { in: filters.industry } };
      }
      if (filters.status?.length > 0) {
        where.status = { in: filters.status };
      }
      if (filters.scoreRange?.length === 2) {
        where.leadScore = { gte: filters.scoreRange[0], lte: filters.scoreRange[1] };
      }
      if (filters.country?.length > 0) {
        where.location = { in: filters.country };
      }
      if (filters.role?.length > 0) {
        where.role = { in: filters.role };
      }

      total = await db.contact.count({ where });
      contacts = await db.contact.findMany({
        where,
        include: {
          company: { select: { rawName: true, industry: true, domain: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { leadScore: 'desc' },
      });
    }

    const mapped = (contacts as any[]).map((c: any) => ({
      id: c.id,
      rawName: c.rawName,
      email: c.email,
      title: c.title,
      role: c.role,
      leadScore: c.leadScore,
      status: c.status,
      company: c.company?.rawName || '',
      industry: c.company?.industry || '',
    }));

    return NextResponse.json({
      contacts: mapped,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      segmentName: segment.name,
      isStatic: segment.isStatic,
    });
  } catch (error) {
    console.error('Segment contacts error:', error);
    return NextResponse.json({ error: 'Failed to load segment contacts' }, { status: 500 });
  }
}