/**
 * Task 4.5 — CRM API: Providers & Connection List
 *
 * GET  /api/crm          — List CRM connections (masked tokens)
 * POST /api/crm          — Create CRM connection
 * GET  /api/crm/providers — List available CRM providers
 */

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { validateBody } from '@/lib/apiHelpers';
import { apiSuccess, apiError, apiNotFound } from '@/lib/apiHelpers';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { getConnectorForProvider, getRegisteredProviders } from '@/lib/crm/crm-connector';

// ─── GET /api/crm — List connections ───────────────────────────────

export async function GET(request: Request) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const connections = await db.cRMConnection.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { syncLogs: true },
        },
      },
    });

    // Mask sensitive tokens
    const masked = connections.map(conn => ({
      id: conn.id,
      provider: conn.provider,
      name: conn.name,
      isActive: conn.isActive,
      lastSyncAt: conn.lastSyncAt,
      syncMode: conn.syncMode,
      syncInterval: conn.syncInterval,
      instanceUrl: conn.instanceUrl,
      hasAccessToken: !!conn.accessToken,
      tokenExpiresAt: conn.tokenExpiresAt,
      totalSyncLogs: conn._count.syncLogs,
      createdAt: conn.createdAt,
      updatedAt: conn.updatedAt,
    }));

    return apiSuccess(masked);
  } catch (err) {
    logger.error('[CRM:API] Failed to list connections', {
      error: err instanceof Error ? err.message : String(err),
    });
    return apiError('Failed to list CRM connections', 500);
  }
}

// ─── POST /api/crm — Create connection ────────────────────────────

const createConnectionSchema = z.object({
  provider: z.enum(['salesforce', 'hubspot']),
  name: z.string().min(1).max(200),
  authCode: z.string().min(1),
  redirectUri: z.string().optional(),
});

export async function POST(request: Request) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const parsed = validateBody(createConnectionSchema, body);
    if (parsed instanceof Response) return parsed;

    const { provider, name, authCode } = parsed;

    // Resolve connector
    const connector = getConnectorForProvider(provider);
    if (!connector) {
      return apiError(`No connector available for provider: ${provider}`, 400);
    }

    // Set redirect URI env for OAuth
    if (parsed.redirectUri) {
      if (provider === 'salesforce') {
        process.env.SALESFORCE_REDIRECT_URI = parsed.redirectUri;
      } else if (provider === 'hubspot') {
        process.env.HUBSPOT_REDIRECT_URI = parsed.redirectUri;
      }
    }

    // Authenticate with the CRM provider
    let token;
    try {
      token = await connector.authenticate(authCode);
    } catch (err) {
      logger.error('[CRM:API] Authentication failed', {
        provider,
        error: err instanceof Error ? err.message : String(err),
      });
      return apiError(
        `Authentication with ${provider} failed: ${err instanceof Error ? err.message : String(err)}`,
        401,
      );
    }

    // Test the connection
    let connectionOk = false;
    try {
      connectionOk = await connector.testConnection(token);
    } catch {
      connectionOk = false;
    }

    if (!connectionOk) {
      logger.warn('[CRM:API] Connection test failed after auth', { provider });
      return apiError(
        `Connected to ${provider} but connection test failed. Token may be invalid.`,
        400,
      );
    }

    // Create the connection record
    const connection = await db.cRMConnection.create({
      data: {
        provider,
        name,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken || null,
        tokenExpiresAt: token.expiresAt || null,
        instanceUrl: token.instanceUrl || null,
        scopes: token.scopes ? JSON.stringify(token.scopes) : null,
        isActive: true,
        syncMode: 'manual',
        syncInterval: 3600,
      },
    });

    logger.info('[CRM:API] Connection created', {
      connectionId: connection.id,
      provider,
      name,
    });

    return apiSuccess({
      id: connection.id,
      provider: connection.provider,
      name: connection.name,
      isActive: connection.isActive,
      instanceUrl: connection.instanceUrl,
    }, 201);
  } catch (err) {
    logger.error('[CRM:API] Failed to create connection', {
      error: err instanceof Error ? err.message : String(err),
    });
    return apiError('Failed to create CRM connection', 500);
  }
}
