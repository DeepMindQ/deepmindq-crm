/**
 * GET /api/intelligence/security-audit
 *
 * M5 Phase 6 — Security Audit Endpoint
 *
 * Returns a comprehensive read-only security assessment
 * of the M5 intelligence layer (10 checks).
 *
 * Non-throwing: standardized error responses.
 */

import { NextRequest } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { requireAdminRole } from '@/lib/api-auth';
import { runSecurityAudit } from '@/lib/security-validation';
import { utilityGuard, RateLimitedError, utilityCatchError, utilitySuccess } from '@/lib/intelligence-api/guard';

export async function GET(request: NextRequest) {
  // ── Authentication Guard ──
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  // ── Admin-only: security audit requires admin role ──
  const adminError = requireAdminRole(session!);
  if (adminError) return adminError;

  let ctx: { correlationId: string; responseHeaders: Record<string, string> };
  try {
    ctx = utilityGuard(request, 'security-audit');
  } catch (rlErr) {
    if (rlErr instanceof RateLimitedError) {
      return new Response(JSON.stringify(rlErr.errorBody), { status: 429, headers: rlErr.headers });
    }
    throw rlErr;
  }
  const startedAt = Date.now();

  try {
    const auditResult = runSecurityAudit();
    return utilitySuccess(ctx, auditResult, 'security-audit', Date.now() - startedAt);
  } catch (err) {
    return utilityCatchError(ctx, err, 500, 'ENGINE_ERROR', 'Security audit failed', Date.now() - startedAt);
  }
}
