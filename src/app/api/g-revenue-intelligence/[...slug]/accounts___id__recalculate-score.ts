import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/apiHelpers';
import { calculateAndPersistScore } from '@/lib/revenue-intelligence/account-scorer';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await calculateAndPersistScore(id);
    return apiSuccess(result);
  } catch (err: any) {
    const msg = err?.message || 'Unknown error';
    if (msg.includes('not found')) return apiError(msg, 404);
    return apiError(`Score calculation failed: ${msg}`, 500);
  }
}
