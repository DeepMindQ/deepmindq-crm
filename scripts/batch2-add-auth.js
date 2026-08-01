#!/usr/bin/env node
/**
 * Phase 2 Batch 2 — Add checkApiAuth() to all intelligence/AI/research/G-intel routes.
 *
 * Strategy: For each route file, insert the auth check as the FIRST operation
 * inside each exported handler function, BEFORE any existing guards or business logic.
 *
 * Patterns:
 * A) intelligenceGuard routes: auth → intelligenceGuard → business logic
 * B) utilityGuard routes: auth → utilityGuard try/catch → business logic
 * C) no-guard routes: auth → try/catch or business logic
 */

const fs = require('fs');
const path = require('path');

// ── Configuration ────────────────────────────────────────────
const AUTH_IMPORT = "import { checkApiAuth } from '@/lib/api-auth';";
const AUTH_CHECK_BLOCK = `  // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

`;

// Files to process (all 81 unprotected routes)
const ROUTES = [
  // Intelligence routes (29)
  'src/app/api/intelligence/action-history/route.ts',
  'src/app/api/intelligence/action/[id]/route.ts',
  'src/app/api/intelligence/brief/[id]/route.ts',
  'src/app/api/intelligence/capability-pipeline/route.ts',
  'src/app/api/intelligence/collect-external/route.ts',
  'src/app/api/intelligence/company/[id]/route.ts',
  'src/app/api/intelligence/competitive/route.ts',
  'src/app/api/intelligence/conversation/[id]/route.ts',
  'src/app/api/intelligence/correlations/route.ts',
  'src/app/api/intelligence/cross-account/route.ts',
  'src/app/api/intelligence/enrich-batch/route.ts',
  'src/app/api/intelligence/enrich/route.ts',
  'src/app/api/intelligence/feedback/route.ts',
  'src/app/api/intelligence/full-pipeline/route.ts',
  'src/app/api/intelligence/grounding/[id]/route.ts',
  'src/app/api/intelligence/internal-memory/route.ts',
  'src/app/api/intelligence/knowledge/[id]/route.ts',
  'src/app/api/intelligence/mindmap/[id]/route.ts',
  'src/app/api/intelligence/monitor/route.ts',
  'src/app/api/intelligence/opportunity/[id]/route.ts',
  'src/app/api/intelligence/people-enrich/route.ts',
  'src/app/api/intelligence/predictions/route.ts',
  'src/app/api/intelligence/reasoning/[id]/route.ts',
  'src/app/api/intelligence/refresh/route.ts',
  'src/app/api/intelligence/retrieval/[id]/route.ts',
  'src/app/api/intelligence/sprint3/route.ts',
  'src/app/api/intelligence/stats/route.ts',
  'src/app/api/intelligence/unified/route.ts',
  'src/app/api/intelligence/website-monitor/route.ts',
  // AI routes (31)
  'src/app/api/ai/account-brief/route.ts',
  'src/app/api/ai/buying-intent/route.ts',
  'src/app/api/ai/chat/route.ts',
  'src/app/api/ai/contact-engagement/route.ts',
  'src/app/api/ai/contact-intelligence/route.ts',
  'src/app/api/ai/conversation-plan/route.ts',
  'src/app/api/ai/conversation-studio/route.ts',
  'src/app/api/ai/deal-coaching/route.ts',
  'src/app/api/ai/deal-risk/route.ts',
  'src/app/api/ai/email-intelligence/route.ts',
  'src/app/api/ai/enrich/route.ts',
  'src/app/api/ai/freshness/route.ts',
  'src/app/api/ai/generate/route.ts',
  'src/app/api/ai/governance/check/route.ts',
  'src/app/api/ai/health/route.ts',
  'src/app/api/ai/insights/route.ts',
  'src/app/api/ai/opportunities/[id]/accept/route.ts',
  'src/app/api/ai/opportunities/[id]/reject/route.ts',
  'src/app/api/ai/opportunities/route.ts',
  'src/app/api/ai/query/route.ts',
  'src/app/api/ai/recommendations/route.ts',
  'src/app/api/ai/relationship-memory/route.ts',
  'src/app/api/ai/reliability/route.ts',
  'src/app/api/ai/revenue-score/route.ts',
  'src/app/api/ai/score-contacts/route.ts',
  'src/app/api/ai/score-leads/route.ts',
  'src/app/api/ai/score-opportunities/route.ts',
  'src/app/api/ai/signals/route.ts',
  'src/app/api/ai/suggested-contacts/route.ts',
  'src/app/api/ai/summarize/route.ts',
  'src/app/api/ai/usage/route.ts',
  // Research routes (2)
  'src/app/api/research/route.ts',
  'src/app/api/research-agent/route.ts',
  // Reasoning (1)
  'src/app/api/reasoning/route.ts',
  // G-intel acquisition (6)
  'src/app/api/g-intel-acquisition/inbox/[id]/convert/route.ts',
  'src/app/api/g-intel-acquisition/inbox/[id]/dismiss/route.ts',
  'src/app/api/g-intel-acquisition/inbox/[id]/review/route.ts',
  'src/app/api/g-intel-acquisition/inbox/batch-dismiss/route.ts',
  'src/app/api/g-intel-acquisition/inbox/route.ts',
  'src/app/api/g-intel-acquisition/inbox/stats/route.ts',
  // Signals (3)
  'src/app/api/signals/route.ts',
  'src/app/api/signals/operational/route.ts',
  'src/app/api/signals/[id]/evidence/route.ts',
  // Command-center (2)
  'src/app/api/command-center/insights/route.ts',
  'src/app/api/command-center/query/route.ts',
  // Company intelligence (5)
  'src/app/api/companies/[id]/intelligence/route.ts',
  'src/app/api/companies/[id]/brief/route.ts',
  'src/app/api/companies/[id]/signals/route.ts',
  'src/app/api/companies/[id]/signals/[signalId]/route.ts',
  'src/app/api/companies/[id]/scores/route.ts',
  // Contact intelligence (2)
  'src/app/api/contacts/[id]/briefing/route.ts',
  'src/app/api/contacts/[id]/generate-email/route.ts',
];

