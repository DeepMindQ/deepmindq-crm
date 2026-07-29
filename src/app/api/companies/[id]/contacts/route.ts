import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

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
    logger.error('Company contacts error:', { error: error });
    return NextResponse.json({ error: 'Failed to load company contacts' }, { status: 500 });
  }
}
