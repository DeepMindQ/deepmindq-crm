/**
 * Vitest Configuration — UI
 * M3 Stabilization — threads pool, single thread
 *
 * jsdom environment with React plugin. Threads pool avoids fork OOM.
 */
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    name: 'ui',
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/ui/**/*.test.{ts,tsx}',
    ],
    exclude: [
      'tests/legacy/**',
    ],
    globals: true,
    pool: 'threads',
    maxThreads: 1,
    minThreads: 1,
    testTimeout: 15000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  coverage: {
    provider: 'v8',
    reporter: ['text', 'json', 'html', 'lcov'],
    include: ['src/**/*.{ts,tsx}'],
    exclude: [
      'src/**/*.d.ts',
      'src/**/*.test.{ts,tsx}',
      'src/**/__tests__/**',
      'src/app/api/**/route.ts',
      'src/proxy.ts',
    ],
    thresholds: {
      statements: 30,
      branches: 20,
      functions: 30,
      lines: 30,
    },
  },
})
