import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';

const peopleQuerySchema = z.object({
  search: z.string().max(200).default(''),
  role: z.string().max(50).default(''),
  organization: z.string().max(100).default(''),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  page: z.coerce.number().int().min(1).default(1),
  sort: z.enum(['fullName', 'email', 'createdAt', 'updatedAt']).default('updatedAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const parsed = peopleQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { search, role, organization, limit, page, sort, sortDir } = parsed.data;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { email: { contains: search } },
        { title: { contains: search } },
        { department: { contains: search } },
      ];
    }

    if (role && role !== 'all') {
      where.role = role;
    }

    if (organization) {
      where.organization = {
        OR: [{ name: { contains: organization } }, { domain: { contains: organization } }],
      };
    }

    const orderBy: Record<string, string> = {};
    orderBy[sort] = sortDir;

    const [people, total] = await Promise.all([
      db.person.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          fullName: true,
          email: true,
          title: true,
          role: true,
          department: true,
          seniority: true,
          linkedInUrl: true,
          notes: true,
          organizationId: true,
          source: true,
          firstSeenAt: true,
          updatedAt: true,
          organization: {
            select: { id: true, name: true },
          },
        },
      }),
      db.person.count({ where }),
    ]);

    return NextResponse.json({
      data: people,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch people' }, { status: 500 });
  }
}
