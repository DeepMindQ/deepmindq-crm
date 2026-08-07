/**
 * API: /api/security/sso — SSO Configuration Management
 *
 * GET  — List SSO configs, get status
 * POST — Create/update SSO config, initiate login
 * DELETE — Remove SSO config
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth, requireAdminRole } from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import {
  listSSOConfigs,
  getSSOConfig,
  getDefaultSSOConfig,
  saveSSOConfig,
  deleteSSOConfig,
  initiateSSOLogin,
  processSSOCallback,
  getSSOStatus,
} from '@/lib/sso-integration';

export async function GET(request: NextRequest) {
  const { session, errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;
  const adminCheck = requireAdminRole(session!);
  if (adminCheck) return adminCheck;

  try {
    const { searchParams } = request.nextUrl;
    const mode = searchParams.get('mode');

    if (mode === 'status') {
      const status = await getSSOStatus();
      return NextResponse.json({ success: true, data: status });
    }

    if (mode === 'default') {
      const config = await getDefaultSSOConfig();
      return NextResponse.json({
        success: true,
        data: config ? { ...config, oidc: config.oidc ? { ...config.oidc, clientSecret: '[REDACTED]' } : undefined } : null,
      });
    }

    if (searchParams.get('id')) {
      const config = await getSSOConfig(searchParams.get('id')!);
      return NextResponse.json({
        success: true,
        data: config ? { ...config, oidc: config.oidc ? { ...config.oidc, clientSecret: '[REDACTED]' } : undefined } : null,
      });
    }

    // List all configs
    const configs = await listSSOConfigs();
    const redacted = configs.map((c) => ({
      ...c,
      oidc: c.oidc ? { ...c.oidc, clientSecret: '[REDACTED]' } : undefined,
    }));

    return NextResponse.json({ success: true, data: redacted });
  } catch (error) {
    logger.error('[API:sso] GET failed', { error });
    return NextResponse.json(
      { success: false, error: 'Failed to load SSO configs' },
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
      case 'save': {
        const result = await saveSSOConfig(body.config, session!.id);
        if (!result) {
          return NextResponse.json(
            { success: false, error: 'Failed to save SSO config' },
            { status: 500 },
          );
        }
        return NextResponse.json({ success: true, data: { id: result.id } });
      }

      case 'delete': {
        if (!body.id) {
          return NextResponse.json(
            { success: false, error: 'Missing id' },
            { status: 400 },
          );
        }
        const deleted = await deleteSSOConfig(body.id, session!.id);
        return NextResponse.json({ success: true, data: { deleted } });
      }

      case 'login_url': {
        const config = await getDefaultSSOConfig();
        if (!config) {
          return NextResponse.json(
            { success: false, error: 'No active SSO configuration' },
            { status: 404 },
          );
        }
        const urls = initiateSSOLogin(config);
        return NextResponse.json({ success: true, data: urls });
      }

      case 'callback': {
        const result = await processSSOCallback(
          body.ssoConfigId,
          body.externalId,
          body.email,
          body.name,
          body.attributes,
        );
        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 401 },
          );
        }
        return NextResponse.json({ success: true, data: { userId: result.userId } });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (error) {
    logger.error('[API:sso] POST failed', { error });
    return NextResponse.json(
      { success: false, error: 'Failed to process SSO request' },
      { status: 500 },
    );
  }
}
