// Script: Wire utility routes with guard + scrubError + correlation-id + rate-limit
const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');

const UTIL_ROUTES = [
  'unified/route.ts', 'refresh/route.ts', 'stats/route.ts', 'full-pipeline/route.ts',
  'enrich/route.ts', 'enrich-batch/route.ts', 'monitor/route.ts', 'collect-external/route.ts',
  'correlations/route.ts', 'predictions/route.ts', 'competitive/route.ts', 'cross-account/route.ts',
  'action-history/route.ts', 'sprint3/route.ts', 'people-enrich/route.ts', 'feedback/route.ts',
  'internal-memory/route.ts', 'website-monitor/route.ts', 'capability-pipeline/route.ts',
];

const BASE = '/home/z/my-project/src/app/api/intelligence';

function processFile(filepath) {
  let content = readFileSync(filepath, 'utf-8');
  if (content.includes('utilityGuard')) {
    console.log('  SKIP (already has utilityGuard): ' + filepath);
    return false;
  }

  // 1. Add imports
  const importInsert = "import { utilityGuard, RateLimitedError } from '@/lib/intelligence-api/guard';\nimport { scrubError } from '@/lib/intelligence-api/handler';";
  const lines = content.split('\n');
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimStart().startsWith('import ')) lastImportIdx = i;
  }
  if (lastImportIdx >= 0) {
    lines.splice(lastImportIdx + 1, 0, importInsert);
    content = lines.join('\n');
  }

  // 2. Find handler functions and add guard
  const handlerRegex = /(export async function (GET|POST|PUT|DELETE|PATCH)\s*\([^)]*\)\s*\{)/g;
  let match;
  const handlers = [];
  while ((match = handlerRegex.exec(content)) !== null) {
    handlers.push({ index: match.index + match[0].length });
  }

  const endpointName = filepath.split('/').slice(-2)[0];
  for (let i = handlers.length - 1; i >= 0; i--) {
    const guardCall = "\n  let correlationId;\n  let responseHeaders;\n  try {\n    const ctx = utilityGuard(request, '" + endpointName + "');\n    correlationId = ctx.correlationId;\n    responseHeaders = ctx.responseHeaders;\n  } catch (rlErr) {\n    if (rlErr instanceof RateLimitedError) {\n      return new Response(JSON.stringify(rlErr.errorBody), { status: 429, headers: rlErr.headers });\n    }\n    throw rlErr;\n  }\n";
    content = content.slice(0, handlers[i].index) + guardCall + content.slice(handlers[i].index);
  }

  // 3. Replace raw err.message with scrubError
  content = content.replace(/err instanceof Error \? err\.message : '([^']*)'/g, (full, fb) => {
    return "scrubError(err instanceof Error ? err.message : '" + fb + "')";
  });
  content = content.replace(/err instanceof Error \? err\.message : String\(err\)/g,
    'scrubError(err instanceof Error ? err.message : String(err))');

  writeFileSync(filepath, content, 'utf-8');
  console.log('  FIXED: ' + filepath);
  return true;
}

console.log('=== Wiring utility routes ===\n');
let fixed = 0;
for (const route of UTIL_ROUTES) {
  try {
    if (processFile(join(BASE, route))) fixed++;
  } catch (e) {
    console.error('  ERROR: ' + route + ': ' + e.message);
  }
}
console.log('\nDone: ' + fixed + '/' + UTIL_ROUTES.length + ' routes fixed');
