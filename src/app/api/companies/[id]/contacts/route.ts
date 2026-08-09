import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkApiAuth, filterResponseArrayByRole } from '@/lib/api-auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
    // ── Authentication Guard ──
  const { errorResponse, session } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

try {
    const { id: companyId } = await params;

    const contacts = await db.contact.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // ── Field-Level Permission Filtering (5.3) ──
    const filteredContacts = session
      ? filterResponseArrayByRole(contacts as unknown as Record<string, unknown>[], session, 'Contact')
      : contacts;

    return NextResponse.json({ contacts: filteredContacts });
  } catch (error) {
    logger.error('Company contacts error:', { error: error });
    return NextResponse.json({ error: 'Failed to load company contacts' }, { status: 500 });
  }
}
