/**
 * SH8 — User Management API
 *
 * GET  /api/users          → List all users (admin-only)
 * PATCH /api/users         → Update role/status (admin-only)
 *
 * Scope: List, role assignment, activate/deactivate only.
 * NO invite flow. NO email. NO OTP.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkApiAuth, requireAdminRole, filterResponseArrayByRole } from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// Phase 0 RBAC: admin (full access) and user (standard access) only.
// operator/viewer are documented for Phase 2 RBAC expansion (see rbac.ts).
const VALID_ROLES = ['admin', 'user'] as const;

const patchUserSchema = z.object({
  id: z.string().min(1),
  role: z.enum(VALID_ROLES).optional(),
  isActive: z.boolean().optional(),
});

// ── GET: List all users ──────────────────────────────────────────

export async function GET(request: Request) {
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;
  const adminCheck = requireAdminRole(session!);
  if (adminCheck) return adminCheck;

  try {
    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        company: true,
        designation: true,
        role: true,
        isActive: true,
        hasPassword: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // ── Field-Level Permission Filtering (5.3) ──
    const filteredUsers = session
      ? filterResponseArrayByRole(users, session, 'User')
      : users;

    return NextResponse.json({ success: true, users: filteredUsers });
  } catch (error) {
    logger.error('[users:list] Error:', { error });
    return NextResponse.json(
      { success: false, error: 'Failed to list users' },
      { status: 500 }
    );
  }
}

// ── PATCH: Update user role/status ───────────────────────────────

export async function PATCH(request: NextRequest) {
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;
  const adminCheck = requireAdminRole(session!);
  if (adminCheck) return adminCheck;

  try {
    const body = await request.json();
    const parsed = patchUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { id, role, isActive } = parsed.data;

    // Prevent self-demotion
    if (id === session!.id && role && role !== session!.role) {
      return NextResponse.json(
        { success: false, error: 'Cannot change your own role' },
        { status: 403 }
      );
    }

    // Prevent self-deactivation
    if (id === session!.id && isActive === false) {
      return NextResponse.json(
        { success: false, error: 'Cannot deactivate yourself' },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Snapshot current user for audit trail before mutation
    const targetUser = await db.user.findUnique({
      where: { id },
      select: { role: true, isActive: true },
    });
    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const updatedUser = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    logger.info('[users:update] User updated', {
      targetId: id,
      updatedBy: session!.id,
      changes: updateData,
    });

    // ── Audit trail: record every admin user-management action ──
    try {
      const auditActions: string[] = [];
      const auditMetadata: Record<string, unknown> = { targetEmail: updatedUser.email };

      if (role !== undefined && role !== targetUser.role) {
        auditActions.push('ROLE_CHANGED');
        auditMetadata.previousRole = targetUser.role;
        auditMetadata.newRole = role;
      }
      if (isActive !== undefined && isActive !== targetUser.isActive) {
        auditActions.push(isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED');
        auditMetadata.previousStatus = targetUser.isActive ? 'active' : 'inactive';
        auditMetadata.newStatus = isActive ? 'active' : 'inactive';
      }
      if (auditActions.length === 0) {
        auditActions.push('USER_STATUS_CHANGED');
      }

      for (const action of auditActions) {
        await db.auditLog.create({
          data: {
            action,
            entity: 'User',
            userId: session!.id,
            details: JSON.stringify({
              targetUserId: id,
              ...auditMetadata,
            }),
          },
        });
      }
    } catch (auditErr) {
      logger.warn('[users:update] Audit logging failed (non-blocking)', { error: String(auditErr) });
    }

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    logger.error('[users:update] Error:', { error });
    return NextResponse.json(
      { success: false, error: 'Failed to update user' },
      { status: 500 }
    );
  }
}
