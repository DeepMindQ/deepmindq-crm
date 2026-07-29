/**
 * POST /api/intelligence/internal-memory
 *
 * Sprint 3A: Internal Memory Connector API
 *
 * Extracts intelligence signals from internal CRM data:
 *   - Company notes (meeting, call, discovery, research, swot, competitive)
 *   - Contact notes (champion detection, buying signals)
 *   - Timeline events (email replies, contact additions, status changes)
 *   - Human intelligence submissions
 *   - Contact changes (promotions, role shifts, status changes)
 *
 * Accepts: { companyId: string, persistAsSignals?: boolean }
 * Returns:  { company, signals, sources, meta }
 */

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import {
  extractInternalMemorySignals,
  persistInternalSignalsAsCompanySignals,
} from '@/lib/intelligence-sources/internal-memory-connector'

export async function POST(request: Request) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { companyId, persistAsSignals } = body as { companyId?: string; persistAsSignals?: boolean }

    if (!companyId || typeof companyId !== 'string') {
      return NextResponse.json(
        { error: 'companyId is required (string)' },
        { status: 400 },
      )
    }

    // Verify company exists
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        rawName: true,
        normalizedName: true,
        industry: true,
        sizeRange: true,
      },
    })

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Extract internal memory signals
    const result = await extractInternalMemorySignals(companyId)

    // Optionally persist as CompanySignals
    let persistenceResult = { created: 0, skipped: 0, failed: 0 }
    if (persistAsSignals && result.signals.length > 0) {
      persistenceResult = await persistInternalSignalsAsCompanySignals(companyId, result.signals)
    }

    return NextResponse.json({
      company: {
        id: company.id,
        name: company.normalizedName || company.rawName,
        industry: company.industry,
        sizeRange: company.sizeRange,
      },
      signals: result.signals.slice(0, 20),
      sources: {
        companyNotes: result.companyNotesCount,
        contactNotes: result.contactNotesCount,
        timelineEvents: result.timelineEventsCount,
        humanIntelligence: result.humanIntelligenceCount,
        contactChanges: result.contactChangesCount,
        signalsBySource: result.signalsBySource,
      },
      persistence: persistAsSignals ? persistenceResult : undefined,
      meta: {
        totalSignalsExtracted: result.signalsExtracted,
        pipelineLatencyMs: Date.now() - startTime,
        processedAt: result.processedAt,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[internal-memory] Pipeline error:', message)
    return NextResponse.json(
      { error: `Internal memory extraction failed: ${message}` },
      { status: 500 },
    )
  }
}
