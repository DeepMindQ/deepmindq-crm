import { NextRequest, NextResponse } from 'next/server';
import { apiError, apiSuccess } from '@/lib/apiHelpers';
import { getCompanyFreshnessProfile } from '@/lib/research-engine/freshness-indicators';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const companyId = slug?.[1];
  if (!companyId) return apiError('Company ID required', 400);

  try {
    const profile = await getCompanyFreshnessProfile(companyId);
    return apiSuccess(profile);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to get freshness profile', 404);
  }
}