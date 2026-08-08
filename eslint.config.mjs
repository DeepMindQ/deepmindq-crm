import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { dirname } from "path";
import { fileURLToPath } from "url";
import noUngovernedLlm from "./eslint-rules/no-ungoverned-llm.js";
import noHardcodedEnvPaths from "./eslint-rules/no-hardcoded-env-paths.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
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
  },
  rules: {
    "no-ungoverned-llm/no-ungoverned-llm": "error",
    "no-hardcoded-env-paths/no-hardcoded-env-paths": "error",
    // TypeScript rules
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/prefer-as-const": "off",
    "@typescript-eslint/no-require-imports": "off",
    
    // React hooks rules
    "react-hooks/rules-of-hooks": "error",
    // setState in effect
    "react-hooks/set-state-in-effect": "off",
    "react-hooks/exhaustive-deps": "warn",
    "react-hooks/purity": "off",
    "react/no-unescaped-entities": "off",
    "react/display-name": "off",
    "react/prop-types": "off",
    "react-compiler/react-compiler": "off",
    "react-hooks/static-components": "warn",
    
    // Next.js rules
    "@next/next/no-img-element": "off",
    "@next/next/no-html-link-for-pages": "off",
    
    // General JavaScript rules
    "prefer-const": "warn",
    "no-unused-vars": "warn",
    "no-console": "warn",
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
}, {
  ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "examples/**", "skills", "scripts/**"]
}];

export default eslintConfig;
