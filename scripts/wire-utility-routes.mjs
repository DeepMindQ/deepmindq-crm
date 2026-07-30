#!/usr/bin/env node
// @ts-check
/**
 * Script: Wire utility routes with guard + scrubError + correlation-id + rate-limit
 * 
 * For each utility route under /api/intelligence/:
 *   1. Add import for utilityGuard and scrubError
 *   2. Add utilityGuard() call at start of each handler
 *   3. Replace raw err.message with scrubError() in Response.json
 *   4. Add responseHeaders to all Response.json calls
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const UTIL_ROUTES = [
  'unified/route.ts',
  'refresh/route.ts',
  'stats/route.ts',
  'full-pipeline/route.ts',
  'enrich/route.ts',
  'enrich-batch/route.ts',
  'monitor/route.ts',
  'collect-external/route.ts',
  'correlations/route.ts',
  'predictions/route.ts',
  'competitive/route.ts',
  'cross-account/route.ts',
  'action-history/route.ts',
  'sprint3/route.ts',
  'people-enrich/route.ts',
  'feedback/route.ts',
  'internal-memory/route.ts',
  'website-monitor/route.ts',
  'capability-pipeline/route.ts',
];

const BASE = '/home/z/my-project/src/app/api/intelligence';

function processFile(filepath: string) {
  let content = readFileSync(filepath, 'utf-8');
  const original = content;

  // Skip if already has utilityGuard
  if (content.includes('utilityGuard')) {
    console.log(`  SKIP (already has utilityGuard): ${filepath}`);
    return false;
  }

  // 1. Add imports after the last existing import
  const importInsert = `import { utilityGuard, RateLimitedError } from '@/lib/intelligence-api/guard';
import { scrubError } from '@/lib/intelligence-api/handler';`;

  // Find the last import line
  const lines = content.split('\n');
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimStart().startsWith('import ')) {
      lastImportIdx = i;
    }
  }

  if (lastImportIdx >= 0) {
    lines.splice(lastImportIdx + 1, 0, importInsert);
    content = lines.join('\n');
  }

  // 2. Find handler functions (export async function GET/POST etc)
  // Add utilityGuard call at start
  const handlerRegex = /(export async function (GET|POST|PUT|DELETE|PATCH)\s*\([^)]*\)\s*\{)/g;
  let match;
  const handlers = [];
  while ((match = handlerRegex.exec(content)) !== null) {
    handlers.push({ index: match.index + match[0].length, method: match[2] });
  }

  // Insert utilityGuard at each handler start
  // Work backwards to preserve indices
  for (let i = handlers.length - 1; i >= 0; i--) {
    const h = handlers[i];
    const endpointName = filepath.split('/').slice(-2)[0]; // parent dir name
    const guardCall = `
  // ── Intelligence Utility Guard: correlation-id + rate limiting ─────
  let correlationId: string;
  let responseHeaders: Record<string, string>;
  try {
    const ctx = utilityGuard(request, '${endpointName}');
    correlationId = ctx.correlationId;
    responseHeaders = ctx.responseHeaders;
  } catch (rlErr) {
    if (rlErr instanceof RateLimitedError) {
      return new Response(JSON.stringify(rlErr.errorBody), { status: 429, headers: rlErr.headers });
    }
    throw rlErr;
  }
`;
    content = content.slice(0, h.index) + guardCall + content.slice(h.index);
  }

  // 3. Replace raw err.message in Response.json with scrubError
  // Pattern: `err.message` in Response.json context
  // Replace: `err instanceof Error ? err.message : 'fallback'` with scrubError version
  const errMessageRegex = /err instanceof Error \? err\.message : '([^']*)'/g;
  content = content.replace(errMessageRegex, (fullMatch, fallback) => {
    return `scrubError(err instanceof Error ? err.message : '${fallback}')`;
  });

  // Also handle: err instanceof Error ? err.message : String(err)
  const errMessageRegex2 = /err instanceof Error \? err\.message : String\(err\)/g;
  content = content.replace(errMessageRegex2, 'scrubError(err instanceof Error ? err.message : String(err))');

  if (content !== original) {
    writeFileSync(filepath, content, 'utf-8');
    console.log(`  FIXED: ${filepath}`);
    return true;
  } else {
    console.log(`  NO CHANGES: ${filepath}`);
    return false;
  }
}

console.log('=== Wiring utility routes with guard + scrubError ===\n');
let fixed = 0;
for (const route of UTIL_ROUTES) {
  const filepath = join(BASE, route);
  try {
    if (processFile(filepath)) fixed++;
  } catch (e) {
    console.error(`  ERROR: ${route}: ${e.message}`);
  }
}
console.log(`\nDone: ${fixed}/${UTIL_ROUTES.length} routes fixed`);
