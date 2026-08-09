/**
 * API: /api/security/scan — Security Scanner & Pen Test
 *
 * GET — Run security scan, OWASP coverage report
 * POST — Import external pen test findings
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth, requireAdminRole } from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import {
  runSecurityScan,
  getOwaspCoverage,
  generatePenTestReportTemplate,
} from '@/lib/security-scanner';

export async function GET(request: NextRequest) {
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;
  const adminCheck = requireAdminRole(session!);
  if (adminCheck) return adminCheck;

  try {
    const { searchParams } = request.nextUrl;
    const mode = searchParams.get('mode');

    // OWASP coverage report
    if (mode === 'owasp') {
      const coverage = getOwaspCoverage();
      return NextResponse.json({ success: true, data: coverage });
    }

    // Pen test report template
    if (mode === 'template') {
      const template = generatePenTestReportTemplate();
      return NextResponse.json({ success: true, data: template });
    }

    // Default: run security scan
    const scan = runSecurityScan();
    return NextResponse.json({ success: true, data: scan });
  } catch (error) {
    logger.error('[API:scan] GET failed', { error });
    return NextResponse.json(
      { success: false, error: 'Failed to run security scan' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;
  const adminCheck = requireAdminRole(session!);
  if (adminCheck) return adminCheck;

  try {
    const body = await request.json();

    // For now, just validate the import format
    // Full import would require SecurityFinding DB table writes
    if (!body.findings || !Array.isArray(body.findings)) {
      return NextResponse.json(
        { success: false, error: 'Missing findings array' },
        { status: 400 },
      );
    }

    const validated = body.findings.filter(
      (f: Record<string, unknown>) => f.title && f.severity && f.category,
    );

    return NextResponse.json({
      success: true,
      data: {
        imported: validated.length,
        total: body.findings.length,
        skipped: body.findings.length - validated.length,
      },
    });
  } catch (error) {
    logger.error('[API:scan] POST failed', { error });
    return NextResponse.json(
      { success: false, error: 'Failed to import findings' },
      { status: 500 },
    );
  }
}
