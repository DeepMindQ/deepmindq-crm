/**
 * Vitest Base Configuration — M4 Phase 1
 *
 * DEFAULT: runs nothing (prevents accidental single-workload OOM).
 * Use category-specific configs or npm scripts to run tests.
 *
 * After M4 Phase 1 dedup: all 64 root-level mirror test files removed.
 * Tests are organized in subdirectories with dedicated vitest configs.
 * See package.json "test:*" scripts for execution commands.
 */
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    // All subdirectories are excluded — this config intentionally runs nothing.
    // Use category-specific configs: vitest.{unit,security,ai,database,...}.config.ts
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    exclude: [
      'tests/legacy/**',
      'tests/unit/**',
      'tests/security/**',
      'tests/api/**',
      'tests/database/**',
      'tests/ai/**',
      'tests/integration/**',
      'tests/e2e/**',
      'tests/performance/**',
      'tests/ui/**',
      'tests/m5/**',
      'tests/real-integration/**',
      'tests/ai-testing/**',
      'tests/fixtures/**',
      'tests/helpers/**',
      'tests/functional/**',
      'tests/smoke/**',
      'tests/audit/**',
      'tests/phase1-6-signal-accuracy.test.ts',
      'tests/phase1-7-tech-detection.test.ts',
    ],
    globals: true,
    pool: 'threads',
    maxThreads: 1,
    minThreads: 1,
    testTimeout: 30000,
    hookTimeout: 10000,
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
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
