/**
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
      'tests/unit/**',
      'tests/security/**',
      'tests/api/**',
      'tests/database/**',
      'tests/ai/**',
      'tests/integration/**',
      'tests/e2e/**',
      'tests/performance/**',
      'tests/ui/**',
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
    maxWorkers: 2,
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
