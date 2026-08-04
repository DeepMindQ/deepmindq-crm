import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    name: 'golden-dataset',
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/ai/ai-golden-dataset.test.ts',
      'tests/ai/ai-hallucination-regression.test.ts',
    ],
    globals: true,
    pool: 'threads',
    maxWorkers: 1,
    testTimeout: 30000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
