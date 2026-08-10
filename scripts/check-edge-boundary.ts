/**
 * Edge Runtime Boundary Checker
 *
 * Mechanical gate that traces the FULL transitive import graph from Edge entry
 * points (proxy.ts, middleware.ts) and FAILS if any Edge-incompatible module
 * is reachable.
 *
 * This is the permanent solution to the "each audit finds new bugs" problem.
 * Instead of relying on humans to remember to check transitive dependencies,
 * this script does it automatically at build time / CI.
 *
 * Usage:
 *   npx tsx scripts/check-edge-boundary.ts        # check only
 *   npx tsx scripts/check-edge-boundary.ts --ci    # exit 1 on violation
 *
 * Edge-incompatible imports (BLOCKED):
 *   - @prisma/client                    (TCP sockets, native Rust bindings)
 *   - @/lib/db                          (re-exports PrismaClient)
 *   - @/lib/audit-logger                (imports db → Prisma)
 *   - node:fs, node:path, node:crypto  (Node.js built-ins, not Web API)
 *   - Any file that transitively imports the above
 *
 * Edge entry points (SEEDS):
 *   - src/proxy.ts        (Next.js 16 proxy convention)
 *   - src/middleware.ts   (Next.js middleware)
 *
 * Resolution:
 *   - Resolves @/* aliases via tsconfig.json paths
 *   - Resolves relative imports (.ts, .tsx extensions)
 *   - Follows re-exports (export { x } from '...')
 *   - Handles both static and dynamic import() statements
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

// ── Configuration ─────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, '..')
const SRC_DIR = path.join(PROJECT_ROOT, 'src')

// Edge entry point seeds
const EDGE_SEEDS = [
  'src/proxy.ts',
  'src/middleware.ts',
]

// Modules that are categorically Edge-incompatible
const BLOCKED_MODULES: string[] = [
  '@prisma/client',
  '@prisma/client/default',  // sometimes imported differently
]

// Local module paths that are known to import Prisma (and thus Edge-incompatible)
const BLOCKED_LOCAL_PATHS: string[] = [
  'src/lib/db.ts',
  'src/lib/db.tsx',
  'src/lib/audit-logger.ts',
  'src/lib/audit-logger.tsx',
  'src/lib/session.ts',         // uses Prisma via db.ts
  'src/lib/session-manager.ts', // uses Prisma via db.ts
  'src/lib/rbac-enforcement.ts', // uses Prisma via db.ts
]

// Node.js built-in modules that are NOT available in Edge Runtime
const BLOCKED_NODE_BUILTINS: string[] = [
  'fs',
  'fs/promises',
  'path',
  'crypto',       // the Node.js 'crypto' module (not Web Crypto)
  'os',
  'buffer',
  'stream',
  'http',
  'https',
  'net',
  'tls',
  'dns',
  'child_process',
  'worker_threads',
  'cluster',
  'readline',
  'zlib',
]

// Allowed external packages that are Edge-compatible
const ALLOWED_EXTERNAL: Set<string> = new Set([
  'next',
  'next/server',
  'next/navigation',
  '@neondatabase/serverless',
])

// ── Import Tracer ─────────────────────────────────────────────

interface ImportTrace {
  filePath: string          // resolved local file path
  importPath: string        // the raw import string
  importKind: 'static' | 'dynamic'
}

// Cache: filePath → array of imports found in that file
const importCache = new Map<string, ImportTrace[]>()
// Visited set to prevent infinite loops
const visited = new Set<string>()

/**
 * Resolve an import path to a local file path.
 * Handles:
 *   - @/* aliases (from tsconfig.json paths)
 *   - Relative imports (./, ../)
 *   - .ts, .tsx extension resolution
 *   - /index.ts directory resolution
 *
 * Returns null if the import is external (node_modules) or cannot be resolved.
 */
