/**
 * Vitest Configuration — AI Framework
 * M5 Governance Hardening -- forks pool
 */
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    name: 'ai-framework',
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/ai/wi16-agent-framework.test.ts',
      'tests/ai/wi16-ai-memory.test.ts',
      'tests/ai/wi-17c-recommendation-engine.test.ts',
      'tests/ai/wi-17d-explainability-engine.test.ts',
      'tests/ai/wi16-knowledge-graph.test.ts',
      'tests/ai/wi16-retrieval-validation.test.ts',
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
