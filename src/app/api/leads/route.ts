import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const company = searchParams.get('company') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const where: Prisma.ContactWhereInput = {};

    // Search across name, email, title, and company name
    if (search) {
      where.OR = [
        { normalizedName: { contains: search } },
        { editedName: { contains: search } },
        { rawName: { contains: search } },
        { email: { contains: search } },
        { title: { contains: search } },
        { company: { normalizedName: { contains: search } } },
        { company: { rawName: { contains: search } } },
      ];
    }

    // Filter by status
    if (status) {
      where.status = status;
    }

    // Filter by company
    if (company) {
      where.company = {
        OR: [
          { normalizedName: { contains: company } },
          { rawName: { contains: company } },
        ],
      };
    }

    // Build sort
    const sortMap: Record<string, Prisma.ContactOrderByWithRelationInput> = {
      createdAt: { createdAt: 'desc' },
      updatedAt: { updatedAt: 'desc' },
      leadScore: { leadScore: 'desc' },
      name: { normalizedName: 'asc' },
      email: { email: 'asc' },
    };
    const orderBy = sortMap[sortBy] || sortMap.createdAt;

    const skip = (page - 1) * limit;

    const [leads, total] = await Promise.all([
      db.contact.findMany({
        where,
        include: { company: true },
        orderBy,
        skip,
        take: limit,
      }),
      db.contact.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({ leads, total, page, totalPages });
  } catch (error) {
    console.error('Leads error:', error);
    return NextResponse.json(
      { error: 'Failed to load leads' },
      { status: 500 }
    );
  }
}