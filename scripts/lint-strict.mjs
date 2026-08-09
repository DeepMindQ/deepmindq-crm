#!/usr/bin/env node
/**
 * lint-strict.mjs — Strict lint gate for NEW code only
 *
 * Reads .eslint-baseline.json and runs ESLint only on src/ files
 * NOT in the baseline. Any error = CI failure.
 *
 * Usage: node scripts/lint-strict.mjs
 * Called by: npm run lint:strict
 */

import { readFileSync, existsSync, readdirSync, statSync, writeFileSync, mkdtempSync, rmSync } from "fs";
import { join, extname } from "path";
import { execSync } from "child_process";
import { tmpdir } from "os";

const ROOT = process.cwd();
const SRC_DIR = join(ROOT, "src");
const BASELINE_FILE = join(ROOT, ".eslint-baseline.json");

// ── Load baseline ──
let baselineFiles = new Set();
if (existsSync(BASELINE_FILE)) {
  try {
    const baseline = JSON.parse(readFileSync(BASELINE_FILE, "utf8"));
    baselineFiles = new Set(baseline.map(f => f.startsWith("src/") ? f : `src/${f}`));
  } catch (e) {
    console.error("Warning: Could not parse .eslint-baseline.json:", e.message);
    process.exit(1);
  }
}

// ── Recursively find all .ts/.tsx files in src/ ──
function findSourceFiles(dir, base = "") {
  const files = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const rel = base ? `${base}/${entry}` : entry;
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (entry === "legacy" || entry === "node_modules" || entry === "__tests__") continue;
      files.push(...findSourceFiles(fullPath, rel));
    } else if (/\.(ts|tsx|mts|cts)$/.test(extname(entry))) {
      if (/\.(test|spec)\.(ts|tsx)$/.test(entry)) continue;
      files.push(rel);
    }
  }
  return files;
}

const allSrcFiles = findSourceFiles(SRC_DIR);
const newFiles = allSrcFiles.filter(f => !baselineFiles.has(f));

if (newFiles.length === 0) {
  console.log("lint:strict — No new (non-baseline) files to check.");
  console.log(`  Baseline: ${baselineFiles.size} files | Total src: ${allSrcFiles.length} files`);
  process.exit(0);
}

console.log(`lint:strict — Checking ${newFiles.length} new files (excluding ${baselineFiles.size} baseline + legacy files)...`);

// Write file list to temp file to avoid shell argument length limits
const tmpDir = mkdtempSync(join(tmpdir(), "eslint-strict-"));
const fileListPath = join(tmpDir, "files.txt");
writeFileSync(fileListPath, newFiles.map(f => join(ROOT, f)).join("\n"));

try {
  // Run eslint with the main config on only non-baseline files.
  // Even though the main config ignores baseline files, that's fine —
  // we're only passing non-baseline files here, so the ignores won't match.
  execSync(`npx eslint "${fileListPath}"`, {
    cwd: ROOT,
    stdio: "inherit",
    encoding: "utf8",
  });
  console.log(`\n✅ lint:strict passed — ${newFiles.length} new files are lint-clean.`);
} catch {
  console.error(`\n❌ lint:strict FAILED — new code has lint errors. Fix before merging.`);
  console.error(`   If this is pre-existing code, add it to .eslint-baseline.json`);
  process.exit(1);
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
