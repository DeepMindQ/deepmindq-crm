/**
 * Vitest Configuration — AI Retrieval
 * Phase 5.5 Enterprise Test Architecture
 *
 * Covers: Hybrid retrieval, evaluation engine
 * Environment: node | Pool: forks | Memory: 2048
 */
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    name: 'ai-retrieval',
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/ai/wi16-hybrid-retrieval.test.ts',
      'tests/ai/wi16-evaluation-engine.test.ts',
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
