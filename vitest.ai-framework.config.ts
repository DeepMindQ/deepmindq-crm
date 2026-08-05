/**
 * Vitest Configuration — AI Framework
 * M3 Stabilization — threads pool, single thread
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
    pool: 'threads',
    maxThreads: 1,
    minThreads: 1,
    testTimeout: 20000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
