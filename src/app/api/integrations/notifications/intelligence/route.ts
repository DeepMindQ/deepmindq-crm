/**
 * POST /api/integrations/notifications/intelligence
 *
 * Manually trigger an intelligence notification action card to Slack/Teams.
 * Primarily useful for testing and one-off sends from external automations.
 *
 * Body:
 *   companyId, companyName, intelligenceType, summary, confidence,
 *   [evidenceCount], [priority], [deepLink], [source], [fields], [channel]
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { checkApiAuth } from '@/lib/api-auth'
import { apiError, apiSuccess } from '@/lib/apiHelpers'
import { validateBody } from '@/lib/apiHelpers'
import { sendIntelligenceAlert, type IntelligenceCardData } from '@/lib/integrations/notifications/intelligence-cards'
import { logger } from '@/lib/logger'

// ── Request schema ────────────────────────────────────────────────────────

const intelligenceCardSchema = z.object({
  companyId: z.string().min(1, 'companyId is required'),
  companyName: z.string().min(1, 'companyName is required'),
  intelligenceType: z.string().min(1, 'intelligenceType is required'),
  summary: z.string().min(1, 'summary is required').max(500, 'summary must be ≤ 500 characters'),
  confidence: z.number().min(0).max(1),
  evidenceCount: z.number().int().nonnegative().optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  deepLink: z.string().url().optional().or(z.literal('')),
  source: z.string().max(100).optional(),
  fields: z.record(z.string(), z.string().max(200)).optional(),
  channel: z.enum(['slack', 'teams', 'both']).optional().default('both'),
})

type ParsedBody = z.infer<typeof intelligenceCardSchema>

// ── POST handler ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<Response> {
  const { errorResponse } = await checkApiAuth(request)
  if (errorResponse) return errorResponse

  const raw = await request.json().catch(() => ({}))
  const parsed = validateBody(intelligenceCardSchema, raw)
  if (parsed instanceof Response) return parsed

  const body = parsed as ParsedBody

  const cardData: IntelligenceCardData = {
    companyId: body.companyId,
    companyName: body.companyName,
    intelligenceType: body.intelligenceType,
    summary: body.summary,
    confidence: body.confidence,
    evidenceCount: body.evidenceCount,
    priority: body.priority,
    deepLink: body.deepLink || undefined,
    source: body.source,
    timestamp: new Date(),
    fields: body.fields,
  }

  // Fire-and-forget — don't block the response on webhook delivery
  sendIntelligenceAlert(cardData, body.channel).catch(() => {
    // Already logged inside sendIntelligenceAlert
  })

  logger.info('[api/notifications/intelligence] Intelligence card queued', {
    companyId: cardData.companyId,
    intelligenceType: cardData.intelligenceType,
    channel: body.channel,
  })

  return apiSuccess({ message: 'Intelligence notification queued', channel: body.channel })
}
