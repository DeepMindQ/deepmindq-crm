import { NextRequest, NextResponse } from 'next/server'
import {
  getWebhookConfigs,
  registerWebhook,
  deleteWebhook,
} from '@/lib/webhook-manager'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ webhooks: getWebhookConfigs() })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { url, events, secret, active, retryCount } = body

  if (!url || !events || !Array.isArray(events) || events.length === 0) {
    return NextResponse.json(
      { error: 'url and events are required' },
      { status: 400 },
    )
  }

  const webhook = registerWebhook({
    url,
    events,
    secret: secret || `whsec_${Math.random().toString(36).slice(2)}`,
    active: active ?? true,
    retryCount: retryCount ?? 3,
  })

  return NextResponse.json({ webhook }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id)
    return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const deleted = deleteWebhook(id)
  if (!deleted)
    return NextResponse.json(
      { error: 'Webhook not found' },
      { status: 404 },
    )

  return NextResponse.json({ deleted: true })
}
