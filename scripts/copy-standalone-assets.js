#!/usr/bin/env node
/**
 * Copy static assets into .next/standalone for self-hosted deployments.
 * Vercel handles this automatically — this script is for Docker/self-hosted only.
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const standaloneDir = path.join('.next', 'standalone');

if (!fs.existsSync(standaloneDir)) {
  console.warn('⚠ .next/standalone not found — skipping asset copy (Vercel handles this automatically)');
  process.exit(0);
}

try {
  // Copy .next/static → .next/standalone/.next/static
  const staticSrc = path.join('.next', 'static');
  const staticDst = path.join(standaloneDir, '.next', 'static');
  if (fs.existsSync(staticSrc)) {
    execSync(`cp -r "${staticSrc}" "${staticDst}"`, { stdio: 'pipe' });
    console.log('✓ Static assets copied to standalone');
  }

  // Copy public → .next/standalone/public
  const publicSrc = 'public';
  const publicDst = path.join(standaloneDir, 'public');
  if (fs.existsSync(publicSrc)) {
    execSync(`cp -r "${publicSrc}" "${publicDst}"`, { stdio: 'pipe' });
    console.log('✓ Public dir copied to standalone');
  }

  // Copy .z-ai-config if present
  if (fs.existsSync('.z-ai-config')) {
    execSync(`cp .z-ai-config "${path.join(standaloneDir, '.z-ai-config')}"`, { stdio: 'pipe' });
    console.log('✓ .z-ai-config copied to standalone');
  }
} catch (err) {
  console.error('✗ Asset copy failed:', err.message);
  process.exit(1);
}
