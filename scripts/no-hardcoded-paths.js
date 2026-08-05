#!/usr/bin/env node
/**
 * Hardcoded Environment Path Scanner
 *
 * Scans the codebase for machine-specific absolute paths that would
 * work locally but fail in CI (GitHub Actions) or other environments.
 *
 * This runs as both:
 *   1. A standalone script: node scripts/no-hardcoded-paths.js
 *   2. A CI job step in .github/workflows/ci.yml
 *
 * Blocked patterns: /home/z/, /home/runner/, /Users/, /private/
 * Scan targets: tests/, src/, .github/
 * Note: scripts/ is excluded (ESLint covers new code via no-hardcoded-env-paths rule)
 *
 * Exit code: 0 = no violations, 1 = violations found
 */

const fs = require("fs");
const path = require("path");

// ── Configuration ──
const BLOCKED_PATTERNS = [
  /\/home\/z\//,       // Local dev environment
  /\/home\/runner\//,  // GitHub Actions runner (future-proofing)
  /\/Users\//,         // macOS user directories
  /\/private\//,       // macOS system paths
];

// Directories to scan — CI-relevant source code
// scripts/ is excluded: it contains one-time utility scripts,
// and ESLint already blocks hardcoded paths in new code.
const SCAN_DIRS = ["tests", "src", ".github"];

// File extensions to scan
const SCAN_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".sh", ".yml", ".yaml"];

// Files/patterns to exclude
const EXCLUDE_PATTERNS = [
  "node_modules",
  ".next",
  "coverage",
  "test-results",
  "playwright-report",
  "error-snapshots",
  "baseline-v2.json",
  "no-hardcoded-paths.js",
  "ci-local.sh",           // Contains /tmp/ for tee — acceptable
  "scripts/archive",            // Archived legacy code
  "scripts/batch",             // One-time batch migration scripts
  "scripts/fix-",              // One-time fix scripts
];

let violationCount = 0;
const violations = [];

function shouldScan(filePath) {
  // Check extension
  const ext = path.extname(filePath);
  if (!SCAN_EXTENSIONS.includes(ext)) return false;

  // Check exclusions
  for (const pattern of EXCLUDE_PATTERNS) {
    if (filePath.includes(pattern)) return false;
  }

  return true;
}

function scanFile(filePath) {
  if (!shouldScan(filePath)) return;

  let content;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return; // Skip unreadable files
  }

  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    for (const pattern of BLOCKED_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        const matchedPath = match[0];

        // Allow in comments (lines starting with //, #, or /*)
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("/*")) {
          continue;
        }

        // Allow if the path is part of an exclusion context
        const isExcluded = EXCLUDE_PATTERNS.some(ep => line.includes(ep));
        if (isExcluded) continue;

        violationCount++;
        violations.push({
          file: filePath,
          line: lineNum,
          pattern: matchedPath,
          content: trimmed.substring(0, 120),
        });
      }
    }
  }
}

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip excluded directories
      if (EXCLUDE_PATTERNS.some(ep => entry.name.includes(ep))) continue;
      scanDir(fullPath);
    } else if (entry.isFile()) {
      scanFile(fullPath);
    }
  }
}

// ── Main ──
const projectRoot = path.resolve(__dirname, "..");
console.log("Scanning for hardcoded environment paths...");
console.log(`Patterns: ${BLOCKED_PATTERNS.map(p => p.source).join(", ")}`);
console.log(`Directories: ${SCAN_DIRS.join(", ")}`);
console.log("");

for (const dir of SCAN_DIRS) {
  scanDir(path.join(projectRoot, dir));
}

if (violationCount > 0) {
  console.error(`\n❌ Found ${violationCount} hardcoded path violation(s):\n`);

  for (const v of violations) {
    const relFile = path.relative(projectRoot, v.file);
    console.error(`  ${relFile}:${v.line}`);
    console.error(`    Pattern: ${v.pattern}`);
    console.error(`    ${v.content}`);
    console.error("");
  }

  console.error(`Hardcoded environment paths will fail in CI.`);
  console.error(`Use __dirname, path.resolve(), or process.cwd() instead.`);
  console.error(`See docs/CI_RELIABILITY_GUIDE.md §3 for guidance.`);
  process.exit(1);
} else {
  console.log("✅ No hardcoded environment paths found.");
  process.exit(0);
}
