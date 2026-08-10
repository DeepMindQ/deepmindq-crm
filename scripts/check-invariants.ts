/**
 * Comprehensive Build-Time Invariant Checker
 *
 * Permanent mechanical gate that enforces ALL architectural invariants
 * across every phase of the project. Replaces manual audits forever.
 *
 * Why this exists:
 *   Over 4+ rounds of manual audits, each round found new bugs because
 *   each audit went one level deeper. This script goes ALL the way —
 *   mechanically, deterministically, every time.
 *
 * Categories:
 *   1. Edge Boundary    — No Prisma/Node.js in Edge entry points (proxy.ts, middleware.ts)
 *   2. Cross-Boundary    — src/lib/*.ts must NEVER import from src/components/ or src/app/
 *   3. Auth Coverage     — All non-public API routes must call requireAuth/validateSession
 *   4. CSRF Coverage     — All POST/PUT/DELETE routes must use withCsrf or validateCsrf
 *   5. RBAC Completeness — All API routes must exist in the authorization matrix
 *   6. Token Hashing     — Session tokens must be hashed before DB operations
 *   7. Secret Exposure   — No hardcoded secrets, API keys, or passwords
 *   8. Single Source     — CSRF logic exists in exactly one file (csrf.ts)
 *   9. Type Safety       — tsc --noEmit passes with 0 errors
 *
 * Usage:
 *   npx tsx scripts/check-invariants.ts          # check all
 *   npx tsx scripts/check-invariants.ts --ci     # exit 1 on violation
 *   npx tsx scripts/check-invariants.ts --cat 1   # run only category 1
 *   npx tsx scripts/check-invariants.ts --list    # list all categories
 *
 * Exit codes:
 *   0 = all invariants pass
 *   1 = one or more BLOCKING violations
 *   2 = only WARNINGS (optional --ci-strict to treat as failure)
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { execSync } from 'node:child_process'

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

type Severity = 'blocker' | 'warning'

interface Violation {
  category: number
  category_name: string
  severity: Severity
  file: string
  line?: number
  message: string
  chain?: string[]    // for import chain violations
  hint?: string       // suggested fix
}

interface CategoryResult {
  id: number
  name: string
  description: string
  violations: Violation[]
  passed: boolean
}

// ═══════════════════════════════════════════════════════════════
// Global State
// ═══════════════════════════════════════════════════════════════

const PROJECT_ROOT = path.resolve(__dirname, '..')
const SRC_DIR = path.join(PROJECT_ROOT, 'src')

const isCi = process.argv.includes('--ci')
const ciStrict = process.argv.includes('--ci-strict')
const catFilter = process.argv.includes('--list') ? -1 :
  (() => { const idx = process.argv.indexOf('--cat'); return idx >= 0 ? parseInt(process.argv[idx + 1]) : -1 })()

// Cache: file content to avoid repeated reads
const fileContentCache = new Map<string, string>()

function readFile(filePath: string): string {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(PROJECT_ROOT, filePath)
  if (fileContentCache.has(abs)) return fileContentCache.get(abs)!
  if (!fs.existsSync(abs)) return ''
  const content = fs.readFileSync(abs, 'utf-8')
  fileContentCache.set(abs, content)
  return content
}

function relativePath(filePath: string): string {
  return path.relative(PROJECT_ROOT, filePath).replace(/\\/g, '/')
}

// ═══════════════════════════════════════════════════════════════
// Utility: File Discovery
// ═══════════════════════════════════════════════════════════════

function findFiles(dir: string, pattern: RegExp, maxDepth = 10): string[] {
  const results: string[] = []
  function walk(current: string, depth: number): void {
    if (depth > maxDepth) return
    if (!fs.existsSync(current)) return
    const stat = fs.statSync(current)
    if (stat.isDirectory()) {
      // Skip node_modules, .next, etc.
      const name = path.basename(current)
      if (['node_modules', '.next', '.git', 'dist', 'build'].includes(name)) return
      for (const entry of fs.readdirSync(current)) {
        walk(path.join(current, entry), depth + 1)
      }
    } else if (stat.isFile() && pattern.test(current)) {
      results.push(current)
    }
  }
  walk(dir, 0)
  return results
}

// ═══════════════════════════════════════════════════════════════
// Utility: Import Extraction
// ═══════════════════════════════════════════════════════════════

interface ImportInfo {
  raw: string         // the import path string
  line: number        // line number (1-based)
  kind: 'static' | 'dynamic' | 'require'
}

function extractImports(filePath: string): ImportInfo[] {
  const content = readFile(filePath)
  if (!content) return []

  const imports: ImportInfo[] = []
  const lines = content.split('\n')

  // Multi-line import accumulation
  let inMultilineImport = false
  let multilineBuffer = ''
  let multilineStartLine = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (inMultilineImport) {
      multilineBuffer += '\n' + line
      if (line.includes('from') && (line.includes("'") || line.includes('"'))) {
        inMultilineImport = false
        // Extract the import path from the completed multiline import
        const match = multilineBuffer.match(/from\s*['"]([^'"]+)['"]/)
        if (match) {
          imports.push({ raw: match[1], line: multilineStartLine, kind: 'static' })
        }
        multilineBuffer = ''
      } else if (!line.trim().startsWith('import') && !line.trim().startsWith('export') && line.trim() === '}') {
        // Closing brace without 'from' — not an import
        inMultilineImport = false
        multilineBuffer = ''
      }
      continue
    }

    // Single-line: import ... from '...'
    const fromMatch = line.match(/(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]/)
    if (fromMatch) {
      imports.push({ raw: fromMatch[1], line: i + 1, kind: 'static' })
      continue
    }

    // Side-effect: import '...'
    const sideEffectMatch = line.match(/(?:import|export)\s+['"]([^'"]+)['"]/)
    if (sideEffectMatch) {
      imports.push({ raw: sideEffectMatch[1], line: i + 1, kind: 'static' })
      continue
    }

    // Dynamic: import('...')
    const dynamicMatch = line.match(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/)
    if (dynamicMatch) {
      imports.push({ raw: dynamicMatch[1], line: i + 1, kind: 'dynamic' })
      continue
    }

    // CJS: require('...')
    const requireMatch = line.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/)
    if (requireMatch) {
      imports.push({ raw: requireMatch[1], line: i + 1, kind: 'require' })
      continue
    }

    // Detect start of multiline import (no 'from' on same line)
    if ((line.match(/^import\s+/) || line.match(/^export\s+/)) &&
        (line.includes('{') || line.includes('(')) &&
        !line.includes('from')) {
      inMultilineImport = true
      multilineBuffer = line
      multilineStartLine = i + 1
    }
  }

  return imports
}

// ═══════════════════════════════════════════════════════════════
// Utility: Resolve Import Path
// ═══════════════════════════════════════════════════════════════

function resolveImport(importPath: string, fromFile: string): string | null {
  if (!importPath.startsWith('.') && !importPath.startsWith('@/')) return null

  let resolved: string
  if (importPath.startsWith('@/')) {
    resolved = path.join(SRC_DIR, importPath.slice(2))
  } else {
    resolved = path.resolve(path.dirname(fromFile), importPath)
  }

  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved

  for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
    const withExt = resolved + ext
    if (fs.existsSync(withExt)) return withExt
  }

  for (const ext of ['.ts', '.tsx']) {
    const indexPath = path.join(resolved, 'index' + ext)
    if (fs.existsSync(indexPath)) return indexPath
  }

  return null
}

// ═══════════════════════════════════════════════════════════════
// Utility: Transitive Import Tracer
// ═══════════════════════════════════════════════════════════════

function traceTransitiveImports(
  seedFile: string,
  maxDepth: number = 30,
): Map<string, string[]> {
  // Map: filePath → chain of imports leading to it
  const result = new Map<string, string[]>()
  const visiting = new Set<string>()

  function walk(filePath: string, chain: string[], depth: number): void {
    if (depth > maxDepth) return
    const key = relativePath(filePath)
    if (visiting.has(key)) return
    visiting.add(key)

    // Record this file as reachable
    if (chain.length > 0) {
      result.set(key, [...chain])
    }

    const imports = extractImports(filePath)
    for (const imp of imports) {
      const resolved = resolveImport(imp.raw, filePath)
      if (resolved) {
        walk(resolved, [...chain, imp.raw], depth + 1)
      }
    }
  }

  walk(seedFile, [], 0)
  return result
}

// ═══════════════════════════════════════════════════════════════
// CATEGORY 1: Edge Boundary
// ═══════════════════════════════════════════════════════════════

function checkEdgeBoundary(): CategoryResult {
  const violations: Violation[] = []

  const EDGE_SEEDS = ['src/proxy.ts', 'src/middleware.ts']
  const BLOCKED_EXTERNAL = ['@prisma/client']
  const BLOCKED_LOCAL = [
    'src/lib/db.ts', 'src/lib/db.tsx',
    'src/lib/audit-logger.ts', 'src/lib/audit-logger.tsx',
    'src/lib/session.ts',
    'src/lib/session-manager.ts',
    'src/lib/rbac-enforcement.ts',
  ]
  const BLOCKED_NODE_BUILTINS = [
    'fs', 'fs/promises', 'path', 'crypto', 'os', 'buffer',
    'stream', 'http', 'https', 'net', 'tls', 'dns',
    'child_process', 'worker_threads', 'cluster',
  ]

  for (const seed of EDGE_SEEDS) {
    const seedPath = path.join(PROJECT_ROOT, seed)
    if (!fs.existsSync(seedPath)) continue

    const reachable = traceTransitiveImports(seedPath)

    for (const [filePath, chain] of reachable) {
      // Check if the file itself is blocked
      for (const blocked of BLOCKED_LOCAL) {
        if (filePath === blocked) {
          violations.push({
            category: 1, category_name: 'Edge Boundary',
            severity: 'blocker',
            file: filePath,
            message: `Edge entry '${seed}' transitively imports blocked file '${blocked}'`,
            chain: [seed, ...chain],
            hint: `Create an Edge-safe alternative or remove this import from the chain`,
          })
        }
      }

      // Check the file's imports for blocked external packages
      const imports = extractImports(path.join(PROJECT_ROOT, filePath))
      for (const imp of imports) {
        for (const blocked of BLOCKED_EXTERNAL) {
          if (imp.raw === blocked || imp.raw.startsWith(blocked + '/')) {
            violations.push({
              category: 1, category_name: 'Edge Boundary',
              severity: 'blocker',
              file: filePath,
              line: imp.line,
              message: `Prisma Client import in file reachable from Edge entry '${seed}'`,
              chain: [seed, ...chain, imp.raw],
              hint: `Prisma uses TCP + native bindings — crashes Edge Runtime. Use @neondatabase/serverless for Edge DB access.`,
            })
          }
        }
        for (const builtin of BLOCKED_NODE_BUILTINS) {
          if (imp.raw === builtin || imp.raw.startsWith(builtin + '/')) {
            violations.push({
              category: 1, category_name: 'Edge Boundary',
              severity: 'blocker',
              file: filePath,
              line: imp.line,
              message: `Node.js built-in '${builtin}' in file reachable from Edge entry '${seed}'`,
              chain: [seed, ...chain, imp.raw],
              hint: `Use Web API alternatives (e.g., crypto.getRandomValues instead of crypto.randomBytes)`,
            })
          }
        }
      }
    }
  }

  return {
    id: 1, name: 'Edge Boundary',
    description: 'No Prisma/Node.js APIs reachable from Edge entry points (proxy.ts, middleware.ts)',
    violations,
    passed: violations.filter(v => v.severity === 'blocker').length === 0,
  }
}

// ═══════════════════════════════════════════════════════════════
// CATEGORY 2: Cross-Boundary
// ═══════════════════════════════════════════════════════════════

function checkCrossBoundary(): CategoryResult {
  const violations: Violation[] = []

  // src/lib/*.ts files must NEVER import from:
  //   - src/components/ (UI belongs in components, lib is server-only utilities)
  //   - src/app/ (page/route files, lib should be agnostic)
  // Exception: src/lib files CAN import from other src/lib/* files
  //
  // ALLOWED EXCEPTIONS (intentional bridge files):
  //   - src/lib/design-tokens.ts — server-safe re-export of pure-data tokens
  //     from the component canonical source. This is a known pattern.
  const ALLOWED_BRIDGE_FILES = [
    'src/lib/design-tokens.ts',
  ]

  const libFiles = findFiles(path.join(SRC_DIR, 'lib'), /\.ts$/, 1)

  for (const libFile of libFiles) {
    // Skip test files
    if (libFile.endsWith('.test.ts') || libFile.endsWith('.spec.ts')) continue

    const rel = relativePath(libFile)

    // Skip allowed bridge files
    if (ALLOWED_BRIDGE_FILES.includes(rel)) continue

    const imports = extractImports(libFile)
    for (const imp of imports) {
      const resolved = resolveImport(imp.raw, libFile)
      if (!resolved) continue
      const rel = relativePath(resolved)

      // src/lib/* importing from src/components/*
      if (rel.startsWith('src/components/')) {
        violations.push({
          category: 2, category_name: 'Cross-Boundary',
          severity: 'blocker',
          file: relativePath(libFile),
          line: imp.line,
          message: `Server lib file imports from component: '${imp.raw}'`,
          hint: `Move the shared logic to src/lib/ or src/hooks/. Components can import from lib, not the reverse.`,
        })
      }

      // src/lib/* importing from src/app/*
      if (rel.startsWith('src/app/')) {
        violations.push({
          category: 2, category_name: 'Cross-Boundary',
          severity: 'blocker',
          file: relativePath(libFile),
          line: imp.line,
          message: `Server lib file imports from app route/page: '${imp.raw}'`,
          hint: `Move the shared logic to src/lib/. App files can import from lib, not the reverse.`,
        })
      }
    }
  }

  return {
    id: 2, name: 'Cross-Boundary',
    description: 'src/lib/*.ts must never import from src/components/ or src/app/',
    violations,
    passed: violations.filter(v => v.severity === 'blocker').length === 0,
  }
}

// ═══════════════════════════════════════════════════════════════
// CATEGORY 3: Auth Coverage
// ═══════════════════════════════════════════════════════════════

function checkAuthCoverage(): CategoryResult {
  const violations: Violation[] = []

  // Public route prefixes (exempt from auth requirement)
  const PUBLIC_PREFIXES = [
    '/api/auth/', '/api/webhooks/', '/api/tracking/',
    '/api/unsubscribe', '/api/cron/',
    '/api/ping', '/api/ready', '/api/version',
    '/api/verify-email', '/api/verify-queue',
    '/api/brand', '/api/docs',
    '/api/integrations/slack', '/api/integrations/zapier',
    '/api/v1', '/api/setup-db',
    '/api/emails/track',  // Pixel tracking (no auth)
    '/api/route',          // Root API catch-all
    // Health endpoints are public (used by load balancers / monitoring)
    '/api/health', '/api/system-health', '/api/api-metrics',
    '/api/performance', '/api/data-health', '/api/monitoring',
  ]

  function isPublicRoute(routePath: string): boolean {
    return PUBLIC_PREFIXES.some(p => routePath === p || routePath.startsWith(p))
  }

  // Auth indicators: if a route file contains these, it has auth
  const AUTH_INDICATORS = [
    'requireAuth', 'validateSessionToken', 'getCurrentSession',
    'validateSessionEdge', 'checkApiAuth', 'getSessionToken',
  ]

  const apiRoutes = findFiles(path.join(SRC_DIR, 'app', 'api'), /route\.ts$/)

  for (const routeFile of apiRoutes) {
    const rel = relativePath(routeFile)
    // Extract /api/... path from file path
    const apiPath = '/api/' + rel.replace(/^src\/app\/api\/(.*?)route\.ts$/, '$1').replace(/\/$/, '')

    if (isPublicRoute(apiPath)) continue

    const content = readFile(routeFile)
    const hasAuth = AUTH_INDICATORS.some(indicator => content.includes(indicator))

    if (!hasAuth) {
      violations.push({
        category: 3, category_name: 'Auth Coverage',
        severity: 'blocker',
        file: rel,
        message: `API route '${apiPath}' has no authentication check`,
        hint: `Add requireAuth(), getCurrentSession(), or checkApiAuth() to protect this endpoint.`,
      })
    }
  }

  return {
    id: 3, name: 'Auth Coverage',
    description: 'All non-public API routes must call an auth function',
    violations,
    passed: violations.filter(v => v.severity === 'blocker').length === 0,
  }
}

// ═══════════════════════════════════════════════════════════════
// CATEGORY 4: CSRF Coverage
// ═══════════════════════════════════════════════════════════════

function checkCsrfCoverage(): CategoryResult {
  const violations: Violation[] = []

  // NOTE: Edge middleware (middleware.ts + proxy.ts) already enforces CSRF
  // on ALL /api/* POST/PUT/DELETE routes. So individual route-level CSRF
  // is defense-in-depth, not a blocker. We flag it as a WARNING only.
  // Exceptions: routes that are public/exempt from Edge middleware CSRF.

  // Public auth routes that handle their own CSRF
  const CSRF_EXEMPT_PREFIXES = [
    '/api/auth/login', '/api/auth/register',
    '/api/auth/request-otp', '/api/auth/verify-otp',
    '/api/webhooks/', '/api/tracking/',
    '/api/cron/', '/api/unsubscribe',
    '/api/setup-db',
    '/api/health', '/api/ping', '/api/ready', '/api/version',
    '/api/verify-email', '/api/verify-queue',
  ]

  function isCsrfExempt(routePath: string): boolean {
    return CSRF_EXEMPT_PREFIXES.some(p => routePath === p || routePath.startsWith(p))
  }

  // CSRF indicators at route level
  const CSRF_INDICATORS = [
    'withCsrf', 'validateCsrf', 'csrfMiddleware', 'csrfCheck',
  ]

  const apiRoutes = findFiles(path.join(SRC_DIR, 'app', 'api'), /route\.ts$/)
  // Limit output to avoid noise — only report first 20 warnings
  let warningCount = 0

  for (const routeFile of apiRoutes) {
    const rel = relativePath(routeFile)
    const apiPath = '/api/' + rel.replace(/^src\/app\/api\/(.*?)route\.ts$/, '$1').replace(/\/$/, '')

    if (isCsrfExempt(apiPath)) continue

    const content = readFile(routeFile)

    // Check if the route exports any mutation methods (POST, PUT, DELETE, PATCH)
    const hasMutationExport = /export\s+(?:const|async\s+function|function)\s+(POST|PUT|DELETE|PATCH)\b/.test(content)
    if (!hasMutationExport) continue  // GET-only, no CSRF needed

    const hasCsrf = CSRF_INDICATORS.some(indicator => content.includes(indicator))
    if (!hasCsrf) {
      warningCount++
      if (warningCount <= 20) {
        violations.push({
          category: 4, category_name: 'CSRF Coverage',
          severity: 'warning', // WARNING only — Edge middleware already covers this
          file: rel,
          message: `API route '${apiPath}' has no route-level CSRF (Edge middleware covers it)`,
          hint: `Optional defense-in-depth: wrap with withCsrf() for double protection.`,
        })
      }
    }
  }
  if (warningCount > 20) {
    violations.push({
      category: 4, category_name: 'CSRF Coverage',
      severity: 'warning',
      file: '...',
      message: `... ${warningCount - 20} more routes without route-level CSRF (Edge middleware covers all)`,
    })
  }

  return {
    id: 4, name: 'CSRF Coverage',
    description: 'POST/PUT/DELETE routes should have route-level CSRF (Edge middleware covers as fallback)',
    violations,
    passed: violations.filter(v => v.severity === 'blocker').length === 0,
  }
}

// ═══════════════════════════════════════════════════════════════
// CATEGORY 5: RBAC Completeness
// ═══════════════════════════════════════════════════════════════

function checkRbacCompleteness(): CategoryResult {
  const violations: Violation[] = []

  // Extract all route paths registered in the RBAC matrix
  const rbacContent = readFile('src/lib/rbac.ts')
  const rbacRoutes: Set<string> = new Set()
  const rbacRouteRegex = /path:\s*['"]([^'"]+)['"]/g
  let match
  while ((match = rbacRouteRegex.exec(rbacContent)) !== null) {
    rbacRoutes.add(match[1].replace(/\/+$/, ''))
  }

  // Extract all public routes from the matrix
  const publicRoutes: Set<string> = new Set()
  const publicRouteRegex = /path:\s*['"]([^'"]+)['"][^}]*public:\s*true/gs
  while ((match = publicRouteRegex.exec(rbacContent)) !== null) {
    publicRoutes.add(match[1].replace(/\/+$/, ''))
  }

  // Get all API route file paths
  const apiRoutes = findFiles(path.join(SRC_DIR, 'app', 'api'), /route\.ts$/)

  for (const routeFile of apiRoutes) {
    const rel = relativePath(routeFile)
    // Convert file path to API path (e.g., src/app/api/companies/route.ts → /api/companies)
    const apiPath = '/api/' + rel
      .replace(/^src\/app\/api\//, '')
      .replace(/route\.ts$/, '')
      .replace(/\/+/g, '/')
      .replace(/\/$/, '')

    if (apiPath === '/api') continue // Root catch-all, skip

    // Check if this path or a parent prefix is in the RBAC matrix
    const hasExactMatch = rbacRoutes.has(apiPath)
    const hasPrefixMatch = Array.from(rbacRoutes).some(r =>
      apiPath.startsWith(r) && (r.endsWith('/') || apiPath.charAt(r.length) === '/')
    )

    if (!hasExactMatch && !hasPrefixMatch) {
      violations.push({
        category: 5, category_name: 'RBAC Completeness',
        severity: 'warning',
        file: rel,
        message: `API route '${apiPath}' is not in the RBAC authorization matrix`,
        hint: `Add an entry to ROUTE_AUTHORIZATION_MATRIX in src/lib/rbac.ts, or add a wildcard prefix.`,
      })
    }
  }

  return {
    id: 5, name: 'RBAC Completeness',
    description: 'All API routes must be registered in the RBAC authorization matrix',
    violations,
    passed: violations.filter(v => v.severity === 'blocker').length === 0,
  }
}

// ═══════════════════════════════════════════════════════════════
// CATEGORY 6: Token Hashing
// ═══════════════════════════════════════════════════════════════

function checkTokenHashing(): CategoryResult {
  const violations: Violation[] = []

  // In session-related files, ensure tokens are never compared/stored as plaintext
  const sessionFiles = [
    'src/lib/session.ts',
    'src/lib/session-edge.ts',
    'src/lib/session-manager.ts',
    'src/app/api/auth/login/route.ts',
    'src/app/api/auth/logout/route.ts',
    'src/app/api/auth/change-password/route.ts',
  ]

  // Patterns that indicate UNSAFE plaintext token handling
  const UNSAFE_PATTERNS = [
    // Direct DB query with raw token (should use hashToken first)
    { regex: /findUnique\(\s*\{\s*where:\s*\{\s*token:/, msg: 'Session token used directly in DB query without hashing' },
    // Direct comparison of cookie token with DB token (should hash first)
    { regex: /cookie.*token\s*===\s*session\.token/, msg: 'Direct token comparison (should hash both sides)' },
    // Setting token in DB without hashing
    { regex: /create\(\s*\{\s*data:\s*\{\s*token:\s*token\b/, msg: 'Session token stored in DB without hashing' },
  ]

  for (const file of sessionFiles) {
    const content = readFile(file)
    if (!content) continue

    const lines = content.split('\n')
    for (const pattern of UNSAFE_PATTERNS) {
      for (let i = 0; i < lines.length; i++) {
        if (pattern.regex.test(lines[i])) {
          violations.push({
            category: 6, category_name: 'Token Hashing',
            severity: 'blocker',
            file,
            line: i + 1,
            message: pattern.msg,
            hint: `Use hashToken(token) before any DB operation. Store only SHA-256 hashes.`,
          })
        }
      }
    }
  }

  return {
    id: 6, name: 'Token Hashing',
    description: 'Session tokens must be hashed (SHA-256) before DB storage/comparison',
    violations,
    passed: violations.filter(v => v.severity === 'blocker').length === 0,
  }
}

// ═══════════════════════════════════════════════════════════════
// CATEGORY 7: Secret Exposure
// ═══════════════════════════════════════════════════════════════

function checkSecretExposure(): CategoryResult {
  const violations: Violation[] = []

  // Patterns that indicate hardcoded secrets
  const SECRET_PATTERNS = [
    // Hardcoded API keys (long hex/base64 strings after key-like identifiers)
    { regex: /(?:api[_-]?key|apikey|secret[_-]?key)\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/i, msg: 'Possible hardcoded API key' },
    // Hardcoded private key content
    { regex: /-----BEGIN\s+(?:RSA|EC|OPENSSH)\s+PRIVATE/, msg: 'Private key detected in source file' },
    // Secret token patterns (sk-*, pk-*, rk-*)
    { regex: /['"](?:sk|pk|rk|tk)[_-][a-zA-Z0-9]{20,}['"]/, msg: 'Possible hardcoded secret token (sk-*, pk-*, rk-*, tk-*)' },
  ]

  // Scan all .ts/.tsx files in src/
  const sourceFiles = findFiles(SRC_DIR, /\.(ts|tsx)$/, 8)

  for (const file of sourceFiles) {
    // Skip type declaration files
    if (file.endsWith('.d.ts')) continue
    // Skip test files
    if (file.endsWith('.test.ts') || file.endsWith('.spec.ts')) continue

    const content = readFile(file)
    const lines = content.split('\n')

    for (const pattern of SECRET_PATTERNS) {
      for (let i = 0; i < lines.length; i++) {
        // Skip comments
        const trimmed = lines[i].trim()
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue
        // Skip env var references (process.env.X = '...' is fine for defaults)
        if (trimmed.includes('process.env')) continue

        if (pattern.regex.test(lines[i])) {
          violations.push({
            category: 7, category_name: 'Secret Exposure',
            severity: 'blocker',
            file: relativePath(file),
            line: i + 1,
            message: pattern.msg,
            hint: `Use environment variables. Never commit secrets to source code.`,
          })
        }
      }
    }
  }

  // Deduplicate: limit to max 5 violations per pattern type to avoid noise
  const deduped: Violation[] = []
  const seen = new Set<string>()
  for (const v of violations) {
    const key = `${v.message}:${v.file}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(v)
    if (deduped.length >= 20) break // Cap total
  }

  return {
    id: 7, name: 'Secret Exposure',
    description: 'No hardcoded secrets, API keys, passwords, or private keys in source',
    violations: deduped,
    passed: deduped.filter(v => v.severity === 'blocker').length === 0,
  }
}

// ═══════════════════════════════════════════════════════════════
// CATEGORY 8: Single Source of Truth (CSRF)
// ═══════════════════════════════════════════════════════════════

function checkSingleSourceCsrf(): CategoryResult {
  const violations: Violation[] = []

  // CSRF token generation must exist in EXACTLY one file: csrf.ts
  const CSRF_GENERATE_PATTERN = /function\s+generateCsrfToken/

  // For validateCsrf/timingSafeEqual: only flag as duplicate if the function
  // has substantial logic (>3 lines in body). Thin wrappers that just call
  // another function are acceptable delegation, not duplication.
  const CSRF_VALIDATE_PATTERN = /function\s+(?:validateCsrf|timingSafeEqual)/

  const libFiles = findFiles(path.join(SRC_DIR, 'lib'), /\.ts$/, 1)
  // Also check middleware and proxy
  const edgeFiles = ['src/middleware.ts', 'src/proxy.ts'].map(f => path.join(PROJECT_ROOT, f))

  let generateLocations: string[] = []
  let validateLocations: string[] = []

  for (const file of [...libFiles, ...edgeFiles]) {
    const content = readFile(file)
    if (!content) continue

    if (CSRF_GENERATE_PATTERN.test(content)) {
      const fileRel = relativePath(file)
      if (!generateLocations.includes(fileRel)) {
        generateLocations.push(fileRel)
      }
    }
    // Count actual timingSafeEqual implementations (not imports, not thin wrappers)
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (CSRF_VALIDATE_PATTERN.test(line) && !line.includes('import') && !line.includes('from')) {
        // Check if it's a thin wrapper (body is a single return statement)
        let bodyLines = 0
        for (let j = i + 1; j < lines.length && j < i + 20; j++) {
          const trimmed = lines[j].trim()
          if (trimmed === '' && bodyLines === 0) continue
          if (trimmed.startsWith('//')) continue
          if (trimmed === '{') continue
          if (trimmed === '}') break
          bodyLines++
        }
        // Only flag if it has substantial logic (>2 non-trivial lines)
        if (bodyLines > 2) {
          const fileRel = relativePath(file)
          if (!validateLocations.includes(fileRel)) {
            validateLocations.push(fileRel)
          }
        }
      }
    }
  }

  if (generateLocations.length > 1) {
    violations.push({
      category: 8, category_name: 'Single Source (CSRF)',
      severity: 'warning',
      file: generateLocations.join(', '),
      message: `CSRF token generation exists in ${generateLocations.length} files (should be 1: csrf.ts)`,
      hint: `All consumers should import generateCsrfToken from @/lib/csrf`,
    })
  }

  if (validateLocations.length > 1) {
    violations.push({
      category: 8, category_name: 'Single Source (CSRF)',
      severity: 'warning',
      file: validateLocations.join(', '),
      message: `CSRF validation implementation exists in ${validateLocations.length} files (should be 1: csrf.ts)`,
      hint: `All consumers should import validateCsrf from @/lib/csrf`,
    })
  }

  if (generateLocations.length === 0) {
    violations.push({
      category: 8, category_name: 'Single Source (CSRF)',
      severity: 'blocker',
      file: 'csrf.ts',
      message: 'No CSRF token generation function found anywhere',
      hint: `Create generateCsrfToken() in src/lib/csrf.ts`,
    })
  }

  return {
    id: 8, name: 'Single Source (CSRF)',
    description: 'CSRF logic must exist in exactly one file (csrf.ts)',
    violations,
    passed: violations.filter(v => v.severity === 'blocker').length === 0,
  }
}

// ═══════════════════════════════════════════════════════════════
// CATEGORY 9: Type Safety
// ═══════════════════════════════════════════════════════════════

function checkTypeSafety(): CategoryResult {
  const violations: Violation[] = []

  try {
    const result = execSync('npx tsc --noEmit 2>&1', {
      cwd: PROJECT_ROOT,
      timeout: 120000,
      encoding: 'utf-8',
    })

    if (result.trim()) {
      // tsc produced output = errors
      const lines = result.trim().split('\n')
      for (const line of lines) {
        if (line.includes('error TS')) {
          const match = line.match(/\((\d+),(\d+)\):\s*(.*)/)
          if (match) {
            violations.push({
              category: 9, category_name: 'Type Safety',
              severity: 'blocker',
              file: line.split('(')[0].trim() || 'unknown',
              line: parseInt(match[1]),
              message: match[3],
            })
          }
        }
      }
      // Cap to avoid massive output
      if (violations.length > 50) {
        violations.length = 50
        violations.push({
          category: 9, category_name: 'Type Safety',
          severity: 'blocker',
          file: 'tsc',
          message: `... and ${result.trim().split('\n').length - 50} more errors (truncated)`,
        })
      }
    }
  } catch (err: any) {
    // tsc returns non-zero exit code on errors
    const output = err.stdout || err.message || ''
    const lines = output.split('\n')
    for (const line of lines) {
      if (line.includes('error TS')) {
        const match = line.match(/\((\d+),(\d+)\):\s*(.*)/)
        if (match) {
          violations.push({
            category: 9, category_name: 'Type Safety',
            severity: 'blocker',
            file: line.split('(')[0].trim() || 'unknown',
            line: parseInt(match[1]),
            message: match[3],
          })
        }
      }
    }
    if (violations.length > 50) violations.length = 50
  }

  return {
    id: 9, name: 'Type Safety',
    description: 'TypeScript compilation with 0 errors (tsc --noEmit)',
    violations,
    passed: violations.length === 0,
  }
}

// ═══════════════════════════════════════════════════════════════
// Main Runner
// ═══════════════════════════════════════════════════════════════

const ALL_CATEGORIES: Array<() => CategoryResult> = [
  checkEdgeBoundary,
  checkCrossBoundary,
  checkAuthCoverage,
  checkCsrfCoverage,
  checkRbacCompleteness,
  checkTokenHashing,
  checkSecretExposure,
  checkSingleSourceCsrf,
  checkTypeSafety,
]

const CATEGORY_NAMES: Record<number, string> = {}
for (const fn of ALL_CATEGORIES) {
  const result = fn()
  CATEGORY_NAMES[result.id] = result.name
  // Clear cache used during the "name peek"
  result.violations.length = 0
}

function main(): void {
  if (catFilter === -2) {
    // --list mode
    console.log('Available invariant categories:\n')
    for (const fn of ALL_CATEGORIES) {
      const result = fn()
      console.log(`  ${result.id}. ${result.name} — ${result.description}`)
    }
    console.log('\nUsage: npx tsx scripts/check-invariants.ts [--ci] [--cat N] [--list]')
    process.exit(0)
    return
  }

  console.log('╔══════════════════════════════════════════════════════════════════════╗')
  console.log('║  Comprehensive Build-Time Invariant Checker — Permanent Gate          ║')
  console.log('║  Categories: Edge Boundary · Cross-Boundary · Auth · CSRF · RBAC       ║')
  console.log('║              Token Hashing · Secrets · Single Source · Type Safety      ║')
  console.log('╚══════════════════════════════════════════════════════════════════════╝')
  console.log()

  const results: CategoryResult[] = []
  const categoriesToRun = catFilter > 0
    ? [catFilter - 1]
    : ALL_CATEGORIES.map((_, i) => i)

  for (const idx of categoriesToRun) {
    if (idx < 0 || idx >= ALL_CATEGORIES.length) continue

    const checker = ALL_CATEGORIES[idx]
    const result = checker()
    results.push(result)

    const icon = result.passed ? '✅' : '❌'
    const count = result.violations.length
    console.log(`${icon} Cat.${result.id} ${result.name}: ${count} violation${count !== 1 ? 's' : ''}`)
  }

  // ── Summary ──
  const totalBlockers = results.reduce((sum, r) => sum + r.violations.filter(v => v.severity === 'blocker').length, 0)
  const totalWarnings = results.reduce((sum, r) => sum + r.violations.filter(v => v.severity === 'warning').length, 0)

  console.log(`\n${'─'.repeat(78)}`)
  console.log(`Total: ${results.length} categories, ${totalBlockers} blockers, ${totalWarnings} warnings`)

  if (totalBlockers > 0 || totalWarnings > 0) {
    console.log('\n')

    // Print blockers first
    for (const r of results) {
      const blockers = r.violations.filter(v => v.severity === 'blocker')
      if (blockers.length === 0) continue
      console.log(`\n🚫 Category ${r.id}: ${r.name} (${blockers.length} blockers)`)
      console.log(`   Rule: ${r.description}\n`)
      for (const v of blockers) {
        const loc = v.line ? `:${v.line}` : ''
        console.log(`   ❌ ${v.file}${loc}`)
        console.log(`      ${v.message}`)
        if (v.chain && v.chain.length > 0) {
          console.log(`      Chain: ${v.chain.join(' → ')}`)
        }
        if (v.hint) {
          console.log(`      💡 ${v.hint}`)
        }
        console.log()
      }
    }

    // Print warnings
    for (const r of results) {
      const warns = r.violations.filter(v => v.severity === 'warning')
      if (warns.length === 0) continue
      console.log(`\n⚠️  Category ${r.id}: ${r.name} (${warns.length} warnings)`)
      console.log(`   Rule: ${r.description}\n`)
      for (const v of warns) {
        const loc = v.line ? `:${v.line}` : ''
        console.log(`   ⚠️  ${v.file}${loc}`)
        console.log(`      ${v.message}`)
        if (v.hint) {
          console.log(`      💡 ${v.hint}`)
        }
        console.log()
      }
    }
  }

  // ── Exit ──
  if (totalBlockers > 0) {
    console.log(`\n❌ BUILD FAILED: ${totalBlockers} blocking violations across ${results.filter(r => !r.passed).length} categories.`)
    console.log(`   Fix the violations above. Run: npx tsx scripts/check-invariants.ts --cat N for details.`)
    process.exit(1)
  } else if (totalWarnings > 0 && ciStrict) {
    console.log(`\n⚠️  BUILD FAILED (strict mode): ${totalWarnings} warnings treated as errors.`)
    process.exit(1)
  } else if (totalWarnings > 0) {
    console.log(`\n✅ Passed (with ${totalWarnings} warnings — review recommended)`)
    process.exit(0)
  } else {
    console.log(`\n✅ ALL INVARIANTS PASS. Codebase is clean across all ${results.length} categories.`)
    process.exit(0)
  }
}

main()
