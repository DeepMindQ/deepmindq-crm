import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'active';

    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { domain: { contains: search, mode: 'insensitive' } },
        { industry: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status && status !== 'all') {
      where.trackingStatus = status;
    }

    const [organizations, total] = await Promise.all([
      db.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          domain: true,
          industry: true,
          employeeCount: true,
          intelligenceScore: true,
          trackingStatus: true,
          lastSignalAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.organization.count({ where }),
    ]);

    // Get signal counts
    const signalCounts = await db.signal.groupBy({
      by: ['organizationId'],
      where: {
        organizationId: { in: organizations.map(o => o.id) },
        status: { in: ['detected', 'validated', 'analyzed'] },
      },
      _count: true,
    });

    const countMap = new Map(signalCounts.map(s => [s.organizationId, s._count]));

    return NextResponse.json({
      data: organizations.map(org => ({
        ...org,
        signalCount: countMap.get(org.id) || 0,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}
