// GET /api/g-intelligence/companies/[id]/evidence-quality
import { NextRequest, NextResponse } from 'next/server';
import { computeEvidenceQuality } from '@/lib/research-engine/evidence-quality';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quality = await computeEvidenceQuality(id);
  return NextResponse.json({
    companyId: id,
    ...quality,
  });
}