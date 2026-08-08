/**
 * Vitest Default Configuration — M5 Governance Hardening
 *
 * npm test now runs the 4 fast blocking suites that require no database:
 *   unit, security, m5, integration
 *
 * These are the same configs CI executes. Running `npm test` locally
 * gives developers immediate, meaningful feedback matching CI gates.
 *
 * DB-dependent suites (api, database) require PostgreSQL and should be
 * run individually via: npm run test:api / npm run test:database
 *
 * Full CI-equivalent run: npm run test:blocking
 * See docs/CI_TEST_EXECUTION_MAP.md for the complete execution map.
 */
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    // M5: Include the 4 DB-free blocking test directories.
    // This makes `npm test` a meaningful local validation.
    include: [
      'tests/unit/**/*.test.{ts,tsx}',
      'tests/security/**/*.test.{ts,tsx}',
      'tests/m5/**/*.test.{ts,tsx}',
      'tests/integration/**/*.test.{ts,tsx}',
    ],
    exclude: [
      'tests/legacy/**',
      'tests/unit/sprint1-modules.test.ts',
      'tests/unit/ai-governance/golden-dataset-hallucination.test.ts',
      'tests/unit/ai-governance/hallucination-prevention-certification.test.ts',
    ],
    globals: true,
    pool: 'forks',
    maxWorkers: 1,
    testTimeout: 30000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
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
