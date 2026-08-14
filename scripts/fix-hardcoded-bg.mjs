#!/usr/bin/env node
// Bulk-replace hardcoded dark background colors with CSS variable references
// across all screen files in src/components/screens/

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENS_DIR = path.join(__dirname, '..', 'src', 'components', 'screens');

// Color mappings: hardcoded hex -> CSS variable
const COLOR_MAP = {
  // Page/screen container backgrounds (#0a0e17)
  // Pattern: style={{ background: '#0a0e17', minHeight: '100%' }}
  "'#0a0e17'": 'var(--ios-bg-primary)',

  // Card/modal/panel backgrounds (#0d1117)
  // Pattern: style={{ background: '#0d1117', ... }}
  "'#0d1117'": 'var(--ios-bg-card)',

  // Intelligence Hub inline constants
  "bg: '#0B0F19'": 'bg: "var(--ios-bg-primary)"',
  "bgCard: '#111827'": 'bgCard: "var(--ios-bg-card)"',
};

let totalReplacements = 0;
let filesModified = 0;

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;
  let fileReplacements = 0;

  for (const [search, replace] of Object.entries(COLOR_MAP)) {
    const occurrences = content.split(search).length - 1;
    if (occurrences > 0) {
      content = content.split(search).join(replace);
      fileReplacements += occurrences;
      totalReplacements += occurrences;
    }
  }

  if (fileReplacements > 0) {
    fs.writeFileSync(filePath, content, 'utf-8');
    filesModified++;
    const relPath = path.relative(path.join(__dirname, '..'), filePath);
    console.log(`  ✅ ${relPath}: ${fileReplacements} replacement(s)`);
  }
}

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

console.log('🔧 Replacing hardcoded backgrounds with CSS variables...');
console.log('');

walkDir(SCREENS_DIR);

console.log('');
console.log(`📊 Summary: ${totalReplacements} replacements across ${filesModified} files`);
