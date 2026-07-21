// GET /api/g-intelligence/companies/[id]/health
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const health = await db.companyIntelligenceHealth.findUnique({ where: { companyId: id } });
  if (!health) return NextResponse.json({ error: 'Health not calculated. Run validation first.' }, { status: 404 });
  return NextResponse.json({
    companyId: health.companyId,
    overallHealthScore: health.overallHealthScore,
    dataCompletenessScore: health.dataCompletenessScore,
    signalCoverageScore: health.signalCoverageScore,
    evidenceCoverageScore: health.evidenceCoverageScore,
    contactCoverageScore: health.contactCoverageScore,
    fieldCoverage: health.fieldCoverage,
    totalSignals: health.totalSignals,
    activeSignals: health.activeSignals,
    totalEvidence: health.totalEvidence,
    activeEvidence: health.activeEvidence,
    totalContacts: health.totalContacts,
    filledFields: health.filledFields,
    totalTrackedFields: health.totalTrackedFields,
    lastCalculatedAt: health.lastCalculatedAt,
  });
}