import { NextResponse } from 'next/server'
import { getDailyCostStatus } from '@/lib/intelligence-sources/ai-cost-governance'
import { logger } from '@/lib/logger';

// GET /api/admin/ai-usage — AI cost dashboard
export async function GET() {
  try {
    const status = await getDailyCostStatus()
    return NextResponse.json({ ok: true, ...status })
  } catch (err) {
    logger.info('[api/admin/ai-usage] Error:', { error: err })
    return NextResponse.json({ ok: false, error: 'Failed to fetch AI usage' }, { status: 500 })
  }
}
