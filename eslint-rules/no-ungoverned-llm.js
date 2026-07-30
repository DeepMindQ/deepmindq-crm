/**
 * ESLint custom rule: no-ungoverned-llm
 *
 * Enforces the AI governance architecture (Ticket 3 deep-hardened):
 * - Only ai-governance.ts OR engines/model-router.ts may import callLLM
 *   from zai-helpers. Both ARE governance layers.
 * - No file may import getZAI from llm-client — raw Z.ai SDK access
 *   bypasses governance. Only ai-governance.ts and model-router.ts
 *   are allowed (they ARE the governance layer).
 * - No file may import callChatLLM (removed function)
 * - No file may import from AI SDK ('ai') or OpenAI SDK directly
 * - No file may import ModelRouter from engines/model-router outside
 *   of ai-governance.ts (all route files must use governedAICall /
 *   governedAICallAggregate instead)
 * - No file may make raw fetch() calls to AI provider APIs
 *   (api.openai.com, api.groq.com, generativelanguage.googleapis.com, etc.)
 * - Other imports from zai-helpers (webSearch, extractJSON, tavilyAIAnswer,
 *   sdkWebSearch, etc.) are fine
 */

// Files allowed to import callLLM, getZAI, or ModelRouter directly —
// they ARE the governance/routing layer
const ALLOWED_GOVERNANCE_FILES = new Set([
  "ai-governance.ts", // Central governance (governedAICall, governedAICallAggregate)
  "model-router.ts",  // Tiered router (ModelRouter.complete)
  "llm-client.ts",    // Base LLM client (exports getZAI for governance layer use)
]);

