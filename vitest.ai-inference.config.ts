/**
 * Vitest Configuration — AI Inference
 * M5 Governance Hardening -- forks pool
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
    maxWorkers: 1,
    teardownTimeout: 10000,
    testTimeout: 20000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
