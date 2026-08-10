/**
 * ESLint custom rule: no-server-ui-import
 * 
 * Prevents server-side API route handlers from importing UI components.
 * API routes (src/app/api/**) run on the server and should never import
 * from src/components/** which are React client components.
 * 
 * Pattern: Import from 'src/components/' or '@/components/' is blocked
 * in files matching src/app/api/**/route.ts
 * 
 * Rationale:
 *   - API routes run in Node.js runtime, not browser
 *   - UI components import 'react', CSS modules, and browser APIs
 *   - Accidental UI imports in API routes cause Edge Runtime crashes
 *   - Keep server and client boundaries explicit
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow importing UI components in server-side API route files',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      noServerUiImport: 'Server-side API route must not import UI components from "{{ source }}". API routes run on the server and should not import React components.',
    },
    schema: [], // no options
  },

  create(context) {
    const filename = context.getFilename();

    // Only apply to API route files
    const isApiRoute = /src\/app\/api\/.*\/route\.(ts|js|tsx|jsx)$/.test(filename);
    if (!isApiRoute) return {};

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        
        // Check if import is from components directory
        const isComponentImport = (
          source.startsWith('@/components/') ||
          source.startsWith('../components/') ||
          source.startsWith('./components/') ||
          source.startsWith('src/components/') ||
          // Also catch aliased component paths
          source.includes('/components/screens/') ||
          source.includes('/components/shared/') ||
          source.includes('/components/intelligence-os/')
        );

        if (isComponentImport) {
          context.report({
            node,
            messageId: 'noServerUiImport',
            data: { source },
          });
        }
      },
    };
  },
};
