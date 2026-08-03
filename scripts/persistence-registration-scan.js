#!/usr/bin/env node

/**
 * WI-18.2 CI Gate: Persistence Registration Scanner
 * =================================================
 *
 * Lock L1: Contract Lock Enforcement
 *   Fails if new Tier-1 stateful Maps are introduced without
 *   persistence registration in persistence-registry.ts.
 *
 * SCANS:
 *   1. All known Tier-1 AI source files for Map declarations.
 *   2. Cross-references against PERSISTENCE_REGISTRY entries.
 *   3. Fails if a Map exists in a Tier-1 file but is NOT registered.
 *
 * USAGE:
 *   node scripts/persistence-registration-scan.js
 *   Exit code 0 = all registered, Exit code 1 = unregistered Maps found
 */

const fs = require('fs');
const path = require('path');

const TIER1_SOURCE_FILES = [
  'src/lib/ai-knowledge-graph.ts',
  'src/lib/ai-memory.ts',
  'src/lib/ai-hybrid-retrieval.ts',
];

// Maps that are LOCAL/request-scoped (not module-level singletons) and
// do NOT need persistence registration. These are created per-function-call.
const EXEMPT_MAP_NAMES = new Set([
  'nodeIdMap',         // Local to resolveNodes() in ai-knowledge-graph.ts
  'tf',               // Local to computeTermFrequencies() in ai-hybrid-retrieval.ts
  'resultLookup',     // Local to fuseSignals() in ai-hybrid-retrieval.ts
  'signalResults',    // Local to fuseSignals() in ai-hybrid-retrieval.ts
  'weightedSignalResults', // Local to fuseSignals() in ai-hybrid-retrieval.ts
]);

const REGISTRY_FILE = 'src/lib/persistence/persistence-registry.ts';

// Parse registered Map names from the registry file
function parseRegistryRegistrations() {
  const registryPath = path.resolve(process.cwd(), REGISTRY_FILE);
  if (!fs.existsSync(registryPath)) {
    console.error(`ERROR: Registry file not found: ${REGISTRY_FILE}`);
    process.exit(1);
  }

  const content = fs.readFileSync(registryPath, 'utf-8');

  // Extract mapName values from registry entries
  const mapNames = new Set();
  const mapNameRegex = /mapName:\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = mapNameRegex.exec(content)) !== null) {
    mapNames.add(match[1]);
  }

  return mapNames;
}

// Find all Map declarations in a file
function findMapsInFile(filePath) {
  const fullPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`  SKIP: ${filePath} (not found)`);
    return [];
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const maps = [];

  // Match: const/var/let variableName = new Map<...
  const mapRegex = /(?:const|let|var)\s+(\w+)\s*=\s*new\s*Map(?:<[^>]*>)?\s*\(/g;
  let match;
  while ((match = mapRegex.exec(content)) !== null) {
    maps.push({
      name: match[1],
      line: content.substring(0, match.index).split('\n').length,
    });
  }

  return maps;
}

// Main scan
function main() {
  console.log('═══ WI-18.2: Persistence Registration Scanner ═══');
  console.log('');

  const registeredMaps = parseRegistryRegistrations();
  console.log(`Registered Maps: ${registeredMaps.size}`);
  for (const name of registeredMaps) {
    console.log(`  ✓ ${name}`);
  }
  console.log('');

  let violations = 0;

  for (const file of TIER1_SOURCE_FILES) {
    console.log(`Scanning: ${file}`);
    const maps = findMapsInFile(file);

    for (const map of maps) {
      if (registeredMaps.has(map.name)) {
        console.log(`  ✓ ${map.name} (line ${map.line}) — registered`);
      } else if (EXEMPT_MAP_NAMES.has(map.name)) {
        console.log(`  ~ ${map.name} (line ${map.line}) — exempt (request-scoped)`);
      } else {
        console.log(`  ✗ ${map.name} (line ${map.line}) — NOT REGISTERED`);
        violations++;
      }
    }

    if (maps.length === 0) {
      console.log(`  (no Maps found)`);
    }
    console.log('');
  }

  console.log('───────────────────────────────────────────');

  if (violations > 0) {
    console.error(`FAIL: ${violations} unregistered Tier-1 Map(s) found.`);
    console.error('');
    console.error('Lock L1 violation: All Tier-1 Maps must be registered in');
    console.error(`  ${REGISTRY_FILE}`);
    console.error('');
    console.error('Register new Maps before merging. See PERSISTENCE_REGISTRY type.');
    process.exit(1);
  } else {
    console.log('PASS: All Tier-1 Maps are registered.');
    process.exit(0);
  }
}

main();
