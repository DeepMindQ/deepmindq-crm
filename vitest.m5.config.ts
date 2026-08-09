/**
 * Vitest Configuration — M5 Trust & Intelligence Tests
 *
 * Tests for Phase 3-6 M5 modules:
 *   - trust-metadata.ts
 *   - financial-intelligence-framework.ts
 *   - clearbit-connector.ts
 *   - hallucination-prevention.ts
 *   - data-lineage-service.ts
 *   - market-discovery.ts
 *   - m5-wow4-knowledge-intelligence.ts
 */
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    name: 'm5-trust',
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/m5/**/*.test.{ts,tsx}',
    ],
    globals: true,
    pool: 'forks',
    maxWorkers: 1,
    testTimeout: 15000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  coverage: {
    provider: 'v8',
    reporter: ['text', 'json'],
    include: [
      'src/lib/intelligence-sources/trust-metadata.ts',
      'src/lib/intelligence-sources/connectors/clearbit-connector.ts',
      'src/lib/financial-intelligence-framework.ts',
      'src/lib/data-lineage-service.ts',
      'src/lib/hallucination-prevention.ts',
    ],
    thresholds: {
      statements: 60,
      branches: 50,
      functions: 60,
      lines: 60,
    },
  },
})
