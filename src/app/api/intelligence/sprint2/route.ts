/**
 * POST /api/intelligence/sprint2
 *
 * Sprint 2 Intelligence Pipeline — Association + Confidence + Governance
 *
 * Accepts: { companyId: string }
 * Returns:  { company, duplicates, conflicts, confidence, associations, meta }
 *
 * Sprint 2 adds the intelligence fabric layer on top of Sprint 1 signals:
 * 1. Duplicate detection via Jaccard similarity
 * 2. Conflict detection via sentiment/negation heuristics
 * 3. Confidence recalculation (source quality 35%, freshness 35%, content validation 30%)
 * 4. Auto-associations for detected duplicates
 * 5. Knowledge versioning snapshots
 */

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger';
import {
  detectDuplicates,
  detectConflicts,
  createAssociation,
  getAssociations,
} from '@/lib/intelligence-sources/association-engine'
import {
  calculateConfidence,
  calculateFreshness,
  generateConfidenceExplanation,
  recalculateCompanyConfidence,
} from '@/lib/intelligence-sources/confidence-engine'

// ─── Types ──────────────────────────────────────────────────────────

interface Sprint2Response {
  company: {
    id: string
    name: string
    industry: string | null
    domain: string | null
    sizeRange: string | null
  }
  duplicates: Array<{
    objectId: string
    matchCount: number
    matches: Array<{ objectId: string; similarity: number; sharedFields: string[] }>
  }>
  conflicts: Array<{
    objectId1: string
    objectId2: string
    category: string
    conflictType: string
    description: string
    severity: string
  }>
  confidence: {
    recalculated: number
    objects: number
    results: Array<{
      objectId: string
      oldConfidence: number
      newConfidence: number
      delta: number
      breakdown: {
        sourceQuality: number
        freshness: number
        contentValidation: number
      }
      explanation: string
    }>
  }
  associations: {
    total: number
    unresolved: number
    newDuplicates: number
  }
  meta: {
    pipelineLatencyMs: number
    intelligenceObjectsScanned: number
    companySignalsCount: number
  }
}

// ─── POST Handler ──────────────────────────────────────────────────

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

    // 1. Fetch company + intelligence object count
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        rawName: true,
        industry: true,
        domain: true,
        sizeRange: true,
      },
    })

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const [
      intelObjectCount,
      signalCount,
    ] = await Promise.all([
      db.intelligenceObject.count({ where: { companyId, status: { notIn: ['archived', 'rejected'] } } }),
      db.companySignal.count({ where: { companyId } }),
    ])

    // 2. Sprint 2 Step 1: Duplicate Detection (Jaccard similarity >= 0.6)
    const duplicates = await detectDuplicates(companyId)

    // 3. Sprint 2 Step 2: Conflict Detection (sentiment, confidence divergence, temporal)
    const conflicts = await detectConflicts(companyId)

    // 4. Sprint 2 Step 3: Auto-create duplicate associations
    let newDuplicateAssociations = 0
    for (const dup of duplicates) {
      for (const match of dup.matches) {
        try {
          // Check if association already exists
          const existing = await db.intelligenceAssociation.findFirst({
            where: {
              sourceId: dup.objectId,
              targetId: match.objectId,
              associationType: 'duplicate',
            },
          })
          if (!existing) {
            await createAssociation({
              sourceId: dup.objectId,
              targetId: match.objectId,
              associationType: 'duplicate',
              confidence: match.similarity,
              metadata: {
                autoDetected: true,
                sharedFields: match.sharedFields,
                method: 'jaccard_similarity',
              },
            })
            newDuplicateAssociations++
          }
        } catch (err) {
          logger.warn(`[sprint2] Auto-association failed:`, { error: err instanceof Error ? err.message : err })
        }
      }
    }

    // 5. Sprint 2 Step 4: Confidence Recalculation (weighted composite)
    const confidenceResult = await recalculateCompanyConfidence(companyId)

    // Build confidence detail with breakdowns
    const confidenceDetails = await Promise.all(
      confidenceResult.results.slice(0, 20).map(async (r) => {
        const obj = await db.intelligenceObject.findUnique({
          where: { id: r.objectId },
          select: { sourceType: true, capturedAt: true, content: true },
        })
        if (!obj) return null

        const result = calculateConfidence({
          sourceType: obj.sourceType,
          capturedAt: obj.capturedAt,
          content: obj.content,
          originalConfidence: r.newConfidence,
        })

        const freshness = calculateFreshness(obj.capturedAt, obj.sourceType)

        return {
          objectId: r.objectId,
          oldConfidence: Math.round(r.oldConfidence * 100),
          newConfidence: Math.round(r.newConfidence * 100),
          delta: Math.round((r.newConfidence - r.oldConfidence) * 100),
          breakdown: result.breakdown,
          explanation: generateConfidenceExplanation(result),
        }
      }),
    )

    // 6. Get total associations
    const [totalAssociations, unresolvedAssociations] = await Promise.all([
      db.intelligenceAssociation.count({ where: { companyId } }),
      db.intelligenceAssociation.count({ where: { companyId, resolved: false } }),
    ])

    const response: Sprint2Response = {
      company: {
        id: company.id,
        name: company.rawName,
        industry: company.industry,
        domain: company.domain,
        sizeRange: company.sizeRange,
      },
      duplicates: duplicates.map(d => ({
        objectId: d.objectId,
        matchCount: d.matches.length,
        matches: d.matches.map(m => ({
          objectId: m.objectId,
          similarity: m.similarity,
          sharedFields: m.sharedFields,
        })),
      })),
      conflicts: conflicts.map(c => ({
        objectId1: c.objectId1,
        objectId2: c.objectId2,
        category: c.category,
        conflictType: c.conflictType,
        description: c.description,
        severity: c.severity,
      })),
      confidence: {
        recalculated: confidenceResult.updated,
        objects: confidenceResult.results.length,
        results: confidenceDetails.filter(Boolean) as Sprint2Response['confidence']['results'],
      },
      associations: {
        total: totalAssociations,
        unresolved: unresolvedAssociations,
        newDuplicates: newDuplicateAssociations,
      },
      meta: {
        pipelineLatencyMs: Date.now() - startTime,
        intelligenceObjectsScanned: intelObjectCount,
        companySignalsCount: signalCount,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error('[sprint2] Pipeline error:', { detail: message })
    return NextResponse.json(
      { error: `Sprint 2 pipeline failed: ${message}` },
      { status: 500 },
    )
  }
}
