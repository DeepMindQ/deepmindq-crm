/**
 * Vitest Configuration — AI Inference
 * Phase 5.5 Enterprise Test Architecture
 *
 * Reserved for future AI inference tests (model-based tests, cost control,
 * latency regression, fallback chains, etc.)
 *
 * Currently contains a single placeholder test confirming the category is operational.
 *
 * Environment: node | Pool: forks | Memory: 2048
 */
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    name: 'ai-inference',
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/ai/inference-placeholder.test.ts',
    ],
    exclude: ['tests/legacy/**'],
    globals: true,
    pool: 'forks',
    maxWorkers: 2,
    testTimeout: 20000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
