/**
 * ESLint Flat Config — Layered Enterprise Linting
 *
 * ARCHITECTURE:
 *   This is the STRICT config. It applies to all source code except:
 *     - .eslint-baseline.json → pre-existing error files (tracked exceptions)
 *     - src/legacy/**       → handled by eslint.legacy.config.ts (relaxed rules)
 *     - tests/**            → test files have different patterns
 *     - scripts/**          → build/utility scripts
 *
 * LAYERS:
 *   1. eslint.config.mjs         → STRICT rules + baseline ignores (this file)
 *   2. eslint.legacy.config.ts   → RELAXED rules for src/legacy/**
 *
 * BASELINE EXCEPTIONS:
 *   Files listed in .eslint-baseline.json have pre-existing lint errors.
 *   They are IGNORED by `npm run lint` but NOT by `npm run lint:strict`.
 *   To remove a file from the baseline:
 *     1. Fix all lint errors in the file
 *     2. Remove it from .eslint-baseline.json
 *     3. Verify `npm run lint:strict` still passes
 *
 * PRINCIPLE: NEW code must be lint-clean. OLD code has documented,
 * tracked exceptions via the baseline file.
 */

import { readFileSync, existsSync } from "fs";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import noUngovernedLlm from "./eslint-rules/no-ungoverned-llm.js";
import noHardcodedEnvPaths from "./eslint-rules/no-hardcoded-env-paths.js";
import noServerUiImport from "./eslint-rules/no-server-ui-import.js";
import noSecrets from "./eslint-rules/no-secrets.js";

// ── Load baseline: files with pre-existing lint errors ──
// These are tracked exceptions. Remove entries as files are fixed.
let baselineFiles = [];
if (existsSync(".eslint-baseline.json")) {
  try {
    baselineFiles = JSON.parse(readFileSync(".eslint-baseline.json", "utf8"));
  } catch {
    // If baseline file is malformed, don't fail config loading
  }
}

const eslintConfig = [
  // ── Layer 0: Next.js recommended + TypeScript ──
  ...nextCoreWebVitals,
  ...nextTypescript,

  // ── Layer 1: STRICT rules for all source code ──
  {
    plugins: {
      "no-ungoverned-llm": {
        rules: {
          "no-ungoverned-llm": noUngovernedLlm,
        },
      },
      "no-hardcoded-env-paths": {
        rules: {
          "no-hardcoded-env-paths": noHardcodedEnvPaths,
        },
      },
      "no-server-ui-import": {
        rules: {
          "no-server-ui-import": noServerUiImport,
        },
      },
      "no-secrets": {
        rules: {
          "no-secrets": noSecrets,
        },
      },
    },
    rules: {
      // ── Custom project rules ──
      "no-ungoverned-llm/no-ungoverned-llm": "error",
      "no-hardcoded-env-paths/no-hardcoded-env-paths": "error",
      "no-server-ui-import/no-server-ui-import": "error",
      "no-secrets/no-secrets": "error",

      // ── TypeScript: STRICT ──
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_", "caughtErrorsIgnorePattern": "^_" }],
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/prefer-as-const": "off",
      "@typescript-eslint/no-require-imports": "off",

      // ── React hooks ──
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/purity": "off",
      "react/no-unescaped-entities": "off",
      "react/display-name": "off",
      "react/prop-types": "off",
      "react-compiler/react-compiler": "off",
      "react-hooks/static-components": "warn",

      // ── Next.js ──
      "@next/next/no-img-element": "off",
      "@next/next/no-html-link-for-pages": "off",

      // ── General: STRICT ──
      "prefer-const": "error",
      "no-unused-vars": "warn",
      "no-console": ["error", { "allow": ["warn", "error", "info"] }],
      "no-debugger": "error",
      "no-empty": "warn",
      "no-irregular-whitespace": "off",
      "no-case-declarations": "off",
      "no-fallthrough": "warn",
      "no-mixed-spaces-and-tabs": "off",
      "no-redeclare": "off",
      "no-undef": "off",
      "no-unreachable": "error",
      "no-useless-escape": "off",
    },
  },

  // ── Layer 2: Global ignores ──
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "examples/**",
      "skills",
      "scripts/**",
      "tests/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "download/**",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "vitest.*.config.ts",
      // Legacy code is linted separately with relaxed rules
      "src/legacy/**",
      // ── BASELINE: Pre-existing error files (tracked exceptions) ──
      // Generated from: npx eslint src/ --format json
      // Remove entries as files are fixed and re-run the scan.
      ...baselineFiles,
    ],
  },
];

export default eslintConfig;
