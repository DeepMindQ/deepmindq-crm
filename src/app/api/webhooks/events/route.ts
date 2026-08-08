import { NextResponse } from 'next/server'
import { WEBHOOK_EVENTS } from '@/lib/webhook-manager'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    events: WEBHOOK_EVENTS.map((e) => ({
      name: e,
      description: e.replace(/\./g, ' ').replace(/_/g, ' '),
    })),
  })
}
