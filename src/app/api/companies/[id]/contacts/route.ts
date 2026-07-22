import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: companyId } = await params;

    const contacts = await db.contact.findMany({
      where: { companyId },
      orderBy: { leadScore: 'desc' },
    });

    return NextResponse.json({ contacts });
  } catch (error) {
    console.error('Company contacts error:', error);
    return NextResponse.json({ error: 'Failed to load company contacts' }, { status: 500 });
  }
}
