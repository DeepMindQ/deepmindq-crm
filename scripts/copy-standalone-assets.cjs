#!/usr/bin/env node
/**
 * Copy static assets into .next/standalone for self-hosted deployments (Render, Docker).
 *
 * Pure Node.js implementation — no shell commands (cp, rsync) needed.
 * Vercel handles this automatically — this script is for self-hosted only.
 *
 * Usage: node scripts/copy-standalone-assets.cjs
 */

const path = require('path');
const fs = require('fs');

const standaloneDir = path.resolve('.next', 'standalone');

if (!fs.existsSync(standaloneDir)) {
  console.log('  .next/standalone not found — skipping (not a standalone build or Vercel deployment)');
  process.exit(0);
}

function copyDirRecursive(src, dst) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(dst, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  let count = 0;
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      count += copyDirRecursive(srcPath, dstPath) ? 1 : 0;
    } else {
      fs.copyFileSync(srcPath, dstPath);
      count++;
    }
  }
  return count > 0;
}

function copyDir(srcRel, dstRel, label) {
  const src = path.resolve(srcRel);
  const dst = path.resolve(standaloneDir, dstRel);
  if (!fs.existsSync(src)) {
    console.log(`  [skip] ${label} — source not found (${srcRel})`);
    return;
  }
  const start = Date.now();
  copyDirRecursive(src, dst);
  console.log(`  [copy] ${label} → ${dstRel} (${Date.now() - start}ms)`);
}

console.log('Copying standalone assets...');

// 1. .next/static → .next/standalone/.next/static
copyDir('.next/static', '.next/static', 'Static assets');

// 2. public → .next/standalone/public
copyDir('public', 'public', 'Public dir');

// 3. .z-ai-config if present
if (fs.existsSync(path.resolve('.z-ai-config'))) {
  const dst = path.join(standaloneDir, '.z-ai-config');
  fs.copyFileSync(path.resolve('.z-ai-config'), dst);
  console.log('  [copy] .z-ai-config');
}

console.log('  Done.');
