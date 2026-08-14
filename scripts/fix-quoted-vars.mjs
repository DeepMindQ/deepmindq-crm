#!/usr/bin/env node
// Fix: CSS variable references in JSX style={{}} need to be quoted strings
// This script finds unquoted var() references in style attributes and wraps them

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENS_DIR = path.join(__dirname, '..', 'src', 'components', 'screens');
const ENTERPRISE_DIR = path.join(__dirname, '..', 'src', 'components', 'enterprise');

let totalFixes = 0;
let filesModified = 0;

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;

  // Fix pattern: background: var(--ios-bg-primary) -> background: 'var(--ios-bg-primary)'
  // This pattern catches CSS variables used as JSX style values without quotes
  const unquotedVarPattern = /: (var\(--[a-zA-Z0-9-]+\))/g;
  content = content.replace(unquotedVarPattern, (match, varRef) => {
    totalFixes++;
    return `: '${varRef}'`;
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    filesModified++;
    const relPath = path.relative(path.join(__dirname, '..'), filePath);
    console.log(`  ✅ ${relPath}`);
  }
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      fixFile(fullPath);
    }
  }
}

console.log('🔧 Fixing unquoted CSS variable references in JSX...');
walkDir(SCREENS_DIR);
walkDir(ENTERPRISE_DIR);

console.log('');
console.log(`📊 Fixed ${totalFixes} unquoted var() references in ${filesModified} files`);
