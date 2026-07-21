import { NextRequest, NextResponse } from 'next/server';
import { apiRateLimit } from '@/lib/rate-limit';
import { validateCsrf } from '@/lib/csrf';
import { apiError } from '@/lib/apiHelpers';

// Phase 6 intelligence validation API handlers
import * as mod_health from './health.ts';
import * as mod_evidence_quality from './evidence-quality.ts';
import * as mod_validation_report from './validation-report.ts';
import * as mod_validate from './validate.ts';
import * as mod_confidence from './confidence.ts';
import * as mod_conflicts from './conflicts.ts';
import * as mod_dashboard from './dashboard.ts';

// Route registry
const ROUTES = [
  { key: 'companies/[id]/health', handler: mod_health },
  { key: 'companies/[id]/evidence-quality', handler: mod_evidence_quality },
  { key: 'companies/[id]/validation-report', handler: mod_validation_report },
  { key: 'companies/[id]/validate', handler: mod_validate },
  { key: 'companies/[id]/confidence', handler: mod_confidence },
  { key: 'conflicts', handler: mod_conflicts },
  { key: 'dashboard', handler: mod_dashboard },
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
  try {
    const res = await fn(req, { params: Promise.resolve(matched.params) });
    // Append rate limit headers
    const newRes = new Response(res.body, res);
    newRes.headers.set('X-RateLimit-Remaining', String(rl.remaining));
    newRes.headers.set('X-RateLimit-Reset', String(rl.resetAt));
    return newRes;
  }
  catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[router:g-intelligence] ${method} /${slug.join('/')}:`, message);
    return NextResponse.json({ error: 'Internal error', detail: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return handle('GET', req, slug);
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return handle('POST', req, slug);
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return handle('PATCH', req, slug);
}