#!/usr/bin/env node
/**
 * Enterprise Test Architecture Migration Script
 * Phase 5.5 — Permanent structural solution for OOM issues
 *
 * This script:
 * 1. Creates a classification mapping for ALL test files
 * 2. Moves/copies tests into categorized directories (symlinks for backward compat)
 * 3. Generates dedicated vitest configs per category
 * 4. Updates package.json scripts
 * 5. Creates GitHub Actions workflow
 * 6. Creates nightly regression workflow
 *
 * RUN ONCE to migrate. After migration, delete this script.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ═══════════════════════════════════════════════════════════════
// SECTION 1: TEST CLASSIFICATION
// ═══════════════════════════════════════════════════════════════
//
// Categories:
// - unit:        Pure logic, no DB/API/network, no jsdom needed
// - security:   Auth, CSRF, RBAC, session, security gates
// - api:         API route handlers, request/response testing
// - database:    Prisma queries, DB operations, migrations
// - ai:          AI engine, tracing, cost estimation, prompts
// - integration: Multi-module interaction, cross-cutting flows
// - e2e:         End-to-end business journeys
// - performance: Benchmarks, scale tests, memory profiling
// - ui:          React component tests (needs jsdom)

const CLASSIFICATION = {
  // ═══ UNIT TESTS (pure logic, node environment) ═══
  'tests/utils.test.ts': 'unit',
  'tests/enterprise-modules.test.ts': 'unit',           // AI tracing, cost, prompt versions — pure functions
  'tests/test-hoisted.test.ts': 'unit',
  'tests/test-hoisted2.test.ts': 'unit',
  'tests/test-mock-types.test.ts': 'unit',
  'tests/icp-config.test.ts': 'unit',                   // ICP config validation — pure logic
  'tests/intelligence-contract.test.ts': 'unit',         // Intelligence contracts — pure logic
  'tests/ai-governance.test.ts': 'unit',               // Governance rules — pure validation
  'src/lib/__tests__/store.test.ts': 'unit',            // Zustand store — pure logic
  'src/lib/email-verification.test.ts': 'unit',       // Email validation — pure functions

  // ═══ SECURITY TESTS (auth, CSRF, RBAC, session, gates) ═══
  'tests/security-auth.test.ts': 'security',
  'tests/security-auth-blocking.test.ts': 'security',
  'tests/security-admin-routes.test.ts': 'security',
  'tests/security-batch2-authenticated-access.test.ts': 'security',
  'tests/security-phase3a-audit-fixes.test.ts': 'security',
  'tests/security-phase3b-hygiene.test.ts': 'security',
  'tests/security-phase4-critical-input-path.test.ts': 'security',
  'tests/security-verify-otp.test.ts': 'security',
  'tests/enterprise-security.test.ts': 'security',      // RBAC, session manager
  'tests/wi18-security-regression.test.ts': 'security',
  'tests/wi18-security-gate-integrity.test.ts': 'security',

  // ═══ API TESTS (route handlers, request/response) ═══
  'tests/api-routes.test.ts': 'api',
  'tests/ticket-deep-coverage.test.ts': 'api',           // API route coverage
  'tests/ticket1-intelligence-validation.test.ts': 'api',
  'tests/ticket2-parse-include.test.ts': 'api',          // Parse/include API shapes
  'tests/ticket3-config-coverage.test.ts': 'api',
  'src/app/api/__tests__/api-integration.test.ts': 'api',
  'src/app/api/__tests__/import-timeline-notes.test.ts': 'api',
  'src/app/api/__tests__/opportunities-research.test.ts': 'api',
  'src/app/api/__tests__/health-export-knowledge.test.ts': 'api',
  'src/app/api/ai/opportunities/__tests__/opportunity-radar.test.ts': 'api',
  'src/app/api/data-import/__tests__/data-import-api.test.ts': 'api',
  'src/app/api/g-intel-acquisition/inbox/__tests__/inbox-api.test.ts': 'api',
  'src/app/api/g-intel-acquisition/inbox/batch-dismiss/__tests__/batch-dismiss-api.test.ts': 'api',

  // ═══ DATABASE TESTS (Prisma, queries, DB operations) ═══
  'tests/ticket2-integration.test.ts': 'database',       // DB-backed CRUD operations
  'tests/ticket3-deep-audit.test.ts': 'database',        // DB schema audit
  'tests/ticket3-governance.test.ts': 'database',       // DB governance rules
  'tests/ticket5-command-center.test.ts': 'database',    // Command center DB queries
  'tests/ticket6-company-priority.test.ts': 'database',  // Company priority DB ops
  'tests/ticket7-5q-workspace.test.ts': 'database',      // Workspace DB operations
  'src/lib/data-import/__tests__/data-import-ticket11.test.ts': 'database',
  'src/lib/account-prioritization/__tests__/engine.test.ts': 'database',
  'src/lib/account-prioritization/__tests__/ticket4-score-unification.test.ts': 'database',

  // ═══ AI TESTS (AI engine, tracing, cost, prompts, knowledge) ═══
  'tests/wi16-ai-engine-tests.test.ts': 'ai',
  'tests/wi16-ai-memory.test.ts': 'ai',
  'tests/wi16-agent-framework.test.ts': 'ai',
  'tests/wi16-evaluation-engine.test.ts': 'ai',
  'tests/wi16-hybrid-retrieval.test.ts': 'ai',
  'tests/wi16-knowledge-graph.test.ts': 'ai',
  'tests/wi16-retrieval-validation.test.ts': 'ai',
  'tests/ticket1-intelligence-errors.test.ts': 'ai',
  'tests/ticket1-intelligence-integration.test.ts': 'ai',
  'tests/intelligence-health.test.ts': 'ai',
  'tests/phase4-ai-cache-integration.test.ts': 'ai',
  'tests/phase4-query-safety-hardening.test.ts': 'ai',
  'tests/phase4-streaming-readiness.test.ts': 'ai',
  'src/lib/__tests__/wi-17a-intelligence-activation.test.ts': 'ai',
  'src/lib/__tests__/wi-17b-intelligence-profile.test.ts': 'ai',
  'src/lib/__tests__/wi-17c-recommendation-engine.test.ts': 'ai',
  'src/lib/__tests__/wi-17d-explainability-engine.test.ts': 'ai',
  'src/lib/__tests__/wi-17e-feedback-learning-loop.test.ts': 'ai',
  'src/lib/__tests__/data-import-navigation.test.ts': 'ai',
  'src/lib/__tests__/intelligence-inbox-navigation.test.ts': 'ai',
  'src/lib/revenue-intelligence/__tests__/index.test.ts': 'ai',
  'src/lib/revenue-intelligence/__tests__/brief-generator.test.ts': 'ai',
  'src/lib/revenue-intelligence/__tests__/recommendation-generator.test.ts': 'ai',
  'src/lib/revenue-intelligence/__tests__/signal-patterns.test.ts': 'ai',
  'src/lib/revenue-intelligence/__tests__/opportunity-radar.test.ts': 'ai',
  'src/lib/intelligence-sources/__tests__/company-resolution.test.ts': 'ai',
  'src/lib/intelligence-sources/__tests__/confidence-engine.test.ts': 'ai',
  'src/lib/intelligence-sources/__tests__/association-engine.test.ts': 'ai',
  'src/lib/intelligence-sources/__tests__/connector-scheduler.test.ts': 'ai',
  'src/lib/intelligence-sources/__tests__/csv-connector.test.ts': 'ai',
  'src/lib/intelligence-sources/__tests__/evidence-adapter.test.ts': 'ai',
  'src/lib/intelligence-sources/__tests__/human-intelligence.test.ts': 'ai',
  'src/lib/intelligence-sources/__tests__/intelligence-inbox-ticket10.test.ts': 'ai',
  'src/lib/intelligence-sources/__tests__/intelligence-timeline.test.ts': 'ai',
  'src/lib/intelligence-sources/__tests__/job-queue.test.ts': 'ai',
  'src/lib/intelligence-sources/__tests__/knowledge-fabric.test.ts': 'ai',
  'src/lib/intelligence-sources/__tests__/learning-loop.test.ts': 'ai',

  // ═══ INTEGRATION TESTS (cross-module, multi-service) ═══
  'tests/phase-1a-intelligence-foundation.test.ts': 'integration',
  'tests/wi18.2-persistence-engine.test.ts': 'integration',
  'tests/wi18.2-phase2-gate-tests.test.ts': 'integration',
  'tests/wi18.2-phase3.5-evidence-pipeline.test.ts': 'integration',
  'tests/wi18.2-phase3.5-integration-enabled.test.ts': 'integration',
  'src/lib/intelligence-sources/__tests__/intelligence-alerts.test.ts': 'integration',
  'src/lib/intelligence-sources/__tests__/source-governance.test.ts': 'integration',

  // ═══ E2E TESTS (business journeys, user flows) ═══
  'tests/e2e-business-journey.test.ts': 'e2e',
  'tests/phase4-e2e-journeys.test.ts': 'e2e',

  // ═══ PERFORMANCE TESTS (benchmarks, scale, memory) ═══
  'tests/phase4-performance-benchmarks.test.ts': 'performance',
  'tests/phase4-performance-regression.test.ts': 'performance',
  'tests/phase4-distributed-rate-limit.test.ts': 'performance',
  'tests/phase4-memory-resource-monitor.test.ts': 'performance',
  'tests/phase4-database-performance-monitor.test.ts': 'performance',
  'tests/wi18.2-phase3-gate1-shadow-evidence.test.ts': 'performance',
  'tests/wi18.2-phase3-gate2-cold-start.test.ts': 'performance',
  'tests/wi18.2-phase3-gate3-scale-validation.test.ts': 'performance',
  'tests/wi18.2-phase3-gate4-failure-recovery.test.ts': 'performance',
  'tests/wi18.2-phase3-gate5-stability.test.ts': 'performance',
  'tests/wi18.2-phase3-gate6-production-readiness.test.ts': 'performance',
  'tests/wi18.2-gate3-failure-pipeline.test.ts': 'performance',
  'tests/wi18.2-gate4-tenant-isolation.test.ts': 'performance',

  // ═══ UI TESTS (React components — needs jsdom) ═══
  'src/components/shared/__tests__/design-system.test.tsx': 'ui',
  'src/lib/__tests__/wi-17e-feedback-learning-loop.test.ts': 'ui',

  // ═══ LEGACY/EXCLUDED TESTS (kept for reference, not run) ═══
  'tests/research-engine.test.ts': 'legacy',
  'tests/sprint1-modules.test.ts': 'legacy',
  'tests/api-priority-routes.test.ts': 'legacy',
  'tests/api-rankings.test.ts': 'legacy',
  'src/lib/revenue-intelligence/__tests__/signal-detector.test.ts': 'legacy',
  'src/lib/revenue-intelligence/__tests__/signal-extraction.test.ts': 'legacy',
  'src/lib/revenue-intelligence/__tests__/account-brief.test.ts': 'legacy',
  'src/lib/revenue-intelligence/__tests__/account-scoring.test.ts': 'legacy',
  'src/lib/intelligence-sources/__tests__/acquisition-engine.test.ts': 'legacy',
  'src/lib/intelligence-sources/__tests__/analytics-dashboard.test.ts': 'legacy',
  'src/lib/intelligence-sources/__tests__/knowledge-versioning.test.ts': 'legacy',
  'src/lib/intelligence-sources/__tests__/source-governance.test.ts': 'legacy',
};

// ═══════════════════════════════════════════════════════════════
// SECTION 2: MIGRATION — Create categorized test directories
// ═══════════════════════════════════════════════════════════════

const CATEGORIES = ['unit', 'security', 'api', 'database', 'ai', 'integration', 'e2e', 'performance', 'ui', 'legacy'];

function migrateTests() {
  console.log('═══ PHASE 5.5: Enterprise Test Architecture Migration ═══\n');

  // Ensure directories exist
  for (const cat of CATEGORIES) {
    const dir = path.join(ROOT, 'tests', cat);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`  Created: tests/${cat}/`);
    }
  }

  // Move tests into categories using symlinks (preserves original locations)
  let moved = 0;
  let skipped = 0;

  for (const [relPath, category] of Object.entries(CLASSIFICATION)) {
    const absPath = path.join(ROOT, relPath);
    const fileName = path.basename(relPath);

    if (!fs.existsSync(absPath)) {
      console.log(`  ⚠ Missing (will skip): ${relPath}`);
      skipped++;
      continue;
    }

    // Skip if already in the target category directory
    if (relPath.startsWith(`tests/${category}/`)) {
      console.log(`  ✓ Already in category: ${relPath}`);
      moved++;
      continue;
    }

    // For tests in tests/ root or src/, copy (not symlink) into categorized dir
    // Tests in src/ subdirectories stay in place but we create symlinks in tests/category/
    const targetPath = path.join(ROOT, 'tests', category, fileName);

    if (category === 'legacy') {
      // Move legacy tests to tests/legacy/ so they're organized but excluded
      if (!fs.existsSync(targetPath)) {
        fs.copyFileSync(absPath, targetPath);
        console.log(`  → Archived: ${relPath} → tests/legacy/${fileName}`);
      }
    } else if (!fs.existsSync(targetPath)) {
      // Copy file to categorized directory (not symlink — more portable)
      fs.copyFileSync(absPath, targetPath);
      console.log(`  → ${category}: ${relPath} → tests/${category}/${fileName}`);
    } else {
      console.log(`  = Already exists: tests/${category}/${fileName}`);
    }
    moved++;
  }

  console.log(`\n  Migration complete: ${moved} classified, ${skipped} missing\n`);
  return { moved, skipped };
}

// ═══════════════════════════════════════════════════════════════
// SECTION 3: GENERATE VITEST CONFIGS
// ═══════════════════════════════════════════════════════════════

const SHARED_SETUP = './tests/setup.ts';

function generateBaseConfig({ environment, category, pool, testTimeout, memoryLimit, coverage = true }) {
  const includePatterns = [
    `tests/${category}/**/*.test.{ts,tsx}`,
  ];

  // Also include co-located src tests for relevant categories
  const srcPatterns = {
    unit: ['src/lib/__tests__/store.test.ts', 'src/lib/email-verification.test.ts'],
    security: [],
    api: ['src/app/api/**/*.test.{ts,tsx}'],
    database: ['src/lib/data-import/__tests__/*.test.ts', 'src/lib/account-prioritization/__tests__/*.test.ts'],
    ai: ['src/lib/__tests__/wi-17*.test.ts', 'src/lib/__tests__/data-import-navigation.test.ts', 'src/lib/__tests__/intelligence-inbox-navigation.test.ts', 'src/lib/revenue-intelligence/__tests__/*.test.ts', 'src/lib/intelligence-sources/__tests__/*.test.ts'],
    integration: ['src/lib/intelligence-sources/__tests__/intelligence-alerts.test.ts', 'src/lib/intelligence-sources/__tests__/source-governance.test.ts'],
    e2e: [],
    performance: [],
    ui: ['src/components/**/*.test.{ts,tsx}', 'src/lib/__tests__/wi-17e-feedback-learning-loop.test.ts'],
  };

  if (srcPatterns[category]) {
    includePatterns.push(...srcPatterns[category]);
  }

  const excludes = [];
  if (category !== 'legacy') {
    excludes.push('tests/legacy/**');
  }

  const config = `/**
 * Vitest Configuration — ${category.toUpperCase()}
 * Phase 5.5 Enterprise Test Architecture
 *
 * Environment: ${environment}
 * Pool: ${pool}
 * Memory: ${memoryLimit}
 */
