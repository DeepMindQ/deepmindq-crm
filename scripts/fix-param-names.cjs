const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');

// Fix routes that use 'req' instead of 'request'
const FIXES = [
  { file: 'action-history/route.ts', old: 'utilityGuard(request,', new: 'utilityGuard(req,' },
  { file: 'competitive/route.ts', old: 'utilityGuard(request,', new: 'utilityGuard(req,' },
  { file: 'people-enrich/route.ts', old: 'utilityGuard(request,', new: 'utilityGuard(req,' },
  { file: 'website-monitor/route.ts', old: 'utilityGuard(request,', new: 'utilityGuard(req,' },
  // refresh uses 'req' for both GET and POST
  { file: 'refresh/route.ts', old: /utilityGuard\(request,/g, new: 'utilityGuard(req,', regex: true },
  // enrich-batch GET has no request param - remove guard from GET
  { file: 'enrich-batch/route.ts', action: 'remove-get-guard' },
  // sprint3 uses plain Request not NextRequest - cast it
  { file: 'sprint3/route.ts', action: 'fix-request-type' },
  // stats has no request param at all - remove guard
  { file: 'stats/route.ts', action: 'remove-all-guards' },
];

const BASE = '/home/z/my-project/src/app/api/intelligence';

for (const fix of FIXES) {
  const filepath = join(BASE, fix.file);
  let content = readFileSync(filepath, 'utf-8');

  if (fix.action === 'remove-get-guard') {
    // Remove the guard block that was inserted into GET() which has no request param
    // Find the GET handler's guard block and remove it
    const getGuardRegex = /(export async function GET\(\)\s*\{)\s*\n\s*let correlationId;[\s\S]*?throw rlErr;\s*\n\s*\}/;
    content = content.replace(getGuardRegex, '$1');
    console.log('FIXED (removed GET guard): ' + fix.file);
  } else if (fix.action === 'remove-all-guards') {
    // stats has no request param - remove all guard blocks
    const guardBlockRegex = /\s*let correlationId;[\s\S]*?throw rlErr;\s*\n\s*\}/g;
    content = content.replace(guardBlockRegex, '');
    // Also remove unused imports
    content = content.replace(/import \{ utilityGuard, RateLimitedError \}[^;]+;\n/, '');
    content = content.replace(/import \{ scrubError \}[^;]+;\n/, '');
    console.log('FIXED (removed all guards): ' + fix.file);
  } else if (fix.action === 'fix-request-type') {
    // sprint3 uses Request not NextRequest - add cast
    content = content.replace(
      'utilityGuard(request,',
      "utilityGuard(request as any," // TODO: migrate to NextRequest"
    );
    console.log('FIXED (cast request): ' + fix.file);
  } else if (fix.regex) {
    content = content.replace(fix.old, fix.new);
    console.log('FIXED (regex): ' + fix.file);
  } else {
    content = content.replace(fix.old, fix.new);
    console.log('FIXED: ' + fix.file);
  }

  writeFileSync(filepath, content, 'utf-8');
}

console.log('\nDone fixing parameter names');
