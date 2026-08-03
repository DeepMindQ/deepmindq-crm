#!/usr/bin/env node
/**
 * API Security Contract Scanner — WI-18.1 LOCK-3
 *
 * Scans all API route files to detect routes that are MISSING
 * authentication guards. Routes in the public path list are exempt;
 * all others MUST have checkApiAuth or withApiMiddleware.
 *
 * This runs in CI and fails the build if unprotected routes are found.
 *
 * Usage: node scripts/api-security-scan.js
 * Exit code: 0 (all protected) or 1 (unprotected routes found)
 */

const fs = require('fs');
const path = require('path');

// Routes that are intentionally public (matching PUBLIC_PATH_PREFIXES in auth-helpers.ts)
const PUBLIC_ROUTE_PREFIXES = [
  '/api/auth/',
  '/api/webhooks/',
  '/api/tracking/',
  '/api/unsubscribe',
  '/api/cron/',
  '/api/health',
  '/api/ready',
  '/api/version',
  '/api/setup-db',
  '/api/emails/track',  // Email tracking pixel (called from email clients, must be public)
  '/api/ping',          // Liveness probe (called from monitoring, must be public)
];

function isPublicRoute(routePath) {
  return PUBLIC_ROUTE_PREFIXES.some(prefix => routePath.startsWith(prefix));
}

function findRouteFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip test directories and node_modules
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      results.push(...findRouteFiles(fullPath));
    } else if (entry.name === 'route.ts') {
      // Extract API path from file location
      const apiIndex = fullPath.indexOf('/api/');
      if (apiIndex !== -1) {
        const routePath = fullPath.slice(apiIndex).replace('/route.ts', '');
        results.push({ routePath, filePath: fullPath });
      }
    }
  }
  return results;
}

function hasAuthGuard(content) {
  return (
    content.includes('checkApiAuth') ||
    content.includes('withApiMiddleware') ||
    content.includes('getCurrentSession')
  );
}

function hasExportedHandlers(content) {
  return (
    content.includes('export async function GET') ||
    content.includes('export async function POST') ||
    content.includes('export async function PUT') ||
    content.includes('export async function PATCH') ||
    content.includes('export async function DELETE')
  );
}

function scan() {
  const apiDir = path.join(__dirname, '..', 'src', 'app', 'api');
  if (!fs.existsSync(apiDir)) {
    console.log('No src/app/api directory found — nothing to scan.');
    process.exit(0);
  }

  const routes = findRouteFiles(apiDir);
  const violations = [];

  for (const { routePath, filePath } of routes) {
    if (isPublicRoute(routePath)) continue;

    const content = fs.readFileSync(filePath, 'utf-8');

    // Only check files that have exported handlers
    if (!hasExportedHandlers(content)) continue;

    if (!hasAuthGuard(content)) {
      violations.push({ routePath, filePath });
    }
  }

  if (violations.length > 0) {
    console.error('::error::API SECURITY CONTRACT VIOLATIONS DETECTED');
    console.error('');
    console.error(`Found ${violations.length} API route(s) without authentication guards:`);
    console.error('');
    for (const v of violations) {
      console.error(`  ❌ ${v.routePath}`);
      console.error(`     ${v.filePath}`);
    }
    console.error('');
    console.error('Every non-public API route MUST call checkApiAuth() or use withApiMiddleware().');
    console.error('If this route should be public, add its prefix to:');
    console.error('  1. PUBLIC_PATH_PREFIXES in src/lib/auth-helpers.ts');
    console.error('  2. PUBLIC_ROUTE_PREFIXES in scripts/api-security-scan.js');
    console.error('  3. Document why it is public in SECURITY.md');
    process.exit(1);
  }

  const totalRoutes = routes.length;
  const publicRoutes = routes.filter(r => isPublicRoute(r.routePath)).length;
  const protectedRoutes = totalRoutes - publicRoutes;
  console.log(`✓ API Security Contract: ${protectedRoutes} protected routes, ${publicRoutes} public routes (${totalRoutes} total)`);
  process.exit(0);
}

scan();