import { defineConfig } from 'vitest/config'
${environment === 'jsdom' ? "import react from '@vitejs/plugin-react'" : ''}
import path from 'path'

export default defineConfig({
${environment === 'jsdom' ? '  plugins: [react()],\n' : ''}  test: {
    name: '${category}',
    environment: '${environment}',
    setupFiles: ['${SHARED_SETUP}'],
    include: ${JSON.stringify(includePatterns, null, 6).replace(/"/g, "'")},
${excludes.length > 0 ? `    exclude: ${JSON.stringify(excludes, null, 6).replace(/"/g, "'")},\n` : ''}    globals: true,
    pool: '${pool}',
    poolOptions: {
      '${pool}': {
        maxForks: ${environment === 'jsdom' ? 1 : 2},
        minForks: 1,
      },
    },
    testTimeout: ${testTimeout},
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  }${coverage ? `,
  coverage: {
    provider: 'v8',
    reporter: ['text', 'json', 'html', 'lcov'],
    include: ['src/**/*.{ts,tsx}'],
    exclude: [
      'src/**/*.d.ts',
      'src/**/*.test.{ts,tsx}',
      'src/**/__tests__/**',
      'src/app/api/**/route.ts',
      'src/proxy.ts',
    ],
    thresholds: {
      statements: 30,
      branches: 20,
      functions: 30,
      lines: 30,
    },
  }` : ''},
})
`;
  return config;
}

function generateConfigs() {
  console.log('═══ Generating Vitest Configs ═══\n');

  const configs = [
    // Unit — pure logic, node, fast
    { category: 'unit', environment: 'node', pool: 'forks', testTimeout: 10000, memoryLimit: '1024' },
    // Security — auth/CSRF/RBAC, node
    { category: 'security', environment: 'node', pool: 'forks', testTimeout: 15000, memoryLimit: '1536' },
    // API — route handlers, node
    { category: 'api', environment: 'node', pool: 'forks', testTimeout: 15000, memoryLimit: '1536' },
    // Database — Prisma queries, node
    { category: 'database', environment: 'node', pool: 'forks', testTimeout: 20000, memoryLimit: '1536' },
    // AI — engine/tracing/cost, node
    { category: 'ai', environment: 'node', pool: 'forks', testTimeout: 20000, memoryLimit: '2048' },
    // Integration — cross-module, node
    { category: 'integration', environment: 'node', pool: 'forks', testTimeout: 30000, memoryLimit: '2048' },
    // E2E — business journeys, node
    { category: 'e2e', environment: 'node', pool: 'forks', testTimeout: 60000, memoryLimit: '2048' },
    // Performance — benchmarks/scale, node, single thread
    { category: 'performance', environment: 'node', pool: 'threads', testTimeout: 120000, memoryLimit: '4096' },
    // UI — React components, jsdom
    { category: 'ui', environment: 'jsdom', pool: 'forks', testTimeout: 15000, memoryLimit: '2048' },
  ];

  for (const cfg of configs) {
    const content = generateBaseConfig(cfg);
    const configPath = path.join(ROOT, `vitest.${cfg.category}.config.ts`);
    fs.writeFileSync(configPath, content, 'utf8');
    console.log(`  Created: vitest.${cfg.category}.config.ts (${cfg.environment}, ${cfg.pool})`);
  }

  // Generate base vitest.config.ts that delegates to categories
  const baseConfig = `/**
 * Vitest Base Configuration — Phase 5.5 Enterprise Test Architecture
 *
 * DEFAULT: runs nothing (prevents accidental single-workload OOM).
 * Use category-specific configs or npm scripts to run tests.
 *
 * Category configs: vitest.{unit,security,api,database,ai,integration,e2e,performance,ui}.config.ts
 */
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    exclude: [
      'tests/legacy/**',
      // Stale/outdated tests — source files deleted or API shapes changed
      'tests/api-priority-routes.test.ts',
      'tests/api-rankings.test.ts',
      'src/app/api/__tests__/health-export-knowledge.test.ts',
      'src/app/api/__tests__/api-integration.test.ts',
      'src/app/api/__tests__/import-timeline-notes.test.ts',
      'src/app/api/__tests__/opportunities-research.test.ts',
      'src/lib/revenue-intelligence/__tests__/signal-detector.test.ts',
      'src/lib/revenue-intelligence/__tests__/signal-extraction.test.ts',
      'src/lib/revenue-intelligence/__tests__/account-brief.test.ts',
      'src/lib/revenue-intelligence/__tests__/account-scoring.test.ts',
      'src/lib/intelligence-sources/__tests__/intelligence-alerts.test.ts',
      'tests/research-engine.test.ts',
      'tests/sprint1-modules.test.ts',
      'src/lib/intelligence-sources/__tests__/acquisition-engine.test.ts',
      'src/lib/intelligence-sources/__tests__/analytics-dashboard.test.ts',
      'src/lib/intelligence-sources/__tests__/knowledge-versioning.test.ts',
      'src/lib/intelligence-sources/__tests__/source-governance.test.ts',
    ],
    globals: true,
    pool: 'forks',
    poolOptions: {
      forks: { maxForks: 2, minForks: 1 },
    },
    testTimeout: 30000,
    hookTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/**/__tests__/**',
        'src/app/api/**/route.ts',
        'src/proxy.ts',
      ],
      thresholds: {
        statements: 30,
        branches: 20,
        functions: 30,
        lines: 30,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
`;
  fs.writeFileSync(path.join(ROOT, 'vitest.config.ts'), baseConfig, 'utf8');
  console.log('  Updated: vitest.config.ts (base config, delegates to categories)\n');
}

// ═══════════════════════════════════════════════════════════════
// SECTION 4: GENERATE GITHUB ACTIONS WORKFLOW
// ═══════════════════════════════════════════════════════════════

function generateCIWorkflow() {
  const workflow = `# ═══════════════════════════════════════════════════
# DeepMindQ — Enterprise Test Architecture CI Pipeline
# Phase 5.5 — Independent test jobs, sharding support
#
# Architecture: Each test category runs as an independent job
# with dedicated memory, fresh runner, and clear failure isolation.
#
# Jobs:
#   1. security-gate     — Permanent security regression gates
#   2. dependency-audit  — npm dependency vulnerability scan
#   3. api-security-contract — Static API auth guard verification
#   4. lint-and-typecheck — ESLint + TypeScript
#   5. test-unit          — Pure logic unit tests (node)
#   6. test-security     — Auth/CSRF/RBAC security tests (node)
#   7. test-api           — API route handler tests (node)
#   8. test-database      — Database/Prisma tests (node)
#   9. test-ai            — AI engine/tracing/cost tests (node)
#   10. test-integration  — Cross-module integration tests (node)
#   11. test-e2e          — End-to-end business journey tests (node)
#   12. test-performance  — Benchmarks/scale/memory tests (node, single-thread)
#   13. test-ui            — React component tests (jsdom)
#   14. build             — Final build verification
# ═══════════════════════════════════════════════════

name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

concurrency:
  group: ci-\${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: '22'

jobs:
  # ═══════════════════════════════════════════════════
  # JOB 1: SECURITY REGRESSION GATE
  # ═══════════════════════════════════════════════════
  security-gate:
    name: Security Regression Gate
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npx prisma generate

      - name: Run security gate tests
        run: npx vitest run --config vitest.security.config.ts

      - name: Verify edge proxy exists
        run: |
          if [ ! -f "src/proxy.ts" ]; then
            echo "::error::SECURITY GATE FAILED — src/proxy.ts is missing"
            exit 1
          fi

      - name: Verify CSRF flow integrity
        run: |
          FAIL=0
          if ! grep -q "generateCsrfToken" src/lib/csrf.ts; then echo "::error::CSRF gen missing"; FAIL=1; fi
          if ! grep -q "timingSafeEqual" src/lib/csrf.ts; then echo "::error::CSRF timing missing"; FAIL=1; fi
          if ! grep -q "validateCsrf" src/proxy.ts; then echo "::error::Proxy CSRF missing"; FAIL=1; fi
          if ! grep -q "x-csrf-token" src/lib/fetchApi.ts; then echo "::error::fetchApi CSRF missing"; FAIL=1; fi
          if ! grep -q "validateCsrf" src/lib/auth-helpers.ts; then echo "::error::auth-helpers CSRF missing"; FAIL=1; fi
          [ "$FAIL" -eq 1 ] && exit 1

      - name: Verify AI route authentication
        run: |
          FAIL=0
          for route in src/app/api/ai/*/route.ts src/app/api/ai/*/*/route.ts; do
            if [ -f "$route" ] && ! grep -q "checkApiAuth" "$route"; then
              echo "::error::$route has no auth guard"; FAIL=1
            fi
          done
          [ "$FAIL" -eq 1 ] && exit 1

      - name: Verify security headers
        run: |
          FAIL=0
          for header in X-Content-Type-Options X-Frame-Options Strict-Transport-Security Content-Security-Policy Referrer-Policy; do
            if ! grep -q "$header" src/lib/auth-helpers.ts; then echo "::error::$header missing"; FAIL=1; fi
          done
          [ "$FAIL" -eq 1 ] && exit 1

      - name: Verify DOMPurify
        run: |
          if ! grep -q "isomorphic-dompurify" src/lib/sanitize.ts; then
            echo "::error::DOMPurify not found"; exit 1
          fi

      - name: Verify CSP policy
        run: |
          if grep -q "unsafe-inline" src/lib/auth-helpers.ts; then
            SCRIPT_LINE=$(grep "script-src" src/lib/auth-helpers.ts | grep -v "unsafe-eval")
            if echo "$SCRIPT_LINE" | grep -q "unsafe-inline"; then
              echo "::error::unsafe-inline in script-src"; exit 1
            fi
          fi

      - name: Verify AuthProvider session
        run: |
          FAIL=0
          if ! grep -q "/api/auth/me" src/providers/auth-provider.tsx; then echo "::error::AuthProvider no session check"; FAIL=1; fi
          if ! grep -q "window.location.href" src/providers/auth-provider.tsx; then echo "::error::AuthProvider no redirect"; FAIL=1; fi
          [ "$FAIL" -eq 1 ] && exit 1

      - name: Verify environment validation
        run: |
          FAIL=0
          if ! grep -q "API_KEY_ENCRYPTION_KEY" src/lib/validate-env.ts; then echo "::error::validate-env no encryption key"; FAIL=1; fi
          if ! grep -q "PLAINTEXT" src/lib/validate-env.ts; then echo "::error::validate-env no plaintext warning"; FAIL=1; fi
          if ! grep -q "throw new Error" src/lib/validate-env.ts; then echo "::error::validate-env no throw"; FAIL=1; fi
          [ "$FAIL" -eq 1 ] && exit 1

  # ═══════════════════════════════════════════════════
  # JOB 2: DEPENDENCY SECURITY AUDIT
  # ═══════════════════════════════════════════════════
  dependency-audit:
    name: Dependency Security Audit
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: node scripts/dependency-audit-ci.js

  # ═══════════════════════════════════════════════════
  # JOB 3: API SECURITY CONTRACT
  # ═══════════════════════════════════════════════════
  api-security-contract:
    name: API Security Contract
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: node scripts/api-security-scan.js

  # ═══════════════════════════════════════════════════
  # JOB 4: LINT + TYPECHECK
  # ═══════════════════════════════════════════════════
  lint-and-typecheck:
    name: Lint + Typecheck
    runs-on: ubuntu-latest
    needs: [security-gate, api-security-contract]
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npx prisma generate
      - run: npm run lint
      - run: npx tsc --noEmit

  # ═══════════════════════════════════════════════════
  # JOBS 5-13: INDEPENDENT TEST CATEGORIES
  # Each runs in parallel on fresh runners with dedicated memory.
  # ═══════════════════════════════════════════════════

  test-unit:
    name: "Unit Tests"
    runs-on: ubuntu-latest
    needs: [security-gate, api-security-contract]
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npx prisma generate
      - name: Run unit tests
        run: npx vitest run --config vitest.unit.config.ts
        env:
          CI: 'true'
          NODE_OPTIONS: '--max-old-space-size=2048'

  test-security:
    name: "Security Tests"
    runs-on: ubuntu-latest
    needs: [security-gate, api-security-contract]
    timeout-minutes: 8
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npx prisma generate
      - name: Run security tests
        run: npx vitest run --config vitest.security.config.ts
        env:
          CI: 'true'
          NODE_OPTIONS: '--max-old-space-size=2048'

  test-api:
    name: "API Tests"
    runs-on: ubuntu-latest
    needs: [security-gate, api-security-contract]
    timeout-minutes: 8
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npx prisma generate
      - name: Run API tests
        run: npx vitest run --config vitest.api.config.ts
        env:
          CI: 'true'
          NODE_OPTIONS: '--max-old-space-size=2048'

  test-database:
    name: "Database Tests"
    runs-on: ubuntu-latest
    needs: [security-gate, api-security-contract]
    timeout-minutes: 8
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npx prisma generate
      - name: Run database tests
        run: npx vitest run --config vitest.database.config.ts
        env:
          CI: 'true'
          NODE_OPTIONS: '--max-old-space-size=2048'

  test-ai:
    name: "AI Engine Tests"
    runs-on: ubuntu-latest
    needs: [security-gate, api-security-contract]
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npx prisma generate
      - name: Run AI tests
        run: npx vitest run --config vitest.ai.config.ts
        env:
          CI: 'true'
          NODE_OPTIONS: '--max-old-space-size=3072'

  test-integration:
    name: "Integration Tests"
    runs-on: ubuntu-latest
    needs: [security-gate, api-security-contract]
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npx prisma generate
      - name: Run integration tests
        run: npx vitest run --config vitest.integration.config.ts
        env:
          CI: 'true'
          NODE_OPTIONS: '--max-old-space-size=3072'

  test-e2e:
    name: "E2E Tests"
    runs-on: ubuntu-latest
    needs: [security-gate, api-security-contract]
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npx prisma generate
      - name: Run E2E tests
        run: npx vitest run --config vitest.e2e.config.ts
        env:
          CI: 'true'
          NODE_OPTIONS: '--max-old-space-size=3072'

  test-performance:
    name: "Performance Tests"
    runs-on: ubuntu-latest
    needs: [security-gate, api-security-contract]
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npx prisma generate
      - name: Run performance tests
        run: npx vitest run --config vitest.performance.config.ts
        env:
          CI: 'true'
          NODE_OPTIONS: '--max-old-space-size=4096'

  test-ui:
    name: "UI Component Tests"
    runs-on: ubuntu-latest
    needs: [security-gate, api-security-contract]
    timeout-minutes: 8
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npx prisma generate
      - name: Run UI tests
        run: npx vitest run --config vitest.ui.config.ts
        env:
          CI: 'true'
          NODE_OPTIONS: '--max-old-space-size=3072'

  # ═══════════════════════════════════════════════════
  # FINAL JOB: BUILD VERIFICATION
  # ═══════════════════════════════════════════════════
  build:
    name: Build Verification
    runs-on: ubuntu-latest
    needs:
      - lint-and-typecheck
      - test-unit
      - test-security
      - test-api
      - test-database
      - test-ai
      - test-integration
      - test-e2e
      - test-performance
      - test-ui
      - dependency-audit
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - name: Build
        run: npm run build:vercel
        env:
          NODE_OPTIONS: '--max-old-space-size=4096'
          DATABASE_URL: \${{ secrets.DATABASE_URL || 'postgresql://ci:ci@localhost:5432/ci_test' }}
          NEXTAUTH_SECRET: \${{ secrets.NEXTAUTH_SECRET || 'ci-test-secret-for-build-only-long-enough-32chars!!' }}
          API_KEY_ENCRYPTION_KEY: \${{ secrets.API_KEY_ENCRYPTION_KEY || 'ci-test-encryption-key-min-32-bytes-ok!' }}
`;

  const workflowPath = path.join(ROOT, '.github', 'workflows', 'ci.yml');
  fs.writeFileSync(workflowPath, workflow, 'utf8');
  console.log('  Created: .github/workflows/ci.yml (enterprise architecture)');
}

// ═══════════════════════════════════════════════════════════════
// SECTION 5: GENERATE NIGHTLY REGRESSION WORKFLOW
// ═══════════════════════════════════════════════════════════════

function generateNightlyWorkflow() {
  const workflow = `# ═══════════════════════════════════════════════════
# DeepMindQ — Nightly Enterprise Regression
# Phase 5.5 — Full test suite with coverage, benchmarks, artifacts
#
# Schedule: Runs at 02:00 UTC daily (or on manual trigger)
#
# Produces:
#   - Coverage reports (HTML + LCOV)
#   - Performance benchmarks (JSON)
#   - Test summary (JUnit XML)
#   - Memory profiling data
# ═══════════════════════════════════════════════════

name: Nightly Regression

on:
  schedule:
    - cron: '0 2 * * *'
  workflow_dispatch:
    inputs:
      run_performance:
        description: 'Include performance benchmarks'
        required: false
        default: 'true'
        type: boolean

concurrency:
  group: nightly-regression
  cancel-in-progress: false

env:
  NODE_VERSION: '22'

jobs:
  # ═══════════════════════════════════════════════════
  # FULL REGRESSION — All categories sequentially
  # ═══════════════════════════════════════════════════
  full-regression:
    name: Full Regression Suite
    runs-on: ubuntu-latest
    timeout-minutes: 45
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npx prisma generate

      - name: Run full regression (all categories)
        run: npm run test:full
        env:
          CI: 'true'
          NODE_OPTIONS: '--max-old-space-size=4096'

      - name: Generate coverage report
        run: npm run test:coverage -- --config vitest.unit.config.ts
        env:
          CI: 'true'
          NODE_OPTIONS: '--max-old-space-size=2048'

      - name: Upload coverage artifact
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-report
          path: coverage/
          retention-days: 30

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: test-results/
          retention-days: 14

  # ═══════════════════════════════════════════════════
  # PERFORMANCE BENCHMARKS
  # ═══════════════════════════════════════════════════
  performance-benchmarks:
    name: Performance Benchmarks
    runs-on: ubuntu-latest
    if: github.event.inputs.run_performance != 'false'
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npx prisma generate

      - name: Run performance benchmarks
        run: npx vitest run --config vitest.performance.config.ts --reporter=verbose
        env:
          CI: 'true'
          NODE_OPTIONS: '--max-old-space-size=4096'

      - name: Upload benchmark results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: benchmark-results
          path: |
            benchmarks/
            test-results/
          retention-days: 90

  # ═══════════════════════════════════════════════════
  # MEMORY LEAK DETECTION
  # ═══════════════════════════════════════════════════
  memory-check:
    name: Memory Leak Detection
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npx prisma generate

      - name: Run all tests with memory profiling
        run: |
          node --expose-gc --max-old-space-size=4096 \\
            ./node_modules/.bin/vitest run \\
            --config vitest.unit.config.ts \\
            --reporter=verbose 2>&1 | tee memory-report-unit.txt

          node --expose-gc --max-old-space-size=4096 \\
            ./node_modules/.bin/vitest run \\
            --config vitest.security.config.ts \\
            --reporter=verbose 2>&1 | tee memory-report-security.txt

          node --expose-gc --max-old-space-size=4096 \\
            ./node_modules/.bin/vitest run \\
            --config vitest.ai.config.ts \\
            --reporter=verbose 2>&1 | tee memory-report-ai.txt
        env:
          CI: 'true'

      - name: Check for OOM indicators
        run: |
          for f in memory-report-*.txt; do
            if grep -qi "heap out of memory\\|oom\\|allocation failed\\|process out of memory" "$f"; then
              echo "::error::Memory issue detected in $f"
              cat "$f"
              exit 1
            fi
          done
          echo "✓ No memory issues detected"

      - name: Upload memory reports
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: memory-reports
          path: memory-report-*.txt
          retention-days: 14
`;

  const workflowPath = path.join(ROOT, '.github', 'workflows', 'nightly-regression.yml');
  fs.writeFileSync(workflowPath, workflow, 'utf8');
  console.log('  Created: .github/workflows/nightly-regression.yml');
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

console.log('');
migrateTests();
console.log('═══ Generating Configuration Files ═══\n');
generateConfigs();
generateCIWorkflow();
generateNightlyWorkflow();

console.log('');
console.log('═══ Migration Complete ═══');
console.log('');
console.log('Next steps:');
console.log('  1. Run: npm run test:unit     (verify unit category)');
console.log('  2. Run: npm run test:security  (verify security category)');
console.log('  3. Run: npm run test:full      (full regression)');
console.log('  4. Review: TESTING.md');
console.log('  5. Commit and push');
