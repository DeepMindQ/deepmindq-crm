/**
 * API: /api/security/privacy — GDPR/CCPA Compliance
 *
 * GET  — List privacy requests, compliance summary, consent stats
 * POST — Create privacy request, process erasure, update consent
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth, requireAdminRole } from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import {
  getPrivacyRequests,
  createPrivacyRequest,
  updatePrivacyRequest,
  processDataErasure,
  exportDataSubject,
  updateConsent,
  getComplianceSummary,
  getConsentStats,
} from '@/lib/privacy-compliance';

export async function GET(request: NextRequest) {
  const { session, errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;
  const adminCheck = requireAdminRole(session!);
  if (adminCheck) return adminCheck;

  try {
    const { searchParams } = request.nextUrl;
    const mode = searchParams.get('mode');

    // Compliance summary
    if (mode === 'summary') {
      const summary = await getComplianceSummary();
      return NextResponse.json({ success: true, data: summary });
    }

    // Consent statistics
    if (mode === 'consent') {
      const stats = await getConsentStats();
      return NextResponse.json({ success: true, data: stats });
    }

    // Data subject export
    if (mode === 'export') {
      const contactId = searchParams.get('contactId');
      if (!contactId) {
        return NextResponse.json(
          { success: false, error: 'Missing contactId' },
          { status: 400 },
        );
      }
      const exportData = await exportDataSubject(contactId, session!.id);
      if (!exportData) {
        return NextResponse.json(
          { success: false, error: 'Contact not found' },
          { status: 404 },
        );
      }
      return NextResponse.json({ success: true, data: exportData });
    }

    // Default: list privacy requests
    const result = await getPrivacyRequests({
      status: (searchParams.get('status') as any) || undefined,
      type: (searchParams.get('type') as any) || undefined,
      limit: parseInt(searchParams.get('limit') || '50', 10),
      offset: parseInt(searchParams.get('offset') || '0', 10),
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    logger.error('[API:privacy] GET failed', { error });
    return NextResponse.json(
      { success: false, error: 'Failed to load privacy data' },
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
    const { action } = body;

    switch (action) {
      case 'create_request': {
        const result = await createPrivacyRequest({
          type: body.type,
          requesterEmail: body.requesterEmail,
          requesterName: body.requesterName,
          contactId: body.contactId,
          description: body.description,
        });
        if (!result) {
          return NextResponse.json(
            { success: false, error: 'Failed to create privacy request' },
            { status: 500 },
          );
        }
        return NextResponse.json({ success: true, data: result });
      }

      case 'process_erasure': {
        if (!body.contactId) {
          return NextResponse.json(
            { success: false, error: 'Missing contactId' },
            { status: 400 },
          );
        }
        const result = await processDataErasure(body.contactId, session!.id);
        return NextResponse.json({ success: true, data: result });
      }

      case 'update_consent': {
        if (!body.contactId || !body.status) {
          return NextResponse.json(
            { success: false, error: 'Missing contactId or status' },
            { status: 400 },
          );
        }
        const result = await updateConsent(
          body.contactId,
          body.status,
          body.source || 'admin',
          undefined,
          session!.id,
        );
        return NextResponse.json({ success: true, data: result });
      }

      case 'update_status': {
        if (!body.requestId || !body.status) {
          return NextResponse.json(
            { success: false, error: 'Missing requestId or status' },
            { status: 400 },
          );
        }
        const result = await updatePrivacyRequest(
          body.requestId,
          { status: body.status, responseNotes: body.notes },
          session!.id,
        );
        if (!result) {
          return NextResponse.json(
            { success: false, error: 'Privacy request not found' },
            { status: 404 },
          );
        }
        return NextResponse.json({ success: true, data: result });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (error) {
    logger.error('[API:privacy] POST failed', { error });
    return NextResponse.json(
      { success: false, error: 'Failed to process privacy request' },
      { status: 500 },
    );
  }
}
