import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logAction } from '@/lib/audit';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

/* ═══════════════════════════════════════════════════
   In-memory verification queue
   Contacts with emailHealth = "unknown" and email present
   are considered "pending".
   ═══════════════════════════════════════════════════ */

/* POST /api/verify-queue — Add contacts to verification queue */
export async function POST(request: Request) {
    // ── Authentication Guard ──
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

try {
    const body = await request.json();
    const { contactIds, verifyAll } = body;

    let contacts: any[] = [];

    if (verifyAll) {
      contacts = await db.contact.findMany({
        where: {
          emailHealth: 'unknown',
        },
        select: { id: true, email: true },
        take: 5000,
      });
    } else if (Array.isArray(contactIds) && contactIds.length > 0) {
      contacts = await db.contact.findMany({
        where: {
          id: { in: contactIds },
        },
        select: { id: true, email: true },
      });
    } else {
      return NextResponse.json({ error: 'Provide contactIds or verifyAll' }, { status: 400 });
    }

    // Queue status: pending = contacts with emailHealth "unknown"
    // We don't need a separate queue table — just use the emailHealth field
    const queued = contacts.length;

    await logAction('verify_queue_added', 'Contact', 'batch', { count: queued }, session!.id);

    return NextResponse.json({
      success: true,
      queued,
      message: `${queued} contacts queued for verification`,
    });
  } catch (error) {
    logger.error('Verify queue error:', { error: error });
    return NextResponse.json({ error: 'Failed to queue contacts' }, { status: 500 });
  }
}

/* GET /api/verify-queue — Returns queue status */
export async function GET() {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

try {
    const [pending, completed, failed, inProgress] = await Promise.all([
      db.contact.count({
        where: { emailHealth: 'unknown' },
      }),
      db.contact.count({
        where: { emailHealth: { in: ['valid', 'risky', 'invalid'] } },
      }),
      db.contact.count({
        where: { emailHealth: 'invalid' },
      }),
      db.contact.count({
        where: { emailHealth: 'unknown', lastCheckedAt: { not: null } },
      }),
    ]);

    return NextResponse.json({ pending, completed, failed, inProgress });
  } catch (error) {
    logger.error('Verify queue status error:', { error: error });
    return NextResponse.json({ error: 'Failed to get queue status' }, { status: 500 });
  }
}