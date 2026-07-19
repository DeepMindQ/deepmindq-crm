import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { generateSignalDrivenSequence } from '@/lib/research-engine/signal-sequence-engine';

/* ═══════════════════════════════════════════════════
   POST /api/sequences/signal-driven
   Generate an AI-driven outreach sequence

   Supports two paths:
     NEW:    { opportunityId, contactId }  — generates from an accepted OpportunityRecommendation
     LEGACY: { companyId, signalId, capabilityMatchId, contactId } — direct signal+match path

   NEVER imports callLLM directly.
   NEVER creates SendQueue entries.
   ═══════════════════════════════════════ */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { opportunityId, companyId, signalId, capabilityMatchId, contactId } = body;

    // ── Determine which path to use ──
    const isOpportunityPath = !!opportunityId && !!contactId && !companyId && !signalId && !capabilityMatchId;
    const isLegacyPath = !!companyId && !!signalId && !!capabilityMatchId && !!contactId && !opportunityId;

    if (!isOpportunityPath && !isLegacyPath) {
      return NextResponse.json(
        {
          error:
            'Provide either { opportunityId, contactId } (new path) or { companyId, signalId, capabilityMatchId, contactId } (legacy path)',
        },
        { status: 400 },
      );
    }

    // ── NEW PATH: Generate from an OpportunityRecommendation ──
    if (isOpportunityPath) {
      // 1. Load the opportunity
      const opportunity = await db.opportunityRecommendation.findUnique({
        where: { id: opportunityId },
      });

      if (!opportunity) {
        return NextResponse.json(
          { error: `OpportunityRecommendation ${opportunityId} not found` },
          { status: 404 },
        );
      }

      // 2. Only accepted opportunities can have sequences generated
      if (opportunity.status !== 'accepted') {
        return NextResponse.json(
          {
            error: `OpportunityRecommendation ${opportunityId} has status '${opportunity.status}'. Only 'accepted' opportunities can have sequences generated.`,
          },
          { status: 400 },
        );
      }

      // 3. Verify contact exists and belongs to the opportunity's company
      const contact = await db.contact.findUnique({
        where: { id: contactId },
      });

      if (!contact) {
        return NextResponse.json({ error: `Contact ${contactId} not found` }, { status: 404 });
      }

      if (contact.companyId !== opportunity.companyId) {
        return NextResponse.json(
          {
            error: `Contact ${contactId} does not belong to company ${opportunity.companyId} that the opportunity targets`,
          },
          { status: 400 },
        );
      }

      // 4. Generate the signal-driven sequence using the opportunity's signal+match+company
      const result = await generateSignalDrivenSequence({
        companyId: opportunity.companyId,
        signalId: opportunity.signalId,
        capabilityMatchId: opportunity.capabilityMatchId,
        contactId,
      });

      // 5. Attach the opportunityId to the created sequence
      await db.emailSequence.update({
        where: { id: result.sequence.id },
        data: { opportunityId },
      });

      return NextResponse.json({
        success: true,
        generatedBy: 'signal_driven',
        opportunityId,
        ...result,
      });
    }

    // ── LEGACY PATH: Direct signal+match+company+contact ──
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