#!/usr/bin/env node
/**
 * api-security-audit.js — WI-18.1-Lock-3: API Security Contract
 *
 * Automated scanner that verifies every API route has proper security:
 *   1. Authentication guard (or explicit public annotation)
 *   2. Input validation (Zod) for state-changing methods
 *   3. Error handling (try/catch on handlers)
 *   4. AI governance on LLM-calling routes
 *   5. No sensitive data in GET query parameters
 *
 * Usage:
 *   node scripts/api-security-audit.js              # Human-readable report
 *   node scripts/api-security-audit.js --ci             # CI mode (exit 1 on HIGH)
 *   node scripts/api-security-audit.js --json           # JSON output
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const ciMode = args.includes('--ci');
const jsonMode = args.includes('--json');

const PUBLIC_ROUTE_PREFIXES = [
  '/api/auth/',
  '/api/webhooks/',
  '/api/tracking/',
  '/api/unsubscribe',
  '/api/cron/',
  '/api/cron/',
];

// ── Route Discovery ─────────────────────────────────────
function findAllRouteFiles() {
  const apiDir = path.resolve(__dirname, '../src/app/api');
  const routeFiles = [];

  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'route.ts') routeFiles.push(full);
    }
  }

  walk(apiDir);
  return routeFiles;
}

function isPublicRoute(filePath) {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  return PUBLIC_ROUTE_PREFIXES.some(p => normalized.includes(p));
}

// ── Route Analysis ──────────────────────────────────────
function analyzeRoute(filePath) {
  let content;
  try { content = fs.readFileSync(filePath, 'utf-8'); }
  catch { return { filePath, issues: [], isPublic: true, hasAuth: false }; }

  const relative = path.relative(path.resolve(__dirname, '..'), filePath).replace(/\\/g, '/');
  const isPublic = isPublicRoute(filePath);
  const issues = [];

  // Check 1: Authentication guard
  const hasAuth = content.includes('checkApiAuth') ||
    content.includes('requireAdminRole') ||
    content.includes('checkAdminAuth');

  if (!isPublic && !hasAuth) {
    issues.push({
      severity: 'HIGH',
      check: 'AUTH_MISSING',
      message: 'No authentication guard (checkApiAuth). Route is protected by Edge middleware session check, but route-level guard is defense-in-depth best practice.',
    });
  }

  // Check 2: Input validation for state-changing methods
  const hasStateChangeHandler = /export\s+(?:async\s+)?function\s+(POST|PUT|PATCH|DELETE)\s*\(/.test(content);
  if (hasStateChangeHandler) {
    const hasZod = content.includes('safeParse') || content.includes('validateBody') ||
      content.includes('z.object(') || content.includes('z.string(');
    if (!hasZod) {
      issues.push({
        severity: 'HIGH',
        check: 'INPUT_VALIDATION',
        message: 'POST/PUT/PATCH/DELETE handler without Zod input validation.',
      });
    }
  }

  // Check 3: Error handling on exported handlers
  const handlerMatches = [...content.matchAll(/export\s+async\s+function\s+(\w+)/g)];
  for (const match of handlerMatches) {
    const handlerName = match[1];
    const handlerEnd = content.indexOf('export async function', match.index + 1);
    const nextExport = content.indexOf('export async function', handlerEnd + 1);
    // Find try/catch within handler range
    const handlerBody = content.substring(match.index, nextExport > 0 ? nextExport : content.length);
    if (!handlerBody.includes('try {')) {
      issues.push({
        severity: 'MEDIUM',
        check: 'ERROR_HANDLING',
        message: `Handler '${handlerName}' lacks try/catch error handling.`,
      });
    }
  }

  // Check 4: AI governance on routes that call LLM
  const callsLLM = content.includes('callAI') || content.includes('callLLM') ||
    content.includes('revenueLLMCall') || content.includes('llm-client');
  if (callsLLM && !content.includes('governedAICall') && !content.includes('runQualityGates')) {
    if (content.includes('llm-client') || content.includes('callAI(') || content.includes('callLLM(')) {
      issues.push({
        severity: 'MEDIUM',
        check: 'AI_GOVERNANCE',
        message: 'Route calls LLM functions without AI governance wrapper (governedAICall).',
      });
    }
  }

  // Check 5: Sensitive data in GET params
  const getParamMatches = [...content.matchAll(/searchParams\.get\(['"](\w+)['"]\)/g)] || [];
  const sensitiveParams = ['token', 'session', 'key', 'password', 'secret', 'apiKey', 'credential'];
  for (const pm of getParamMatches) {
    const param = pm[1];
    if (sensitiveParams.some(s => param.toLowerCase().includes(s.toLowerCase()))) {
      issues.push({
        severity: 'HIGH',
        check: 'SENSITIVE_PARAM',
        message: `GET param '${param}' may expose sensitive data in server logs and URLs.`,
      });
    }
  }

  return { filePath, relative, issues, isPublic, hasAuth };
}

// ── Report Generation ──────────────────────────────────
function main() {
  const routeFiles = findAllRouteFiles();
  const results = routeFiles.map(analyzeRoute);

  let totalIssues = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  for (const result of results) {
    totalIssues += result.issues.length;
    for (const issue of result.issues) {
      if (issue.severity === 'HIGH') highCount++;
      else if (issue.severity === 'MEDIUM') mediumCount++;
      else lowCount++;
    }
  }

  const report = {
    timestamp: new Date().toISOString(),
    totalRoutes: routeFiles.length,
    publicRoutes: results.filter(r => r.isPublic).length,
    protectedRoutes: results.filter(r => !r.isPublic).length,
    totalIssues,
    highIssues: highCount,
    mediumIssues: mediumCount,
    lowIssues: lowCount,
    violations: results
      .filter(r => r.issues.length > 0)
      .map(r => ({
        route: r.relative,
        issues: r.issues,
      })),
  };

  if (jsonMode || ciMode) {
    console.log(JSON.stringify(report, null, 2));
    if (ciMode && highCount > 0) process.exit(1);
    return;
  }

  // Human-readable output
  console.log('');
  console.log('╔═════════════════════════════════════════════════════════╗');
  console.log('  DeepMindQ — API Security Contract Audit');
  console.log('  Generated: ' + new Date().toISOString());
  console.log('╚═════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Routes scanned:     ${report.totalRoutes}`);
  console.log(`  Protected routes:    ${report.protectedRoutes}  (require session)`);
  console.log(`  Public routes:       ${report.publicRoutes}  (exempt from auth)`);
  console.log('');
  console.log(`  Total findings:     ${report.totalIssues}`);
  console.log(`  HIGH (blocking):    ${report.highIssues}  ← Must fix before production`);
  console.log(`  MEDIUM (review):   ${report.mediumCount}`);
  console.log(`  LOW (advisory):    ${report.lowCount}`);
  console.log('');

  if (report.totalIssues === 0) {
    console.log('  ✅ All routes pass security contract checks.');
  } else {
    console.log('  ── Findings ──────────────────────────────────────────────');
    for (const violation of report.violations) {
      for (const issue of violation.issues) {
        const icon = issue.severity === 'HIGH' ? '🔴' : issue.severity === 'MEDIUM' ? '🟡' : '⚪';
        console.log('');
        console.log(`  ${icon} [${issue.check}] ${violation.route}`);
        console.log(`     ${issue.message}`);
      }
    }
    console.log('');
  }

  console.log('═════════════════════════════════════════════════════════');
  console.log('  Run with --ci for CI mode (exits 1 on HIGH findings).');
  console.log('  Run with --json for machine-readable output.');
  console.log('═════════════════════════════════════════════════════════');
  console.log('');
}

main();
