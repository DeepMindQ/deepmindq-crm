import { NextResponse } from 'next/server'
import { getDailyCostStatus } from '@/lib/intelligence-sources/ai-cost-governance'

// GET /api/admin/ai-usage — AI cost dashboard
export async function GET() {
  try {
    const status = await getDailyCostStatus()
    return NextResponse.json({ ok: true, ...status })
  } catch (err) {
    console.error('[api/admin/ai-usage] Error:', err)
    return NextResponse.json({ ok: false, error: 'Failed to fetch AI usage' }, { status: 500 })
  }
}
