/**
 * ESLint Legacy Config — Relaxed rules for src/legacy/**
 *
 * This config applies ONLY to files in src/legacy/.
 * These are pre-existing files that have known lint violations.
 * The violations are TRACKED and DOCUMENTED here.
 *
 * RELAXED vs STRICT:
 *   - `@typescript-eslint/no-explicit-any`  → warn (not error)
 *   - `@typescript-eslint/no-unused-vars`   → warn
 *   - `no-console`                         → off
 *   - `no-ungoverned-llm`                   → warn (still tracked)
 *   - `no-hardcoded-env-paths`             → warn (still tracked)
 *
 * MIGRATION PATH:
 *   1. Fix all lint errors in a legacy file
 *   2. Move it from src/legacy/ to its proper src/ location
 *   3. Verify it passes `npm run lint:strict`
 *   4. Remove it from this config's tracking
 *
 * FILES IN LEGACY (add new entries here when moving files):
 *   (none yet — populate as files are migrated)
 */

import type { Linter } from "eslint";

const legacyConfig: Linter.Config[] = [
  {
    files: ["src/legacy/**/*.ts", "src/legacy/**/*.tsx", "src/legacy/**/*.js", "src/legacy/**/*.jsx"],

    plugins: {},

    rules: {
      // ── TypeScript: RELAXED ──
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/prefer-as-const": "off",
      "@typescript-eslint/no-require-imports": "off",

      // ── React hooks ──
      "react-hooks/rules-of-hooks": "error",    // Still enforce — this is a runtime crash guard
      "react-hooks/exhaustive-deps": "warn",

      // ── General: RELAXED ──
      "prefer-const": "warn",
      "no-unused-vars": "warn",
      "no-console": "off",                       // Legacy code may use console freely
      "no-debugger": "warn",
      "no-empty": "off",
      "no-unreachable": "warn",
    },
  },
];

export default legacyConfig;
