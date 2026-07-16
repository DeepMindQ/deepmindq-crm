#!/usr/bin/env python3
"""
Consolidates 124 API route files into 7 catch-all route handlers for Vercel Hobby plan.
Copies originals to _routes/, creates dynamic-import router for each group.
"""
import os, shutil, json

API_DIR = 'src/app/api'
ROUTES_DIR = os.path.join(API_DIR, '_routes')

GROUPS = [
    ('auth', ['auth']),
    ('crm', ['companies', 'contacts', 'signals', 'segments', 'suppressions', 'pipeline', 'leads', 'duplicates', 'batches', 'bounces']),
    ('ai', ['ai', 'command-center', 'research-agent', 'capabilities', 'knowledge', 'conversation-plans']),
    ('outreach', ['sequences', 'templates', 'prompt-templates', 'queue', 'drafts', 'replies', 'email-worker', 'tracking', 'webhooks', 'unsubscribe', 'verify-email', 'verify-queue']),
    ('strategy', ['playbooks', 'strategy-room']),
    ('data', ['stats', 'dashboard', 'analytics', 'data-health', 'team', 'ab-tests', 'notifications', 'compliance', 'audit', 'audit-logs']),
    ('system', ['settings', 'seed']),
]

os.makedirs(ROUTES_DIR, exist_ok=True)

# Step 1: Copy all route files to _routes/ with flat naming
registry = {}
total = 0

for group_name, prefixes in GROUPS:
    group_routes = []
    for prefix in prefixes:
        prefix_dir = os.path.join(API_DIR, prefix)
        if not os.path.isdir(prefix_dir):
            continue
        for root, dirs, files in os.walk(prefix_dir):
            if 'route.ts' in files:
                route_file = os.path.join(root, 'route.ts')
                rel = os.path.relpath(route_file, API_DIR)
                key = os.path.dirname(rel).replace(os.sep, '/')
                # Flat name for the file
                flat = key.replace('/', '__').replace('[', '_').replace(']', '').replace('...', '_catchall_')
                dest = os.path.join(ROUTES_DIR, flat + '.ts')
                shutil.copy2(route_file, dest)
                group_routes.append({
                    'key': key,
                    'file': flat,
                    'prefixes': prefixes,
                })
                total += 1
    registry[group_name] = group_routes

# Save registry as a .ts file (JSON in a TypeScript file)
reg_content = "// Auto-generated route registry\nconst ROUTE_REGISTRY = " + json.dumps(registry, indent=2) + " as const;\nexport default ROUTE_REGISTRY;\n"
with open(os.path.join(ROUTES_DIR, 'registry.ts'), 'w') as f:
    f.write(reg_content)

# Also copy root api/route.ts
root_route = os.path.join(API_DIR, 'route.ts')
if os.path.exists(root_route):
    shutil.copy2(root_route, os.path.join(ROUTES_DIR, 'root.ts'))

print(f"Copied {total} routes to _routes/")
for g, routes in registry.items():
    print(f"  {g}: {len(routes)}")

# Step 2: Create the router utility
router_code = '''/**
 * Dynamic route router for consolidated API handlers.
 * Parses URL slug, matches against registry, dynamically imports handler.
 */
import { NextRequest, NextResponse } from 'next/server';
import ROUTE_REGISTRY from './_routes/registry';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';

interface RouteDef {
  key: string;
  file: string;
  prefixes: string[];
}

// Cache for loaded handler modules
const handlerCache = new Map<string, Record<string, Function>>();

/**
 * Convert a route key like "companies/[id]/intelligence" to a regex
 * that matches actual paths like "companies/abc123/intelligence"
 */
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
      regexParts.add ? regexParts.push(part.replace(/[.*+?^${}()|[\]\\\\]/g, '\\\\$&')) : null;
    }
  }
  return {
    regex: new RegExp('^' + regexParts.join('/') + '$'),
    paramNames,
  };
}

async function loadHandler(group: string, file: string): Promise<Record<string, Function> | null> {
  const cacheKey = `${group}__${file}`;
  if (handlerCache.has(cacheKey)) return handlerCache.get(cacheKey)!;
  try {
    // Dynamic import — Next.js will bundle this at build time
    const mod = await import(`./_routes/${file}.ts`);
    handlerCache.set(cacheKey, mod);
    return mod as Record<string, Function>;
  } catch (err: any) {
    console.error(`[router:${group}] Failed to load handler "${file}":`, err.message);
    return null;
  }
}

function matchRoute(
  group: string,
  slug: string[]
): { handler: Promise<Record<string, Function> | null>; params: Record<string, string> } | null {
  const routes = (ROUTE_REGISTRY as any)[group] as RouteDef[] | undefined;
  if (!routes) return null;

  const path = slug.join('/');

  for (const route of routes) {
    const { regex, paramNames } = keyToRegex(route.key);
    const match = path.match(regex);
    if (match) {
      const params: Record<string, string> = {};
      paramNames.forEach((name, i) => {
        params[name] = match[i + 1] || '';
      });
      return {
        handler: loadHandler(group, route.file),
        params,
      };
    }
  }
  return null;
}

export async function handleRequest(
  method: HttpMethod,
  req: NextRequest,
  group: string,
  slug: string[]
): Promise<Response> {
  const matched = matchRoute(group, slug);
  if (!matched) {
    return NextResponse.json({ error: 'Not found', path: slug.join('/') }, { status: 404 });
  }

  const handler = await matched.handler;
  if (!handler) {
    return NextResponse.json({ error: 'Handler load failed' }, { status: 500 });
  }

  const fn = handler[method];
  if (typeof fn !== 'function') {
    return NextResponse.json({ error: `${method} not allowed` }, { status: 405 });
  }

  // Build params similar to Next.js: { slug: string[] } or { id: string, ... }
  const params = Promise.resolve(matched.params);

  try {
    return await fn(req, { params });
  } catch (err: any) {
    console.error(`[router:${group}] ${method} /${slug.join('/')} error:`, err.message);
    return NextResponse.json(
      { error: 'Internal server error', detail: err.message },
      { status: 500 }
    );
  }
}
'''

with open(os.path.join(API_DIR, '_router.ts'), 'w') as f:
    f.write(router_code)

print("\nCreated _router.ts")

# Step 3: Create catch-all route.ts for each group
catchall_template = '''import { NextRequest } from 'next/server';
import { handleRequest } from '../_router';

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return handleRequest('GET', req, '{GROUP}', slug);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return handleRequest('POST', req, '{GROUP}', slug);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return handleRequest('PUT', req, '{GROUP}', slug);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return handleRequest('PATCH', req, '{GROUP}', slug);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return handleRequest('DELETE', req, '{GROUP}', slug);
}

export async function OPTIONS(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return handleRequest('OPTIONS', req, '{GROUP}', slug);
}
'''

for group_name, _ in GROUPS:
    # Create directory [group_name]/[...slug]/
    slug_dir = os.path.join(API_DIR, f'[{group_name}]', '[...slug]')
    os.makedirs(slug_dir, exist_ok=True)
    
    route_content = catchall_template.replace('{GROUP}', group_name)
    with open(os.path.join(slug_dir, 'route.ts'), 'w') as f:
        f.write(route_content)
    print(f"Created [{group_name}]/[...slug]/route.ts")

print(f"\n✓ Created 7 catch-all route handlers")
print(f"✓ Total serverless functions: 7 (routes) + 1 (root api) + pages = under 12")