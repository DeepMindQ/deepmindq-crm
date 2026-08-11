/**
 * Phase 6.2 — GDPR Article 17: Right to Deletion
 *
 * Cascade delete with 30-day grace period:
 *   - Day 0: Mark for deletion, export data, disable access
 *   - Day 30: Permanent deletion of all records
 *   - Cannot be undone after Day 30
 *   - Audit log of deletion request preserved
 *
 * Auth: Admin only
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkApiAuth, requireAdminRole } from '@/lib/api-auth';
import { logDataAccess } from '@/lib/access-audit';
import { validateBody } from '@/lib/apiHelpers';
import { accountDataDeletionCancelSchema, accountDataDeletionInitiateSchema } from '@/lib/validation-schemas';

export const dynamic = 'force-dynamic';

// ── Grace Period Constants ───────────────────────────────────────────

const GRACE_PERIOD_DAYS = 30;
const VALID_STATUSES = [
  'pending',
  'data_exported',
  'access_disabled',
  'deletion_scheduled',
  'completed',
  'cancelled',
];

// ── Async Phase Runners (fire-and-forget) ─────────────────────────────

/**
 * Phase 1: Trigger a pre-deletion data export and link it to the deletion request.
 * Updates status to 'data_exported' on success.
 */
async function phase1ExportData(deletionRequestId: string): Promise<void> {
  try {
    const deletionRequest = await db.dataDeletionRequest.findUnique({
      where: { id: deletionRequestId },
    });
    if (!deletionRequest) return;

    // Create a DataExport job for archival purposes
    const companyId = process.env.COMPANY_ID || undefined;
    const exportJob = await db.dataExport.create({
      data: {
        format: 'json',
        entityType: 'account_full',
        filters: {
          deletionRequestId,
          companyId: companyId || 'all',
          reason: 'pre_deletion_archive',
        } as Record<string, unknown>,
        fields: [
          'companies', 'contacts', 'signals', 'timeline_events',
          'ai_generation_audits', 'knowledge_entries', 'audit_logs', 'sessions',
        ] as unknown[],
        status: 'processing',
        createdBy: deletionRequest.requesterId,
        startedAt: new Date(),
      },
    });

    // Collect essential data for the archive in parallel with individual try/catch
    const [companies, contacts, signals] = await Promise.all([
      db.company
        .findMany({
          where: companyId ? { id: companyId } : {},
          take: 50000,
        })
        .catch(() => [] as Record<string, unknown>[]),
      db.contact
        .findMany({
          where: companyId ? { companyId } : {},
          take: 50000,
        })
        .catch(() => [] as Record<string, unknown>[]),
      db.companySignal
        .findMany({
          where: companyId ? { companyId } : {},
          take: 50000,
        })
        .catch(() => [] as Record<string, unknown>[]),
    ]);

    const archiveData = {
      exportedAt: new Date().toISOString(),
      deletionRequestId,
      reason: 'pre_deletion_archive',
      summary: {
        companies: companies.length,
        contacts: contacts.length,
        signals: signals.length,
      },
      data: { companies, contacts, signals },
    };

    const jsonContent = JSON.stringify(archiveData, null, 2);
    const fileSize = Buffer.byteLength(jsonContent, 'utf-8');

    // Write to temp file
    const { writeFile, mkdir } = await import('fs/promises');
    const { join } = await import('path');
    const exportDir = '/tmp/exports';
    await mkdir(exportDir, { recursive: true });
    const filePath = join(exportDir, `deletion-archive-${deletionRequestId}.json`);
    await writeFile(filePath, jsonContent, 'utf-8');

    const totalRows = companies.length + contacts.length + signals.length;

    // Complete the export job
    await db.dataExport.update({
      where: { id: exportJob.id },
      data: {
        status: 'completed',
        totalRows,
        exportedRows: totalRows,
        fileSize,
        filePath,
        completedAt: new Date(),
      },
    });

    // Link the export to the deletion request and advance status
    await db.dataDeletionRequest.update({
      where: { id: deletionRequestId },
      data: {
        status: 'data_exported',
        exportDataExportId: exportJob.id,
      },
    });

    logger.info('[DataDeletion] Phase 1 complete: data exported', {
      deletionRequestId,
      exportJobId: exportJob.id,
      fileSize,
    });
  } catch (err) {
    logger.error('[DataDeletion] Phase 1 failed', {
      error: err instanceof Error ? err.message : String(err),
      deletionRequestId,
    });
    // Don't advance status — it stays 'pending' so admin can retry
  }
}

/**
 * Phase 2: Invalidate all user sessions to prevent access.
 * Updates status to 'access_disabled' on success.
 */
