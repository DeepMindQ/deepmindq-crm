#!/usr/bin/env tsx
/**
 * findMany Migration Script — Phase 4 Hardening (Requirement #1)
 *
 * Scans all findMany calls in production-facing routes and lib files,
 * identifies unbounded queries (no `take`), and generates a migration report.
 *
 * Categories:
 *   - CRITICAL: Full table scans on user-facing routes
 *   - HIGH: Scoped but no take limit (can return thousands of rows)
 *   - INTERNAL: Cron/admin/background routes
 *   - SAFE: Config tables, already has take, uses safeFindMany/unsafeFindMany
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = path.resolve(__dirname, '../src');
const API_DIR = path.join(SRC_DIR, 'app/api');
const LIB_DIR = path.join(SRC_DIR, 'lib');

interface FindManyCall {
  file: string;
  line: number;
  model: string;
  hasTake: boolean;
  hasSkip: boolean;
  hasOrderBy: boolean;
  hasWhere: boolean;
  isCritical: boolean;
  category: 'CRITICAL' | 'HIGH' | 'INTERNAL' | 'SAFE' | 'LIB_CRITICAL' | 'LIB_HIGH';
  context: string;
  fixType: 'add_take' | 'add_take_order' | 'already_safe' | 'intentional_unbounded' | 'config_table';
}

function findFiles(dir: string, ext: string): string[] {
  const results: string[] = [];
  function walk(d: string) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        // Skip test directories
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
        walk(path.join(d, entry.name));
      } else if (entry.name.endsWith(ext)) {
        results.push(path.join(d, entry.name));
      }
    }
  }
  walk(dir);
  return results;
}

function parseFindMany(filePath: string): FindManyCall[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const calls: FindManyCall[] = [];

  // Check if file uses safeFindMany or unsafeFindMany
  const usesSafeHelpers = content.includes('safeFindMany') || content.includes('unsafeFindMany');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('findMany')) continue;
    if (line.includes('//') && line.indexOf('//') < line.indexOf('findMany')) continue;
    if (line.includes('safeFindMany') || line.includes('unsafeFindMany')) continue;

    // Extract model name
    const modelMatch = line.match(/db\.(\w+)\.findMany/);
    if (!modelMatch) continue;

    const model = modelMatch[1];
    const startLine = Math.max(0, i - 5);
    const endLine = Math.min(lines.length - 1, i + 15);
    const contextBlock = lines.slice(startLine, endLine + 1).join('\n');

    // Check for take, skip, orderBy in the block
    const hasTake = contextBlock.match(/\btake\s*:/) !== null || contextBlock.match(/\btake,/)?.length > 0;
    const hasSkip = contextBlock.match(/\bskip\s*:/) !== null;
    const hasOrderBy = contextBlock.match(/\borderBy\s*:/) !== null;
    const hasWhere = contextBlock.match(/\bwhere\s*:/) !== null;

    // Determine category
    const isApi = filePath.startsWith(API_DIR);
    const isCron = filePath.includes('/cron/');
    const isSeed = filePath.includes('/seed/');
    const isAdmin = filePath.includes('/admin/');

    // Config tables that rarely grow
    const configTables = [
      'columnMappingRule', 'fieldValidationRule', 'normalizationMapping',
      'scoringWeight', 'connector', 'segment', 'promptTemplate',
      'emailTemplate', 'customEmailTemplate', 'playbook', 'sequenceEnrollment',
    ];

    let category: FindManyCall['category'];
    let isCritical = false;

    if (configTables.includes(model)) {
      category = 'SAFE';
    } else if (isCron || isSeed) {
      category = 'INTERNAL';
    } else if (isApi && !hasTake) {
      if (!hasWhere) {
        category = 'CRITICAL';
        isCritical = true;
      } else {
        category = 'HIGH';
      }
    } else if (isApi && hasTake) {
      category = 'SAFE';
    } else if (!isApi && !hasTake) {
      // Lib file
      if (!hasWhere) {
        category = 'LIB_CRITICAL';
        isCritical = true;
      } else {
        category = 'LIB_HIGH';
      }
    } else {
      category = 'SAFE';
    }

    let fixType: FindManyCall['fixType'];
    if (category === 'SAFE' || category === 'INTERNAL') {
      fixType = category === 'SAFE' && configTables.includes(model) ? 'config_table' : 'intentional_unbounded';
    } else if (hasTake) {
      fixType = 'already_safe';
    } else if (!hasOrderBy) {
      fixType = 'add_take_order';
    } else {
      fixType = 'add_take';
    }

    calls.push({
      file: path.relative(SRC_DIR, filePath),
      line: i + 1,
      model,
      hasTake,
      hasSkip,
      hasOrderBy,
      hasWhere,
      isCritical,
      category,
      context: contextBlock.substring(0, 300),
      fixType,
    });
  }

  return calls;
}

function main() {
  console.log('=== findMany Migration Audit Report ===\n');

  const apiFiles = findFiles(API_DIR, '.ts');
  const libFiles = findFiles(LIB_DIR, '.ts');
  const allFiles = [...apiFiles, ...libFiles];

  const allCalls: FindManyCall[] = [];
  for (const file of allFiles) {
    const calls = parseFindMany(file);
    allCalls.push(...calls);
  }

  const critical = allCalls.filter(c => c.category === 'CRITICAL');
  const high = allCalls.filter(c => c.category === 'HIGH');
  const libCritical = allCalls.filter(c => c.category === 'LIB_CRITICAL');
  const libHigh = allCalls.filter(c => c.category === 'LIB_HIGH');
  const safe = allCalls.filter(c => c.category === 'SAFE');
  const internal = allCalls.filter(c => c.category === 'INTERNAL');

  console.log('Total findMany calls scanned:', allCalls.length);
  console.log('');
  console.log('CRITICAL (full table scan, user-facing):', critical.length);
  console.log('HIGH (scoped, no take, user-facing):', high.length);
  console.log('LIB_CRITICAL (full table scan, lib files):', libCritical.length);
  console.log('LIB_HIGH (scoped, no take, lib files):', libHigh.length);
  console.log('SAFE (already has take or config table):', safe.length);
  console.log('INTERNAL (cron/seed/admin):', internal.length);
  console.log('');

  // Detail critical issues
  if (critical.length > 0) {
    console.log('=== CRITICAL ISSUES ===');
    for (const c of critical) {
      console.log(`  ${c.file}:${c.line} — db.${c.model}.findMany — ${c.fixType}`);
    }
    console.log('');
  }

  if (high.length > 0) {
    console.log('=== HIGH PRIORITY ISSUES ===');
    for (const c of high.slice(0, 20)) {
      console.log(`  ${c.file}:${c.line} — db.${c.model}.findMany — ${c.fixType}`);
    }
    if (high.length > 20) console.log(`  ... and ${high.length - 20} more`);
    console.log('');
  }

  // Summary
  console.log('=== SUMMARY ===');
  const totalNeedingFix = critical.length + high.length + libCritical.length + libHigh.length;
  console.log(`Total needing migration: ${totalNeedingFix}`);
  console.log(`Already safe: ${safe.length}`);
  console.log(`Internal/cron (documented exceptions): ${internal.length}`);
}

main();
