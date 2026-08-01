#!/usr/bin/env node
/**
 * Phase 2 Batch 3 — Add checkApiAuth() to all remaining unprotected routes.
 * 
 * Exempt (NOT in this list):
 *   - auth/* (login, register, request-otp, verify-otp, reset-password, logout, me,
 *             change-password, update-profile, set-password — already authed)
 *   - tracking/* (HMAC signed tokens)
 *   - emails/track (logging only)
 *   - webhooks/* (HMAC signature verification)
 *   - unsubscribe (HMAC token)
 *   - cron/* (CRON_SECRET bearer token)
 *   - setup-db (SETUP_TOKEN header)
 *   - ping, health (liveness probes)
 *   - engines/* (already use requireAuth/withApiMiddleware)
 */

const fs = require('fs');
const path = require('path');

const BASE = '/home/z/my-project';

const AUTH_IMPORT_SEMICOLON = "import { checkApiAuth } from '@/lib/api-auth';";
const AUTH_IMPORT_NO_SEMICOLON = "import { checkApiAuth } from '@/lib/api-auth'";

const AUTH_CHECK_BLOCK = `  // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

`;

// All 78 routes to protect (Tier 1: PII+DESTRUCTIVE first, then Tier 2+3)
const ROUTES = [
  // ═══ Tier 1: PII (23 files) ═══
  'src/app/api/contacts/route.ts',
  'src/app/api/contacts/[id]/route.ts',
  'src/app/api/contacts/[id]/notes/route.ts',
  'src/app/api/contacts/[id]/timeline/route.ts',
  'src/app/api/contacts/person-profile/route.ts',
  'src/app/api/contacts/engagement-prediction/route.ts',
  'src/app/api/contacts/relationship-map/route.ts',
  'src/app/api/leads/route.ts',
  'src/app/api/leads/status/route.ts',
  'src/app/api/leads/consent/route.ts',
  'src/app/api/leads/assign/route.ts',
  'src/app/api/leads/dedup/route.ts',
  'src/app/api/leads/lookalike/route.ts',
  'src/app/api/leads/schedule-optimal/route.ts',
  'src/app/api/leads/source-stats/route.ts',
  'src/app/api/leads/recalculate-scores/route.ts',
  'src/app/api/bounces/route.ts',
  'src/app/api/duplicates/route.ts',
  'src/app/api/verify-email/route.ts',
  'src/app/api/suppressions/route.ts',
  'src/app/api/companies/[id]/contacts/route.ts',
  'src/app/api/segments/[id]/contacts/route.ts',
  'src/app/api/replies/route.ts',

  // ═══ Tier 1: DESTRUCTIVE (19 files) ═══
  'src/app/api/notes/route.ts',
  'src/app/api/templates/route.ts',
  'src/app/api/sequences/route.ts',
  'src/app/api/sequences/[id]/route.ts',
  'src/app/api/sequences/[id]/steps/[stepId]/route.ts',
  'src/app/api/capabilities/route.ts',
  'src/app/api/knowledge/[id]/route.ts',
  'src/app/api/opportunities/[id]/route.ts',
  'src/app/api/drafts/route.ts',
  'src/app/api/drafts/[id]/route.ts',
  'src/app/api/segments/route.ts',
  'src/app/api/playbooks/[id]/route.ts',
  'src/app/api/prompt-templates/[id]/route.ts',
  'src/app/api/companies/[id]/route.ts',
  'src/app/api/companies/[id]/notes/[noteId]/route.ts',
  'src/app/api/conversation-plans/[id]/route.ts',
  'src/app/api/companies/bulk/route.ts',

  // ═══ Tier 2: FINANCIAL (8 files) ═══
  'src/app/api/cro-dashboard/route.ts',
  'src/app/api/pipeline/health/route.ts',
  'src/app/api/pipeline/route.ts',
  'src/app/api/pipeline/forecast/route.ts',
  'src/app/api/revops/route.ts',
  'src/app/api/reports/revenue/route.ts',
  'src/app/api/reports/pipeline/route.ts',
  'src/app/api/sales-execution/route.ts',

  // ═══ Tier 2: INTERNAL (6 files) ═══
  'src/app/api/email-worker/route.ts',
  'src/app/api/verify-queue/process/route.ts',
  'src/app/api/verify-queue/route.ts',
  'src/app/api/demo/prepare/route.ts',

  // ═══ Tier 3: CRUD (17 files) ═══
  'src/app/api/learning/route.ts',
  'src/app/api/enterprise/route.ts',
  'src/app/api/knowledge/route.ts',
  'src/app/api/knowledge/ingest/route.ts',
  'src/app/api/knowledge/graph/route.ts',
  'src/app/api/opportunities/route.ts',
  'src/app/api/sequences/process/route.ts',
  'src/app/api/sequences/enroll/route.ts',
  'src/app/api/sequences/[id]/execute/route.ts',
  'src/app/api/capabilities/dedup-check/route.ts',
  'src/app/api/capabilities/[id]/children/route.ts',
  'src/app/api/capabilities/enrich/route.ts',
  'src/app/api/orchestration/route.ts',
  'src/app/api/fusion/route.ts',
  'src/app/api/team/performance/route.ts',
  'src/app/api/email-templates/route.ts',
  'src/app/api/email-templates/[id]/route.ts',

  // ═══ Tier 3: More CRUD ═══
  'src/app/api/analytics/route.ts',
  'src/app/api/queue/route.ts',
  'src/app/api/stats/route.ts',
  'src/app/api/reports/data-quality/route.ts',
  'src/app/api/reports/team-performance/route.ts',
  'src/app/api/dashboard/route.ts',
  'src/app/api/dashboard/stats/route.ts',
  'src/app/api/route.ts',
  'src/app/api/preferences/route.ts',
  'src/app/api/playbooks/route.ts',
  'src/app/api/prompt-templates/route.ts',
  'src/app/api/timeline/route.ts',
  'src/app/api/conversation-plans/route.ts',
  'src/app/api/realtime/route.ts',

  // ═══ Tier 3: Company sub-resources ═══
  'src/app/api/companies/route.ts',
  'src/app/api/companies/meta/route.ts',
  'src/app/api/companies/stats/route.ts',
  'src/app/api/companies/mind-map/route.ts',
  'src/app/api/companies/compare/route.ts',
  'src/app/api/companies/refresh-scores/route.ts',
  'src/app/api/companies/enrich/route.ts',
  'src/app/api/companies/[id]/notes/route.ts',
  'src/app/api/companies/[id]/actions/route.ts',
  'src/app/api/companies/[id]/alignment/route.ts',
  'src/app/api/companies/[id]/score/route.ts',
  'src/app/api/companies/[id]/timeline/route.ts',
  'src/app/api/companies/[id]/feedback/route.ts',
  'src/app/api/data-health/route.ts',
  'src/app/api/system-health/route.ts',
  'src/app/api/compliance/route.ts',
];

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
  // Detect whether file uses semicolons
  const hasSemicolons = content.match(/^import .+;/m) !== null;
  const authImport = hasSemicolons ? AUTH_IMPORT_SEMICOLON : AUTH_IMPORT_NO_SEMICOLON;

  // Find the last import line
  const importLines = content.match(/^import .+$/gm);
  if (!importLines || importLines.length === 0) {
    errors.push(`NO IMPORTS: ${relPath}`);
    continue;
  }

  const lastImportLine = importLines[importLines.length - 1];
  const lastImportIndex = content.lastIndexOf(lastImportLine);
  const afterLastImport = content.indexOf('\n', lastImportIndex) + 1;
  
  content = content.slice(0, afterLastImport) + authImport + '\n' + content.slice(afterLastImport);

  // ── Step 2: Insert auth check inside each handler function body ──
  // Find all exported handler functions
  const handlerRegex = /export async function (GET|POST|PUT|DELETE|PATCH)\s*\(/g;
  let match;
  const inserts = [];

  while ((match = handlerRegex.exec(content)) !== null) {
    const funcStart = match.index;
    
    // Find the function body opening brace by counting parens
    let parenDepth = 0;
    let bodyStart = -1;
    
    for (let i = funcStart; i < content.length; i++) {
      if (content[i] === '(') parenDepth++;
      else if (content[i] === ')') {
        parenDepth--;
        // After all params closed, look for the opening brace
        if (parenDepth === 0) {
          // Skip to the first '{' after closing paren (may include return type annotation)
          for (let j = i + 1; j < content.length; j++) {
            if (content[j] === '{') {
              bodyStart = j + 1;
              break;
            }
          }
          break;
        }
      }
    }
    
    if (bodyStart === -1) continue;
    
    // Skip whitespace after body start
    let insertPos = bodyStart;
    while (insertPos < content.length && (content[insertPos] === '\n' || content[insertPos] === ' ' || content[insertPos] === '\r' || content[insertPos] === '\t')) {
      insertPos++;
    }
    
    // Don't insert if auth is already here
    if (content.substring(insertPos, insertPos + 50).includes('checkApiAuth')) continue;
    
    inserts.push(insertPos);
  }

  // Apply inserts in reverse order
  for (let i = inserts.length - 1; i >= 0; i--) {
    const pos = inserts[i];
    content = content.slice(0, pos) + AUTH_CHECK_BLOCK + content.slice(pos);
  }

  fs.writeFileSync(fullPath, content, 'utf8');
  modified++;
}

console.log(`=== Batch 3 Auth Guard Injection Complete ===`);
console.log(`Modified: ${modified}`);
console.log(`Skipped (already has auth): ${skipped}`);
console.log(`Errors: ${errors.length}`);
if (errors.length > 0) {
  errors.forEach(e => console.log(`  ERROR: ${e}`));
}
