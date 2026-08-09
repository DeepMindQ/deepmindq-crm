/**
 * DeepMindQ — AI Content Approval Service
 *
 * Provides a human-in-the-loop approval workflow for AI-generated content.
 * All approval records are persisted via SystemSetting (key-value JSON).
 *
 * Usage:
 *   import { approvalService } from '@/lib/approval-service'
 *   await approvalService.requestApproval('draft_123', 'ai_email_draft')
 *   await approvalService.approveContent('APR_xxx', 'user_42')
 */

import { db } from '@/lib/db'
import { childLogger } from '@/lib/logger'

const log = childLogger({ module: 'approval-service' })

// ─── Types ──────────────────────────────────────────────────────────────

export type ApprovalStatus = 'pending_approval' | 'approved' | 'rejected' | 'auto_approved'
export type ApprovalContentType =
  | 'ai_email_draft'
  | 'ai_score'
  | 'ai_brief'
  | 'ai_recommendation'
  | 'ai_signal_analysis'
  | 'other'

export interface ContentApproval {
  id: string
  contentId: string
  contentType: ApprovalContentType
  status: ApprovalStatus
  reviewerId: string | null
  reviewedAt: string | null
  rejectionReason: string | null
  createdAt: string
  updatedAt: string
  metadata?: Record<string, unknown>
}

export interface ApprovalConfig {
  autoApproveThreshold: number // 0-1 confidence above which content is auto-approved
  enabledContentTypes: ApprovalContentType[]
}

const DEFAULT_CONFIG: ApprovalConfig = {
  autoApproveThreshold: 0.95,
  enabledContentTypes: [
    'ai_email_draft',
    'ai_score',
    'ai_brief',
    'ai_recommendation',
    'ai_signal_analysis',
    'other',
  ],
}

const SYSTEM_SETTING_KEY = 'content_approvals'
const CONFIG_KEY = 'approval_config'

// ─── Service ───────────────────────────────────────────────────────────

class ApprovalService {
  private cache: ContentApproval[] | null = null

  /**
   * Load all approvals from SystemSetting.
   * Uses in-memory cache for fast reads; call invalidateCache() after writes.
   */
  private async loadAll(): Promise<ContentApproval[]> {
    if (this.cache) return this.cache!

    try {
      const row = await db.systemSetting.findUnique({
        where: { key: SYSTEM_SETTING_KEY },
      })
      this.cache = row ? JSON.parse(row.value) : []
    } catch (error) {
      log.warn('Failed to load approvals from DB', { error: String(error) })
      this.cache = []
    }
    return this.cache!
  }

  private async persist(approvals: ContentApproval[]): Promise<void> {
    this.cache = approvals
    try {
      await db.systemSetting.upsert({
        where: { key: SYSTEM_SETTING_KEY },
        update: { value: JSON.stringify(approvals) },
        create: { key: SYSTEM_SETTING_KEY, value: JSON.stringify(approvals) },
      })
    } catch (error) {
      log.error('Failed to persist approvals to DB', { error: String(error) })
    }
  }

