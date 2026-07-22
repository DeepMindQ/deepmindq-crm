import { NextResponse } from 'next/server';

const MAX_BODY_SIZE_BYTES = 1_048_576; // 1 MB

/**
 * Generates a short unique request ID for tracing.
 */
function generateRequestId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `req_${ts}_${rand}`;
}

export interface IntelligenceGuardResult {
  allowed: boolean;
  reason?: string;
  response?: Response;
  request?: Request;
}

/**
 * Intelligence API guard (S10b).
 *
 * Validates:
 *  1. Content-Type for POST / PUT / PATCH must be application/json.
 *  2. Request body size must not exceed 1 MB.
 *  3. Attaches an X-Request-Id header for tracing.
 *
 * Returns { allowed, reason?, response? } — if `allowed` is false the caller
 * should return `response` immediately.
 */
export async function withIntelligenceGuard(
  request: Request,
): Promise<IntelligenceGuardResult> {
  const method = request.method.toUpperCase();
  const needsBodyCheck = ['POST', 'PUT', 'PATCH'].includes(method);

  // --- Content-Type validation for body-bearing methods ---
  if (needsBodyCheck) {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {
        allowed: false,
        reason: 'Content-Type must be application/json',
        response: NextResponse.json(
          {
            error: 'Unsupported Media Type',
            detail: 'Content-Type must be application/json',
          },
          { status: 415 },
        ),
      };
    }
  }

  // --- Body size validation ---
  if (needsBodyCheck) {
    const contentLength = request.headers.get('content-length');
    if (contentLength) {
      const bytes = parseInt(contentLength, 10);
      if (!isNaN(bytes) && bytes > MAX_BODY_SIZE_BYTES) {
        return {
          allowed: false,
          reason: `Request body exceeds ${MAX_BODY_SIZE_BYTES} byte limit`,
          response: NextResponse.json(
            {
              error: 'Payload Too Large',
              detail: `Request body must not exceed ${MAX_BODY_SIZE_BYTES} bytes`,
            },
            { status: 413 },
          ),
        };
      }
    }
  }

  // --- Request ID tracking ---
  const requestId = generateRequestId();
  const headers = new Headers(request.headers);
  headers.set('X-Request-Id', requestId);

  // Return the result with a cloned request that carries the new header.
  // The caller should use `result.request` if they need the augmented request.
  return {
    allowed: true,
    request: new Request(request, { headers }),
  };
}