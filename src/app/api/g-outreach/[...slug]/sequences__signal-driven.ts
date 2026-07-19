import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { generateSignalDrivenSequence } from '@/lib/research-engine/signal-sequence-engine';

/* ═══════════════════════════════════════════════════
   POST /api/sequences/signal-driven
   Generate an AI-driven outreach sequence from a buying signal
   and capability match

   Body: { companyId, signalId, capabilityMatchId, contactId }
   ═══════════════════════════════════════════════════ */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyId, signalId, capabilityMatchId, contactId } = body;

    if (!companyId || !signalId || !capabilityMatchId || !contactId) {
      return NextResponse.json(
        { error: 'companyId, signalId, capabilityMatchId, and contactId are required' },
        { status: 400 },
      );
    }

    // Validate all referenced entities exist
    const [signal, capabilityMatch, contact] = await Promise.all([
      db.companySignal.findUnique({ where: { id: signalId } }),
      db.signalCapabilityMatch.findUnique({ where: { id: capabilityMatchId } }),
      db.contact.findUnique({
        where: { id: contactId },
        include: { company: true },
      }),
    ]);

    if (!signal) {
      return NextResponse.json({ error: `Signal ${signalId} not found` }, { status: 404 });
    }

    if (!capabilityMatch) {
      return NextResponse.json(
        { error: `Capability match ${capabilityMatchId} not found` },
        { status: 404 },
      );
    }

    if (!contact) {
      return NextResponse.json({ error: `Contact ${contactId} not found` }, { status: 404 });
    }

    // Verify signal belongs to the company
    if (signal.companyId !== companyId) {
      return NextResponse.json(
        { error: `Signal ${signalId} does not belong to company ${companyId}` },
        { status: 400 },
      );
    }

    // Verify capability match belongs to the company
    if (capabilityMatch.companyId !== companyId) {
      return NextResponse.json(
        { error: `Capability match ${capabilityMatchId} does not belong to company ${companyId}` },
        { status: 400 },
      );
    }

    // Verify contact belongs to the company
    if (contact.companyId !== companyId) {
      return NextResponse.json(
        { error: `Contact ${contactId} does not belong to company ${companyId}` },
        { status: 400 },
      );
    }

    // Generate the signal-driven sequence (generatedBy: 'signal_driven')
    const result = await generateSignalDrivenSequence({
      companyId,
      signalId,
      capabilityMatchId,
      contactId,
    });

    return NextResponse.json({ success: true, generatedBy: 'signal_driven', ...result });
  } catch (error) {
    console.error('Signal-driven sequence generation error:', error);
    return NextResponse.json(
      {
        error:
          'Failed to generate signal-driven sequence: ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      },
      { status: 500 },
    );
  }
}