async function phase2DisableAccess(deletionRequestId: string): Promise<void> {
  try {
    // Expire all active sessions by setting expiresAt to the past
    const result = await db.session.updateMany({
      where: {
        expiresAt: { gt: new Date() },
      },
      data: {
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expire 1 day ago
      },
    });

    await db.dataDeletionRequest.update({
      where: { id: deletionRequestId },
      data: { status: 'access_disabled' },
    });

    logger.info('[DataDeletion] Phase 2 complete: access disabled', {
      deletionRequestId,
      sessionsExpired: result.count,
    });
  } catch (err) {
    logger.error('[DataDeletion] Phase 2 failed', {
      error: err instanceof Error ? err.message : String(err),
      deletionRequestId,
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// POST /api/account/data-deletion — Initiate or cancel deletion
// ═══════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  const adminCheck = requireAdminRole(session!);
  if (adminCheck) return adminCheck;

  const { searchParams } = new URL(request.url);

  // ── Cancel action: ?action=cancel ───────────────────────────────
  if (searchParams.get('action') === 'cancel') {
    try {
      const rawBody = await request.json();
      const parsed = validateBody(accountDataDeletionCancelSchema, rawBody);
      if (parsed instanceof Response) return parsed;
      const { id: requestId, reason } = parsed;

      const existing = await db.dataDeletionRequest.findUnique({
        where: { id: requestId },
      });

      if (!existing) {
        return NextResponse.json(
          { success: false, error: 'Deletion request not found' },
          { status: 404 },
        );
      }

      if (existing.status === 'completed') {
        return NextResponse.json(
          { success: false, error: 'Cannot cancel a completed deletion request' },
          { status: 400 },
        );
      }

      // Check if grace period has expired
      if (new Date() > existing.gracePeriodEndsAt) {
        return NextResponse.json(
          { success: false, error: 'Grace period has expired — deletion cannot be cancelled' },
          { status: 400 },
        );
      }

      const updated = await db.dataDeletionRequest.update({
        where: { id: requestId },
        data: {
          status: 'cancelled',
          cancellationReason: reason || 'Cancelled by admin',
        },
      });

      // Log via access-audit
      await logDataAccess({
        userId: session!.id,
        action: 'admin_access',
        entityType: 'DataDeletionRequest',
        entityId: requestId,
        metadata: {
          action: 'cancel',
          previousStatus: existing.status,
          reason: reason || 'Cancelled by admin',
        },
        request,
      });

      return NextResponse.json({
        success: true,
        data: {
          id: updated.id,
          status: updated.status,
          message: 'Deletion request cancelled successfully.',
        },
      });
    } catch (err) {
      logger.error('[API:account/data-deletion] Cancel failed', { error: err });
      return NextResponse.json(
        { success: false, error: 'Failed to cancel deletion request' },
        { status: 500 },
      );
    }
  }

  // ── Default: Initiate new deletion request ──────────────────────
  try {
    const rawBody = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = validateBody(accountDataDeletionInitiateSchema, rawBody);
    if (parsed instanceof Response) return parsed;
    const { reason, scope } = parsed;

    const gracePeriodEndsAt = new Date(
      Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
    );

    // Create the deletion request
    const deletionRequest = await db.dataDeletionRequest.create({
      data: {
        requesterId: session!.id,
        requesterEmail: session!.email || 'admin',
        reason: reason || null,
        status: 'pending',
        scope: scope || { entityTypes: ['all'] },
        gracePeriodEndsAt,
      },
    });

    // Fire-and-forget Phase 1: Export data before deletion
    phase1ExportData(deletionRequest.id).catch((err) => {
      logger.error('[DataDeletion] Unhandled error in Phase 1', {
        error: err instanceof Error ? err.message : String(err),
        deletionRequestId: deletionRequest.id,
      });
    });

    // Fire-and-forget Phase 2: Disable access (runs after export, but we kick it off immediately
    // with a short delay — in production this would be a queue-based workflow)
    setTimeout(() => {
      phase2DisableAccess(deletionRequest.id).catch((err) => {
        logger.error('[DataDeletion] Unhandled error in Phase 2', {
          error: err instanceof Error ? err.message : String(err),
          deletionRequestId: deletionRequest.id,
        });
      });
    }, 5000); // 5s delay to allow Phase 1 to progress first

    // Log via access-audit
    await logDataAccess({
      userId: session!.id,
      action: 'delete',
      entityType: 'DataDeletionRequest',
      entityId: deletionRequest.id,
      metadata: {
        reason: reason || null,
        scope: scope || 'all',
        gracePeriodDays: GRACE_PERIOD_DAYS,
        gracePeriodEndsAt: gracePeriodEndsAt.toISOString(),
      },
      request,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: deletionRequest.id,
        status: deletionRequest.status,
        gracePeriodEndsAt: deletionRequest.gracePeriodEndsAt.toISOString(),
        gracePeriodDays: GRACE_PERIOD_DAYS,
        message:
          'Deletion request created. Data export and access disabling will proceed automatically. ' +
          `Permanent deletion is scheduled for ${deletionRequest.gracePeriodEndsAt.toISOString()}. ` +
          'You may cancel before the grace period ends.',
      },
    });
  } catch (err) {
    logger.error('[API:account/data-deletion] POST failed', { error: err });
    return NextResponse.json(
      { success: false, error: 'Failed to create deletion request' },
      { status: 500 },
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// GET /api/account/data-deletion — List deletion requests
// ═══════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  const adminCheck = requireAdminRole(session!);
  if (adminCheck) return adminCheck;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
        },
        { status: 400 },
      );
    }

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [requests, total] = await Promise.all([
      db.dataDeletionRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      db.dataDeletionRequest.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: requests.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        requesterId: r.requesterId as string,
        requesterEmail: r.requesterEmail as string,
        reason: r.reason as string | null,
        status: r.status as string,
        exportDataExportId: r.exportDataExportId as string | null,
        scope: r.scope as Record<string, unknown> | null,
        gracePeriodEndsAt: (r.gracePeriodEndsAt as Date).toISOString(),
        completedAt: r.completedAt ? (r.completedAt as Date).toISOString() : null,
        cancellationReason: r.cancellationReason as string | null,
        createdAt: (r.createdAt as Date).toISOString(),
        updatedAt: (r.updatedAt as Date).toISOString(),
      })),
      pagination: { total, limit, offset },
    });
  } catch (err) {
    logger.error('[API:account/data-deletion] GET failed', { error: err });
    return NextResponse.json(
      { success: false, error: 'Failed to list deletion requests' },
      { status: 500 },
    );
  }
}