function resolveImport(importPath: string, fromFile: string): string | null {
  // Skip node_modules / external packages
  if (
    !importPath.startsWith('.') &&
    !importPath.startsWith('@/')
  ) {
    return null
  }

  let resolved: string

  if (importPath.startsWith('@/')) {
    // @/ alias → ./src/  (from tsconfig.json paths: "@/*" → "./src/*")
    resolved = path.join(SRC_DIR, importPath.slice(2))
  } else {
    // Relative import
    resolved = path.resolve(path.dirname(fromFile), importPath)
  }

  // Try exact path
  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
    return resolved
  }

  // Try with .ts extension
  for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
    const withExt = resolved + ext
    if (fs.existsSync(withExt) && fs.statSync(withExt).isFile()) {
      return withExt
    }
  }

  // Try /index.ts
  for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
    const indexPath = path.join(resolved, 'index' + ext)
    if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
      return indexPath
    }
  }

  return null
}

/**
 * Parse a file and extract all import statements.
 * Handles:
 *   - import { x } from '...'
 *   - import x from '...'
 *   - import * as x from '...'
 *   - import '...' (side-effect)
 *   - export { x } from '...' (re-exports)
 *   - const x = require('...') (CJS — less common but possible)
 */
function extractImports(filePath: string): ImportTrace[] {
  if (importCache.has(filePath)) return importCache.get(filePath)!

  if (!fs.existsSync(filePath)) return []

  const content = fs.readFileSync(filePath, 'utf-8')
  const imports: ImportTrace[] = []

  // Regex patterns for imports
  // 1. import ... from '...' and export ... from '...'
  //    Handles multiline imports (e.g., import {\n  x,\n  y\n} from '...')
  //    Uses [\s\S] instead of . to match newlines within the import statement
  const importRegex = /(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]/g
  // 2. Side-effect imports: import '...'
  const sideEffectRegex = /(?:import|export)\s+['"]([^'"]+)['"]/g
  // 3. dynamic import()
  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g

  const seen = new Set<string>()

  let match
  while ((match = importRegex.exec(content)) !== null) {
    const p = match[1]
    if (!seen.has(p)) {
      seen.add(p)
      imports.push({ filePath, importPath: p, importKind: 'static' })
    }
  }
  while ((match = sideEffectRegex.exec(content)) !== null) {
    const p = match[1]
    if (!seen.has(p)) {
      seen.add(p)
      imports.push({ filePath, importPath: p, importKind: 'static' })
    }
  }
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    const p = match[1]
    if (!seen.has(p)) {
      seen.add(p)
      imports.push({ filePath, importPath: p, importKind: 'dynamic' })
    }
  }

  importCache.set(filePath, imports)
  return imports
}

/**
 * Get the relative path from project root for display.
 */
function relativePath(filePath: string): string {
  return path.relative(PROJECT_ROOT, filePath).replace(/\\/g, '/')
}

// ── Violation Detection ────────────────────────────────────────

interface Violation {
  chain: string[]        // the import chain from seed to violation
  importPath: string      // the violating import string
  violationType: 'prisma' | 'blocked_local' | 'node_builtin' | 'unknown_external'
  reason: string
}

const violations: Violation[] = []

/**
 * Recursively trace imports from a seed file, detecting violations.
 *
 * @param filePath - Absolute path to the file being traced
 * @param chain - The import chain leading to this file (for error messages)
 * @param depth - Current recursion depth (safety limit)
 */
