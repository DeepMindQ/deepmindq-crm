/**
 * API: /api/security/encryption — Encryption Health & Config
 *
 * GET — Encryption health status, TLS validation
 */

import { NextResponse } from 'next/server';
import { checkApiAuth, requireAdminRole } from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import {
  getEncryptionHealth,
  validateTlsConfig,
  ENCRYPTED_FIELDS,
} from '@/lib/encryption';

export async function GET() {
  const { session, errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;
  const adminCheck = requireAdminRole(session!);
  if (adminCheck) return adminCheck;

  try {
    const health = getEncryptionHealth();
    const tls = validateTlsConfig();

    return NextResponse.json({
      success: true,
      data: {
        health,
        tls,
        encryptedFields: ENCRYPTED_FIELDS,
      },
    });
  } catch (error) {
    logger.error('[API:encryption] GET failed', { error });
    return NextResponse.json(
      { success: false, error: 'Failed to load encryption status' },
      { status: 500 },
    );
  }
}