// AI provider API hostnames — raw fetch() to these bypasses governance
const AI_PROVIDER_HOSTS = [
  "api.openai.com",
  "api.groq.com",
  "generativelanguage.googleapis.com",
  "api.anthropic.com",
  "api.deepseek.com",
  "api.mistral.ai",
  "api.fireworks.ai",
  "api.together.xyz",
  "api.nvidia.com",
  "openrouter.ai",
];

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Prevents unapproved direct LLM/AI SDK imports and raw fetch() calls to AI provider APIs outside the governance layer",
      category: "Architecture",
      recommended: true,
    },
    messages: {
      ungovernedCallLLM:
        "Direct import of 'callLLM' is only allowed in governance layer files. Use 'governedAICall()' from '@/lib/ai-governance' instead.",
      ungovernedGetZAI:
        "Direct import of 'getZAI' is only allowed in governance layer files (ai-governance.ts, model-router.ts, llm-client.ts). Use 'governedAICall()' or 'governedAICallAggregate()' from '@/lib/ai-governance' instead.",
      ungovernedModelRouter:
        "Direct import of 'ModelRouter' is only allowed in governance layer files. Route handlers must use 'governedAICall()' or 'governedAICallAggregate()' from '@/lib/ai-governance' instead.",
      removedCallChatLLM:
        "'callChatLLM' was removed in Phase 3 and must not be imported or used.",
      directAiSdk:
        "Direct import from 'ai' SDK is forbidden. All AI calls must go through the governance layer.",
      directOpenAiSdk:
        "Direct import from 'openai' SDK is forbidden. All AI calls must go through the governance layer.",
      directAiSdkOpenai:
        "Direct import from '@ai-sdk/openai' is forbidden. All AI calls must go through the governance layer.",
      rawFetchToAiProvider:
        "Direct fetch() to AI provider API is forbidden. All AI calls must go through the governance layer via governedAICall() or governedAICallAggregate() from '@/lib/ai-governance'.",
    },
    schema: [],
  },

  create(context) {
    // Extract the filename from the source code file path
    const filename = context.getFilename();

    // Helper: check if the current file is an approved governance file
    function isGovernanceFile() {
      return Array.from(ALLOWED_GOVERNANCE_FILES).some((name) =>
        filename.endsWith(name),
      );
    }

    // Helper: check if any of the imported specifiers match a given name
    function hasNamedImport(specifiers, name) {
      if (!specifiers) return false;
      return specifiers.some(
        (s) =>
          s.type === "ImportSpecifier" &&
          (s.imported?.name === name || s.imported?.value === name)
      );
    }

    // Helper: check for default import
    function hasDefaultImport(specifiers, name) {
      if (!specifiers) return false;
      return specifiers.some(
        (s) => s.type === "ImportDefaultSpecifier" && s.local?.name === name
      );
    }

    // Helper: check if a string literal contains an AI provider hostname
    function isAiProviderUrl(str) {
      if (!str) return false;
      const lower = str.toLowerCase();
      return AI_PROVIDER_HOSTS.some((host) => lower.includes(host));
    }

    return {
      ImportDeclaration(node) {
        const source = node.source?.value || "";

        // ── Banned import: callChatLLM from anywhere ──
        if (hasNamedImport(node.specifiers, "callChatLLM")) {
          context.report({
            node,
            messageId: "removedCallChatLLM",
          });
          return;
        }

        // ── Banned import: from 'ai' (Vercel AI SDK) ──
        if (source === "ai") {
          context.report({
            node,
            messageId: "directAiSdk",
          });
          return;
        }

        // ── Banned import: from 'openai' ──
        if (source === "openai") {
          context.report({
            node,
            messageId: "directOpenAiSdk",
          });
          return;
        }

        // ── Banned import: from '@ai-sdk/openai' ──
        if (source === "@ai-sdk/openai") {
          context.report({
            node,
            messageId: "directAiSdkOpenai",
          });
          return;
        }

        // ── Restricted import: callLLM from zai-helpers ──
        // Only allowed in governance layer files
        if (
          source.includes("zai-helpers") &&
          hasNamedImport(node.specifiers, "callLLM")
        ) {
          if (!isGovernanceFile()) {
            context.report({
              node,
              messageId: "ungovernedCallLLM",
            });
          }
        }

        // ── Restricted import: getZAI from llm-client ──
        // Ticket 3: getZAI bypasses all governance. Only allowed in
        // ai-governance.ts (governance layer), model-router.ts (router),
        // and llm-client.ts (where it's defined).
        if (
          source.includes("llm-client") &&
          hasNamedImport(node.specifiers, "getZAI")
        ) {
          if (!isGovernanceFile()) {
            context.report({
              node,
              messageId: "ungovernedGetZAI",
            });
          }
        }

        // ── Restricted import: ModelRouter from engines/model-router or barrel export ──
        // Ticket 3 deep audit: Also catch ModelRouter imported via barrel export
        // '@/lib/engines' which re-exports ModelRouter from './model-router'.
        // Route handlers must use governedAICall / governedAICallAggregate instead.
        // Only allowed in ai-governance.ts (which wraps it) and model-router.ts (definition).
        if (
          hasNamedImport(node.specifiers, "ModelRouter") &&
          (source.includes("engines/model-router") || source.includes("/engines") || source.endsWith("/engines"))
        ) {
          if (!isGovernanceFile()) {
            context.report({
              node,
              messageId: "ungovernedModelRouter",
            });
          }
        }
      },

      // ── Check for raw fetch() calls to AI provider APIs ──
      CallExpression(node) {
        if (
          node.callee?.type === "MemberExpression" &&
          node.callee.object?.name === "fetch" &&
          node.arguments.length > 0
        ) {
          const firstArg = node.arguments[0];
          // Check string literal URLs
          if (firstArg.type === "Literal" && typeof firstArg.value === "string") {
            if (isAiProviderUrl(firstArg.value) && !isGovernanceFile()) {
              context.report({
                node,
                messageId: "rawFetchToAiProvider",
              });
            }
          }
          // Check template literal URLs
          if (firstArg.type === "TemplateLiteral") {
            for (const quasi of firstArg.quasis) {
              if (isAiProviderUrl(quasi.value?.raw) && !isGovernanceFile()) {
                context.report({
                  node,
                  messageId: "rawFetchToAiProvider",
                });
                break;
              }
            }
          }
          // Check concatenated URLs (e.g., 'https://' + host + '/v1/...')
          if (firstArg.type === "BinaryExpression") {
            // Walk the binary expression tree to extract string parts
            function extractStrings(expr) {
              if (expr.type === "Literal" && typeof expr.value === "string") return [expr.value];
              if (expr.type === "BinaryExpression") {
                return [...extractStrings(expr.left), ...extractStrings(expr.right)];
              }
              return [];
            }
            const parts = extractStrings(firstArg);
            const joined = parts.join("");
            if (isAiProviderUrl(joined) && !isGovernanceFile()) {
              context.report({
                node,
                messageId: "rawFetchToAiProvider",
              });
            }
          }
        }
      },
    };
  },
};
