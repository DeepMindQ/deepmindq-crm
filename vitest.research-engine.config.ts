import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    name: 'research-engine-audit',
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/ai/research-engine.test.ts'],
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
