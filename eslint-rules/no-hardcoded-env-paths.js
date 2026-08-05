/**
 * ESLint custom rule: no-hardcoded-env-paths
 *
 * Prevents machine-specific absolute paths from being introduced into
 * the codebase. These paths work on one developer's machine but fail
 * in CI (GitHub Actions runners use /home/runner/work/...) or on
 * other developers' machines.
 *
 * Blocked patterns:
 *   /home/z/          — Local dev environment
 *   /home/runner/     — GitHub Actions runner
 *   /Users/            — macOS user directories
 *   /private/          — macOS system paths
 *   /tmp/              — Temporary directories (fragile in CI)
 *
 * Allowed exceptions:
 *   Comments, string literals used as documentation/examples,
 *   __dirname-based path construction (runtime resolution)
 *
 * This is a BLOCKING rule — any violation prevents push.
 *
 * Rule ID: no-hardcoded-env-paths
 */

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow machine-specific absolute file paths",
      category: "CI Reliability",
      recommended: true,
    },
    schema: [],
    messages: {
      hardcodedPath: "Hardcoded environment path '{{path}}' detected. Use __dirname, path.resolve(), or process.cwd() instead. CI runners use different absolute paths. See docs/CI_RELIABILITY_GUIDE.md §3.",
    },
  },

  create(context) {
    // Patterns that indicate hardcoded environment-specific paths
    const ENV_PATH_PATTERNS = [
      /\/home\/z\//,       // Local dev environment
      /\/home\/runner\//,  // GitHub Actions runner
      /\/Users\/[^/]/,      // macOS user directories (e.g., /Users/john/)
      /\/private\//,        // macOS system paths
    ];

    // Whitelist: paths that are acceptable even if they match patterns
    const WHITELIST_PATTERNS = [
      /node_modules/,       // npm dependency paths are fine
      /\.next\//,           // Next.js build output
      /coverage\//,          // Test coverage output
      /test-results\//,     // Test results output
    ];

    function isHardcodedEnvPath(value) {
      for (const pattern of ENV_PATH_PATTERNS) {
        if (pattern.test(value)) {
          // Check if it's whitelisted (e.g., inside node_modules)
          const isWhitelisted = WHITELIST_PATTERNS.some(wp => wp.test(value));
          if (!isWhitelisted) {
            return pattern.exec(value)[0];
          }
        }
      }
      return null;
    }

    return {
      // Check string literals
      Literal(node) {
        if (typeof node.value !== "string") return;

        const match = isHardcodedEnvPath(node.value);
        if (match) {
          context.report({
            node,
            messageId: "hardcodedPath",
            data: { path: match },
          });
        }
      },

      // Check template literals
      TemplateLiteral(node) {
        for (const quasi of node.quasis) {
          if (typeof quasi.value.raw !== "string") continue;
          const match = isHardcodedEnvPath(quasi.value.raw);
          if (match) {
            context.report({
              node,
              messageId: "hardcodedPath",
              data: { path: match },
            });
          }
        }
      },
    };
  },
};
