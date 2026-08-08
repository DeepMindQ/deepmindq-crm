import { NextRequest, NextResponse } from 'next/server'
import { approvalService } from '@/lib/approval-service'
import type { ApprovalStatus, ApprovalContentType } from '@/lib/approval-service'

/**
 * GET /api/approvals
 *
 * Returns pending approvals, optionally filtered.
 * Query params: status, contentType, contentId
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') as ApprovalStatus | null
  const contentType = searchParams.get('contentType') as ApprovalContentType | null
  const contentId = searchParams.get('contentId')

  try {
    const filter: { status?: ApprovalStatus; contentType?: ApprovalContentType; contentId?: string } = {}

    if (status) filter.status = status
    if (contentType) filter.contentType = contentType
    if (contentId) filter.contentId = contentId

    // If no status filter, default to pending
    const approvals = filter.status
      ? await approvalService.getApprovals(filter)
      : await approvalService.getPendingApprovals()

    const stats = await approvalService.getStats()

    return NextResponse.json({
      approvals,
      stats,
    })
  } catch (error) {
    console.error('[API /approvals GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch approvals' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/approvals
 *
 * Approve or reject a pending approval.
 * Body: { approvalId, action: 'approve' | 'reject', reviewerId, reason? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { approvalId, action, reviewerId, reason } = body

    if (!approvalId || !action || !reviewerId) {
      return NextResponse.json(
        { error: 'approvalId, action, and reviewerId are required' },
        { status: 400 }
      )
    }

    const validActions = ['approve', 'reject']
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `action must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      )
    }

    let result
    if (action === 'approve') {
      result = await approvalService.approveContent(approvalId, reviewerId)
    } else {
      result = await approvalService.rejectContent(approvalId, reviewerId, reason)
    }

    if (!result) {
      return NextResponse.json(
        { error: 'Approval not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ approval: result })
  } catch (error) {
    console.error('[API /approvals PATCH]', error)
    return NextResponse.json(
      { error: 'Failed to update approval' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/approvals
 *
 * Create a new approval request.
 * Body: { contentId, contentType, metadata? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { contentId, contentType, metadata } = body

    if (!contentId || !contentType) {
      return NextResponse.json(
        { error: 'contentId and contentType are required' },
        { status: 400 }
      )
    }

    const validTypes: ApprovalContentType[] = [
      'ai_email_draft',
      'ai_score',
      'ai_brief',
      'ai_recommendation',
      'ai_signal_analysis',
      'other',
    ]
    if (!validTypes.includes(contentType)) {
      return NextResponse.json(
        { error: `contentType must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const approval = await approvalService.requestApproval(
      contentId,
      contentType as ApprovalContentType,
      metadata
    )

    return NextResponse.json({ approval }, { status: 201 })
  } catch (error) {
    console.error('[API /approvals POST]', error)
    return NextResponse.json(
      { error: 'Failed to create approval request' },
      { status: 500 }
    )
  }
}
