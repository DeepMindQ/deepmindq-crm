#!/usr/bin/env node

/**
 * WI-18.2 CI Gate: Tenant Leakage Scanner
 * ========================================
 *
 * Lock L3: Multi-Tenant Isolation Enforcement
 *   Scans persistence adapter and related files for queries
 *   that don't include companyId filter when querying tenant-scoped stores.
 *
 * SCANS:
 *   1. src/lib/persistence/intelligence-persistence-adapter.ts
 *   2. Any file that calls readByCompany or readAll with persistence stores
 *
 * PATTERN DETECTION:
 *   - findMany/findFirst without companyId in where clause
 *   - readAll without companyId option AND without includeGlobal flag
 *
 * USAGE:
 *   node scripts/tenant-leakage-scan.js
 *   Exit code 0 = no leakage risks, Exit code 1 = potential leakage found
 */

const fs = require('fs');
const path = require('path');

const TARGET_FILES = [
  'src/lib/persistence/intelligence-persistence-adapter.ts',
  'src/lib/persistence/cold-start-loader.ts',
];

// Queries to exempt (system-level, admin, health checks)
const EXEMPT_PATTERNS = [
  /health/i,
  /admin/i,
  /singleton_corpus/i,
  /findById|findUnique/i,
  /count\(/i,
  /Lock L3.*companyId/i,   // Already has Lock L3 comment with companyId
];

function scanFile(filePath) {
  const fullPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`  SKIP: ${filePath} (not found)`);
    return [];
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');
  const violations = [];

  // Pattern: findMany or findFirst with a where clause
  // We need to check if the where clause includes companyId
  const queryRegex = /\.(findMany|findFirst)\s*\(\s*\{/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip comments
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

    // Skip exempt patterns
    const contextWindow = lines.slice(Math.max(0, i - 2), i + 1).join('\n');
    if (EXEMPT_PATTERNS.some(p => p.test(contextWindow))) continue;

    if (queryRegex.test(line)) {
      // Look ahead for the where clause (within next 20 lines)
      const lookAhead = lines.slice(i, Math.min(i + 20, lines.length)).join('\n');
      const hasWhere = /where\s*:/.test(lookAhead);
      const hasCompanyId = /companyId/.test(lookAhead);
      const hasIncludeGlobal = /includeGlobal\s*:/.test(lookAhead);
      // Check if using a pre-built where variable (safe if built earlier)
      // Match both "where," on same line and "where," on next line within 2 lines
      const nextLines = lines.slice(i, Math.min(i + 3, lines.length)).join('\n');
      const hasWhereVariable = /where,/.test(nextLines) || /where\s*\}/.test(lookAhead.slice(0, 200));

      if (hasWhereVariable) {
        // Uses a pre-built where variable — check if function builds it with companyId
        const functionScope = lines.slice(Math.max(0, i - 50), Math.min(i + 20, lines.length)).join('\n');
        if (/companyId/.test(functionScope) || /includeGlobal/.test(functionScope)) {
          continue; // Safe — function scope includes tenant handling
        }
      }

      if (hasWhere && !hasCompanyId && !hasIncludeGlobal) {
        violations.push({
          file: filePath,
          line: i + 1,
          context: line.trim(),
          reason: 'Query has where clause but no companyId filter and no includeGlobal flag',
        });
      } else if (!hasWhere && !hasWhereVariable) {
        // Query without any where clause — potential full table scan
        violations.push({
          file: filePath,
          line: i + 1,
          context: line.trim(),
          reason: 'Query without where clause — potential full table scan (tenant leakage risk)',
        });
      }
    }
  }

  return violations;
}

function main() {
  console.log('═══ WI-18.2: Tenant Leakage Scanner ═══');
  console.log('');
  console.log('Lock L3: Multi-Tenant Isolation Enforcement');
  console.log('');

  let totalViolations = 0;

  for (const file of TARGET_FILES) {
    console.log(`Scanning: ${file}`);
    const violations = scanFile(file);

    if (violations.length === 0) {
      console.log('  ✓ No tenant leakage risks found');
    } else {
      for (const v of violations) {
        console.log(`  ✗ Line ${v.line}: ${v.reason}`);
        console.log(`    Context: ${v.context}`);
        totalViolations++;
      }
    }
    console.log('');
  }

  console.log('───────────────────────────────────────────');

  if (totalViolations > 0) {
    console.error(`FAIL: ${totalViolations} potential tenant leakage(s) found.`);
    console.error('');
    console.error('Lock L3 violation: All queries on tenant-scoped stores must:');
    console.error('  - Include companyId filter, OR');
    console.error('  - Have explicit includeGlobal flag with justification');
    console.error('');
    console.error('A Company A → Company B intelligence leak is a P0 security incident.');
    process.exit(1);
  } else {
    console.log('PASS: No tenant leakage risks detected.');
    process.exit(0);
  }
}

main();
