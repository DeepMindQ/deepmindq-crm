/**
 * POST /api/intelligence/internal-memory
 *
 * Sprint 3A: Internal Memory Connector API
 *
 * Extracts intelligence signals from internal CRM data and optionally
 * persists them as CompanySignals in the intelligence pipeline.
 */

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { extractInternalMemorySignals, computeInternalMemoryDepth } from '@/lib/intelligence-sources/internal-memory-connector'
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { companyId } = body as { companyId?: string }

    if (!companyId || typeof companyId !== 'string') {
      return NextResponse.json(
        { error: 'companyId is required (string)' },
        { status: 400 },
      )
    }

    const company = await db.company.findUnique({
      where: { id: companyId },
      select: {
        id: true, rawName: true, normalizedName: true,
        industry: true, sizeRange: true,
      },
    })

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Extract internal memory signals (includes persistence)
    const result = await extractInternalMemorySignals(companyId)
    const depth = await computeInternalMemoryDepth(companyId)

    return NextResponse.json({
      company: {
        id: company.id,
        name: company.normalizedName || company.rawName,
        industry: company.industry,
        sizeRange: company.sizeRange,
      },
      signals: result.signals.slice(0, 20),
      sources: result.sources,
      memoryDepth: depth,
      meta: {
        totalSignalsExtracted: result.signalsExtracted,
        signalsPersisted: result.signalsPersisted,
        pipelineLatencyMs: Date.now() - startTime,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error('[internal-memory] Pipeline error:', { detail: message })
    return NextResponse.json(
      { error: `Internal memory extraction failed: ${message}` },
      { status: 500 },
    )
  }
}
