/**
 * Vitest Configuration — AI Framework
 * Phase 5.5 Enterprise Test Architecture
 *
 * Covers: Agent framework, AI memory, recommendation engine,
 * explainability engine, knowledge graph, retrieval validation
 * Environment: node | Pool: forks | Memory: 2048
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
