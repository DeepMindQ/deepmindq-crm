import { NextRequest, NextResponse } from 'next/server';
import { csrfMiddleware } from '@/lib/csrf';

// Route handlers
import * as mod_accounts_brief_get from './accounts___id__brief.ts';
import * as mod_accounts_brief_post from './accounts___id__generate-brief.ts';
import * as mod_accounts_signals from './accounts___id__signals.ts';
import * as mod_accounts_recs from './accounts___id__recommendations.ts';
import * as mod_accounts_score_post from './accounts___id__recalculate-score.ts';
import * as mod_opportunities from './opportunities.ts';
import * as mod_dashboard from './dashboard.ts';

// Route registry
const ROUTES = [
  { key: 'accounts/[id]/brief', handler: mod_accounts_brief_get },
  { key: 'accounts/[id]/generate-brief', handler: mod_accounts_brief_post },
  { key: 'accounts/[id]/signals', handler: mod_accounts_signals },
  { key: 'accounts/[id]/recommendations', handler: mod_accounts_recs },
  { key: 'accounts/[id]/recalculate-score', handler: mod_accounts_score_post },
  { key: 'opportunities', handler: mod_opportunities },
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
  try { return await fn(req, { params: Promise.resolve(matched.params) }); }
  catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[router:g-revenue-intelligence] ${method} /${slug.join('/')}:`, message);
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
