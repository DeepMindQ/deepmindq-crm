import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/apiHelpers';
import { getGlobalOpportunityRadar } from '@/lib/revenue-intelligence/opportunity-radar';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category') || undefined;
  const minScore = searchParams.get('minScore') ? parseInt(searchParams.get('minScore')!, 10) : undefined;
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;

  const opportunities = await getGlobalOpportunityRadar({ category, minScore, limit });
  return apiSuccess(opportunities);
}
