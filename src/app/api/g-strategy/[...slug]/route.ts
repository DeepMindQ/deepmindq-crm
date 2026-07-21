import { NextRequest, NextResponse } from 'next/server';
import { apiRateLimit } from '@/lib/rate-limit';
import { validateCsrf } from '@/lib/csrf';
import { apiError } from '@/lib/apiHelpers';
import { getCorrelationId } from '@/lib/correlation-id';

// Inline imports for strategy routes (7 handlers)
import * as mod_playbooks from './playbooks.ts';
import * as mod_playbooks___id from './playbooks___id.ts';
import * as mod_strategy_room from './strategy-room.ts';
import * as mod_strategy_room___id from './strategy-room___id.ts';
import * as mod_account_rankings from './account-rankings.ts';
import * as mod_companies___id__priority from './companies___id__priority.ts';
import * as mod_icp_profile from './icp-profile.ts';
import * as mod_scoring_config from './scoring-config.ts';
import * as mod_priority_weights from './priority-weights.ts';

// Route registry
const ROUTES = [
  { key: 'playbooks', handler: mod_playbooks },
  { key: 'playbooks/[id]', handler: mod_playbooks___id },
  { key: 'strategy-room', handler: mod_strategy_room },
  { key: 'strategy-room/[id]', handler: mod_strategy_room___id },
  { key: 'account-rankings', handler: mod_account_rankings },
  { key: 'companies/[id]/priority', handler: mod_companies___id__priority },
  { key: 'icp-profile', handler: mod_icp_profile },
  { key: 'scoring-config', handler: mod_scoring_config },
  { key: 'priority-weights', handler: mod_priority_weights },
];

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';

function keyToRegex(key: string): { regex: RegExp; paramNames: string[] } {
  const parts = key.split('/');
  const regexParts: string[] = [];
  const paramNames: string[] = [];
  for (const part of parts) {
    if (part.startsWith('[') && part.endsWith(']')) {
      const inner = part.slice(1, -1);
      if (inner.startsWith('...')) {
        paramNames.push(inner.slice(3));
        regexParts.push('(.+)');
      } else {
        paramNames.push(inner);
        regexParts.push('([^/]+)');
      }
    } else {
      regexParts.push(part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    }
  }
  return { regex: new RegExp('^' + regexParts.join('/') + '$'), paramNames };
}

function matchRoute(slug: string[]): { handler: Record<string, (...args: any[]) => any>; params: Record<string, string> } | null {
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
  catch (err: any) { console.error(`[router:strategy] ${method} /${slug.join('/')}:`, err.message); return NextResponse.json({ error: 'Internal error', detail: err.message }, { status: 500 }); }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('GET', req, slug); }
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('POST', req, slug); }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('PUT', req, slug); }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('PATCH', req, slug); }
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('DELETE', req, slug); }
export async function OPTIONS(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('OPTIONS', req, slug); }
