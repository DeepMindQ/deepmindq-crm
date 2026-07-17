import { NextRequest, NextResponse } from 'next/server';

// Inline imports for auth routes (12 handlers)
import * as mod_auth__logout from './auth__logout.ts';
import * as mod_auth__reset_password from './auth__reset-password.ts';
import * as mod_auth__reset_password__confirm from './auth__reset-password__confirm.ts';
import * as mod_auth__login from './auth__login.ts';
import * as mod_auth__me from './auth__me.ts';
import * as mod_auth__update_profile from './auth__update-profile.ts';
import * as mod_auth__register from './auth__register.ts';
import * as mod_auth__change_password from './auth__change-password.ts';
import * as mod_auth__set_password from './auth__set-password.ts';
import * as mod_auth__verify_otp from './auth__verify-otp.ts';
import * as mod_auth__request_otp from './auth__request-otp.ts';

// Route registry — specific routes FIRST, catch-all LAST
const ROUTES = [
  { key: 'auth/logout', handler: mod_auth__logout },
  { key: 'auth/reset-password', handler: mod_auth__reset_password },
  { key: 'auth/reset-password/confirm', handler: mod_auth__reset_password__confirm },
  { key: 'auth/login', handler: mod_auth__login },
  { key: 'auth/me', handler: mod_auth__me },
  { key: 'auth/update-profile', handler: mod_auth__update_profile },
  { key: 'auth/register', handler: mod_auth__register },
  { key: 'auth/change-password', handler: mod_auth__change_password },
  { key: 'auth/set-password', handler: mod_auth__set_password },
  { key: 'auth/verify-otp', handler: mod_auth__verify_otp },
  { key: 'auth/request-otp', handler: mod_auth__request_otp },
  // Catch-all MUST be last — only matches if nothing above matched
  { key: 'auth/[...nextauth]', handler: {
    GET: () => NextResponse.json({ error: 'Not found' }, { status: 404 }),
    POST: () => NextResponse.json({ error: 'Not found' }, { status: 404 }),
  }},
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
  catch (err: any) { console.error(`[router:auth] ${method} /${slug.join('/')}:`, err.message); return NextResponse.json({ error: 'Internal error', detail: err.message }, { status: 500 }); }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('GET', req, slug); }
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('POST', req, slug); }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('PUT', req, slug); }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('PATCH', req, slug); }
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('DELETE', req, slug); }
export async function OPTIONS(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('OPTIONS', req, slug); }