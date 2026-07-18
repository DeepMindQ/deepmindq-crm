/**
 * ESLint custom rule: no-ungoverned-llm
 *
 * Enforces the AI governance architecture:
 * - Only ai-governance.ts may import callLLM from zai-helpers
 * - No file may import callChatLLM (removed function)
 * - No file may import from AI SDK ('ai') or OpenAI SDK directly
 * - Other imports from zai-helpers (webSearch, extractJSON, tavilyAIAnswer, etc.) are fine
 */

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Prevents unapproved direct LLM/AI SDK imports outside the governance layer",
      category: "Architecture",
      recommended: true,
    },
    messages: {
      ungovernedCallLLM:
        "Direct import of 'callLLM' is only allowed in 'ai-governance.ts'. Use 'governedAICall()' or 'governedAICallAggregate()' from '@/lib/ai-governance' instead.",
      removedCallChatLLM:
        "'callChatLLM' was removed in Phase 3 and must not be imported or used.",
      directAiSdk:
        "Direct import from 'ai' SDK is forbidden. All AI calls must go through the governance layer (ai-governance.ts).",
      directOpenAiSdk:
        "Direct import from 'openai' SDK is forbidden. All AI calls must go through the governance layer (ai-governance.ts).",
      directAiSdkOpenai:
        "Direct import from '@ai-sdk/openai' is forbidden. All AI calls must go through the governance layer (ai-governance.ts).",
    },
    schema: [],
  },

  create(context) {
    // Extract the filename from the source code file path
    const filename = context.getFilename();

    // Helper: check if the current file is the approved governance file
    function isGovernanceFile() {
      return filename.endsWith("ai-governance.ts");
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
          // Could be default import: import OpenAI from 'openai'
          // Or named imports from openai
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
        // Only allowed in ai-governance.ts
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
          // If it IS the governance file, allow it silently
        }
      },
    };
  },
};