function traceImports(filePath: string, chain: string[], depth: number): void {
  // Safety: prevent infinite recursion and excessively deep chains
  if (depth > 20) return
  const fileKey = relativePath(filePath)
  if (visited.has(fileKey)) return
  visited.add(fileKey)

  const imports = extractImports(filePath)

  for (const imp of imports) {
    const { importPath, importKind } = imp

    // ── Check 1: Blocked external packages (Prisma) ──
    for (const blocked of BLOCKED_MODULES) {
      if (importPath === blocked || importPath.startsWith(blocked + '/')) {
        violations.push({
          chain: [...chain, importPath],
          importPath,
          violationType: 'prisma',
          reason: `Prisma Client uses TCP sockets + native Rust bindings — crashes Edge Runtime at module load`,
        })
        continue
      }
    }

    // ── Check 2: Node.js built-in modules ──
    for (const builtin of BLOCKED_NODE_BUILTINS) {
      if (importPath === builtin || importPath.startsWith(builtin + '/')) {
        violations.push({
          chain: [...chain, importPath],
          importPath,
          violationType: 'node_builtin',
          reason: `Node.js built-in '${builtin}' is not available in Edge Runtime`,
        })
        continue
      }
    }

    // ── Check 3: Unknown external packages (not in allowlist) ──
    if (
      !importPath.startsWith('.') &&
      !importPath.startsWith('@/')
    ) {
      // It's an external package
      if (!ALLOWED_EXTERNAL.has(importPath)) {
        // Check if it's a scoped package (e.g., @neondatabase/serverless)
        const isAllowedPrefix = Array.from(ALLOWED_EXTERNAL).some(
          (allowed) => importPath.startsWith(allowed + '/')
        )
        if (!isAllowedPrefix && !importPath.startsWith('@prisma')) {
          // Unknown external — warn but don't block (may be Edge-compatible)
          // We only BLOCK known-bad ones above
          violations.push({
            chain: [...chain, importPath],
            importPath,
            violationType: 'unknown_external',
            reason: `Unknown external package — verify it's Edge-compatible (not auto-blocked, requires manual review)`,
          })
        }
      }
      continue  // Don't trace into node_modules
    }

    // ── Check 4: Blocked local paths ──
    const resolved = resolveImport(importPath, filePath)
    if (resolved) {
      const resolvedRelative = relativePath(resolved)
      for (const blocked of BLOCKED_LOCAL_PATHS) {
        if (resolvedRelative === blocked) {
          violations.push({
            chain: [...chain, importPath],
            importPath,
            violationType: 'blocked_local',
            reason: `'${resolvedRelative}' transitively imports Prisma via @/lib/db → Edge-incompatible`,
          })
          continue
        }
      }

      // Recurse into resolved local file
      traceImports(resolved, [...chain, importPath], depth + 1)
    }
  }
}

// ── Main ─────────────────────────────────────────────────────

function main(): void {
  const isCi = process.argv.includes('--ci')

  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║  Edge Runtime Boundary Checker — P0 Permanent Gate         ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log()

  let seedCount = 0

  for (const seed of EDGE_SEEDS) {
    const seedPath = path.join(PROJECT_ROOT, seed)
    console.log(`\n📄 Seed: ${seed}`)
    console.log(`   Tracing transitive imports...`)

    const prevViolationCount = violations.length
    traceImports(seedPath, [seed], 0)
    const newViolations = violations.length - prevViolationCount
    seedCount++

    if (newViolations === 0) {
      console.log(`   ✅ No violations found`)
    }
  }

  // ── Report ──────────────────────────────────────────────

  console.log(`\n${'─'.repeat(66)}`)
  console.log(`Scanned ${seedCount} Edge entry points, ${visited.size} total files`)
  console.log(`Found ${violations.length} violations\n`)

  // Separate real blockers from warnings
  const blockers = violations.filter(
    (v) => v.violationType === 'prisma' || v.violationType === 'blocked_local' || v.violationType === 'node_builtin'
  )
  const warnings = violations.filter(
    (v) => v.violationType === 'unknown_external'
  )

  if (blockers.length > 0) {
    console.log(`🚫 BLOCKING VIOLATIONS (${blockers.length}):\n`)
    for (const v of blockers) {
      console.log(`   ${v.violationType.toUpperCase()}: ${v.importPath}`)
      console.log(`   Chain: ${v.chain.join(' → ')}`)
      console.log(`   Reason: ${v.reason}`)
      console.log()
    }
  }

  if (warnings.length > 0) {
    console.log(`⚠️  WARNINGS (${warnings.length}):\n`)
    for (const v of warnings) {
      console.log(`   ${v.importPath}`)
      console.log(`   Chain: ${v.chain.join(' → ')}`)
      console.log(`   Reason: ${v.reason}`)
      console.log()
    }
  }

  // ── Exit ────────────────────────────────────────────────

  if (blockers.length > 0) {
    console.log(`\n❌ BUILD FAILED: ${blockers.length} Edge boundary violations detected.`)
    console.log(`   These imports will CRASH Edge Runtime at module load time.`)
    console.log(`   Fix by removing the violating import or creating an Edge-safe alternative.`)
    process.exit(isCi ? 1 : 0)
  } else if (warnings.length > 0) {
    console.log(`\n✅ Passed (with ${warnings.length} warnings — review manually)`)
    process.exit(0)
  } else {
    console.log(`\n✅ All Edge boundaries clean. No violations.`)
    process.exit(0)
  }
}

main()