const BASE = '/home/z/my-project';

let modified = 0;
let skipped = 0;
let errors = [];

for (const relPath of ROUTES) {
  const fullPath = path.join(BASE, relPath);
  
  if (!fs.existsSync(fullPath)) {
    errors.push(`MISSING: ${relPath}`);
    continue;
  }

  let content = fs.readFileSync(fullPath, 'utf8');

  // Skip if already has checkApiAuth
  if (content.includes('checkApiAuth')) {
    skipped++;
    continue;
  }

  // ── Step 1: Add import ──────────────────────────────────
  // Find the last import line, insert after it
  const importLines = content.match(/^import .+;$/gm);
  if (!importLines || importLines.length === 0) {
    errors.push(`NO IMPORTS: ${relPath}`);
    continue;
  }

  // Insert auth import after the last import line
  const lastImportLine = importLines[importLines.length - 1];
  const lastImportIndex = content.lastIndexOf(lastImportLine);
  const afterLastImport = content.indexOf('\n', lastImportIndex) + 1;
  
  // Check if the import already exists (avoid duplicate)
  if (!content.includes(AUTH_IMPORT)) {
    content = content.slice(0, afterLastImport) + AUTH_IMPORT + '\n' + content.slice(afterLastImport);
  }

  // ── Step 2: Insert auth check inside each exported handler ──
  // Find all exported handler functions: export async function GET/POST/PUT/DELETE/PATCH
  const handlerRegex = /export async function (GET|POST|PUT|DELETE|PATCH)\s*\(/g;
  let match;
  let offset = 0;
  const inserts = [];

  while ((match = handlerRegex.exec(content)) !== null) {
    const funcStart = match.index + offset;
    // Find the opening brace of the function body
    const braceIndex = content.indexOf('{', funcStart);
    if (braceIndex === -1) continue;
    
    // Find the position right after the opening brace (skip whitespace/newline)
    let insertPos = braceIndex + 1;
    while (insertPos < content.length && (content[insertPos] === '\n' || content[insertPos] === ' ' || content[insertPos] === '\r')) {
      insertPos++;
    }
    
    // Check if we're inserting into a utilityGuard try block
    // For utilityGuard pattern, we want to insert BEFORE the try block
    const lineBeforeInsert = content.substring(insertPos, insertPos + 100).trimStart();
    
    // Check if next non-whitespace is 'try' (utilityGuard pattern)
    if (lineBeforeInsert.startsWith('try') || lineBeforeInsert.startsWith('let ') || lineBeforeInsert.startsWith('const ')) {
      // For utilityGuard pattern: insert before the try block
      // We need to find where the try starts
      const tryIndex = content.indexOf('\n  try', insertPos - 2);
      if (tryIndex !== -1 && tryIndex < insertPos + 50) {
        insertPos = tryIndex + 1;
      }
    }
    
    inserts.push(insertPos);
  }

  // Apply inserts in reverse order to maintain positions
  for (let i = inserts.length - 1; i >= 0; i--) {
    const pos = inserts[i];
    // Dedent the auth check block to match the handler's indentation (2 spaces)
    content = content.slice(0, pos) + AUTH_CHECK_BLOCK + content.slice(pos);
  }

  fs.writeFileSync(fullPath, content, 'utf8');
  modified++;
}

console.log(`=== Batch 2 Auth Guard Injection Complete ===`);
console.log(`Modified: ${modified}`);
console.log(`Skipped (already has auth): ${skipped}`);
console.log(`Errors: ${errors.length}`);
if (errors.length > 0) {
  errors.forEach(e => console.log(`  ERROR: ${e}`));
}
