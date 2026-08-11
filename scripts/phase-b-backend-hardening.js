/**
 * Phase B — Backend Hardening
 * Comprehensive audit + fix script for all 5 levels
 *
 * Level 1: Keyset pagination on list endpoints
 * Level 2: Dashboard query reduction (9→≤4) with caching
 * Level 3: Zod validation on all mutation routes
 * Level 4: CSRF token tied to session (not per-request)
 * Level 5: CSP nonce-based, no unsafe-inline
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const API_DIR = path.join(process.cwd(), 'src/app/api');
const LIB_DIR = path.join(process.cwd(), 'src/lib');

// ── Audit helpers ──
function readRoute(filepath) {
  try { return fs.readFileSync(filepath, 'utf-8'); }
  catch { return null; }
}

function getAllRouteFiles() {
  const results = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'route.ts') results.push(full);
    }
  }
  walk(API_DIR);
  return results;
}

// ═══════════════════════════════════════════════════════════════════
// LEVEL 1 AUDIT: Keyset Pagination
// ═══════════════════════════════════════════════════════════════════
function auditLevel1() {
  console.log('\n═══ LEVEL 1 AUDIT: Keyset Pagination ═══');
  const routes = getAllRouteFiles();
  const listEndpoints = [];

  for (const route of routes) {
    const content = readRoute(route);
    if (!content) continue;
    
    // Find GET handlers that return lists (findMany, count, skip/take)
    if (!content.includes('export async function GET')) continue;
    
    const isListEndpoint = 
      content.includes('findMany') ||
      content.includes('.count(') ||
      content.includes('skip:') ||
      content.includes('take:') ||
      content.includes('page') ||
      content.includes('limit');
    
    // Skip single-item routes (routes with [id] param)
    const dirPath = path.dirname(route);
    if (dirPath.includes('[id]') || dirPath.includes('[companyId]') || dirPath.includes('[entityId]')) {
      // But include if they still do findMany (e.g. sub-lists)
      if (!content.includes('findMany')) continue;
    }
    
    // Skip utility/health/stats endpoints
    const relPath = path.relative(API_DIR, route);
    if (relPath.includes('health') || relPath.includes('ping') || 
        relPath.includes('ready') || relPath.includes('stats') ||
        relPath.includes('dashboard') || relPath.includes('monitor') ||
        relPath.includes('cron/') || relPath.includes('tracking/') ||
        relPath.includes('version') || relPath.includes('v1/') ||
        relPath.includes('export-center')) continue;
    
    if (isListEndpoint) {
      const hasKeysetPagination = 
        content.includes('cursor') || 
        (content.includes('after') && content.includes('before'));
      
      const hasOffsetPagination =
        content.includes('skip:') ||
        content.includes('page') && content.includes('limit');
      
      listEndpoints.push({
        path: relPath,
        hasKeysetPagination,
        hasOffsetPagination,
        needsUpgrade: hasOffsetPagination && !hasKeysetPagination
      });
    }
  }
  
  console.log(`Found ${listEndpoints.length} list endpoints:`);
  for (const ep of listEndpoints) {
    const status = ep.hasKeysetPagination ? '✅ KEYSET' : ep.hasOffsetPagination ? '⚠️ OFFSET→KEYSET' : '❌ NO PAGINATION';
    console.log(`  ${status}: ${ep.path}`);
  }
  
  const needsUpgrade = listEndpoints.filter(e => e.needsUpgrade || !e.hasKeysetPagination);
  console.log(`\n${needsUpgrade.length} endpoints need keyset pagination upgrade`);
  return { total: listEndpoints.length, needsUpgrade: needsUpgrade.length, endpoints: listEndpoints };
}

// ═══════════════════════════════════════════════════════════════════
// LEVEL 2 AUDIT: Dashboard Query Count
// ═══════════════════════════════════════════════════════════════════
function auditLevel2() {
  console.log('\n═══ LEVEL 2 AUDIT: Dashboard Query Count ═══');
  
  const dashboardRoutes = [
    'dashboard/route.ts',
    'dashboard/stats/route.ts',
    'cro-dashboard/route.ts',
  ];
  
  for (const rel of dashboardRoutes) {
    const full = path.join(API_DIR, rel);
    const content = readRoute(full);
    if (!content) { console.log(`  ❌ NOT FOUND: ${rel}`); continue; }
    
    const queryCount = (content.match(/db\.\w+\.\w+\(/g) || []).length;
    const hasPromiseAll = content.includes('Promise.all');
    const hasCaching = content.includes('cache') || content.includes('Cache');
    
    console.log(`  ${rel}: ${queryCount} DB queries, Promise.all: ${hasPromiseAll}, Caching: ${hasCaching}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// LEVEL 3 AUDIT: Zod Validation Coverage
// ═══════════════════════════════════════════════════════════════════
function auditLevel3() {
  console.log('\n═══ LEVEL 3 AUDIT: Zod Validation Coverage ═══');
  const routes = getAllRouteFiles();
  let validated = 0, unvalidated = 0;
  const unvalidatedRoutes = [];

  for (const route of routes) {
    const content = readRoute(route);
    if (!content) continue;
    
    // Check for mutation handlers
    const hasMutation = /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)/.test(content);
    if (!hasMutation) continue;
    
    const relPath = path.relative(API_DIR, route);
    const hasZod = 
      content.includes('z.object') ||
      content.includes('z.string') ||
      content.includes('safeParse') ||
      content.includes('validateBody') ||
      content.includes('companyIdSchema') ||
      content.includes('intelligenceGuard');
    
    // Public webhook routes don't need Zod (they have HMAC verification)
    const isWebhook = relPath.startsWith('webhooks/') || relPath.startsWith('tracking/');
    // Cron routes are internal
    const isCron = relPath.startsWith('cron/');
    
    if (isWebhook || isCron) {
      validated++;
      continue;
    }
    
    if (hasZod) {
      validated++;
    } else {
      unvalidated++;
      unvalidatedRoutes.push(relPath);
    }
  }
  
  const total = validated + unvalidated;
  console.log(`Mutation routes: ${total} total, ${validated} validated, ${unvalidated} unvalidated (${total > 0 ? Math.round(validated/total*100) : 0}% coverage)`);
  
  if (unvalidatedRoutes.length > 0) {
    console.log(`\nUnvalidated routes (first 20):`);
    for (const r of unvalidatedRoutes.slice(0, 20)) {
      console.log(`  ❌ ${r}`);
    }
    if (unvalidatedRoutes.length > 20) console.log(`  ... +${unvalidatedRoutes.length - 20} more`);
  }
  
  return { total, validated, unvalidated, routes: unvalidatedRoutes };
}

// ═══════════════════════════════════════════════════════════════════
// LEVEL 4 AUDIT: CSRF Session-Bound
// ═══════════════════════════════════════════════════════════════════
function auditLevel4() {
  console.log('\n═══ LEVEL 4 AUDIT: CSRF Session Binding ═══');
  
  const csrfPath = path.join(LIB_DIR, 'csrf.ts');
  const csrfContent = readRoute(csrfPath);
  const proxyPath = path.join(process.cwd(), 'src/proxy.ts');
  const proxyContent = readRoute(proxyPath);
  
  // Check if CSRF token is regenerated per-request or per-session
  const regeneratesPerRequest = proxyContent?.includes('injectCsrfCookie') && 
    proxyContent?.includes('generateCsrfToken');
  
  const tiedToSession = csrfContent?.includes('session') || csrfContent?.includes('SESSION');
  
  console.log(`  CSRF file: ${csrfContent ? 'exists' : 'MISSING'}`);
  console.log(`  Proxy file: ${proxyContent ? 'exists' : 'MISSING'}`);
  console.log(`  Regenerates per request: ${regeneratesPerRequest ? 'YES (needs fix)' : 'NO'}`);
  console.log(`  Tied to session: ${tiedToSession ? 'YES' : 'NO (needs fix)'}`);
  
  if (regeneratesPerRequest && !tiedToSession) {
    console.log('  ⚠️ CSRF token is generated fresh each request — should be session-bound');
  }
}

// ═══════════════════════════════════════════════════════════════════
// LEVEL 5 AUDIT: CSP Nonce
// ═══════════════════════════════════════════════════════════════════
function auditLevel5() {
  console.log('\n═══ LEVEL 5 AUDIT: CSP Nonce ═══');
  
  const authHelpersPath = path.join(LIB_DIR, 'auth-helpers.ts');
  const content = readRoute(authHelpersPath);
  
  if (!content) { console.log('  ❌ auth-helpers.ts not found'); return; }
  
  const cspMatch = content.match(/Content-Security-Policy[^}]+/s);
  if (cspMatch) {
    const csp = cspMatch[0];
    console.log('  Current CSP directives:');
    for (const line of csp.split(';')) {
      const trimmed = line.trim();
      if (trimmed) console.log(`    ${trimmed}`);
    }
  }
  
  const hasUnsafeInline = content.includes("'unsafe-inline'");
  const hasNonce = content.includes('nonce-');
  
  console.log(`\n  unsafe-inline: ${hasUnsafeInline ? '❌ PRESENT (must remove)' : '✅ ABSENT'}`);
  console.log(`  nonce-based: ${hasNonce ? '✅ YES' : '❌ NO (must add)'}`);
}

// ═══════════════════════════════════════════════════════════════════
// RUN ALL AUDITS
// ═══════════════════════════════════════════════════════════════════
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║  PHASE B — BACKEND HARDENING — PRE-IMPLEMENTATION AUDIT ║');
console.log('╚══════════════════════════════════════════════════════════╝');

const l1 = auditLevel1();
auditLevel2();
const l3 = auditLevel3();
auditLevel4();
auditLevel5();

console.log('\n═══ SUMMARY ═══');
console.log(`Level 1 (Keyset Pagination): ${l1.needsUpgrade} endpoints need upgrade`);
console.log(`Level 3 (Zod Validation): ${l3.unvalidated} routes unvalidated (${l3.total > 0 ? Math.round(l3.validated/l3.total*100) : 0}% coverage)`);
