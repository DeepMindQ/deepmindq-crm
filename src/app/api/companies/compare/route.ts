import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════
   POST — Compare multiple companies side-by-side
   ═══════════════════════════════════════════════════ */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyIds } = body as { companyIds?: string[] };

    if (!Array.isArray(companyIds) || companyIds.length === 0) {
      return NextResponse.json(
        { error: 'companyIds must be a non-empty array of strings' },
        { status: 400 }
      );
    }

    if (companyIds.length > 10) {
      return NextResponse.json(
        { error: 'Cannot compare more than 10 companies at once' },
        { status: 400 }
      );
    }

    const companies = await db.company.findMany({
      where: { id: { in: companyIds } },
      include: {
        researchCard: true,
        contacts: {
          select: { id: true, rawName: true, title: true, role: true, leadScore: true, status: true },
          orderBy: { leadScore: 'desc' },
        },
        signals: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        _count: {
          select: {
            contacts: true,
            notes: true,
            signals: true,
          },
        },
      },
      orderBy: { intelligenceScore: 'desc' },
    });

    const result = companies.map((c: any) => ({
      ...c,
      tags: typeof c.tags === 'string' ? JSON.parse(c.tags) : c.tags,
      contactCount: c._count.contacts,
      noteCount: c._count.notes,
      signalCount: c._count.signals,
    }));

    // Report which IDs were not found
    const foundIds = new Set(companies.map((c: any) => c.id));
    const missingIds = companyIds.filter((id: string) => !foundIds.has(id));

    return NextResponse.json({
      companies: result,
      missingIds: missingIds.length > 0 ? missingIds : undefined,
    });
  } catch (error) {
    console.error('Company compare error:', error);
    return NextResponse.json({ error: 'Failed to compare companies' }, { status: 500 });
  }
}