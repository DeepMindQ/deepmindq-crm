import { NextResponse } from 'next/server'
import { checkApiAuth, requireAdminRole } from '@/lib/api-auth'
import { getDailyCostStatus } from '@/lib/intelligence-sources/ai-cost-governance'
import { logger } from '@/lib/logger';

// GET /api/admin/ai-usage — AI cost dashboard (admin-only)
export async function GET(request: Request) {
  // Auth gate: require authenticated admin
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  const adminCheck = requireAdminRole(session!);
  if (adminCheck) return adminCheck;

  try {
    const status = await getDailyCostStatus()
    return NextResponse.json({ ok: true, ...status })
  } catch (err) {
    logger.info('[api/admin/ai-usage] Error:', { error: err })
    return NextResponse.json({ ok: false, error: 'Failed to fetch AI usage' }, { status: 500 })
  }
}
