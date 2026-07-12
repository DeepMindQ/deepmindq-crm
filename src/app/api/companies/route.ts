import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const companies = await db.company.findMany({
      include: {
        _count: { select: { contacts: true } },
        researchCard: true,
      },
      orderBy: {
        contacts: { _count: 'desc' },
      },
    });

    // Map to include contactCount as a flat field
    const result = companies.map((c) => ({
      ...c,
      contactCount: c._count.contacts,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Companies error:', error);
    return NextResponse.json(
      { error: 'Failed to load companies' },
      { status: 500 }
    );
  }
}