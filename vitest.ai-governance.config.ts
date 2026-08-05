/**
 * Vitest Configuration — AI Governance
 * M4 Phase 2 — Switched from threads to forks (eliminates teardown crash)
 *
 * Pool: forks — avoids Vitest 4.x + Node 22.x worker teardown crash
 * that occurred with pool: 'threads' (documented in TEST_EXECUTION_MATRIX.md)
 */
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    name: 'ai-governance',
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/ai/ticket3-config-coverage.test.ts',
      'tests/ai/ai-prompt-registry.test.ts',
      'tests/ai/ticket1-intelligence-errors.test.ts',
      'tests/ai/ticket1-intelligence-integration.test.ts',
      'tests/ai/phase4-query-safety-hardening.test.ts',
      'tests/ai/phase4-streaming-readiness.test.ts',
      'tests/ai/phase4-ai-cache-integration.test.ts',
      'tests/ai/wi-17a-intelligence-activation.test.ts',
      'tests/ai/wi-17b-intelligence-profile.test.ts',
      'tests/ai/ai-hallucination.test.ts',
      'tests/ai/ai-governance-certification.test.ts',
      'tests/ai/ai-golden-dataset.test.ts',
      'tests/ai/ai-hallucination-regression.test.ts',
      'tests/ai/ai-hallucination-m3-certification.test.ts',
      'tests/ai-testing/hallucination-testing/**/*.test.{ts,tsx}',
      'tests/ai-testing/golden-dataset/**/*.test.{ts,tsx}',
      'tests/ai-testing/confidence-testing/**/*.test.{ts,tsx}',
    ],
    exclude: ['tests/legacy/**'],
    globals: true,
    pool: 'forks',
    maxWorkers: 1,
    testTimeout: 30000,
    hookTimeout: 15000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
