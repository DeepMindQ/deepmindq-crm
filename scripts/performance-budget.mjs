#!/usr/bin/env node
/**
 * Performance Budget Analyzer
 *
 * Analyzes the Next.js build output to enforce bundle size budgets.
 * Run after `npm run build` to check if any routes exceed size limits.
 *
 * Usage:
 *   node scripts/performance-budget.mjs [--json] [--warn]
 *
 * Exit codes:
 *   0 — All budgets pass
 *   1 — Budget violations detected
 *
 * Budget thresholds (bytes):
 *   - First Load JS (route):  200 KB
 *   - First Load JS (total):  500 KB
 *   - Static page HTML:       100 KB
 *   - Server bundle:          5 MB
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// ── Configuration ──
const BUDGETS = {
  firstLoadJsPerRoute: 200 * 1024,     // 200 KB per route
  firstLoadJsTotal: 500 * 1024,        // 500 KB total shared JS
  staticHtmlPerPage: 100 * 1024,       // 100 KB per page HTML
  serverBundleMax: 80 * 1024 * 1024,   // 80 MB server bundle (includes all 78 screen chunks)
};

const NEXT_DIR = '.next';

// ── Helpers ──

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getThresholdLabel(threshold) {
  return formatBytes(threshold);
}

// ── Analyze Build Output ──

function getDirSize(dir) {
  let size = 0;
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      size += getDirSize(fullPath);
    } else {
      size += stat.size;
    }
  }
  return size;
}

function analyzeBuild() {
  const violations = [];
  const routes = [];
  let totalFirstLoadJs = 0;
  let maxJsRoute = '';
  let maxJsSize = 0;

  // Try to read Next.js build manifest
  const buildManifestPath = join(NEXT_DIR, 'build-manifest.json');

  if (existsSync(buildManifestPath)) {
    try {
      const buildManifest = JSON.parse(readFileSync(buildManifestPath, 'utf-8'));
      const { pages } = buildManifest;

      // Analyze each page route
      for (const [route, assets] of Object.entries(pages)) {
        const pageAssets = assets; // { js: string[], css: string[] }
        let routeJsSize = 0;

        for (const jsFile of (pageAssets.js || [])) {
          const filePath = join(NEXT_DIR, 'static', 'chunks', 'app', jsFile.replace(/^\/_next\//, ''));
          const altPath = join(NEXT_DIR, jsFile.replace(/^\/_next\//, ''));
          const chunkPath = join(NEXT_DIR, 'static', jsFile.replace(/^\/_next\/static\//, ''));

          for (const p of [filePath, altPath, chunkPath]) {
            if (existsSync(p)) {
              routeJsSize += statSync(p).size;
              break;
            }
          }
        }

        routes.push({ route, firstLoadJs: routeJsSize });
        totalFirstLoadJs += routeJsSize;

        if (routeJsSize > maxJsSize) {
          maxJsSize = routeJsSize;
          maxJsRoute = route;
        }

        // Check per-route budget
        if (routeJsSize > BUDGETS.firstLoadJsPerRoute && routeJsSize > 0) {
          violations.push({
            type: 'first-load-js-per-route',
            route,
            actual: formatBytes(routeJsSize),
            limit: getThresholdLabel(BUDGETS.firstLoadJsPerRoute),
            overshoot: formatBytes(routeJsSize - BUDGETS.firstLoadJsPerRoute),
          });
        }
      }
    } catch (err) {
      console.error(`Warning: Could not parse build manifest: ${err}`);
    }
  }

  // Check total shared JS budget
  if (totalFirstLoadJs > BUDGETS.firstLoadJsTotal) {
    violations.push({
      type: 'first-load-js-total',
      route: '(all routes combined)',
      actual: formatBytes(totalFirstLoadJs),
      limit: getThresholdLabel(BUDGETS.firstLoadJsTotal),
      overshoot: formatBytes(totalFirstLoadJs - BUDGETS.firstLoadJsTotal),
    });
  }

  // Analyze server bundle size
  const serverDir = join(NEXT_DIR, 'server');
  if (existsSync(serverDir)) {
    const serverSize = getDirSize(serverDir);
    if (serverSize > BUDGETS.serverBundleMax) {
      violations.push({
        type: 'server-bundle',
        route: '.next/server',
        actual: formatBytes(serverSize),
        limit: getThresholdLabel(BUDGETS.serverBundleMax),
        overshoot: formatBytes(serverSize - BUDGETS.serverBundleMax),
      });
    }
  }

  // Analyze static HTML pages
  const serverAppDir = join(NEXT_DIR, 'server', 'app');
  if (existsSync(serverAppDir)) {
    function analyzeHtmlDir(dir, baseRoute) {
      if (!existsSync(dir)) return;
      for (const entry of readdirSync(dir)) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          analyzeHtmlDir(fullPath, `${baseRoute}/${entry}`);
        } else if (entry === 'index.html' || entry.endsWith('.html')) {
          if (stat.size > BUDGETS.staticHtmlPerPage) {
            violations.push({
              type: 'static-html-per-page',
              route: `${baseRoute}/${entry}`,
              actual: formatBytes(stat.size),
              limit: getThresholdLabel(BUDGETS.staticHtmlPerPage),
              overshoot: formatBytes(stat.size - BUDGETS.staticHtmlPerPage),
            });
          }
        }
      }
    }
    analyzeHtmlDir(serverAppDir, '');
  }

  return {
    passed: violations.length === 0,
    violations,
    summary: {
      routesAnalyzed: routes.length,
      totalFirstLoadJs,
      avgFirstLoadJs: routes.length > 0 ? totalFirstLoadJs / routes.length : 0,
      maxFirstLoadJs: { route: maxJsRoute, size: maxJsSize },
    },
  };
}

// ── Output ──

const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const warnOnly = args.includes('--warn');

const result = analyzeBuild();

if (jsonOutput) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log('');
  console.log('  DeepMindQ CRM — Performance Budget Report');
  console.log('');
  console.log('  Summary');
  console.log(`   Routes analyzed:    ${result.summary.routesAnalyzed}`);
  console.log(`   Total First Load:   ${formatBytes(result.summary.totalFirstLoadJs)}`);
  console.log(`   Avg First Load:     ${formatBytes(result.summary.avgFirstLoadJs)}`);
  console.log(
    `   Max First Load:     ${formatBytes(result.summary.maxFirstLoadJs.size)} (${result.summary.maxFirstLoadJs.route || 'N/A'})`,
  );
  console.log('');
  console.log('  Budgets');
  console.log(`   Per-route JS:       ${getThresholdLabel(BUDGETS.firstLoadJsPerRoute)}`);
  console.log(`   Total JS:           ${getThresholdLabel(BUDGETS.firstLoadJsTotal)}`);
  console.log(`   HTML per page:      ${getThresholdLabel(BUDGETS.staticHtmlPerPage)}`);
  console.log(`   Server bundle:      ${getThresholdLabel(BUDGETS.serverBundleMax)}`);
  console.log('');

  if (result.violations.length === 0) {
    console.log('  All performance budgets PASS');
  } else {
    console.log(`  ${result.violations.length} violation(s) found:`);
    console.log('');

    for (const v of result.violations) {
      console.log(`   ${v.type}`);
      console.log(`      Route:    ${v.route}`);
      console.log(`      Actual:   ${v.actual} (over by ${v.overshoot})`);
      console.log(`      Limit:    ${v.limit}`);
      console.log('');
    }
  }
}

if (!result.passed && !warnOnly) {
  process.exit(1);
}
