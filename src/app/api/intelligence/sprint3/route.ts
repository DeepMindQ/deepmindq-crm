/**
 * Sprint 3 Action Generation API
 *
 * POST /api/intelligence/sprint3/generate  — Generate all 6 action types for a company
 * GET  /api/intelligence/sprint3/actions   — Retrieve cached action artifacts
 * POST /api/intelligence/sprint3/nba       — Quick Next Best Action only
 *
 * Sprint 3 converts intelligence (Sprint 1/2 signals, evidence, contacts)
 * into structured action artifacts: meeting prep, outreach, strategy,
 * stakeholder map, opportunity qualification, and next best action.
 */

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import {
  generateCompanyActions,
  generateNextBestActionOnly,
  getCachedActions,
  ACTION_TYPES,
  ACTION_LABELS,
} from '@/lib/intelligence-sources/action-engine'

// ─── POST: Generate All Actions ────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { companyId, actionType } = body as { companyId?: string; actionType?: string }

    if (!companyId || typeof companyId !== 'string') {
      return NextResponse.json(
        { error: 'companyId is required (string)' },
        { status: 400 },
      )
    }

    // Verify company exists
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { id: true, rawName: true },
    })

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Route: quick NBA only
    if (actionType === 'next_best_action') {
      const nba = await generateNextBestActionOnly(companyId)
      return NextResponse.json({
        company: { id: company.id, name: company.rawName },
        action: nba,
        meta: { mode: 'nba_only' },
      })
    }

    // Route: full generation
    const result = await generateCompanyActions(companyId)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[sprint3] Pipeline error:', message)
    return NextResponse.json(
      { error: `Sprint 3 pipeline failed: ${message}` },
      { status: 500 },
    )
  }
}

// ─── GET: Retrieve Cached Actions ──────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId query parameter is required' },
        { status: 400 },
      )
    }

    // Verify company exists
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { id: true, rawName: true, industry: true, sizeRange: true },
    })

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const actions = await getCachedActions(companyId)

    // Check if we have fresh data
    const hasAllActions = ACTION_TYPES.every(t =>
      actions.some(a => a.actionType === t)
    )

    return NextResponse.json({
      company,
      actions,
      meta: {
        totalActions: actions.length,
        hasAllSixTypes: hasAllActions,
        actionLabels: ACTION_LABELS,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[sprint3] GET error:', message)
    return NextResponse.json(
      { error: `Failed to retrieve actions: ${message}` },
      { status: 500 },
    )
  }
}
