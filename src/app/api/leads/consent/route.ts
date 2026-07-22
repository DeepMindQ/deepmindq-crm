import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logAction } from '@/lib/audit';

/* ═══════════════════════════════════════════════════
   POST /api/leads/consent
   Update consent status for a contact
   ═══════════════════════════════════════════════════ */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, consentStatus, consentSource } = body;

    if (!id || !consentStatus) {
      return NextResponse.json({ error: 'id and consentStatus are required' }, { status: 400 });
    }

    const validStatuses = ['unknown', 'opted_in', 'opted_out'];
    if (!validStatuses.includes(consentStatus)) {
      return NextResponse.json({ error: 'Invalid consentStatus. Use: unknown, opted_in, opted_out' }, { status: 400 });
    }

    const contact = await db.contact.findUnique({ where: { id } });
    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const updateData: any = {
      consentStatus,
      consentDate: consentStatus === 'opted_in' ? new Date() : undefined,
    };
    if (consentSource) updateData.consentSource = consentSource;
    if (consentStatus === 'opted_out') {
      updateData.isSuppressed = true;
      updateData.suppressionReason = 'consent_withdrawn';
    }
    if (consentStatus === 'opted_in' && contact.suppressionReason === 'consent_withdrawn') {
      updateData.isSuppressed = false;
      updateData.suppressionReason = null;
    }

    const updated = await db.contact.update({
      where: { id },
      data: updateData,
    });

    await logAction('consent_updated', 'Contact', id, {
      from: contact.consentStatus,
      to: consentStatus,
      source: consentSource,
    });

    return NextResponse.json({ success: true, contact: updated });
  } catch (error) {
    console.error('Consent error:', error);
    return NextResponse.json({ error: 'Failed to update consent' }, { status: 500 });
  }
}