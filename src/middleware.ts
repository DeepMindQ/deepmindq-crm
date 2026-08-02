import { NextRequest, NextResponse } from 'next/server';
import { getSecurityHeaders, isPublicPath, isApiRoute, validateCsrf } from '@/lib/auth-helpers';
import { generateCsrfToken, CSRF_COOKIE_NAME, CSRF_TOKEN_HEADER } from '@/lib/csrf';

// ── Allowed domains for redirect targets ──
const ALLOWED_REDIRECT_DOMAINS = [
  'localhost',
  '127.0.0.1',
  // Add production domain(s) here when deploying
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // 1. Apply security headers to all responses
  const headers = getSecurityHeaders();
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }

  // 2. Block obvious malicious paths
  if (pathname.match(/\.(env|git|svn|htaccess|htpasswd)/i) ||
      pathname.includes('..') ||
      pathname.includes('\x00')) {
    return new NextResponse(null, { status: 400 });
  }

  // 3. Add request correlation ID
  const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();
  response.headers.set('x-correlation-id', correlationId);

  // 4. CSRF token refresh for page requests (non-API)
  if (!isApiRoute(pathname) && pathname !== '/api/health' && pathname !== '/api/ping') {
    const existingCsrf = request.cookies.get(CSRF_COOKIE_NAME)?.value;
    if (!existingCsrf) {
      const token = generateCsrfToken();
      response.cookies.set(CSRF_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 86400, // 24 hours
      });
      response.headers.set(CSRF_TOKEN_HEADER, token);
    }
  }

  // 5. CSRF validation on mutating API requests (defense-in-depth)
  // NOTE: This does NOT replace per-route auth. It adds an extra layer.
  // Only enforce on authenticated (non-public) mutating routes.
  const method = request.method.toUpperCase();
  if (isApiRoute(pathname) && !isPublicPath(pathname) && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfValid = validateCsrf(request);
    if (!csrfValid) {
      // Log but don't block yet — this is the activation phase.
      // Routes will be migrated to enforce CSRF in a future WI.
      // For now, the middleware sets a header so routes can check it.
      response.headers.set('x-csrf-status', 'missing');
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon\.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
