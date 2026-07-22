import { NextRequest, NextResponse } from 'next/server';
import { apiRateLimit } from '@/lib/rate-limit';
import { validateCsrf } from '@/lib/csrf';
import { apiError } from '@/lib/apiHelpers';
import { getCorrelationId } from '@/lib/correlation-id';
import { withIntelligenceGuard } from '@/lib/intelligence-api-guard';

// Sub-module handlers
import * as mod_connectors from './connectors___id.ts';
import * as mod_upload from './upload.ts';
import * as mod_resolve_company from './resolve-company.ts';
import * as mod_resolve_company_confirm from './resolve-company___confirm.ts';
import * as mod_runs from './runs.ts';
import * as mod_acquire from './acquire.ts';
import * as mod_knowledge from './knowledge.ts';

// Route registry — ordered from most specific to least specific
const ROUTES = [
  // Connector single-resource
  { key: 'connectors/[id]/run', handler: mod_connectors },
  { key: 'connectors/[id]', handler: mod_connectors },
  // Connector collection (must come after single-resource to avoid shadowing)
  { key: 'connectors', handler: mod_connectors },
  // Upload
  { key: 'upload', handler: mod_upload },
  // Company resolution
  { key: 'resolve-company/confirm', handler: mod_resolve_company_confirm },
  { key: 'resolve-company', handler: mod_resolve_company },
  // Runs
  { key: 'runs/[id]', handler: mod_runs },
  { key: 'runs', handler: mod_runs },
  // Acquire
  { key: 'acquire', handler: mod_acquire },
  // Knowledge
  { key: 'knowledge/search', handler: mod_knowledge },
  { key: 'knowledge', handler: mod_knowledge },
];

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

function keyToRegex(key: string): { regex: RegExp; paramNames: string[] } {
  const parts = key.split('/');
  const regexParts: string[] = [];
  const paramNames: string[] = [];
  for (const part of parts) {
    if (part.startsWith('[') && part.endsWith(']')) {
      const inner = part.slice(1, -1);
      paramNames.push(inner);
      regexParts.push('([^/]+)');
    } else {
      regexParts.push(part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    }
  }
  return { regex: new RegExp('^' + regexParts.join('/') + '$'), paramNames };
}

function matchRoute(slug: string[]): { handler: Record<string, Function>; params: Record<string, string> } | null {
  const path = slug.join('/');
  for (const route of ROUTES) {
    const { regex, paramNames } = keyToRegex(route.key);
    const match = path.match(regex);
    if (match) {
      const params: Record<string, string> = {};
      paramNames.forEach((name, i) => { params[name] = match[i + 1] || ''; });
      return { handler: route.handler, params };
    }
  }
  return null;
}

async function handle(method: HttpMethod, req: NextRequest, slug: string[]): Promise<Response> {
  const matched = matchRoute(slug);
  if (!matched) return NextResponse.json({ error: 'Not found', path: slug.join('/') }, { status: 404 });
  const fn = matched.handler[method];
  if (typeof fn !== 'function') return NextResponse.json({ error: `${method} not allowed` }, { status: 405 });

  // Rate limiting
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
  const rl = apiRateLimit(ip, slug.join('/'));
  if (!rl.success) {
    return apiError('Too many requests. Please try again later.', 429);
  }

  // CSRF protection for mutating methods
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    if (!validateCsrf(req)) {
      return apiError('CSRF validation failed', 403);
    }
  }

  const correlationId = getCorrelationId(req);
  try {
    const res = await fn(req, { params: Promise.resolve(matched.params) });
    // Append rate limit headers
    const newRes = new Response(res.body, res);
    newRes.headers.set('X-RateLimit-Remaining', String(rl.remaining));
    newRes.headers.set('X-RateLimit-Reset', String(rl.resetAt));
    newRes.headers.set('X-Correlation-Id', correlationId);
    return newRes;
  }
  catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[router:g-intel-acquisition] ${method} /${slug.join('/')}:`, message);
    return NextResponse.json({ error: 'Internal error', detail: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return handle('GET', req, slug);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const guard = await withIntelligenceGuard(req);
  if (!guard.allowed) return guard.response!;

  const safeReq = guard.request || req;
  if (!validateCsrf(safeReq)) return apiError('CSRF validation failed', 403);

  const { slug } = await params;
  return handle('POST', safeReq as NextRequest, slug);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const guard = await withIntelligenceGuard(req);
  if (!guard.allowed) return guard.response!;

  const safeReq = guard.request || req;
  if (!validateCsrf(safeReq)) return apiError('CSRF validation failed', 403);

  const { slug } = await params;
  return handle('PUT', safeReq as NextRequest, slug);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const guard = await withIntelligenceGuard(req);
  if (!guard.allowed) return guard.response!;

  const safeReq = guard.request || req;
  if (!validateCsrf(safeReq)) return apiError('CSRF validation failed', 403);

  const { slug } = await params;
  return handle('DELETE', safeReq as NextRequest, slug);
}