  /**
   * Request approval for AI-generated content.
   * Sets status to pending_approval.
   */
  async requestApproval(
    contentId: string,
    contentType: ApprovalContentType,
    metadata?: Record<string, unknown>
  ): Promise<ContentApproval> {
    const approvals = await this.loadAll()
    const now = new Date().toISOString()

    // Check for existing pending/approved approval for this content
    const existing = approvals.find(
      (a) => a.contentId === contentId && a.status === 'pending_approval'
    )
    if (existing) {
      log.info('Approval already pending for content', { contentId })
      return existing
    }

    const approval: ContentApproval = {
      id: `APR_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      contentId,
      contentType,
      status: 'pending_approval',
      reviewerId: null,
      reviewedAt: null,
      rejectionReason: null,
      createdAt: now,
      updatedAt: now,
      metadata,
    }

    approvals.push(approval)
    await this.persist(approvals)

    log.info('Approval requested', {
      approvalId: approval.id,
      contentId,
      contentType,
    })

    return approval
  }

  /**
   * Approve content by a human reviewer.
   */
  async approveContent(approvalId: string, reviewerId: string): Promise<ContentApproval | null> {
    const approvals = await this.loadAll()
    const idx = approvals.findIndex((a) => a.id === approvalId)
    if (idx === -1) return null

    const now = new Date().toISOString()
    approvals[idx] = {
      ...approvals[idx],
      status: 'approved',
      reviewerId,
      reviewedAt: now,
      updatedAt: now,
      rejectionReason: null,
    }
    await this.persist(approvals)

    log.info('Content approved', {
      approvalId,
      reviewerId,
      contentId: approvals[idx].contentId,
    })

    return approvals[idx]
  }

  /**
   * Reject content by a human reviewer with an optional reason.
   */
  async rejectContent(
    approvalId: string,
    reviewerId: string,
    reason?: string
  ): Promise<ContentApproval | null> {
    const approvals = await this.loadAll()
    const idx = approvals.findIndex((a) => a.id === approvalId)
    if (idx === -1) return null

    const now = new Date().toISOString()
    approvals[idx] = {
      ...approvals[idx],
      status: 'rejected',
      reviewerId,
      reviewedAt: now,
      updatedAt: now,
      rejectionReason: reason || null,
    }
    await this.persist(approvals)

    log.info('Content rejected', {
      approvalId,
      reviewerId,
      contentId: approvals[idx].contentId,
      reason: reason || 'No reason provided',
    })

    return approvals[idx]
  }

  /**
   * Auto-approve content if confidence exceeds the configured threshold.
   * Returns the (possibly auto-approved) ContentApproval record.
   */
  async autoApproveIfNeeded(
    contentId: string,
    contentType: ApprovalContentType,
    confidence: number,
    metadata?: Record<string, unknown>
  ): Promise<ContentApproval> {
    const config = await this.getConfig()

    // If this content type doesn't require approval, auto-approve immediately
    if (!config.enabledContentTypes.includes(contentType)) {
      const approval = await this.requestApproval(contentId, contentType, {
        ...metadata,
        confidence,
      })
      return approval // returned as pending_approval; caller can skip the workflow
    }

    if (confidence >= config.autoApproveThreshold) {
      const approval = await this.requestApproval(contentId, contentType, {
        ...metadata,
        confidence,
        autoApproved: true,
      })
      // Immediately approve
      await this.approveContent(approval.id, 'system:auto')

      log.info('Content auto-approved', {
        contentId,
        contentType,
        confidence,
        threshold: config.autoApproveThreshold,
      })

      // Re-fetch the approved version
      const approvals = await this.loadAll()
      return approvals.find((a) => a.id === approval.id)!
    }

    // Below threshold — stays pending for human review
    const approval = await this.requestApproval(contentId, contentType, {
      ...metadata,
      confidence,
      autoApproved: false,
    })

    log.info('Content queued for manual approval', {
      contentId,
      contentType,
      confidence,
      threshold: config.autoApproveThreshold,
    })

    return approval
  }

  /**
   * Get all pending approvals, sorted by creation date (oldest first).
   */
  async getPendingApprovals(): Promise<ContentApproval[]> {
    const approvals = await this.loadAll()
    return approvals
      .filter((a) => a.status === 'pending_approval')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }

  /**
   * Get all approvals, optionally filtered by status or content type.
   */
  async getApprovals(filter?: {
    status?: ApprovalStatus
    contentType?: ApprovalContentType
    contentId?: string
  }): Promise<ContentApproval[]> {
    const approvals = await this.loadAll()
    let result = approvals

    if (filter?.status) {
      result = result.filter((a) => a.status === filter.status)
    }
    if (filter?.contentType) {
      result = result.filter((a) => a.contentType === filter.contentType)
    }
    if (filter?.contentId) {
      result = result.filter((a) => a.contentId === filter.contentId)
    }

    return result.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }

  /**
   * Get a single approval by ID.
   */
  async getApproval(approvalId: string): Promise<ContentApproval | null> {
    const approvals = await this.loadAll()
    return approvals.find((a) => a.id === approvalId) || null
  }

  /**
   * Get approval configuration.
   */
  async getConfig(): Promise<ApprovalConfig> {
    try {
      const row = await db.systemSetting.findUnique({
        where: { key: CONFIG_KEY },
      })
      return row ? { ...DEFAULT_CONFIG, ...JSON.parse(row.value) } : { ...DEFAULT_CONFIG }
    } catch {
      return { ...DEFAULT_CONFIG }
    }
  }

  /**
   * Update approval configuration.
   */
  async updateConfig(partial: Partial<ApprovalConfig>): Promise<ApprovalConfig> {
    const current = await this.getConfig()
    const updated = { ...current, ...partial }
    await db.systemSetting.upsert({
      where: { key: CONFIG_KEY },
      update: { value: JSON.stringify(updated) },
      create: { key: CONFIG_KEY, value: JSON.stringify(updated) },
    })
    return updated
  }

  /**
   * Get summary statistics.
   */
  async getStats(): Promise<{
    total: number
    pending: number
    approved: number
    rejected: number
    autoApproved: number
    byType: Record<string, number>
  }> {
    const approvals = await this.loadAll()
    const stats = {
      total: approvals.length,
      pending: 0,
      approved: 0,
      rejected: 0,
      autoApproved: 0,
      byType: {} as Record<string, number>,
    }

    for (const a of approvals) {
      switch (a.status) {
        case 'pending_approval': stats.pending++; break
        case 'approved': stats.approved++; break
        case 'rejected': stats.rejected++; break
        case 'auto_approved': stats.autoApproved++; break
      }
      stats.byType[a.contentType] = (stats.byType[a.contentType] || 0) + 1
    }

    return stats
  }

  /**
   * Invalidate the in-memory cache (forces reload from DB on next read).
   */
  invalidateCache(): void {
    this.cache = null
  }
}

export const approvalService = new ApprovalService()
