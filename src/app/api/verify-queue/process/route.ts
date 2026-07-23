// @ts-nocheck
import { promises as dns } from 'dns';
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { checkSyntax, checkDisposable, checkRoleBased, checkFreeProvider } from '@/lib/email-verify';
import { logAction } from '@/lib/audit';

/* ═══════════════════════════════════════════════════
   POST /api/verify-queue/process
   Processes up to 50 pending verifications per call
   ═══════════════════════════════════════════════════ */

async function checkMXRecords(email: string): Promise<{ pass: boolean }> {
  const domain = email.split('@')[1];
  if (!domain) return { pass: false };
  try {
    const addresses = await dns.resolveMx(domain);
    if (addresses && addresses.length > 0) return { pass: true };
    try { await dns.resolve4(domain); return { pass: true }; } catch { return { pass: false }; }
  } catch {
    try { await dns.resolve4(domain); return { pass: true }; } catch { return { pass: false }; }
  }
}

async function verifySingleContact(contact: any): Promise<{ health: string; score: number }> {
  const email = contact.email;
  if (!email) return { health: 'unknown', score: 0 };

  const syntax = checkSyntax(email);
  const disposable = checkDisposable(email);
  const roleBased = checkRoleBased(email);
  const freeProvider = checkFreeProvider(email);
  const mx = await checkMXRecords(email);

  let score = 0;
  if (syntax.pass) score += 25;
  if (mx.pass) score += 30;
  if (disposable.pass) score += 10; else score -= 40;
  if (roleBased.pass) score += 10; else score -= 15;
  if (freeProvider.detail === 'Corporate/custom domain') score += 15;
  score = Math.max(0, Math.min(100, score));

  let health = 'valid';
  if (!syntax.pass || !mx.pass || !disposable.pass) health = 'invalid';
  else if (!roleBased.pass || freeProvider.detail.startsWith('Free')) health = 'risky';

  return { health, score };
}

export async function POST() {
  try {
    const contacts = await db.contact.findMany({
      where: {
        email: { not: null },
        emailHealth: 'unknown',
      },
      select: { id: true, email: true },
      take: 50,
    });

    if (contacts.length === 0) {
      return NextResponse.json({ processed: 0, message: 'No pending contacts to verify' });
    }

    let processed = 0;
    let updated = 0;

    for (const contact of contacts) {
      try {
        const result = await verifySingleContact(contact);
        await db.contact.update({
          where: { id: contact.id },
          data: {
            emailHealth: result.health,
            emailHealthScore: result.score,
            lastCheckedAt: new Date(),
          },
        });
        updated++;
        await logAction('email_verified', 'Contact', contact.id, {
          email: contact.email,
          health: result.health,
          score: result.score,
        });
      } catch (err) {
        console.error(`Verification failed for ${contact.email}:`, err);
      }
      processed++;
    }

    // Check if more remain
    const remaining = await db.contact.count({
      where: { email: { not: null }, emailHealth: 'unknown' },
    });

    return NextResponse.json({
      processed,
      updated,
      remaining,
      message: `Verified ${updated} of ${processed} contacts. ${remaining} remaining.`,
    });
  } catch (error) {
    console.error('Verify process error:', error);
    return NextResponse.json({ error: 'Verification processing failed' }, { status: 500 });
  }
}