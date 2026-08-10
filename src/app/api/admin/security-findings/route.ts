/**
 * Phase 9.4 — Security Findings API
 *
 * GET  /api/admin/security-findings  — List security findings (filtered)
 * POST /api/admin/security-findings  — Create a new security finding
 *
 * Auth: Admin only
 */

import { NextResponse } from 'next/server';
import { checkApiAuth, requireAdminRole } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const VALID_SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];
const VALID_STATUSES = ['open', 'in_progress', 'remediated', 'accepted_risk', 'false_positive'];

// ═══════════════════════════════════════════════════════════════
// GET /api/admin/security-findings — List security findings
// Query params: severity, status, category, limit, offset
// ═══════════════════════════════════════════════════════════════
export async function GET(request: Request) {
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;
  const adminCheck = requireAdminRole(session!);
  if (adminCheck) return adminCheck;

  try {
    const { searchParams } = new URL(request.url);
    const severity = searchParams.get('severity');
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 200);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

    const where: Record<string, unknown> = {};
    if (severity && VALID_SEVERITIES.includes(severity)) {
      where.severity = severity;
    }
    if (status && VALID_STATUSES.includes(status)) {
      where.status = status;
    }
    if (category) {
      where.category = category;
    }

    const [findings, total] = await Promise.all([
      db.securityFinding.findMany({
        where,
        orderBy: { discoveredAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.securityFinding.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: findings,
      meta: { total, limit, offset },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[api/admin/security-findings] GET error:', { error: err });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch security findings', timestamp: new Date().toISOString() },
      { status: 500 },
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// POST /api/admin/security-findings — Create a security finding
// Body: { title, description, severity, category, remediation, ... }
// ═══════════════════════════════════════════════════════════════
export async function POST(request: Request) {
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;
  const adminCheck = requireAdminRole(session!);
  if (adminCheck) return adminCheck;

  try {
    const body = await request.json();
    const {
      title,
      description,
      severity,
      category,
      remediation,
      owaspCategory,
      cvssScore,
      affectedEndpoints,
      remediationDeadline,
      assignedTo,
      evidence,
      externalTestRef,
    } = body;

    // Validation
    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid "title" field', timestamp: new Date().toISOString() },
        { status: 400 },
      );
    }
    if (!description || typeof description !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid "description" field', timestamp: new Date().toISOString() },
        { status: 400 },
      );
    }
    if (!severity || !VALID_SEVERITIES.includes(severity)) {
      return NextResponse.json(
        { success: false, error: `Invalid "severity". Must be one of: ${VALID_SEVERITIES.join(', ')}`, timestamp: new Date().toISOString() },
        { status: 400 },
      );
    }
    if (!category || typeof category !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid "category" field', timestamp: new Date().toISOString() },
        { status: 400 },
      );
    }
    if (!remediation || typeof remediation !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid "remediation" field', timestamp: new Date().toISOString() },
        { status: 400 },
      );
    }

    const finding = await db.securityFinding.create({
      data: {
        title,
        description,
        severity,
        category,
        remediation,
        owaspCategory: owaspCategory || null,
        cvssScore: typeof cvssScore === 'number' ? Math.min(Math.max(cvssScore, 0), 10) : 0,
        affectedEndpoints: typeof affectedEndpoints === 'string' ? affectedEndpoints : JSON.stringify(affectedEndpoints || []),
        remediationDeadline: remediationDeadline ? new Date(remediationDeadline) : null,
        assignedTo: assignedTo || null,
        evidence: evidence || null,
        externalTestRef: externalTestRef || null,
      },
    });

    logger.info('[api/admin/security-findings] Finding created', {
      id: finding.id,
      severity,
      category,
      actor: session!.email,
    });

    return NextResponse.json({
      success: true,
      data: finding,
      timestamp: new Date().toISOString(),
    }, { status: 201 });
  } catch (err) {
    logger.error('[api/admin/security-findings] POST error:', { error: err });
    return NextResponse.json(
      { success: false, error: 'Failed to create security finding', timestamp: new Date().toISOString() },
      { status: 500 },
    );
  }
}
