#!/usr/bin/env node
/**
 * Fix: Remove misplaced auth check from function parameter destructuring,
 * and insert it in the correct position (inside function body).
 */

const fs = require('fs');
const path = require('path');

const BASE = '/home/z/my-project';

// The misplaced auth block pattern (inside param destructuring)
const MISPLACED_AUTH = /  \/\/ ── Authentication Guard ──\n  const \{ errorResponse \} = await checkApiAuth\(\);\n  if \(errorResponse\) return errorResponse;\n\n/;

const AUTH_BLOCK = `  // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

`;

// Files with errors from tsc output
const FILES = [
  'src/app/api/ai/opportunities/[id]/accept/route.ts',
  'src/app/api/ai/opportunities/[id]/reject/route.ts',
  'src/app/api/companies/[id]/brief/route.ts',
  'src/app/api/companies/[id]/intelligence/route.ts',
  'src/app/api/companies/[id]/scores/route.ts',
  'src/app/api/companies/[id]/signals/[signalId]/route.ts',
  'src/app/api/companies/[id]/signals/route.ts',
  'src/app/api/contacts/[id]/briefing/route.ts',
  'src/app/api/contacts/[id]/generate-email/route.ts',
  'src/app/api/g-intel-acquisition/inbox/[id]/convert/route.ts',
  'src/app/api/g-intel-acquisition/inbox/[id]/dismiss/route.ts',
  'src/app/api/g-intel-acquisition/inbox/[id]/review/route.ts',
  'src/app/api/intelligence/action/[id]/route.ts',
  'src/app/api/intelligence/brief/[id]/route.ts',
  'src/app/api/intelligence/company/[id]/route.ts',
  'src/app/api/intelligence/conversation/[id]/route.ts',
  'src/app/api/intelligence/grounding/[id]/route.ts',
  'src/app/api/intelligence/knowledge/[id]/route.ts',
  'src/app/api/intelligence/mindmap/[id]/route.ts',
  'src/app/api/intelligence/opportunity/[id]/route.ts',
  'src/app/api/intelligence/reasoning/[id]/route.ts',
  'src/app/api/intelligence/retrieval/[id]/route.ts',
  'src/app/api/signals/[id]/evidence/route.ts',
];

let fixed = 0;

for (const relPath of FILES) {
  const fullPath = path.join(BASE, relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`SKIP (missing): ${relPath}`);
    continue;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  const original = content;

  // Check if the misplaced auth block exists
  if (!MISPLACED_AUTH.test(content)) {
    console.log(`SKIP (no misplaced auth): ${relPath}`);
    continue;
  }

  // Remove the misplaced auth block
  content = content.replace(MISPLACED_AUTH, '');

  // Now find the function body opening and insert auth there
  // Pattern: export async function METHOD(\n  ...\n) {\n  or export async function METHOD(\n  ...\n): ReturnType {\n
  // We need to find the FIRST opening brace that starts the function body
  // after removing the misplaced auth, the structure should be:
  // export async function GET(
  //   request: NextRequest,
  //   { params }: { params: Promise<{ id: string }> }
  // ) {
  //   <--- INSERT HERE
  
  // Find all 'export async function' declarations
  const funcRegex = /export async function (GET|POST|PUT|DELETE|PATCH)\s*\([^)]*\)\s*(\)?\s*:?\s*\w[\w<>\[\]]*\s*)?\{/g;
  // This won't work for multi-line params. Let me use a different approach.
  
  // Find function declarations and their body start
  let offset = 0;
  let match;
  const funcStartRegex = /export async function (GET|POST|PUT|DELETE|PATCH)\s*\(/g;
  const positions = [];
  
  while ((match = funcStartRegex.exec(content)) !== null) {
    positions.push(match.index);
  }
  
  // For each function, find where the body actually starts
  // by counting braces
  for (const funcStart of positions) {
    // Find the first '{' after function start that is the body opening
    let braceCount = 0;
    let bodyStart = -1;
    let parenCount = 0;
    
    for (let i = funcStart; i < content.length; i++) {
      const ch = content[i];
      if (ch === '(') parenCount++;
      else if (ch === ')') parenCount--;
      else if (ch === '{' && parenCount <= 0) {
        bodyStart = i + 1;
        break;
      }
    }
    
    if (bodyStart === -1) continue;
    
    // Skip whitespace/newline after body start
    let insertPos = bodyStart;
    while (insertPos < content.length && (content[insertPos] === '\n' || content[insertPos] === ' ' || content[insertPos] === '\r')) {
      insertPos++;
    }
    
    // Don't insert if auth is already here
    if (content.substring(insertPos, insertPos + 10).includes('checkApiAuth')) continue;
    
    // Insert auth block
    content = content.slice(0, insertPos) + AUTH_BLOCK + content.slice(insertPos);
  }
  
  if (content !== original) {
    fs.writeFileSync(fullPath, content, 'utf8');
    fixed++;
    console.log(`FIXED: ${relPath}`);
  } else {
    console.log(`UNCHANGED: ${relPath}`);
  }
}

console.log(`\n=== Fix Complete: ${fixed} files fixed ===`);
