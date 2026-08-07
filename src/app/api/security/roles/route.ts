/**
 * API: /api/security/roles — Role Management
 *
 * GET  — List all roles with their permissions
 * POST — Assign a role to a user (admin only)
 * PUT  — Bulk assign roles (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth, requireAdminRole } from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import {
  getUserPermissionSummary,
  assignUserRole,
  bulkAssignRoles,
  generateRoleComplianceMatrix,
} from '@/lib/rbac-enforcement';
import { getAllRoles, type UserRole } from '@/lib/rbac';

export async function GET() {
  const { session, errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

  try {
    // Return role overview
    const roles = getAllRoles();
    const complianceMatrix = generateRoleComplianceMatrix();
    const userPermissions = session
      ? getUserPermissionSummary(session.role)
      : null;

    return NextResponse.json({
      success: true,
      data: {
        roles,
        complianceMatrix,
        currentUserPermissions: userPermissions,
      },
    });
  } catch (error) {
    logger.error('[API:roles] GET failed', { error });
    return NextResponse.json(
      { success: false, error: 'Failed to load roles' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const { session, errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;
  const adminCheck = requireAdminRole(session!);
  if (adminCheck) return adminCheck;

  try {
    const body = await request.json();
    const { userId, role } = body;

    if (!userId || !role) {
      return NextResponse.json(
        { success: false, error: 'Missing userId or role' },
        { status: 400 },
      );
    }

    const validRoles: string[] = ['admin', 'operator', 'user', 'viewer'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 },
      );
    }

    const result = await assignUserRole(userId, role as UserRole, session!.id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      data: { userId, role },
    });
  } catch (error) {
    logger.error('[API:roles] POST failed', { error });
    return NextResponse.json(
      { success: false, error: 'Failed to assign role' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const { session, errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;
  const adminCheck = requireAdminRole(session!);
  if (adminCheck) return adminCheck;

  try {
    const body = await request.json();
    const { assignments } = body as {
      assignments: Array<{ userId: string; role: UserRole }>;
    };

    if (!assignments || !Array.isArray(assignments)) {
      return NextResponse.json(
        { success: false, error: 'Missing assignments array' },
        { status: 400 },
      );
    }

    const result = await bulkAssignRoles(assignments, session!.id);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('[API:roles] PUT failed', { error });
    return NextResponse.json(
      { success: false, error: 'Failed to bulk assign roles' },
      { status: 500 },
    );
  }
}
