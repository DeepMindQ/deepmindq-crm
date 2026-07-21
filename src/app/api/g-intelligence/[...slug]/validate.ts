// POST /api/g-intelligence/companies/[id]/validate
import { NextRequest, NextResponse } from 'next/server';
import { validateCompanySignals } from '@/lib/signal-validation';
import { detectContradictions } from '@/lib/contradiction-detection';
import { computeAndPersistHealth } from '@/lib/intelligence-health';
import { db } from '@/lib/db';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Verify company exists
  const company = await db.company.findUnique({ where: { id }, select: { id: true } });
  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 });

  // Step 1: Validate signals (must run before contradiction detection
  // because signal validation checks for existing conflicts)
  const signalResult = await validateCompanySignals(id);

  // Step 2: Detect contradictions (creates new conflicts, closes old open ones)
  const conflictResult = await detectContradictions(id);

  // Step 3: Re-validate signals that are now marked as CONFLICTING
  // (the contradiction detection may have created new conflicts)
  const revalidationResult = conflictResult.detected > 0
    ? await validateCompanySignals(id)
    : { validated: 0, results: [] };

  // Step 4: Compute and persist health score
  const healthResult = await computeAndPersistHealth(id);

  // Step 5: Populate confidenceBreakdown on existing recommendations
  const { backfillConfidenceBreakdowns } = await import('@/lib/intelligence-confidence');
  const backfilled = await backfillConfidenceBreakdowns();

  return NextResponse.json({
    success: true,
    results: {
      signalsValidated: signalResult.validated + revalidationResult.validated,
      newConflicts: conflictResult.detected,
      healthUpdated: true,
      previousHealth: healthResult.previousHealth,
      newHealth: healthResult.newHealth,
      recommendationsBackfilled: backfilled,
    },
  });
}