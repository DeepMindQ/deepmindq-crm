import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════
   L-04: Lead Segments API
   
   GET:    List segments (with ?evaluate=true for dynamic evaluation)
   POST:   Create segment
   PUT:    Update segment
   DELETE: Archive segment
   ═══════════════════════════════════════════════════ */

interface SegmentFilters {
  industry?: string[];
  status?: string[];
  scoreRange?: [number, number];
  country?: string[];
  role?: string[];
}

function buildWhereClause(filters: SegmentFilters): any {
  const where: any = {};

  if (filters.industry && filters.industry.length > 0) {
    where.company = { industry: { in: filters.industry } };
  }
  if (filters.status && filters.status.length > 0) {
    where.status = { in: filters.status };
  }
  if (filters.scoreRange && filters.scoreRange.length === 2) {
    where.leadScore = { gte: filters.scoreRange[0], lte: filters.scoreRange[1] };
  }
  if (filters.country && filters.country.length > 0) {
    where.location = { in: filters.country };
  }
  if (filters.role && filters.role.length > 0) {
    where.role = { in: filters.role };
  }

  return where;
}

/* ── GET ── */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const evaluateId = searchParams.get('evaluate');

    if (evaluateId) {
      // Evaluate a dynamic segment — return matching contacts
      const segment = await db.segment.findUnique({ where: { id: evaluateId } });
      if (!segment) {
        return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
      }

      const filters: SegmentFilters = JSON.parse(segment.filters);
      const where = buildWhereClause(filters);

      const contacts = await db.contact.findMany({
        where,
        include: {
          company: { select: { rawName: true, industry: true, domain: true } },
        },
        take: 100,
        orderBy: { leadScore: 'desc' },
      });

      return NextResponse.json({
        segmentId: segment.id,
        segmentName: segment.name,
        contacts: (contacts as any[]).map((c: any) => ({
          id: c.id,
          rawName: c.rawName,
          email: c.email,
          title: c.title,
          leadScore: c.leadScore,
          status: c.status,
          company: c.company?.rawName || '',
          industry: c.company?.industry || '',
        })),
      });
    }

    // List all segments with counts
    const segments = await db.segment.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { contacts: true } },
      },
    });

    // For dynamic segments, count matching contacts
    const result = await Promise.all(
      (segments as any[]).map(async (seg) => {
        if (seg.isStatic) {
          return { ...seg, contactCount: seg._count.contacts };
        }
        // Dynamic: evaluate filters
        try {
          const filters: SegmentFilters = JSON.parse(seg.filters);
          const where = buildWhereClause(filters);
          const count = await db.contact.count({ where });
          return { ...seg, contactCount: count };
        } catch {
          return { ...seg, contactCount: 0 };
        }
      }),
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Segments GET error:', error);
    return NextResponse.json({ error: 'Failed to load segments' }, { status: 500 });
  }
}

/* ── POST: Create Segment ── */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, filters, isStatic } = body as {
      name: string;
      description?: string;
      filters: SegmentFilters;
      isStatic?: boolean;
    };

    if (!name || !filters) {
      return NextResponse.json({ error: 'Name and filters are required' }, { status: 400 });
    }

    const filtersJson = JSON.stringify(filters);
    const where = buildWhereClause(filters);
    const contactCount = await db.contact.count({ where });

    const segment = await db.segment.create({
      data: {
        name,
        description: description || null,
        filters: filtersJson,
        isStatic: isStatic || false,
        contactCount,
      },
    });

    // If static, create SegmentContact records
    if (isStatic) {
      const matchingContacts = await db.contact.findMany({
        where,
        select: { id: true },
        take: 10000,
      });

      if (matchingContacts.length > 0) {
        await db.segmentContact.createMany({
          data: (matchingContacts as any[]).map((c: any) => ({
            segmentId: segment.id,
            contactId: c.id,
          })),
        });
      }
    }

    return NextResponse.json({ success: true, segment, contactCount });
  } catch (error) {
    console.error('Segment create error:', error);
    return NextResponse.json({ error: 'Failed to create segment' }, { status: 500 });
  }
}

/* ── PUT: Update Segment ── */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, description, filters } = body as {
      id: string;
      name?: string;
      description?: string;
      filters?: SegmentFilters;
    };

    if (!id) {
      return NextResponse.json({ error: 'Segment ID required' }, { status: 400 });
    }

    const existing = await db.segment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    if (filters) {
      const filtersJson = JSON.stringify(filters);
      updateData.filters = filtersJson;
      const where = buildWhereClause(filters);
      updateData.contactCount = await db.contact.count({ where });

      // If dynamic, clear old static contacts
      if (!existing.isStatic) {
        await db.segmentContact.deleteMany({ where: { segmentId: id } });
      }
    }

    const segment = await db.segment.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, segment });
  } catch (error) {
    console.error('Segment update error:', error);
    return NextResponse.json({ error: 'Failed to update segment' }, { status: 500 });
  }
}

/* ── DELETE: Archive Segment ── */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Segment ID required' }, { status: 400 });
    }

    // Delete segment contacts first, then segment
    await db.segmentContact.deleteMany({ where: { segmentId: id } });
    await db.segment.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Segment delete error:', error);
    return NextResponse.json({ error: 'Failed to delete segment' }, { status: 500 });
  }
}